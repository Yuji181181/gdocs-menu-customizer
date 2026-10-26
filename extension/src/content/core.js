// content script 間で共有する状態とユーティリティ（isolated world の globalThis.GDMC_CS に公開）
(() => {
  if (!location.pathname.startsWith("/document/")) return;

  const { CATALOG_KEY, normalizeSettings } = globalThis.GDMC;

  const cs = (globalThis.GDMC_CS = {
    settings: normalizeSettings(null),
    // Docs の DOM から読み取った項目一覧。設定画面の表示に使う
    catalog: { toolbar: [], toolbarEdges: [], menubar: [], menus: {} },
    modules: [],
  });

  // 拡張機能のキャッシュをページの localStorage に置き、document_start で同期的に読めるようにする
  cs.cacheGet = (key) => {
    try {
      return JSON.parse(localStorage.getItem(key) ?? "null");
    } catch {
      return null;
    }
  };
  cs.cacheSet = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  };

  cs.styleSheet = (id) => {
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement("style");
      el.id = id;
      (document.head ?? document.documentElement).append(el);
    }
    return el;
  };

  let saveTimer = 0;
  cs.updateCatalog = (patch) => {
    let changed = false;
    for (const [k, v] of Object.entries(patch)) {
      if (k === "menus") {
        for (const [mk, mv] of Object.entries(v)) {
          if (JSON.stringify(cs.catalog.menus[mk]) === JSON.stringify(mv)) continue;
          cs.catalog.menus[mk] = mv;
          changed = true;
        }
      } else if (JSON.stringify(cs.catalog[k]) !== JSON.stringify(v)) {
        cs.catalog[k] = v;
        changed = true;
      }
    }
    if (!changed) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try {
        const stored = (await chrome.storage.local.get(CATALOG_KEY))[CATALOG_KEY] ?? {};
        const next = { ...stored, updatedAt: Date.now(), menus: { ...(stored.menus ?? {}), ...cs.catalog.menus } };
        for (const k of ["toolbar", "toolbarEdges", "menubar"]) if (cs.catalog[k].length) next[k] = cs.catalog[k];
        await chrome.storage.local.set({ [CATALOG_KEY]: next });
      } catch {
        // 拡張機能を再読み込みした後、古いタブに残った content script から呼ばれた場合など
      }
    }, 800);
  };

  // Docs はビューポート幅（documentElement.clientWidth）が変わったときだけツールバーのはみ出し判定や
  // 本文キャンバスの再描画を行う。スクロールバーを一瞬出して幅を変化させ、再計算を促す。
  let relayoutTimer = 0;
  cs.requestDocsRelayout = () => {
    clearTimeout(relayoutTimer);
    relayoutTimer = setTimeout(() => {
      const root = document.documentElement;
      const prevValue = root.style.getPropertyValue("overflow-y");
      const prevPriority = root.style.getPropertyPriority("overflow-y");
      root.style.setProperty("overflow-y", "scroll", "important");
      window.dispatchEvent(new Event("resize"));
      setTimeout(() => {
        if (prevValue) root.style.setProperty("overflow-y", prevValue, prevPriority);
        else root.style.removeProperty("overflow-y");
        window.dispatchEvent(new Event("resize"));
      }, 250);
    }, 100);
  };

  // 変更が連続しても 1 フレームに 1 回だけ実行する
  cs.rafThrottle = (fn) => {
    let queued = false;
    return () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        fn();
      });
    };
  };
})();
