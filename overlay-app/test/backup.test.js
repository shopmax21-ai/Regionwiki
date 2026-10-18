"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { buildBackup, parseBackup } = require("../backup");

const defaults = { hotkey: "Alt+S", opacity: 0.96, hud: true, bounds: null, userToken: "", serverUrl: "", hudPos: null };

test("копия не содержит ключ, адрес и положение окон", () => {
  const copy = buildBackup({ ...defaults, userToken: "secret", serverUrl: "https://x", bounds: { x: 1 } }, [{ id: "a" }], "1.9.0");
  assert.equal(copy.settings.userToken, undefined);
  assert.equal(copy.settings.serverUrl, undefined);
  assert.equal(copy.settings.bounds, undefined);
  assert.equal(copy.settings.hotkey, "Alt+S");
  assert.equal(copy.binds.length, 1);
});

test("разбор: чужой и испорченный файл отклоняются", () => {
  assert.equal(parseBackup("не json", defaults).ok, false);
  assert.equal(parseBackup(JSON.stringify({ a: 1 }), defaults).ok, false);
});

test("разбор: неизвестные ключи, ключ доступа и неверные типы пропускаются", () => {
  const text = JSON.stringify({
    format: "region-overlay-backup", settings: { hotkey: "Alt+Z", opacity: "x", hud: false, evil: 1, userToken: "t" },
    binds: [{ id: "b1" }, { name: "без id" }, null],
  });
  const result = parseBackup(text, defaults);
  assert.equal(result.ok, true);
  assert.deepEqual(result.settings, { hotkey: "Alt+Z", hud: false });
  assert.equal(result.skipped, 3);
  assert.deepEqual(result.binds, [{ id: "b1" }]);
});

test("разбор: без списка биндов бинды не трогаются", () => {
  const result = parseBackup(JSON.stringify({ format: "region-overlay-backup", settings: {} }), defaults);
  assert.equal(result.binds, null);
});
