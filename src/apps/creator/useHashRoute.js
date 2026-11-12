import { useSyncExternalStore } from "react";

function parseHash() {
  const h = location.hash.replace(/^#/, "") || "";
  const i = h.indexOf("-");
  return i < 0 ? { name: h, param: null } : { name: h.slice(0, i), param: h.slice(i + 1) };
}

/* Single mutable route reference; replaced on each change so Object.is detects the update. */
let _route = { ...parseHash(), _k: 0 };
const _listeners = new Set();

function _notify() {
  _listeners.forEach(cb => cb());
}

window.addEventListener("hashchange", () => {
  _route = { ...parseHash(), _k: 0 };
  _notify();
});

/* lld-route is dispatched by router.js when go() is called with the same hash (force re-render). */
window.addEventListener("lld-route", () => {
  _route = { ..._route, _k: _route._k + 1 };
  _notify();
});

function _subscribe(cb) {
  _listeners.add(cb);
  return () => _listeners.delete(cb);
}

function _getRoute() { return _route; }

export function useHashRoute() {
  return useSyncExternalStore(_subscribe, _getRoute, _getRoute);
}
