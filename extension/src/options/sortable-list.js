// ドラッグ＆ドロップ / ↑↓ボタンで並べ替えでき、スイッチで表示を切り替えられるリスト
(() => {
  const ICON_GRIP =
    '<svg width="12" height="18" viewBox="0 0 12 18" aria-hidden="true"><g fill="currentColor"><circle cx="3" cy="3" r="1.6"/><circle cx="9" cy="3" r="1.6"/><circle cx="3" cy="9" r="1.6"/><circle cx="9" cy="9" r="1.6"/><circle cx="3" cy="15" r="1.6"/><circle cx="9" cy="15" r="1.6"/></g></svg>';
  const ICON_UP = '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 7l-7 7 1.4 1.4L12 9.8l5.6 5.6L19 14z"/></svg>';
  const ICON_DOWN = '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 17l7-7-1.4-1.4L12 14.2 6.4 8.6 5 10z"/></svg>';

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === false) continue;
      if (k === "class") node.className = v;
      else if (k === "html") node.innerHTML = v;
      else if (k === "text") node.textContent = v;
      else node.setAttribute(k, v === true ? "" : v);
    }
    for (const c of children) if (c) node.append(c);
    return node;
  }

  // HTML5 の Drag and Drop ではなく Pointer Events で実装する（行がカーソルに追従し、Esc で取り消せる）
  function attachPointerDrag(ul, li, fromIndex, move) {
    li.addEventListener("pointerdown", (down) => {
      if (down.button !== 0 || down.target.closest("button, label, input")) return;
      const startY = down.clientY;
      let dragging = false;
      let target = null;
      let scrollTimer = 0;
      let lastY = startY;

      let others = [];
      let mids = [];
      let shift = 0;
      // ドラッグ開始時点の位置（ページ座標）で判定し、他の行は transform でずらして隙間を作る
      const findTarget = (pageY) => {
        const i = mids.findIndex((m) => pageY < m);
        return { index: i === -1 ? others.length : i };
      };
      const paint = (y) => {
        li.style.transform = `translateY(${y - startY + (window.scrollY - scrollStart)}px)`;
        target = findTarget(y + window.scrollY);
        others.forEach((node, i) => {
          const original = i < fromIndex ? i : i + 1;
          const final = i < target.index ? i : i + 1;
          node.style.transform = final === original ? "" : `translateY(${(final - original) * shift}px)`;
        });
      };
      const scrollStart = window.scrollY;
      const autoScroll = () => {
        const edge = 60;
        const dy = lastY < edge ? -12 : lastY > window.innerHeight - edge ? 12 : 0;
        if (dy) {
          window.scrollBy(0, dy);
          paint(lastY);
        }
      };

      const onMove = (e) => {
        lastY = e.clientY;
        if (!dragging) {
          if (Math.abs(e.clientY - startY) < 5) return;
          dragging = true;
          others = [...ul.children].filter((n) => n !== li);
          mids = others.map((n) => {
            const r = n.getBoundingClientRect();
            return r.top + window.scrollY + r.height / 2;
          });
          shift = li.getBoundingClientRect().height + parseFloat(getComputedStyle(ul).rowGap || "0");
          ul.classList.add("is-sorting");
          li.setPointerCapture(down.pointerId);
          li.classList.add("is-dragging");
          document.body.classList.add("is-sorting");
          scrollTimer = setInterval(autoScroll, 30);
        }
        e.preventDefault();
        paint(e.clientY);
      };
      const finish = (commit) => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onCancel);
        window.removeEventListener("keydown", onKey, true);
        clearInterval(scrollTimer);
        if (!dragging) return;
        li.dataset.justDragged = "1";
        setTimeout(() => delete li.dataset.justDragged, 0);
        li.classList.remove("is-dragging");
        ul.classList.remove("is-sorting");
        for (const n of ul.children) n.style.transform = "";
        document.body.classList.remove("is-sorting");
        if (commit && target) move(fromIndex, target.index);
      };
      const onUp = () => finish(true);
      const onCancel = () => finish(false);
      const onKey = (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          finish(false);
        }
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onCancel);
      window.addEventListener("keydown", onKey, true);
    });
  }

  /**
   * @param {HTMLUListElement} ul
   * @param {Array<{key:string,label:string,sub?:string,tag?:string,kind?:string,hidden?:boolean,selected?:boolean,drill?:string,sortable?:boolean}>} rows
   * @param {{onReorder?:(keys:string[])=>void,onToggle?:(key:string,visible:boolean)=>void,onDrill?:(key:string)=>void,onSelect?:(key:string)=>void}} handlers
   */
  function render(ul, rows, handlers) {
    const focusKey = ul.contains(document.activeElement) ? document.activeElement.closest("[data-key]")?.dataset.key : null;
    const focusRole = document.activeElement?.dataset?.role;
    ul.replaceChildren();
    const keys = rows.map((r) => r.key);
    const move = (from, to) => {
      if (to < 0 || to >= keys.length || from === to) return;
      const next = [...keys];
      const [k] = next.splice(from, 1);
      next.splice(to, 0, k);
      handlers.onReorder?.(next);
    };

    rows.forEach((row, index) => {
      const sortable = row.sortable !== false && Boolean(handlers.onReorder);
      const isSep = row.kind === "separator";
      const label = el("span", { class: "item-label", title: row.label }, [
        document.createTextNode(row.label),
        row.sub ? el("span", { class: "item-sub", text: row.sub }) : null,
      ]);
      const toggle = handlers.onToggle
        ? el("label", { class: "switch", title: row.hidden ? "非表示中（クリックで表示）" : "表示中（クリックで非表示）" }, [
            el("input", {
              type: "checkbox",
              checked: !row.hidden,
              "data-role": "toggle",
              "aria-label": `${row.label}を表示`,
            }),
            el("span"),
          ])
        : null;
      toggle?.querySelector("input").addEventListener("change", (e) => handlers.onToggle(row.key, e.target.checked));

      const up = sortable
        ? el("button", { class: "icon-btn", type: "button", html: ICON_UP, title: "上へ", "aria-label": `${row.label}を上へ`, "data-role": "up", disabled: index === 0 })
        : null;
      const down = sortable
        ? el("button", {
            class: "icon-btn",
            type: "button",
            html: ICON_DOWN,
            title: "下へ",
            "aria-label": `${row.label}を下へ`,
            "data-role": "down",
            disabled: index === rows.length - 1,
          })
        : null;
      up?.addEventListener("click", () => move(index, index - 1));
      down?.addEventListener("click", () => move(index, index + 1));

      const drill = row.drill
        ? el("button", { class: "btn drill", type: "button", text: row.drill, "data-role": "drill" })
        : null;
      drill?.addEventListener("click", (e) => {
        e.stopPropagation();
        handlers.onDrill?.(row.key);
      });

      const li = el(
        "li",
        {
          class: ["item", isSep && "is-separator", row.hidden && "is-hidden", row.selected && "is-selected"].filter(Boolean).join(" "),
          "data-key": row.key,
          "data-sortable": sortable ? "true" : undefined,
        },
        [
          sortable ? el("span", { class: "handle", html: ICON_GRIP, title: "ドラッグして並べ替え" }) : null,
          label,
          row.tag ? el("span", { class: "tag", text: row.tag }) : null,
          el("span", { class: "item-actions" }, [drill, up, down, toggle]),
        ],
      );

      li.addEventListener("click", (e) => {
        if (li.dataset.justDragged) {
          delete li.dataset.justDragged;
          return;
        }
        if (!handlers.onSelect || e.target.closest("button, label, input")) return;
        handlers.onSelect(row.key);
      });
      if (handlers.onSelect) li.style.cursor = "pointer";
      if (sortable) attachPointerDrag(ul, li, index, move);
      ul.append(li);
    });

    if (focusKey) {
      const li = [...ul.children].find((n) => n.dataset.key === focusKey);
      const target = li?.querySelector(`[data-role="${focusRole}"]:not(:disabled)`) ?? li?.querySelector("button:not(:disabled), input");
      target?.focus();
    }
  }

  globalThis.SortableList = { render };
})();
