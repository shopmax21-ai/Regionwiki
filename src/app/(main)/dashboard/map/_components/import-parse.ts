import {
  isInsideWorld,
  isPlaceIconImage,
  isPlaceIconPreset,
  PLACE_LIMITS,
  type PlaceCategoryId,
  placeCategories,
} from "./map-data";

/** Не больше стольких меток за один раз: больше нужно только при ошибке в файле. */
export const IMPORT_MAX_ROWS = 500;

export interface ImportRow {
  name: string;
  category: PlaceCategoryId;
  x: number;
  y: number;
  description: string;
  /** Пусто — иконка категории */
  icon: string;
}

export interface ImportError {
  /** Номер строки или элемента, как его видит человек (с единицы) */
  line: number;
  message: string;
}

export interface ParseResult {
  rows: ImportRow[];
  errors: ImportError[];
  /** Сколько всего меток найдено в файле, включая ошибочные */
  total: number;
  /** Ошибка файла целиком (не удалось разобрать, слишком много строк) */
  fatal: string | null;
}

const FIELD_ALIASES: Record<string, string> = {
  name: "name",
  title: "name",
  название: "name",
  имя: "name",
  category: "category",
  type: "category",
  категория: "category",
  тип: "category",
  x: "x",
  y: "y",
  description: "description",
  desc: "description",
  описание: "description",
  icon: "icon",
  иконка: "icon",
};

const normalizeKey = (key: string) => FIELD_ALIASES[key.trim().toLowerCase().replace(/^\uFEFF/, "")];

function resolveCategory(value: unknown): PlaceCategoryId | null {
  const text = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!text) return "other";
  const found = placeCategories.find((item) => item.id === text || item.label.toLowerCase() === text);
  return found?.id ?? null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const text = value.trim().replace(",", ".");
  if (text === "") return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Проверяет одну запись с уже приведёнными именами полей. */
function toRow(record: Record<string, unknown>): ImportRow | string {
  const name = typeof record.name === "string" ? record.name.trim() : "";
  if (!name) return "не указано название";
  if (name.length > PLACE_LIMITS.name) return `название длиннее ${PLACE_LIMITS.name} символов`;

  const category = resolveCategory(record.category);
  if (!category) return `неизвестная категория «${String(record.category)}»`;

  const x = toNumber(record.x);
  const y = toNumber(record.y);
  if (x === null || y === null) return "координаты X и Y должны быть числами";
  if (!isInsideWorld({ x, y })) return `координаты ${x}, ${y} за пределами карты`;

  const description = typeof record.description === "string" ? record.description.trim() : "";
  if (description.length > PLACE_LIMITS.description) {
    return `описание длиннее ${PLACE_LIMITS.description} символов`;
  }

  const icon = typeof record.icon === "string" ? record.icon.trim() : "";
  if (icon && !isPlaceIconPreset(icon) && !isPlaceIconImage(icon)) {
    return `неизвестная иконка «${icon}»: нужен id готовой иконки или адрес картинки`;
  }
  return { name, category, x, y, description, icon };
}

function finish(records: { line: number; record: Record<string, unknown> }[]): ParseResult {
  if (records.length > IMPORT_MAX_ROWS) {
    return {
      rows: [],
      errors: [],
      total: records.length,
      fatal: `В файле ${records.length} меток, за один раз можно не больше ${IMPORT_MAX_ROWS}`,
    };
  }
  const rows: ImportRow[] = [];
  const errors: ImportError[] = [];
  for (const { line, record } of records) {
    const row = toRow(record);
    if (typeof row === "string") errors.push({ line, message: row });
    else rows.push(row);
  }
  return { rows, errors, total: records.length, fatal: null };
}

const fatal = (message: string): ParseResult => ({ rows: [], errors: [], total: 0, fatal: message });

function parseJson(text: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return fatal("Не удалось прочитать JSON: проверьте скобки и запятые");
  }
  const list = Array.isArray(data)
    ? data
    : data && typeof data === "object"
      ? ((data as Record<string, unknown>).places ?? (data as Record<string, unknown>).markers)
      : null;
  if (!Array.isArray(list)) return fatal("В JSON ожидается список меток: [ { \"name\": ... }, ... ]");

  return finish(
    list.map((item, index) => {
      const record: Record<string, unknown> = {};
      if (item && typeof item === "object") {
        for (const [key, value] of Object.entries(item)) {
          const field = normalizeKey(key);
          if (field) record[field] = value;
        }
      }
      return { line: index + 1, record };
    }),
  );
}

/** Разбор CSV с кавычками. Разделитель — запятая или точка с запятой (так сохраняет Excel). */
function parseCsvCells(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = firstLine.split(";").length > firstLine.split(",").length ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  row.push(cell);
  rows.push(row);
  return rows.filter((cells) => cells.some((value) => value.trim() !== ""));
}

function parseCsv(text: string): ParseResult {
  const table = parseCsvCells(text);
  const [header, ...body] = table;
  const fields = (header ?? []).map((cell) => normalizeKey(cell));
  if (!fields.includes("name") || !fields.includes("x") || !fields.includes("y")) {
    return fatal("В первой строке нужны заголовки: name, category, x, y, description");
  }
  return finish(
    body.map((cells, index) => {
      const record: Record<string, unknown> = {};
      fields.forEach((field, column) => {
        if (field) record[field] = cells[column] ?? "";
      });
      // Строка 1 — заголовки, поэтому данные начинаются со второй
      return { line: index + 2, record };
    }),
  );
}

/** Определяет формат по содержимому: JSON начинается со скобки, всё остальное считается CSV. */
export function parseImport(raw: string): ParseResult {
  const text = raw.replace(/^\uFEFF/, "").trim();
  if (!text) return fatal("Файл пустой");
  return text.startsWith("[") || text.startsWith("{") ? parseJson(text) : parseCsv(text);
}

export const IMPORT_EXAMPLE = `name,category,x,y,description
Центральный банк,state,120.5,-340,Вход со стороны площади
Круглосуточный магазин,shop,-800,412,
`;
