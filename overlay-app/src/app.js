(() => {
  const api = window.overlay;
  const { buildIndex, search, highlightPattern, ruleRef } = window.RuleSearch;
  const $ = (id) => document.getElementById(id);

  const state = {
    settings: {},
    punLog: [],
    punLogQ: "",
    punLogClear: false,
    data: { rules: [], replies: [], repliesLocked: true, fetchedAt: null },
    index: [],
    binds: [],
    hotkeyErrors: {},
    pun: { configured: false, data: null, error: null, badge: 0 },
    upd: { status: "idle", current: "", latest: null, progress: 0, error: null, canInstall: false },
    tab: "all",
    compact: false,
    scope: "all",
    articleFilter: "",
    replyCat: "",
    results: [],
    sel: -1,
    editing: null,
    platform: "win32",
  };

  /* ---------- утилиты ---------- */

  let toastTimer = null;
  function toast(message, isError = false) {
    const el = $("toast");
    el.textContent = message;
    el.classList.toggle("err", isError);
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 1800);
  }

  function el(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
      if (key === "class") node.className = value;
      else if (key === "text") node.textContent = value;
      else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
      else if (value !== false && value != null) node.setAttribute(key, value === true ? "" : value);
    }
    for (const child of children.flat()) if (child != null) node.append(child);
    return node;
  }

  /**
   * Единый вид пустых состояний и ошибок: значок, заголовок, пояснение, кнопки.
   * tone: neutral (пусто), warn (нужно действие или нет связи), bad (ошибка), ok.
   */
  function stateBlock({ tone = "neutral", icon: name = "i-alert", title, text = "", actions = [], compact = false }) {
    return el("div", { class: `sblock ${tone}${compact ? " compact" : ""}`, role: tone === "bad" ? "alert" : "status" },
      el("span", { class: "sb-ico" }, icon(name)),
      el("div", { class: "sb-text" }, el("b", { text: title }), text ? el("p", { text }) : null),
      actions.length ? el("div", { class: "sb-actions" }, actions.map(([label, run, primary]) => el("button", { class: `btn sm${primary ? "" : " ghost"}`, type: "button", onclick: run, text: label }))) : null);
  }

  function highlighted(text, pattern) {
    if (!pattern) return document.createTextNode(text);
    const frag = document.createDocumentFragment();
    let last = 0;
    pattern.lastIndex = 0;
    for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
      if (match.index > last) frag.append(text.slice(last, match.index));
      frag.append(el("mark", { text: match[0] }));
      last = match.index + match[0].length;
      if (match[0].length === 0) pattern.lastIndex += 1;
    }
    if (last < text.length) frag.append(text.slice(last));
    return frag;
  }

  async function copy(text, label, node) {
    const result = await api.copy(text);
    if (result && result.ok === false) toast(`Не вставилось: ${result.error}`, true);
    else toast(label || "Скопировано");
    if (node) {
      node.classList.add("flash");
      setTimeout(() => node.classList.remove("flash"), 500);
    }
  }

  function setStatus() {
    const status = $("status");
    const { fetchedAt, rules } = state.data;
    status.classList.remove("err");
    if (!rules.length) {
      status.textContent = "нет данных — настройте сайт";
      status.classList.add("err");
    } else {
      const time = fetchedAt ? new Date(fetchedAt).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
      status.textContent = `${rules.length} пунктов · ${time}`;
    }
  }

  /* ---------- вкладки ---------- */

  function switchTab(name) {
    state.tab = name;
    document.querySelectorAll("[data-tab]").forEach((button) => button.classList.toggle("active", button.dataset.tab === name));
    document.querySelectorAll(".panel").forEach((panel) => panel.classList.toggle("active", panel.id === `tab-${name}`));
    $("back").hidden = name === "all";
    if (name === "all") { state.articleFilter = ""; state.replyCat = ""; renderArticleChips(); renderReplyChips(); }
    document.body.dataset.tab = name;
    if (name === "rules") { $("rules-q").value = $("all-q").value; renderRules(); }
    if (name === "replies") { $("replies-q").value = $("all-q").value; renderReplies(); }
    $("all-q").placeholder = { rules: "Номер или слова из правила…", replies: "Поиск по ответам…", binder: "Биндер", punishments: "Наказания", settings: "Настройки" }[name] || "Поиск по всему…";
    // На «Наказаниях» фокус не уходит в поиск, чтобы работали одиночные клавиши (1–3, N, R, C, Enter)
    if (name === "punishments") document.activeElement?.blur?.();
    else focusSearch();
  }

  /* ----- настройки по разделам ----- */

  const SET_SECTIONS = [["connect", "Подключение", "i-lock"], ["window", "Окно и клавиши", "i-monitor"], ["punish", "Наказания", "i-gavel"], ["hud", "Подсказки в игре", "i-keys"], ["updates", "Обновления", "i-refresh"], ["general", "Общее", "i-sliders"]];
  const SET_KEY = "region-overlay-settings-section";
  const readSection = () => { try { const v = localStorage.getItem(SET_KEY); return SET_SECTIONS.some(([id]) => id === v) ? v : "connect"; } catch { return "connect"; } };

  function showSection(id, remember = true) {
    if (!SET_SECTIONS.some(([key]) => key === id)) id = "connect";
    state.setSec = id;
    document.querySelectorAll("#tab-settings .set-card").forEach((card) => { card.hidden = card.dataset.sec !== id; });
    document.querySelectorAll("#set-nav .set-nav-btn").forEach((button) => {
      const on = button.dataset.sec === id;
      button.classList.toggle("active", on);
      button.setAttribute("aria-current", on ? "page" : "false");
    });
    $("tab-settings").querySelector(".set-form")?.scrollTo?.(0, 0);
    if (remember) { try { localStorage.setItem(SET_KEY, id); } catch { /* запоминание необязательно */ } }
  }

  /** Точки у разделов, где что-то требует внимания: нет ключа, есть обновление, не назначилась клавиша. */
  function paintSectionDots() {
    const s = state.settings || {};
    const upd = state.upd?.status;
    const dots = {
      connect: !s.userToken,
      updates: upd === "ready" || upd === "available",
      punish: ["punClaim", "punCopy", "punIssue", "punOpen"].some((id) => state.hotkeyErrors[id]),
      window: ["toggle", "search"].some((id) => state.hotkeyErrors[id]),
    };
    document.querySelectorAll("#set-nav .set-nav-btn").forEach((button) => button.classList.toggle("attn", Boolean(dots[button.dataset.sec])));
  }

  function buildSettingsNav() {
    $("set-nav").replaceChildren(...SET_SECTIONS.map(([id, label, name]) =>
      el("button", { type: "button", class: "set-nav-btn", "data-sec": id, onclick: () => showSection(id) }, icon(name), el("span", { text: label }), el("i", { class: "set-dot", "aria-hidden": "true" }))));
    showSection(readSection(), false);
  }

  function goSettings(id) {
    showSection(id);
    switchTab("settings");
  }

  function focusSearch() {
    const input = $(state.compact ? "c-q" : "all-q");
    input.focus();
    input.select();
  }

  /* Шапка с одним поиском: на вкладках «Правила» и «Ответы» она управляет их списками, стрелки и Enter передаются в них. */
  $("all-q").addEventListener("input", (event) => {
    const value = event.target.value;
    if (state.tab === "rules") { $("rules-q").value = value; renderRules(); }
    else if (state.tab === "replies") { $("replies-q").value = value; renderReplies(); }
    else if (state.tab !== "all") switchTab("all");
  });
  $("all-q").addEventListener("keydown", (event) => {
    if (state.tab !== "rules") return;
    if (["ArrowDown", "ArrowUp", "Enter"].includes(event.key) || (event.key === " " && event.ctrlKey)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      $("rules-q").dispatchEvent(new KeyboardEvent("keydown", { key: event.key, shiftKey: event.shiftKey, ctrlKey: event.ctrlKey, bubbles: true, cancelable: true }));
    }
  }, true);

  /* ---------- правила ---------- */

  function renderArticleChips() {
    const holder = $("rules-filter");
    holder.replaceChildren();
    const seen = new Map();
    for (const rule of state.data.rules) {
      const key = rule.tag || rule.article;
      if (!seen.has(key)) seen.set(key, rule.article);
    }
    if (seen.size < 2) return;
    const make = (key, label, title) =>
      el("button", {
        class: `chip${state.articleFilter === key ? " active" : ""}`,
        title,
        text: label,
        onclick: () => {
          state.articleFilter = key;
          renderArticleChips();
          renderRules();
        },
      });
    holder.append(make("", "Все", "Все разделы"));
    for (const [key, article] of seen) holder.append(make(key, key, article));
  }

  const PINS_KEY = "region-overlay-pins";
  const readPins = () => { try { const v = JSON.parse(localStorage.getItem(PINS_KEY) || "[]"); return Array.isArray(v) ? v.filter((x) => typeof x === "string") : []; } catch { return []; } };
  const writePins = (list) => { try { localStorage.setItem(PINS_KEY, JSON.stringify(list.slice(0, 24))); } catch { /* закрепление необязательно */ } };
  function togglePin(ref) {
    const pins = readPins();
    const next = pins.includes(ref) ? pins.filter((x) => x !== ref) : [ref, ...pins];
    writePins(next);
    renderHome();
    return next.includes(ref);
  }

  function ruleCard(rule, pattern, index, onChange) {
    const ref = ruleRef(rule);
    const card = el("div", { class: "card", "data-index": index, tabindex: "-1" });
    card.append(
      el("div", { class: "card-head" },
        el("span", { class: "ref", text: ref }),
        el("span", { class: "where", text: `${rule.article} · ${rule.section}` }),
        (() => {
          const star = el("button", { class: `icon more star${readPins().includes(ref) ? " on" : ""}`, title: "Закрепить на главной", "aria-label": "Закрепить", text: readPins().includes(ref) ? "★" : "☆" });
          star.addEventListener("click", (event) => {
            event.stopPropagation();
            const on = togglePin(ref);
            star.textContent = on ? "★" : "☆";
            star.classList.toggle("on", on);
            toast(on ? `${ref} закреплён на главной` : `${ref} откреплён`);
          });
          return star;
        })(),
        el("button", { class: "icon more", title: "Показать наказание, примечания, исключения", "aria-label": "Подробнее", text: "▾", onclick: (event) => {
          event.stopPropagation();
          card.classList.toggle("open");
          event.currentTarget.textContent = card.classList.contains("open") ? "▴" : "▾";
          onChange?.();
        } }),
      ),
    );
    const text = el("div", { class: "card-text" });
    text.append(highlighted(rule.text, pattern));
    card.append(text);
    if (rule.punishments?.length) {
      card.append(el("div", { class: "pun-preview" }, rule.punishments.slice(0, 3).map((item) => el("span", { class: "ppchip", text: item }))));
    }

    const extra = el("div", { class: "extra" });
    if (rule.items?.length) {
      const list = el("ul");
      for (const item of rule.items) list.append(el("li", {}, highlighted(item, pattern)));
      extra.append(el("div", { class: "block" }, list));
    }
    if (rule.punishments?.length) {
      extra.append(el("div", { class: "block pun" }, el("b", { text: "Наказание" }), rule.punishments.join(" / ")));
    }
    for (const note of rule.notes || []) {
      const kind = /исключ/i.test(note.label) ? " exc" : "";
      extra.append(el("div", { class: `block${kind}` }, el("b", { text: note.label }), highlighted(note.text, pattern)));
    }
    const actions = el(
      "div",
      { class: "actions" },
      el("button", { class: "btn sm", text: `Копировать «${ref}»`, onclick: (event) => { event.stopPropagation(); copy(ref, `Скопировано: ${ref}`, card); } }),
      el("button", { class: "btn sm ghost", text: "Текст пункта", onclick: (event) => { event.stopPropagation(); copy(`${ref} ${rule.text}`, "Текст скопирован", card); } }),
    );
    if (rule.punishments?.length) {
      actions.append(
        el("button", { class: "btn sm ghost", text: "Наказание", onclick: (event) => { event.stopPropagation(); copy(`${rule.punishments.join(" / ")} (${ref})`, "Наказание скопировано", card); } }),
      );
    }
    if (state.pun.data?.me?.canRequest) {
      actions.append(el("button", { class: "btn sm ghost", text: "В заявку", title: "Добавить пункт в заявку на наказание", onclick: (event) => { event.stopPropagation(); startRequestFromRule(rule); } }));
    }
    extra.append(actions);
    card.append(extra);

    card.title = `Нажмите, чтобы скопировать «${ref}»`;
    card.addEventListener("click", (event) => {
      if (event.target.closest("button")) return;
      if (index < 1000) select(index, false);
      copy(ref, `Скопировано: ${ref}`, card);
    });
    return card;
  }

  function renderRules() {
    const query = $("rules-q").value.trim();
    const list = $("rules-list");
    list.replaceChildren();
    state.sel = -1;
    if (!state.data.rules.length) {
      list.append(stateBlock({ tone: "warn", icon: "i-sliders", title: "Правила не загружены", text: "Подключите сайт в настройках и обновите данные.", actions: [["Открыть настройки", () => goSettings("connect"), true], ["Обновить", () => refresh()]] }));
      state.results = [];
      return;
    }
    if (!query && !state.articleFilter) {
      state.results = [];
      list.append(stateBlock({ icon: "i-search", title: "Что искать", text: "Номер пункта (ОП 1.19) или слова из правила: ограбление, баг, пробив." }));
      return;
    }
    let hits = query
      ? search(state.index, query, 80)
      : state.data.rules.filter((rule) => (rule.tag || rule.article) === state.articleFilter).map((rule) => ({ rule }));
    if (state.articleFilter) hits = hits.filter((hit) => (hit.rule.tag || hit.rule.article) === state.articleFilter);
    hits = hits.slice(0, query ? 40 : 120);
    state.results = hits;
    if (!hits.length) {
      list.append(stateBlock({ icon: "i-search", title: "Ничего не найдено", text: "Попробуйте другое слово или номер." }));
      return;
    }
    const pattern = highlightPattern(query);
    hits.forEach((hit, index) => list.append(ruleCard(hit.rule, pattern, index)));
    select(0, false);
  }

  function select(index, scroll = true) {
    const cards = $("rules-list").querySelectorAll(".card");
    cards.forEach((card) => card.classList.remove("sel"));
    state.sel = Math.max(-1, Math.min(index, cards.length - 1));
    const card = cards[state.sel];
    if (card) {
      card.classList.add("sel");
      if (scroll) card.scrollIntoView({ block: "nearest" });
    }
  }

  $("rules-q").addEventListener("input", renderRules);
  $("rules-q").addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") { event.preventDefault(); select(state.sel + 1); }
    else if (event.key === "ArrowUp") { event.preventDefault(); select(state.sel - 1); }
    else if (event.key === "Enter" && state.results[state.sel]) {
      event.preventDefault();
      const rule = state.results[state.sel].rule;
      const ref = ruleRef(rule);
      if (event.shiftKey) copy(`${ref} ${rule.text}`, "Текст скопирован");
      else copy(ref, `Скопировано: ${ref}`);
    } else if (event.key === " " && event.ctrlKey && state.sel >= 0) {
      event.preventDefault();
      $("rules-list").querySelectorAll(".card")[state.sel]?.classList.toggle("open");
    }
  });

  /* ---------- быстрые ответы ---------- */

  function renderReplyChips() {
    const holder = $("replies-filter");
    holder.replaceChildren();
    const cats = [...new Set((state.data.replies || []).map((reply) => reply.category).filter(Boolean))];
    if (cats.length < 2) return;
    const make = (key, label) =>
      el("button", {
        class: `chip${state.replyCat === key ? " active" : ""}`,
        text: label,
        onclick: () => { state.replyCat = key; renderReplyChips(); renderReplies(); },
      });
    holder.append(make("", "Все"));
    cats.forEach((cat) => holder.append(make(cat, cat)));
  }

  function renderReplies() {
    const query = $("replies-q").value.trim();
    const pattern = highlightPattern(query);
    const list = $("replies-list");
    list.replaceChildren();
    const effective = window.RuleSearch.pickQuery(query, (state.data.replies || []).map((reply) => `${reply.title} ${reply.text} ${reply.category}`));
    const words = window.RuleSearch.normalize(effective).split(/\s+/).filter(Boolean).map(window.RuleSearch.stem);
    const replies = (state.data.replies || []).filter((reply) => {
      if (state.replyCat && reply.category !== state.replyCat) return false;
      const haystack = window.RuleSearch.normalize(`${reply.title} ${reply.text} ${reply.category}`);
      return words.every((word) => haystack.includes(word));
    });
    if (state.data.repliesLocked && state.data.fetchedAt) {
      list.append(stateBlock({ tone: "warn", icon: "i-msg", compact: true, title: "Показаны встроенные ответы", text: "Ответы с сайта появятся после подключения ключа.", actions: [["Открыть настройки", () => goSettings("connect")]] }));
    }
    if (!replies.length) {
      list.append(stateBlock({ icon: "i-search", title: "Ответов не найдено", text: "Попробуйте другое слово или категорию." }));
      return;
    }
    for (const reply of replies) {
      const card = el("div", { class: "card", tabindex: "0", role: "button", title: "Нажмите, чтобы скопировать" },
        el("div", { class: "card-head" }, el("span", { class: "reply-title" }, highlighted(reply.title, pattern)), el("span", { class: "reply-cat", text: reply.category })),
        el("div", { class: "reply-text" }, highlighted(reply.text, pattern)),
      );
      const fire = () => copy(reply.text, "Ответ скопирован", card);
      card.addEventListener("click", fire);
      card.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); fire(); } });
      list.append(card);
    }
  }
  $("replies-q").addEventListener("input", renderReplies);

  /* ---------- общий поиск (вкладка «Всё» и свёрнутая строка) ---------- */

  async function runBindFromUi(bind) {
    const result = await api.runBind(bind.id);
    if (result?.copiedOnly) toast("Скопировано (отправка в игру только на Windows)");
    else if (result && !result.ok) toast(result.error, true);
  }

  const HISTORY_KEY = "region-overlay-history";
  const readHistory = () => {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); } catch { return []; }
  };
  function remember(query) {
    const value = String(query || "").trim();
    if (value.length < 2) return;
    try {
      const next = [value, ...readHistory().filter((item) => item !== value)].slice(0, 15);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch { /* история необязательна */ }
  }

  function makeUnified({ input, list, scope, limits, empty, onRender }) {
    const ctx = { actions: [], sel: -1 };

    function select(index, scroll = true) {
      const cards = list.querySelectorAll(".card");
      cards.forEach((card) => card.classList.remove("sel"));
      ctx.sel = Math.max(-1, Math.min(index, cards.length - 1));
      const card = cards[ctx.sel];
      if (card) {
        card.classList.add("sel");
        if (scroll) card.scrollIntoView({ block: "nearest" });
      }
    }

    function render() {
      const query = input.value.trim();
      list.replaceChildren();
      ctx.actions = [];
      ctx.sel = -1;
      if (!query) {
        if (empty) list.append(stateBlock({ title: empty }));
        onRender?.();
        return;
      }
      const where = scope();
      const { normalize, stem, pickQuery } = window.RuleSearch;
      const pool = [...state.binds.map((bind) => `${bind.title} ${bind.text} ${bind.hotkey}`), ...(state.data.replies || []).map((reply) => `${reply.title} ${reply.text} ${reply.category}`)];
      const words = normalize(pickQuery(query, pool)).split(/\s+/).filter(Boolean).map(stem);
      const match = (text) => {
        const hay = normalize(text);
        return words.every((word) => hay.includes(word));
      };
      const pattern = highlightPattern(query);
      const track = (fn) => () => { remember(input.value); fn(); };

      const binds = where === "all" ? state.binds.filter((bind) => match(`${bind.title} ${bind.text} ${bind.hotkey}`)).slice(0, limits.binds) : [];
      const replies = where !== "rules" ? (state.data.replies || []).filter((reply) => match(`${reply.title} ${reply.text} ${reply.category}`)).slice(0, limits.replies) : [];
      const rules = where !== "replies" ? search(state.index, query, limits.rules) : [];
      const section = (label) => list.append(el("div", { class: "sect", text: label }));

      if (binds.length) {
        section("Бинды");
        for (const bind of binds) {
          const lines = String(bind.text || "").split(/\r?\n/).filter(Boolean);
          const run = track(() => runBindFromUi(bind));
          const card = el("div", { class: "card bind" },
            el("div", { class: "bind-main" },
              el("div", { class: "bind-title" }, el("span", { class: "badge bind", text: "бинд" }), " ", highlighted(bind.title, pattern)),
              el("div", { class: "bind-sub", text: `${lines.length} стр.${bind.autoEnter === false ? " · без Enter" : ""} · ${lines[0] || ""}` }),
            ),
            el("span", { class: "kbd", text: bind.hotkey || "без клавиши" }),
            el("button", { class: "btn sm", text: "▶", title: "Отправить в игру", onclick: (event) => { event.stopPropagation(); run(); } }),
          );
          card.addEventListener("click", run);
          ctx.actions.push({ primary: run, secondary: run });
          list.append(card);
        }
      }
      if (replies.length) {
        section("Быстрые ответы");
        for (const reply of replies) {
          const card = el("div", { class: "card", tabindex: "-1", title: "Нажмите, чтобы скопировать" },
            el("div", { class: "card-head" }, el("span", { class: "badge reply", text: "ответ" }), el("span", { class: "reply-title" }, highlighted(reply.title, pattern)), el("span", { class: "reply-cat", text: reply.category })),
            el("div", { class: "reply-text" }, highlighted(reply.text, pattern)),
          );
          const fire = track(() => copy(reply.text, "Ответ скопирован", card));
          card.addEventListener("click", fire);
          ctx.actions.push({ primary: fire, secondary: fire });
          list.append(card);
        }
      }
      if (rules.length) {
        section("Правила");
        for (const hit of rules) {
          const rule = hit.rule;
          const ref = ruleRef(rule);
          const card = ruleCard(rule, pattern, 1000 + ctx.actions.length, () => requestAnimationFrame(() => onRender?.()));
          card.addEventListener("click", (event) => { if (!event.target.closest("button")) remember(input.value); });
          ctx.actions.push({
            primary: track(() => copy(ref, `Скопировано: ${ref}`, card)),
            secondary: track(() => copy(`${ref} ${rule.text}`, "Текст скопирован", card)),
            toggle: () => { card.querySelector(".more")?.click(); },
          });
          list.append(card);
        }
      }
      if (!ctx.actions.length) list.append(stateBlock({ icon: "i-search", title: "Ничего не найдено" }));
      else select(0, false);
      onRender?.();
    }

    input.addEventListener("input", render);
    input.addEventListener("keydown", (event) => {
      const action = ctx.actions[ctx.sel];
      if (event.key === "ArrowDown") { event.preventDefault(); select(ctx.sel + 1); }
      else if (event.key === "ArrowUp") { event.preventDefault(); select(ctx.sel - 1); }
      else if (event.key === "Enter" && action) { event.preventDefault(); (event.shiftKey ? action.secondary : action.primary)(); }
      else if (event.key === " " && event.ctrlKey && action?.toggle) { event.preventDefault(); action.toggle(); }
    });
    return { render };
  }

  const allSearch = makeUnified({
    input: $("all-q"),
    list: $("all-list"),
    scope: () => state.scope,
    limits: { binds: 6, replies: 8, rules: 20 },
    onRender: () => $("tab-all").classList.toggle("has-results", Boolean($("all-q").value.trim())),
  });

  /* ---------- свёрнутая строка ---------- */

  function fitCompact() {
    if (!state.compact) return;
    const list = $("c-list");
    api.setCompactHeight(list.children.length ? Math.min(list.scrollHeight + 2, 520) + 8 : 0);
  }

  const compactSearch = makeUnified({
    input: $("c-q"),
    list: $("c-list"),
    scope: () => state.scope,
    limits: { binds: 3, replies: 4, rules: 10 },
    onRender: () => requestAnimationFrame(fitCompact),
  });

  function renderAll() {
    allSearch.render();
    if (state.compact) compactSearch.render();
  }

  document.querySelectorAll(".pills button").forEach((button) =>
    button.addEventListener("click", () => {
      state.scope = button.dataset.scope;
      document.querySelectorAll(".pills button").forEach((item) => item.classList.toggle("active", item.dataset.scope === state.scope));
      if (state.tab !== "all") switchTab("all");
      allSearch.render();
      compactSearch.render();
      focusSearch();
    }),
  );

  function showHistory(list, input, search, after) {
    const history = readHistory();
    list.replaceChildren();
    if (!history.length) list.append(stateBlock({ icon: "i-history", title: "История пуста", text: "Здесь появятся ваши последние запросы." }));
    for (const query of history) {
      list.append(el("div", { class: "card", onclick: () => { input.value = query; search.render(); input.focus(); } }, el("span", { class: "reply-title", text: query })));
    }
    after?.();
  }

  function showRecent() {
    if (state.compact) {
      showHistory($("c-list"), $("c-q"), compactSearch, () => requestAnimationFrame(fitCompact));
      return;
    }
    if (state.tab !== "all") switchTab("all");
    $("all-q").value = "";
    showHistory($("all-list"), $("all-q"), allSearch, () => $("tab-all").classList.add("has-results"));
  }

  document.querySelectorAll("[data-nav]").forEach((button) =>
    button.addEventListener("click", () => {
      const tab = button.dataset.nav;
      if (tab === "all") { $("all-q").value = ""; switchTab("all"); allSearch.render(); }
      else switchTab(tab);
    }),
  );
  document.querySelectorAll("[data-go]").forEach((button) =>
    button.addEventListener("click", async () => {
      if (state.compact) await setCompact(false);
      switchTab(button.dataset.go);
    }),
  );
  $("home-btn").addEventListener("click", () => { $("all-q").value = ""; switchTab("all"); allSearch.render(); });
  $("back").addEventListener("click", () => { $("all-q").value = ""; switchTab("all"); allSearch.render(); });

  async function setCompact(on) {
    if (on) {
      const current = $("all-q").value;
      if (current && !$("c-q").value) $("c-q").value = current;
    } else if ($("c-q").value && !$("all-q").value) {
      $("all-q").value = $("c-q").value;
    }
    state.settings = await api.setMode(on);
    state.compact = Boolean(state.settings.compact);
    document.body.classList.toggle("compact", state.compact);
    if (state.compact) compactSearch.render();
    else { allSearch.render(); setTimeout(() => startTour(false), 400); }
    focusSearch();
  }

  document.querySelectorAll(".mode-switch button").forEach((button) =>
    button.addEventListener("click", () => {
      const wantCompact = button.dataset.mode === "search";
      if (wantCompact !== state.compact) setCompact(wantCompact);
    }),
  );

  $("c-history").addEventListener("click", showRecent);

  /* ---------- обновления ---------- */

  function renderUpdate() {
    const u = state.upd || {};
    paintSectionDots();
    if (!$("upd-status")) return;
    $("upd-version").textContent = `Версия ${u.current || "—"}`;
    const text = {
      idle: "Проверка ещё не выполнялась",
      checking: "Проверяю…",
      uptodate: "У вас последняя версия",
      available: u.canInstall ? `Доступна версия ${u.latest}` : `Доступна версия ${u.latest}. Скачайте её на сайте (в разделе «Оверлей»)`,
      downloading: `Скачиваю версию ${u.latest}: ${Math.round((u.progress || 0) * 100)}%`,
      ready: `Версия ${u.latest} скачана. Установится при перезапуске`,
      error: u.error || "Не удалось проверить",
    }[u.status] || "";
    $("upd-status").textContent = u.error && u.status !== "error" ? `${text}. ${u.error}` : text;
    $("upd-status").classList.toggle("bad", u.status === "error" || Boolean(u.error));
    $("upd-install").hidden = u.status !== "ready";
    $("upd-download").hidden = !(u.status === "available" && u.canInstall);
    $("upd-check").disabled = u.status === "checking" || u.status === "downloading";
    $("upd-bar").hidden = u.status !== "downloading";
    $("upd-fill").style.width = `${Math.round((u.progress || 0) * 100)}%`;
    renderHome();
  }

  api.onUpdater((next) => { state.upd = next; renderUpdate(); });

  /* ---------- тур по оверлею (при первом запуске и по кнопке) ---------- */

  const TOUR_KEY = "region-overlay-tour";
  const tourSeen = () => { try { return localStorage.getItem(TOUR_KEY) === "1"; } catch { return true; } };

  function tourSteps() {
    const s = state.settings;
    const keys = [[s.hotkey || "Alt+R", "показать / скрыть оверлей"], [s.searchHotkey || "Alt+S", "строка поиска"], ["Ctrl+M", "свернуть в строку и обратно"], ["Ctrl+1…6", "разделы"], ["Esc", "назад или скрыть"]];
    for (const [key, label] of [[s.punClaimHotkey, "взять заявку"], [s.punCopyHotkey, "копировать команду"], [s.punIssueHotkey, "отметить «Выдал»"]]) if (key) keys.push([key, `в игре: ${label}`]);
    return [
      { title: "Добро пожаловать в REGION Overlay", text: "Поиск по правилам, быстрые ответы, биндер и наказания в одном окне поверх игры. Покажу главное за полминуты." },
      { anchor: ".rail", place: "right", title: "Разделы слева", text: "Главная, Правила, Ответы, Биндер, Наказания и Настройки. Красный счётчик у молотка показывает, сколько заявок ждут вас." },
      { mock: "star", title: "Звёздочка на правиле", text: "Нажмите ☆ на карточке правила: оно появится на главной в «Закреплённых», клик по нему копирует номер пункта. Под текстом видны наказания, а «В заявку» переносит пункт в заявку на наказание." },
      { anchor: "#pun-btn", place: "below", title: "Наказания", text: "Новые заявки приходят карточкой поверх игры: сразу можно взять в работу, одобрить или отклонить, скопировать команду и отметить выдачу." },
      { title: "Клавиши", text: "Всё, что нужно под рукой. Сочетания меняются в «Настройках».", keys },
    ];
  }

  function startTour(force) {
    if ((!force && tourSeen()) || state.compact || !window.OverlayTour) return;
    closeMenu();
    if (state.tab !== "all") switchTab("all");
    window.OverlayTour.start(tourSteps(), () => { try { localStorage.setItem(TOUR_KEY, "1"); } catch { /* тур необязателен */ } focusSearch(); });
  }

  // Масштаб интерфейса колесом мыши и щипком отключён
  window.addEventListener("wheel", (event) => { if (event.ctrlKey) event.preventDefault(); }, { passive: false });

  /* ---------- меню: все иконки-действия спрятаны под одной кнопкой ---------- */

  const menu = $("menu");
  const menuOpen = () => !menu.hidden;

  function closeMenu() {
    if (menu.hidden) return;
    menu.hidden = true;
    if (state.compact) fitCompact();
  }

  function menuItems() {
    const s = state.settings;
    const goTab = async (tab) => { if (state.compact) await setCompact(false); switchTab(tab); };
    return [
      { icon: "i-alert", label: state.pun.badge > 0 ? `Наказания (${state.pun.badge})` : "Наказания", run: () => goTab("punishments") },
      { icon: "i-keys", label: "Биндер", hint: "Ctrl+4", run: () => goTab("binder") },
      { icon: "i-history", label: "Недавние запросы", run: showRecent },
      { icon: "i-refresh", label: "Обновить данные с сайта", run: () => refresh() },
      { icon: "i-sliders", label: "Настройки", hint: "Ctrl+5", run: () => goTab("settings") },
      "sep",
      { icon: state.compact ? "i-expand" : "i-shrink", label: state.compact ? "Развернуть окно" : "Свернуть в строку поиска", hint: "Ctrl+M", run: () => setCompact(!state.compact) },
      { icon: "i-alert", label: "Не беспокоить: уведомления о наказаниях", toggle: Boolean(s.notifyMuted), run: () => patchSettings({ notifyMuted: !s.notifyMuted }), keep: true },
      { icon: "i-sliders", label: "Тур по оверлею", run: () => setTimeout(() => startTour(true), 50) },
      { icon: "i-pin", label: "Поверх всех окон", toggle: Boolean(s.alwaysOnTop), run: () => patchSettings({ alwaysOnTop: !s.alwaysOnTop }), keep: true },
      { icon: "i-menu", label: "Компактные списки", toggle: s.density === "compact", run: () => patchSettings({ density: s.density === "compact" ? "comfortable" : "compact" }), keep: true },
      { icon: "i-lock", label: "Зафиксировать окно", toggle: Boolean(s.lockWindow), run: () => patchSettings({ lockWindow: !s.lockWindow }), keep: true },
      { icon: "i-move", label: "Двигать подсказки на экране", toggle: s.hudLocked === false, run: () => patchSettings({ hudLocked: !(s.hudLocked !== false), hud: true }), keep: true },
      "sep",
      { icon: "i-x", label: "Скрыть оверлей", hint: "Esc", run: () => api.hide() },
    ];
  }

  function renderMenu() {
    menu.replaceChildren(
      ...menuItems().map((item) =>
        item === "sep"
          ? el("div", { class: "menu-sep" })
          : el("button", { class: `menu-item${item.toggle ? " on" : ""}`, type: "button", onclick: async () => { await item.run(); if (item.keep) renderMenu(); else closeMenu(); } },
              icon(item.icon),
              el("span", { class: "mi-label", text: item.label }),
              item.hint ? el("span", { class: "mi-hint", text: item.hint }) : null,
              item.toggle !== undefined ? icon("i-check", "ico mi-check") : null,
            ),
      ),
    );
  }

  function openMenu() {
    renderMenu();
    menu.hidden = false;
    if (state.compact) api.setCompactHeight(menu.offsetHeight + 8);
  }

  document.querySelectorAll("[data-menu]").forEach((button) =>
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      menuOpen() ? closeMenu() : openMenu();
    }),
  );
  document.addEventListener("click", (event) => { if (menuOpen() && !menu.contains(event.target)) closeMenu(); });
  window.addEventListener("blur", closeMenu);

  /* ---------- горячие клавиши (запись сочетания) ---------- */

  const CODE_NAMES = {
    Space: "Space", Enter: "Return", Tab: "Tab", Backspace: "Backspace", Delete: "Delete", Insert: "Insert", Home: "Home", End: "End",
    PageUp: "PageUp", PageDown: "PageDown", ArrowUp: "Up", ArrowDown: "Down", ArrowLeft: "Left", ArrowRight: "Right",
    Minus: "-", Equal: "=", Comma: ",", Period: ".", Slash: "/", Backquote: "`", Semicolon: ";", Quote: "'", BracketLeft: "[", BracketRight: "]", Backslash: "\\",
  };

  function acceleratorFrom(event) {
    const { code } = event;
    if (/^(Control|Shift|Alt|Meta)/.test(code)) return null;
    let key = null;
    if (/^Key[A-Z]$/.test(code)) key = code.slice(3);
    else if (/^Digit\d$/.test(code)) key = code.slice(5);
    else if (/^F\d{1,2}$/.test(code)) key = code;
    else if (/^Numpad\d$/.test(code)) key = `num${code.slice(6)}`;
    else if (CODE_NAMES[code]) key = CODE_NAMES[code];
    if (!key) return null;
    const mods = [];
    if (event.ctrlKey) mods.push("Ctrl");
    if (event.altKey) mods.push("Alt");
    if (event.shiftKey) mods.push("Shift");
    if (!mods.length && !/^F\d/.test(key) && !key.startsWith("num")) return null;
    return [...mods, key].join("+");
  }

  function hotkeyField(input, onChange) {
    input.addEventListener("keydown", (event) => {
      event.preventDefault();
      if (event.key === "Backspace" || event.key === "Delete") { input.value = ""; onChange(""); return; }
      const accelerator = acceleratorFrom(event);
      if (accelerator) { input.value = accelerator; onChange(accelerator); }
    });
  }

  /* ---------- биндер ---------- */

  const newId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));

  async function saveBinds() {
    const { errors } = await api.setBinds(state.binds);
    state.hotkeyErrors = errors || {};
    renderBinds();
    renderAll();
  }

  function renderBinds() {
    renderHome();
    const list = $("binder-list");
    list.replaceChildren();
    if (!state.binds.length) {
      list.append(stateBlock({ icon: "i-keys", title: "Биндов пока нет", text: "Назначенная клавиша будет отправлять строки в чат игры.", actions: [["+ Бинд", () => openBindForm(null), true]] }));
      return;
    }
    for (const bind of state.binds) {
      const lines = String(bind.text || "").split(/\r?\n/).filter(Boolean);
      const err = state.hotkeyErrors[bind.id];
      const row = el("div", { class: "card bind" },
        el("div", { class: "bind-main" },
          el("div", { class: "bind-title", text: bind.title }),
          el("div", { class: "bind-sub", text: `${lines.length} стр.${bind.autoEnter === false ? " · без Enter" : ""} · ${lines[0] || ""}` }),
        ),
        el("span", { class: `kbd${err ? " bad" : ""}`, title: err || "", text: bind.hotkey || "без клавиши" }),
        el("button", { class: "btn sm", text: "▶", title: "Отправить в игру", onclick: async () => {
          const result = await api.runBind(bind.id);
          if (result?.copiedOnly) toast("Скопировано (отправка в игру только на Windows)");
          else if (result && !result.ok) toast(result.error, true);
        } }),
        el("button", { class: "btn sm ghost", text: "✎", title: "Изменить", onclick: () => openBindForm(bind) }),
      );
      list.append(row);
    }
  }

  function openBindForm(bind) {
    const form = $("bind-form");
    state.editing = bind ? { ...bind } : { id: newId(), title: "", hotkey: "", text: "", openKey: "", delay: "", hint: true, autoEnter: true };
    form.title.value = state.editing.title;
    form.hotkey.value = state.editing.hotkey || "";
    form.hint.checked = state.editing.hint !== false;
    form.autoEnter.checked = state.editing.autoEnter !== false;
    form.text.value = state.editing.text;
    form.openKey.value = state.editing.openKey || "";
    form.delay.value = state.editing.delay || "";
    $("bind-delete").hidden = !bind;
    form.hidden = false;
    $("binder-list").hidden = true;
    form.title.focus();
  }

  function closeBindForm() {
    $("bind-form").hidden = true;
    $("binder-list").hidden = false;
    state.editing = null;
  }

  hotkeyField($("bind-hotkey"), () => {});
  $("bind-add").addEventListener("click", () => openBindForm(null));
  $("bind-cancel").addEventListener("click", closeBindForm);
  $("bind-delete").addEventListener("click", async () => {
    state.binds = state.binds.filter((item) => item.id !== state.editing.id);
    closeBindForm();
    await saveBinds();
  });
  $("bind-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.target;
    const next = {
      id: state.editing.id,
      title: form.title.value.trim(),
      hotkey: form.hotkey.value.trim(),
      hint: form.hint.checked,
      autoEnter: form.autoEnter.checked,
      text: form.text.value,
      openKey: form.openKey.value.trim(),
      delay: form.delay.value ? Number(form.delay.value) : "",
    };
    const at = state.binds.findIndex((item) => item.id === next.id);
    if (at >= 0) state.binds[at] = next;
    else state.binds.push(next);
    closeBindForm();
    await saveBinds();
    const err = state.hotkeyErrors[next.id];
    if (err) toast(`Клавиша не назначена: ${err}`, true);
  });

  /* ---------- настройки ---------- */

  function fillSettings() {
    const s = state.settings;
    renderConnection();
    $("set-hotkey").value = s.hotkey || "";
    $("set-search-hotkey").value = s.searchHotkey || "";
    $("set-user-token").value = s.userToken || "";
    $("set-notify").checked = s.notifyPunishments !== false;
    $("set-autoupdate").checked = s.autoUpdate !== false;
    $("set-notify-sound").checked = s.notifySound !== false;
    $("set-notify-volume").value = Math.round((s.notifyVolume ?? 0.6) * 100);
    $("notify-volume-val").textContent = `${Math.round((s.notifyVolume ?? 0.6) * 100)}%`;
    $("set-notify-muted").checked = Boolean(s.notifyMuted);
    $("set-pun-claim").value = s.punClaimHotkey || "";
    $("set-pun-copy").value = s.punCopyHotkey || "";
    $("set-pun-issue").value = s.punIssueHotkey || "";
    $("set-pun-open").value = s.punOpenHotkey || "";
    $("set-notify-mode").value = s.notifyMode || "overlay";
    $("set-notify-corner").value = s.notifyCorner || "top-right";
    $("set-opacity").value = Math.round((s.opacity ?? 0.96) * 100);
    $("opacity-val").textContent = `${Math.round((s.opacity ?? 0.96) * 100)}%`;
    $("set-top").checked = Boolean(s.alwaysOnTop);
    $("set-hud").checked = Boolean(s.hud);
    $("set-hud-corner").value = s.hudCorner || "top-left";
    $("set-hud-hotkey").value = s.hudHotkey || "";
    $("set-hud-scale").value = Math.round((s.hudScale ?? 1) * 100);
    $("hud-scale-val").textContent = `${Math.round((s.hudScale ?? 1) * 100)}%`;
    $("set-hud-op").value = Math.round((s.hudOpacity ?? 0.85) * 100);
    $("hud-op-val").textContent = `${Math.round((s.hudOpacity ?? 0.85) * 100)}%`;
    $("set-hud-bg").checked = s.hudBg !== false;
    $("set-hud-op").disabled = s.hudBg === false;
    $("set-hud-block").value = Math.round((s.hudBlockOpacity ?? 1) * 100);
    $("hud-block-val").textContent = `${Math.round((s.hudBlockOpacity ?? 1) * 100)}%`;
    $("set-hide").checked = Boolean(s.hideOnCopy);
    $("set-paste").checked = Boolean(s.pasteOnCopy);
    $("set-chat").value = s.openChatKey || "";
    $("set-delay").value = s.lineDelay || 700;
    $("set-lock").checked = Boolean(s.lockWindow);
    $("set-dense").checked = s.density === "compact";
    document.body.classList.toggle("dense", s.density === "compact");
    $("set-hud-lock").checked = s.hudLocked !== false;
    document.body.classList.toggle("locked", Boolean(s.lockWindow));
    if (menuOpen()) renderMenu();
    renderHome();
    const KEY_NAMES = { toggle: "оверлея", search: "поиска", punClaim: "«Взять заявку»", punCopy: "«Копировать команду»", punIssue: "«Выдал»", punOpen: "«Наказания»" };
    const bad = Object.keys(KEY_NAMES).find((id) => state.hotkeyErrors[id]);
    paintSectionDots();
    $("settings-msg").textContent = bad ? `Клавиша ${KEY_NAMES[bad]} не назначена: ${state.hotkeyErrors[bad]}` : "";
  }

  async function patchSettings(patch) {
    const { settings, errors, error } = await api.setSettings(patch);
    if (error) toast(error, true);
    state.settings = settings;
    state.hotkeyErrors = errors || {};
    fillSettings();
    renderBinds();
  }

  hotkeyField($("set-hotkey"), (value) => value && patchSettings({ hotkey: value }));
  hotkeyField($("set-search-hotkey"), (value) => patchSettings({ searchHotkey: value }));
  $("set-opacity").addEventListener("input", (event) => {
    $("opacity-val").textContent = `${event.target.value}%`;
    patchSettings({ opacity: Number(event.target.value) / 100 });
  });
  hotkeyField($("set-hud-hotkey"), (value) => patchSettings({ hudHotkey: value }));
  $("set-hud").addEventListener("change", (event) => patchSettings({ hud: event.target.checked }));
  $("set-hud-corner").addEventListener("change", (event) => patchSettings({ hudCorner: event.target.value }));
  $("set-hud-scale").addEventListener("input", (event) => patchSettings({ hudScale: Number(event.target.value) / 100 }));
  $("set-hud-bg").addEventListener("change", (event) => patchSettings({ hudBg: event.target.checked }));
  $("set-hud-block").addEventListener("input", (event) => patchSettings({ hudBlockOpacity: Number(event.target.value) / 100 }));
  $("set-hud-op").addEventListener("input", (event) => patchSettings({ hudOpacity: Number(event.target.value) / 100 }));
  $("set-top").addEventListener("change", (event) => patchSettings({ alwaysOnTop: event.target.checked }));
  $("set-user-token").addEventListener("change", (event) => patchSettings({ userToken: event.target.value.trim() }).then(() => { refresh(); renderConnection(true); }));
  $("disconnect").addEventListener("click", async () => {
    await patchSettings({ userToken: "", serverUrl: "", token: "" });
    state.me = null;
    renderConnection();
    toast("Оверлей отключён от сайта");
  });
  $("set-notify").addEventListener("change", (event) => patchSettings({ notifyPunishments: event.target.checked }));
  $("set-notify-mode").addEventListener("change", (event) => patchSettings({ notifyMode: event.target.value }));
  $("set-notify-corner").addEventListener("change", (event) => patchSettings({ notifyCorner: event.target.value }));
  $("set-notify-sound").addEventListener("change", (event) => patchSettings({ notifySound: event.target.checked }));
  $("set-autoupdate").addEventListener("change", (event) => patchSettings({ autoUpdate: event.target.checked }));
  $("upd-check").addEventListener("click", () => api.updaterCheck());
  $("upd-download").addEventListener("click", () => api.updaterDownload());
  $("upd-install").addEventListener("click", async () => { const r = await api.updaterInstall(); if (r && r.ok === false) toast(r.error || "Не удалось установить", true); });
  $("set-notify-volume").addEventListener("input", (event) => { $("notify-volume-val").textContent = `${event.target.value}%`; });
  $("set-notify-volume").addEventListener("change", (event) => patchSettings({ notifyVolume: Number(event.target.value) / 100 }));
  for (const type of ["new", "info", "ok", "bad"]) {
    $(`snd-${type}`).addEventListener("click", () => window.OverlaySounds.play(type, Number($("set-notify-volume").value) / 100));
  }
  $("tour-again").addEventListener("click", () => startTour(true));
  $("backup-export").addEventListener("click", async () => {
    const r = await api.backupExport();
    if (r.ok) toast("Настройки сохранены в файл");
    else if (!r.canceled) toast(r.error || "Не удалось сохранить", true);
  });
  $("backup-import").addEventListener("click", async () => {
    const r = await api.backupImport();
    if (r.canceled) return;
    if (!r.ok) { toast(r.error || "Не удалось загрузить", true); return; }
    state.settings = r.settings;
    state.hotkeyErrors = r.errors || {};
    if (r.binds !== null) state.binds = (await api.getBinds()).binds;
    fillSettings();
    renderBinds();
    toast(r.skipped ? `Настройки загружены, пропущено значений: ${r.skipped}` : "Настройки загружены");
  });
  $("set-notify-muted").addEventListener("change", (event) => patchSettings({ notifyMuted: event.target.checked }));
  $("notify-test").addEventListener("click", () => api.notifyTest());
  hotkeyField($("set-pun-claim"), (value) => patchSettings({ punClaimHotkey: value }));
  hotkeyField($("set-pun-copy"), (value) => patchSettings({ punCopyHotkey: value }));
  hotkeyField($("set-pun-issue"), (value) => patchSettings({ punIssueHotkey: value }));
  hotkeyField($("set-pun-open"), (value) => patchSettings({ punOpenHotkey: value }));
  $("set-lock").addEventListener("change", (event) => patchSettings({ lockWindow: event.target.checked }));
  $("set-dense").addEventListener("change", (event) => patchSettings({ density: event.target.checked ? "compact" : "comfortable" }));
  $("set-hud-lock").addEventListener("change", (event) => patchSettings({ hudLocked: event.target.checked, ...(event.target.checked ? {} : { hud: true }) }));
  $("hud-reset").addEventListener("click", () => patchSettings({ hudPos: null }).then(() => toast("Подсказки вернулись в угол экрана")));
  $("connect-clip").addEventListener("click", async () => {
    const result = await api.connectFromClipboard();
    if (result.ok) toast("Оверлей подключён к сайту");
    else toast("В буфере нет ключа. Создайте его в профиле на сайте и скопируйте", true);
  });
  $("set-hide").addEventListener("change", (event) => patchSettings({ hideOnCopy: event.target.checked }));
  $("set-paste").addEventListener("change", (event) => patchSettings({ pasteOnCopy: event.target.checked }));
  $("set-chat").addEventListener("change", (event) => patchSettings({ openChatKey: event.target.value.trim() }));
  $("set-delay").addEventListener("change", (event) => patchSettings({ lineDelay: Number(event.target.value) || 700 }));
  $("close").addEventListener("click", () => api.hide());
  $("quit").addEventListener("click", () => api.quit());

  $("export-binds").addEventListener("click", () => copy(JSON.stringify(state.binds, null, 2), "Бинды скопированы в буфер"));
  $("import-binds").addEventListener("click", async () => {
    try {
      const text = await navigator.clipboard.readText();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) throw new Error("not array");
      const incoming = parsed
        .filter((item) => item && typeof item.title === "string" && typeof item.text === "string")
        .map((item) => ({ id: newId(), title: item.title, hotkey: "", text: item.text, openKey: item.openKey || "", delay: item.delay || "" }));
      state.binds.push(...incoming);
      await saveBinds();
      toast(`Импортировано: ${incoming.length} (клавиши назначьте заново)`);
    } catch {
      toast("В буфере нет списка биндов", true);
    }
  });

  /* ---------- наказания ---------- */

  const STATUS_TEXT = { pending: "Ожидает администратора", claimed: "На рассмотрении", approved: "На рассмотрении", issued: "Выдано", rejected: "Отклонено" };
  const absUrl = (url) => (/^https?:/i.test(url) ? url : new URL(url, /^https?:/i.test(state.settings.serverUrl) ? state.settings.serverUrl : `https://${state.settings.serverUrl}`).href);
  const waitMinutes = (iso) => Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  const ago = (iso) => {
    const minutes = waitMinutes(iso);
    if (minutes < 1) return "только что";
    if (minutes < 60) return `${minutes} мин назад`;
    const hours = Math.round(minutes / 60);
    return hours < 24 ? `${hours} ч назад` : `${Math.round(hours / 24)} дн. назад`;
  };
  const waitTone = (minutes) => (minutes >= 60 ? "hot" : minutes >= 20 ? "warm" : "");
  const kindTone = (kind) => {
    const k = String(kind || "").toLowerCase();
    return k.startsWith("хард") ? "hard" : k.startsWith("бан") ? "ban" : k.startsWith("мут") ? "mute" : "jail";
  };

  function punSummary() {
    const data = state.pun.data;
    if (!data) return "";
    const parts = [];
    if (data.me.canReview) parts.push(`в очереди ${data.queue.length}`, `у вас ${data.assigned.length}`);
    else parts.push(`${data.mine.length} ${plural(data.mine.length, "заявка", "заявки", "заявок")}`);
    return parts.join(", ");
  }

  async function punAct(payload, okText) {
    const result = await api.punishmentsAct(payload);
    if (result.ok) { if (okText) toast(okText); }
    else toast(result.error || "Не удалось выполнить действие", true);
    return result.ok;
  }

  const copyQuiet = async (text, label) => { await api.copy(text, { paste: false, hide: false }); toast(label); };

  function punHead(item, right) {
    return el("div", { class: `pcard-head tone-${kindTone(item.kind)}` },
      el("span", { class: "pun-num", text: `№${item.number}` }),
      el("span", { class: "pun-kind", text: `${item.kind} · ${item.duration}` }),
      right || null,
    );
  }

  /** Другие заявки на тот же Static ID (в очереди, в работе или мои): признак повторного нарушителя. */
  function repeatsOf(item) {
    const data = state.pun.data;
    if (!data) return 0;
    const ids = new Set();
    for (const list of [data.queue, data.assigned, data.mine]) for (const other of list || []) if (other.id !== item.id && other.staticId === item.staticId) ids.add(other.id);
    return ids.size;
  }
  const repeatChip = (item) => {
    const count = repeatsOf(item);
    return count ? el("span", { class: "repeat-chip", title: "Другие заявки на этот Static ID", text: `повтор: ещё ${count}` }) : null;
  };

  const staticChip = (item) =>
    el("button", { class: "pun-static", type: "button", title: "Скопировать Static ID", onclick: () => copyQuiet(item.staticId, `Static ID ${item.staticId} скопирован`) }, icon("i-copy"), `ID ${item.staticId}`);

  const ruleChips = (item) =>
    el("div", { class: "rchips" }, item.rules.length ? item.rules.map((rule) => el("span", { class: "rchip", text: rule })) : el("span", { class: "pun-meta", text: "Пункты не указаны" }));

  function queueCard(item) {
    const minutes = waitMinutes(item.createdAt);
    const card = el("article", { class: `pcard tone-${kindTone(item.kind)}` },
      punHead(item, el("span", { class: `wait ${waitTone(minutes)}` }, icon("i-clock"), ago(item.createdAt))),
      el("div", { class: "pcard-meta" }, staticChip(item), repeatChip(item), el("span", { class: "pun-sub", text: `подал ${item.requester}` }),
        el("span", { class: `ev${item.evidenceCount ? "" : " none"}`, text: item.evidenceCount ? `доказательств: ${item.evidenceCount}` : "без доказательств" })),
      ruleChips(item),
      el("div", { class: "pcard-foot" },
        el("span", { class: "pun-meta", text: item.evidenceCount ? "Доказательства откроются после того, как вы возьмёте заявку" : "" }),
        el("button", { class: "btn sm", onclick: () => punAct({ id: item.id, action: "claim" }, `Заявка №${item.number} ваша`), text: "Взять в работу" })),
    );
    card._item = item;
    card._primary = () => punAct({ id: item.id, action: "claim" }, `Заявка №${item.number} ваша`);
    return card;
  }

  const STEPS = ["Взято", "Решение", "Команда", "Выдано"];

  function assignedCard(item) {
    const ui = state.punUi;
    const step = item.needsDecision ? 1 : item.command ? (item.copied ? 3 : 2) : 1;
    const body = [
      el("ol", { class: "steps" }, STEPS.map((label, index) => el("li", { class: index < step ? "done" : index === step ? "now" : "" }, el("i", { text: index < step ? "✓" : String(index + 1) }), el("span", { text: label })))),
      el("div", { class: "pcard-meta" }, staticChip(item), repeatChip(item), el("span", { class: "pun-sub", text: `подал ${item.requester} · ${ago(item.createdAt)}` })),
      ruleChips(item),
    ];

    if (item.evidence.length) {
      body.push(el("div", { class: "pun-evidence" }, item.evidence.map((entry, index) =>
        el("button", { class: "chip", title: entry.url, onclick: () => api.openExternal(absUrl(entry.url)), text: `${entry.type === "image" ? "Скриншот" : "Ссылка"} ${index + 1}` }),
      )));
    }

    if (item.needsDecision) {
      const noteInput = el("input", { class: "pun-note", placeholder: "Причина отказа", maxlength: "300" });
      const noteRow = el("div", { class: "pun-forum-row", hidden: !ui.rejecting.has(item.id) }, noteInput,
        el("button", { class: "btn danger sm", onclick: () => punAct({ id: item.id, action: "reject", note: noteInput.value }, "Заявка отклонена"), text: "Отклонить" }));
      body.push(el("div", { class: "pun-actions" },
        el("button", { class: "btn", onclick: () => punAct({ id: item.id, action: "approve" }, "Заявка одобрена"), text: "Одобрить" }),
        el("button", { class: "btn ghost", onclick: () => { ui.rejecting.has(item.id) ? ui.rejecting.delete(item.id) : ui.rejecting.add(item.id); noteRow.hidden = !ui.rejecting.has(item.id); if (!noteRow.hidden) noteInput.focus(); }, text: "Отклонить…" }),
      ), noteRow);
    }

    if (item.command) {
      body.push(el("div", { class: "pun-command" },
        el("code", { text: item.command }),
        el("button", { class: item.copied ? "btn ghost sm" : "btn sm", onclick: async () => {
          await copyQuiet(item.command, "Команда скопирована");
          if (!item.copied) punAct({ id: item.id, action: "copied" });
        }, text: item.copied ? "Копировать ещё раз" : "Копировать команду" }),
      ));
      body.push(el("div", { class: "pun-actions" },
        el("button", { class: "btn", disabled: !item.copied, title: item.copied ? "" : "Сначала скопируйте команду", onclick: () => punAct({ id: item.id, action: "issue" }, `Наказание по заявке №${item.number} выдано`), text: "Выдал наказание" }),
      ));
    }

    const forumInput = el("input", { class: "pun-forum", placeholder: "Например Garik-0018", value: item.forum || "", maxlength: "60" });
    body.push(el("details", { class: "pfold", open: Boolean(item.forum) },
      el("summary", { text: "Жалоба на форуме" }),
      el("div", { class: "pun-forum-row" }, forumInput,
        el("button", { class: "btn ghost sm", onclick: () => punAct({ id: item.id, action: "forum", forum: forumInput.value }, "Жалоба сохранена"), text: "Сохранить" })),
    ));
    body.push(el("div", { class: "pcard-foot" }, el("span"),
      el("button", { class: "btn ghost sm", onclick: () => punAct({ id: item.id, action: "release" }, "Заявка вернулась в очередь"), text: "Вернуть в очередь" })));
    const card = el("article", { class: `pcard tone-${kindTone(item.kind)}` }, punHead(item, el("span", { class: "pstatus claimed", text: STATUS_TEXT[item.status] || "В работе" })), body);
    card._item = item;
    // Enter делает следующий шаг: одобрить → скопировать команду → отметить «Выдал»
    card._primary = () => {
      if (item.needsDecision) return punAct({ id: item.id, action: "approve" }, "Заявка одобрена");
      if (item.command && !item.copied) return copyQuiet(item.command, "Команда скопирована").then(() => punAct({ id: item.id, action: "copied" }));
      if (item.command) return punAct({ id: item.id, action: "issue" }, `Наказание по заявке №${item.number} выдано`);
      return null;
    };
    return card;
  }

  function mineRow(item) {
    return el("article", { class: `pcard slim tone-${kindTone(item.kind)}` },
      punHead(item, el("span", { class: `pstatus ${item.status}`, text: STATUS_TEXT[item.status] || item.status })),
      el("div", { class: "pcard-meta" }, el("span", { class: "pun-sub", text: `ID ${item.staticId} · ${ago(item.createdAt)}` }), repeatChip(item),
        item.rules?.length ? el("span", { class: "pun-sub", text: item.rules.join(", ") }) : null),
      item.status === "rejected" && item.decisionNote ? el("div", { class: "pun-reason", text: item.decisionNote }) : null,
    );
  }

  const LOG_ACTIONS = { claim: "Взял в работу", approve: "Одобрил", reject: "Отклонил", issue: "Выдал наказание", copied: "Скопировал команду", release: "Вернул в очередь", forum: "Жалоба на форуме", request: "Подал заявку" };
  const LOG_TONE = { issue: "ok", approve: "ok", request: "ok", reject: "bad", release: "warn" };

  function loadLog() {
    return api.punishmentsLog().then((list) => {
      state.punLog = Array.isArray(list) ? list : [];
      renderHome();
      if (state.punTab === "log") paintPunishments();
    }).catch(() => {});
  }

  function logDay(ts) {
    const day = new Date(ts); day.setHours(0, 0, 0, 0);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const diff = Math.round((today - day) / 86400000);
    return diff === 0 ? "Сегодня" : diff === 1 ? "Вчера" : day.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  }

  function logWhat(entry) {
    const names = Object.fromEntries(KIND_OPTIONS);
    const kind = names[entry.kind] || entry.kind || "";
    const duration = typeof entry.duration === "number" ? `${entry.duration} ${isDays(entry.kind) ? "дн." : "мин"}` : entry.duration || "";
    return [entry.number ? `№${entry.number}` : "", kind, duration].filter(Boolean).join(" · ");
  }

  function logView() {
    const q = state.punLogQ.trim().replace(/^[№#]/, "").toLowerCase();
    const rows = q ? state.punLog.filter((e) => String(e.staticId || "").toLowerCase().includes(q) || String(e.number ?? "") === q) : state.punLog;
    const out = [el("div", { class: "log-bar" },
      el("input", { type: "search", "data-id": "logq", class: "log-q", placeholder: "Static ID или номер заявки", value: state.punLogQ, autocomplete: "off", spellcheck: "false",
        oninput: (event) => { state.punLogQ = event.target.value; paintPunishments("logq"); } }),
      state.punLog.length ? el("button", { class: `btn ghost sm${state.punLogClear ? " danger" : ""}`, onclick: async () => {
        if (!state.punLogClear) { state.punLogClear = true; paintPunishments(); return; }
        await api.punishmentsLogClear(); state.punLog = []; state.punLogClear = false; paintPunishments();
      }, text: state.punLogClear ? "Точно очистить?" : "Очистить" }) : null)];
    if (!rows.length) {
      out.push(punEmpty("i-clock", q ? "Ничего не найдено" : "Журнал пуст", q ? "" : "Здесь появятся ваши действия: взял, выдал, отклонил."));
      return out;
    }
    let day = "";
    for (const entry of rows.slice(0, 200)) {
      const label = logDay(entry.ts);
      if (label !== day) { day = label; out.push(el("div", { class: "log-day", text: day })); }
      out.push(el("div", { class: `log-row ${LOG_TONE[entry.action] || ""}` },
        el("span", { class: "log-time", text: new Date(entry.ts).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) }),
        el("span", { class: "log-act", text: LOG_ACTIONS[entry.action] || entry.action }),
        el("span", { class: "log-what", text: logWhat(entry) }),
        entry.staticId ? el("span", { class: "log-id", title: "Static ID", text: `ID ${entry.staticId}` }) : null,
        entry.note ? el("span", { class: "log-note", text: entry.note }) : null));
    }
    return out;
  }

  function punEmpty(iconName, title, text) {
    return stateBlock({ icon: iconName, title, text, tone: iconName === "i-lock" ? "warn" : "neutral" });
  }

  function updateBadge() {
    const count = state.pun.badge > 0 ? state.pun.badge : 0;
    document.querySelectorAll("[data-pun-badge]").forEach((badge) => {
      badge.hidden = !count;
      badge.textContent = count > 99 ? "99+" : String(count);
    });
  }

  /** Обновление по таймеру опроса: пока человек печатает в поле, список не перерисовываем, иначе введённое пропадёт. */
  function renderPunishments() {
    const root = $("pun");
    if (!root) return;
    if (root.contains(document.activeElement) && document.activeElement.tagName === "INPUT") {
      clearTimeout(state.punTimer);
      state.punTimer = setTimeout(renderPunishments, 2500);
      return;
    }
    paintPunishments();
  }

  const PUN_FILTERS = [["all", "Все"], ["active", "Активные"], ["issued", "Выданы"], ["rejected", "Отклонены"]];

  /** Перерисовка по действию пользователя (форма, кнопки): фокус возвращается в то же поле. */
  function paintPunishments(focusId) {
    const root = $("pun");
    if (!root) return;
    const keep = focusId || document.activeElement?.dataset?.id;
    const scroll = root.querySelector(".pun-body")?.scrollTop || 0;
    // Анимация появления только при смене вкладки, фильтра или формы, а не при каждом опросе сайта
    const sig = [state.punTab, state.punFilter, state.punKind, Boolean(state.punForm), state.punLogQ].join("|");
    root.classList.toggle("still", root.dataset.sig === sig);
    root.dataset.sig = sig;
    const p = state.pun;
    const parts = [];
    if (!p.configured) {
      parts.push(stateBlock({ tone: "warn", icon: "i-gavel", title: "Наказания в оверлее",
        text: "Подключите личный ключ из профиля на сайте («Оверлей для игры»): заявки будут приходить уведомлением, а закрывать их можно прямо из игры.",
        actions: [["Открыть настройки", () => goSettings("connect"), true]] }));
    } else {
      const data = p.data;
      const me = data?.me;
      const formOpen = Boolean(state.punForm);
      parts.push(el("div", { class: "pun-top" },
        el("div", { class: "page-title" }, el("h2", { text: "Наказания" }),
          el("p", { class: "hint", text: p.updatedAt ? `Обновлено ${ago(p.updatedAt)}` : "Загрузка…" })),
        el("div", { class: "pun-top-actions" },
          me?.canRequest ? el("button", { class: "btn", "data-pun-new": true, onclick: () => { state.punForm = formOpen ? null : newPunForm(); paintPunishments("static"); } }, icon("i-plus"), "Новая заявка") : null,
          el("button", { class: "icon", title: "Обновить", "aria-label": "Обновить", onclick: () => api.punishmentsRefresh() }, icon("i-refresh")),
        ),
      ));
      if (p.error) {
        const retry = ["Повторить", () => api.punishmentsRefresh(), true];
        const keepNote = data ? "Показаны последние полученные данные." : "";
        parts.push(p.errorKind === "auth"
          ? stateBlock({ tone: "bad", icon: "i-lock", compact: true, title: "Ключ не подошёл", text: "Создайте новый ключ в профиле на сайте.", actions: [["Открыть настройки", () => goSettings("connect"), true]] })
          : p.errorKind === "network"
            ? stateBlock({ tone: "warn", icon: "i-refresh", compact: true, title: "Нет связи с сайтом", text: `${keepNote} Повторим автоматически.`.trim(), actions: [retry] })
            : stateBlock({ tone: "bad", icon: "i-alert", compact: true, title: "Не удалось обновить", text: p.error, actions: [retry] }));
      }
      if (data) {
        const tabs = [];
        if (me.canReview) tabs.push(["queue", "Очередь", data.queue.length], ["assigned", "В работе у меня", data.assigned.length]);
        if (me.canRequest) tabs.push(["mine", "Мои заявки", data.mine.length]);
        if (tabs.length) tabs.push(["log", "Журнал", state.punLog.length]);
        if (!tabs.length) {
          parts.push(punEmpty("i-lock", "Нет доступа", "У вашей роли нет доступа к наказаниям. Права настраиваются в разделе «Роли и права» на сайте."));
        } else {
          if (!tabs.some(([key]) => key === state.punTab)) state.punTab = tabs.find(([key]) => key === "assigned" && data.assigned.length)?.[0] || tabs[0][0];
          parts.push(el("div", { class: "pun-tabs", role: "tablist" }, tabs.map(([key, label, count]) =>
            el("button", { role: "tab", class: `ptab${state.punTab === key ? " active" : ""}${key === "queue" && count ? " attn" : ""}`, onclick: () => { state.punTab = key; state.punLogClear = false; if (key === "log") loadLog(); paintPunishments(); } },
              label, el("em", { text: String(count) })))));
          const list = [];
          if (state.punTab === "queue") {
            const all = [...data.queue].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            const kinds = [...new Set(all.map((item) => kindTone(item.kind)))];
            if (!kinds.includes(state.punKind)) state.punKind = "";
            if (kinds.length > 1) {
              const names = { jail: "Деморган", mute: "Мут", ban: "Бан", hard: "Хардбан" };
              list.push(el("div", { class: "pun-filter" }, [["", "Все", all.length], ...kinds.map((key) => [key, names[key], all.filter((item) => kindTone(item.kind) === key).length])].map(([key, label, count]) =>
                el("button", { class: `chip${(state.punKind || "") === key ? " active" : ""}`, onclick: () => { state.punKind = key; paintPunishments(); }, text: `${label} · ${count}` }))));
            }
            const queue = state.punKind ? all.filter((item) => kindTone(item.kind) === state.punKind) : all;
            list.push(...(queue.length ? queue.map(queueCard) : [punEmpty("i-check", "Очередь пуста", "Новые заявки появятся здесь и придут уведомлением.")]));
          } else if (state.punTab === "log") {
            list.push(...logView());
          } else if (state.punTab === "assigned") {
            list.push(...(data.assigned.length ? data.assigned.map(assignedCard) : [punEmpty("i-gavel", "Пока ничего в работе", data.queue.length ? "Возьмите заявку из очереди." : "")]));
          } else {
            const filter = state.punFilter || "all";
            const match = { all: () => true, active: (i) => i.status === "pending" || i.status === "claimed" || i.status === "approved", issued: (i) => i.status === "issued", rejected: (i) => i.status === "rejected" }[filter];
            list.push(el("div", { class: "pun-filter" }, PUN_FILTERS.map(([key, label]) => el("button", { class: `chip${filter === key ? " active" : ""}`, onclick: () => { state.punFilter = key; paintPunishments(); }, text: label }))));
            const rows = data.mine.filter(match).slice(0, 30);
            list.push(...(rows.length ? rows.map(mineRow) : [punEmpty("i-msg", "Здесь пусто", filter === "all" ? "Вы ещё не подавали заявок." : "Нет заявок с таким статусом.")]));
          }
          parts.push(el("div", { class: "pun-body" }, list));
        }
      } else if (!p.error) {
        parts.push(punEmpty("i-refresh", "Загружаю…"));
      }
      if (formOpen && me?.canRequest) {
        parts.push(el("div", { class: "drawer-wrap" },
          el("div", { class: "scrim", onclick: () => { state.punForm = null; paintPunishments(); } }),
          el("aside", { class: "drawer", "aria-label": "Новая заявка" },
            el("header", { class: "drawer-head" }, el("h3", { text: "Новая заявка на наказание" }),
              el("button", { class: "icon", title: "Закрыть (Esc)", onclick: () => { state.punForm = null; paintPunishments(); } }, icon("i-x"))),
            el("div", { class: "drawer-body" }, punFormNode()))));
      }
    }
    root.replaceChildren(...parts);
    const body = root.querySelector(".pun-body");
    if (body) body.scrollTop = scroll;
    const refocus = keep ? root.querySelector(`[data-id="${keep}"]`) : null;
    if (refocus) {
      refocus.focus();
      if (typeof refocus.value === "string" && refocus.setSelectionRange) { try { refocus.setSelectionRange(refocus.value.length, refocus.value.length); } catch { /* тип поля без выделения */ } }
    }
    markSelected(false);
    saveDraft();
  }

  /* ----- клавиши вкладки «Наказания» ----- */

  const kbd = (key, label) => el("span", { class: "pk" }, el("kbd", { text: key }), label);

  const punCards = () => [...document.querySelectorAll("#pun .pun-body .pcard")];

  function markSelected(scroll = true) {
    const cards = punCards();
    if (!cards.length) { state.punSel = 0; return; }
    state.punSel = Math.max(0, Math.min(state.punSel || 0, cards.length - 1));
    cards.forEach((card, index) => card.classList.toggle("psel", index === state.punSel));
    if (scroll) cards[state.punSel].scrollIntoView({ block: "nearest" });
  }

  /** Одиночные клавиши на вкладке «Наказания», пока фокус не в поле ввода. */
  function punKey(event) {
    if (state.tab !== "punishments" || state.punForm || event.ctrlKey || event.altKey || event.metaKey) return false;
    if (/^(INPUT|TEXTAREA|SELECT|BUTTON|SUMMARY)$/.test(event.target?.tagName || "")) return false;
    const tabs = [...document.querySelectorAll("#pun .ptab")];
    const digit = /^(Digit|Numpad)([1-9])$/.exec(event.code);
    if (digit && tabs[Number(digit[2]) - 1]) { tabs[Number(digit[2]) - 1].click(); state.punSel = 0; markSelected(false); return true; }
    if (event.code === "ArrowDown" || event.code === "KeyJ") { state.punSel = (state.punSel || 0) + 1; markSelected(); return true; }
    if (event.code === "ArrowUp" || event.code === "KeyK") { state.punSel = Math.max(0, (state.punSel || 0) - 1); markSelected(); return true; }
    if (event.code === "KeyR") { api.punishmentsRefresh(); toast("Обновляю…"); return true; }
    if (event.code === "KeyN") { $("pun").querySelector("[data-pun-new]")?.click(); return true; }
    const card = punCards()[state.punSel || 0];
    if (event.code === "Enter" && card?._primary) { card._primary(); return true; }
    if (event.code === "KeyC" && card?._item) { copyQuiet(card._item.staticId, `Static ID ${card._item.staticId} скопирован`); return true; }
    // Любой другой символ: возвращаем фокус в поиск, чтобы можно было печатать
    if (event.key.length === 1) focusSearch();
    return false;
  }

  /* ----- форма новой заявки ----- */

  const KIND_OPTIONS = [["jail", "Деморган"], ["mute", "Мут"], ["ban", "Бан"], ["hardban", "Хардбан"]];
  const RULE_LABEL = /^([A-Za-zА-Яа-яЁё]{1,10})\s*(\d{1,3}(?:\.\d{1,3}){0,3})$/;
  const normalizeLabel = (value) => { const m = RULE_LABEL.exec(String(value).trim()); return m ? `${m[1].toUpperCase()} ${m[2]}` : null; };
  const LIMITS = { staticDigits: 9, minutes: 10000, days: 3650, rules: 5, evidence: 6 };

  const DRAFT_KEY = "region-overlay-pun-draft";
  const readDraft = () => { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"); } catch { return null; } };
  const clearDraft = () => { try { localStorage.removeItem(DRAFT_KEY); } catch { /* черновик необязателен */ } };
  function saveDraft() {
    const f = state.punForm;
    if (!f) return;
    try {
      if (!f.staticId && !f.duration && !f.rules.length && !f.forum && !f.evidence.length) localStorage.removeItem(DRAFT_KEY);
      else localStorage.setItem(DRAFT_KEY, JSON.stringify({ staticId: f.staticId, kind: f.kind, muteChannel: f.muteChannel, duration: f.duration, rules: f.rules, forum: f.forum, evidence: f.evidence }));
    } catch { /* черновик необязателен */ }
  }
  const newPunForm = () => {
    const form = blankPunForm();
    const d = readDraft();
    if (d && typeof d === "object") {
      if (/^\d{0,9}$/.test(d.staticId || "")) form.staticId = d.staticId || "";
      if (KIND_OPTIONS.some(([key]) => key === d.kind)) form.kind = d.kind;
      if (d.muteChannel === "voice" || d.muteChannel === "chat") form.muteChannel = d.muteChannel;
      if (/^\d{0,5}$/.test(d.duration || "")) form.duration = d.duration || "";
      if (Array.isArray(d.rules)) form.rules = d.rules.map(normalizeLabel).filter(Boolean).slice(0, LIMITS.rules);
      if (typeof d.forum === "string") form.forum = d.forum.slice(0, 60);
      if (Array.isArray(d.evidence)) form.evidence = d.evidence.filter((e) => e && (e.type === "image" || e.type === "link") && typeof e.url === "string").slice(0, LIMITS.evidence);
      if (form.staticId || form.duration || form.rules.length || form.forum || form.evidence.length) toast("Черновик заявки восстановлен");
    }
    return form;
  };
  const blankPunForm = () => ({ staticId: "", kind: "jail", muteChannel: "chat", duration: "", rules: [], ruleQuery: "", forum: "", evidence: [], linkDraft: "", uploading: 0, busy: false, error: "" });
  const isDays = (kind) => kind === "ban" || kind === "hardban";

  function ruleSuggestions(query) {
    if (!query.trim()) return [];
    const seen = new Set();
    const out = [];
    for (const hit of window.RuleSearch.search(state.index, query, 12)) {
      const label = normalizeLabel(`${(hit.rule.tag || hit.rule.article || "").toUpperCase()} ${hit.rule.number}`);
      if (!label || seen.has(label)) continue;
      seen.add(label);
      out.push({ label, text: String(hit.rule.text || "").replace(/\s+/g, " ").slice(0, 90), punishments: hit.rule.punishments || [] });
      if (out.length >= 6) break;
    }
    return out;
  }

  /** По тексту наказания пункта («/jail 30 минут», «Ban 1 день») подставляем вид и срок, если форма ещё пуста. */
  function applyRuleDefaults(form, rule) {
    if (form.duration) return false;
    for (const text of rule.punishments || []) {
      const m = /(hardban|хардбан|jail|деморган|mute|мут|ban|бан)\D{0,12}?(\d{1,5})\s*(мин|час|ч\b|дн|день|дней|сут)/i.exec(String(text));
      if (!m) continue;
      const word = m[1].toLowerCase();
      const kind = /hard|хард/.test(word) ? "hardban" : /ban|бан/.test(word) ? "ban" : /mute|мут/.test(word) ? "mute" : "jail";
      const unit = m[3].toLowerCase();
      const hours = /^(час|ч)/.test(unit);
      const days = /^(дн|день|дней|сут)/.test(unit);
      if (isDays(kind) !== days && !(hours && !isDays(kind))) continue;
      form.kind = kind;
      if (kind === "mute") form.muteChannel = form.muteChannel || "chat";
      form.duration = String(hours ? Number(m[2]) * 60 : Number(m[2]));
      return true;
    }
    return false;
  }

  async function startRequestFromRule(rule) {
    const label = normalizeLabel(ruleRef(rule));
    if (!label) { toast("Не удалось определить пункт правил", true); return; }
    if (state.compact) await setCompact(false);
    if (!state.punForm) state.punForm = newPunForm();
    const form = state.punForm;
    switchTab("punishments");
    let hint = "";
    if (!form.rules.includes(label) && form.rules.length < LIMITS.rules) {
      if (!form.rules.length && applyRuleDefaults(form, rule)) hint = `, подставил ${KIND_OPTIONS.find(([key]) => key === form.kind)?.[1]} ${form.duration} ${isDays(form.kind) ? "дн." : "мин"}`;
      form.rules.push(label);
    }
    paintPunishments("static");
    toast(`Пункт ${label} в заявке${hint}`);
  }

  function addRule(label) {
    const form = state.punForm;
    const normalized = normalizeLabel(label);
    if (!normalized || form.rules.includes(normalized)) return;
    if (form.rules.length >= LIMITS.rules) { toast(`Не больше ${LIMITS.rules} пунктов правил`, true); return; }
    form.rules.push(normalized);
    form.ruleQuery = "";
    paintPunishments("rule");
  }

  function addLink() {
    const form = state.punForm;
    const value = form.linkDraft.trim();
    if (!value) return;
    try { if (new URL(value).protocol !== "https:") throw new Error(); } catch { toast("Ссылка должна начинаться с https://", true); return; }
    if (form.evidence.length >= LIMITS.evidence) { toast(`Не больше ${LIMITS.evidence} доказательств`, true); return; }
    if (!form.evidence.some((entry) => entry.url === value)) form.evidence.push({ type: "link", url: value });
    form.linkDraft = "";
    paintPunishments("link");
  }

  async function addImage(file) {
    const form = state.punForm;
    if (!form || !file) return;
    if (form.evidence.length + form.uploading >= LIMITS.evidence) { toast(`Не больше ${LIMITS.evidence} доказательств`, true); return; }
    form.uploading += 1;
    paintPunishments();
    const result = await api.punishmentsUpload(new Uint8Array(await file.arrayBuffer()), file.type, file.name);
    form.uploading -= 1;
    if (result.ok) form.evidence.push({ type: "image", url: result.url });
    else toast(result.error || "Не удалось загрузить скриншот", true);
    paintPunishments();
  }

  async function submitPunForm() {
    const form = state.punForm;
    const duration = Number(form.duration);
    const max = isDays(form.kind) ? LIMITS.days : LIMITS.minutes;
    let error = "";
    if (!/^\d{1,9}$/.test(form.staticId)) error = "Статик состоит из цифр";
    else if (!Number.isInteger(duration) || duration < 1 || duration > max) error = `Срок от 1 до ${max} ${isDays(form.kind) ? "дн." : "мин"}`;
    else if (!form.rules.length) error = "Укажите хотя бы один пункт правил";
    else if (form.uploading) error = "Дождитесь загрузки скриншота";
    form.error = error;
    if (error) { paintPunishments(); return; }
    form.busy = true;
    paintPunishments();
    const result = await api.punishmentsCreate({
      staticId: form.staticId,
      kind: form.kind,
      muteChannel: form.kind === "mute" ? form.muteChannel : null,
      duration,
      forum: form.forum,
      rules: form.rules,
      evidence: form.evidence,
    });
    form.busy = false;
    if (result.ok) {
      toast(`Заявка №${result.number} отправлена администраторам`);
      state.punForm = null;
      clearDraft();
    } else {
      form.error = result.error || "Не удалось отправить заявку";
    }
    paintPunishments();
  }

  function punFormNode() {
    const form = state.punForm;
    const days = isDays(form.kind);
    const field = (label, ...nodes) => el("label", { class: "pf-field" }, el("span", { text: label }), ...nodes);
    const seg = (options, current, onPick) => el("div", { class: "seg" }, options.map(([value, text]) => el("button", { type: "button", class: value === current ? "active" : "", onclick: () => onPick(value), text })));

    const staticInput = el("input", { "data-id": "static", inputmode: "numeric", maxlength: String(LIMITS.staticDigits), placeholder: "Например 5476", value: form.staticId });
    staticInput.addEventListener("input", () => { staticInput.value = staticInput.value.replace(/\D/g, ""); form.staticId = staticInput.value; });
    const durationInput = el("input", { "data-id": "duration", inputmode: "numeric", placeholder: days ? "Дней" : "Минут", value: form.duration });
    durationInput.addEventListener("input", () => { durationInput.value = durationInput.value.replace(/\D/g, ""); form.duration = durationInput.value; });

    const suggestions = el("div", { class: "pf-suggest" });
    const ruleInput = el("input", { "data-id": "rule", placeholder: "Номер пункта (ОП 4.9) или слова из правила", value: form.ruleQuery, autocomplete: "off" });
    const fillSuggestions = () => {
      const hits = ruleSuggestions(ruleInput.value);
      suggestions.replaceChildren(...hits.map((hit) => el("button", { type: "button", class: "pf-hit", onclick: () => addRule(hit.label) },
        el("b", { text: hit.label }), el("span", { text: hit.text }), hit.punishments.length ? el("small", { text: hit.punishments.join(" · ") }) : null)));
      return hits;
    };
    ruleInput.addEventListener("input", () => { form.ruleQuery = ruleInput.value; fillSuggestions(); });
    ruleInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      const hits = fillSuggestions();
      if (normalizeLabel(ruleInput.value) && !hits.some((hit) => hit.label === normalizeLabel(ruleInput.value))) addRule(ruleInput.value);
      else if (hits[0]) addRule(hits[0].label);
    });
    fillSuggestions();

    const linkInput = el("input", { "data-id": "link", placeholder: "https://…", value: form.linkDraft });
    linkInput.addEventListener("input", () => { form.linkDraft = linkInput.value; });
    linkInput.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); addLink(); } });

    const fileInput = el("input", { type: "file", accept: "image/png,image/jpeg,image/webp,image/gif", hidden: true });
    fileInput.addEventListener("change", () => { for (const file of fileInput.files) addImage(file); fileInput.value = ""; });
    const drop = el("div", { class: "pf-drop", tabindex: "0", title: "Вставьте скриншот через Ctrl+V, перетащите файл или нажмите", onclick: () => fileInput.click() },
      form.uploading ? `Загружаю скриншот (${form.uploading})…` : "Скриншот: Ctrl+V, перетащите файл или нажмите");
    drop.addEventListener("dragover", (event) => { event.preventDefault(); drop.classList.add("over"); });
    drop.addEventListener("dragleave", () => drop.classList.remove("over"));
    drop.addEventListener("drop", (event) => { event.preventDefault(); drop.classList.remove("over"); for (const file of event.dataTransfer.files) addImage(file); });

    const node = el("div", { class: "pun-form" },
      el("div", { class: "pf-row" }, field("Static ID нарушителя", staticInput), field(days ? "Срок, дней" : "Срок, минут", durationInput)),
      field("Вид наказания", seg(KIND_OPTIONS, form.kind, (value) => { form.kind = value; if (value === "mute" && !form.muteChannel) form.muteChannel = "chat"; paintPunishments(); })),
      form.kind === "mute" ? field("Тип мута", seg([["chat", "Чат"], ["voice", "Голосовой"]], form.muteChannel, (value) => { form.muteChannel = value; paintPunishments(); })) : null,
      field(`Пункты правил (до ${LIMITS.rules})`,
        form.rules.length ? el("div", { class: "pf-chips" }, form.rules.map((label) => el("button", { type: "button", class: "chip active", title: "Убрать", onclick: () => { form.rules = form.rules.filter((item) => item !== label); paintPunishments("rule"); }, text: `${label} ×` }))) : null,
        ruleInput, suggestions),
      field("Жалоба на форуме (по желанию)", (() => { const input = el("input", { "data-id": "forum", maxlength: "60", placeholder: "Например Garik-0018", value: form.forum }); input.addEventListener("input", () => { form.forum = input.value; }); return input; })()),
      field(`Доказательства (${form.evidence.length}/${LIMITS.evidence})`,
        form.evidence.length ? el("div", { class: "pf-chips" }, form.evidence.map((entry, index) => el("button", { type: "button", class: "chip", title: `${entry.url}\nНажмите, чтобы убрать`, onclick: () => { form.evidence = form.evidence.filter((item) => item !== entry); paintPunishments(); }, text: `${entry.type === "image" ? "Скрин" : "Ссылка"} ${index + 1} ×` }))) : null,
        el("div", { class: "pf-link" }, linkInput, el("button", { type: "button", class: "btn ghost sm", onclick: addLink, text: "Добавить" })),
        drop, fileInput),
      form.error ? el("div", { class: "pun-error", text: form.error }) : null,
      el("div", { class: "pun-actions" },
        el("button", { type: "button", class: "btn", disabled: form.busy || form.uploading > 0, onclick: submitPunForm, text: form.busy ? "Отправляю…" : "Отправить заявку" }),
        el("button", { type: "button", class: "btn ghost", onclick: () => { state.punForm = null; paintPunishments(); }, text: "Закрыть" }),
        el("button", { type: "button", class: "btn ghost", title: "Стереть введённое", onclick: () => { clearDraft(); state.punForm = blankPunForm(); paintPunishments("static"); }, text: "Очистить" }),
      ),
    );
    // Скриншот можно вставить через Ctrl+V из любого поля формы
    node.addEventListener("paste", (event) => {
      const image = [...(event.clipboardData?.files || [])].find((file) => file.type.startsWith("image/"));
      if (image) { event.preventDefault(); addImage(image); }
    });
    return node;
  }

  state.punUi = { rejecting: new Set() };
  $("pun").addEventListener("input", () => saveDraft());
  loadLog();
  api.onPunishments((payload) => {
    state.pun = payload;
    loadLog();
    renderPunishments();
    renderHome();
    updateBadge();
    if (menuOpen()) renderMenu();
  });
  api.onGoto(async (tab) => {
    if (state.compact) await setCompact(false);
    switchTab(tab);
  });

  /* ---------- подключение ---------- */

  /** Показывает, к какому сайту и под кем подключён оверлей; адрес берётся из ключа. */
  async function renderConnection(force = false) {
    const status = $("connect-status");
    const s = state.settings;
    $("set-user-token").value = s.userToken || "";
    $("disconnect").hidden = !s.userToken && !s.serverUrl;
    if (!s.serverUrl) {
      status.textContent = "Не подключено";
      status.className = "connect-status off";
      return;
    }
    const host = String(s.serverUrl).replace(/^https?:\/\//i, "");
    status.className = "connect-status on";
    status.textContent = `Подключено к ${host}`;
    if (!s.userToken) { status.textContent += " (старый способ: токен и адрес; создайте ключ в профиле)"; return; }
    if (state.me?.key === s.userToken && !force) { status.textContent = state.me.ok ? `${host}: ${state.me.name}` : state.me.error; status.className = `connect-status ${state.me.ok ? "on" : "bad"}`; return; }
    const me = await api.connectionMe();
    state.me = { ...me, key: s.userToken };
    if ($("connect-status") && state.settings.userToken === s.userToken) {
      status.textContent = me.ok ? `${host}: ${me.name}` : me.error;
      status.className = `connect-status ${me.ok ? "on" : "bad"}`;
    }
  }

  /* ---------- главная ---------- */

  const icon = (name, cls = "ico") => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", cls);
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", `#${name}`);
    svg.append(use);
    return svg;
  };

  buildSettingsNav();

  const plural = (n, one, few, many) => {
    const m10 = n % 10, m100 = n % 100;
    return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
  };

  function goRules(key) { state.articleFilter = key; renderArticleChips(); $("all-q").value = ""; switchTab("rules"); }
  function goReplies(cat) { state.replyCat = cat; renderReplyChips(); $("all-q").value = ""; switchTab("replies"); }

  function renderHome() {
    const home = $("home");
    if (!home) return;
    const { rules = [], replies = [] } = state.data;
    const tags = new Map();
    for (const rule of rules) {
      const key = rule.tag || rule.article;
      if (!tags.has(key)) tags.set(key, rule.article);
    }
    const cats = [...new Set(replies.map((reply) => reply.category).filter(Boolean))];

    const stat = (name, value, label, sub, tab, hot) =>
      el("button", { class: `stat${hot ? " hot" : ""}`, onclick: () => switchTab(tab) },
        el("span", { class: "stat-ico" }, icon(name)),
        el("span", { class: "stat-num", text: String(value) }),
        el("span", { class: "stat-label", text: label }),
        el("small", { text: sub }),
      );

    const pdata = state.pun.data;
    let attention = null;
    if (pdata?.me.canReview && (pdata.queue.length || pdata.assigned.length)) {
      const oldest = pdata.queue.reduce((max, item) => Math.max(max, waitMinutes(item.createdAt)), 0);
      attention = el("button", { class: "attn-banner", onclick: () => switchTab("punishments") },
        el("span", { class: "attn-ico" }, icon("i-gavel")),
        el("span", { class: "attn-text" },
          el("b", { text: pdata.queue.length ? `${pdata.queue.length} ${plural(pdata.queue.length, "заявка ждёт", "заявки ждут", "заявок ждут")} рассмотрения` : `У вас в работе: ${pdata.assigned.length}` }),
          el("small", { text: [pdata.queue.length && oldest ? `старейшая ждёт ${oldest} мин` : "", pdata.queue.length && pdata.assigned.length ? `у вас в работе: ${pdata.assigned.length}` : ""].filter(Boolean).join(" · ") || "Откройте раздел «Наказания»" })),
        icon("i-right", "ico chev"));
    }

    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const today = state.punLog.filter((entry) => entry.ts >= startOfDay.getTime());
    const countOf = (action) => today.filter((entry) => entry.action === action).length;
    const shiftParts = [["claim", "взято"], ["issue", "выдано"], ["reject", "отклонено"], ["request", "подано"]].map(([action, label]) => [countOf(action), label]).filter(([count]) => count);
    const shift = shiftParts.length
      ? el("button", { class: "shift-strip", title: "Открыть журнал", onclick: () => { state.punTab = "log"; switchTab("punishments"); loadLog(); } },
        el("span", { class: "shift-title", text: "Сегодня" }),
        ...shiftParts.map(([count, label]) => el("span", { class: "shift-item" }, el("b", { text: String(count) }), ` ${label}`)))
      : null;

    const chip = (name, label, onclick, title) => el("button", { class: "pchip", title: title || "", onclick }, icon(name), label);

    const category = (title, art, chips) =>
      el("section", { class: "cat" }, el("h2", { text: title }), el("div", { class: "pchips" }, chips), el("span", { class: "art", "aria-hidden": "true" }, icon(art, "art-svg")));

    const ruleChips = rules.length
      ? [...tags].slice(0, 8).map(([key, article]) => chip("i-shield", key, () => goRules(key), article))
      : [chip("i-sliders", "Подключить сайт", () => goSettings("connect"))];
    const replyChips = replies.length
      ? cats.slice(0, 8).map((cat) => chip("i-msg", cat, () => goReplies(cat)))
      : [chip("i-sliders", "Подключить сайт", () => goSettings("connect"))];
    const bindChips = state.binds.slice(0, 6).map((bind) => chip("i-keys", bind.title || "Без названия", () => runBindFromUi(bind), `${bind.hotkey || "без клавиши"}: отправить в игру`));
    bindChips.push(chip("i-plus", "Новый бинд", () => { switchTab("binder"); openBindForm(null); }));
    const screenChips = [
      chip("i-monitor", state.settings.hud ? "Подсказки: вкл" : "Подсказки: выкл", () => patchSettings({ hud: !state.settings.hud }), "Список биндов поверх игры"),
      chip("i-pin", state.settings.alwaysOnTop ? "Поверх игры: вкл" : "Поверх игры: выкл", () => patchSettings({ alwaysOnTop: !state.settings.alwaysOnTop })),
      chip("i-move", state.settings.hudLocked === false ? "Подсказки: двигаю" : "Двигать подсказки", () => patchSettings({ hudLocked: state.settings.hudLocked === false, hud: true }), "Перетащите подсказки мышью и нажмите «Зафиксировать»"),
      chip("i-shrink", "Свернуть", () => setCompact(true), "Ctrl+M"),
      chip("i-sliders", "Настройки", () => switchTab("settings")),
    ];

    const upd = state.upd || {};
    const updateBanner = upd.status === "ready" || (upd.status === "available" && upd.latest)
      ? el("button", { class: "attn-banner upd-banner", onclick: () => goSettings("updates") },
          el("span", { class: "attn-ico" }, icon("i-refresh")),
          el("span", { class: "attn-text" },
            el("b", { text: upd.status === "ready" ? `Обновление ${upd.latest} готово к установке` : `Доступна версия ${upd.latest}` }),
            el("small", { text: upd.status === "ready" ? "Установится при перезапуске или по кнопке в настройках" : "Откройте «Настройки → Обновления»" })),
          icon("i-right", "ico chev"))
      : null;

    const pinned = readPins()
      .map((ref) => rules.find((rule) => ruleRef(rule) === ref))
      .filter(Boolean)
      .slice(0, 8);
    const pins = pinned.length
      ? el("section", { class: "pins" },
          el("h3", { text: "Закреплённые правила" }),
          el("div", { class: "pin-grid" }, pinned.map((rule) => {
            const ref = ruleRef(rule);
            return el("button", { class: "pin", title: `Нажмите, чтобы скопировать «${ref}»`, onclick: () => copy(ref, `Скопировано: ${ref}`) },
              el("span", { class: "ref", text: ref }),
              el("span", { class: "pin-text", text: String(rule.text || "") }));
          })))
      : null;

    const history = readHistory().slice(0, 8);
    const recent = history.length
      ? el("section", { class: "recent" },
          el("h3", { text: "Недавние запросы" }),
          el("div", { class: "tiles" }, history.map((query) =>
            el("button", { class: "tile", title: query, onclick: () => { $("all-q").value = query; allSearch.render(); $("all-q").focus(); } },
              el("span", { class: "thumb" }, icon("i-search")),
              el("span", { class: "tile-name", text: query }),
            ),
          )),
        )
      : null;

    home.replaceChildren(
      ...(updateBanner ? [updateBanner] : []),
      ...(attention ? [attention] : []),
      ...(shift ? [shift] : []),
      ...(pins ? [pins] : []),
      el("div", { class: "stat-row" }, [
        stat("i-shield", rules.length, plural(rules.length, "пункт", "пункта", "пунктов"), rules.length ? `${tags.size} ${plural(tags.size, "раздел", "раздела", "разделов")}` : "нет данных", "rules"),
        stat("i-msg", replies.length, plural(replies.length, "ответ", "ответа", "ответов"), replies.length ? `${cats.length} ${plural(cats.length, "категория", "категории", "категорий")}` : "нет данных", "replies"),
        stat("i-keys", state.binds.length, plural(state.binds.length, "бинд", "бинда", "биндов"), "горячие клавиши", "binder"),
        stat("i-gavel", pdata ? (pdata.me.canReview ? pdata.queue.length : pdata.mine.length) : "—", pdata ? (pdata.me.canReview ? "в очереди" : plural(pdata.mine.length, "заявка", "заявки", "заявок")) : "наказания", pdata ? (pdata.me.canReview ? `у вас в работе ${pdata.assigned.length}` : punSummary()) : "не подключено", "punishments", Boolean(pdata?.me.canReview && pdata.queue.length)),
      ]),
      el("div", { class: "cat-grid" },
        category("Разделы правил", "i-shield", ruleChips),
        category("Быстрые ответы", "i-msg", replyChips),
        category("Мои бинды", "i-keys", bindChips),
        category("Экран и окно", "i-monitor", screenChips),
      ),
      ...(recent ? [recent] : []),
    );
  }

  /* ---------- данные ---------- */

  function applyData(data) {
    state.data = { ...state.data, ...data, replies: data.replies || [] };
    state.index = buildIndex(state.data.rules);
    setStatus();
    renderArticleChips();
    renderRules();
    renderReplyChips();
    renderReplies();
    renderAll();
    renderHome();
  }

  async function refresh(quiet = false) {
    const buttons = document.querySelectorAll("[data-menu]");
    buttons.forEach((button) => button.classList.add("spin"));
    const result = await api.refreshData();
    buttons.forEach((button) => button.classList.remove("spin"));
    if (result.ok) {
      state.lastFetch = Date.now();
      applyData(result.data);
      if (quiet !== true) toast(`Обновлено: ${result.data.rules.length} пунктов`);
    } else if (quiet !== true) {
      toast(result.error, true);
    }
  }

  /* Сайт подтягивается сам: при запуске, при открытии окна (если данные старше 3 минут) и раз в 10 минут. */
  setInterval(() => { if (state.settings.serverUrl) refresh(true); }, 10 * 60 * 1000);
  api.onConnected(() => { refresh(); if (state.tab === "settings") switchTab("all"); });


  document.addEventListener("keydown", (event) => {
    if (window.OverlayTour?.active()) return;
    if (punKey(event)) { event.preventDefault(); return; }
    if (event.key === "Escape" && menuOpen()) { closeMenu(); return; }
    if (event.key === "Escape" && state.punForm) { state.punForm = null; paintPunishments(); return; }
    if (event.key === "Escape") {
      const q = state.compact ? $("c-q") : $("all-q");
      if (q.value) { q.value = ""; q.dispatchEvent(new Event("input")); }
      else if (state.compact && $("c-list").children.length) { $("c-list").replaceChildren(); fitCompact(); }
      else if (state.editing) closeBindForm();
      else if (!state.compact && $("tab-all").classList.contains("has-results")) allSearch.render();
      else if (!state.compact && state.tab !== "all") switchTab("all");
      else api.hide();
    } else if (event.ctrlKey && event.key.toLowerCase() === "m") {
      event.preventDefault();
      setCompact(!state.compact);
    } else if (event.ctrlKey && /^[1-6]$/.test(event.key)) {
      switchTab(["all", "rules", "replies", "binder", "settings", "punishments"][Number(event.key) - 1]);
    }
  });

  // Глобальная клавиша поиска: главный процесс уже переключил окно в строку поиска, остаётся обновить интерфейс.
  api.onSearch(async () => {
    state.settings = await api.getSettings();
    state.compact = true;
    document.body.classList.add("compact");
    closeMenu();
    compactSearch.render();
    focusSearch();
  });

  api.onShown(() => {
    focusSearch();
    if (state.settings.serverUrl && Date.now() - (state.lastFetch || 0) > 3 * 60 * 1000) refresh(true);
  });
  api.onSettingsChanged((settings) => { state.settings = settings; fillSettings(); });
  api.onHotkeyErrors((errors) => { state.hotkeyErrors = errors || {}; renderBinds(); fillSettings(); });

  /* ---------- запуск ---------- */

  (async () => {
    state.platform = await api.platform();
    state.settings = await api.getSettings();
    const stored = await api.getBinds();
    state.binds = stored.binds;
    state.hotkeyErrors = stored.errors || {};
    fillSettings();
    renderBinds();
    state.compact = Boolean(state.settings.compact);
    document.body.classList.toggle("compact", state.compact);
    applyData(await api.cachedData());
    focusSearch();
    state.pun = await api.punishmentsState();
    renderPunishments();
    updateBadge();
    if (!state.settings.userToken) {
      const linked = await api.connectFromClipboard();
      if (linked.ok) { state.settings = await api.getSettings(); fillSettings(); }
    }
    state.upd = await api.updaterState();
    renderUpdate();
    setTimeout(() => startTour(false), 800);
    if (state.settings.serverUrl) refresh(true);
    else { if (state.compact) await setCompact(false); switchTab("settings"); }
  })();
})();
