(() => {
  const box = document.getElementById("box");
  const root = document.documentElement;

  const measure = () => window.hud.size(box.offsetWidth + 2, box.offsetHeight + 2);

  window.hud.onData(({ items, scale, opacity, align }) => {
    root.style.setProperty("--scale", scale);
    root.style.setProperty("--bg", opacity);
    box.className = `box${align === "right" ? " right" : ""}`;
    box.replaceChildren();
    for (const item of items) {
      const row = document.createElement("div");
      row.className = "row";
      row.dataset.id = item.id;
      const key = document.createElement("span");
      key.className = "key";
      key.textContent = item.hotkey.replace(/\+/g, "+");
      const title = document.createElement("span");
      title.className = "title";
      title.textContent = item.title;
      const n = document.createElement("span");
      n.className = "n";
      n.textContent = item.lines > 1 ? `×${item.lines}` : "";
      row.append(key, title, n);
      box.append(row);
    }
    requestAnimationFrame(measure);
  });

  window.hud.onFlash((id) => {
    const row = [...box.children].find((node) => node.dataset.id === id);
    if (!row) return;
    row.classList.add("fire");
    setTimeout(() => row.classList.remove("fire"), 700);
  });
})();
