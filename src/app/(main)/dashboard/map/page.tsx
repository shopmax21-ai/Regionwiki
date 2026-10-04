import type { Metadata } from "next";

import { MapSection } from "@/app/(main)/dashboard/map/_components/map-section";
import { getAdminContext } from "@/lib/auth/admin";
import { listMapPlaces } from "@/lib/map/store";

export const metadata: Metadata = {
  title: "Карта | Region WIKI",
  description: "Интерактивная карта штата: важные места, работы и полезные адреса.",
};

// Метки лежат в базе и меняются администрацией, поэтому страница всегда строится заново.
export const dynamic = "force-dynamic";

export default async function Page() {
  const [{ places, editable, problem }, admin] = await Promise.all([listMapPlaces(), getAdminContext()]);

  // Редактор виден только тем, у кого есть право. Если база недоступна, ему объясняем, почему кнопки нет.
  let editor: "on" | "off" | "unavailable" = "off";
  if (admin?.permissions.includes("map.edit")) editor = editable ? "on" : "unavailable";

  return <MapSection places={places} editor={editor} problem={editor === "unavailable" ? problem : null} />;
}
