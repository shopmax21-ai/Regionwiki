import type { CSSProperties } from "react";

/**
 * Баннер профиля у левого края строки списка: четверть ширины, плавно исчезает слева направо с 75% непрозрачности до 0.
 *
 * Баннер нарисован фоновыми слоями самой строки, без псевдоэлементов, дочерних элементов, позиционирования и отступов,
 * поэтому не двигает ни блоки, ни столбцы таблицы. Затухание делает слой цвета строки поверх картинки: ему нужен
 * цвет фона строки в каждом состоянии (`--row-bg`). Фон списка — карточка (`bg-card`), при наведении, выделении и
 * раскрытии строка подкрашивается `muted`, поэтому цвет в этих состояниях пересчитан так же.
 */
export const ROW_BANNER_CLASS =
  "[--row-bg:var(--card)] hover:[--row-bg:color-mix(in_oklab,var(--card),var(--muted)_50%)] has-aria-expanded:[--row-bg:color-mix(in_oklab,var(--card),var(--muted)_50%)] data-[state=selected]:[--row-bg:var(--muted)]";

/** Стиль строки с баннером: адрес картинки и слой затухания. Без баннера стиль не нужен. */
export const rowBannerStyle = (banner: string | null | undefined): CSSProperties | undefined =>
  banner
    ? {
        backgroundImage: `linear-gradient(to right, color-mix(in oklab, var(--row-bg) 25%, transparent), var(--row-bg) 25%), url(${JSON.stringify(banner)})`,
        backgroundSize: "100% 100%, 25% auto",
        backgroundPosition: "left center, left center",
        backgroundRepeat: "no-repeat",
      }
    : undefined;
