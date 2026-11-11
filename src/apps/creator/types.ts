/* Linkloom Creator Dashboard: the data model. One in-memory `State` object (see src/apps/creator/data/seed.ts) holds everything.

   Conventions used throughout:
   - Money is ALWAYS integer paise (₹1 = 100): see `Paise`. Only form inputs ever hold rupees.
   - `IsoDay` is "YYYY-MM-DD". `IsoInstant` is a full ISO timestamp, usually with a +05:30 offset.
   - A field marked optional is genuinely absent on some rows, or appears only after a screen writes it at runtime.
     The comment says which. */

/** Integer paise. ₹12,500 is 1250000. */
export type Paise = number;
/** Calendar day, "YYYY-MM-DD". */
export type IsoDay = string;
/** Full ISO 8601 timestamp, e.g. "2026-11-03T18:10:00+05:30". */
export type IsoInstant = string;
/** Either form; `D()` in core accepts both. */
export type IsoDate = IsoDay | IsoInstant;

export type Platform = "instagram" | "youtube";
export type JobFormat = "Reel" | "Video" | "Carousel" | "Short" | "Story";
/** Brand chip colour: coral, blue/violet, yellow. */
export type BrandTone = "c" | "b" | "y";

/* ---------- session ---------- */

export type SignInMethod = "google" | "mobile";

export interface Session {
  signedIn: boolean;
  method: SignInMethod;
  email: string;
  /** Masked for display, e.g. "+91 98•••••210". */
  mobile: string;
  firstLogin: boolean;
  /** Written by login on sign-in. */
  expired?: boolean;
  /** Written by login on a Google sign-in. */
  googleName?: string;
  /** Written by setup when the profile is saved. */
  profileDone?: boolean;
  /** Signed-out visitor looking around read-only. */
  guest?: boolean;
}

/* ---------- the creator ---------- */

export interface PlatformStats {
  handle: string;
  url: string;
  followers: number;
  avgViews: number;
  /** Engagement rate in percent, e.g. 6.8. */
  er: number;
  updated: IsoDay;
  source: string;
}

/** [city, percent of audience] */
export type AudienceGeo = [city: string, percent: number];

export interface PortfolioItem {
  title: string;
  /** "web" is what the profile editor stores for a link that is neither Instagram nor YouTube. */
  platform: Platform | "web";
  /** "" for items added through the profile editor. */
  format: string;
  /** Absent on items added through the profile editor. */
  views?: number;
  url: string;
}

export interface Review {
  brand: string;
  rating: number;
  text: string;
}

export interface Me {
  name: string;
  handle: string;
  city: string;
  region: string;
  dob: IsoDay;
  gender: string;
  languages: string[];
  categories: string[];
  bio: string;
  /** Data URL of the cropped photo, or null for initials. */
  photo: string | null;
  /** Partial: screens handle a missing platform ("You have not added YouTube"). */
  platforms: Partial<Record<Platform, PlatformStats>>;
  audienceGeo: AudienceGeo[];
  completedJobs: number;
  totalBids: number;
  portfolio: PortfolioItem[];
  reviews: Review[];
}

/* ---------- KYC ---------- */

export type KycStatus =
  "not_started" | "in_progress" | "under_review" | "verified" | "action_needed" | "rejected";
export type KycStepId = "pan" | "id" | "payout" | "gst";
export type KycIdType = "Aadhaar" | "Passport" | "Voter ID" | "Driving licence";
export type KycPayoutMethod = "upi" | "bank";

export interface KycBank {
  acc: string;
  ifsc: string;
  holder: string;
}

export interface Kyc {
  status: KycStatus;
  step: number;
  /** Hash to return to after verification; set by the bid gate. */
  returnTo: string | null;
  pan: string;
  panName: string;
  idType: KycIdType;
  payoutMethod: KycPayoutMethod;
  upi: string;
  bank: KycBank;
  gst: string;
  note: string;
  /* The rest are absent in the seed. kyc.ts `normalise` and the step handlers fill them at runtime. */
  idMasked?: string;
  idDone?: boolean;
  gstDone?: boolean;
  selfie?: boolean;
  /** Steps that need fixing when action_needed. Null once cleared. Absent means "derive it from note". */
  fix?: KycStepId[] | null;
  submittedAt?: IsoInstant;
  verifiedAt?: IsoInstant;
}

