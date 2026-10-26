(async () => {
  const P = CanvasRenderingContext2D.prototype;
  const log = { drawImage: {}, fillText: 0, fillStyles: {}, other: {} };
  const origDraw = P.drawImage;
  const origFillText = P.fillText;
  const desc = Object.getOwnPropertyDescriptor(P, "fillStyle");
  P.drawImage = function (src, ...rest) {
    if (this.canvas.classList?.contains("kix-canvas-tile-content")) {
      const k = src.constructor.name + (src.className ? "." + src.className : "") + ` ${src.width}x${src.height}`;
      log.drawImage[k] = (log.drawImage[k] || 0) + 1;
    }
    return origDraw.call(this, src, ...rest);
  };
  P.fillText = function (...a) {
    if (this.canvas.classList?.contains("kix-canvas-tile-content")) log.fillText++;
    return origFillText.apply(this, a);
  };
  Object.defineProperty(P, "fillStyle", {
    ...desc,
    set(v) {
      if (this.canvas.classList?.contains("kix-canvas-tile-content")) {
        const k = typeof v === "string" ? v : v.constructor.name;
        log.fillStyles[k] = (log.fillStyles[k] || 0) + 1;
      }
      return desc.set.call(this, v);
    },
  });
  for (const m of ["fillRect", "strokeRect", "fill", "stroke", "clearRect", "putImageData"]) {
    const o = P[m];
    P[m] = function (...a) {
      if (this.canvas.classList?.contains("kix-canvas-tile-content")) log.other[m] = (log.other[m] || 0) + 1;
      return o.apply(this, a);
    };
  }
  const sc = document.querySelector(".kix-appview-editor");
  sc.scrollTop += 400;
  await new Promise((r) => setTimeout(r, 800));
  sc.scrollTop -= 400;
  await new Promise((r) => setTimeout(r, 1200));
  const tile = document.querySelector("canvas.kix-canvas-tile-content");
  const page = document.querySelector(".kix-page-paginated");
  return {
    log,
    tileBg: getComputedStyle(tile).backgroundColor,
    pageBg: getComputedStyle(page).backgroundColor,
    tileParentChain: [tile.parentElement, tile.parentElement.parentElement].map((e) => e.className),
    tiles: document.querySelectorAll("canvas.kix-canvas-tile-content").length,
  };
})()
