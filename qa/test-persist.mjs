// 再読み込み後も設定が最初から効いているか／狭い幅で設定を変えたとき「もっと見る」の判定がやり直されるか
import { connect, findPage, shot } from "./lib.mjs";
import { extensionId } from "./ext-id.mjs";

const { browser, context } = await connect();
const docs = findPage(context, /document\/d\//);
const results = [];
const check = (name, ok, detail = "") => results.push(`${ok ? "OK  " : "NG  "} ${name}${detail ? " — " + detail : ""}`);

// 1. 再読み込み直後（DOMContentLoaded 時点）に CSS とダークモードが当たっているか
await docs.bringToFront();
await docs.reload({ waitUntil: "domcontentloaded" });
const early = await docs.evaluate(() => ({
  style: (document.getElementById("gdmc-toolbar-style")?.textContent ?? "").length,
  dark: document.documentElement.classList.contains("gdmc-dark"),
}));
check("読み込み直後からツールバーの CSS が当たっている", early.style > 0, `${early.style} 文字`);
check("読み込み直後からダークモードが当たっている（白い点滅なし）", early.dark);
await docs.waitForTimeout(6000);
const vis = await docs.evaluate(() =>
  [...document.querySelector("#docs-toolbar").children]
    .filter((c) => getComputedStyle(c).display !== "none")
    .map((c) => ({ id: c.id, x: c.getBoundingClientRect().x }))
    .sort((a, b) => a.x - b.x)
    .map((c) => c.id),
);
check("再読み込み後も太字が先頭・印刷は非表示", vis[0] === "boldButton" && !vis.includes("printButton"), vis.slice(0, 3).join(","));

// 2. 狭い幅で、設定画面からボタンを非表示にする → 空いた分だけバブルからボタンが戻るか
const cdp = await browser.newBrowserCDPSession();
const { targetInfos } = await cdp.send("Target.getTargets");
const t = targetInfos.find((x) => x.type === "page" && /document\/d\//.test(x.url));
const { windowId } = await cdp.send("Browser.getWindowForTarget", { targetId: t.targetId });
await cdp.send("Browser.setWindowBounds", { windowId, bounds: { width: 950, height: 900 } });
await docs.waitForTimeout(2000);
const mainCount = () =>
  docs.evaluate(() => [...document.querySelector("#docs-toolbar").children].filter((c) => c.id && getComputedStyle(c).display !== "none").length);
const moreCount = () =>
  docs.evaluate(() => [...document.querySelector(".docs-toolbar-more-toolbar").children].filter((c) => c.id && getComputedStyle(c).display !== "none").length);
const before = { main: await mainCount(), more: await moreCount() };

let opt = context.pages().find((p) => p.url().includes("/src/options/options.html"));
if (!opt) opt = await context.newPage();
await opt.goto(`chrome-extension://${extensionId()}/src/options/options.html#toolbar`);
await opt.waitForTimeout(500);
for (const key of ["zoomSelect", "formatPainterButton", "insertImageButton"])
  await opt.locator(`#toolbar-list li[data-key="${key}"] .switch`).click();
await opt.waitForTimeout(2000);
const after = { main: await mainCount(), more: await moreCount() };
check("狭い幅で非表示にすると、バブル内のボタンがメインへ戻る", after.more < before.more, `バブル ${before.more} → ${after.more}`);
await docs.bringToFront();
console.log(await shot(docs, "qa-persist-narrow", { clip: { x: 0, y: 0, width: 940, height: 130 } }));

// 後片付け：今回非表示にしたものを戻し、幅も戻す
await opt.bringToFront();
for (const key of ["zoomSelect", "formatPainterButton", "insertImageButton"])
  await opt.locator(`#toolbar-list li[data-key="${key}"] .switch`).click();
await cdp.send("Browser.setWindowBounds", { windowId, bounds: { width: 1500, height: 900 } });
console.log(results.join("\n"));
process.exit(0);
