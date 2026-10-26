// おまけ機能（上段メニューバーとドロップダウン項目）の QA
import { connect, findPage, shot } from "./lib.mjs";
import { extensionId } from "./ext-id.mjs";

const { context } = await connect();
const docs = findPage(context, /document\/d\//);
let opt = context.pages().find((p) => p.url().includes("/src/options/options.html"));
if (!opt) opt = await context.newPage();
await opt.emulateMedia({ colorScheme: "light" });
await opt.goto(`chrome-extension://${extensionId()}/src/options/options.html#menus`);
await opt.waitForTimeout(600);
const results = [];
const check = (name, ok, detail = "") => results.push(`${ok ? "OK  " : "NG  " } ${name}${detail ? " — " + detail : ""}`);

// 拡張機能メニューを非表示、ヘルプを 2 回 ↑
await opt.locator('#menubar-list li[data-key="docs-extensions-menu"] .switch').click();
await opt.locator('#menubar-list li[data-key="docs-help-menu"] [data-role="up"]').click();
await opt.locator('#menubar-list li[data-key="docs-help-menu"] [data-role="up"]').click();
// ファイル > コピーを作成 を非表示
await opt.locator('#menubar-list li[data-key="docs-file-menu"] [data-role="drill"]').click();
await opt.locator('#items-list li[data-key="コピーを作成"] .switch').click();
await opt.waitForTimeout(1200);

await docs.bringToFront();
const bar = await docs.evaluate(() =>
  [...document.querySelectorAll("#docs-menubar > [id]")]
    .filter((b) => getComputedStyle(b).display !== "none")
    .map((b) => ({ t: b.textContent.trim(), x: b.getBoundingClientRect().x }))
    .sort((a, b) => a.x - b.x)
    .map((b) => b.t),
);
check("拡張機能メニューが非表示", !bar.includes("拡張機能"), bar.join(" "));
check("ヘルプが 2 つ前に移動", bar.indexOf("ヘルプ") === bar.indexOf("ツール") - 1, bar.join(" "));

await docs.click("#docs-file-menu");
await docs.waitForTimeout(700);
const items = await docs.evaluate(() => {
  const m = document.querySelector('.goog-menu[data-gdmc-menu="docs-file-menu"]');
  return [...m.children].filter((c) => getComputedStyle(c).display !== "none").map((c) => c.textContent.trim().slice(0, 12));
});
check("ファイル > コピーを作成 が非表示", !items.some((t) => t.startsWith("コピーを作成")), items.slice(0, 4).join(" / "));
console.log(await shot(docs, "qa-menus-file"));
await docs.keyboard.press("Escape");

// 元に戻す
await opt.bringToFront();
await opt.locator("#menubar-reset").click();
await opt.locator("#items-reset").click();
await opt.waitForTimeout(800);
console.log(results.join("\n"));
process.exit(0);
