"use strict";

/** Настройки, которые привязаны к конкретному компьютеру или ключу, в резервную копию не попадают. */
const EXCLUDED = new Set(["userToken", "serverUrl", "bounds", "compactBounds", "hudPos", "compact"]);
const FORMAT = "region-overlay-backup";

function buildBackup(settings, binds, version) {
  const picked = {};
  for (const [key, value] of Object.entries(settings || {})) if (!EXCLUDED.has(key)) picked[key] = value;
  return { format: FORMAT, version: 1, app: version || "", savedAt: new Date().toISOString(), settings: picked, binds: Array.isArray(binds) ? binds : [] };
}

/**
 * Разбирает файл копии. Принимаются только известные ключи с тем же типом значения, что и по умолчанию,
 * поэтому испорченный или чужой файл не сломает настройки.
 */
function parseBackup(text, defaults) {
  let data;
  try {
    data = JSON.parse(String(text));
  } catch {
    return { ok: false, error: "Файл не похож на резервную копию: это не JSON" };
  }
  if (!data || data.format !== FORMAT || typeof data.settings !== "object" || !data.settings) {
    return { ok: false, error: "Это не резервная копия REGION Overlay" };
  }
  const settings = {};
  let skipped = 0;
  for (const [key, value] of Object.entries(data.settings)) {
    if (EXCLUDED.has(key) || !(key in defaults)) { skipped += 1; continue; }
    const base = defaults[key];
    const same = base === null ? value === null || typeof value === "object" : typeof value === typeof base;
    if (!same || (typeof value === "number" && !Number.isFinite(value))) { skipped += 1; continue; }
    settings[key] = value;
  }
  const binds = Array.isArray(data.binds)
    ? data.binds.filter((bind) => bind && typeof bind === "object" && typeof bind.id === "string").slice(0, 500)
    : null;
  return { ok: true, settings, binds, skipped };
}

module.exports = { buildBackup, parseBackup, EXCLUDED };
