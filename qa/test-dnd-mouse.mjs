// 実マウス操作（押下→段階的に移動→離す）でのドラッグ＆ドロップを確認する
import { connect, shot } from "./lib.mjs";

const { context } = await connect();
const opt = context.pages().find((p) => p.url().includes("/src/options/options.html"));
await opt.bringToFront();
const keys = () => opt.locator("#toolbar-list li").evaluateAll((lis) => lis.map((l) => l.dataset.key));
const before = await keys();
const srcKey = process.argv[2] ?? "zoomSelect";
await opt.evaluate(() => window.scrollTo(0, 0));
const src = await opt.locator(`#toolbar-list li[data-key="${srcKey}"] .handle`).boundingBox();
const dst = await opt.locator('#toolbar-list li[data-key="redoButton"]').boundingBox();
await opt.mouse.move(src.x + src.width / 2, src.y + src.height / 2);
await opt.mouse.down();
await opt.mouse.move(src.x + 10, src.y - 30, { steps: 5 });
await opt.mouse.move(dst.x + 60, dst.y + 6, { steps: 20 });
await opt.waitForTimeout(200);
console.log(await shot(opt, "qa-dnd-indicator"));
await opt.mouse.up();
await opt.waitForTimeout(800);
const after = await keys();
console.log("before:", before.slice(0, 4).join(","), "...", "idx", before.indexOf(srcKey));
console.log("after :", after.slice(0, 4).join(","), "idx", after.indexOf(srcKey));
process.exit(0);
