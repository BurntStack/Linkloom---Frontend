/* store: one in-memory state object, change events. */
import { seed } from "../data/seed";

let state = seed;
const subs = new Set();

export const store = {
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

export const replaceState = (next) => {
  state = next;
};
