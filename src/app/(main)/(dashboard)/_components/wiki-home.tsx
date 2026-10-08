import { mapPlaces } from "@/app/(main)/(dashboard)/map/_components/map-data";
import { listBusinesses } from "@/lib/businesses/store";
import { listJobs } from "@/lib/jobs/store";
import { listRealties } from "@/lib/realties/store";
import { getRulesStatus } from "@/lib/rules/store";
import { listVehicles } from "@/lib/vehicles/store";

import { articleHref, ruleFreshnessMeta, ruleGroups } from "../rules/_components/rules-meta";
import WikiPage, { type RecentArticle } from "./wiki-page";

/** «21.09.2026» → число для сортировки */
const dateValue = (value: string) => {
  const [day = 0, month = 0, year = 0] = value.split(".").map(Number);
  return year * 10_000 + month * 100 + day;
};

/** Серверная обёртка главной: собирает счётчики и свежие правила для клиентского WikiPage. */
export async function WikiHome() {
  const [{ vehicles }, { jobs }, { businesses }, { realties }] = await Promise.all([
    listVehicles(),
    listJobs(),
    listBusinesses(),
    listRealties(),
  ]);


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
      rulesStatus={{ state: status.state, label: ruleFreshnessMeta[status.state].label }}
    />
  );
}
