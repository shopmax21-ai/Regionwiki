import { Fragment } from "react";

import { cn } from "cn";
import { ChevronRight, Info, Lightbulb, TriangleAlert } from "lucide-react";

import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";

import type { CalloutVariant, GuideBlock } from "../_data/jobs";
import { GuideMap } from "./guide-map";

const MARKS = [
  { delimiter: "**", render: (children: React.ReactNode[]) => <strong className="font-semibold">{children}</strong> },
  { delimiter: "__", render: (children: React.ReactNode[]) => <u className="underline-offset-2">{children}</u> },
  { delimiter: "~~", render: (children: React.ReactNode[]) => <s>{children}</s> },
  {
    delimiter: "==",
    render: (children: React.ReactNode[]) => (
      <mark className="rounded-sm bg-amber-400/35 px-0.5 text-inherit">{children}</mark>
    ),
  },
  { delimiter: "*", render: (children: React.ReactNode[]) => <em>{children}</em> },
] as const;

const isBlank = (char: string | undefined) => char === undefined || /\s/.test(char);

/** Ищет закрывающий знак: он не может стоять сразу после пробела, а внутри разметки должен быть хотя бы один символ. */
function findClose(text: string, delimiter: string, from: number): number {
  let index = from;
  while (index < text.length) {
    let found = text.indexOf(delimiter, index);
    if (found === -1) return -1;

    if (delimiter === "*" && text[found + 1] === "*") {
      // Это часть **жирного**: пропускаем всю серию звёздочек
      let end = found;
      while (text[end] === "*") end += 1;
      index = end;
      continue;
    }
    if (delimiter === "**") {
      // ***жирный курсив***: закрывающими берём последние две звёздочки серии
      while (text[found + 2] === "*") found += 1;
    }
    if (found > from && !isBlank(text[found - 1])) return found;
    index = found + delimiter.length;
  }
  return -1;
}

/** Шаги маршрута разделяются знаками > , -> , → или › : «Телефон > Whaash > Чаты». */
const ROUTE_SEPARATOR = /\s*(?:->|>|→|›)\s*/;

export const parseRoute = (source: string) =>
  source
    .split(ROUTE_SEPARATOR)
    .map((step) => step.trim())
    .filter(Boolean);

/** Маршрут по меню: шаги в одной «плашке» со стрелками между ними. Последний шаг выделен как цель. */
function Route({ steps }: { steps: string[] }) {
  return (
    <span className="mx-0.5 inline-flex flex-wrap items-center gap-x-1 rounded-md border bg-muted/50 px-1.5 py-0.5 align-baseline font-medium text-[0.92em] leading-snug">
      {steps.map((step, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: шаги могут повторяться, порядок не меняется
        <Fragment key={`${index}-${step}`}>
          {index > 0 && <ChevronRight aria-label="затем" className="size-3.5 shrink-0 text-muted-foreground" />}
          <span className={index === steps.length - 1 && steps.length > 1 ? "text-primary" : undefined}>{step}</span>
        </Fragment>
      ))}
    </span>
  );
}

function parseInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let plain = "";
  let index = 0;

  const flush = () => {
    if (plain) nodes.push(plain);
    plain = "";
  };

  while (index < text.length) {
    let matched = false;

    // [[Телефон > Whaash]]: маршрут по меню. Внутри маршрута другая разметка не разбирается.
    if (text.startsWith("[[", index)) {
      const close = text.indexOf("]]", index + 2);
      const steps = close === -1 ? [] : parseRoute(text.slice(index + 2, close));
      if (steps.length > 0) {
        flush();
        nodes.push(<Route key={nodes.length} steps={steps} />);
        index = close + 2;
        continue;
      }
    }

    // `команда` или `E`: моноширинный текст для команд, клавиш и названий из интерфейса
    if (text[index] === "`") {
      const close = text.indexOf("`", index + 1);
      if (close > index + 1) {
        flush();
        nodes.push(
          <code key={nodes.length} className="rounded border bg-muted px-1 py-px font-mono text-[0.88em]">
            {text.slice(index + 1, close)}
          </code>,
        );
        index = close + 1;
        continue;
      }
    }

    for (const { delimiter, render } of MARKS) {
      if (!text.startsWith(delimiter, index)) continue;
      const contentStart = index + delimiter.length;
      // Открывающий знак должен стоять перед словом, а не перед пробелом; одиночная * не может быть началом **
      if (isBlank(text[contentStart]) || (delimiter === "*" && text[contentStart] === "*")) continue;
      const close = findClose(text, delimiter, contentStart);
      if (close === -1) continue;

      flush();
      nodes.push(<Fragment key={nodes.length}>{render(parseInline(text.slice(contentStart, close)))}</Fragment>);
      index = close + delimiter.length;
      matched = true;
      break;
    }
    if (!matched) {
      plain += text[index];
      index += 1;
    }
  }
  flush();
  return nodes;
}