/* ---------- jobs ---------- */

/** Absent on an open job. Discovery filters out "hired". */
export type JobStatus = "hired";

export interface Job {
  id: string;
  status?: JobStatus;
  brand: string;
  /** Brand initials. */
  bi: string;
  tone: BrandTone;
  title: string;
  platform: Platform;
  format: JobFormat;
  category: string;
  budget: Paise;
  deadline: IsoDay;
  city: string;
  remote: boolean;
  languages: string[];
  /** Live bid count: sending a bid adds one, withdrawing removes one. */
  bids: number;
  posted: IsoInstant;
  match: number;
  reasons: string[];
  deliverables: string[];
  brief: string;
  /** Free text such as "Min 50K followers"; parsed by the job kit. */
  min: string;
  usage: string;
}

export type JobSort = "match" | "budget" | "deadline" | "newest" | "bids";

/** Find Jobs filter state. Kept when opening a job and coming back; mirrored to sessionStorage minus the last two. */
export interface JobsUI {
  q: string;
  /** "" for all cities, "remote" for any city, otherwise a city name. */
  city: string;
  platform: Platform | "";
  category: string;
  minBudget: Paise;
  sort: JobSort;
  savedOnly: boolean;
  showHidden: boolean;
  /** Written by job detail on the way in, cleared by #jobs on return. */
  fromJob?: string | null;
  /** Written by #jobs on leaving. */
  scrollY?: number;
}

export interface JobReport {
  job: string;
  reason: string;
  text: string;
  at: IsoInstant;
}

/* ---------- bids ---------- */

export type BidStatus = "submitted" | "viewed" | "accepted" | "rejected" | "withdrawn" | "completed";

export interface BidFeedback {
  rating: number;
  text: string;
  at: IsoInstant;
}

export interface Bid {
  id: string;
  /** A job id. May name a job that is not in `jobs` ("x4"): such rows carry brand, title, platform, format themselves. */
  job: string;
  price: Paise;
  status: BidStatus;
  sent: IsoInstant;
  note: string;
  postDate: IsoDay;
  brand?: string;
  title?: string;
  platform?: Platform;
  format?: JobFormat;
  /** Who withdrew: "you", "brand" or "linkloom". Absent reads as "you". */
  by?: string;
  /** When it was withdrawn. */
  at?: IsoInstant;
  /** Written by My Bids on a completed bid. */
  feedback?: BidFeedback;
  /* Written when a bid is sent from the form; the seed rows have none of them. */
  views?: number | null;
  why?: string;
  links?: string[];
}

/** Unsent bid form. Every field is the raw input text; this is the one place rupees and text are not yet paise. */
export interface BidDraft {
  price: string;
  why: string;
  views: string;
  postDate: IsoDay | "";
  links: string[];
}

export interface BidRules {
  minPaise: Paise;
  overBudgetPct: number;
  whyMin: number;
  whyMax: number;
  maxLinks: number;
}

export interface BidsUI {
  status: BidStatus | "";
}

/* ---------- active work ---------- */

/** Work stage. Payment status is separate on purpose: "approved" is not the same as "paid". */
export type WorkStage = "kickoff" | "in_progress" | "submitted" | "revision" | "review" | "approved";
export type WorkPay = "escrow" | "released";
export type WorkLogKind =
  "accepted" | "funded" | "kickoff" | "upload" | "revision" | "draftok" | "live" | "approved";

export interface WorkLogEntry {
  at: IsoInstant;
  kind: WorkLogKind;
  /** Only on "upload". */
  file?: string;
}

export interface WorkUpload {
  name: string;
  /** Already formatted, e.g. "48 MB". */
  size: string;
  at: IsoInstant;
}

