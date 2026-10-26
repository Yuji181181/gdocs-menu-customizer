[...document.querySelectorAll(".goog-menuitem")]
  .filter((i) => i.textContent.includes("新機能"))
  .slice(0, 1)
  .map((i) => i.outerHTML.replace(/ style="[^"]*"/g, "").slice(0, 1500))
