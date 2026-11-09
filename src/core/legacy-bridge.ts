/* TEMPORARY. The one place that publishes the runtime to window, for files that still use globals and for the parity
   gate's test hooks. Must run after core and ui/select and before motion and the screens: main.ts imports it there.

   When everything is migrated: delete this file (and the replaceState seam in store.ts, and legacy-slots.ts), and keep
   only window.LLD and window.LLD_DATA, gated behind import.meta.env.VITE_TEST_HOOKS. No app code may read them.

   Deliberately no `declare global`: a migrated file that still says window.LLD must fail to compile. */
import { closeSelect, enhanceSelects } from "../ui/select";
import { gsap } from "../vendor-gsap";
import { LLD, store, type LLDRuntime, type State } from "./index";
import { replaceState } from "./store";

const globals = window as unknown as { LLD: LLDRuntime; LLD_DATA: State; gsap: typeof gsap };

/* The same object, so migrated and unmigrated modules share one runtime and unmigrated screens can attach slots to it. */
globals.LLD = LLD;

/* An accessor rather than a copy of the reference. window.LLD_DATA is always the object in store.s, including after a test
   preset assigns a new one, which the prototype's store getter would also have seen. */
Object.defineProperty(window, "LLD_DATA", {
  configurable: true,
  enumerable: true,
  get: () => store.s,
  set: (next: State) => replaceState(next),
});

/* motion.ts reads window.gsap until the motion agent imports it from @/vendor-gsap. */
globals.gsap = gsap;

/* The prototype's ui-select.js attached this at load. */
LLD.ui = { enhanceSelects, closeSelect };
