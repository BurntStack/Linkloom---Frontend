/* store: one in-memory state object, change events. */
import { seed } from "../data/seed";
import type { State } from "../types";

/** Receives the `why` passed to store.set. Screens match on it, e.g. "signed-in". */
export type StoreListener = (why?: string) => void;

export interface Store {
  /** The live state. Mutating it directly does not notify; use set() for that. */
  readonly s: State;
  /** Runs fn on the state, then notifies every listener. A listener that throws is logged and skipped. */
  set(fn: (s: State) => void, why?: string): void;
  /** Subscribes. The returned function unsubscribes. */
  on(f: StoreListener): () => boolean;
}

let state: State = seed;
const subs = new Set<StoreListener>();

export const store: Store = {
  get s() {
    return state;
  },
  set(fn, why) {
    fn(state);
    subs.forEach(f => {
      try {
        f(why);
      } catch (e) {
        console.error(e);
      }
    });
  },
  on(f) {
    subs.add(f);
    return () => subs.delete(f);
  },
};

/** Test-hook seam, not app API. The prototype's store read window.LLD_DATA, so assigning a new object there replaced the
    state. Only core/legacy-bridge.ts calls this, to keep that true. Deliberately not exported from the barrel. */
export const replaceState = (next: State): void => {
  state = next;
};
