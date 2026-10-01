import type { Metadata } from "next";

import WikiPage from "../_components/wiki-page";

export const metadata: Metadata = {
  title: "Region Wiki",
  description: "База знаний для игроков GTA V RP проекта Region.",
  alternates: {
    canonical: "/dashboard/default",
  },
};

export default function Page() {
  return <WikiPage />;
}
