const http = require("node:http");
const rules = [
  { group: "general", slug: "obshchiye", tag: "ОП", article: "Общие правила", section: "Чаты", number: "1.19", text: "Запрещено ограбление игроков без RP-отыгровки и причины.", items: [], punishments: ["/jail 30 минут", "Ban 1 день"], notes: [{ label: "Примечание", text: "Исключение — война за грузы." }] },
  { group: "general", slug: "obshchiye", tag: "ОП", article: "Общие правила", section: "Чаты", number: "3.11", text: "Запрещены оскорбления в голосовом и текстовом чате.", items: ["Оскорбления родных", "Национальные оскорбления"], punishments: ["/mute 60 минут"], notes: [] },
  { group: "general", slug: "og", tag: "ОГ", article: "Ограбления и похищения", section: "Ограбления", number: "1.19", text: "Ограбление допускается не чаще одного раза за час.", items: [], punishments: [], notes: [{ label: "Исключение", text: "Не действует на нелегальные организации." }] },
];
http.createServer((req, res) => {
  const token = req.headers["x-overlay-token"];
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({ version: "t", generatedAt: new Date().toISOString(), rules, replies: token === "secret" ? [{ id: "x", category: "Приветствие", title: "С сервера", text: "Ответ с сервера" }] : null, repliesLocked: token !== "secret" }));
}).listen(4599, () => console.log("mock on 4599"));
