(() => {
  const api = window.overlay;
  const { buildIndex, search, highlightPattern, ruleRef } = window.RuleSearch;
  const $ = (id) => document.getElementById(id);

  const state = {
    settings: {},
    data: { rules: [], replies: [], repliesLocked: true, fetchedAt: null },
    index: [],
    binds: [],
    hotkeyErrors: {},
    pun: { configured: false, data: null, error: null, badge: 0 },
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
    focusSearch();
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

  function ruleCard(rule, pattern, index, onChange) {
    const ref = ruleRef(rule);
    const card = el("div", { class: "card", "data-index": index, tabindex: "-1" });
    card.append(
      el("div", { class: "card-head" },
        el("span", { class: "ref", text: ref }),
        el("span", { class: "where", text: `${rule.article} · ${rule.section}` }),
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
      list.append(el("div", { class: "empty", text: "Правила ещё не загружены. Откройте «Настройки», укажите адрес сайта и нажмите ⟳." }));
      state.results = [];
      return;
    }
    if (!query && !state.articleFilter) {
      state.results = [];
      list.append(el("div", { class: "empty", text: "Введите номер пункта (ОП 1.19) или слова из правила: ограбление, баг, пробив." }));
      return;
    }
    let hits = query
      ? search(state.index, query, 80)
      : state.data.rules.filter((rule) => (rule.tag || rule.article) === state.articleFilter).map((rule) => ({ rule }));
    if (state.articleFilter) hits = hits.filter((hit) => (hit.rule.tag || hit.rule.article) === state.articleFilter);
    hits = hits.slice(0, query ? 40 : 120);
    state.results = hits;
    if (!hits.length) {
      list.append(el("div", { class: "empty", text: "Ничего не найдено. Попробуйте другое слово или номер." }));
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
      list.append(el("div", { class: "empty", text: "Показаны встроенные ответы. Чтобы получить ответы с сайта, укажите токен оверлея в настройках." }));
    }
    if (!replies.length) {
      list.append(el("div", { class: "empty", text: "Ответов не найдено." }));
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
        if (empty) list.append(el("div", { class: "empty", text: empty }));
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
              el("div", { class: "bind-sub", text: `${lines.length} стр. · ${lines[0] || ""}` }),
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
      if (!ctx.actions.length) list.append(el("div", { class: "empty", text: "Ничего не найдено." }));
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
    api.setCompactHeight(list.children.length ? Math.min(list.scrollHeight + 2, 520) : 0);
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
    if (!history.length) list.append(el("div", { class: "empty", text: "История пока пуста." }));
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
    else allSearch.render();
    focusSearch();
  }

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
      { icon: "i-pin", label: "Поверх всех окон", toggle: Boolean(s.alwaysOnTop), run: () => patchSettings({ alwaysOnTop: !s.alwaysOnTop }), keep: true },
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
      list.append(el("div", { class: "empty", text: "Биндов пока нет. Нажмите «+ Бинд»: клавиша, которую вы назначите, будет отправлять строки в чат игры." }));
      return;
    }
    for (const bind of state.binds) {
      const lines = String(bind.text || "").split(/\r?\n/).filter(Boolean);
      const err = state.hotkeyErrors[bind.id];
      const row = el("div", { class: "card bind" },
        el("div", { class: "bind-main" },
          el("div", { class: "bind-title", text: bind.title }),
          el("div", { class: "bind-sub", text: `${lines.length} стр. · ${lines[0] || ""}` }),
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
    state.editing = bind ? { ...bind } : { id: newId(), title: "", hotkey: "", text: "", openKey: "", delay: "", hint: true };
    form.title.value = state.editing.title;
    form.hotkey.value = state.editing.hotkey || "";
    form.hint.checked = state.editing.hint !== false;
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
    $("set-hide").checked = Boolean(s.hideOnCopy);
    $("set-paste").checked = Boolean(s.pasteOnCopy);
    $("set-chat").value = s.openChatKey || "";
    $("set-delay").value = s.lineDelay || 700;
    $("set-lock").checked = Boolean(s.lockWindow);
    $("set-hud-lock").checked = s.hudLocked !== false;
    document.body.classList.toggle("locked", Boolean(s.lockWindow));
    if (menuOpen()) renderMenu();
    renderHome();
    const err = state.hotkeyErrors.toggle;
    const searchErr = state.hotkeyErrors.search;
    $("settings-msg").textContent = err ? `Клавиша оверлея не назначена: ${err}` : searchErr ? `Клавиша поиска не назначена: ${searchErr}` : "";
  }

  async function patchSettings(patch) {
    const { settings, errors } = await api.setSettings(patch);
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
  $("set-lock").addEventListener("change", (event) => patchSettings({ lockWindow: event.target.checked }));
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
  const ago = (iso) => {
    const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (minutes < 1) return "только что";
    if (minutes < 60) return `${minutes} мин назад`;
    const hours = Math.round(minutes / 60);
    return hours < 24 ? `${hours} ч назад` : `${Math.round(hours / 24)} дн. назад`;
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

  function punHead(item) {
    return el("div", { class: "pun-head-row" },
      el("div", { class: "pun-title" }, el("b", { text: `№${item.number}` }), el("span", { text: `${item.kind}, ${item.duration}` })),
      el("div", { class: "pun-sub", text: `ID ${item.staticId} · ${item.requester} · ${ago(item.createdAt)}` }),
    );
  }

  function queueCard(item) {
    return el("div", { class: "card pun-card" },
      punHead(item),
      el("div", { class: "pun-rules", text: item.rules.join(", ") || "—" }),
      item.evidenceCount > 0 ? el("div", { class: "pun-meta", text: `Доказательства: ${item.evidenceCount}. Увидите после того, как возьмёте заявку.` }) : el("div", { class: "pun-meta", text: "Без доказательств" }),
      el("div", { class: "pun-actions" }, el("button", { class: "btn sm", onclick: () => punAct({ id: item.id, action: "claim" }, `Заявка №${item.number} ваша`), text: "Взять в работу" })),
    );
  }

  function assignedCard(item) {
    const ui = state.punUi;
    const forumInput = el("input", { class: "pun-forum", placeholder: "Жалоба на форуме (по желанию)", value: item.forum || "", maxlength: "60" });
    const children = [punHead(item), el("div", { class: "pun-rules", text: item.rules.join(", ") || "—" })];

    if (item.evidence.length) {
      children.push(el("div", { class: "pun-evidence" }, item.evidence.map((entry, index) =>
        el("button", { class: "chip", title: entry.url, onclick: () => api.openExternal(absUrl(entry.url)), text: `${entry.type === "image" ? "Скрин" : "Ссылка"} ${index + 1}` }),
      )));
    }

    children.push(el("div", { class: "pun-forum-row" }, forumInput,
      el("button", { class: "btn ghost sm", onclick: () => punAct({ id: item.id, action: "forum", forum: forumInput.value }, "Жалоба сохранена"), text: "Сохранить" })));

    if (item.needsDecision) {
      const noteInput = el("input", { class: "pun-note", placeholder: "Причина отказа", maxlength: "300" });
      const noteRow = el("div", { class: "pun-forum-row", hidden: !ui.rejecting.has(item.id) }, noteInput,
        el("button", { class: "btn danger sm", onclick: () => punAct({ id: item.id, action: "reject", note: noteInput.value }, "Заявка отклонена"), text: "Отклонить" }));
      children.push(el("div", { class: "pun-actions" },
        el("button", { class: "btn sm", onclick: () => punAct({ id: item.id, action: "approve" }, "Заявка одобрена"), text: "Одобрить" }),
        el("button", { class: "btn ghost sm", onclick: () => { ui.rejecting.has(item.id) ? ui.rejecting.delete(item.id) : ui.rejecting.add(item.id); noteRow.hidden = !ui.rejecting.has(item.id); if (!noteRow.hidden) noteInput.focus(); }, text: "Отклонить…" }),
      ), noteRow);
    }

    if (item.command) {
      children.push(el("div", { class: "pun-command" },
        el("code", { text: item.command }),
        el("button", { class: "btn ghost sm", onclick: async () => {
          await api.copy(item.command, { paste: false, hide: false });
          toast("Команда скопирована");
          if (!item.copied) punAct({ id: item.id, action: "copied" });
        }, text: "Копировать" }),
      ));
      children.push(el("div", { class: "pun-actions" },
        el("button", { class: "btn sm", disabled: !item.copied, title: item.copied ? "" : "Сначала скопируйте команду", onclick: () => punAct({ id: item.id, action: "issue" }, `Наказание по заявке №${item.number} выдано`), text: "Выдал наказание" }),
      ));
    }

    children.push(el("div", { class: "pun-actions" }, el("button", { class: "btn ghost sm", onclick: () => punAct({ id: item.id, action: "release" }, "Заявка вернулась в очередь"), text: "Вернуть в очередь" })));
    return el("div", { class: "card pun-card" }, children);
  }

  function mineRow(item) {
    return el("div", { class: "card pun-card slim" },
      el("div", { class: "pun-head-row" },
        el("div", { class: "pun-title" }, el("b", { text: `№${item.number}` }), el("span", { text: `${item.kind}, ${item.duration}` })),
        el("span", { class: `pun-status ${item.status}`, text: STATUS_TEXT[item.status] || item.status }),
      ),
      el("div", { class: "pun-sub", text: `ID ${item.staticId} · ${ago(item.createdAt)}${item.status === "rejected" && item.decisionNote ? ` · ${item.decisionNote}` : ""}` }),
    );
  }

  function punSection(title, nodes, emptyText) {
    return el("section", { class: "pun-section" }, el("h3", { text: title }), nodes.length ? nodes : el("div", { class: "empty", text: emptyText }));
  }

  function updateBadge() {
    document.querySelectorAll("[data-menu]").forEach((button) => button.classList.toggle("dot", state.pun.badge > 0));
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

  /** Перерисовка по действию пользователя (форма, кнопки): фокус возвращается в то же поле. */
  function paintPunishments(focusId) {
    const root = $("pun");
    if (!root) return;
    const keep = focusId || document.activeElement?.dataset?.id;
    const p = state.pun;
    const parts = [];
    if (!p.configured) {
      parts.push(el("div", { class: "pun-setup" },
        el("h3", { text: "Наказания в оверлее" }),
        el("p", { text: "Чтобы получать уведомления о новых заявках и закрывать их прямо из игры, подключите личный токен. Создайте его на странице «Оверлей» сайта (раздел «Наказания в оверлее»), скопируйте код подключения и откройте оверлей, либо вставьте токен вручную в настройках." }),
        el("button", { class: "btn sm", onclick: () => switchTab("settings"), text: "Открыть настройки" }),
      ));
    } else {
      if (p.error) parts.push(el("div", { class: "pun-error", text: p.error }));
      if (p.data) {
        const { me, queue, assigned, mine } = p.data;
        const formOpen = Boolean(state.punForm);
        parts.push(el("div", { class: "pun-top" }, el("h2", { text: "Наказания" }),
          el("div", { class: "pun-top-actions" },
            me.canRequest ? el("button", { class: formOpen ? "btn ghost sm" : "btn sm", onclick: () => { state.punForm = formOpen ? null : newPunForm(); paintPunishments("static"); }, text: formOpen ? "Закрыть форму" : "Новая заявка" }) : null,
            el("button", { class: "btn ghost sm", onclick: () => api.punishmentsRefresh(), text: "Обновить" }),
          ),
        ));
        if (formOpen && me.canRequest) parts.push(punFormNode());
        if (me.canReview) {
          parts.push(punSection("В работе у меня", assigned.map(assignedCard), "Вы пока не взяли ни одной заявки"));
          parts.push(punSection("Очередь", queue.map(queueCard), "Очередь пуста"));
        }
        if (me.canRequest) parts.push(punSection("Мои заявки", mine.slice(0, 10).map(mineRow), "Вы ещё не подавали заявок"));
        if (!me.canReview && !me.canRequest) parts.push(el("div", { class: "empty", text: "У вашей роли нет доступа к наказаниям. Права настраиваются в разделе «Роли и права» на сайте." }));
      } else if (!p.error) {
        parts.push(el("div", { class: "empty", text: "Загружаю…" }));
      }
    }
    root.replaceChildren(...parts);
    if (keep) root.querySelector(`[data-id="${keep}"]`)?.focus();
  }

  /* ----- форма новой заявки ----- */

  const KIND_OPTIONS = [["jail", "Деморган"], ["mute", "Мут"], ["ban", "Бан"], ["hardban", "Хардбан"]];
  const RULE_LABEL = /^([A-Za-zА-Яа-яЁё]{1,10})\s*(\d{1,3}(?:\.\d{1,3}){0,3})$/;
  const normalizeLabel = (value) => { const m = RULE_LABEL.exec(String(value).trim()); return m ? `${m[1].toUpperCase()} ${m[2]}` : null; };
  const LIMITS = { staticDigits: 9, minutes: 10000, days: 3650, rules: 5, evidence: 6 };

  const newPunForm = () => ({ staticId: "", kind: "jail", muteChannel: "chat", duration: "", rules: [], ruleQuery: "", forum: "", evidence: [], linkDraft: "", uploading: 0, busy: false, error: "" });
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

    const node = el("div", { class: "card pun-form" },
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
        el("button", { type: "button", class: "btn ghost", onclick: () => { state.punForm = null; paintPunishments(); }, text: "Отмена" }),
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
  api.onPunishments((payload) => {
    state.pun = payload;
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

    const linkCard = (name, title, sub, tab) =>
      el("button", { class: "linkcard", onclick: () => switchTab(tab) },
        el("span", { class: "lc-ico" }, icon(name)),
        el("span", { class: "lc-text" }, el("b", { text: title }), el("small", { text: sub })),
        icon("i-right", "ico chev"),
      );

    const chip = (name, label, onclick, title) => el("button", { class: "pchip", title: title || "", onclick }, icon(name), label);

    const category = (title, art, chips) =>
      el("section", { class: "cat" }, el("h2", { text: title }), el("div", { class: "pchips" }, chips), el("span", { class: "art", "aria-hidden": "true" }, icon(art, "art-svg")));

    const ruleChips = rules.length
      ? [...tags].slice(0, 8).map(([key, article]) => chip("i-shield", key, () => goRules(key), article))
      : [chip("i-sliders", "Подключить сайт", () => switchTab("settings"))];
    const replyChips = replies.length
      ? cats.slice(0, 8).map((cat) => chip("i-msg", cat, () => goReplies(cat)))
      : [chip("i-sliders", "Подключить сайт", () => switchTab("settings"))];
    const bindChips = state.binds.slice(0, 6).map((bind) => chip("i-keys", bind.title || "Без названия", () => runBindFromUi(bind), `${bind.hotkey || "без клавиши"}: отправить в игру`));
    bindChips.push(chip("i-plus", "Новый бинд", () => { switchTab("binder"); openBindForm(null); }));
    const screenChips = [
      chip("i-monitor", state.settings.hud ? "Подсказки: вкл" : "Подсказки: выкл", () => patchSettings({ hud: !state.settings.hud }), "Список биндов поверх игры"),
      chip("i-pin", state.settings.alwaysOnTop ? "Поверх игры: вкл" : "Поверх игры: выкл", () => patchSettings({ alwaysOnTop: !state.settings.alwaysOnTop })),
      chip("i-move", state.settings.hudLocked === false ? "Подсказки: двигаю" : "Двигать подсказки", () => patchSettings({ hudLocked: state.settings.hudLocked === false, hud: true }), "Перетащите подсказки мышью и нажмите «Зафиксировать»"),
      chip("i-shrink", "Свернуть", () => setCompact(true), "Ctrl+M"),
      chip("i-sliders", "Настройки", () => switchTab("settings")),
    ];

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
      el("div", { class: "nav-row" }, [
        linkCard("i-shield", "Правила", rules.length ? `${rules.length} ${plural(rules.length, "пункт", "пункта", "пунктов")}, ${tags.size} ${plural(tags.size, "раздел", "раздела", "разделов")}` : "нет данных", "rules"),
        linkCard("i-msg", "Ответы", replies.length ? `${replies.length} ${plural(replies.length, "шаблон", "шаблона", "шаблонов")}` : "нет данных", "replies"),
        linkCard("i-keys", "Биндер", `${state.binds.length} ${plural(state.binds.length, "бинд", "бинда", "биндов")}`, "binder"),
        state.pun.data ? linkCard("i-alert", "Наказания", punSummary(), "punishments") : null,
      ].filter(Boolean)),
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
    if (event.key === "Escape" && menuOpen()) { closeMenu(); return; }
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
    } else if (event.ctrlKey && /^[1-5]$/.test(event.key)) {
      switchTab(["all", "rules", "replies", "binder", "settings"][Number(event.key) - 1]);
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
    if (state.settings.serverUrl) refresh(true);
    else { if (state.compact) await setCompact(false); switchTab("settings"); }
  })();
})();
