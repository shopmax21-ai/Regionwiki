import type { GuideBlock } from "../_data/jobs";

/** Шаблон, который редактор сохранил у себя в браузере. */
export type StoredTemplate = {
  id: string;
  name: string;
  createdAt: number;
  blocks: GuideBlock[];
};

/** Раздел гайда: заголовок вместе с блоками, которые идут до следующего заголовка. */
export type TemplateSection = {
  key: string;
  title: string | null;
  blocks: GuideBlock[];
};

const STORAGE_KEY = "region-guide-templates-v1";
export const MAX_STORED_TEMPLATES = 30;

/** Делит блоки на разделы. Заголовок остаётся в разделе первым блоком, всё до первого заголовка — раздел без названия. */
export function splitIntoSections(blocks: readonly GuideBlock[]): TemplateSection[] {
  const sections: TemplateSection[] = [];
  for (const block of blocks) {
    if (block.type === "heading") {
      sections.push({ key: `s${sections.length}`, title: block.text, blocks: [block] });
      continue;
    }
    let current = sections.at(-1);
    if (!current) {
      current = { key: `s${sections.length}`, title: null, blocks: [] };
      sections.push(current);
    }
    current.blocks.push(block);
  }
  return sections;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const isSlide = (value: unknown) => isRecord(value) && typeof value.src === "string";

function isBlock(value: unknown): value is GuideBlock {
  if (!isRecord(value)) return false;
  switch (value.type) {
    case "heading":
    case "text":
      return typeof value.text === "string";
    case "callout":
      return typeof value.text === "string" && ["tip", "info", "warning"].includes(String(value.variant));
    case "list":
      return (
        typeof value.ordered === "boolean" &&
        Array.isArray(value.items) &&
        value.items.every((i) => typeof i === "string")
      );
    case "image":
      return typeof value.src === "string";
    case "slider":
      return Array.isArray(value.slides) && value.slides.every(isSlide);
    default:
      return false;
  }
}

function isTemplate(value: unknown): value is StoredTemplate {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.createdAt === "number" &&
    Array.isArray(value.blocks) &&
    value.blocks.length > 0 &&
    value.blocks.every(isBlock)
  );
}

/** Шаблоны из браузера. Если хранилище недоступно или данные повреждены, возвращается пустой список. */
export function loadTemplates(): StoredTemplate[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isTemplate) : [];
  } catch {
    return [];
  }
}

function persist(templates: StoredTemplate[]): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
    return true;
  } catch {
    return false;
  }
}

/** Добавляет шаблон в начало списка. Возвращает новый список или null, если сохранить не удалось. */
export function addTemplate(name: string, blocks: GuideBlock[]): StoredTemplate[] | null {
  const next: StoredTemplate[] = [
    { id: crypto.randomUUID(), name, createdAt: Date.now(), blocks },
    ...loadTemplates(),
  ].slice(0, MAX_STORED_TEMPLATES);
  return persist(next) ? next : null;
}

export function removeTemplate(id: string): StoredTemplate[] | null {
  const next = loadTemplates().filter((item) => item.id !== id);
  return persist(next) ? next : null;
}
