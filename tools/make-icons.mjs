// 拡張機能のアイコン PNG を生成する（検証用 Brave のキャンバスで描画して保存）
// 使い方: node qa/launch-brave.mjs のあとで node tools/make-icons.mjs
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { connect } from "../qa/lib.mjs";

const { context } = await connect();
const page = await context.newPage();
const sizes = [16, 32, 48, 128];
const dataUrls = await page.evaluate((sizes) => {
  return sizes.map((size) => {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d");
    const s = size / 128;
    g.scale(s, s);

    // 背景（角丸の正方形）
    const grad = g.createLinearGradient(0, 0, 128, 128);
    grad.addColorStop(0, "#4f7cff");
    grad.addColorStop(1, "#2b4fd6");
    g.fillStyle = grad;
    g.beginPath();
    g.roundRect(4, 4, 120, 120, 28);
    g.fill();

    // ツールバー（横長の帯と、並んだボタン）
    g.fillStyle = "rgba(255,255,255,0.22)";
    g.beginPath();
    g.roundRect(18, 26, 92, 30, 15);
    g.fill();
    g.fillStyle = "#ffffff";
    const xs = size <= 16 ? [30, 54, 78] : [28, 46, 64, 82];
    for (const x of xs) {
      g.beginPath();
      g.roundRect(x, 33, size <= 16 ? 18 : 14, 16, 4);
      g.fill();
    }

    // 三日月（ダークモード）。背景を削らないよう別レイヤーで切り抜いてから重ねる
    const moon = document.createElement("canvas");
    moon.width = moon.height = 128;
    const mg = moon.getContext("2d");
    mg.fillStyle = "#ffd76a";
    mg.beginPath();
    mg.arc(60, 90, 22, 0, Math.PI * 2);
    mg.fill();
    mg.globalCompositeOperation = "destination-out";
    mg.beginPath();
    mg.arc(73, 81, 19, 0, Math.PI * 2);
    mg.fill();
    g.drawImage(moon, 0, 0);
    return c.toDataURL("image/png");
  });
}, sizes);
await page.close();

sizes.forEach((size, i) => {
  const out = fileURLToPath(new URL(`../extension/icons/icon${size}.png`, import.meta.url));
  writeFileSync(out, Buffer.from(dataUrls[i].split(",")[1], "base64"));
  console.log("wrote", out);
});
process.exit(0);
