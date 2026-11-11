/* Types for the slots that unmigrated screens still attach onto LLD at runtime. They exist only so a migrated reader can
   use a slot while its owner is unmigrated. When jobs.ts and home.ts publish named exports, delete this file and the
   optional members on LLDRuntime. */
import type { Bid, BidStatus, IsoDate, Job, Platform, State } from "../types";
import type { IconName } from "./icons";
import type { FlipNodes, MotionImpl, MotionMethod } from "./motion-api";

export interface JobFactor {
  k: string;
  ok: boolean;
  txt: string;
}

export interface JobCardOptions {
  /** "feature" is the larger Home card. */
  variant?: string;
  /** Scopes the card's element ids. */
  ctx?: string;
}

export interface JobWireOptions {
  onHide?: (id: string, card: HTMLElement) => void;
  onSave?: (id: string, saved: boolean, card: HTMLElement) => void;
}

export interface JobWiring {
  /** Wires one more card added after wire() ran. */
  attach(card: HTMLElement): void;
  cleanup(): void;
}

/** L.jobkit, defined in screens/jobs/jobs.ts. */
export interface JobKit {
  ensure(): State;
  job(id: string): Job | null;
  openJobs(): Job[];
  pill(status: BidStatus, label?: string): string;
  pct(match: number): string;
  stitch(btn: HTMLElement | null, on: boolean): void;
  settle(btn: HTMLElement | null): void;
  bidsFor(id: string): Bid[];
  openBid(id: string): Bid | null;
  isSaved(id: string): boolean;
  isHidden(id: string): boolean;
  platName(p?: Platform): string;
  glyph(p?: Platform): string;
  where(j: Pick<Job, "remote" | "city">): string;
  todayISO(): string;
  daysTxt(n: number): string;
  daysShort(n: number): string;
  daysTo(iso: IsoDate): number;
  STATUS: Record<BidStatus, { label: string; pill: string; ic: IconName }>;
  factors(j: Job): JobFactor[];
  minFollowers(j: Pick<Job, "min">): number;
  brandChip(j: Pick<Job, "brand"> & Partial<Pick<Job, "bi">>): string;
  card(j: Job, o?: JobCardOptions): string;
  wire(root: HTMLElement, o?: JobWireOptions): JobWiring;
  toggleSave(id: string, root?: ParentNode | null, force?: boolean): boolean;
  setHidden(id: string, on: boolean): void;
  /** Motion calls that never break a screen: a missing method or a throw yields a falsy result. */
  mo<K extends MotionMethod>(
    fn: K,
    ...args: Parameters<MotionImpl[K]>
  ): ReturnType<MotionImpl[K]> | null | undefined;
  /** Runs mutate exactly once, even if motion throws. */
  flip(mutate: () => void, nodes?: FlipNodes): void;
  persistUI(): void;
}

/** LLD.ui, defined in ui/select.ts and re-attached by legacy-bridge.ts. No reader exists today. */
export interface LegacyUi {
  enhanceSelects(root: ParentNode): void;
  closeSelect(): void;
}
