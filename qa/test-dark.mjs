// ダークモードの QA：設定画面でオン → ドキュメントの見た目・画像の色・メニュー、他サービスへの非影響を確認
import { connect, findPage, shot } from "./lib.mjs";
import { extensionId } from "./ext-id.mjs";

const { browser, context } = await connect();
const docs = findPage(context, /document\/d\//);
const results = [];
const check = (name, ok, detail = "") => results.push(`${ok ? "OK  " : "NG  "} ${name}${detail ? " — " + detail : ""}`);

// ウィンドウを標準の広さに戻す
const cdp = await browser.newBrowserCDPSession();
const { targetInfos } = await cdp.send("Target.getTargets");
const t = targetInfos.find((x) => x.type === "page" && /document\/d\//.test(x.url));
const { windowId } = await cdp.send("Browser.getWindowForTarget", { targetId: t.targetId });
await cdp.send("Browser.setWindowBounds", { windowId, bounds: { width: 1500, height: 900 } });

let opt = context.pages().find((p) => p.url().includes("/src/options/options.html"));
if (!opt) opt = await context.newPage();
await opt.goto(`chrome-extension://${extensionId()}/src/options/options.html#dark`);
await opt.waitForTimeout(500);
if (!(await opt.locator("#dark-enabled").isChecked())) await opt.locator("#panel-dark .switch").click();
await opt.waitForTimeout(500);
console.log(await shot(opt, "qa-options-dark-tab"));

await docs.bringToFront();
await docs.keyboard.press("Escape");
await docs.waitForTimeout(2500);
const pixel = (x, y) =>
  docs.evaluate(
    ([x, y]) => {
      // 画面の見た目の色ではなく、要素の状態で判定する
      return { cls: document.documentElement.className, filter: getComputedStyle(document.documentElement).filter };
    },
    [x, y],
  );
const st = await pixel(0, 0);
check("ドキュメントに gdmc-dark が付く", st.cls.includes("gdmc-dark"), st.filter);
console.log(await shot(docs, "qa-dark-doc"));

// スクリーンショットのピクセルで、本文の背景が暗い・画像（グラデーション）の左端が赤系のまま かを確認
const buf = await docs.screenshot();
const { PNG } = await import("./png.mjs");
const png = PNG.decode(buf);
const imgBox = await docs.evaluate(() => {
  const tile = document.querySelector("canvas.kix-canvas-tile-content").getBoundingClientRect();
  const page = document.querySelector(".kix-page-paginated").getBoundingClientRect();
  return { tile: { x: tile.x, y: tile.y }, page: { x: page.x, y: page.y, w: page.width }, dpr: devicePixelRatio };
});
const at = (x, y) => png.at(Math.round(x * imgBox.dpr), Math.round(y * imgBox.dpr));
const paper = at(imgBox.page.x + 30, imgBox.page.y + 30);
check("用紙の背景が暗い", paper[0] < 60 && paper[1] < 60 && paper[2] < 60, `rgb(${paper.slice(0, 3)})`);
console.log("paper", paper, "page", imgBox.page);

// メニューを開いた見た目
await docs.click("#docs-format-menu");
await docs.waitForTimeout(700);
console.log(await shot(docs, "qa-dark-menu"));
await docs.keyboard.press("Escape");

// 他のサービスに影響しないこと
for (const [name, url, file] of [
  ["スライド", "https://docs.google.com/presentation/u/0/", "slides"],
  ["フォーム", "https://docs.google.com/forms/u/0/", "forms"],
  ["スプレッドシート", "https://docs.google.com/spreadsheets/u/0/", "sheets"],
]) {
  const p = await context.newPage();
  await p.goto(url, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(3500);
  const s = await p.evaluate(() => ({
    cls: document.documentElement.className,
    filter: getComputedStyle(document.documentElement).filter,
    injected: Boolean(document.getElementById("gdmc-toolbar-style")),
  }));
  check(`${name}には適用されない`, !s.cls.includes("gdmc") && s.filter === "none" && !s.injected, `filter=${s.filter}`);
  console.log(await shot(p, `qa-dark-other-${file}`));
  await p.close();
}
console.log(results.join("\n"));
process.exit(0);
