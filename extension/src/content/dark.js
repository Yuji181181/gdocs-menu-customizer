// ダークモード。manifest の matches により docs.google.com/document/* でのみ読み込まれる
(() => {
  const cs = globalThis.GDMC_CS;
  if (!cs) return;

  const root = document.documentElement;
  const CACHE_KEY = "gdmc:dark-cache";

  function apply(settings) {
    const { enabled, strength, preserveImages } = settings.dark;
    root.classList.toggle("gdmc-dark", enabled);
    root.classList.toggle("gdmc-dark-preserve-images", enabled && preserveImages);
    root.style.setProperty("--gdmc-strength", String(strength));
    root.style.setProperty("--gdmc-counter-contrast", String(1 / (2 * strength - 1)));
    // MAIN world（main-world.js）がキャンバス描画時に参照する
    root.dataset.gdmcStrength = String(strength);
    cs.cacheSet(CACHE_KEY, settings.dark);
  }

  // storage の読み込みを待つ間に白く光らないよう、前回の状態を先に当てる
  const cached = cs.cacheGet(CACHE_KEY);
  if (cached) apply(globalThis.GDMC.normalizeSettings({ dark: cached }));

  let prev = "";
  cs.modules.push({
    name: "dark",
    apply(settings) {
      const next = JSON.stringify(settings.dark);
      if (next === prev) return;
      const wasSet = prev !== "";
      prev = next;
      apply(settings);
      // 本文キャンバス上の画像は描画時に色補正するため、切り替え時は再描画を促す
      if (wasSet) cs.requestDocsRelayout?.();
    },
  });
})();
