import type { CSSProperties } from "react";

/**
 * Баннер профиля у левого края строки списка: четверть ширины, плавно исчезает слева направо с 75% непрозрачности до 0.
 * Те же значения, что у `TableRow banner` в таблицах наказаний; нужен для строк, которые сделаны не таблицей (`li`, `div`).
 * Дети строки поднимаются над картинкой правилом `[&>*]:relative`.
 */
export const ROW_BANNER_CLASS =
  "relative before:pointer-events-none before:absolute before:inset-y-0 before:left-0 before:w-1/4 before:bg-[image:var(--row-banner)] before:bg-cover before:bg-center before:content-[''] before:[mask-image:linear-gradient(to_right,rgba(0,0,0,0.75),transparent)] [&>*]:relative";

/** Стиль строки с баннером: адрес картинки передаётся через CSS-переменную. */
export const rowBannerStyle = (banner: string | null | undefined): CSSProperties | undefined =>
  banner ? ({ "--row-banner": `url(${JSON.stringify(banner)})` } as CSSProperties) : undefined;
