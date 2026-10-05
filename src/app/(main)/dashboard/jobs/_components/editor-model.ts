import {
  type CalloutVariant,
  type GuideBlock,
  type GuideMapPlace,
  type Job,
  type JobKind,
  jobBlocks,
} from "../_data/jobs";

/** Слайд в редакторе: id нужен только клиенту, local/uploading/error — только на время загрузки. */
export type EditorSlide = {
  id: string;
  src: string;
  caption: string;
  local?: string;
  uploading?: boolean;
  error?: string;
};

/** Место на карте в редакторе: id нужен только клиенту, пустые необязательные поля хранятся пустыми строками. */
export type EditorMapPlace = {
  id: string;
  name: string;
  x: number;
  y: number;
  category: string;
  icon: string;
  description: string;
};

/** Блок в редакторе: у каждого есть id для React, у списков текст вместо массива, у медиа — состояние загрузки. */
export type EditorBlock =
  | { id: string; type: "heading"; text: string }
  | { id: string; type: "text"; text: string }
  | { id: string; type: "list"; ordered: boolean; text: string }
  | { id: string; type: "callout"; variant: CalloutVariant; text: string }
  | {
      id: string;
      type: "image";
      src: string;
      caption: string;
      /** Адрес в памяти браузера, пока картинка загружается */
      local?: string;
      uploading?: boolean;
      error?: string;
    }
  | { id: string; type: "slider"; slides: EditorSlide[] }
  | {
      id: string;
      type: "textImage";
      side: "left" | "right";
      text: string;
      src: string;
      caption: string;
      local?: string;
      uploading?: boolean;
      error?: string;
    }
  | { id: string; type: "map"; title: string; places: EditorMapPlace[] };

export type BlockKind =
  | "heading"
  | "text"
  | "bullets"
  | "steps"
  | "tip"
  | "info"
  | "warning"
  | "image"
  | "slider"
  | "textImageRight"
  | "textImageLeft"
  | "map";

export type FormState = {
  title: string;
  slug: string;
  kind: JobKind;
  level: string;
  image: string;
  tagline: string;
  intro: string;
  alt1: string;
  alt2: string;
};

export type GuideTemplateId = "starter" | "instruction" | "faq" | "media" | "howto-screens";

export type GuideTemplate = {
  id: GuideTemplateId;
  label: string;
  hint: string;
  create: () => EditorBlock[];
};

export const newId = () => crypto.randomUUID();

const block = (kind: BlockKind): EditorBlock => createBlock(kind);

export function createBlock(kind: BlockKind): EditorBlock {
  const id = newId();
  switch (kind) {
    case "heading":
      return { id, type: "heading", text: "" };
    case "text":
      return { id, type: "text", text: "" };
    case "bullets":
      return { id, type: "list", ordered: false, text: "" };
    case "steps":
      return { id, type: "list", ordered: true, text: "" };
    case "tip":
    case "info":
    case "warning":
      return { id, type: "callout", variant: kind, text: "" };
    case "image":
      return { id, type: "image", src: "", caption: "" };
    case "slider":
      return { id, type: "slider", slides: [] };
    case "map":
      return { id, type: "map", title: "", places: [] };
    case "textImageRight":
    case "textImageLeft":
      return { id, type: "textImage", side: kind === "textImageLeft" ? "left" : "right", text: "", src: "", caption: "" };
  }
}

/** Готовые группы блоков. Каждый пункт создаётся с новыми id, поэтому шаблоны можно вставлять многократно. */
export const guideTemplates: GuideTemplate[] = [
  {
    id: "starter",
    label: "Базовый гайд",
    hint: "Условия, процесс и советы",
    create: () => [
      { ...block("heading"), text: "Условия и требования" },
      { ...block("bullets"), text: "Что нужно для старта\nГде получить необходимые предметы" },
      { ...block("heading"), text: "Как начать работу" },
      { ...block("steps"), text: "Получите задание\nВыполните первый этап\nСдайте результат" },
      { ...block("heading"), text: "Советы" },
      { ...block("tip"), text: "Здесь можно добавить полезный совет для новичков." },
    ],
  },
  {
    id: "instruction",
    label: "Пошаговая инструкция",
    hint: "Заголовок, шаги и важное замечание",
    create: () => [
      { ...block("heading"), text: "Инструкция" },
      { ...block("steps"), text: "Шаг 1 — подготовьтесь\nШаг 2 — выполните действие\nШаг 3 — завершите процесс" },
      { ...block("warning"), text: "Обратите внимание на важное условие или ограничение." },
    ],
  },
  {
    id: "faq",
    label: "Вопросы и ответы",
    hint: "Несколько заметок для частых вопросов",
    create: () => [
      { ...block("heading"), text: "Частые вопросы" },
      { ...block("info"), text: "Вопрос: где начать?\nОтвет: укажите точную точку или действие." },
      { ...block("info"), text: "Вопрос: что делать после завершения?\nОтвет: укажите следующий шаг." },
    ],
  },
  {
    id: "howto-screens",
    label: "Объяснение со скриншотами",
    hint: "Текст и картинка справа или слева, для телефона и меню",
    create: () => [
      { ...block("heading"), text: "Как пользоваться" },
      {
        ...block("textImageRight"),
        text: "Опишите, что нужно сделать на этом экране. Например: откройте приложение **«Моя работа»** и нажмите ==«Начать смену»==.",
      },
      {
        ...block("textImageLeft"),
        text: "Опишите следующий шаг: куда нажать и что должно появиться. Важные слова можно сделать *курсивом* или __подчеркнуть__.",
      },
      { ...block("tip"), text: "Добавьте совет: например, как быстро вернуться на главный экран." },
    ],
  },
  {
    id: "media",
    label: "Медиа-секция",
    hint: "Текст и слайдер для скриншотов",
    create: () => [
      { ...block("heading"), text: "Как это выглядит" },
      { ...block("text"), text: "Добавьте короткое описание к изображениям ниже." },
      block("slider"),
    ],
  },
];

