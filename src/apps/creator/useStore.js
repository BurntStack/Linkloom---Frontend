import { useSyncExternalStore } from "react";
import { store } from "./core/store";

/* One module-level store subscription drives all useStore hooks. */
let _version = 0;
const _listeners = new Set();

store.on(() => {
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
  return selector(store.s);
}
