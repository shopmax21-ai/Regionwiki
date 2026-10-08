import { cn } from "cn";
import { ChevronRight, Info, Lightbulb, TriangleAlert } from "lucide-react";

import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";

import type { CalloutVariant, GuideBlock } from "../_data/jobs";
import { GuideMap } from "./guide-map";

/**
 * Знаки форматирования в тексте: **жирный**, *курсив*, __подчёркнутый__, ~~зачёркнутый~~, ==выделение==,
 * `команда`, маршрут [[Настройки > Защита аккаунта]] (разделитель >, → или ->) и клавиши {{F10}}, {{Ctrl+C}}.
 * Больше никакой разметки нет, чтобы чужой текст не мог сломать страницу.
 */
const INLINE =
  /\[\[([^\]\n]+?)\]\]|\{\{([^}\n]+?)\}\}|`([^`\n]+?)`|\*\*(.+?)\*\*|__(.+?)__|~~(.+?)~~|==(.+?)==|\*([^*\s](?:[^*]*[^*\s])?)\*/g;

/** Шаги маршрута разделяются знаками >, → или ->, чтобы можно было вставить путь как есть. */
const ROUTE_SEPARATOR = /\s*(?:->|→|>)\s*/;

function renderInline(text: string, depth = 0): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  const push = (node: React.ReactNode) => nodes.push(<span key={key++}>{node}</span>);
  const nested = (value: string) => (depth < 3 ? renderInline(value, depth + 1) : value);

  for (const match of text.matchAll(INLINE)) {
    const index = match.index ?? 0;
    if (index > last) push(text.slice(last, index));
    last = index + match[0].length;

    const [, route, keys, code, bold, underline, strike, highlight, italic] = match;
    if (route !== undefined) {
      const steps = route
        .split(ROUTE_SEPARATOR)
        .map((step) => step.trim())
        .filter(Boolean);
      push(
        <span className="inline-flex max-w-full flex-wrap items-center gap-1 align-middle">
          {steps.map((step, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: шаги маршрута не переставляются
            <span key={i} className="inline-flex max-w-full items-center gap-1">
              {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />}
              <span className="max-w-full break-words rounded-md border bg-muted px-2 py-0.5 font-medium text-xs leading-5">
                {step}
              </span>
            </span>
          ))}
        </span>,
      );
    } else if (keys !== undefined) {
      const combo = keys
        .split("+")
        .map((key) => key.trim())
        .filter(Boolean);
      push(
        <span className="inline-flex flex-wrap items-center gap-1 align-middle">
          {combo.map((key, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: клавиши сочетания не переставляются
            <span key={i} className="inline-flex items-center gap-1">
              {i > 0 && <span className="text-muted-foreground text-xs">+</span>}
              <kbd className="inline-flex min-w-7 items-center justify-center rounded-md border border-b-2 bg-muted px-2 py-0.5 font-medium font-sans text-foreground text-xs leading-5 shadow-xs">
                {key}
              </kbd>
            </span>
          ))}
        </span>,
      );
    } else if (code !== undefined) {
      push(<code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em]">{code}</code>);
    } else if (bold !== undefined) {
      push(<strong className="font-semibold">{nested(bold)}</strong>);
    } else if (underline !== undefined) {
      push(<u className="underline-offset-2">{nested(underline)}</u>);
    } else if (strike !== undefined) {
      push(<s>{nested(strike)}</s>);
    } else if (highlight !== undefined) {
      push(<mark className="rounded-sm bg-amber-400/30 px-0.5 text-inherit">{nested(highlight)}</mark>);
    } else if (italic !== undefined) {
      push(<em>{nested(italic)}</em>);
    }
  }
  if (last < text.length) push(text.slice(last));
  return nodes;
}

export function InlineText({ text }: { text: string }) {
  return <>{renderInline(text)}</>;
}

/** Нумерованные шаги: номер в плашке, как в блоке «Шаги». */
function StepList({ items }: { items: readonly string[] }) {
  return (
    <ol className="flex flex-col gap-3">
      {items.map((item, index) => (
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
  );
}

function BulletList({ items }: { items: readonly string[] }) {
  return (
    <ul className="flex list-disc flex-col gap-1.5 pl-5 marker:text-muted-foreground">
      {items.map((item, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: пункты могут повторяться, порядок не меняется
        <li key={`${index}-${item}`}>
          <InlineText text={item} />
        </li>
      ))}
    </ul>
  );
}

type RichPart =
  | { kind: "heading"; text: string }
  | { kind: "ordered"; items: string[] }
  | { kind: "bullet"; items: string[] }
  | { kind: "paragraph"; text: string };

const HEADING_LINE = /^#{2,3}\s+(.+)$/;
const ORDERED_LINE = /^\d{1,3}[.)]\s+(.+)$/;
const BULLET_LINE = /^[-•]\s+(.+)$/;

/** Разбирает текст по строкам: «## » — подзаголовок, «1. » — шаг, «- » — пункт, остальное — абзацы. */
function parseRich(text: string): RichPart[] {
  const parts: RichPart[] = [];
  let paragraph: string[] = [];

  const flush = () => {
    if (paragraph.length > 0) parts.push({ kind: "paragraph", text: paragraph.join("\n") });
    paragraph = [];
  };

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const heading = HEADING_LINE.exec(line);
    const ordered = ORDERED_LINE.exec(line);
    const bullet = BULLET_LINE.exec(line);
    if (heading?.[1]) {
      flush();
      parts.push({ kind: "heading", text: heading[1] });
    } else if (ordered?.[1] || bullet?.[1]) {
      flush();
      const kind = ordered ? "ordered" : "bullet";
      const item = (ordered ?? bullet)?.[1] ?? "";
      const previous = parts.at(-1);
      if (previous && previous.kind === kind) previous.items.push(item);
      else parts.push({ kind, items: [item] });
    } else {
      paragraph.push(line);
    }
  }
  flush();
  return parts;
}

/** Текст блока с нумерацией, списками, подзаголовками и маршрутами: так он выглядит на странице. */
export function RichBlocks({ text }: { text: string }) {
  const parts = parseRich(text);
  return (
    <div className="flex flex-col gap-3">
      {parts.map((part, index) => {
        switch (part.kind) {
          case "heading":
            // biome-ignore lint/suspicious/noArrayIndexKey: части текста не переставляются
            return (
              <h3 key={index} className="font-semibold text-base tracking-tight">
                <InlineText text={part.text} />
              </h3>
            );
          case "ordered":
            // biome-ignore lint/suspicious/noArrayIndexKey: части текста не переставляются
            return <StepList key={index} items={part.items} />;
          case "bullet":
            // biome-ignore lint/suspicious/noArrayIndexKey: части текста не переставляются
            return <BulletList key={index} items={part.items} />;
          case "paragraph":
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: части текста не переставляются
              <p key={index} className="whitespace-pre-line">
                <InlineText text={part.text} />
              </p>
            );
          default:
            return null;
        }
      })}
    </div>
  );
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

function ImageFigure({ src, caption }: { src: string; caption?: string }) {
  return (
    <figure className="flex flex-col gap-2">
      {/* biome-ignore lint/performance/noImgElement: размеры загруженной картинки заранее неизвестны, next/image здесь не подходит */}
      <img
        src={src}
        alt={caption ?? ""}
        loading="lazy"
        className="max-h-[560px] w-full rounded-xl border bg-muted/30 object-contain"
      />
      {caption && <figcaption className="text-center text-muted-foreground text-xs">{caption}</figcaption>}
    </figure>
  );
}

export function BlockView({ block }: { block: Exclude<GuideBlock, { type: "heading" }> }) {
  switch (block.type) {
    case "text":
      return (
        <p className="whitespace-pre-line">
          <InlineText text={block.text} />
        </p>
      );

    case "list":
      return block.ordered ? <StepList items={block.items} /> : <BulletList items={block.items} />;

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
      return <ImageFigure src={block.src} caption={block.caption} />;

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

    case "textImage": {
      if (!block.src) return <RichBlocks text={block.text} />;
      if (!block.text) return <ImageFigure src={block.src} caption={block.caption} />;
      return (
        <div
          className={cn(
            "flex flex-col gap-4 sm:items-start",
            block.side === "left" ? "sm:flex-row" : "sm:flex-row-reverse",
          )}
        >
          <div className="w-full shrink-0 sm:w-[38%] sm:max-w-sm">
            <ImageFigure src={block.src} caption={block.caption} />
          </div>
          <div className="min-w-0 flex-1">
            <RichBlocks text={block.text} />
          </div>
        </div>
      );
    }

    case "map":
      return <GuideMap title={block.title} places={block.places} />;
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