/**
 * Форматирование внутри текста блока: **жирный**, *курсив*, __подчёркнутый__, ~~зачёркнутый~~, ==выделение==,
 * [[Телефон > Whaash]] (маршрут по меню) и `команда` (моноширинный текст).
 * Это единственная разметка, и она превращается только в безопасные элементы React: чужой текст не может добавить на страницу HTML.
 */
export function InlineText({ text }: { text: string }) {
  return <>{parseInline(text)}</>;
}

type RichPiece =
  | { kind: "p"; text: string }
  | { kind: "h"; text: string }
  | { kind: "ol"; start: number; items: string[] }
  | { kind: "ul"; items: string[] };

const ORDERED_LINE = /^(\d{1,3})[.)]\s+(.*)$/;
const BULLET_LINE = /^[-•]\s+(.*)$/;
const HEADING_LINE = /^##\s+(.*)$/;

/**
 * Разбирает текст блока на абзацы, нумерованные и маркированные списки и подзаголовки.
 * Строки вида «1. шаг» и «- пункт» собираются в список, «## Название» становится подзаголовком,
 * остальные строки остаются абзацами (пустая строка начинает новый абзац).
 */
export function parseRichBlocks(text: string): RichPiece[] {
  const pieces: RichPiece[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) pieces.push({ kind: "p", text: paragraph.join("\n") });
    paragraph = [];
  };

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const ordered = ORDERED_LINE.exec(line);
    const bullet = BULLET_LINE.exec(line);
    const heading = HEADING_LINE.exec(line);
    const last = pieces.at(-1);

    if (ordered?.[2]) {
      flushParagraph();
      if (last?.kind === "ol") last.items.push(ordered[2]);
      else pieces.push({ kind: "ol", start: Number(ordered[1]), items: [ordered[2]] });
    } else if (bullet?.[1]) {
      flushParagraph();
      if (last?.kind === "ul") last.items.push(bullet[1]);
      else pieces.push({ kind: "ul", items: [bullet[1]] });
    } else if (heading?.[1]) {
      flushParagraph();
      pieces.push({ kind: "h", text: heading[1] });
    } else if (line === "") {
      flushParagraph();
    } else {
      // Строка-абзац после списка не должна «приклеиваться» к нему: список закрывается сам
      paragraph.push(line);
    }
  }
  flushParagraph();
  return pieces;
}

/** Текст блока с нумерацией, списками, подзаголовками и маршрутами. Используется рядом с картинкой. */
export function RichBlocks({ text }: { text: string }) {
  const pieces = parseRichBlocks(text);
  return (
    <div className="flex flex-col gap-2.5">
      {pieces.map((piece, pieceIndex) => {
        // biome-ignore lint/suspicious/noArrayIndexKey: у частей текста нет id, порядок задаёт сам текст
        const key = `${pieceIndex}-${piece.kind}`;
        switch (piece.kind) {
          case "p":
            return (
              <p key={key} className="whitespace-pre-line">
                <InlineText text={piece.text} />
              </p>
            );
          case "h":
            return (
              <p key={key} className="font-semibold">
                <InlineText text={piece.text} />
              </p>
            );
          case "ol":
            return (
              <ol key={key} className="flex flex-col gap-2.5">
                {piece.items.map((item, index) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: пункты могут повторяться, порядок не меняется
                  <li key={`${index}-${item}`} className="flex items-start gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-semibold text-primary text-xs">
                      {piece.start + index}
                    </span>
                    <span className="min-w-0 pt-0.5">
                      <InlineText text={item} />
                    </span>
                  </li>
                ))}
              </ol>
            );
          case "ul":
            return (
              <ul key={key} className="flex list-disc flex-col gap-1.5 pl-5 marker:text-muted-foreground">
                {piece.items.map((item, index) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: пункты могут повторяться, порядок не меняется
                  <li key={`${index}-${item}`}>
                    <InlineText text={item} />
                  </li>
                ))}
              </ul>
            );
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

    case "textImage": {
      const imageFirst = block.side === "left";
      return (
        <div
          className={cn(
            "flex flex-col gap-4 sm:items-start",
            block.src && (imageFirst ? "sm:flex-row" : "sm:flex-row-reverse"),
          )}
        >
          {block.src && (
            <figure className="flex shrink-0 flex-col gap-2 sm:w-[38%] sm:max-w-sm">
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
          )}
          <div className="min-w-0 flex-1">
            <RichBlocks text={block.text} />
          </div>
        </div>
      );
    }

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
