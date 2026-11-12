/* Core barrel: `import { LLD as L } from "@/apps/creator/core"`, or import named helpers directly. */
import { boot } from "./boot";
import { today } from "./clock";
import { $, $$, esc, liquid, RM } from "./dom";
import { ago, ageFrom, compact, D, daysLeft, FEE_EXAMPLE, fmtDate, initials, inr, payout, rupees } from "./format";
import { icon } from "./icons";
import { kycGate } from "./kyc-gate";
import { motion } from "./motion-api";
import { closeSheet, openSheet, toast } from "./overlays";
import { getCurrent, go, register, route, views } from "./router";
import { store } from "./store";

export const LLD = {
  RM,
  $,
  $$,
  esc,
  inr,
  rupees,
  compact,
  payout,
  FEE_EXAMPLE,
  fmtDate,
  daysLeft,
  ago,
  ageFrom,
  D,
  store,
  register,
  go,
  route,
  views,
  current: getCurrent,
  kycGate,
  openSheet,
  closeSheet,
  toast,
  liquid,
  icon,
  initials,
  motion,
  today,
  boot,
};

export { boot } from "./boot";
export { today } from "./clock";
export { $, $$, esc, liquid, RM } from "./dom";
export { ago, ageFrom, compact, D, daysLeft, FEE_EXAMPLE, fmtDate, initials, inr, payout, rupees } from "./format";
export { icon } from "./icons";
export { kycGate } from "./kyc-gate";
export { motion } from "./motion-api";
export { closeSheet, openSheet, toast } from "./overlays";
export { getCurrent as current, getGuard, getGuestRoutes, go, register, route, setGuestRoutes, setRouteGuard, views } from "./router";
export { store } from "./store";
