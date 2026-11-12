/* chrome: reactive badge/avatar data exposed for React's App shell.
   store.on() subscription is intentionally removed — React's useStore handles reactivity. */
import { esc } from "./dom";
import { fmtDate, inr } from "./format";
import { icon } from "./icons";
import { store } from "./store";

export function renderChrome() {
  const s = store.s;
  const unread = s.threads.reduce((n, t) => n + t.unread, 0);
  const nb = s.notifications.filter(n => !n.read).length;
  const held = s.active.filter(a => a.pay === "escrow").reduce((n, a) => n + a.price, 0);
  return {
    unread,
    nb,
    held,
    name: s.me.name,
    handle: [s.me.handle, s.me.city].filter(Boolean).join(" · "),
    photo: s.me.photo,
    ready: s.readyToWithdraw || 0,
    plan: s.plan,
  };
}
