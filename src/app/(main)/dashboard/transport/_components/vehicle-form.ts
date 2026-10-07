import type { FuelType, Vehicle, VehicleCategory } from "../_data/vehicles";

/** Состояние формы транспорта и превращение его в данные для сервера. Без React: логику можно проверять отдельно. */

export type LevelForm = { key: string; price: string; bonus: string };
export type UpgradeForm = { key: string; name: string; description: string; levels: LevelForm[] };

export type FormState = {
  code: string;
  name: string;
  model: string;
  category: VehicleCategory;
  speed: string;
  tunedSpeed: string;
  price: string;
  scrapPrice: string;
  fuel: FuelType;
  trunkKg: string;
  loadTons: string;
  sources: string[];
  imageUrl: string;
  transferable: boolean;
  driftChip: boolean;
  nitro: boolean;
  isNew: boolean;
  upgrades: UpgradeForm[];
};

export const LIMITS = {
  name: 60,
  model: 60,
  source: 60,
  sources: 20,
  upgrades: 20,
  levels: 10,
  upgradeName: 80,
  upgradeDescription: 300,
  bonus: 80,
} as const;

let keySeq = 0;
export const nextKey = () => `k${++keySeq}`;

export const emptyLevel = (): LevelForm => ({ key: nextKey(), price: "", bonus: "" });
export const emptyUpgrade = (name = ""): UpgradeForm => ({
  key: nextKey(),
  name,
  description: "",
  levels: [emptyLevel()],
});

export const emptyForm = (): FormState => ({
  code: "",
  name: "",
  model: "",
  category: "Легковые",
  speed: "",
  tunedSpeed: "",
  price: "",
  scrapPrice: "",
  fuel: "АИ-95",
  trunkKg: "0",
  loadTons: "",
  sources: [],
  imageUrl: "",
  transferable: true,
  driftChip: false,
  nitro: false,
  isNew: true,
  upgrades: [],
});

export const toForm = (vehicle: Vehicle): FormState => ({
  code: vehicle.code,
  name: vehicle.name,
  model: vehicle.model,
  category: vehicle.category,
  speed: String(vehicle.speed),
  tunedSpeed: String(vehicle.tunedSpeed),
  price: String(vehicle.price),
  scrapPrice: vehicle.scrapPrice === undefined ? "" : String(vehicle.scrapPrice),
  fuel: vehicle.fuel,
  trunkKg: String(vehicle.trunkKg),
  loadTons: vehicle.loadTons === undefined ? "" : String(vehicle.loadTons),
  sources: [...vehicle.sources],
  imageUrl: vehicle.imageUrl ?? "",
  transferable: vehicle.transferable,
  driftChip: vehicle.driftChip,
  nitro: vehicle.nitro,
  isNew: vehicle.isNew ?? false,
  upgrades: (vehicle.upgrades ?? []).map((upgrade) => ({
    key: nextKey(),
    name: upgrade.name,
    description: upgrade.description,
    levels: upgrade.levels.map((level) => ({
      key: nextKey(),
      price: String(level.price),
      bonus: level.bonus ?? "",
    })),
  })),
});

/* Ввод чисел */

/** Оставляет только цифры: для целых полей (скорость, цена, багажник). */
export const digitsOnly = (value: string, maxLength = 12) => value.replace(/\D/g, "").slice(0, maxLength);

/** «17000000» → «17 000 000»: так цену удобнее читать прямо в поле. */
export const groupDigits = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");

/** Десятичное число (грузоподъёмность): цифры и один разделитель, запятая превращается в точку. */
export function decimalOnly(value: string, maxLength = 7): string {
  const cleaned = value.replace(",", ".").replace(/[^\d.]/g, "");
  const dot = cleaned.indexOf(".");
  const normalized = dot === -1 ? cleaned : `${cleaned.slice(0, dot + 1)}${cleaned.slice(dot + 1).replace(/\./g, "")}`;
  return normalized.slice(0, maxLength);
}

