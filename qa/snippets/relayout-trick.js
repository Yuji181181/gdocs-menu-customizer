(async () => {
  document.getElementById("gdmc-test-hide")?.remove();
  const count = () => [...document.querySelector("#docs-toolbar").children].filter((c) => getComputedStyle(c).display !== "none").length;
  const before = count();
  const root = document.documentElement;
  const cw0 = root.clientWidth;
  const prev = root.style.getPropertyValue("overflow-y");
  root.style.setProperty("overflow-y", "scroll", "important");
  const cw1 = root.clientWidth;
  window.dispatchEvent(new Event("resize"));
  await new Promise((r) => setTimeout(r, 300));
  root.style.removeProperty("overflow-y");
  if (prev) root.style.setProperty("overflow-y", prev);
  window.dispatchEvent(new Event("resize"));
  await new Promise((r) => setTimeout(r, 1200));
  return { before, after: count(), cw0, cw1, innerWidth };
})()
