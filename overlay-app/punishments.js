const { Notification } = require("electron");

const { normalizeOrigin } = require("./site-key");

/**
 * Наказания: опрос сайта, уведомления Windows и действия над заявками.
 * Работает в главном процессе, поэтому уведомления приходят, даже когда окно оверлея скрыто.
 * Сайт сам решает, что показать: очередь и «мои в работе» отдаются с правом рассмотрения, «мои заявки» — с правом подачи.
 */

const INTERVAL_MS = 15_000;

function createPunishments({ getSettings, onUpdate, onOpen, onNotify, onResolve, log }) {
  let timer = null;
  let polling = false;
  let baseline = false;
  let seenQueue = new Set();
  let mineStatus = new Map();
  let state = { configured: false, data: null, error: null, updatedAt: null };

  const baseUrl = () => normalizeOrigin(getSettings().serverUrl);

  const emit = () => onUpdate({ ...state, badge: badgeCount(state.data) });

  function badgeCount(data) {
    if (!data) return 0;
    return (data.queue?.length || 0) + (data.assigned?.length || 0);
  }

  /**
   * Уведомление: по умолчанию интерактивная карточка поверх игры (с кнопками), иначе обычное уведомление Windows.
   * event.item нужен для кнопок («Взять в работу», «Копировать ID»).
   */
  function notify(event) {
    const settings = getSettings();
    if (settings.notifyPunishments === false || settings.notifyMuted) return;
    if ((settings.notifyMode || "overlay") === "overlay" && onNotify) {
      onNotify(event);
      return;
    }
    if (!Notification.isSupported()) return;
    const notification = new Notification({ title: event.title, body: event.body, silent: false });
    notification.on("click", () => onOpen());
    notification.show();
  }

  const brief = (item, data) => ({
    repeats: repeatCount(data, item),
    id: item.id, number: item.number, kind: item.kind, duration: item.duration, staticId: item.staticId,
    requester: item.requester, rules: item.rules || [], evidenceCount: item.evidenceCount || 0, createdAt: item.createdAt,
  });

  function announce(data) {
    const queue = data.queue || [];
    const mine = data.mine || [];
    const canReview = Boolean(data.me?.canReview);

    if (!baseline) {
      // Первый опрос после запуска: одно сводное уведомление, а не по каждой старой заявке
      if (canReview && queue.length > 0) {
        notify({ id: "summary", kind: "summary", title: "Заявки на наказания", body: `Ждут рассмотрения: ${queue.length}. Откройте оверлей, раздел «Наказания».` });
      }
    } else {
      const fresh = queue.filter((item) => !seenQueue.has(item.id));
      for (const item of fresh.slice(0, 3)) {
        notify({
          id: `q-${item.id}`, kind: "queue", canClaim: canReview, item: brief(item, data),
          title: `Заявка на наказание №${item.number}`, body: `${item.kind}, ${item.duration}. ID ${item.staticId}, подал ${item.requester}`,
        });
      }
      if (fresh.length > 3) notify({ id: "more", kind: "summary", title: "Новые заявки на наказания", body: `И ещё ${fresh.length - 3} заявок в очереди` });

      for (const item of mine) {
        const before = mineStatus.get(item.id);
        if (!before || before === item.status) continue;
        const id = `m-${item.id}-${item.status}`;
        if (item.status === "issued") notify({ id, kind: "mine", tone: "ok", title: `Наказание выдано (№${item.number})`, body: `${item.kind}, ID ${item.staticId}` });
        else if (item.status === "rejected") notify({ id, kind: "mine", tone: "bad", title: `Заявка №${item.number} отклонена`, body: item.decisionNote || `ID ${item.staticId}` });
        else if (before === "pending") notify({ id, kind: "mine", tone: "info", title: `Заявку №${item.number} взяли в работу`, body: item.assignee ? `Рассматривает ${item.assignee}` : `ID ${item.staticId}` });
      }
    }

    seenQueue = new Set(queue.map((item) => item.id));
    mineStatus = new Map(mine.map((item) => [item.id, item.status]));
    baseline = true;
    // Заявку уже взял кто-то другой: карточка с кнопкой «Взять» больше не нужна
    onResolve?.(queue.map((item) => item.id));
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
        try {
          announce(result.body);
        } catch (error) {
          console.error("announce failed", error);
        }
        state = { configured: true, data: result.body, error: null, errorKind: null, updatedAt: new Date().toISOString() };
      } else {
        const message = result.error === "auth" ? "Личный токен не подошёл. Создайте новый на странице «Оверлей» сайта." : result.error;
        const errorKind = result.error === "auth" ? "auth" : /Не удалось связаться/.test(String(result.error)) ? "network" : "other";
        state = { ...state, configured: true, error: message, errorKind };
      }
      emit();
      return state;
    } finally {
      polling = false;
    }
  }

  const findItem = (id) => {
    for (const list of [state.data?.queue, state.data?.assigned, state.data?.mine]) {
      const found = (list || []).find((item) => item.id === id);
      if (found) return found;
    }
    return null;
  };

  async function act(payload) {
    const item = findItem(payload?.id);
    const result = await request("/api/overlay/punishments/action", { method: "POST", body: JSON.stringify(payload) });
    if (result.ok && item) log?.add({ action: payload.action, number: item.number, staticId: item.staticId, kind: item.kind, duration: item.duration, note: payload.note });
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
    log?.add({ action: "request", number: result.body.number, staticId: payload.staticId, kind: payload.kind, duration: payload.duration });
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

/** Сколько других заявок (очередь, в работе, мои) подано на тот же Static ID: признак повторного нарушителя. */
function repeatCount(data, item) {
  if (!data || !item?.staticId) return 0;
  const ids = new Set();
  for (const list of [data.queue, data.assigned, data.mine]) {
    for (const other of list || []) if (other.id !== item.id && other.staticId === item.staticId) ids.add(other.id);
  }
  return ids.size;
}

/**
 * Что делают быстрые клавиши: берут самую старую заявку из очереди, копируют команду и отмечают «Выдал»
 * у первой заявки в работе. Чистая функция: проверяется тестом.
 */
function quickTargets(data) {
  const none = { claim: null, copy: null, issue: null, review: false };
  if (!data) return none;
  const queue = [...(data.queue || [])].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const assigned = data.assigned || [];
  return {
    review: Boolean(data.me?.canReview),
    claim: queue[0] || null,
    copy: assigned.find((item) => item.command) || null,
    issue: assigned.find((item) => item.command && item.copied) || null,
    waiting: assigned.find((item) => !item.command) || null,
    unissued: assigned.find((item) => item.command && !item.copied) || null,
  };
}

module.exports = { createPunishments, quickTargets, repeatCount };
