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
    $("all-q").placeholder = { rules: "Номер или слова из правила…", replies: "Поиск по ответам…", binder: "Биндер", settings: "Настройки" }[name] || "Поиск по всему…";
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
    const words = window.RuleSearch.normalize(query).split(/\s+/).filter(Boolean).map(window.RuleSearch.stem);
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
      const { normalize, stem } = window.RuleSearch;
      const words = normalize(query).split(/\s+/).filter(Boolean).map(stem);
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

  $("c-history").addEventListener("click", () => showHistory($("c-list"), $("c-q"), compactSearch, () => requestAnimationFrame(fitCompact)));
  $("history").addEventListener("click", () => {
    if (state.tab !== "all") switchTab("all");
    $("all-q").value = "";
    showHistory($("all-list"), $("all-q"), allSearch, () => $("tab-all").classList.add("has-results"));
  });

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
  $("collapse").addEventListener("click", () => setCompact(true));
  $("c-expand").addEventListener("click", () => setCompact(false));

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
    $("set-url").value = s.serverUrl || "";
    $("set-token").value = s.token || "";
    $("set-hotkey").value = s.hotkey || "";
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
    $("pin").setAttribute("aria-pressed", String(Boolean(s.alwaysOnTop)));
    renderHome();
    const err = state.hotkeyErrors.toggle;
    $("settings-msg").textContent = err ? `Клавиша оверлея не назначена: ${err}` : "";
  }

  async function patchSettings(patch) {
    const { settings, errors } = await api.setSettings(patch);
    state.settings = settings;
    state.hotkeyErrors = errors || {};
    fillSettings();
    renderBinds();
  }

  hotkeyField($("set-hotkey"), (value) => value && patchSettings({ hotkey: value }));
  $("set-url").addEventListener("change", (event) => patchSettings({ serverUrl: event.target.value.trim() }).then(refresh));
  $("set-token").addEventListener("change", (event) => patchSettings({ token: event.target.value.trim() }).then(refresh));
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
  $("set-hide").addEventListener("change", (event) => patchSettings({ hideOnCopy: event.target.checked }));
  $("set-paste").addEventListener("change", (event) => patchSettings({ pasteOnCopy: event.target.checked }));
  $("set-chat").addEventListener("change", (event) => patchSettings({ openChatKey: event.target.value.trim() }));
  $("set-delay").addEventListener("change", (event) => patchSettings({ lineDelay: Number(event.target.value) || 700 }));
  $("pin").addEventListener("click", () => patchSettings({ alwaysOnTop: !state.settings.alwaysOnTop }));
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
      el("div", { class: "nav-row" },
        linkCard("i-shield", "Правила", rules.length ? `${rules.length} ${plural(rules.length, "пункт", "пункта", "пунктов")}, ${tags.size} ${plural(tags.size, "раздел", "раздела", "разделов")}` : "нет данных", "rules"),
        linkCard("i-msg", "Ответы", replies.length ? `${replies.length} ${plural(replies.length, "шаблон", "шаблона", "шаблонов")}` : "нет данных", "replies"),
        linkCard("i-keys", "Биндер", `${state.binds.length} ${plural(state.binds.length, "бинд", "бинда", "биндов")}`, "binder"),
      ),
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

  async function refresh() {
    const button = $("refresh");
    button.classList.add("spin");
    const result = await api.refreshData();
    button.classList.remove("spin");
    if (result.ok) {
      applyData(result.data);
      toast(`Обновлено: ${result.data.rules.length} пунктов`);
    } else {
      toast(result.error, true);
    }
  }
  $("refresh").addEventListener("click", refresh);

  document.querySelectorAll(".top [data-tab]").forEach((button) =>
    button.addEventListener("click", () => switchTab(state.tab === button.dataset.tab ? "all" : button.dataset.tab)),
  );

  document.addEventListener("keydown", (event) => {
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

  api.onShown(() => focusSearch());
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
    if (state.settings.serverUrl) refresh();
    else { if (state.compact) await setCompact(false); switchTab("settings"); }
  })();
})();
