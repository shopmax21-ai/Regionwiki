import { getLastRun } from "@/lib/rules/store";

import { getGroupCards, getSearchIndex } from "../_components/rules-content";
import { RulesPage } from "../_components/rules-page";

export const dynamic = "force-dynamic";

export default async function GeneralRulesPage() {
  const [cards, searchIndex, sync] = await Promise.all([
    getGroupCards("general"),
    getSearchIndex("general"),
    getLastRun(),
  ]);
  return <RulesPage group="general" cards={cards} searchIndex={searchIndex} sync={sync} />;
}
