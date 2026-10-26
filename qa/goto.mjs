// 使い方: node qa/goto.mjs <url> [screenshotName]
import { connect, shot } from "./lib.mjs";

const [, , url, shotName] = process.argv;
const { context } = await connect();
const page = context.pages().find((p) => /docs\.google\.com/.test(p.url())) ?? (await context.newPage());
await page.bringToFront();
await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(6000);
console.log(page.url());
if (shotName) console.log("screenshot:", await shot(page, shotName));
process.exit(0);
