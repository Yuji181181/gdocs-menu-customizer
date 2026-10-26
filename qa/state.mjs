// 拡張機能の状態をまとめて確認する（content script が動いているか、ツールバーの見た目の並び、生成 CSS など）
import { connect, findPage, shot } from "./lib.mjs";

const [, , shotName, clip] = process.argv;
const { context } = await connect();
const page = findPage(context, /document\/d\//);
const info = await page.evaluate(() => {
  const tb = document.querySelector("#docs-toolbar");
  const visual = [...tb.children]
    .filter((c) => getComputedStyle(c).display !== "none")
    .map((c) => ({ id: c.id, x: Math.round(c.getBoundingClientRect().x) }))
    .sort((a, b) => a.x - b.x)
    .map((c) => c.id);
  const css = document.getElementById("gdmc-toolbar-style")?.textContent ?? null;
  return {
    htmlClass: document.documentElement.className,
    toolbarDisplay: getComputedStyle(tb).display,
    visual,
    collapsed: [...document.querySelectorAll(".gdmc-sep-collapsed")].map((e) => e.id),
    cssRules: css ? css.split("\n").length : null,
    moreVisible: getComputedStyle(document.querySelector("#moreButton")).display !== "none",
    tbRight: Math.round(tb.getBoundingClientRect().right),
    sideLeft: Math.round(document.querySelector("#docs-side-toolbar").getBoundingClientRect().left),
    tbTop: Math.round(tb.getBoundingClientRect().top),
  };
});
console.log(JSON.stringify(info, null, 1));
if (shotName) {
  const opts = clip === "toolbar" ? { clip: { x: 0, y: 0, width: page.viewportSize()?.width ?? 1500, height: 130 } } : {};
  console.log(await shot(page, shotName, opts));
}
process.exit(0);
