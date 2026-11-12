import { useSyncExternalStore } from "react";

let _version = 0;
const _listeners = new Set();

/* window.LLD.store is set synchronously by core.js, which is imported before this module. */
window.LLD.store.on(() => {
  _version++;
  _listeners.forEach(cb => cb());
});

function _subscribe(cb) {
  _listeners.add(cb);
  return () => _listeners.delete(cb);
}

function _getVersion() { return _version; }

export function useStore(selector) {
  useSyncExternalStore(_subscribe, _getVersion, _getVersion);
  return selector(window.LLD_DATA);
}
