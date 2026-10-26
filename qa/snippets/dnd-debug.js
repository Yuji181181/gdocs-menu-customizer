(() => {
  const ul = document.getElementById("toolbar-list");
  const src = ul.querySelector('li[data-key="boldButton"]');
  const dst = ul.querySelector('li[data-key="undoButton"]');
  const r = dst.getBoundingClientRect();
  const dt = new DataTransfer();
  const fire = (el, type, y) =>
    el.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt, clientX: r.x + 50, clientY: y }));
  fire(src, "dragstart", 0);
  fire(dst, "dragover", r.top + 3);
  fire(dst, "drop", r.top + 3);
  fire(src, "dragend", 0);
  return { draggable: src.getAttribute("draggable") };
})()
