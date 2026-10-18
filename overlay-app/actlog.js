"use strict";

/**
 * Журнал действий по наказаниям: что и когда делал именно этот администратор.
 * Хранится в файле на компьютере, последние MAX записей. Файл читается и пишется через переданные функции.
 */

const MAX = 500;
const ACTIONS = new Set(["claim", "approve", "reject", "issue", "copied", "release", "forum", "request"]);

function createActionLog({ read, write, max = MAX, now = () => Date.now() }) {
  let entries = null;

  const load = () => {
    if (entries) return entries;
    const raw = read();
    entries = Array.isArray(raw) ? raw.filter((e) => e && typeof e.ts === "number" && ACTIONS.has(e.action)) : [];
    return entries;
  };

  function add(entry) {
    if (!entry || !ACTIONS.has(entry.action)) return;
    const list = load();
    list.push({
      ts: now(),
      action: entry.action,
      number: entry.number ?? null,
      staticId: entry.staticId != null ? String(entry.staticId) : "",
      kind: entry.kind || "",
      duration: entry.duration ?? null,
      note: entry.note ? String(entry.note).slice(0, 300) : "",
    });
    if (list.length > max) list.splice(0, list.length - max);
    try { write(list); } catch { /* журнал не должен ломать само действие */ }
  }

  // Новые записи сверху
  const list = () => [...load()].reverse();
  const clear = () => { entries = []; try { write([]); } catch { /* ignore */ } };

  return { add, list, clear };
}

/** Поиск по Static ID или номеру заявки; пустой запрос возвращает всё. */
function filterLog(entries, query) {
  const q = String(query || "").trim().replace(/^[№#]/, "").toLowerCase();
  if (!q) return entries;
  return entries.filter((e) => e.staticId.toLowerCase().includes(q) || String(e.number ?? "") === q);
}

module.exports = { createActionLog, filterLog };
