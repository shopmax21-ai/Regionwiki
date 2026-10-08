import { getRulesStatus } from "@/lib/rules/store";

import { getGroupCards, getSearchIndex } from "../_components/rules-content";
import { RulesPage } from "../_components/rules-page";

export const dynamic = "force-dynamic";

export default async function GeneralRulesPage() {
  const [cards, searchIndex, status] = await Promise.all([
    getGroupCards("general"),
    getSearchIndex("general"),
    getRulesStatus(),
  ]);
  return <RulesPage group="general" cards={cards} searchIndex={searchIndex} status={status} />;
}
