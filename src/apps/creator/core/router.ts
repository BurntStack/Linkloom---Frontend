/* router: #name or #name-param */
import { renderChrome } from "./chrome";
import { $, $$, liquid } from "./dom";
import { motion } from "./motion-api";
import { closeSheet } from "./overlays";
import { store } from "./store";

/** Runs when the route changes away. */
export type ViewCleanup = () => void;
/** The param is the part of the hash after the first "-", or null. */
export type ViewText = string | ((param: string | null) => string);

export interface ViewDef {
  /** Document title, without the " · Linkloom" suffix. */
  title?: ViewText;
  /** Markup for the header crumb. */
  crumb?: ViewText;
  /** Which [data-nav] item to mark current. Defaults to the view's name. */
  nav?: string;
  /** false: reachable signed out. */
  auth?: boolean;
  /** "focus": render in #focusRoot, with the app shell hidden. */
  shell?: "focus";
  render(el: HTMLElement, param: string | null): ViewCleanup | void;
}

export interface RouteInfo {
  name: string;
  param: string | null;
}

/* A plain object on purpose: names come straight from the hash, and the prototype's lookup includes inherited keys. */
export const views: Record<string, ViewDef> = {};
let current: RouteInfo | null = null,
  cleanup: ViewCleanup | null = null;
let booted = false,
  routed = false;

export const register = (name: string, def: ViewDef): void => {
  views[name] = def;
  if (booted) route();
};
const parse = (): RouteInfo => {
  const h = location.hash.replace(/^#/, "");
  const i = h.indexOf("-");
  return i < 0 ? { name: h, param: null } : { name: h.slice(0, i), param: h.slice(i + 1) };
};
export const go = (hash: string): void => {
  if (location.hash === hash) route();
  else location.hash = hash;
};
/** The route showing now. Null only before the first route has run. */
export const getCurrent = (): RouteInfo | null => current;
/** boot.ts calls this once. From then on, a late register() routes at once. */
export const markBooted = (): void => {
  booted = true;
};

/** Lets the app send a route elsewhere before it renders. Returns the hash to go to, or null to carry on. */
const liveApi = (): { promptSignIn?: () => void } | undefined =>
  (window as unknown as { LLD?: { live?: { promptSignIn?: () => void } } }).LLD?.live;

export type RouteGuard = (name: string) => string | null;
/** Screens a signed-out visitor may look at, read-only. Empty in the parity build. */
let guestRoutes: ReadonlySet<string> = new Set();
export const setGuestRoutes = (r: ReadonlySet<string>): void => {
  guestRoutes = r;
};
let guard: RouteGuard | null = null;
export const setRouteGuard = (g: RouteGuard): void => {
  guard = g;
};

export function route(): void {
  let { name, param } = parse();
  if (!views[name]) {
    name = store.s.session.signedIn || store.s.session.guest ? "home" : "login";
    param = null;
  }
  const v: ViewDef = views[name] || {
    title: "Linkloom",
    render: el => {
      el.innerHTML = '<div class="empty"><p class="t-h2">This screen is being built.</p></div>';
    },
  };
  const guestOk = !!store.s.session.guest && guestRoutes.has(name) && !param;
  if (v.auth !== false && !store.s.session.signedIn && !guestOk && name !== "login") {
    if (store.s.session.guest) {
      location.replace("#home");
      setTimeout(() => liveApi()?.promptSignIn?.(), 0);
      return;
    }
    location.replace("#login");
    return;
  }
  const redirect = guard?.(name);
  if (redirect) {
    location.replace(redirect);
    return;
  }
  if (cleanup) {
    try {
      cleanup();
    } catch (e) {}
    cleanup = null;
  }
  closeSheet(true);
  const focus = v.shell === "focus";
  $("#app")!.hidden = focus;
  $("#focusRoot")!.hidden = !focus;
  const old = focus ? $("#focusRoot")! : $("#view")!;
  const el = old.cloneNode(false) as HTMLElement;
  old.replaceWith(el); // fresh outlet each route, so listeners never pile up
  current = { name, param };
  document.title =
    (v.title ? (typeof v.title === "function" ? v.title(param) : v.title) + " · " : "") + "Linkloom";
  $$("[data-nav]").forEach(a => {
    if (a.dataset.nav === (v.nav || name)) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  const crumb = $("#crumb");
  if (crumb) {
    const c = v.crumb ? (typeof v.crumb === "function" ? v.crumb(param) : v.crumb) : "";
    crumb.innerHTML = c;
    crumb.hidden = !c;
  }
  try {
    cleanup = v.render(el, param) || null;
  } catch (e) {
    console.error(e);
    el.innerHTML = `<div class="empty"><p class="t-h2">This screen could not load.</p><p class="muted">Reload the page to try again.</p></div>`;
  }
  liquid(el);
  if (!focus) window.scrollTo({ top: 0, behavior: "auto" });
  if (routed) {
    const f = focus ? $("#focusRoot")! : $("#view")!;
    f.setAttribute("tabindex", "-1");
    f.focus({ preventScroll: true });
  }
  routed = true;
  motion.enter(el, { name });
  renderChrome();
}
addEventListener("hashchange", route);
