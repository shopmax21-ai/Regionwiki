import { cn } from "cn";
import { Info, Lightbulb, TriangleAlert } from "lucide-react";

import type { CalloutVariant, GuideBlock } from "../_data/jobs";

/** Выделение **жирным** внутри текста блока. Больше никакой разметки нет, чтобы чужой текст не мог сломать страницу. */
export function InlineText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, index) =>
        part.length > 4 && part.startsWith("**") && part.endsWith("**") ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: куски текста не переставляются
          <strong key={index} className="font-semibold">
            {part.slice(2, -2)}
          </strong>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: куски текста не переставляются
          <span key={index}>{part}</span>
        ),
      )}
    </>
  );
}

const calloutStyle: Record<CalloutVariant, { box: string; icon: string; Icon: typeof Info }> = {
  tip: {
    box: "border-amber-500/60 bg-amber-500/10",
    icon: "text-amber-600 dark:text-amber-300",
    Icon: Lightbulb,
  },
  info: { box: "border-primary bg-primary/5", icon: "text-primary", Icon: Info },
  warning: {
    box: "border-red-500/60 bg-red-500/10",
    icon: "text-red-600 dark:text-red-300",
    Icon: TriangleAlert,
  },
};

export function BlockView({ block }: { block: Exclude<GuideBlock, { type: "heading" }> }) {
  switch (block.type) {
    case "text":
      return (
        <p className="whitespace-pre-line">
          <InlineText text={block.text} />
        </p>
      );

    case "list":
      return block.ordered ? (
        <ol className="flex flex-col gap-3">
          {block.items.map((item, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: пункты могут повторяться, порядок не меняется
            <li key={`${index}-${item}`} className="flex items-start gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-semibold text-primary text-xs">
                {index + 1}
              </span>
              <span className="pt-0.5">
                <InlineText text={item} />
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <ul className="flex list-disc flex-col gap-1.5 pl-5 marker:text-muted-foreground">
          {block.items.map((item, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: пункты могут повторяться, порядок не меняется
            <li key={`${index}-${item}`}>
              <InlineText text={item} />
            </li>
          ))}
        </ul>
      );

    case "callout": {
      const { box, icon, Icon } = calloutStyle[block.variant];
      return (
        <p className={cn("flex items-start gap-2 rounded-lg border-l-2 px-3 py-2", box)}>
          <Icon className={cn("mt-0.5 size-4 shrink-0", icon)} aria-hidden="true" />
          <span className="whitespace-pre-line">
            <InlineText text={block.text} />
          </span>
        </p>
      );
    }

    case "image":
      return (
        <figure className="flex flex-col gap-2">
          {/* biome-ignore lint/performance/noImgElement: размеры загруженной картинки заранее неизвестны, next/image здесь не подходит */}
          <img
            src={block.src}
            alt={block.caption ?? ""}
            loading="lazy"
            className="max-h-[560px] w-full rounded-xl border bg-muted/30 object-contain"
          />
          {block.caption && <figcaption className="text-center text-muted-foreground text-xs">{block.caption}</figcaption>}
        </figure>
      );
  }
}

export type GuideSectionView = { id: string; title: string | null; blocks: Exclude<GuideBlock, { type: "heading" }>[] };

/** Делит блоки на разделы: каждый заголовок начинает новый раздел, всё до первого заголовка идёт без названия. */
export function groupGuideSections(blocks: readonly GuideBlock[]): GuideSectionView[] {
  const sections: GuideSectionView[] = [];
  let headings = 0;

  for (const block of blocks) {
    if (block.type === "heading") {
      headings += 1;
      sections.push({ id: `razdel-${headings}`, title: block.text, blocks: [] });
      continue;
    }
    let current = sections.at(-1);
    if (!current) {
      current = { id: "vvedenie", title: null, blocks: [] };
      sections.push(current);
    }
    current.blocks.push(block);
  }
  return sections;
}

/** Разделы страницы: заголовок снаружи, содержимое в карточке. */
export function GuideSections({ sections }: { sections: GuideSectionView[] }) {
  return (
    <>
      {sections.map((section) => (
        <section key={section.id} id={section.id} className="flex scroll-mt-24 flex-col gap-3">
          {section.title && <h2 className="font-semibold text-xl tracking-tight">{section.title}</h2>}
          {section.blocks.length > 0 ? (
            <div className="flex min-w-0 flex-col gap-4 break-words rounded-xl border bg-card p-4 text-sm leading-6 shadow-xs md:p-5">
              {section.blocks.map((block, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: у блоков нет id, порядок задаёт редактор
                <BlockView key={index} block={block} />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border bg-card p-4 text-muted-foreground text-sm shadow-xs md:p-5">
              Раздел пока пуст.
            </div>
          )}
        </section>
      ))}
    </>
  );
}
