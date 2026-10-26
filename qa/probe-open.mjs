import { connect, findPage, shot } from "./lib.mjs";

const { context } = await connect();
const page = findPage(context, /document\/d\//);
await page.bringToFront();
await page.click("#docs-file-menu");
await page.waitForTimeout(800);
const info = await page.evaluate(() => {
  const open = [...document.querySelectorAll(".goog-menu")].filter((m) => getComputedStyle(m).display !== "none");
  return open.map((m) => ({
    style: m.getAttribute("style"),
    cls: m.className,
    item0: m.children[0].outerHTML.slice(0, 1500),
    sep: [...m.children].find((c) => c.getAttribute("role") === "separator")?.outerHTML.slice(0, 400),
    btnExpanded: document.querySelector("#docs-file-menu").getAttribute("aria-expanded"),
  }));
});
console.log(JSON.stringify(info, null, 2));
console.log(await shot(page, "file-menu-open"));
await page.keyboard.press("Escape");
process.exit(0);