export const lines = (text: string) =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

export function toEditorBlocks(blocks: readonly GuideBlock[]): EditorBlock[] {
  return blocks.map((block): EditorBlock => {
    const id = newId();
    switch (block.type) {
      case "list":
        return { id, type: "list", ordered: block.ordered, text: block.items.join("\n") };
      case "image":
        return { id, type: "image", src: block.src, caption: block.caption ?? "" };
      case "slider":
        return {
          id,
          type: "slider",
          slides: block.slides.map((slide) => ({ id: newId(), src: slide.src, caption: slide.caption ?? "" })),
        };
      case "textImage":
        return {
          id,
          type: "textImage",
          side: block.side,
          text: block.text,
          src: block.src ?? "",
          caption: block.caption ?? "",
        };
      case "map":
        return {
          id,
          type: "map",
          title: block.title ?? "",
          places: block.places.map(
            (place): EditorMapPlace => ({
              id: newId(),
              name: place.name,
              x: place.x,
              y: place.y,
              category: place.category,
              icon: place.icon ?? "",
              description: place.description ?? "",
            }),
          ),
        };
      default:
        return { id, ...block };
    }
  });
}

/**
 * Блоки для сохранения и предпросмотра. Пустые блоки/слайды отбрасываются.
 * В предпросмотре медиа, которое ещё грузится, показывается по адресу из памяти браузера.
 */
export function toGuideBlocks(blocks: readonly EditorBlock[], options: { preview?: boolean } = {}): GuideBlock[] {
  return blocks.flatMap((block): GuideBlock[] => {
    switch (block.type) {
      case "heading":
      case "text":
      case "callout": {
        const text = block.text.trim();
        if (!text) return [];
        return block.type === "callout"
          ? [{ type: "callout", variant: block.variant, text }]
          : [{ type: block.type, text }];
      }
      case "list": {
        const items = lines(block.text);
        return items.length > 0 ? [{ type: "list", ordered: block.ordered, items }] : [];
      }
      case "image": {
        const src = block.src || (options.preview ? (block.local ?? "") : "");
        if (!src) return [];
        const caption = block.caption.trim();
        return [{ type: "image", src, caption: caption || undefined }];
      }
      case "slider": {
        const slides = block.slides.flatMap((slide) => {
          const src = slide.src || (options.preview ? (slide.local ?? "") : "");
          if (!src) return [];
          const caption = slide.caption.trim();
          return [{ src, caption: caption || undefined }];
        });
        return slides.length > 0 ? [{ type: "slider", slides }] : [];
      }
      case "textImage": {
        const src = block.src || (options.preview ? (block.local ?? "") : "");
        const text = block.text.trim();
        if (!src && !text) return [];
        const caption = block.caption.trim();
        return [{ type: "textImage", side: block.side, text, src: src || undefined, caption: caption || undefined }];
      }
      case "map": {
        const places = block.places.flatMap((place): GuideMapPlace[] => {
          const name = place.name.trim();
          if (!name) return [];
          return [
            {
              name,
              x: place.x,
              y: place.y,
              category: place.category,
              icon: place.icon || undefined,
              description: place.description.trim() || undefined,
            },
          ];
        });
        if (places.length === 0) return [];
        return [{ type: "map", title: block.title.trim() || undefined, places }];
      }
    }
  });
}

export const emptyForm: FormState = {
  title: "",
  slug: "",
  kind: "legal",
  level: "0",
  image: "",
  tagline: "",
  intro: "",
  alt1: "",
  alt2: "",
};

export const formFromJob = (job: Job): FormState => ({
  title: job.title,
  slug: job.slug,
  kind: job.kind,
  level: String(job.level),
  image: job.image ?? "",
  tagline: job.tagline,
  intro: job.intro,
  alt1: job.altRanks?.[0] ?? "",
  alt2: job.altRanks?.[1] ?? "",
});

/** Блоки работы для редактора: у старых записей они собираются из прежних полей. */
export const editorBlocksFromJob = (job: Job): EditorBlock[] => toEditorBlocks(jobBlocks(job));

/** Черновик работы из состояния редактора: по нему строится предпросмотр. */
export function draftJob(form: FormState, blocks: readonly EditorBlock[]): Job {
  const level = Number(form.level);
  return {
    slug: form.slug || "novaya-rabota",
    title: form.title.trim() || "Без названия",
    kind: form.kind,
    level: Number.isFinite(level) && level > 0 ? Math.floor(level) : 0,
    altRanks: [form.alt1, form.alt2].filter((slug, i, all) => slug && all.indexOf(slug) === i),
    tagline: form.tagline,
    intro: form.intro.trim() || "Вводный абзац пока не написан.",
    conditions: [],
    income: [],
    process: [],
    tips: [],
    image: form.image.trim() || undefined,
    blocks: toGuideBlocks(blocks, { preview: true }),
  };
}
