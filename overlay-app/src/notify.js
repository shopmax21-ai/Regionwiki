(() => {
  const stack = document.getElementById("stack");
  const MAX = 4;
  const cards = new Map(); // id → { node, item, timer }

  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  };
  const kindTone = (kind) => {
    const k = String(kind || "").toLowerCase();
    return k.startsWith("хард") ? "hard" : k.startsWith("бан") ? "ban" : k.startsWith("мут") ? "mute" : "jail";
  };
  const minutes = (iso) => Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  const ago = (iso) => { const m = minutes(iso); return m < 1 ? "только что" : m < 60 ? `${m} мин назад` : `${Math.round(m / 60)} ч назад`; };

  const report = () => requestAnimationFrame(() => window.notify.size(cards.size ? stack.offsetHeight : 0));

  function dismiss(id, instant) {
    const card = cards.get(id);
    if (!card) return;
    cards.delete(id);
    clearTimeout(card.timer);
    if (instant) { card.node.remove(); report(); return; }
    card.node.classList.add("out");
    setTimeout(() => { card.node.remove(); report(); }, 180);
  }

  function arm(id, seconds) {
    const card = cards.get(id);
    if (!card) return;
    card.node.style.setProperty("--life", `${seconds}s`);
    const bar = card.node.querySelector(".bar i");
    if (bar) { bar.style.animation = "none"; void bar.offsetWidth; bar.style.animation = ""; bar.addEventListener("animationend", () => dismiss(id), { once: true }); }
  }

  function button(label, onclick, main) {
    const node = el("button", `b${main ? " main" : ""}`, label);
    node.type = "button";
    node.addEventListener("click", onclick);
    return node;
  }

  function setMsg(node, acts, text, tone) {
    node.querySelector(".msg")?.remove();
    node.insertBefore(el("div", `msg ${tone || ""}`, text), acts);
  }

  /** Следующий шаг по заявке в работе: решение → команда → «Выдал». Кнопки зависят от свежего состояния заявки. */
  function showStep(event, node, acts, assigned, message) {
    const item = event.item;
    node.querySelector(".cmd")?.remove();
    node.querySelector(".note-row")?.remove();
    acts.replaceChildren();
    const open = button("Открыть", () => { window.notify.action("open", item); dismiss(event.id); });
    const run = async (action, doneText, note) => {
      const result = await window.notify.action(action, item, note);
      if (!result?.ok) { setMsg(node, acts, result?.error || "Не удалось выполнить", "err"); report(); return; }
      if (!result.assigned) { // заявка закрыта этим шагом
        node.querySelector(".cmd")?.remove();
        node.querySelector(".note-row")?.remove();
        acts.replaceChildren(open);
        setMsg(node, acts, doneText, "ok");
        arm(event.id, 5);
        report();
        return;
      }
      showStep(event, node, acts, result.assigned, doneText);
    };

    if (!assigned) {
      setMsg(node, acts, message || "Готово", "ok");
      acts.append(open);
    } else if (assigned.needsDecision) {
      setMsg(node, acts, `${message || "Нужно решение"}: одобрить или отклонить?`, "ok");
      const reject = button("Отклонить…", () => {
        if (node.querySelector(".note-row")) return;
        const row = el("div", "note-row");
        const input = el("input", "note");
        input.placeholder = "Причина отказа";
        input.maxLength = 300;
        const confirm = button("Отклонить", () => run("reject", "Заявка отклонена", input.value));
        input.addEventListener("keydown", (e) => { if (e.key === "Enter") confirm.click(); });
        input.addEventListener("blur", () => window.notify.focusable(false));
        row.append(input, confirm);
        node.insertBefore(row, acts);
        window.notify.focusable(true);
        setTimeout(() => input.focus(), 80);
        report();
      });
      acts.append(button("Одобрить", () => run("approve", "Заявка одобрена"), true), reject, open);
    } else if (assigned.command) {
      setMsg(node, acts, assigned.copied ? "Команда скопирована: вставьте её в игру и отметьте выдачу" : (message || "Заявка одобрена"), "ok");
      node.insertBefore(el("code", "cmd", assigned.command), acts);
      if (assigned.copied) {
        acts.append(button("Выдал наказание", () => run("issue", "Наказание выдано"), true), button("Копировать ещё раз", () => run("copycmd", "Скопировано")), open);
      } else {
        acts.append(button("Копировать команду", () => run("copycmd", "Команда скопирована"), true), open);
      }
    } else {
      setMsg(node, acts, `${message || "Заявка в работе"}. Ждёт решения.`, "ok");
      acts.append(open);
    }
    arm(event.id, 60);
    report();
  }

  function build(event) {
    const { item } = event;
    const tone = event.kind === "queue" ? kindTone(item.kind) : event.kind === "summary" ? "sum" : event.tone || "info";
    const node = el("div", `n tone-${tone}`);
    const head = el("div", "head");
    head.append(el("span", "tag", event.kind === "queue" ? "Новая заявка" : event.kind === "mine" ? "Ваша заявка" : event.kind === "update" ? "Обновление" : "Наказания"));
    if (item?.createdAt) head.append(el("span", "ago", ago(item.createdAt)));
    const close = el("button", "x", "×");
    close.type = "button";
    close.title = "Закрыть";
    close.style.marginLeft = item?.createdAt ? "0" : "auto";
    close.addEventListener("click", () => dismiss(event.id));
    head.append(close);
    node.append(head, el("div", "title", event.kind === "queue" ? `№${item.number} · ${item.kind}, ${item.duration}` : event.title));
    if (event.kind === "queue" && item.repeats) node.append(el("div", "repeat", `Повтор: ещё ${item.repeats} ${(n => (n % 10 === 1 && n % 100 !== 11 ? "заявка" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? "заявки" : "заявок"))(item.repeats)} на этот ID`));
    node.append(el("div", "body", event.kind === "queue" ? `ID ${item.staticId} · подал ${item.requester}${item.evidenceCount ? ` · доказательств: ${item.evidenceCount}` : ""}` : event.body));

    if (event.kind === "queue" && item.rules?.length) {
      const rules = el("div", "rules");
      item.rules.forEach((rule) => rules.append(el("span", "rule", rule)));
      node.append(rules);
    }

    const acts = el("div", "acts");
    if (event.kind === "queue") {
      if (event.canClaim) {
        const claim = button("Взять в работу", async () => {
          claim.disabled = true;
          claim.textContent = "Беру…";
          const pending = cards.get(event.id);
          if (pending) pending.busy = true; // пока идёт запрос, обновление очереди не должно убрать карточку
          const result = await window.notify.action("claim", item);
          const card = cards.get(event.id);
          if (!card) return;
          card.busy = false;
          if (result?.ok) {
            card.item = null; // заявка ушла из очереди: карточку ведём сами
            showStep(event, node, acts, result.assigned, `Заявка №${item.number} теперь ваша`);
          } else {
            claim.disabled = false;
            claim.textContent = "Взять в работу";
            setMsg(node, acts, result?.error || "Не удалось взять заявку", "err");
          }
          report();
        }, true);
        acts.append(claim);
      }
      const copy = button("Копировать ID", async () => { await window.notify.action("copy", item); copy.textContent = "Скопировано ✓"; });
      acts.append(copy, button("Открыть", () => { window.notify.action("open", item); dismiss(event.id); }));
    } else if (event.kind === "update") {
      const install = event.action === "install";
      const go = button(install ? "Обновить и перезапустить" : "Скачать", async () => {
        go.disabled = true;
        go.textContent = install ? "Устанавливаю…" : "Скачиваю…";
        const result = await window.notify.action(install ? "update-install" : "update-download");
        if (result?.ok && !install) { dismiss(event.id); return; }
        if (!result?.ok) { go.disabled = false; go.textContent = install ? "Обновить и перезапустить" : "Скачать"; setMsg(node, acts, result?.error || "Не удалось", "err"); report(); }
      }, true);
      acts.append(go, button("Позже", () => dismiss(event.id)));
    } else {
      acts.append(button("Открыть", () => { window.notify.action("open", item); dismiss(event.id); }, true));
    }
    node.append(acts, Object.assign(el("div", "bar"), { innerHTML: "<i></i>" }));
    return node;
  }

  window.notify.onPush((event) => {
    if (event.sound) window.OverlaySounds?.play(event.sound, event.volume);
    if (cards.has(event.id)) dismiss(event.id, true);
    while (cards.size >= MAX) dismiss(cards.keys().next().value, true);
    const node = build(event);
    stack.append(node);
    cards.set(event.id, { node, item: event.item || null, timer: null });
    arm(event.id, event.kind === "queue" ? 30 : event.kind === "update" ? 90 : 10);
    report();
  });

  // Заявку забрал кто-то другой или она закрыта: убираем карточки с кнопкой «Взять»
  window.notify.onResolve((ids) => {
    const alive = new Set(ids);
    for (const [id, card] of [...cards]) if (card.item && !card.busy && !alive.has(card.item.id)) dismiss(id);
  });
})();
