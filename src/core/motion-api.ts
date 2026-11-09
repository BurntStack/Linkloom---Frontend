/* The motion API: the contract between src/motion (the implementation) and the screens (the callers).

   Core owns the `motion` object and seeds it with the eight no-ops below. src/motion assigns the real methods ONTO THIS
   SAME OBJECT when it loads (`Object.assign(motion, impl)`); never replace the object, since the router and every screen
   hold a reference to it. Check the implementation with `satisfies MotionImpl`.

   Members other than the eight are optional because they do not exist until src/motion has loaded. That is why screens
   guard them (`L.motion.print ? ... : ...`) and go through `mo()` in the job kit. */
import type { IconName } from "./icons";

/** Resolves when the animation has finished, or at once under reduced motion. Undefined from the core no-ops. */
export type MotionDone = Promise<void> | void;
/** An element that may be missing. Every method tolerates null and does nothing, or just applies its end state. */
export type MaybeElement = Element | null | undefined;
/** A selector, one element, or any list of elements (holes are skipped). */
export type MotionTargets = string | Element | ArrayLike<MaybeElement> | null | undefined;
/** A selector or a list, or a parent whose children are the items, or a function returning the items. Omit to skip the glide. */
export type FlipNodes = MotionTargets | (() => MotionTargets);
/** A token (coral, violet, butter, plum, escrow, ink, info, white, mist, paper, coral-deep, violet-deep, ok), a "--css-var", or any CSS colour. */
export type MotionColor = string;
export type CountFormat = (value: number) => string;
export type SwipeTone = "butter" | "coral" | "violet" | "ink" | "err" | "ok" | "warn";

export interface EnterContext {
  /** The route's view name. */
  name?: string;
}
export interface StaggerOptions {
  /** How many visible nodes to animate. Default 12. */
  max?: number;
  delay?: number;
  /** ms between nodes. */
  each?: number;
  /** Upper bound on the total added delay, in ms. */
  cap?: number;
  y?: number;
  dur?: number;
}
export interface CountOptions {
  /** Start value. Defaults to the last value shown on this element or key. */
  from?: number;
  /** Remembers the value across re-renders. Defaults to the element's id or data-key. */
  key?: string;
  decimals?: number;
  done?: () => void;
  /** Accepted but ignored: the implementation has fixed timing. bid.ts passes it. */
  duration?: number;
}
export interface SwipeOptions {
  onLeft?: () => void;
  onRight?: () => void;
  /** Distance in px that commits. Defaults to 28% of the width, clamped to 72 to 132. */
  threshold?: number;
  /** Plays the one-time "you can swipe this" nudge on touch devices. */
  hint?: boolean;
  leftLabel?: string;
  rightLabel?: string;
  leftIcon?: IconName;
  rightIcon?: IconName;
  leftTone?: SwipeTone;
  rightTone?: SwipeTone;
}
export interface RevealOptions {
  words?: boolean;
  stagger?: boolean;
  y?: number;
}
export interface CelebrateOptions {
  /** Short label shown in a pill while the stitch plays. */
  text?: string;
}
export interface FlipOptions {
  dur?: number;
}
export interface SwapOptions {
  /** Negative slides in from the left. */
  dir?: number;
}
export interface FloodOptions {
  /** Runs at once, before the colour grows. */
  mutate?: () => void;
  /** The circle grows from this element. Defaults to the target. */
  from?: MaybeElement;
  color?: string;
  duration?: number;
}
export interface RollOptions {
  /** Jump to the target without rolling. */
  instant?: boolean;
}
export interface PrintOptions {
  dur?: number;
  delay?: number;
}
export interface ThreadOptions {
  color?: MotionColor;
  sag?: number;
}
export interface LockOptions {
  color?: MotionColor;
  /** The stitch runs in from this element. */
  from?: MaybeElement;
}
export interface PullOptions {
  color?: MotionColor;
}
export interface CheckOptions {
  /** Appends a new check even if the element already holds an svg path. */
  add?: boolean;
  color?: MotionColor;
  delay?: number;
}
/** New class, markup and text for morph(); html wins over text. */
export interface MorphChange {
  cls?: string;
  html?: string;
  text?: string;
}
export interface MorphOptions {
  dur?: number;
}
export interface MotionEase {
  out: string;
  soft: string;
  in: string;
  io: string;
  press: string;
  land: string;
  settle: string;
  pop: string;
  back: string;
}
/** Shared durations in ms, the same values as the CSS --mo-* tokens. */
export interface MotionDur {
  xs: number;
  s: number;
  m: number;
  l: number;
  xl: number;
}

