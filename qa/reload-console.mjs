// ドキュメントを再読み込みし、コンソールのエラー・警告を集める
import { connect, findPage } from "./lib.mjs";

const { context } = await connect();
const page = findPage(context, /document\/d\//);
const logs = [];
page.on("console", (m) => {
  if (["error", "warning"].includes(m.type()) || /gdmc/i.test(m.text())) logs.push(`[${m.type()}] ${m.text().slice(0, 300)}`);
});
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message.slice(0, 300)}`));
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(9000);
const state = await page.evaluate(() => ({
  style: Boolean(document.getElementById("gdmc-toolbar-style")),
  strengthAttr: document.documentElement.dataset.gdmcStrength ?? null,
}));
console.log(JSON.stringify(state));
console.log(logs.filter((l) => /gdmc|chrome-extension|content/i.test(l)).join("\n") || "(拡張機能関連のログなし)");
process.exit(0);