const toNumber = (value: string): number => {
  const trimmed = value.replace(/[\s\u00A0_]/g, "").replace(",", ".");
  return trimmed === "" ? Number.NaN : Number(trimmed);
};

/* Код (адрес страницы) */

const TRANSLIT: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "c",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

/** «Superior 90G» → «superior-90g»; кириллица транслитерируется. Подходит под правило кода: латиница, цифры, дефис. */
export function slugify(...parts: string[]): string {
  const text = parts
    .join(" ")
    .toLowerCase()
    .split("")
    .map((char) => TRANSLIT[char] ?? char)
    .join("");
  return text
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
}

export const CODE_PATTERN = /^[a-z0-9][a-z0-9-]{1,48}$/;

/* Предпросмотр */

/** Транспорт из формы для карточки-предпросмотра. Никогда не бросает ошибок: недозаполненные поля дают нули. */
export function previewVehicle(form: FormState): Vehicle {
  const price = toNumber(form.price);
  const speed = toNumber(form.speed);
  const tuned = toNumber(form.tunedSpeed);
  const trunk = toNumber(form.trunkKg);
  const load = toNumber(form.loadTons);
  return {
    code: form.code || "код",
    name: form.name.trim() || "Название",
    model: form.model.trim() || "Модель",
    category: form.category,
    speed: Number.isFinite(speed) ? speed : 0,
    tunedSpeed: Number.isFinite(tuned) ? tuned : 0,
    price: Number.isFinite(price) ? price : 0,
    sources: form.sources,
    fuel: form.fuel,
    trunkKg: Number.isFinite(trunk) ? trunk : 0,
    loadTons: Number.isFinite(load) && load > 0 ? load : undefined,
    transferable: form.transferable,
    driftChip: form.driftChip,
    nitro: form.nitro,
    isNew: form.isNew,
    imageUrl: form.imageUrl.trim() || undefined,
  };
}

/* Проверка и сборка данных */

export type FieldErrors = Record<string, string>;

export type BuildResult =
  | { ok: true; payload: Record<string, unknown> }
  | { ok: false; errors: FieldErrors; first: string };

export const upgradeNameField = (index: number) => `upgrade-${index}-name`;
export const upgradeLevelsField = (index: number) => `upgrade-${index}-levels`;
export const levelField = (index: number, level: number) => `upgrade-${index}-level-${level}`;

function intInRange(value: string, label: string, min: number, max: number, errors: FieldErrors, field: string) {
  const number = toNumber(value);
  if (!Number.isFinite(number)) errors[field] = `Укажите число: ${label.toLowerCase()}`;
  else if (!Number.isInteger(number) || number < min || number > max) {
    errors[field] = `От ${min.toLocaleString("ru-RU")} до ${max.toLocaleString("ru-RU")}`;
  }
  return number;
}

