import { connect, findPage } from "./lib.mjs";

const { context } = await connect();
const page = findPage(context, /document\/d\//);
await page.addInitScript(() => {
  const P = CanvasRenderingContext2D.prototype;
  const log = (window.__trace = { drawImage: {}, fillText: 0, fillStyles: {}, other: {}, filters: {} });
  const isTile = (ctx) => ctx.canvas.classList?.contains("kix-canvas-tile-content");
  const origDraw = P.drawImage;
  P.drawImage = function (src, ...rest) {
    if (isTile(this)) {
      const k = `${src.constructor.name}${src.className ? "." + src.className : ""} ${src.width}x${src.height} args=${rest.length}`;
      log.drawImage[k] = (log.drawImage[k] || 0) + 1;
    }
    return origDraw.call(this, src, ...rest);
  };
  const ft = P.fillText;
  P.fillText = function (...a) {
    if (isTile(this)) log.fillText++;
    return ft.apply(this, a);
  };
  const desc = Object.getOwnPropertyDescriptor(P, "fillStyle");
  Object.defineProperty(P, "fillStyle", {
    ...desc,
    set(v) {
      if (isTile(this)) {
        const k = typeof v === "string" ? v : v.constructor.name;
        log.fillStyles[k] = (log.fillStyles[k] || 0) + 1;
      }
      return desc.set.call(this, v);
    },
  });
  for (const m of ["fillRect", "strokeRect", "fill", "stroke", "clearRect", "putImageData"]) {
    const o = P[m];
    P[m] = function (...a) {
      if (isTile(this)) log.other[m] = (log.other[m] || 0) + 1;
      return o.apply(this, a);
    };
  }
});
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(8000);
console.log(JSON.stringify(await page.evaluate(() => window.__trace), null, 2));
process.exit(0);
