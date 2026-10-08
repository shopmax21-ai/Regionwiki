import { getRulesStatus } from "@/lib/rules/store";

import { getGroupCards, getSearchIndex } from "../_components/rules-content";
import { RulesPage } from "../_components/rules-page";

export const dynamic = "force-dynamic";

export default async function GovernmentRulesPage() {
  const [cards, searchIndex, status] = await Promise.all([
    getGroupCards("government"),
    getSearchIndex("government"),
    getRulesStatus(),
  ]);
  return <RulesPage group="government" cards={cards} searchIndex={searchIndex} status={status} />;
}
