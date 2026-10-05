import { cn } from "cn";
import { Info, Lightbulb, TriangleAlert } from "lucide-react";

import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";

import type { CalloutVariant, GuideBlock } from "../_data/jobs";
import { GuideMap } from "./guide-map";

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


/** Безопасный предпросмотр расширенного текста, который хранится прямо в строке блока. */
export function RichBlocks({ text }: { text: string }) {
  const renderInline = (value: string) => {
    const tokens = /(\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|==[^=]+==|`[^`]+`|(?<!\*)\*[^*]+\*(?!\*)|\[\[[^\]]+\]\])/g;
    return value.split(tokens).map((part, index) => {
      const key = `${index}-${part}`;
      if (part.startsWith("**") && part.endsWith("**")) return <strong key={key}>{part.slice(2, -2)}</strong>;
      if (part.startsWith("__") && part.endsWith("__")) return <u key={key}>{part.slice(2, -2)}</u>;
      if (part.startsWith("~~") && part.endsWith("~~")) return <s key={key}>{part.slice(2, -2)}</s>;
      if (part.startsWith("==") && part.endsWith("==")) return <mark key={key} className="rounded px-0.5">{part.slice(2, -2)}</mark>;
      if (part.startsWith("`") && part.endsWith("`")) return <code key={key} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]">{part.slice(1, -1)}</code>;
      if (part.startsWith("*") && part.endsWith("*")) return <em key={key}>{part.slice(1, -1)}</em>;
      if (part.startsWith("[[") && part.endsWith("]]")) return <span key={key} className="font-medium text-primary">{part.slice(2, -2)}</span>;
      return <span key={key}>{part}</span>;
    });
  };

  const rows = text.split("\n");
  const result: React.ReactNode[] = [];
  let i = 0;

  while (i < rows.length) {
    const trimmed = rows[i].trim();
    if (!trimmed) {
      result.push(<div key={`space-${i}`} className="h-2" />);
      i += 1;
      continue;
    }

    const ordered = /^\d{1,3}[.)]\s+(.+)$/.exec(trimmed);
    const bullet = /^[-•]\s+(.+)$/.exec(trimmed);
    if (ordered || bullet) {
      const matcher = ordered ? /^\d{1,3}[.)]\s+(.+)$/ : /^[-•]\s+(.+)$/;
      const items: string[] = [];
      const start = i;
      while (i < rows.length) {
        const match = matcher.exec(rows[i].trim());
        if (!match) break;
        items.push(match[1]);
        i += 1;
      }
      const Tag = ordered ? "ol" : "ul";
      result.push(
        <Tag key={`list-${start}`} className={cn("flex flex-col gap-1.5", ordered ? "list-decimal pl-5" : "list-disc pl-5")}>
          {items.map((item, itemIndex) => <li key={`${start}-${itemIndex}`}>{renderInline(item)}</li>)}
        </Tag>,
      );
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (heading) {
      const Tag = heading[1].length === 1 ? "h3" : heading[1].length === 2 ? "h4" : "h5";
      result.push(<Tag key={`heading-${i}`} className="font-semibold">{renderInline(heading[2])}</Tag>);
      i += 1;
      continue;
    }

    result.push(<p key={`paragraph-${i}`} className="whitespace-pre-line">{renderInline(rows[i])}</p>);
    i += 1;
  }

  return <div className="flex flex-col gap-2">{result}</div>;
}

export const calloutStyle: Record<CalloutVariant, { box: string; icon: string; Icon: typeof Info }> = {
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
          {block.caption && (
            <figcaption className="text-center text-muted-foreground text-xs">{block.caption}</figcaption>
          )}
        </figure>
      );

    case "textImage":
      return (
        <div className={cn("flex flex-col gap-4 sm:items-start", block.side === "left" ? "sm:flex-row" : "sm:flex-row-reverse")}>
          {block.src && (
            <figure className="w-full shrink-0 sm:w-[38%] sm:max-w-sm">
              {/* biome-ignore lint/performance/noImgElement: размеры загруженной картинки заранее неизвестны */}
              <img src={block.src} alt={block.caption ?? ""} loading="lazy" className="w-full rounded-xl border bg-muted/30 object-contain" />
              {block.caption && <figcaption className="mt-2 text-center text-muted-foreground text-xs">{block.caption}</figcaption>}
            </figure>
          )}
          <div className="min-w-0 flex-1">
            <InlineText text={block.text} />
          </div>
        </div>
      );

    case "map":
      return <GuideMap title={block.title} places={block.places} />;

    case "slider":
      return (
        <div className="min-w-0">
          <Carousel opts={{ loop: block.slides.length > 1 }}>
            <CarouselContent>
              {block.slides.map((slide, index) => (
                <CarouselItem key={`${slide.src}-${index}`}>
                  <figure className="flex flex-col gap-2">
                    {/* biome-ignore lint/performance/noImgElement: размеры загруженной картинки заранее неизвестны, next/image здесь не подходит */}
                    <img
                      src={slide.src}
                      alt={slide.caption ?? `Слайд ${index + 1}`}
                      loading={index === 0 ? "eager" : "lazy"}
                      className="max-h-[560px] w-full rounded-xl border bg-muted/30 object-contain"
                    />
                    {slide.caption && (
                      <figcaption className="text-center text-muted-foreground text-xs">{slide.caption}</figcaption>
                    )}
                  </figure>
                </CarouselItem>
              ))}
            </CarouselContent>
            {block.slides.length > 1 && (
              <>
                <CarouselPrevious className="left-2" />
                <CarouselNext className="right-2" />
              </>
            )}
          </Carousel>
        </div>
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
