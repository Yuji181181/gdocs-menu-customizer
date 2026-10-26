(() => {
  const tb = document.querySelector("#docs-toolbar");
  const el = document.querySelector("#clearFormattingButton");
  tb.insertBefore(el, tb.firstElementChild);
  return [...tb.children].slice(0, 4).map((c) => c.id);
})()
