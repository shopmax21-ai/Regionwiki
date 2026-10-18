"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createActionLog, filterLog } = require("../actlog");

function make(initial, max) {
  const store = { data: initial };
  let t = 1000;
  const log = createActionLog({ read: () => store.data, write: (v) => { store.data = JSON.parse(JSON.stringify(v)); }, max, now: () => (t += 1000) });
  return { log, store };
}

test("записи добавляются, новые идут первыми и сохраняются", () => {
  const { log, store } = make(undefined);
  log.add({ action: "claim", number: 5, staticId: 5476, kind: "jail", duration: 45 });
  log.add({ action: "issue", number: 5, staticId: "5476" });
  assert.deepEqual(log.list().map((e) => e.action), ["issue", "claim"]);
  assert.equal(store.data.length, 2);
  assert.equal(store.data[0].staticId, "5476");
});

test("неизвестное действие и испорченный файл игнорируются", () => {
  const { log } = make([{ ts: 1, action: "claim" }, { nope: 1 }, null, { ts: 2, action: "hack" }]);
  assert.equal(log.list().length, 1);
  log.add({ action: "hack" });
  log.add(null);
  assert.equal(log.list().length, 1);
});

test("хранится не больше лимита", () => {
  const { log } = make([], 3);
  for (let i = 0; i < 5; i += 1) log.add({ action: "claim", number: i });
  assert.deepEqual(log.list().map((e) => e.number), [4, 3, 2]);
});

test("ошибка записи не ломает действие", () => {
  const log = createActionLog({ read: () => [], write: () => { throw new Error("диск"); } });
  assert.doesNotThrow(() => log.add({ action: "claim" }));
});

test("поиск по Static ID и номеру заявки", () => {
  const { log } = make([]);
  log.add({ action: "claim", number: 141, staticId: "5476" });
  log.add({ action: "claim", number: 142, staticId: "9001" });
  assert.equal(filterLog(log.list(), "54").length, 1);
  assert.equal(filterLog(log.list(), "№142").length, 1);
  assert.equal(filterLog(log.list(), "").length, 2);
  assert.equal(filterLog(log.list(), "777").length, 0);
});

test("очистка", () => {
  const { log, store } = make([]);
  log.add({ action: "claim" });
  log.clear();
  assert.equal(log.list().length, 0);
  assert.deepEqual(store.data, []);
});
