// ウィンドウ幅を変えたときのツールバーのオーバーフロー挙動を調べる
// 使い方: node qa/probe-overflow.mjs <width> [shotName] [setupSnippet.js]
import { readFileSync } from "node:fs";
import { connect, findPage, shot } from "./lib.mjs";

const [, , width = "900", shotName, setup] = process.argv;
const { browser, context } = await connect();
const page = findPage(context, /document\/d\//);
await page.bringToFront();
const cdp = await browser.newBrowserCDPSession();
const targets = await cdp.send("Target.getTargets");
const target = targets.targetInfos.find((t) => t.type === "page" && /document\/d\//.test(t.url));
const { windowId } = await cdp.send("Browser.getWindowForTarget", { targetId: target.targetId });
await cdp.send("Browser.setWindowBounds", { windowId, bounds: { windowState: "normal" } });
await cdp.send("Browser.setWindowBounds", { windowId, bounds: { width: Number(width), height: 900 } });
if (setup) await page.evaluate(readFileSync(setup, "utf8"));
await page.waitForTimeout(1500);
const info = await page.evaluate(() => {
  const tb = document.querySelector("#docs-toolbar");
  const vis = [...tb.children].filter((c) => getComputedStyle(c).display !== "none").map((c) => c.id || c.className.slice(0, 20));
  const hiddenInline = [...tb.children].filter((c) => c.style.display === "none").map((c) => c.id);
  const more = document.querySelector("#moreButton");
  const ov = document.querySelector(".goog-menu.docs-menu-overflow");
  return {
    innerWidth,
    visibleCount: vis.length,
    lastVisible: vis.slice(-6),
    hiddenInline,
    moreVisible: getComputedStyle(more).display !== "none",
    moreCls: more.className,
    overflowMenuKids: ov ? [...ov.children].filter((c) => c.style.display !== "none").length : null,
    tbRight: Math.round(tb.getBoundingClientRect().right),
    sideLeft: Math.round(document.querySelector("#docs-side-toolbar").getBoundingClientRect().left),
  };
});
console.log(JSON.stringify(info, null, 2));
if (shotName) console.log(await shot(page, shotName));
process.exit(0);
