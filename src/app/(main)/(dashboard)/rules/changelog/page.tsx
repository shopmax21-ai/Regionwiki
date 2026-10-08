import { getRulesStatus, hasRulesDatabase, listChangelogFromDb } from "@/lib/rules/store";

import { changelog } from "../_components/rules-meta";
import { ChangelogPage } from "../_components/rules-page";

export const dynamic = "force-dynamic";

async function loadEntries() {
  if (!hasRulesDatabase()) return changelog;
  try {
    return [...(await listChangelogFromDb()), ...changelog];
  } catch (error) {
    console.error("[rules] Не удалось прочитать историю изменений из базы", error);
    return changelog;
  }
}

export default async function RulesChangelogPage() {
  const [entries, status] = await Promise.all([loadEntries(), getRulesStatus()]);
  return <ChangelogPage entries={entries} status={status} />;
}
