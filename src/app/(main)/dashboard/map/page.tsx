import type { Metadata } from "next";

import { MapSection } from "@/app/(main)/dashboard/map/_components/map-section";

export const metadata: Metadata = {
  title: "Карта | Region WIKI",
  description: "Интерактивная карта штата: важные места, работы и полезные адреса.",
};

export default function Page() {
  return <MapSection />;
}
