const {
  SETTINGS_KEY,
  CATALOG_KEY,
  SUBMENU_SEP,
  DEFAULT_MENUBAR,
  TOOLBAR_EDGES,
  DARK_STRENGTH,
  loadSettings,
  saveSettings,
  loadCatalog,
  normalizeSettings,
  defaultSettings,
  mergeOrder,
} = globalThis.GDMC;
const { render: renderList } = globalThis.SortableList;

const $ = (id) => document.getElementById(id);

let settings = defaultSettings();
let catalog = null;
let currentMenu = null;
let pendingWrites = 0;

// ---------------------------------------------------------------- 保存

let toastTimer = 0;
function toast(message) {
  const t = $("toast");
  t.textContent = message;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 1400);
}

async function update(mutator, message = "保存しました") {
  mutator(settings);
  settings = normalizeSettings(settings);
  renderAll();
  pendingWrites++;
  try {
    await saveSettings(settings);
  } finally {
    pendingWrites--;
  }
  if (message) toast(message);
}

const toggleIn = (list, key, present) => {
  const s = new Set(list);
  if (present) s.add(key);
  else s.delete(key);
  return [...s];
};

// ---------------------------------------------------------------- タブ

const TABS = ["toolbar", "dark", "menus", "backup"];
function selectTab(name, focus = false) {
  if (!TABS.includes(name)) name = "toolbar";
  for (const t of TABS) {
    const tab = $(`tab-${t}`);
    tab.setAttribute("aria-selected", String(t === name));
    tab.tabIndex = t === name ? 0 : -1;
    $(`panel-${t}`).hidden = t !== name;
  }
  if (focus) $(`tab-${name}`).focus();
  if (location.hash !== `#${name}`) history.replaceState(null, "", `#${name}`);
}

