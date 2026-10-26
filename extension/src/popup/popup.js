const { loadSettings, saveSettings, SETTINGS_KEY, DARK_STRENGTH } = globalThis.GDMC;

const $ = (id) => document.getElementById(id);
const els = {
  enabled: $("dark-enabled"),
  strength: $("dark-strength"),
  strengthOut: $("dark-strength-out"),
  preserve: $("dark-preserve"),
  detail: $("dark-detail"),
  summary: $("toolbar-summary"),
  hint: $("hint"),
};

let settings;

const strengthPercent = (v) => `${Math.round(((v - DARK_STRENGTH.min) / (DARK_STRENGTH.max - DARK_STRENGTH.min)) * 100)}%`;

function render() {
  const { dark, toolbar, menubar, menus } = settings;
  els.enabled.checked = dark.enabled;
  els.strength.value = String(dark.strength);
  els.strengthOut.value = strengthPercent(dark.strength);
  els.preserve.checked = dark.preserveImages;
  els.detail.setAttribute("aria-disabled", String(!dark.enabled));

  const parts = [];
  if (toolbar.hidden.length) parts.push(`${toolbar.hidden.length} 個を非表示`);
  if (toolbar.order.length) parts.push("並べ替え済み");
  const menuChanges =
    menubar.hidden.length + (menubar.order.length ? 1 : 0) + Object.values(menus).filter((m) => m.order.length || m.hidden.length).length;
  if (menuChanges) parts.push("メニューバーも変更あり");
  els.summary.textContent = parts.length ? parts.join(" ・ ") : "まだ変更はありません";
}

let pendingWrites = 0;

async function update(mutator) {
  mutator(settings);
  render();
  pendingWrites++;
  try {
    await saveSettings(settings);
  } finally {
    pendingWrites--;
  }
}

els.strength.min = String(DARK_STRENGTH.min);
els.strength.max = String(DARK_STRENGTH.max);
els.enabled.addEventListener("change", () => update((s) => (s.dark.enabled = els.enabled.checked)));
els.preserve.addEventListener("change", () => update((s) => (s.dark.preserveImages = els.preserve.checked)));
els.strength.addEventListener("input", () => update((s) => (s.dark.strength = Number(els.strength.value))));
const openOptions = (tab) => {
  chrome.tabs.create({ url: chrome.runtime.getURL(`src/options/options.html#${tab}`) });
  window.close();
};
$("open-options").addEventListener("click", () => openOptions("toolbar"));
$("open-menus").addEventListener("click", () => openOptions("menus"));

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[SETTINGS_KEY] && !pendingWrites) {
    settings = GDMC.normalizeSettings(changes[SETTINGS_KEY].newValue);
    render();
  }
});

(async () => {
  settings = await loadSettings();
  render();
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  els.hint.hidden = Boolean(tab?.url?.startsWith("https://docs.google.com/document/"));
})();
