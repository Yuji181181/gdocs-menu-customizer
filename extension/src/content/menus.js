// おまけ機能：上段のメニューバー（ファイル・編集…）と、そのドロップダウン項目の並べ替え・非表示
(() => {
  const cs = globalThis.GDMC_CS;
  if (!cs) return;

  const { SUBMENU_SEP, mergeOrder } = globalThis.GDMC;
  const ATTR_MENU = "data-gdmc-menu";
  const ATTR_ORDERED = "data-gdmc-ordered";

  // ---------------------------------------------------------------- ドロップダウン項目

  const isSeparator = (el) => el.getAttribute("role") === "separator" || el.classList.contains("goog-menuseparator");

  function textWithout(node, skipSelector) {
    let text = "";
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) text += child.textContent;
      else if (child.nodeType === Node.ELEMENT_NODE && !child.matches(skipSelector)) text += textWithout(child, skipSelector);
    }
    return text;
  }

  function itemLabel(el) {
    const skip = ".goog-menuitem-mnemonic-separator, .goog-menuitem-accel, .goog-submenu-arrow, .goog-menuitem-icon";
    const labelEl = el.querySelector(".goog-menuitem-label") ?? el.querySelector(".goog-menuitem-content") ?? el;
    return textWithout(labelEl, skip)
      .replace(/\s+/g, " ")
      .replace(/\s*\([A-Z0-9]\)$/i, "")
      .trim();
  }

  // メニュー要素の子を、設定キー付きの項目一覧にする（ラベル重複は #2, #3… で区別）
  function collectItems(menuEl) {
    const seen = new Map();
    let sepCount = 0;
    let otherCount = 0;
    return [...menuEl.children].map((el) => {
      if (isSeparator(el)) {
        sepCount++;
        return { el, key: `__sep__${sepCount}`, label: "", kind: "separator" };
      }
      const label = itemLabel(el);
      if (!label) {
        otherCount++;
        return { el, key: `__other__${otherCount}`, label: "", kind: "other" };
      }
      const n = (seen.get(label) ?? 0) + 1;
      seen.set(label, n);
      return {
        el,
        key: n === 1 ? label : `${label}#${n}`,
        label,
        kind: el.classList.contains("goog-submenu") ? "submenu" : "item",
      };
    });
  }

  const isMenuVisible = (menuEl) => menuEl.style.display !== "none" && menuEl.isConnected;

  function collapseSeparators(ordered) {
    let pendingSep = null;
    let seenVisible = false;
    for (const it of ordered) {
      if (it.kind === "separator") {
        it.el.classList.add("gdmc-sep-collapsed");
        if (seenVisible && !pendingSep) pendingSep = it;
        continue;
      }
      const visible = !it.el.classList.contains("gdmc-hidden") && it.el.style.display !== "none";
      if (!visible) continue;
      if (pendingSep) {
        pendingSep.el.classList.remove("gdmc-sep-collapsed");
        pendingSep = null;
      }
      seenVisible = true;
    }
  }

  function applyMenu(menuEl) {
    const key = menuEl.getAttribute(ATTR_MENU);
    if (!key) return [];
    const cfg = cs.settings.menus[key];
    const items = collectItems(menuEl);
    const hidden = new Set(cfg?.hidden ?? []);
    for (const it of items) it.el.classList.toggle("gdmc-hidden", hidden.has(it.key));

    const hasOrder = Boolean(cfg?.order?.length);
    menuEl.toggleAttribute(ATTR_ORDERED, hasOrder);
    let ordered = items;
    if (hasOrder) {
      const order = mergeOrder(
        items.map((it) => it.key),
        cfg.order,
      );
      const pos = new Map(order.map((k, i) => [k, i]));
      for (const it of items) it.el.style.setProperty("order", String(pos.get(it.key)));
      ordered = [...items].sort((a, b) => pos.get(a.key) - pos.get(b.key));
    } else {
      for (const it of items) it.el.style.removeProperty("order");
    }

    if (cfg) collapseSeparators(ordered);
    else for (const it of items) it.el.classList.remove("gdmc-sep-collapsed");
    return items;
  }

  // ---------------------------------------------------------------- メニューバー

  const getMenubar = () => document.getElementById("docs-menubar");
  const menubarButtons = (bar) => [...bar.children].filter((el) => el.id && el.id !== "docs-debug-menu");

  function applyMenubar() {
    const bar = getMenubar();
    if (!bar) return;
    const buttons = menubarButtons(bar);
    const { hidden: hiddenList, order: orderList } = cs.settings.menubar;
    const hidden = new Set(hiddenList);
    for (const b of buttons) b.classList.toggle("gdmc-hidden", hidden.has(b.id));

    const hasOrder = orderList.length > 0;
    bar.toggleAttribute(ATTR_ORDERED, hasOrder);
    if (hasOrder) {
      const order = mergeOrder(
        buttons.map((b) => b.id),
        orderList,
      );
      buttons.forEach((b) => b.style.setProperty("order", String(order.indexOf(b.id))));
    } else {
      buttons.forEach((b) => b.style.removeProperty("order"));
    }
  }

  // ---------------------------------------------------------------- カタログ

  function recordMenu(menuEl, items) {
    const key = menuEl.getAttribute(ATTR_MENU);
    cs.updateCatalog({
      menus: {
        [key]: {
          label: menuEl.dataset.gdmcLabel ?? key,
          items: items
            .filter((it) => it.kind !== "other")
            .map((it) => ({
              key: it.key,
              label: it.label,
              kind: it.kind,
              ...(it.el.style.display === "none" ? { docsHidden: true } : {}),
            })),
        },
      },
    });
  }

  function recordMenubar() {
    const bar = getMenubar();
    if (!bar) return;
    cs.updateCatalog({
      menubar: menubarButtons(bar).map((b) => ({
        id: b.id,
        label: (b.textContent ?? "").trim(),
        ...(b.classList.contains("goog-control-disabled") ? { docsHidden: true } : {}),
      })),
    });
  }

  // ---------------------------------------------------------------- メニューの検出

  const observedMenus = new WeakSet();
  const menuStyleObserver = new MutationObserver((records) => {
    const touched = new Set(records.map((r) => r.target));
    for (const menuEl of touched) if (isMenuVisible(menuEl)) onMenuShown(menuEl);
  });

  function watchMenu(menuEl) {
    if (observedMenus.has(menuEl)) return;
    observedMenus.add(menuEl);
    menuStyleObserver.observe(menuEl, { attributes: true, attributeFilter: ["style"] });
  }

  function tagMenu(menuEl, key, label) {
    menuEl.setAttribute(ATTR_MENU, key);
    menuEl.dataset.gdmcLabel = label;
  }

  // 読み込み直後は、メニューバーのボタン順とプライマリメニューの DOM 順が一致するのでそれで対応付ける。
  // 実際に開かれたときに aria-expanded で再確認して上書きする。
  function mapPrimaryMenus() {
    const bar = getMenubar();
    if (!bar) return;
    const buttons = [...bar.children].filter((el) => el.id);
    const primaries = [...document.querySelectorAll("body > .goog-menu.shell-primary-menu")];
    primaries.forEach(watchMenu);
    if (primaries.length !== buttons.length) return;
    primaries.forEach((menuEl, i) => {
      if (menuEl.hasAttribute(ATTR_MENU)) return;
      const b = buttons[i];
      if (b.id === "docs-debug-menu") return;
      tagMenu(menuEl, b.id, (b.textContent ?? "").trim());
    });
  }

  function findSubmenuParent(menuEl) {
    const candidates = document.querySelectorAll(`.goog-menu[${ATTR_MENU}] > .goog-submenu`);
    let highlighted = null;
    for (const item of candidates) {
      const parentMenu = item.parentElement;
      if (parentMenu === menuEl || !isMenuVisible(parentMenu)) continue;
      if (item.classList.contains("goog-submenu-open") || item.getAttribute("aria-expanded") === "true") return item;
      if (item.classList.contains("goog-menuitem-highlight")) highlighted = item;
    }
    return highlighted;
  }

  function onMenuShown(menuEl) {
    if (menuEl.classList.contains("shell-primary-menu")) {
      const btn = document.querySelector('#docs-menubar > [aria-expanded="true"]');
      if (btn && menuEl.getAttribute(ATTR_MENU) !== btn.id) tagMenu(menuEl, btn.id, (btn.textContent ?? "").trim());
    } else {
      const parentItem = findSubmenuParent(menuEl);
      if (!parentItem) return;
      const parentMenu = parentItem.parentElement;
      const parentKey = collectItems(parentMenu).find((it) => it.el === parentItem)?.key;
      if (!parentKey) return;
      tagMenu(
        menuEl,
        parentMenu.getAttribute(ATTR_MENU) + SUBMENU_SEP + parentKey,
        (parentMenu.dataset.gdmcLabel ?? "") + SUBMENU_SEP + itemLabel(parentItem),
      );
    }
    if (!menuEl.hasAttribute(ATTR_MENU)) return;
    recordMenu(menuEl, applyMenu(menuEl));
  }

  function applyAll() {
    applyMenubar();
    for (const menuEl of document.querySelectorAll(`.goog-menu[${ATTR_MENU}]`)) applyMenu(menuEl);
  }

  function scanAll() {
    mapPrimaryMenus();
    for (const menuEl of document.querySelectorAll("body > .goog-menu")) watchMenu(menuEl);
    recordMenubar();
    applyMenubar();
    for (const menuEl of document.querySelectorAll(`.goog-menu[${ATTR_MENU}]`)) recordMenu(menuEl, applyMenu(menuEl));
  }

  let scanTimer = 0;
  const scheduleScan = () => {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scanAll, 300);
  };

  cs.modules.push({
    name: "menus",
    apply() {
      if (document.body) applyAll();
    },
    start() {
      new MutationObserver((records) => {
        for (const r of records)
          for (const n of r.addedNodes)
            if (n.nodeType === Node.ELEMENT_NODE && (n.classList.contains("goog-menu") || n.querySelector?.("#docs-menubar"))) {
              scheduleScan();
              return;
            }
      }).observe(document.body, { childList: true });

      const attachMenubarObserver = () => {
        const bar = getMenubar();
        if (!bar) return false;
        new MutationObserver(scheduleScan).observe(bar, { childList: true });
        return true;
      };
      if (!attachMenubarObserver()) {
        const waitBar = new MutationObserver(() => {
          if (attachMenubarObserver()) {
            waitBar.disconnect();
            scheduleScan();
          }
        });
        waitBar.observe(document.body, { childList: true, subtree: true });
      }
      scanAll();
    },
  });
})();
