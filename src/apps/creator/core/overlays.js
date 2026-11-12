/* overlays: the bottom sheet and the toast. */
import { $, liquid, esc, RM } from "./dom";
import { icon } from "./icons";

let sheetEl = null, scrimEl = null, lastFocus = null;

export function openSheet({ title, body, onMount, wide }) {
  closeSheet(true);
  lastFocus = document.activeElement;
  scrimEl = document.createElement("div");
  scrimEl.className = "scrim";
  scrimEl.addEventListener("click", () => closeSheet());
  sheetEl = document.createElement("aside");
  sheetEl.className = "sheet light";
  sheetEl.setAttribute("role", "dialog");
  sheetEl.setAttribute("aria-modal", "true");
  sheetEl.setAttribute("aria-label", title);
  if (wide) sheetEl.style.width = "min(720px,100%)";
  const appEl = $("#app");
  const focusRootEl = $("#focusRoot");
  if (appEl) appEl.inert = true;
  if (focusRootEl) focusRootEl.inert = true;
  sheetEl.innerHTML = `<div class="sheet-h"><p class="t-h2">${esc(title)}</p><button class="ibtn" type="button" data-close aria-label="Close">${icon("close")}</button></div><div class="sheet-b"></div>`;
  const b = $(".sheet-b", sheetEl);
  if (typeof body === "string") b.innerHTML = body;
  else if (body) b.append(body);
  document.body.append(scrimEl, sheetEl);
  $("[data-close]", sheetEl).addEventListener("click", () => closeSheet());
  sheetEl.addEventListener("keydown", e => {
    if (e.key === "Escape") closeSheet();
  });
  requestAnimationFrame(() => {
    scrimEl.classList.add("on");
    sheetEl.classList.add("on");
    const f = $("input,button:not([data-close]),select,textarea,a", b) || $("[data-close]", sheetEl);
    f && f.focus({ preventScroll: true });
  });
  liquid(sheetEl);
  onMount && onMount(b, closeSheet);
  return { el: b, close: closeSheet };
}

export function closeSheet(instant) {
  if (!sheetEl) return;
  const s = sheetEl, c = scrimEl;
  sheetEl = scrimEl = null;
  const appEl = $("#app");
  const focusRootEl = $("#focusRoot");
  if (appEl) appEl.inert = false;
  if (focusRootEl) focusRootEl.inert = false;
  if (instant || RM) {
    s.remove();
    c.remove();
  } else {
    s.classList.remove("on");
    c.classList.remove("on");
    setTimeout(() => {
      s.remove();
      c.remove();
    }, 500);
  }
  lastFocus && lastFocus.focus && lastFocus.focus({ preventScroll: true });
}

let toastT;

export function toast(msg, ic = "check") {
  let t = $(".toast");
  if (!t) {
    t = document.createElement("div");
    t.className = "toast";
    t.setAttribute("role", "status");
    document.body.append(t);
  }
  t.innerHTML = `${icon(ic)}<span>${esc(msg)}</span>`;
  const svg = t.querySelector("svg");
  if (svg) svg.style.cssText = "width:18px;height:18px";
  requestAnimationFrame(() => t.classList.add("on"));
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove("on"), 3200);
}
