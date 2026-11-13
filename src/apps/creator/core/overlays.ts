/* overlays: the bottom sheet and the toast. */
import { $, liquid, esc, RM } from "./dom";
import { icon, type IconName } from "./icons";

export type CloseSheet = (instant?: boolean) => void;

export interface OpenSheetOptions {
  title: string;
  /** Markup, or a node to append. */
  body?: string | Node | null;
  /** Runs after the sheet is in the DOM, with the body element and the close function. */
  onMount?: (body: HTMLElement, close: CloseSheet) => void;
  wide?: boolean;
}

export interface SheetHandle {
  el: HTMLElement;
  close: CloseSheet;
}

let sheetEl: HTMLElement | null = null,
  scrimEl: HTMLElement | null = null,
  lastFocus: HTMLElement | null = null;

export function openSheet({ title, body, onMount, wide }: OpenSheetOptions): SheetHandle {
  closeSheet(true);
  lastFocus = document.activeElement as HTMLElement | null;
  scrimEl = document.createElement("div");
  scrimEl.className = "scrim";
  scrimEl.addEventListener("click", () => closeSheet());
  sheetEl = document.createElement("aside");
  sheetEl.className = "sheet light";
  sheetEl.setAttribute("role", "dialog");
  sheetEl.setAttribute("aria-modal", "true");
  sheetEl.setAttribute("aria-label", title);
  if (wide) sheetEl.style.width = "min(720px,100%)";
  $("#app")!.inert = true;
  $("#focusRoot")!.inert = true;
  sheetEl.innerHTML = `<div class="sheet-h"><p class="t-h2">${esc(title)}</p><button class="ibtn" type="button" data-close aria-label="Close">${icon("close")}</button></div><div class="sheet-b"></div>`;
  const b = $(".sheet-b", sheetEl)!;
  if (typeof body === "string") b.innerHTML = body;
  else if (body) b.append(body);
  document.body.append(scrimEl, sheetEl);
  $("[data-close]", sheetEl)!.addEventListener("click", () => closeSheet());
  sheetEl.addEventListener("keydown", e => {
    if (e.key === "Escape") closeSheet();
  });
  /* Reads the live slots on purpose, as the prototype does: a sheet closed before this frame throws here. */
  requestAnimationFrame(() => {
    scrimEl!.classList.add("on");
    sheetEl!.classList.add("on");
    const f = $("input,button:not([data-close]),select,textarea,a", b) || $("[data-close]", sheetEl!);
    f && f.focus({ preventScroll: true });
  });
  liquid(sheetEl);
  onMount && onMount(b, closeSheet);
  return { el: b, close: closeSheet };
}

export function closeSheet(instant?: boolean): void {
  if (!sheetEl) return;
  const s = sheetEl,
    c = scrimEl!;
  sheetEl = scrimEl = null;
  $("#app")!.inert = false;
  $("#focusRoot")!.inert = false;
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

let toastT: ReturnType<typeof setTimeout> | undefined;

export function toast(msg: string, ic: IconName = "check"): void {
  let t = $(".toast");
  if (!t) {
    t = document.createElement("div");
    t.className = "toast";
    t.setAttribute("role", "status");
    document.body.append(t);
  }
  t.innerHTML = `${icon(ic)}<span>${esc(msg)}</span>`;
  t.querySelector("svg")!.style.cssText = "width:18px;height:18px";
  requestAnimationFrame(() => t.classList.add("on"));
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove("on"), 3200);
}
