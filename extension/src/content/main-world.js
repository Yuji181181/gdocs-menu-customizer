// ページ本体（MAIN world）で動くスクリプト。
// Docs の本文は <canvas class="kix-canvas-tile-content"> に描かれ、ダークモードではページ全体を反転させている。
// 本文中の画像・カラー絵文字だけは描画時に逆補正をかけ、反転後に元の色で見えるようにする。
(() => {
  if (!location.pathname.startsWith("/document/")) return;

  const root = document.documentElement;
  const proto = CanvasRenderingContext2D.prototype;
  const origDrawImage = proto.drawImage;
  const origFillText = proto.fillText;
  const EMOJI_ONLY = /^(?=.*\p{Extended_Pictographic})[\p{Extended_Pictographic}\p{Emoji_Component}\u200d\ufe0f\s]+$/u;

  const isPhotoSource = (src) =>
    src instanceof HTMLImageElement ||
    src instanceof SVGImageElement ||
    src instanceof HTMLVideoElement ||
    (typeof ImageBitmap !== "undefined" && src instanceof ImageBitmap);

  function counterFilter(ctx) {
    if (!root.classList.contains("gdmc-dark-preserve-images")) return null;
    const canvas = ctx.canvas;
    if (!(canvas instanceof HTMLCanvasElement) || !canvas.classList.contains("kix-canvas-tile-content")) return null;
    const strength = Number(root.dataset.gdmcStrength) || 0.9;
    return `invert(1) hue-rotate(180deg) contrast(${1 / (2 * strength - 1)})`;
  }

  function withFilter(ctx, filter, draw) {
    const prev = ctx.filter;
    ctx.filter = prev && prev !== "none" ? `${prev} ${filter}` : filter;
    try {
      return draw();
    } finally {
      ctx.filter = prev;
    }
  }

  proto.drawImage = function (src, ...args) {
    const filter = isPhotoSource(src) && counterFilter(this);
    if (!filter) return origDrawImage.call(this, src, ...args);
    return withFilter(this, filter, () => origDrawImage.call(this, src, ...args));
  };

  proto.fillText = function (text, ...args) {
    const filter = typeof text === "string" && EMOJI_ONLY.test(text) && counterFilter(this);
    if (!filter) return origFillText.call(this, text, ...args);
    return withFilter(this, filter, () => origFillText.call(this, text, ...args));
  };
})();
