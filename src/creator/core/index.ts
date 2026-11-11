/* Core barrel: `import { LLD as L, type State } from "@/creator/core"`, or import the named helpers directly.
   Evaluating this module has the prototype's core.js load-time effects, in order: renderChrome subscribes to the store
   (first subscriber) and the router listens for hashchange. Nothing here touches the DOM until boot(). */
import { boot } from "./boot";
import { today } from "./clock";
import { $, $$, esc, liquid, RM } from "./dom";
import {
  ago,
  ageFrom,
  compact,
  D,
  daysLeft,
  FEE_EXAMPLE,
  fmtDate,
  initials,
  inr,
  payout,
  rupees,
} from "./format";
import { icon } from "./icons";
import { kycGate } from "./kyc-gate";
import type { JobKit, LegacyUi } from "./legacy-slots";
import { motion, type Motion } from "./motion-api";
import { closeSheet, openSheet, toast } from "./overlays";
import { getCurrent, go, register, route, views } from "./router";
import { store, type Store } from "./store";

/** The runtime object. Same members as the prototype's window.LLD. */
export interface LLDRuntime {
  RM: boolean;
  $: typeof $;
  $$: typeof $$;
  esc: typeof esc;
  inr: typeof inr;
  rupees: typeof rupees;
  compact: typeof compact;
  payout: typeof payout;
  FEE_EXAMPLE: typeof FEE_EXAMPLE;
  fmtDate: typeof fmtDate;
  daysLeft: typeof daysLeft;
  ago: typeof ago;
  ageFrom: typeof ageFrom;
  D: typeof D;
  store: Store;
  register: typeof register;
  go: typeof go;
  route: typeof route;
  views: typeof views;
  current: typeof getCurrent;
  kycGate: typeof kycGate;
  openSheet: typeof openSheet;
  closeSheet: typeof closeSheet;
  toast: typeof toast;
  liquid: typeof liquid;
  icon: typeof icon;
  initials: typeof initials;
  motion: Motion;
  today: typeof today;
  boot: typeof boot;
  /* Attached at load by modules that have not published named exports yet; see legacy-slots.ts. */
  ui?: LegacyUi;
  jobkit?: JobKit;
  openNotifications?: () => void;
}

/* Left extensible on purpose: unmigrated screens still attach slots to it. */
export const LLD: LLDRuntime = {
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
export { renderChrome } from "./chrome";
export { today } from "./clock";
export { $, $$, esc, liquid, RM } from "./dom";
export {
  ago,
  ageFrom,
  compact,
  D,
  daysLeft,
  FEE_EXAMPLE,
  fmtDate,
  initials,
  inr,
  payout,
  rupees,
} from "./format";
export type { InrOptions, Payout } from "./format";
export { icon } from "./icons";
export type { IconName } from "./icons";
export { kycGate } from "./kyc-gate";
export type { JobCardOptions, JobFactor, JobKit, JobWireOptions, JobWiring, LegacyUi } from "./legacy-slots";
export { motion } from "./motion-api";
export type * from "./motion-api";
export { closeSheet, openSheet, toast } from "./overlays";
export type { CloseSheet, OpenSheetOptions, SheetHandle } from "./overlays";
export { getCurrent as current, go, register, route, setRouteGuard, views } from "./router";
export type { RouteInfo, ViewCleanup, ViewDef, ViewText } from "./router";
export { store } from "./store";
export type { Store, StoreListener } from "./store";
export type * from "../types";
