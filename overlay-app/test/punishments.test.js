const assert = require("node:assert/strict");
const http = require("node:http");
const Module = require("node:module");

// Подмена electron: проверяем, какие уведомления получил бы пользователь
const shown = [];
const originalLoad = Module._load;
Module._load = function patched(request, ...rest) {
  if (request === "electron") {
    return {
      Notification: class {
        static isSupported() { return true; }
        constructor(options) { this.options = options; }
        on() {}
        show() { shown.push(this.options); }
      },
    };
  }
  return originalLoad.call(this, request, ...rest);
};
const { createPunishments, quickTargets, repeatCount } = require("../punishments");

let payload;
const calls = [];
const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    calls.push({ url: req.url, auth: req.headers.authorization, body });
    res.setHeader("Content-Type", "application/json");
    if (req.headers.authorization !== "Bearer rgo_ok") { res.statusCode = 401; res.end(JSON.stringify({ ok: false })); return; }
    if (req.url.endsWith("/request")) { res.end(JSON.stringify({ ok: true, number: 77 })); return; }
    if (req.url.endsWith("/upload")) { res.end(JSON.stringify({ ok: true, url: "/api/jobs/images/abc" })); return; }
    res.end(JSON.stringify(req.url.endsWith("/action") ? { ok: true } : payload));
  });
});

const base = { ok: true, me: { canReview: true, canRequest: true }, assigned: [], mine: [] };
const item = (id, number) => ({ id, number, staticId: "5476", kind: "Деморган", duration: "60 мин", requester: "Garik", evidenceCount: 0, createdAt: new Date().toISOString() });

