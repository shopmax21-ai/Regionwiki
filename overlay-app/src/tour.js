/* Тур по оверлею: затемнение с подсветкой элемента и карточкой-подсказкой. Шаги описывает вызывающий код. */
(() => {
  let root = null, hole = null, card = null, index = 0, steps = [], done = null;

  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  };

  function close() {
    if (!root) return;
    root.remove();
    root = hole = card = null;
    document.removeEventListener("keydown", onKey, true);
    window.removeEventListener("resize", place);
    const callback = done;
    done = null;
    callback?.();
  }

  const go = (delta) => {
    const next = index + delta;
    if (next < 0) return;
    if (next >= steps.length) { close(); return; }
    index = next;
    render();
  };

  function onKey(event) {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); }
    else if (event.key === "Enter" || event.key === "ArrowRight") { event.preventDefault(); event.stopPropagation(); go(1); }
    else if (event.key === "ArrowLeft") { event.preventDefault(); event.stopPropagation(); go(-1); }
  }

  function mockStar() {
    const box = el("div", "tour-mock");
    const head = el("div", "tm-head");
    head.append(el("span", "tm-ref", "ОП 1.19"), el("span", "tm-where", "Общие правила · Чаты"), el("span", "tm-star", "★"));
    box.append(head, el("div", "tm-text", "Запрещено ограбление игроков без RP-отыгровки и причины."));
    const chips = el("div", "tm-chips");
    chips.append(el("span", "tm-chip", "/jail 30 минут"), el("span", "tm-chip", "Ban 1 день"), el("span", "tm-btn", "В заявку"));
    box.append(chips);
    return box;
  }

  function render() {
    const step = steps[index];
    card.replaceChildren();
    card.append(el("div", "tc-step", `Шаг ${index + 1} из ${steps.length}`), el("h3", "tc-title", step.title), el("p", "tc-text", step.text));
    if (step.mock === "star") card.append(mockStar());
    if (step.keys?.length) {
      const list = el("div", "tc-keys");
      for (const [key, label] of step.keys) {
        const row = el("div", "tc-key");
        row.append(el("kbd", null, key), el("span", null, label));
        list.append(row);
      }
      card.append(list);
    }
    const foot = el("div", "tc-foot");
    const dots = el("div", "tc-dots");
    steps.forEach((_, i) => dots.append(el("i", i === index ? "on" : "")));
    const skip = el("button", "tc-btn ghost", index === steps.length - 1 ? "Закрыть" : "Пропустить");
    skip.addEventListener("click", close);
    const back = el("button", "tc-btn ghost", "Назад");
    back.disabled = index === 0;
    back.addEventListener("click", () => go(-1));
    const next = el("button", "tc-btn main", index === steps.length - 1 ? "Готово" : "Далее");
    next.addEventListener("click", () => go(1));
    foot.append(dots, skip, back, next);
    card.append(foot);
    place();
    next.focus();
  }

  function place() {
    if (!root) return;
    const step = steps[index];
    const target = step.anchor ? document.querySelector(step.anchor) : null;
    const rect = target?.getBoundingClientRect();
    const visible = rect && rect.width > 0 && rect.height > 0;
    const vw = window.innerWidth, vh = window.innerHeight;
    const cw = card.offsetWidth, ch = card.offsetHeight;
    root.classList.toggle("center", !visible);
    if (!visible) {
      hole.style.display = "none";
      card.style.left = `${Math.max(12, (vw - cw) / 2)}px`;
      card.style.top = `${Math.max(12, (vh - ch) / 2)}px`;
      return;
    }
    const pad = 6;
    hole.style.display = "block";
    hole.style.left = `${rect.left - pad}px`;
    hole.style.top = `${rect.top - pad}px`;
    hole.style.width = `${rect.width + pad * 2}px`;
    hole.style.height = `${rect.height + pad * 2}px`;
    let left, top;
    if (step.place === "below") { top = rect.bottom + 16; left = rect.right - cw; }
    else if (step.place === "above") { top = rect.top - ch - 16; left = rect.left + 16; }
    else { left = rect.right + 18; top = rect.top + 10; }
    card.style.left = `${Math.min(Math.max(12, left), vw - cw - 12)}px`;
    card.style.top = `${Math.min(Math.max(12, top), vh - ch - 12)}px`;
  }

  function start(list, onDone) {
    if (root || !list?.length) return;
    steps = list;
    index = 0;
    done = onDone || null;
    root = el("div", "tour");
    hole = el("div", "tour-hole");
    card = el("div", "tour-card");
    card.setAttribute("role", "dialog");
    root.append(hole, card);
    document.body.append(root);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", place);
    render();
  }

  window.OverlayTour = { start, active: () => Boolean(root) };
})();
