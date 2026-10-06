import { cn } from "cn";

/** Баннер виден у левого края и плавно исчезает к правому, чтобы текст справа оставался читаемым. */
const FADE = "linear-gradient(to right, #000 0%, rgba(0, 0, 0, 0.75) 35%, transparent 100%)";

type ProfileBannerProps = {
  /** Адрес загруженного баннера */
  src: string;
  /** Цвет подложки под текстом: должен совпадать с фоном контейнера (по умолчанию фон страницы) */
  overlayClassName?: string;
  className?: string;
};

/**
 * Баннер профиля как фон контейнера. Контейнер должен быть `relative overflow-hidden`,
 * а его содержимое `relative z-10`, чтобы оказаться поверх картинки.
 */
export function ProfileBanner({
  src,
  overlayClassName = "from-background/50 via-background/20",
  className,
}: ProfileBannerProps) {
  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0", className)}
      style={{ maskImage: FADE, WebkitMaskImage: FADE }}
    >
      {/* biome-ignore lint/performance/noImgElement: картинка из своего хранилища, размер неизвестен */}
      <img src={src} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
      <div className={cn("absolute inset-0 bg-gradient-to-r to-transparent", overlayClassName)} />
    </div>
  );
}
