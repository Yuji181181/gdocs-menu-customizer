// 生成したカラフルな画像をクリップボード経由でドキュメントに貼り付ける
import { connect, findPage, shot } from "./lib.mjs";

const { browser, context } = await connect();
const page = findPage(context, /document\/d\//);
await page.bringToFront();
const cdp = await browser.newBrowserCDPSession();
await cdp.send("Browser.grantPermissions", {
  origin: "https://docs.google.com",
  permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"],
});
await page.keyboard.press("Escape");
await page.keyboard.press("Backspace");
await page.keyboard.press("Backspace");
await page.waitForTimeout(500);
const ok = await page.evaluate(async () => {
  const c = document.createElement("canvas");
  c.width = 360;
  c.height = 160;
  const g = c.getContext("2d");
  const grad = g.createLinearGradient(0, 0, 360, 0);
  ["#ff3b30", "#ff9500", "#ffcc00", "#34c759", "#007aff", "#af52de"].forEach((col, i, a) => grad.addColorStop(i / (a.length - 1), col));
  g.fillStyle = grad;
  g.fillRect(0, 0, 360, 110);
  g.fillStyle = "#ffffff";
  g.fillRect(0, 110, 360, 50);
  g.fillStyle = "#000000";
  g.font = "bold 28px sans-serif";
  g.fillText("IMAGE 画像", 20, 145);
  const blob = await new Promise((r) => c.toBlob(r, "image/png"));
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
  return true;
});
console.log("clipboard", ok);
await page.keyboard.press("Control+V");
await page.waitForTimeout(4000);
console.log(await shot(page, "seed-done"));
process.exit(0);
