(() => {
  const tb = document.querySelector("#docs-toolbar");
  const desc = (el, depth = 0) => {
    const cs = getComputedStyle(el);
    const o = {
      tag: el.tagName,
      id: el.id || undefined,
      cls: el.className?.toString().slice(0, 120),
      role: el.getAttribute("role") || undefined,
      aria: el.getAttribute("aria-label") || undefined,
      tip: el.getAttribute("data-tooltip") || undefined,
      disp: cs.display,
      w: Math.round(el.getBoundingClientRect().width),
    };
    if (depth < 2 && el.children.length && !el.getAttribute("role")) o.kids = [...el.children].map((c) => desc(c, depth + 1));
    return o;
  };
  return {
    parent: tb.parentElement.id + " " + tb.parentElement.className,
    tb: { cls: tb.className, disp: getComputedStyle(tb).display, w: tb.getBoundingClientRect().width },
    kids: [...tb.children].map((c) => desc(c)),
  };
})()
