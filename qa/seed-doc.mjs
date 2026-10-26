// テスト用ドキュメントにサンプル本文（見出し・本文・リンク・画像）を入れる
import { connect, findPage, shot } from "./lib.mjs";

const { context } = await connect();
const page = findPage(context, /document\/d\//);
await page.bringToFront();
await page.click(".kix-page-paginated", { position: { x: 200, y: 120 } });
await page.waitForTimeout(500);
await page.keyboard.press("Control+Alt+1");
await page.keyboard.type("ダークモード検証用の見出し");
await page.keyboard.press("Enter");
await page.keyboard.press("Control+Alt+0");
await page.keyboard.type("これは本文テキストです。The quick brown fox jumps over the lazy dog. ");
await page.keyboard.press("Enter");
await page.keyboard.type("https://www.google.com ");
await page.keyboard.press("Enter");
await page.keyboard.press("Enter");

// 挿入 > 画像 > URL を指定して画像を挿入
await page.click("#docs-insert-menu");
await page.waitForTimeout(500);
await page.locator(".goog-menu:visible .goog-menuitem", { hasText: "画像" }).first().hover();
await page.waitForTimeout(800);
await page.locator(".goog-menu:visible .goog-menuitem", { hasText: "URL" }).first().click();
await page.waitForTimeout(1200);
await page.keyboard.type("https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/280px-PNG_transparency_demonstration_1.png");
await page.waitForTimeout(3000);
console.log(await shot(page, "seed-dialog"));
await page.keyboard.press("Enter");
await page.waitForTimeout(3000);
console.log(await shot(page, "seed-done"));
process.exit(0);
