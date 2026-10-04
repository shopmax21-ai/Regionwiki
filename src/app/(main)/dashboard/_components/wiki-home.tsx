import { businesses } from "@/app/(main)/dashboard/business/_data/businesses";
import { jobs } from "@/app/(main)/dashboard/jobs/_data/jobs";
import { mapPlaces } from "@/app/(main)/dashboard/map/_components/map-data";
import { realties } from "@/app/(main)/dashboard/real-estate/_data/realties";
import { listVehicles } from "@/lib/vehicles/store";

import { getGroupCards } from "../rules/_components/rules-content";
import { articleHref, ruleGroups } from "../rules/_components/rules-meta";
import WikiPage, { type RecentArticle } from "./wiki-page";

/** «21.09.2026» → число для сортировки */
const dateValue = (value: string) => {
  const [day = 0, month = 0, year = 0] = value.split(".").map(Number);
  return year * 10_000 + month * 100 + day;
};

/** Серверная обёртка главной: собирает счётчики и свежие правила для клиентского WikiPage. */
export async function WikiHome() {
  const { vehicles } = await listVehicles();
  const [general, government] = await Promise.all([getGroupCards("general"), getGroupCards("government")]);

  const recent: RecentArticle[] = [...general, ...government]
    .sort((a, b) => dateValue(b.updatedAt) - dateValue(a.updatedAt))
    .slice(0, 5)
    .map((card) => ({
      title: card.title,
      href: articleHref(card.group, card.slug),
      tag: card.tag,
      group: ruleGroups[card.group].title,
      updatedAt: card.updatedAt,
      ruleCount: card.ruleCount,
    }));

  return (
    <WikiPage
      stats={{
        rules: [...general, ...government].reduce((sum, card) => sum + card.ruleCount, 0),
        generalArticles: general.length,
        governmentArticles: government.length,
        jobs: jobs.length,
        businesses: businesses.length,
        realties: realties.length,
        vehicles: vehicles.length,
        places: mapPlaces.length,
      }}
      recent={recent}
    />
  );
}