export interface ActiveJob {
  id: string;
  job: string;
  brand: string;
  title: string;
  platform: Platform;
  format: JobFormat;
  price: Paise;
  stage: WorkStage;
  pay: WorkPay;
  due: IsoDay;
  uploads: WorkUpload[];
  deliverables: string[];
  thread: string;
  revisionsIncluded: number;
  brief: string;
  usage: string;
  languages: string[];
  accepted: IsoInstant;
  funded: IsoInstant;
  draftDue: IsoDay;
  log: WorkLogEntry[];
  /** Only on a1 in the seed. */
  bid?: string;
  /** The brand's revision note. */
  revision?: string;
  revisionAt?: IsoInstant;
  liveUrl?: string;
  /** Written by the board: the brand OKed the draft. */
  draftOk?: boolean;
}

/** All optional: screens start from `s.workUI || (s.workUI = {})` and validate each value before use. */
export interface WorkUI {
  activeFilter?: "all" | "you" | "brand" | "done";
  earnRange?: "30" | "90" | "fy" | "all";
  earnFilter?: "all" | LedgerStatus;
  earnPick?: string;
}

/* ---------- chat ---------- */

export type MessageFrom = "me" | "brand" | "sys";
export type MessageStatus = "sending" | "queued" | "sent" | "delivered";

export interface Message {
  from: MessageFrom;
  at: IsoInstant;
  text: string;
  /** Only on the creator's messages. Absent reads as "delivered". */
  status?: MessageStatus;
}

export interface ThreadReport {
  at: IsoInstant;
  reason: string;
  note: string;
}

/** Chat exists only with brands that accepted a bid. */
export interface Thread {
  id: string;
  brand: string;
  bi: string;
  tone: BrandTone;
  /** The ActiveJob id, not a Job id. */
  job: string;
  unread: number;
  msgs: Message[];
  /** Written by the chat options menu. */
  blocked?: boolean;
  reported?: ThreadReport;
}

/* ---------- money ---------- */

/** paid = released from escrow into the Linkloom balance (cleared); pending = approved, still clearing;
    failed = the release did not go through (never counted). */
export type LedgerStatus = "paid" | "pending" | "failed";

export interface LedgerEntry {
  id: string;
  date: IsoDay;
  brand: string;
  /** The job title, not an id. */
  job: string;
  amount: Paise;
  status: LedgerStatus;
  /** Only when pending. */
  clears?: IsoDay;
  /** Only when failed. */
  reason?: string;
}

export type WithdrawalStatus = "paid" | "processing" | "failed";

export interface Withdrawal {
  id: string;
  amount: Paise;
  /** Display text, e.g. "UPI ananya••••@upi". */
  method: string;
  date: IsoDay;
  status: WithdrawalStatus;
  ref: string;
  /** Only when failed. */
  reason?: string;
}

export interface PayoutMethod {
  id: KycPayoutMethod;
  kind: "UPI" | "Bank";
  label: string;
  method: string;
  note: string;
}

export type PlanStatus = "active";

/** Subscription. No price is ever shown in the app. */
export interface Plan {
  name: string;
  status: PlanStatus;
  since: IsoDay;
  renews: IsoDay;
}

/* ---------- notifications ---------- */

export interface Notification {
  id: string;
  at: IsoInstant;
  text: string;
  /** Hash to open, e.g. "#work-a3". */
  go: string;
  read: boolean;
}

/* ---------- the whole state ---------- */

export interface State {
  session: Session;
  me: Me;
  kyc: Kyc;
  jobs: Job[];
  /** Saved job ids. */
  saved: string[];
  bids: Bid[];
  active: ActiveJob[];
  threads: Thread[];
  ledger: LedgerEntry[];
  /** Σ paid ledger rows − Σ withdrawals paid or processing. Derived; earnings.ts keeps it in step. */
  readyToWithdraw: Paise;
  /** Null means no subscription. */
  plan: Plan | null;
  withdrawals: Withdrawal[];
  notifications: Notification[];
  jobsUI: JobsUI;
  /** Job ids swiped left or hidden by the creator. */
  hiddenJobs: string[];
  /** Job reports sent from job detail. */
  reports: JobReport[];
  /** jobId -> unsent bid form, kept through the KYC detour. */
  bidDrafts: Record<string, BidDraft>;
  /** Bid id to highlight once on My Bids. */
  justSent: string | null;
  bidRules: BidRules;
  payoutMethods: PayoutMethod[];
  workUI: WorkUI;
  /** Absent until #bids first renders. */
  bidsUI?: BidsUI;
}