/** Проверяет форму и собирает данные для сервера. Ошибки привязаны к полям, а не к первой найденной. */
export function buildPayload(form: FormState, options: { editing: boolean }): BuildResult {
  const errors: FieldErrors = {};

  const name = form.name.trim();
  const model = form.model.trim();
  if (!name) errors.name = "Введите название";
  else if (name.length > LIMITS.name) errors.name = `Не длиннее ${LIMITS.name} символов`;
  if (!model) errors.model = "Введите модель";
  else if (model.length > LIMITS.model) errors.model = `Не длиннее ${LIMITS.model} символов`;

  const code = form.code.trim().toLowerCase();
  if (!options.editing && !CODE_PATTERN.test(code)) {
    errors.code = "Латиница, цифры и дефис, от 2 до 49 символов";
  }

  const speed = intInRange(form.speed, "Скорость", 0, 1000, errors, "speed");
  const tunedSpeed = intInRange(form.tunedSpeed, "Скорость в тюнинге", 0, 1000, errors, "tunedSpeed");
  const price = intInRange(form.price, "Гос. стоимость", 1, 10_000_000_000, errors, "price");
  const trunkKg = intInRange(form.trunkKg, "Багажник", 0, 100_000, errors, "trunkKg");

  let scrapPrice: number | undefined;
  if (form.scrapPrice.trim() !== "")
    scrapPrice = intInRange(form.scrapPrice, "Стоимость свалки", 0, 10_000_000_000, errors, "scrapPrice");

  let loadTons: number | undefined;
  if (form.loadTons.trim() !== "") {
    loadTons = toNumber(form.loadTons);
    if (!Number.isFinite(loadTons) || loadTons < 0 || loadTons > 1000) errors.loadTons = "От 0 до 1 000 т";
  }

  if (form.sources.length > LIMITS.sources) errors.sources = `Не больше ${LIMITS.sources} источников`;

  const imageUrl = form.imageUrl.trim();
  if (imageUrl && !/^(\/(?!\/)|https:\/\/)\S+$/.test(imageUrl)) {
    errors.imageUrl = "Нужна ссылка https://... или путь, начинающийся с /";
  }

  const upgrades = form.upgrades.map((upgrade, index) => {
    const upgradeName = upgrade.name.trim();
    if (!upgradeName) errors[upgradeNameField(index)] = "Назовите улучшение";
    else if (upgradeName.length > LIMITS.upgradeName)
      errors[upgradeNameField(index)] = `Не длиннее ${LIMITS.upgradeName} символов`;
    if (upgrade.description.length > LIMITS.upgradeDescription) {
      errors[upgradeNameField(index)] = `Описание длиннее ${LIMITS.upgradeDescription} символов`;
    }
    if (upgrade.levels.length === 0) errors[upgradeLevelsField(index)] = "Добавьте хотя бы один уровень";

    const levels = upgrade.levels.map((level, levelIndex) => {
      const levelPrice = toNumber(level.price);
      if (
        !Number.isFinite(levelPrice) ||
        !Number.isInteger(levelPrice) ||
        levelPrice < 0 ||
        levelPrice > 10_000_000_000
      ) {
        errors[levelField(index, levelIndex)] = "Укажите цену уровня";
      }
      const bonus = level.bonus.trim();
      if (bonus.length > LIMITS.bonus)
        errors[levelField(index, levelIndex)] = `Бонус не длиннее ${LIMITS.bonus} символов`;
      return bonus ? { price: levelPrice, bonus } : { price: levelPrice };
    });
    return { name: upgradeName, description: upgrade.description.trim(), levels };
  });

  const fields = Object.keys(errors);
  if (fields.length > 0) return { ok: false, errors, first: fields[0] };

  return {
    ok: true,
    payload: {
      code,
      name,
      model,
      category: form.category,
      speed,
      tunedSpeed,
      price,
      scrapPrice,
      sources: form.sources.map((source) => source.trim()).filter(Boolean),
      fuel: form.fuel,
      trunkKg,
      loadTons,
      transferable: form.transferable,
      driftChip: form.driftChip,
      nitro: form.nitro,
      isNew: form.isNew,
      imageUrl: imageUrl || undefined,
      upgrades: upgrades.length > 0 ? upgrades : undefined,
    },
  };
}

/** Строки «цена» или «цена | бонус» (формат старой формы) → уровни. Нужны для вставки списком из буфера обмена. */
export function parseLevelLines(text: string): LevelForm[] {
  const result: LevelForm[] = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = /^([\d\s\u00A0_]+?)\s*(?:\|\s*(.*))?$/.exec(line);
    if (!match) return [];
    const digits = match[1].replace(/[\s\u00A0_]/g, "");
    if (!digits) return [];
    result.push({ key: nextKey(), price: digits, bonus: match[2]?.trim() ?? "" });
  }
  return result;
}
