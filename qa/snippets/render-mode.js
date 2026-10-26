(() => ({
  canvases: document.querySelectorAll("canvas.kix-canvas-tile-content").length,
  tiles: document.querySelectorAll(".kix-canvas-tile-content").length,
  tileTag: document.querySelector(".kix-canvas-tile-content")?.tagName,
  svgInTiles: document.querySelectorAll(".kix-canvas-tile-content svg, svg.kix-canvas-tile-content").length,
  lineviews: document.querySelectorAll(".kix-lineview").length,
  page: document.querySelector(".kix-page-paginated")?.className,
  editorBg: getComputedStyle(document.querySelector(".kix-appview-editor")).backgroundColor,
  bodyBg: getComputedStyle(document.body).backgroundColor,
  iframes: [...document.querySelectorAll("iframe")].map((f) => f.className + "|" + (f.src || "").slice(0, 60)),
}))()
