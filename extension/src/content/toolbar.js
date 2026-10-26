// ツールバー（#docs-toolbar）の並べ替えと非表示。
//
// - 見た目の並び順と非表示は、id 指定の CSS（order / display）で適用する。Docs は幅が足りないとき、
//   はみ出したボタンを DOM ごと「もっと見る」バブル（.docs-toolbar-more-toolbar）へ移し、そのたびに
//   内部の順序で DOM を組み直すため、DOM の並びを書き換えても打ち消されてしまう。
// - はみ出し判定はボタンの実測幅で行われるので、非表示にした分だけ他のボタンが収まる。
// - ただし「どのボタンをバブルへ送るか」は Docs の内部順序で決まる。並べ替えを設定している場合は、
//   Docs が組み直した直後に、設定の並び順で先頭から収まる分だけをメインに置くよう振り分け直す。
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
  // 右側のボタン群との間に残す余白（px）
  const SAFETY_GAP = 16;

  const $id = (id) => document.getElementById(id);
  const stableId = (el) => (el.id && !el.id.startsWith(":") ? el.id : null);
  const isSeparator = (el) => el.getAttribute("role") === "separator" || el.classList.contains("goog-toolbar-separator");
  const isFontSizePart = (el) =>
    el.classList.contains("docs-font-size-inc-dec-action-button") || el.classList.contains("docs-font-size-inc-dec-combobox");
  const isShown = (el) => getComputedStyle(el).display !== "none";

  function labelOf(el) {
    const raw = el.getAttribute("aria-label") || el.getAttribute("data-tooltip") || el.textContent || "";
    return raw.replace(SHORTCUT, "").replace(/\s+/g, " ").trim();
  }

  // 現在の DOM 上の並び＝メインのツールバー（末尾固定分を除く）＋「もっと見る」バブルの中身
  function domChildren() {
    const tb = $id("docs-toolbar");
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
        followers.push({ el, unit: units.at(-1) ?? null });
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
    // 右端のボタンを消したとき、間の区切り線も消す
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
        // 振り分けの結果バブルが空になったときは「もっと見る」自体を隠す
        "html.gdmc-more-empty #moreButton{display:none!important}",
      );
    }
    return rules.join("\n");
  }

  function writeCss(css) {
    const el = cs.styleSheet(STYLE_ID);
    if (el.textContent !== css) el.textContent = css;
    cs.cacheSet(CSS_CACHE_KEY, css);
  }

  // 前回の CSS を document_start で先に当て、Docs の初回のはみ出し計算に間に合わせる
  const cachedCss = cs.cacheGet(CSS_CACHE_KEY);
  if (typeof cachedCss === "string" && cachedCss) writeCss(cachedCss);

  // ---------------------------------------------------------------- DOM 依存の処理

  let current = { units: [], followers: [] };
  // Docs 内部の並び順（ユニットのキー）。こちらが DOM を振り分け直す前の、最初の観測を基準に保つ
  let canonical = [];

  function refreshFromDom() {
    const children = domChildren();
    if (!children.length) return false;
    const built = buildUnits(children);
    canonical = mergeOrder(
      built.units.map((u) => u.key),
      canonical,
    );
    const pos = new Map(canonical.map((k, i) => [k, i]));
    built.units.sort((a, b) => pos.get(a.key) - pos.get(b.key));
    current = built;
    return true;
  }

  function orderedUnits(settings) {
    const byKey = new Map(current.units.map((u) => [u.key, u]));
    return mergeOrder(
      current.units.map((u) => u.key),
      settings.toolbar.order,
    ).map((k) => byKey.get(k));
  }

  // id の無い要素（Docs が自動生成した区切り線など）は直前の単位の直後に並べる
  function placeFollowers(settings) {
    const orderOf = new Map();
    if (settings.toolbar.order.length) orderedUnits(settings).forEach((u, i) => orderOf.set(u, (i + 1) * 10 + 9));
    for (const { el, unit } of current.followers) {
      const want = orderOf.size ? String(unit ? orderOf.get(unit) : 0) : "";
      // 自分の変更で MutationObserver が再発火し続けないよう、差分があるときだけ書き換える
      if (el.style.getPropertyValue("order") === want) continue;
      if (want) el.style.setProperty("order", want);
      else el.style.removeProperty("order");
    }
  }

  // ---- 「もっと見る」への振り分け（並べ替え設定があるときのみ）

  const widthCache = new Map();
  function outerWidth(el) {
    const style = getComputedStyle(el);
    if (style.display === "none") return 0;
    const w = el.getBoundingClientRect().width;
    if (!w) return null;
    return w + parseFloat(style.marginLeft) + parseFloat(style.marginRight);
  }

  function cacheWidths(container) {
    for (const el of container.children) {
      const w = outerWidth(el);
      if (w && el.id) widthCache.set(el.id, w);
    }
  }

  function unitWidth(u) {
    let sum = 0;
    for (const m of u.members) {
      if (!isShown(m)) continue;
      // バブルの中で一度も測れていない場合の目安（区切り線は細く、プルダウンは広め）
      const fallback = isSeparator(m) ? 9 : m.getAttribute("role") === "listbox" ? 110 : m.getAttribute("role") === "combobox" ? 60 : 32;
      sum += widthCache.get(m.id) ?? fallback;
    }
    return sum;
  }

  function rebalance(settings) {
    const tb = $id("docs-toolbar");
    const more = document.querySelector(MORE_TOOLBAR);
    const moreBtn = $id("moreButton");
    const side = $id("docs-side-toolbar");
    root.classList.remove("gdmc-more-empty");
    if (!settings.toolbar.order.length || !tb || !more || !moreBtn || !side) return;
    if (![...more.children].some((el) => stableId(el))) return;

    cacheWidths(tb);
    if (more.getBoundingClientRect().width) cacheWidths(more);
    const left = tb.getBoundingClientRect().left;
    const followersWidth = current.followers.reduce((n, f) => n + (f.el.parentElement === tb ? outerWidth(f.el) ?? 0 : 0), 0);
    const budget = side.getBoundingClientRect().left - SAFETY_GAP - left - (widthCache.get("moreButton") ?? 40) - followersWidth;

    const want = new Set();
    let used = 0;
    for (const u of orderedUnits(settings)) {
      const w = unitWidth(u);
      if (used + w > budget) break;
      used += w;
      want.add(u);
    }
    for (const u of current.units) {
      const inMain = u.members[0].parentElement === tb;
      if (want.has(u) && !inMain) for (const m of u.members) tb.insertBefore(m, moreBtn);
      else if (!want.has(u) && inMain) for (const m of u.members) more.append(m);
    }
    const bubbleHasVisible = current.units.some((u) => !want.has(u) && u.members.some(isShown));
    root.classList.toggle("gdmc-more-empty", !bubbleHasVisible);
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
      .filter(({ el }) => isShown(el))
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
    const toolbarEdges = TOOLBAR_EDGES.filter((e) => $id(e.key)).map((e) => ({ key: e.key, label: e.label, side: e.side }));
    cs.updateCatalog({ toolbar, toolbarEdges });
  }

  function unitList() {
    if (current.units.length) return current.units.map((u) => ({ key: u.key, memberIds: u.members.map((m) => m.id) }));
    return (cs.catalog.toolbar ?? []).map((u) => ({ key: u.key, memberIds: u.members ?? [u.key] }));
  }

  function collapseAll() {
    const tb = $id("docs-toolbar");
    if (tb) collapseSeparators(tb);
    const more = document.querySelector(MORE_TOOLBAR);
    if (more) collapseSeparators(more);
  }

  function sync() {
    if (refreshFromDom()) {
      placeFollowers(cs.settings);
      recordCatalog();
      rebalance(cs.settings);
    }
    collapseAll();
  }

  const onDomChange = cs.rafThrottle(sync);
  const observer = new MutationObserver(onDomChange);
  const observed = new WeakSet();
  function observeContainers() {
    for (const el of [$id("docs-toolbar"), document.querySelector(MORE_TOOLBAR)]) {
      if (!el || observed.has(el)) continue;
      observed.add(el);
      observer.observe(el, { childList: true, subtree: true, attributes: true, attributeFilter: ["style"] });
    }
  }

  let lastToolbarJson = null;
  let started = false;
  cs.modules.push({
    name: "toolbar",
    apply(settings) {
      const json = JSON.stringify(settings.toolbar);
      if (json === lastToolbarJson) return;
      const changedAfterLoad = lastToolbarJson !== null;
      lastToolbarJson = json;
      writeCss(buildCss(settings, unitList()));
      if (!started) return;
      sync();
      // Docs 自身のはみ出し判定もやり直させる（非表示で空いた幅を使えるように）
      if (changedAfterLoad) cs.requestDocsRelayout();
    },
    start() {
      const tryStart = () => {
        if (!$id("docs-toolbar")) return false;
        started = true;
        observeContainers();
        refreshFromDom();
        writeCss(buildCss(cs.settings, unitList()));
        sync();
        if ($id("moreButton")?.style.display !== "none") cs.requestDocsRelayout();
        return true;
      };
      if (!tryStart()) {
        const wait = new MutationObserver(() => {
          if (tryStart()) wait.disconnect();
        });
        wait.observe(document.body, { childList: true, subtree: true });
      }
      // 「もっと見る」バブルは後から作られることがある
      new MutationObserver(() => {
        if (document.querySelector(MORE_TOOLBAR)) {
          observeContainers();
          onDomChange();
        }
      }).observe(document.body, { childList: true });
      window.addEventListener("resize", onDomChange);
    },
  });
})();
