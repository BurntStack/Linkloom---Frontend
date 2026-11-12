/* Sets window.LLD, window.LLD_DATA, and window.gsap for screen files that still use globals. */
import { closeSelect, enhanceSelects } from "../ui/select";
import { gsap } from "../../../shared/vendor-gsap";
import { LLD, store } from "./index";
import { replaceState } from "./store";

window.LLD = LLD;

Object.defineProperty(window, "LLD_DATA", {
  configurable: true,
  enumerable: true,
  get: () => store.s,
  set: (next) => replaceState(next),
});

window.gsap = gsap;

LLD.ui = { enhanceSelects, closeSelect };
