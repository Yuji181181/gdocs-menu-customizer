// 設定画面を実際に操作し、Docs のツールバーに反映されるかを確認する
import { connect, findPage, shot } from "./lib.mjs";
import { extensionId } from "./ext-id.mjs";

const { context } = await connect();
const docs = findPage(context, /document\/d\//);
let opt = context.pages().find((p) => p.url().includes("/src/options/options.html"));
if (!opt) opt = await context.newPage();
await opt.setViewportSize({ width: 1280, height: 900 });
await opt.goto(`chrome-extension://${extensionId()}/src/options/options.html#toolbar`);
await opt.waitForTimeout(600);

const results = [];
const check = (name, ok, detail = "") => {
  results.push(`${ok ? "OK  " : "NG  "} ${name}${detail ? " — " + detail : ""}`);
};
const row = (key) => opt.locator(`#toolbar-list li[data-key="${key}"]`);
const docsState = () =>
  docs.evaluate(() => {
    const tb = document.querySelector("#docs-toolbar");
    const vis = [...tb.children]
      .filter((c) => getComputedStyle(c).display !== "none")
      .map((c) => ({ id: c.id, x: c.getBoundingClientRect().x }))
      .sort((a, b) => a.x - b.x)
      .map((c) => c.id);
    return { vis, collapsed: [...document.querySelectorAll(".gdmc-sep-collapsed")].map((e) => e.id) };
  });

// 0. 初期化
await opt.locator("#toolbar-reset").click();
await opt.waitForTimeout(1500);

// 1. 印刷・スペルチェックを非表示
await row("printButton").locator(".switch").click();
await row("spellGrammarCheckButton").locator(".switch").click();
await opt.waitForTimeout(1500);
let s = await docsState();
check("印刷・スペルチェックが非表示になる", !s.vis.includes("printButton") && !s.vis.includes("spellGrammarCheckButton"));
check("設定画面の行が取り消し線表示になる", await row("printButton").evaluate((li) => li.classList.contains("is-hidden")));

// 2. 太字をマウスでドラッグして先頭へ（途中までスクロールしながら）
await row("boldButton").scrollIntoViewIfNeeded();
const src = await row("boldButton").locator(".handle").boundingBox();
await opt.mouse.move(src.x + src.width / 2, src.y + src.height / 2);
await opt.mouse.down();
await opt.mouse.move(src.x + 10, 10, { steps: 10 }); // 上端に寄せて自動スクロールさせる
await opt.waitForFunction(() => window.scrollY === 0, null, { timeout: 8000 });
// ドラッグ中は先頭に隙間が開いて「元に戻す」が下にずれているので、その隙間（ずれる前の位置）を狙う
const dst = await row("undoButton").boundingBox();
await opt.mouse.move(dst.x + 60, dst.y - dst.height + 6, { steps: 10 });
console.log(await shot(opt, "qa-dnd-gap"));
await opt.mouse.up();
await opt.waitForTimeout(1500);
s = await docsState();
check("ドラッグ＆ドロップで太字が先頭になる", s.vis[0] === "boldButton", s.vis.slice(0, 4).join(","));

// 3. ↑ボタン：斜体を 1 つ上へ（下線の位置関係を確認）
const before = await opt.locator("#toolbar-list li").evaluateAll((lis) => lis.map((l) => l.dataset.key));
const iItalic = before.indexOf("italicButton");
await row("italicButton").locator('[data-role="up"]').click();
await opt.waitForTimeout(1500);
const after = await opt.locator("#toolbar-list li").evaluateAll((lis) => lis.map((l) => l.dataset.key));
check("↑ボタンで 1 つ上に移動する", after.indexOf("italicButton") === iItalic - 1, `${before[iItalic - 1]} の前へ`);
const focused = await opt.evaluate(() => document.activeElement?.closest("[data-key]")?.dataset.key);
check("↑ボタン後もフォーカスが同じ行に残る", focused === "italicButton", String(focused));

// 4. スタイル（標準テキスト）・フォントを非表示 → 間の区切り線が連続しないこと
await row("headingStyleSelect").locator(".switch").click();
await row("docs-font-family").locator(".switch").click();
await opt.waitForTimeout(1500);
s = await docsState();
const seps = new Set(["headingStyleSeparator", "fontFamilySelectSeparator", "fontSizeSelectSeparator", "textControlsInsertSeparator", "commentSeparator", "alignSeparator", "inputToolsSeparator"]);
let doubled = false;
s.vis.forEach((id, i) => {
  if (seps.has(id) && seps.has(s.vis[i + 1])) doubled = true;
});
check("連続する区切り線が自動で隠れる", !doubled, `隠した区切り線: ${s.collapsed.join(",") || "なし"}`);
check("フォントサイズ（−/11/+）はまとめて扱われる", s.vis.includes("fontSizeDecrement") && s.vis.includes("fontSizeIncrement"));

// 5. 左右端：検索ボタンを非表示
await opt.locator('#edge-list li[data-key="docs-omnibox-toolbar"] .switch').click();
await opt.waitForTimeout(1200);
const omni = await docs.evaluate(() => getComputedStyle(document.querySelector("#docs-omnibox-toolbar")).display);
check("左端の検索ボタンを非表示にできる", omni === "none");

console.log("Docs の見た目の並び:", s.vis.join(" "));
console.log(await shot(opt, "qa-options-after", { fullPage: false }));
await docs.bringToFront();
await docs.waitForTimeout(800);
console.log(await shot(docs, "qa-docs-toolbar-custom", { clip: { x: 0, y: 0, width: 1536, height: 130 } }));
console.log(results.join("\n"));
process.exit(0);
