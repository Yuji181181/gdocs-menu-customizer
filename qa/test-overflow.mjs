// 並べ替え・非表示を適用した状態でウィンドウ幅を狭め、「もっと見る」へのはみ出しが正しく動くか確認する
import { connect, findPage, shot } from "./lib.mjs";

const { browser, context } = await connect();
const docs = findPage(context, /document\/d\//);
await docs.bringToFront();
const cdp = await browser.newBrowserCDPSession();
const { targetInfos } = await cdp.send("Target.getTargets");
const target = targetInfos.find((t) => t.type === "page" && /document\/d\//.test(t.url));
const { windowId } = await cdp.send("Browser.getWindowForTarget", { targetId: target.targetId });
const setWidth = async (w) => {
  await cdp.send("Browser.setWindowBounds", { windowId, bounds: { windowState: "normal" } });
  await cdp.send("Browser.setWindowBounds", { windowId, bounds: { width: w, height: 900 } });
  await docs.waitForTimeout(1500);
};
const measure = () =>
  docs.evaluate(() => {
    const tb = document.querySelector("#docs-toolbar");
    const kids = [...tb.children].filter((c) => getComputedStyle(c).display !== "none");
    const right = Math.max(...kids.map((c) => c.getBoundingClientRect().right));
    const more = document.querySelector(".docs-toolbar-more-toolbar");
    return {
      innerWidth,
      mainVisual: kids
        .map((c) => ({ id: c.id, x: c.getBoundingClientRect().x }))
        .sort((a, b) => a.x - b.x)
        .map((c) => c.id),
      mainRight: Math.round(right),
      sideLeft: Math.round(document.querySelector("#docs-side-toolbar").getBoundingClientRect().left),
      moreVisible: getComputedStyle(document.querySelector("#moreButton")).display !== "none",
      moreDom: more ? [...more.children].map((c) => c.id) : [],
    };
  });

const results = [];
const check = (name, ok, detail = "") => results.push(`${ok ? "OK  " : "NG  "} ${name}${detail ? " — " + detail : ""}`);

for (const w of [1100, 900]) {
  await setWidth(w);
  const m = await measure();
  check(`幅 ${w}: ツールバーが右側のボタンと重ならない`, m.mainRight <= m.sideLeft, `右端 ${m.mainRight} / 右側開始 ${m.sideLeft}`);
  check(`幅 ${w}: 「もっと見る」が出ていて末尾にある`, m.moreVisible && m.mainVisual.at(-1) === "moreButton", m.mainVisual.slice(-3).join(","));
  check(`幅 ${w}: 先頭に移動した太字はメインに残る`, m.mainVisual[0] === "boldButton", m.mainVisual.slice(0, 3).join(","));
  console.log(await shot(docs, `qa-overflow-${w}`, { clip: { x: 0, y: 0, width: m.innerWidth, height: 130 } }));
}

// 「もっと見る」を開いて、中身にも並び順・非表示が効いているか
const mb = await docs.locator("#moreButton").boundingBox();
await docs.mouse.click(mb.x + mb.width / 2, mb.y + mb.height / 2);
await docs.waitForTimeout(800);
const bubble = await docs.evaluate(() => {
  const more = document.querySelector(".docs-toolbar-more-toolbar");
  const vis = [...more.children]
    .filter((c) => getComputedStyle(c).display !== "none")
    .map((c) => ({ id: c.id, x: c.getBoundingClientRect().x, y: c.getBoundingClientRect().y }))
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((c) => c.id);
  return { vis, shown: getComputedStyle(more.closest(".jfk-bubble")).display !== "none" };
});
check("「もっと見る」のバブルが開く", bubble.shown);
check("バブル内でも非表示のボタンは出ない", !bubble.vis.includes("printButton") && !bubble.vis.includes("spellGrammarCheckButton"));
console.log("バブル内:", bubble.vis.join(" "));
console.log(await shot(docs, "qa-overflow-bubble", { clip: { x: 0, y: 0, width: 900, height: 260 } }));
await docs.keyboard.press("Escape");

// 幅を戻すと全部メインに戻る
await setWidth(1500);
const wide = await measure();
check("幅を戻すと「もっと見る」が消え、太字が先頭", !wide.moreVisible && wide.mainVisual[0] === "boldButton", wide.mainVisual.slice(0, 3).join(","));
console.log(results.join("\n"));
process.exit(0);