server.listen(0, async () => {
  const settings = { serverUrl: `http://127.0.0.1:${server.address().port}`, userToken: "rgo_ok", notifyPunishments: true };
  const updates = [];
  const logged = [];
  const p = createPunishments({ getSettings: () => settings, onUpdate: (u) => updates.push(u), onOpen: () => {}, log: { add: (e) => logged.push(e) } });

  // Первый опрос: одно сводное уведомление, а не по каждой старой заявке
  payload = { ...base, queue: [item("a", 1), item("b", 2)] };
  await p.poll();
  assert.equal(shown.length, 1);
  assert.match(shown[0].body, /2/);
  assert.equal(p.getState().badge, 2);
  assert.equal(calls[0].auth, "Bearer rgo_ok");

  // Новая заявка: уведомление именно о ней
  payload = { ...base, queue: [item("a", 1), item("b", 2), item("c", 3)] };
  await p.poll();
  assert.equal(shown.length, 2);
  assert.match(shown[1].title, /№3/);

  // Повторный опрос без изменений: тишина
  await p.poll();
  assert.equal(shown.length, 2);

  // Мои заявки: взяли, потом выдали
  payload = { ...base, queue: [], mine: [{ id: "m", number: 9, status: "pending", kind: "Бан", duration: "7 дн.", staticId: "1" }] };
  await p.poll();
  payload = { ...base, queue: [], mine: [{ id: "m", number: 9, status: "claimed", kind: "Бан", duration: "7 дн.", staticId: "1", assignee: "Админ" }] };
  await p.poll();
  assert.match(shown.at(-1).title, /взяли/);
  payload = { ...base, queue: [], mine: [{ id: "m", number: 9, status: "issued", kind: "Бан", duration: "7 дн.", staticId: "1" }] };
  await p.poll();
  assert.match(shown.at(-1).title, /выдано/i);

  // Отключённые уведомления не показываются, список остаётся
  settings.notifyPunishments = false;
  const before = shown.length;
  payload = { ...base, queue: [item("z", 99)] };
  await p.poll();
  assert.equal(shown.length, before);

  // Действие уходит на сервер с токеном и сразу обновляет список
  const result = await p.act({ id: "z", action: "claim" });
  assert.equal(result.ok, true);
  assert.equal(JSON.parse(calls.at(-2).body).action, "claim");
  assert.equal(logged.length, 1);
  assert.equal(logged[0].action, "claim");
  assert.equal(logged[0].number, 99);

  // Подача заявки уходит на сервер как есть и сразу обновляет список
  settings.notifyPunishments = true;
  const created = await p.create({ staticId: "5443", kind: "jail", duration: 60, rules: ["ОП 4.9"], evidence: [] });
  assert.deepEqual(created, { ok: true, number: 77 });
  const sent = calls.find((call) => call.url.endsWith("/request"));
  assert.equal(JSON.parse(sent.body).staticId, "5443");
  assert.equal(sent.auth, "Bearer rgo_ok");
  assert.equal(logged.at(-1).action, "request");
  assert.equal(logged.at(-1).staticId, "5443");

  // Скриншот: загружается multipart-запросом, возвращается ссылка; чужие типы отклоняются заранее
  const uploaded = await p.upload(new Uint8Array([137, 80, 78, 71]), "image/png", "a.png");
  assert.deepEqual(uploaded, { ok: true, url: "/api/jobs/images/abc" });
  const upload = calls.find((call) => call.url.endsWith("/upload"));
  assert.match(upload.body, /name="file"/);
  assert.equal((await p.upload(new Uint8Array([1]), "application/pdf", "x.pdf")).ok, false);

  // Неверный токен: понятная ошибка
  settings.userToken = "rgo_bad";
  await p.poll();
  assert.match(p.getState().error, /токен/i);

  // Интерактивные уведомления: событие с данными заявки уходит в окно поверх игры, а не в системное уведомление
  settings.userToken = "rgo_ok";
  const events = [], resolved = [];
  const shownBefore = shown.length;
  const q = createPunishments({ getSettings: () => ({ ...settings, notifyMode: "overlay" }), onUpdate: () => {}, onOpen: () => {}, onNotify: (e) => events.push(e), onResolve: (ids) => resolved.push(ids) });
  payload = { ...base, queue: [item("a", 1)] };
  await q.poll();
  payload = { ...base, queue: [item("a", 1), item("n", 9)] };
  await q.poll();
  assert.equal(events.at(-1).kind, "queue");
  assert.equal(events.at(-1).item.id, "n");
  assert.equal(events.at(-1).canClaim, true);
  assert.deepEqual(resolved.at(-1), ["a", "n"]);
  assert.equal(shown.length, shownBefore, "в режиме overlay системных уведомлений нет");
  // Режим system и выключенные уведомления
  const sys = createPunishments({ getSettings: () => ({ ...settings, notifyMode: "system" }), onUpdate: () => {}, onOpen: () => {}, onNotify: (e) => events.push(e) });
  payload = { ...base, queue: [item("a", 1)] };
  await sys.poll();
  payload = { ...base, queue: [item("a", 1), item("z", 10)] };
  await sys.poll();
  assert.equal(shown.length, shownBefore + 2, "сводное и по новой заявке");
  q.stop(); sys.stop();

  // Быстрые клавиши: самая старая заявка, первая готовая команда, «Выдал» только после копирования
  const old = { ...item("old", 5), createdAt: new Date(Date.now() - 600000).toISOString() };
  const t1 = quickTargets({ me: { canReview: true }, queue: [item("new", 6), old], assigned: [{ id: "w", number: 7 }, { id: "c", number: 8, command: "/jail 1", copied: false }] });
  assert.equal(t1.claim.id, "old");
  assert.equal(t1.copy.id, "c");
  assert.equal(t1.issue, null);
  assert.equal(t1.unissued.id, "c");
  assert.equal(t1.waiting.id, "w");
  const t2 = quickTargets({ me: { canReview: true }, queue: [], assigned: [{ id: "c", number: 8, command: "/jail 1", copied: true }] });
  assert.equal(t2.issue.id, "c");
  assert.equal(t2.claim, null);
  assert.equal(quickTargets(null).claim, null);

  // Повторные нарушители: другие заявки на тот же Static ID во всех списках
  const rd = { queue: [{ id: "1", staticId: "10" }, { id: "2", staticId: "11" }], assigned: [{ id: "3", staticId: "10" }], mine: [{ id: "4", staticId: "10" }, { id: "1", staticId: "10" }] };
  assert.equal(repeatCount(rd, rd.queue[0]), 2);
  assert.equal(repeatCount(rd, rd.queue[1]), 0);
  assert.equal(repeatCount(null, rd.queue[0]), 0);

  p.stop();
  server.close();
  console.log("punishments tests passed");
});
