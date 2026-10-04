import {
  type CalloutVariant,
  type GuideBlock,
  type Job,
  type JobKind,
  jobBlocks,
} from "../_data/jobs";

/** Блок в редакторе: у каждого есть id для React, у списка текст вместо массива, у картинки состояние загрузки. */
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
    };

export type BlockKind = "heading" | "text" | "bullets" | "steps" | "tip" | "info" | "warning" | "image";

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

export const newId = () => crypto.randomUUID();

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
  }
}

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
      default:
        return { id, ...block };
    }
  });
}

/**
 * Блоки для сохранения и предпросмотра. Пустые блоки отбрасываются.
 * В предпросмотре картинка, которая ещё грузится, показывается по адресу из памяти браузера.
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
