/* The motion API: safe no-ops until src/shared/motion.ts assigns real methods onto this object. */
export const motion = {
  enter() {},
  stagger() {},
  count(el, to, fmt) {
    if (el) el.textContent = fmt ? fmt(to) : String(to);
  },
  press() {},
  swipe() {
    return () => {};
  },
  reveal() {},
  celebrate() {},
  flip(fn) {
    fn && fn();
  },
};
