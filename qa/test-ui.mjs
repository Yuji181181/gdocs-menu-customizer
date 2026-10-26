// ポップアップ・設定画面（ライト/ダーク配色）の見た目を撮影する
import { connect, shot } from "./lib.mjs";
import { extensionId } from "./ext-id.mjs";

const { context } = await connect();
const base = `chrome-extension://${extensionId()}/src`;
const page = await context.newPage();

for (const scheme of ["light", "dark"]) {
  await page.emulateMedia({ colorScheme: scheme });
  await page.setViewportSize({ width: 352, height: 440 });
  await page.goto(`${base}/popup/popup.html`);
  await page.waitForTimeout(500);
  console.log(await shot(page, `qa-popup-${scheme}`));

  await page.setViewportSize({ width: 1280, height: 860 });
  for (const tab of ["toolbar", "menus"]) {
    await page.goto(`${base}/options/options.html#${tab}`);
    await page.waitForTimeout(600);
    console.log(await shot(page, `qa-options-${tab}-${scheme}`));
  }
}
await page.close();
process.exit(0);
