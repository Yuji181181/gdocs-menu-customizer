(() => {
  let s = document.getElementById("gdmc-test-hide");
  if (!s) {
    s = document.createElement("style");
    s.id = "gdmc-test-hide";
    document.head.append(s);
  }
  s.textContent = `#printButton, #spellGrammarCheckButton, #formatPainterButton, #zoomSelect, #headingStyleSeparator, #headingStyleSelect, #fontFamilySelectSeparator, #docs-font-family { display: none !important; }`;
  window.dispatchEvent(new Event("resize"));
  return "hidden";
})()