export interface Motion {
  /* ---------- present from the start, as no-ops ---------- */
  /** The router calls this after every render. */
  enter: (el: HTMLElement | null, ctx?: EnterContext) => MotionDone;
  /** One element means "its children". */
  stagger: (nodes: MotionTargets, o?: StaggerOptions) => MotionDone;
  /** Ticks the text to the formatted value. The no-op just sets it. */
  count: (el: MaybeElement, to: number, fmt?: CountFormat | null, o?: CountOptions) => void;
  /** Marks the targets as pressable. The real one returns an undo function. */
  press: (t: MotionTargets) => (() => void) | void;
  /** Returns the function that detaches the gesture. */
  swipe: (el: HTMLElement | null | undefined, o?: SwipeOptions) => () => void;
  reveal: (t: MotionTargets, o?: RevealOptions) => void;
  celebrate: (el?: MaybeElement, o?: CelebrateOptions) => MotionDone;
  /** Runs mutate exactly once, always, then glides the nodes from their old positions. */
  flip: (mutate?: (() => void) | null, nodes?: FlipNodes, o?: FlipOptions) => MotionDone;

  /* ---------- present once src/motion has loaded ---------- */
  /** Same function as count. */
  tick?: (el: MaybeElement, to: number, fmt?: CountFormat | null, o?: CountOptions) => void;
  shake?: (el: MaybeElement) => Promise<void>;
  /** Runs render at once, then slides the new content in. */
  swap?: (el: MaybeElement, render?: (() => void) | null, o?: SwapOptions) => Promise<void>;
  flood?: (target: MaybeElement, o?: FloodOptions) => Promise<void>;
  /** The ₹ coin rolls along its rail to the target. */
  roll?: (coin: HTMLElement | null | undefined, target: MaybeElement, o?: RollOptions) => Promise<void>;
  /** A receipt feeds out of its slot. */
  print?: (el: MaybeElement, o?: PrintOptions) => Promise<void>;
  fresh?: (el: MaybeElement) => Promise<void>;
  rings?: (el: MaybeElement) => void;
  /** Applies data-motion hooks under the root. Defaults to the document. */
  scan?: (root?: ParentNode) => void;
  thread?: (fromEl: MaybeElement, toEl: MaybeElement, o?: ThreadOptions) => Promise<void>;
  lock?: (el: MaybeElement, o?: LockOptions) => Promise<void>;
  pull?: (fromEl: MaybeElement, toEl: MaybeElement, o?: PullOptions) => Promise<void>;
  unspool?: (fromEl: MaybeElement, toEl: MaybeElement, o?: PullOptions) => Promise<void>;
  check?: (el: MaybeElement, o?: CheckOptions) => Promise<void>;
  morph?: (
    el: HTMLElement | null | undefined,
    m: MorphChange | ((el: HTMLElement) => void) | null,
    o?: MorphOptions,
  ) => Promise<void>;
  /** Marks the targets as liftable. Returns an undo function. */
  lift?: (t: MotionTargets) => () => void;
  bump?: (el: MaybeElement, scale?: number) => Promise<void>;
  /** The visible nav item for a view name. */
  navItem?: (name: string) => HTMLElement | null;
  preload?: (o?: { force?: boolean }) => Promise<void>;
  ease?: MotionEase;
  dur?: MotionDur;
  ready?: boolean;
}

/** What src/motion must provide: every member, present. */
export type MotionImpl = Required<Motion>;

/** The callable members, for dynamic dispatch such as the job kit's mo("press", el). */
export type MotionMethod = {
  [K in keyof MotionImpl]: MotionImpl[K] extends (...args: never[]) => unknown ? K : never;
}[keyof MotionImpl];

/* motion API (implemented in src/motion; safe no-ops until then) */
export const motion: Motion = {
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
