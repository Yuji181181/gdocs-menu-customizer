// 設定・カタログの共通定義。content script / popup / options から <script> で読み込む（ES modules 非対応の content script と共有するため globalThis に公開）
(() => {
  const SETTINGS_KEY = "gdmc:settings";
  const CATALOG_KEY = "gdmc:catalog";
  const SUBMENU_SEP = " › ";

  const DEFAULT_MENUBAR = [
    { id: "docs-file-menu", label: "ファイル" },
    { id: "docs-edit-menu", label: "編集" },
    { id: "docs-view-menu", label: "表示" },
    { id: "docs-insert-menu", label: "挿入" },
    { id: "docs-format-menu", label: "表示形式" },
    { id: "docs-tools-menu", label: "ツール" },
    { id: "docs-extensions-menu", label: "拡張機能" },
    { id: "docs-help-menu", label: "ヘルプ" },
  ];

  const DARK_STRENGTH = { min: 0.8, max: 1, default: 0.9 };

  // ツールバー左右端にある、並べ替え対象外（表示/非表示のみ）のコントロール
  const TOOLBAR_EDGES = [
    { key: "docs-omnibox-toolbar", label: "メニューを検索（虫めがね）", side: "左端" },
    { key: "docs-toolbar-mode-switcher", label: "編集モードの切り替え（鉛筆）", side: "右端" },
    { key: "viewModeButton", label: "メニューを非表示（^ ボタン）", side: "右端" },
  ];

  function defaultSettings() {
    return {
      version: 1,
      // key: ツールバー項目のキー（ボタンの id。分割ボタン等は先頭要素の id）
      toolbar: { order: [], hidden: [] },
      menubar: { order: [], hidden: [] },
      // key: メニューキー（例 "docs-file-menu" / "docs-file-menu › 新規作成"）
      menus: {},
      dark: { enabled: false, strength: DARK_STRENGTH.default, preserveImages: true },
    };
  }

  const uniqStrings = (v) => (Array.isArray(v) ? [...new Set(v.filter((x) => typeof x === "string"))] : []);

  function normalizeSettings(raw) {
    const d = defaultSettings();
    if (!raw || typeof raw !== "object") return d;
    const menus = {};
    for (const [key, m] of Object.entries(raw.menus ?? {})) {
      if (!m || typeof m !== "object") continue;
      const order = uniqStrings(m.order);
      const hidden = uniqStrings(m.hidden);
      if (order.length || hidden.length) menus[key] = { order, hidden };
    }
    const strength = Number(raw.dark?.strength);
    return {
      version: 1,
      toolbar: { order: uniqStrings(raw.toolbar?.order), hidden: uniqStrings(raw.toolbar?.hidden) },
      menubar: { order: uniqStrings(raw.menubar?.order), hidden: uniqStrings(raw.menubar?.hidden) },
      menus,
      dark: {
        enabled: Boolean(raw.dark?.enabled),
        strength: Number.isFinite(strength)
          ? Math.min(DARK_STRENGTH.max, Math.max(DARK_STRENGTH.min, strength))
          : DARK_STRENGTH.default,
        preserveImages: raw.dark?.preserveImages !== false,
      },
    };
  }

  async function loadSettings() {
    const r = await chrome.storage.local.get(SETTINGS_KEY);
    return normalizeSettings(r[SETTINGS_KEY]);
  }

  async function saveSettings(settings) {
    const s = normalizeSettings(settings);
    await chrome.storage.local.set({ [SETTINGS_KEY]: s });
    return s;
  }

  async function loadCatalog() {
    const r = await chrome.storage.local.get(CATALOG_KEY);
    return r[CATALOG_KEY] ?? null;
  }

  // 設定済みの順序と、実際に存在するキー（DOM順）をマージする。
  // 設定に無い新規キーは、DOM 上の直前の要素の後ろに差し込む。
  function mergeOrder(domKeys, configured) {
    const present = new Set(domKeys);
    const result = (configured ?? []).filter((k) => present.has(k));
    const placed = new Set(result);
    domKeys.forEach((k, i) => {
      if (placed.has(k)) return;
      let insertAt = 0;
      for (let j = i - 1; j >= 0; j--) {
        const idx = result.indexOf(domKeys[j]);
        if (idx !== -1) {
          insertAt = idx + 1;
          break;
        }
      }
      result.splice(insertAt, 0, k);
      placed.add(k);
    });
    return result;
  }

  globalThis.GDMC = {
    SETTINGS_KEY,
    CATALOG_KEY,
    SUBMENU_SEP,
    DEFAULT_MENUBAR,
    TOOLBAR_EDGES,
    DARK_STRENGTH,
    defaultSettings,
    normalizeSettings,
    loadSettings,
    saveSettings,
    loadCatalog,
    mergeOrder,
  };
})();
