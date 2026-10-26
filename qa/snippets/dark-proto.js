(() => {
  const s = document.createElement("style");
  s.id = "gdmc-proto";
  s.textContent = `
    html { filter: invert(0.9) hue-rotate(180deg) !important; background: #fff !important; }
    img, video { filter: invert(1) hue-rotate(180deg); }
  `;
  document.getElementById("gdmc-proto")?.remove();
  document.head.append(s);
  return {
    menusParent: [...new Set([...document.querySelectorAll(".goog-menu")].map((m) => m.parentElement.tagName + "#" + m.parentElement.id + "." + m.parentElement.className.slice(0, 30)))],
    imgs: [...document.querySelectorAll("img")].filter((i) => i.offsetWidth).map((i) => i.className + " " + i.src.slice(0, 70)),
  };
})()
