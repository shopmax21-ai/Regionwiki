import { RulesPage } from "../_components/rules-page";
import { getGroupCards, getSearchIndex } from "../_components/rules-content";

export default function GovernmentRulesPage() {
  return <RulesPage group="government" cards={getGroupCards("government")} searchIndex={getSearchIndex("government")} />;
}
