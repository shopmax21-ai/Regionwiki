import type { Metadata } from "next";

import { isInsideWorld } from "@/app/(main)/dashboard/map/_components/map-data";
import { type LinkedPlace, MapSection } from "@/app/(main)/dashboard/map/_components/map-section";
import { getAdminContext } from "@/lib/auth/admin";
import { listMapPlaces } from "@/lib/map/store";

export const metadata: Metadata = {
  title: "Карта | Region WIKI",
  description: "Интерактивная карта штата: важные места, работы и полезные адреса.",
};

// Метки лежат в базе и меняются администрацией, поэтому страница всегда строится заново.
export const dynamic = "force-dynamic";

type SearchParams = Record<"x" | "y" | "name", string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** Место из ссылки вида /dashboard/map?x=734.6&y=128.5&name=Банкомат #5. Неверные координаты игнорируются. */
function linkedPlace(params: SearchParams): LinkedPlace | null {
  const rawX = first(params.x);
  const rawY = first(params.y);
  if (!rawX || !rawY) return null;
  const point = { x: Number(rawX), y: Number(rawY) };
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || !isInsideWorld(point)) return null;
  return { ...point, name: (first(params.name) ?? "").slice(0, 80) || "Место на карте" };
}

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [{ places, editable, problem }, admin, params] = await Promise.all([
    listMapPlaces(),
    getAdminContext(),
    searchParams,
  ]);

  // Редактор виден только тем, у кого есть право. Если база недоступна, ему объясняем, почему кнопки нет.
  let editor: "on" | "off" | "unavailable" = "off";
  if (admin?.permissions.includes("map.edit")) editor = editable ? "on" : "unavailable";

  return (
    <MapSection
      places={places}
      editor={editor}
      problem={editor === "unavailable" ? problem : null}
      linked={linkedPlace(params)}
    />
  );
}
