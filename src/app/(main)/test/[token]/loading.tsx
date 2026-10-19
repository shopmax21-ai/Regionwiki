import { RegionLoader } from "@/app/(main)/auth/_components/region-loader";

/** Гостевая страница без меню: загрузка на весь экран, как у корня сайта. */
export default function Loading() {
  return <RegionLoader fullscreen id="rmo-loading-test" label="Открываем тест…" />;
}
