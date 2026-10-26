(() => {
  const short = (el) => ({
    tag: el.tagName,
    id: el.id || undefined,
    cls: el.className?.toString().slice(0, 100),
    role: el.getAttribute("role") || undefined,
    aria: el.getAttribute("aria-label") || undefined,
    disp: getComputedStyle(el).display,
    w: Math.round(el.getBoundingClientRect().width),
    x: Math.round(el.getBoundingClientRect().x),
  });
  const prim = document.querySelector("#docs-primary-toolbars").parentElement;
  const chain = [];
  for (let e = prim; e && e !== document.body; e = e.parentElement) chain.push(short(e));
  const tb = document.querySelector("#docs-toolbar");
  const toolbarWrapper = tb.parentElement;
  return {
    chain,
    wrapperKids: [...toolbarWrapper.children].map(short),
    primKids: [...prim.children].map((c) => ({ ...short(c), kids: [...c.children].map(short) })),
    labels: [...tb.children].filter((c) => c.id).map((c) => [c.id, c.getAttribute("aria-label"), c.getAttribute("data-tooltip")]),
    moreBtn: short(document.querySelector("#moreButton")),
    overflowMenus: [...document.querySelectorAll(".docs-toolbar-more-button-menu, [class*=overflow]")].map(short).slice(0, 10),
  };
})()
