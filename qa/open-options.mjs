// 設定画面を開いてスクリーンショットを撮る
// 使い方: node qa/open-options.mjs [hash] [shotName] [width] [height] [colorScheme]
import { connect, shot } from "./lib.mjs";
import { extensionId } from "./ext-id.mjs";

const [, , hash = "toolbar", shotName = "options", width = "1280", height = "900", scheme = "light"] = process.argv;
const { context } = await connect();
const url = `chrome-extension://${extensionId()}/src/options/options.html#${hash}`;
let page = context.pages().find((p) => p.url().includes("/src/options/options.html"));
if (!page) page = await context.newPage();
await page.setViewportSize({ width: Number(width), height: Number(height) });
await page.emulateMedia({ colorScheme: scheme });
await page.goto(url);
await page.waitForTimeout(800);
console.log(page.url(), await page.title());
console.log(await shot(page, shotName, { fullPage: true }));
process.exit(0);
