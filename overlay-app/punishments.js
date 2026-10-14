const { Notification } = require("electron");

/**
 * Наказания: опрос сайта, уведомления Windows и действия над заявками.
 * Работает в главном процессе, поэтому уведомления приходят, даже когда окно оверлея скрыто.
 * Сайт сам решает, что показать: очередь и «мои в работе» отдаются с правом рассмотрения, «мои заявки» — с правом подачи.
 */

const INTERVAL_MS = 15_000;

function createPunishments({ getSettings, onUpdate, onOpen }) {
  let timer = null;
  let polling = false;
  let baseline = false;
  let seenQueue = new Set();
  let mineStatus = new Map();
  let state = { configured: false, data: null, error: null, updatedAt: null };

  const baseUrl = () => {
    const base = String(getSettings().serverUrl || "").trim().replace(/\/+$/, "");
    return !base ? "" : /^https?:\/\//i.test(base) ? base : `https://${base}`;
  };

  const emit = () => onUpdate({ ...state, badge: badgeCount(state.data) });

  function badgeCount(data) {
    if (!data) return 0;
    return (data.queue?.length || 0) + (data.assigned?.length || 0);
  }

  function notify(title, body) {
    if (getSettings().notifyPunishments === false || !Notification.isSupported()) return;
    const notification = new Notification({ title, body, silent: false });
    notification.on("click", () => onOpen());
    notification.show();
  }

  function announce(data) {
    const queue = data.queue || [];
    const mine = data.mine || [];

    if (!baseline) {
      // Первый опрос после запуска: одно сводное уведомление, а не по каждой старой заявке
      if (data.me?.canReview && queue.length > 0) {
        notify("Заявки на наказания", `Ждут рассмотрения: ${queue.length}. Откройте оверлей, раздел «Наказания».`);
      }
    } else {
      const fresh = queue.filter((item) => !seenQueue.has(item.id));
      for (const item of fresh.slice(0, 3)) {
        notify(`Заявка на наказание №${item.number}`, `${item.kind}, ${item.duration}. ID ${item.staticId}, подал ${item.requester}`);
      }
      if (fresh.length > 3) notify("Новые заявки на наказания", `И ещё ${fresh.length - 3} заявок в очереди`);

      for (const item of mine) {
        const before = mineStatus.get(item.id);
        if (!before || before === item.status) continue;
        if (item.status === "issued") notify(`Наказание выдано (№${item.number})`, `${item.kind}, ID ${item.staticId}`);
        else if (item.status === "rejected") notify(`Заявка №${item.number} отклонена`, item.decisionNote || `ID ${item.staticId}`);
        else if (before === "pending") notify(`Заявку №${item.number} взяли в работу`, item.assignee ? `Рассматривает ${item.assignee}` : `ID ${item.staticId}`);
      }
    }

    seenQueue = new Set(queue.map((item) => item.id));
    mineStatus = new Map(mine.map((item) => [item.id, item.status]));
    baseline = true;
  }

  async function request(path, init = {}) {
    const settings = getSettings();
    const url = baseUrl();
    if (!url || !settings.userToken) return { ok: false, error: "no-token" };
    try {
      const response = await fetch(`${url}${path}`, {
        ...init,
        headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${String(settings.userToken).trim()}` },
        signal: AbortSignal.timeout(15_000),
      });
      const body = await response.json().catch(() => ({}));
      if (response.status === 401) return { ok: false, error: "auth" };
      if (!response.ok || body.ok === false) return { ok: false, error: body.error || `Сайт ответил ${response.status}` };
      return { ok: true, body };
    } catch (error) {
      return { ok: false, error: `Не удалось связаться с сайтом (${error?.cause?.code || error?.name || "ошибка сети"})` };
    }
  }

  async function poll() {
    if (polling) return state;
    polling = true;
    try {
      const settings = getSettings();
      if (!baseUrl() || !settings.userToken) {
        state = { configured: false, data: null, error: null, updatedAt: null };
        baseline = false;
        emit();
        return state;
      }
      const result = await request("/api/overlay/punishments");
      if (result.ok) {
        announce(result.body);
        state = { configured: true, data: result.body, error: null, updatedAt: new Date().toISOString() };
      } else {
        const message = result.error === "auth" ? "Личный токен не подошёл. Создайте новый на странице «Оверлей» сайта." : result.error;
        state = { ...state, configured: true, error: message };
      }
      emit();
      return state;
    } finally {
      polling = false;
    }
  }

  async function act(payload) {
    const result = await request("/api/overlay/punishments/action", { method: "POST", body: JSON.stringify(payload) });
    // Сразу обновляем список: действие могло поменять и очередь, и «мои в работе»
    await poll();
    return result.ok ? { ok: true } : { ok: false, error: result.error === "auth" ? "Личный токен не подошёл" : result.error };
  }

  /** Кто подключён: проверка ключа и имя для экрана настроек. */
  async function me() {
    const result = await request("/api/overlay/me");
    if (result.ok) return { ok: true, name: result.body.name, group: result.body.group };
    return { ok: false, error: result.error === "auth" ? "Ключ не подошёл или отозван. Создайте новый в профиле на сайте." : result.error };
  }

  /** Подача заявки: те же поля и проверки, что у формы на сайте. */
  async function create(payload) {
    const result = await request("/api/overlay/punishments/request", { method: "POST", body: JSON.stringify(payload) });
    if (!result.ok) return { ok: false, error: result.error === "auth" ? "Личный токен не подошёл" : result.error };
    await poll();
    return { ok: true, number: result.body.number };
  }

  /** Скриншот-доказательство: загружается на сайт, в заявку уходит только ссылка на него. */
  async function upload(bytes, type, name) {
    const settings = getSettings();
    const url = baseUrl();
    if (!url || !settings.userToken) return { ok: false, error: "Не подключён личный токен" };
    if (!/^image\/(png|jpeg|webp|gif)$/.test(String(type))) return { ok: false, error: "Подходят только PNG, JPEG, WebP и GIF" };
    const data = Buffer.from(bytes);
    if (data.length > 5 * 1024 * 1024) return { ok: false, error: "Картинка больше 5 МБ, уменьшите её" };
    try {
      const form = new FormData();
      form.append("file", new Blob([data], { type }), name || "screenshot");
      const response = await fetch(`${url}/api/overlay/punishments/upload`, {
        method: "POST",
        headers: { Accept: "application/json", Authorization: `Bearer ${String(settings.userToken).trim()}` },
        body: form,
        signal: AbortSignal.timeout(60_000),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.url) return { ok: false, error: body.error || `Сайт ответил ${response.status}` };
      return { ok: true, url: body.url };
    } catch (error) {
      return { ok: false, error: `Не удалось загрузить скриншот (${error?.cause?.code || error?.name || "ошибка сети"})` };
    }
  }

  function restart() {
    clearInterval(timer);
    baseline = false;
    seenQueue = new Set();
    mineStatus = new Map();
    state = { configured: false, data: null, error: null, updatedAt: null };
    poll();
    timer = setInterval(poll, INTERVAL_MS);
  }

  return { restart, poll, act, create, upload, me, getState: () => ({ ...state, badge: badgeCount(state.data) }), stop: () => clearInterval(timer) };
}

module.exports = { createPunishments };