document.querySelector(".tabs").addEventListener("click", (e) => {
  const tab = e.target.closest("[data-tab]");
  if (tab) selectTab(tab.dataset.tab);
});
document.querySelector(".tabs").addEventListener("keydown", (e) => {
  if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
  const i = TABS.findIndex((t) => $(`tab-${t}`).getAttribute("aria-selected") === "true");
  const next = TABS[(i + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length];
  selectTab(next, true);
});

// ---------------------------------------------------------------- ツールバー

function toolbarRows() {
  const units = catalog?.toolbar ?? [];
  const order = mergeOrder(
    units.map((u) => u.key),
    settings.toolbar.order,
  );
  const byKey = new Map(units.map((u) => [u.key, u]));
  const hidden = new Set(settings.toolbar.hidden);
  return order.map((key) => {
    const u = byKey.get(key);
    return {
      key,
      label: u.kind === "separator" ? "区切り線" : u.label,
      kind: u.kind,
      hidden: hidden.has(key),
      tag: u.docsHidden ? "選択時のみ" : undefined,
      docsHidden: u.docsHidden,
    };
  });
}

function renderToolbar() {
  const rows = toolbarRows();
  $("toolbar-notice").hidden = rows.length > 0;
  const showContextual = $("toolbar-show-contextual").checked;
  $("toolbar-contextual-count").textContent = String(rows.filter((r) => r.docsHidden).length);
  const listed = showContextual ? rows : rows.filter((r) => !r.docsHidden);

  renderList($("toolbar-list"), listed, {
    // 一覧に出していない項目は、元の直前の項目の後ろに残す
    onReorder: (keys) =>
      update(
        (s) =>
          (s.toolbar.order = mergeOrder(
            rows.map((r) => r.key),
            keys,
          )),
      ),
    onToggle: (key, visible) => update((s) => (s.toolbar.hidden = toggleIn(s.toolbar.hidden, key, !visible))),
  });

  // プレビュー：実際の表示に近づけるため、先頭・末尾・連続の区切り線は省く
  const preview = $("toolbar-preview");
  preview.replaceChildren();
  const visible = rows.filter((r) => !r.hidden && !r.docsHidden);
  let lastWasBar = true;
  visible.forEach((r, i) => {
    if (r.kind === "separator") {
      const hasButtonAfter = visible.slice(i + 1).some((v) => v.kind !== "separator");
      if (lastWasBar || !hasButtonAfter) return;
      preview.append(Object.assign(document.createElement("span"), { className: "bar" }));
      lastWasBar = true;
      return;
    }
    preview.append(Object.assign(document.createElement("span"), { className: "pill", textContent: r.label }));
    lastWasBar = false;
  });
  if (!visible.length) preview.append(Object.assign(document.createElement("span"), { className: "muted", textContent: "（表示するボタンがありません）" }));

  const edges = catalog?.toolbarEdges?.length ? catalog.toolbarEdges : TOOLBAR_EDGES;
  const hidden = new Set(settings.toolbar.hidden);
  renderList(
    $("edge-list"),
    edges.map((e) => ({ key: e.key, label: e.label, tag: e.side, hidden: hidden.has(e.key), sortable: false })),
    { onToggle: (key, visible) => update((s) => (s.toolbar.hidden = toggleIn(s.toolbar.hidden, key, !visible))) },
  );
}

$("toolbar-show-contextual").addEventListener("change", renderToolbar);
$("toolbar-show-all").addEventListener("click", () =>
  update((s) => {
    const edgeKeys = new Set(TOOLBAR_EDGES.map((e) => e.key));
    s.toolbar.hidden = s.toolbar.hidden.filter((k) => edgeKeys.has(k));
  }, "すべてのボタンを表示しました"),
);
$("toolbar-reset").addEventListener("click", () =>
  update((s) => (s.toolbar = { order: [], hidden: [] }), "ツールバーを元に戻しました"),
);

// ---------------------------------------------------------------- メニューバー（おまけ）

function menubarEntries() {
  const list = catalog?.menubar?.length ? catalog.menubar : DEFAULT_MENUBAR;
  return list.filter((m) => !m.docsHidden || settings.menubar.order.includes(m.id) || settings.menubar.hidden.includes(m.id));
}

function renderMenubar() {
  const entries = menubarEntries();
  const order = mergeOrder(
    entries.map((m) => m.id),
    settings.menubar.order,
  );
  const byId = new Map(entries.map((m) => [m.id, m]));
  const hidden = new Set(settings.menubar.hidden);
  if (!currentMenu || !catalog?.menus?.[currentMenu]) currentMenu = order.find((id) => catalog?.menus?.[id]) ?? order[0];
  const rootOfCurrent = currentMenu?.split(SUBMENU_SEP)[0];

  renderList(
    $("menubar-list"),
    order.map((id) => ({
      key: id,
      label: byId.get(id)?.label ?? id,
      hidden: hidden.has(id),
      selected: id === rootOfCurrent,
      drill: "中身 ›",
    })),
    {
      onReorder: (keys) => update((s) => (s.menubar.order = keys)),
      onToggle: (key, visible) => update((s) => (s.menubar.hidden = toggleIn(s.menubar.hidden, key, !visible))),
      onDrill: (key) => {
        currentMenu = key;
        renderMenus();
      },
      onSelect: (key) => {
        currentMenu = key;
        renderMenus();
      },
    },
  );
}

function renderItems() {
  const crumbs = $("items-crumbs");
  crumbs.replaceChildren();
  const list = $("items-list");
  const empty = $("items-empty");
  const menu = currentMenu ? catalog?.menus?.[currentMenu] : null;

  if (currentMenu) {
    const parts = currentMenu.split(SUBMENU_SEP);
    const labels = (menu?.label ?? currentMenu).split(SUBMENU_SEP);
    parts.forEach((_, i) => {
      const key = parts.slice(0, i + 1).join(SUBMENU_SEP);
      const text = labels[i] ?? parts[i];
      if (i > 0) crumbs.append(Object.assign(document.createElement("span"), { className: "muted", textContent: "›" }));
      if (i === parts.length - 1) {
        crumbs.append(Object.assign(document.createElement("span"), { textContent: text, ariaCurrent: "page" }));
        crumbs.lastChild.setAttribute("aria-current", "page");
      } else {
        const b = Object.assign(document.createElement("button"), { type: "button", textContent: text });
        b.addEventListener("click", () => {
          currentMenu = key;
          renderMenus();
        });
        crumbs.append(b);
      }
    });
  }

  if (!menu) {
    list.replaceChildren();
    empty.hidden = false;
    empty.textContent = "このメニューの項目はまだ読み込まれていません。Google ドキュメントでこのメニューを一度開いてください。";
    return;
  }
  empty.hidden = true;

  const cfg = settings.menus[currentMenu] ?? { order: [], hidden: [] };
  const order = mergeOrder(
    menu.items.map((it) => it.key),
    cfg.order,
  );
  const byKey = new Map(menu.items.map((it) => [it.key, it]));
  const hidden = new Set(cfg.hidden);
  const setMenu = (mut) =>
    update((s) => {
      const m = s.menus[currentMenu] ?? { order: [], hidden: [] };
      mut(m);
      s.menus[currentMenu] = m;
    });

  renderList(
    list,
    order.map((key) => {
      const it = byKey.get(key);
      const subKey = currentMenu + SUBMENU_SEP + key;
      return {
        key,
        label: it.kind === "separator" ? "区切り線" : it.label,
        kind: it.kind,
        hidden: hidden.has(key),
        tag: it.docsHidden ? "状況により表示" : undefined,
        drill: it.kind === "submenu" ? (catalog.menus[subKey] ? "サブメニュー ›" : undefined) : undefined,
        sub: it.kind === "submenu" && !catalog.menus[subKey] ? "サブメニュー（Docs で一度開くと編集できます）" : undefined,
      };
    }),
    {
      onReorder: (keys) => setMenu((m) => (m.order = keys)),
      onToggle: (key, visible) => setMenu((m) => (m.hidden = toggleIn(m.hidden, key, !visible))),
      onDrill: (key) => {
        currentMenu = currentMenu + SUBMENU_SEP + key;
        renderMenus();
      },
    },
  );
}

function renderMenus() {
  $("menus-notice").hidden = Boolean(catalog?.menus && Object.keys(catalog.menus).length);
  renderMenubar();
  renderItems();
}

$("menubar-reset").addEventListener("click", () =>
  update((s) => (s.menubar = { order: [], hidden: [] }), "メニューバーを元に戻しました"),
);
$("items-show-all").addEventListener("click", () =>
  update((s) => {
    if (s.menus[currentMenu]) s.menus[currentMenu].hidden = [];
  }, "すべての項目を表示しました"),
);
$("items-reset").addEventListener("click", () =>
  update((s) => delete s.menus[currentMenu], "このメニューを元に戻しました"),
);

// ---------------------------------------------------------------- ダークモード

const strengthPercent = (v) => `${Math.round(((v - DARK_STRENGTH.min) / (DARK_STRENGTH.max - DARK_STRENGTH.min)) * 100)}%`;

function renderDark() {
  const { enabled, strength, preserveImages } = settings.dark;
  $("dark-enabled").checked = enabled;
  $("dark-strength").value = String(strength);
  $("dark-strength-out").value = strengthPercent(strength);
  $("dark-preserve").checked = preserveImages;
  $("dark-detail").setAttribute("aria-disabled", String(!enabled));
}

$("dark-strength").min = String(DARK_STRENGTH.min);
$("dark-strength").max = String(DARK_STRENGTH.max);
$("dark-enabled").addEventListener("change", (e) =>
  update((s) => (s.dark.enabled = e.target.checked), e.target.checked ? "ダークモードをオンにしました" : "ダークモードをオフにしました"),
);
$("dark-strength").addEventListener("input", (e) => update((s) => (s.dark.strength = Number(e.target.value)), null));
$("dark-strength").addEventListener("change", () => toast("保存しました"));
$("dark-preserve").addEventListener("change", (e) => update((s) => (s.dark.preserveImages = e.target.checked)));

// ---------------------------------------------------------------- バックアップ

$("export").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify({ app: "gdocs-menu-customizer", settings }, null, 2)], { type: "application/json" });
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(blob),
    download: `gdocs-menu-customizer-${new Date().toISOString().slice(0, 10)}.json`,
  });
  a.click();
  URL.revokeObjectURL(a.href);
});

$("import").addEventListener("click", () => $("import-file").click());
$("import-file").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  e.target.value = "";
  if (!file) return;
  try {
    const json = JSON.parse(await file.text());
    const imported = normalizeSettings(json.settings ?? json);
    await update((s) => Object.assign(s, imported), "設定を読み込みました");
  } catch {
    toast("読み込めませんでした（JSON の形式を確認してください）");
  }
});

$("reset-all").addEventListener("click", () => {
  if (!confirm("ツールバー・メニュー・ダークモードのすべての設定を初期化します。よろしいですか？")) return;
  update((s) => Object.assign(s, defaultSettings()), "すべての設定を初期化しました");
});

// ---------------------------------------------------------------- 起動

function renderAll() {
  renderToolbar();
  renderMenus();
  renderDark();
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes[CATALOG_KEY]) catalog = changes[CATALOG_KEY].newValue ?? null;
  if (changes[SETTINGS_KEY] && !pendingWrites) settings = normalizeSettings(changes[SETTINGS_KEY].newValue);
  renderAll();
});

(async () => {
  [settings, catalog] = await Promise.all([loadSettings(), loadCatalog()]);
  selectTab(location.hash.slice(1));
  renderAll();
})();
