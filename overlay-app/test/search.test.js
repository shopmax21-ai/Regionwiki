const assert = require("node:assert/strict");
const { buildIndex, search, ruleRef } = require("../src/search.js");

const rules = [
  { tag: "ОП", number: "1.19", text: "Запрещено ограбление игроков без отыгровки", items: [], punishments: ["Jail 30 минут"], notes: [], section: "Разное", article: "Общие правила" },
  { tag: "ОП", number: "1.2", text: "Запрещено использование багов", items: [], punishments: ["Ban 3 дня"], notes: [{ label: "Примечание", text: "кроме тестовых серверов" }], section: "Разное", article: "Общие правила" },
  { tag: "ОГ", number: "1.19", text: "Похищение допускается только по RP причине", items: [], punishments: [], notes: [], section: "Похищения", article: "Ограбления" },
  { tag: "ОП", number: "1.190", text: "Другое", items: [], punishments: [], notes: [], section: "", article: "" },
];
const index = buildIndex(rules);
const refs = (q) => search(index, q).map((hit) => ruleRef(hit.rule));

assert.deepEqual(refs("ОП 1.19")[0], "ОП 1.19");
assert.equal(refs("ОП 1.19").includes("ОГ 1.19"), false);
assert.deepEqual(refs("1.19").slice(0, 2).sort(), ["ОГ 1.19", "ОП 1.19"]);
assert.equal(refs("1.2")[0], "ОП 1.2");
assert.equal(refs("ограбить игрока")[0], "ОП 1.19");
assert.equal(refs("баги")[0], "ОП 1.2");
assert.equal(refs("тестовых")[0], "ОП 1.2");
assert.equal(refs("похищение").length >= 1, true);
assert.deepEqual(refs("zzzz"), []);
console.log("search tests passed");
