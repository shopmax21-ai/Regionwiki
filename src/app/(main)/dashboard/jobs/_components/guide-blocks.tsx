import { Fragment } from "react";

import { cn } from "cn";
import { Info, Lightbulb, TriangleAlert } from "lucide-react";

import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";

import type { CalloutVariant, GuideBlock } from "../_data/jobs";

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
 * Форматирование внутри текста блока: **жирный**, *курсив*, __подчёркнутый__, ~~зачёркнутый~~, ==выделение==.
 * Это единственная разметка, и она превращается только в безопасные элементы React: чужой текст не может добавить на страницу HTML.
 */
export function InlineText({ text }: { text: string }) {
  return <>{parseInline(text)}</>;
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
          <p className="min-w-0 flex-1 whitespace-pre-line">
            <InlineText text={block.text} />
          </p>
        </div>
      );
    }

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
