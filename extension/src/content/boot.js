// 設定を読み込み、各モジュール（dark / toolbar / menus）に適用する。設定が変わればその場で再適用する
(() => {
  const cs = globalThis.GDMC_CS;
  if (!cs) return;

  const { SETTINGS_KEY, CATALOG_KEY, normalizeSettings } = globalThis.GDMC;

  const applyAll = () => {
    for (const m of cs.modules) m.apply(cs.settings);
  };

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[SETTINGS_KEY]) return;
    cs.settings = normalizeSettings(changes[SETTINGS_KEY].newValue);
    applyAll();
  });

  const ready = chrome.storage.local.get([SETTINGS_KEY, CATALOG_KEY]).then((r) => {
    cs.settings = normalizeSettings(r[SETTINGS_KEY]);
    const stored = r[CATALOG_KEY];
    if (stored?.toolbar) cs.catalog.toolbar = stored.toolbar;
    applyAll();
  });

  const start = async () => {
    await ready;
    for (const m of cs.modules) m.start?.();
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
