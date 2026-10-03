import type { Metadata } from "next";

import { WikiHome } from "../_components/wiki-home";

export const metadata: Metadata = {
  title: "Region Wiki",
  description: "База знаний для игроков GTA V RP проекта Region.",
  alternates: {
    canonical: "/dashboard/default",
  },
};

export default function Page() {
  return <WikiHome />;
}
