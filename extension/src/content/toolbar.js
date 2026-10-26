// ツールバー（#docs-toolbar）の並べ替えと非表示。
//
// Docs は幅が足りないとき、はみ出したボタンを DOM ごと「もっと見る」バブル（.docs-toolbar-more-toolbar）へ移し、
// そのたびに内部の順序で DOM を組み直す。そのため DOM は動かさず、id 指定の CSS（order / display）だけで見た目を変える。
// はみ出し判定はボタンの実測幅で行われるので、非表示にした分だけ他のボタンが収まる。
(() => {
  const cs = globalThis.GDMC_CS;
  if (!cs) return;

  const { mergeOrder, TOOLBAR_EDGES } = globalThis.GDMC;
  const root = document.documentElement;
  const CSS_CACHE_KEY = "gdmc:toolbar-css";
  const STYLE_ID = "gdmc-toolbar-style";
  const MORE_TOOLBAR = ".docs-toolbar-more-toolbar";
  // 「もっと見る」ボタンとユーザー補助メニューは常に末尾に置く
  const FIXED_TAIL = ["moreButton", "docs-toolbar-accessibility-separator", "docs-toolbar-accessibility-menu"];
  const SHORTCUT = /\s*[（(](?:Ctrl|Alt|Shift|Meta|⌘|Cmd)[^)）]*[)）]\s*$/;

  const stableId = (el) => (el.id && !el.id.startsWith(":") ? el.id : null);
  const isSeparator = (el) => el.getAttribute("role") === "separator" || el.classList.contains("goog-toolbar-separator");
  const isFontSizePart = (el) =>
    el.classList.contains("docs-font-size-inc-dec-action-button") || el.classList.contains("docs-font-size-inc-dec-combobox");

  function labelOf(el) {
    const raw = el.getAttribute("aria-label") || el.getAttribute("data-tooltip") || el.textContent || "";
    return raw.replace(SHORTCUT, "").replace(/\s+/g, " ").trim();
  }

  // Docs 内部の並び順＝メインのツールバー（末尾固定分を除く）＋「もっと見る」バブルの中身
  function naturalChildren() {
    const tb = document.getElementById("docs-toolbar");
    if (!tb) return [];
    const main = [...tb.children].filter((el) => !FIXED_TAIL.includes(el.id));
    const more = document.querySelector(MORE_TOOLBAR);
    return more ? [...main, ...more.children] : main;
  }

  // 分割ボタン（本体＋▼）やフォントサイズ（− 11 +）は 1 つの単位として扱う
  function buildUnits(children) {
    const units = [];
    const followers = [];
    for (let i = 0; i < children.length; i++) {
      const el = children[i];
      const id = stableId(el);
      if (!id) {
        followers.push({ el, unitIndex: units.length - 1 });
        continue;
      }
      if (isSeparator(el)) {
        units.push({ key: id, kind: "separator", members: [el], label: "区切り線" });
        continue;
      }
      const members = [el];
      if (el.classList.contains("docs-toolbar-button-split-left")) {
        const next = children[i + 1];
        if (next && stableId(next) && next.classList.contains("docs-toolbar-button-split-right")) members.push(children[++i]);
      } else if (isFontSizePart(el)) {
        while (children[i + 1] && stableId(children[i + 1]) && isFontSizePart(children[i + 1])) members.push(children[++i]);
      }
      let label = labelOf(el);
      if (members.some((m) => m.id === "fontSizeSelect")) label = "フォントサイズ（− 11 +）";
      units.push({ key: id, kind: "button", members, label: label || id });
    }
    return { units, followers };
  }

  // ---------------------------------------------------------------- CSS 生成

  function buildCss(settings, unitList) {
    const { order, hidden } = settings.toolbar;
    const rules = [];
    const hiddenSet = new Set(hidden);
    const memberIds = (key) => unitList.find((u) => u.key === key)?.memberIds ?? [key];

    for (const key of hiddenSet) for (const id of memberIds(key)) rules.push(`#${CSS.escape(id)}{display:none!important}`);
    // 左右端のボタンを消したとき、間の区切り線も消す
    if (hiddenSet.has("docs-toolbar-mode-switcher") || hiddenSet.has("viewModeButton"))
      rules.push("#docs-toolbar-mode-switcher-separator{display:none!important}");

    if (order.length) {
      const merged = mergeOrder(
        unitList.map((u) => u.key),
        order,
      );
      merged.forEach((key, u) => {
        memberIds(key).forEach((id, m) => rules.push(`#${CSS.escape(id)}{order:${(u + 1) * 10 + m}!important}`));
      });
      FIXED_TAIL.forEach((id, i) => rules.push(`#${CSS.escape(id)}{order:${100000 + i}!important}`));
      rules.push(
        "#docs-toolbar{display:inline-flex!important;align-items:center;vertical-align:top}",
        `${MORE_TOOLBAR}{display:flex!important;flex-wrap:wrap;align-items:center}`,
      );
    }
    return rules.join("\n");
  }

  function writeCss(css) {
    const el = cs.styleSheet(STYLE_ID);
    if (el.textContent !== css) el.textContent = css;
    root.classList.toggle("gdmc-toolbar-custom", css.length > 0);
    cs.cacheSet(CSS_CACHE_KEY, css);
  }

  // 前回の CSS を document_start で先に当て、Docs の初回のはみ出し計算に間に合わせる
  const cachedCss = cs.cacheGet(CSS_CACHE_KEY);
  if (typeof cachedCss === "string" && cachedCss) writeCss(cachedCss);

  // ---------------------------------------------------------------- DOM 依存の処理

  let current = { units: [], followers: [] };

  // id の無い要素（Docs が自動生成した区切り線など）は直前の単位の直後に並べる
  function placeFollowers(settings) {
    const orderOf = new Map();
    if (settings.toolbar.order.length) {
      const merged = mergeOrder(
        current.units.map((u) => u.key),
        settings.toolbar.order,
      );
      merged.forEach((key, i) => orderOf.set(key, (i + 1) * 10 + 9));
    }
    for (const { el, unitIndex } of current.followers) {
      const unit = current.units[unitIndex];
      const want = orderOf.size ? String(unit ? orderOf.get(unit.key) : 0) : "";
      // 自分の変更で MutationObserver が再発火し続けないよう、差分があるときだけ書き換える
      if (el.style.getPropertyValue("order") === want) continue;
      if (want) el.style.setProperty("order", want);
      else el.style.removeProperty("order");
    }
  }

  // 非表示・並べ替えの結果、先頭・末尾・連続になった区切り線を隠す
  function collapseSeparators(container) {
    const kids = [...container.children];
    for (const el of kids) el.classList.remove("gdmc-sep-collapsed");
    if (!cs.settings.toolbar.hidden.length && !cs.settings.toolbar.order.length) return;
    const visible = kids
      .map((el, i) => ({ el, i, order: Number(getComputedStyle(el).order) || 0 }))
      // id の無い空要素（Docs が挟む幅 0 の div）はボタン扱いしない
      .filter(({ el }) => (stableId(el) || isSeparator(el)) && !FIXED_TAIL.includes(el.id))
      .filter(({ el }) => getComputedStyle(el).display !== "none")
      .sort((a, b) => a.order - b.order || a.i - b.i)
      .map(({ el }) => el);
    let lastWasSep = true;
    let pending = null;
    for (const el of visible) {
      if (isSeparator(el)) {
        if (lastWasSep) el.classList.add("gdmc-sep-collapsed");
        else pending = el;
        lastWasSep = true;
      } else {
        lastWasSep = false;
        pending = null;
      }
    }
    pending?.classList.add("gdmc-sep-collapsed");
  }

  function recordCatalog() {
    const toolbar = current.units.map((u) => ({
      key: u.key,
      label: u.label,
      kind: u.kind,
      members: u.members.map((m) => m.id),
      ...(u.members.every((m) => m.style.display === "none") ? { docsHidden: true } : {}),
    }));
    const toolbarEdges = TOOLBAR_EDGES.filter((e) => document.getElementById(e.key)).map((e) => ({
      key: e.key,
      label: e.label,
      side: e.side,
    }));
    cs.updateCatalog({ toolbar, toolbarEdges });
  }

  function unitList() {
    if (current.units.length) return current.units.map((u) => ({ key: u.key, memberIds: u.members.map((m) => m.id) }));
    return (cs.catalog.toolbar ?? []).map((u) => ({ key: u.key, memberIds: u.members ?? [u.key] }));
  }

  function refreshFromDom() {
    const children = naturalChildren();
    if (!children.length) return false;
    current = buildUnits(children);
    return true;
  }

  const collapseAll = () => {
    const tb = document.getElementById("docs-toolbar");
    if (tb) collapseSeparators(tb);
    const more = document.querySelector(MORE_TOOLBAR);
    if (more) collapseSeparators(more);
  };

  const onDomChange = cs.rafThrottle(() => {
    if (refreshFromDom()) {
      placeFollowers(cs.settings);
      recordCatalog();
    }
    collapseAll();
  });

  const observer = new MutationObserver(onDomChange);
  const observed = new WeakSet();
  function observeContainers() {
    for (const el of [document.getElementById("docs-toolbar"), document.querySelector(MORE_TOOLBAR)]) {
      if (!el || observed.has(el)) continue;
      observed.add(el);
      observer.observe(el, { childList: true, subtree: true, attributes: true, attributeFilter: ["style"] });
    }
  }

  let lastToolbarJson = null;
  cs.modules.push({
    name: "toolbar",
    apply(settings) {
      const json = JSON.stringify(settings.toolbar);
      if (json === lastToolbarJson) return;
      const changedAfterLoad = lastToolbarJson !== null;
      lastToolbarJson = json;
      writeCss(buildCss(settings, unitList()));
      if (!document.body) return;
      placeFollowers(settings);
      collapseAll();
      if (changedAfterLoad) cs.requestDocsRelayout();
    },
    start() {
      const tryStart = () => {
        if (!document.getElementById("docs-toolbar")) return false;
        observeContainers();
        refreshFromDom();
        writeCss(buildCss(cs.settings, unitList()));
        placeFollowers(cs.settings);
        recordCatalog();
        collapseAll();
        if (document.getElementById("moreButton")?.style.display !== "none") cs.requestDocsRelayout();
        return true;
      };
      if (!tryStart()) {
        const wait = new MutationObserver(() => {
          if (tryStart()) wait.disconnect();
        });
        wait.observe(document.body, { childList: true, subtree: true });
      }
      // 「もっと見る」バブルは初回クリック時などに作られることがある
      new MutationObserver(() => {
        if (document.querySelector(MORE_TOOLBAR)) {
          observeContainers();
          onDomChange();
        }
      }).observe(document.body, { childList: true });
    },
  });
})();
