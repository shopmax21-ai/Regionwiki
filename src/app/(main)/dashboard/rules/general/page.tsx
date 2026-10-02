import { RulesPage } from "../_components/rules-page";
import { getGroupCards, getSearchIndex } from "../_components/rules-content";

export default function GeneralRulesPage() {
  return <RulesPage group="general" cards={getGroupCards("general")} searchIndex={getSearchIndex("general")} />;
}
