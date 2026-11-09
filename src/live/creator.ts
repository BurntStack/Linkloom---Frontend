/* The creator dashboard's connection to the backend.
   - emptyCreatorState(): what the app starts from (no sample rows).
   - loadCreator(): fills the store from the API, slice by slice, and keeps it current over the live socket.
   - creatorApi: the actions the screens call. Each one talks to the server first and only then changes the store,
     so the screen never shows something the server refused. */
import { api, apiAll, ApiError, idemKey, storedUser, type ApiUser } from "@/api/client";
import { fetchMe } from "@/api/auth";
import { onLive, startLive, type LiveEvent } from "@/api/realtime";
import { uploadFile, type UploadedFile } from "@/api/uploads";
import type {
  ActiveJob,
  Bid,
  BidStatus,
  Job,
  Kyc,
  KycStatus,
  LedgerEntry,
  Me,
  Message,
  Notification,
  State,
  Thread,
  WorkStage,
} from "@/types";
import {
  addDaysIso,
  amount,
  day,
  daysUntil,
  extras,
  formatOf,
  idOf,
  initialsOf,
  isoOr,
  listOf,
  nameOf,
  nowIso,
  platformOf,
  settle,
  splitLocation,
  todayIst,
  toneOf,
} from "./shared";

/* ---------- backend rows (only the fields the app reads) ---------- */

type Obj = Record<string, unknown>;

export interface ApiCampaign extends Obj {
  id: string;
  title: string;
  brief: string | null;
  platform: string;
  deliverables: string;
  budgetMin: { amount: number } | number;
  budgetMax: { amount: number } | number;
  closesAt: string;
  status: string;
  usageRights: string | null;
  brand: Obj | null;
  createdAt: string;
}

/** What the creator keeps on this device because the backend has no field for it yet. */
export interface CreatorExtras {
  dob: string;
  gender: string;
  languages: string[];
  region: string;
  platforms: Me["platforms"];
  portfolio: Me["portfolio"];
  hiddenJobs: string[];
  saved: string[];
}

/* ---------- the empty state ---------- */

export function emptyCreatorState(): State {
  return {
    session: { signedIn: false, method: "mobile", email: "", mobile: "", firstLogin: false },
    me: {
      name: "",
      handle: "",
      city: "",
      region: "",
      dob: "",
      gender: "",
      languages: [],
      categories: [],
      bio: "",
      photo: null,
      platforms: {},
      audienceGeo: [],
      completedJobs: 0,
      totalBids: 0,
      portfolio: [],
      reviews: [],
    },
    kyc: {
      status: "not_started",
      step: 0,
      returnTo: null,
      pan: "",
      panName: "",
      idType: "Aadhaar",
      payoutMethod: "bank",
      upi: "",
      bank: { acc: "", ifsc: "", holder: "" },
      gst: "",
      note: "",
    },
    jobs: [],
    saved: [],
    bids: [],
    active: [],
    threads: [],
    ledger: [],
    readyToWithdraw: 0,
    plan: null,
    withdrawals: [],
    notifications: [],
    jobsUI: { q: "", city: "", platform: "", category: "", minBudget: 0, sort: "newest", savedOnly: false, showHidden: false },
    hiddenJobs: [],
    reports: [],
    bidDrafts: {},
    justSent: null,
    bidRules: { minPaise: 100000, overBudgetPct: 25, whyMin: 40, whyMax: 500, maxLinks: 5 },
    payoutMethods: [],
    workUI: { activeFilter: "all", earnRange: "fy", earnFilter: "all" },
  };
}

/* ---------- mappers ---------- */

const BID_STATUS: Record<string, BidStatus> = {
  pending: "submitted",
  submitted: "submitted",
  open: "submitted",
  active: "submitted",
  viewed: "viewed",
  shortlisted: "viewed",
  selected: "accepted",
  accepted: "accepted",
  hired: "accepted",
  rejected: "rejected",
  declined: "rejected",
  not_selected: "rejected",
  closed: "rejected",
  withdrawn: "withdrawn",
  completed: "completed",
};

const KYC_STATUS: Record<string, KycStatus> = {
  not_started: "not_started",
  in_progress: "in_progress",
  pending: "under_review",
  verified: "verified",
  rejected: "action_needed",
};

/** Order status → the work board's stage. Payment is tracked separately. */
function stageOf(status: string): WorkStage {
  const s = status.toLowerCase();
  if (/revision/.test(s)) return "revision";
  if (/submitted|delivered|in_review/.test(s)) return "submitted";
  if (/approved|completed|released|paid_out/.test(s)) return "approved";
  if (/progress|started|funded|active|paid|accepted/.test(s)) return "in_progress";
  return "kickoff";
}

export function mapJob(c: ApiCampaign, me?: Me): Job {
  const brand = nameOf(c.brand, "Brand on Linkloom");
  const platform = platformOf(c.platform);
  const category = String((c.category as string) || (c.categories as string[] | undefined)?.[0] || "");
  const [city] = splitLocation(c.location);
  const languages = Array.isArray(c.languages) ? (c.languages as string[]) : [];
  const j: Job = {
    id: c.id,
    brand,
    bi: initialsOf(brand),
    tone: toneOf(brand),
    title: c.title || "Untitled brief",
    platform,
    format: formatOf(c.deliverables, c.platform),
    category,
    budget: amount(c.budgetMax as never) || amount(c.budgetMin as never),
    deadline: day(c.closesAt),
    city: city || "Any city",
    remote: !city,
    languages,
    bids: Number(c.bidCount ?? c.bidsCount ?? c.bids ?? 0) || 0,
    posted: isoOr(c.createdAt, nowIso()),
    match: 0,
    reasons: [],
    deliverables: listOf(c.deliverables),
    brief: c.brief || "",
    min: c.minFollowers ? `Min ${Number(c.minFollowers).toLocaleString("en-IN")} followers` : "",
    usage: c.usageRights || "",
  };
  if (c.status && !/open|active|live/i.test(String(c.status))) j.status = "hired";
  if (me) scoreJob(j, me);
  return j;
}

/** A simple, explainable match score from what the creator told us. */
function scoreJob(j: Job, me: Me): void {
  const reasons: string[] = [];
  let score = 40;
  if (j.category && me.categories.some(c => c.toLowerCase() === j.category.toLowerCase())) {
    score += 30;
    reasons.push(`${j.category} is one of your categories`);
  }
  if (me.platforms[j.platform]) {
    score += 15;
    reasons.push(`You post on ${j.platform === "youtube" ? "YouTube" : "Instagram"}`);
  }
  const langs = j.languages.filter(l => me.languages.includes(l));
  if (langs.length) {
    score += 10;
    reasons.push(`You post in ${langs.join(" and ")}`);
  }
  if (j.remote) {
    score += 5;
    reasons.push("Open to any city");
  } else if (me.city && j.city.toLowerCase() === me.city.toLowerCase()) {
    score += 5;
    reasons.push(`${j.city}-based creators preferred`);
  }
  j.match = Math.min(99, score);
  j.reasons = reasons;
}

export function mapBid(b: Obj, jobs: Job[]): Bid {
  const camp = (b.campaign && typeof b.campaign === "object" ? b.campaign : null) as ApiCampaign | null;
  const jobId = idOf(b.campaign) || String(b.campaignId || "");
  const j = jobs.find(x => x.id === jobId);
  const status = BID_STATUS[String(b.status || "pending").toLowerCase()] || "submitted";
  const sent = isoOr(b.createdAt || b.sentAt, nowIso());
  const deliveryDays = Number(b.deliveryDays) || 0;
  const message = String(b.message || "");
  const out: Bid = {
    id: String(b.id),
    job: jobId,
    price: amount(b.price as never),
    status,
    sent,
    note:
      status === "submitted"
        ? "Waiting for the brand to review."
        : status === "accepted"
          ? "The brand picked your bid."
          : status === "rejected"
            ? "The brand went with another creator."
            : status === "withdrawn"
              ? "You withdrew this bid."
              : "",
    postDate: deliveryDays ? addDaysIso(sent, deliveryDays) : j?.deadline || day(sent),
    views: b.expectedViews == null ? null : Number(b.expectedViews),
    why: message,
  };
  if (!j && camp) {
    const mj = mapJob(camp);
    out.brand = mj.brand;
    out.title = mj.title;
    out.platform = mj.platform;
    out.format = mj.format;
  } else if (!j) {
    out.brand = nameOf(b.brand, "Brand");
    out.title = String(b.campaignTitle || b.title || "Brief");
    out.platform = platformOf(b.platform);
    out.format = formatOf(b.deliverables, String(b.platform || ""));
  }
  if (status === "withdrawn") {
    out.by = "you";
    out.at = isoOr(b.updatedAt, sent);
  }
  return out;
}

export function mapOrder(o: Obj): ActiveJob {
  const camp = (o.campaign && typeof o.campaign === "object" ? o.campaign : {}) as Obj;
  const brand = nameOf(o.brand || camp.brand, "Brand");
  const status = String(o.status || "");
  const deliverablesTxt = o.deliverables ?? camp.deliverables ?? (o.package as Obj | undefined)?.deliverables;
  const platform = platformOf(o.platform ?? camp.platform ?? (o.package as Obj | undefined)?.platform);
  const created = isoOr(o.createdAt, nowIso());
  const funded = isoOr(o.fundedAt || o.paidAt, created);
  const due = day(o.dueAt || o.deadline || o.dueDate || camp.closesAt) || addDaysIso(created, Number(o.deliveryDays) || 7);
  const stage = stageOf(status);
  const released = /approved|completed|released/.test(status.toLowerCase());
  const a: ActiveJob = {
    id: String(o.id),
    job: idOf(o.campaign) || "",
    brand,
    title: String(o.title || camp.title || (o.package as Obj | undefined)?.title || "Order"),
    platform,
    format: formatOf(deliverablesTxt, String(platform)),
    price: amount((o.price ?? o.amount ?? o.total) as never),
    stage,
    pay: released ? "released" : "escrow",
    due,
    uploads: [],
    deliverables: listOf(typeof deliverablesTxt === "string" ? deliverablesTxt : ""),
    thread: "",
    revisionsIncluded: Number(o.revisionsIncluded ?? o.revisionsAllowed ?? 1) || 1,
    brief: String(o.brief || camp.brief || ""),
    usage: String(o.usageRights || camp.usageRights || ""),
    languages: [],
    accepted: created,
    funded,
    draftDue: due,
    log: [
      { at: created, kind: "accepted" },
      { at: funded, kind: "funded" },
    ],
  };
  if (stage === "revision") {
    a.revision = String(o.revisionFeedback || o.lastRevision || "");
    a.revisionAt = isoOr(o.updatedAt, created);
    a.log.push({ at: a.revisionAt, kind: "revision" });
  }
  if (stage === "approved") a.log.push({ at: isoOr(o.approvedAt || o.updatedAt, created), kind: "approved" });
  (a as ActiveJob & { allowed: string[]; brandId: string; status: string }).allowed = Array.isArray(o.allowedActions)
    ? (o.allowedActions as string[])
    : [];
  (a as ActiveJob & { brandId: string }).brandId = idOf(o.brand || camp.brand);
  (a as ActiveJob & { status: string }).status = status;
  return a;
}

export function mapMessage(m: Obj): Message {
  const att = m.attachment as { uploadId: string; contentType: string } | null;
  const text = String(m.text || "") || (att ? (att.contentType.startsWith("image/") ? "📎 Image" : "📎 File") : "");
  const out: Message = { from: m.fromMe ? "me" : "brand", at: isoOr(m.sentAt, nowIso()), text };
  if (m.fromMe) out.status = "delivered";
  if (att) (out as Message & { attachment: unknown }).attachment = att;
  (out as Message & { id: string }).id = String(m.id || "");
  return out;
}

function mapThread(c: Obj, active: ActiveJob[]): Thread {
  const party = (c.withParty || {}) as Obj;
  const brand = nameOf(party, "Brand");
  const brandId = idOf(party);
  const a = active.find(x => (x as ActiveJob & { brandId?: string }).brandId === brandId);
  const t: Thread = {
    id: String(c.id),
    brand,
    bi: initialsOf(brand),
    tone: toneOf(brand),
    job: a?.id || "",
    unread: Number(c.unread) || 0,
    msgs: [],
  };
  const last = c.lastMessage as Obj | null;
  if (last && (last.text || last.hasAttachment))
    t.msgs.push({
      from: last.fromMe ? "me" : "brand",
      at: isoOr(last.sentAt, isoOr(c.updatedAt, nowIso())),
      text: String(last.text || "📎 Attachment"),
      ...(last.fromMe ? { status: "delivered" as const } : {}),
    });
  (t as Thread & { loaded: boolean; image: string }).loaded = false;
  (t as Thread & { image: string }).image = String(party.image || "");
  if (a) a.thread = t.id;
  return t;
}

const NOTIF_GO: Record<string, (d: Obj) => string> = {
  kyc_verified: () => "#kyc",
  kyc_rejected: () => "#kyc",
  new_message: d => (d.conversationId ? "#chat-" + d.conversationId : "#messages"),
  bid_selected: () => "#bids",
  bid_rejected: () => "#bids",
  offer_received: () => "#active",
  order_created: d => (d.orderId ? "#work-" + d.orderId : "#active"),
  revision_requested: d => (d.orderId ? "#work-" + d.orderId : "#active"),
  order_approved: () => "#earnings",
};

export function mapNotification(n: Obj): Notification {
  const data = (n.data || {}) as Obj;
  const type = String(n.type || "");
  const go = NOTIF_GO[type]?.(data) || (data.orderId ? "#work-" + data.orderId : data.campaignId ? "#job-" + data.campaignId : "#home");
  return {
    id: String(n.id),
    at: isoOr(n.createdAt || n.at, nowIso()),
    text: String(n.title || n.text || n.body || "Update"),
    go,
    read: !!n.read,
  };
}

export function mapKyc(k: Obj, prev: Kyc): Kyc {
  const steps = (k.steps || {}) as Record<string, Obj>;
  const pan = steps.pan || {},
    id = steps.id || {},
    bank = steps.bank || {};
  const ID_NAME: Record<string, Kyc["idType"]> = {
    aadhaar: "Aadhaar",
    passport: "Passport",
    voter_id: "Voter ID",
    driving_licence: "Driving licence",
  };
  const status = KYC_STATUS[String(k.status || "not_started")] || "not_started";
  return {
    ...prev,
    status,
    pan: pan.done ? `•••••${String(pan.panLast4 || "").padStart(4, "•")}` : "",
    panName: String(pan.nameOnPan || ""),
    idType: ID_NAME[String(id.idType || "")] || prev.idType || "Aadhaar",
    idDone: !!id.done,
    idMasked: id.done ? "Uploaded" : undefined,
    payoutMethod: "bank",
    bank: {
      acc: bank.done ? `••••${bank.accountLast4 || ""}` : "",
      ifsc: String(bank.ifsc || ""),
      holder: String(bank.accountHolderName || ""),
    },
    note: String(k.rejectionReason || ""),
    submittedAt: (k.submittedAt as string) || undefined,
    selfie: true,
    gstDone: true,
    fix: status === "action_needed" ? (["pan", "id", "payout"] as Kyc["fix"]) : null,
    ...({ steps: { pan: !!pan.done, id: !!id.done, bank: !!bank.done } } as object),
  };
}

function mapMe(c: Obj, user: ApiUser | null, x: Partial<CreatorExtras>, prev: Me): Me {
  const [city, region] = splitLocation(c.location);
  const name = String(c.displayName || user?.fullName || prev.name || "Creator");
  const primary = platformOf(c.primaryPlatform);
  const platforms: Me["platforms"] = { ...(x.platforms || {}) };
  if (!platforms[primary] && c.followerCount)
    platforms[primary] = {
      handle: "",
      url: "",
      followers: Number(c.followerCount) || 0,
      avgViews: 0,
      er: 0,
      updated: todayIst(),
      source: "Self-reported",
    };
  const handle = platforms.instagram?.handle || platforms.youtube?.handle || (c.slug ? "@" + String(c.slug).replace(/-[a-z0-9]{6}$/, "") : "");
  return {
    ...prev,
    name,
    handle,
    city: city || prev.city,
    region: region || x.region || prev.region,
    dob: x.dob || prev.dob,
    gender: x.gender || prev.gender,
    languages: x.languages || prev.languages,
    categories: Array.isArray(c.categories) ? (c.categories as string[]) : prev.categories,
    bio: String(c.bio ?? prev.bio),
    photo: (c.avatarUrl as string) || null,
    platforms,
    portfolio: x.portfolio || prev.portfolio,
  };
}

/* ---------- loading ---------- */

type Store = { s: State; set(fn: (s: State) => void, why?: string): void };
let store: Store;
let creatorId = "";
let userId = "";
const ex = () => extras<CreatorExtras>("creator", userId || "anon");

export const creatorProfileId = (): string => creatorId;

/** Loads only what a signed-out visitor may see. */
export async function loadGuest(st: Store): Promise<void> {
  store = st;
  const camps = await apiAll<ApiCampaign>("/v1/campaigns/", { auth: false }).catch(() => [] as ApiCampaign[]);
  st.set(s => {
    s.jobs = camps.map(c => mapJob(c));
  }, "live-loaded");
}

/** Everything for a signed-in creator. Returns the user so the session can route (onboarding, wrong role). */
export async function loadCreator(st: Store): Promise<ApiUser> {
  store = st;
  const user = await fetchMe();
  userId = user.id;
  const errors: string[] = [];
  const [cme, kyc, camps, myBids, orders, convs, notifs, earnings] = await Promise.all([
    settle(api<Obj>("/v1/creators/me/"), {} as Obj, "profile", errors),
    settle(api<Obj>("/v1/kyc/"), null as Obj | null, "kyc", errors),
    settle(apiAll<ApiCampaign>("/v1/campaigns/"), [] as ApiCampaign[], "jobs", errors),
    settle(apiAll<Obj>("/v1/creators/me/campaigns/"), [] as Obj[], "bids", errors),
    settle(apiAll<Obj>("/v1/creators/me/orders/"), [] as Obj[], "orders", errors),
    settle(apiAll<Obj>("/v1/conversations/"), [] as Obj[], "messages", errors),
    settle(apiAll<Obj>("/v1/notifications/", {}, 100), [] as Obj[], "notifications", errors),
    settle(api<Obj>("/v1/creators/me/earnings/"), null as Obj | null, "earnings", errors),
  ]);
  creatorId = String(cme.id || "");
  const x = ex().get();
  const reviews = creatorId
    ? await settle(apiAll<Obj>(`/v1/creators/${creatorId}/reviews/`, { auth: false }, 50), [] as Obj[], "reviews", errors)
    : [];

  st.set(s => {
    s.session.signedIn = true;
    s.session.email = String(user.email || "");
    s.session.mobile = user.phone ? maskPhone(String(user.phone)) : "";
    s.session.method = user.email && !user.phone ? "google" : "mobile";
    s.session.firstLogin = !!user.needsOnboarding;
    s.me = mapMe(cme, user, x, s.me);
    if (kyc) s.kyc = mapKyc(kyc, s.kyc);
    else if (user.kycStatus) s.kyc.status = KYC_STATUS[user.kycStatus] || "not_started";
    s.jobs = camps.map(c => mapJob(c, s.me));
    /* /creators/me/campaigns/ lists the creator's bids, each with its campaign; some builds nest the bid instead */
    s.bids = myBids
      .map(r => (r.price !== undefined ? r : ((r.myBid || r.bid) as Obj | undefined) ? { ...(r.myBid || r.bid) as Obj, campaign: r } : null))
      .filter((r): r is Obj => !!r)
      .map(b => mapBid(b, s.jobs));
    s.active = orders.map(mapOrder);
    s.threads = convs.map(c => mapThread(c, s.active));
    s.notifications = notifs.map(mapNotification);
    s.me.totalBids = s.bids.length;
    s.me.completedJobs = s.active.filter(a => a.stage === "approved").length;
    s.me.reviews = reviews.map(r => ({
      brand: nameOf(r.brand || r.author, "Brand"),
      rating: Number(r.stars ?? r.rating) || 0,
      text: String(r.text || ""),
    }));
    s.saved = x.saved || [];
    s.hiddenJobs = x.hiddenJobs || [];
    applyEarnings(s, earnings);
  }, "live-loaded");
  if (errors.length) console.warn("Some sections could not load:", errors.join(", "));
  startLive();
  wireLive();
  return user;
}

function maskPhone(p: string): string {
  const d = p.replace(/\D/g, "").slice(-10);
  return d.length === 10 ? `+91 ${d.slice(0, 2)}•••••${d.slice(7)}` : p;
}

/** Earnings: the ledger is the approved orders; withdrawals stay hidden while payouts are off. */
function applyEarnings(s: State, e: Obj | null): void {
  const approved = s.active.filter(a => a.pay === "released");
  s.ledger = approved.map(
    (a): LedgerEntry => ({
      id: "l-" + a.id,
      date: day(a.log.find(l => l.kind === "approved")?.at || a.funded),
      brand: a.brand,
      job: a.title,
      amount: a.price,
      status: "paid",
    }),
  );
  const payouts = !!e?.payoutsEnabled;
  (s as State & { payoutsEnabled: boolean }).payoutsEnabled = payouts;
  (s as State & { earningsSummary: unknown }).earningsSummary = e
    ? {
        inEscrow: amount(e.inEscrow as never),
        earned: amount(e.earned as never),
        tds: amount(e.tdsDeducted as never),
        ordersInEscrow: Number(e.ordersInEscrow) || 0,
        ordersEarned: Number(e.ordersEarned) || 0,
      }
    : null;
  s.readyToWithdraw = payouts ? amount(e?.earned as never) : 0;
  s.withdrawals = [];
  s.payoutMethods = [];
}

let wired = false;
function wireLive(): void {
  if (wired) return;
  wired = true;
  onLive((e: LiveEvent) => {
    if (e.event === "connected") {
      void refreshSoft();
      return;
    }
    if (e.event === "new_message") {
      const m = mapMessage(e.message);
      store.set(s => {
        const t = s.threads.find(x => x.id === e.conversationId);
        if (!t) {
          void refreshThreads();
          return;
        }
        const id = (m as Message & { id?: string }).id;
        if (id && t.msgs.some(x => (x as Message & { id?: string }).id === id)) return;
        /* the echo of a message this tab just sent: match it to the one already on screen */
        if (m.from === "me") {
          const mine = t.msgs.find(x => x.from === "me" && !(x as Message & { id?: string }).id && x.text === m.text);
          if (mine) {
            (mine as Message & { id?: string }).id = id;
            return;
          }
        }
        t.msgs.push(m);
        if (m.from !== "me") t.unread += 1;
      }, "chat-live");
      return;
    }
    if (e.event === "notification") {
      const n = mapNotification(e.notification as unknown as Obj);
      store.set(s => {
        if (!s.notifications.some(x => x.id === n.id)) s.notifications.unshift(n);
      }, "notif-live");
      const t = e.notification.type;
      if (t === "kyc_verified" || t === "kyc_rejected") void refreshKyc();
      else void refreshSoft();
    }
  });
}

/* ---------- refreshes ---------- */

export async function refreshKyc(): Promise<void> {
  const k = await api<Obj>("/v1/kyc/");
  store.set(s => {
    s.kyc = mapKyc(k, s.kyc);
  }, "kyc-live");
}

async function refreshThreads(): Promise<void> {
  const convs = await apiAll<Obj>("/v1/conversations/");
  store.set(s => {
    const old = new Map(s.threads.map(t => [t.id, t]));
    s.threads = convs.map(c => {
      const t = mapThread(c, s.active);
      const o = old.get(t.id) as (Thread & { loaded?: boolean }) | undefined;
      if (o?.loaded) {
        t.msgs = o.msgs;
        (t as Thread & { loaded: boolean }).loaded = true;
      }
      return t;
    });
  }, "chat-live");
}

/** Bids, orders and notifications: the slices other people change. */
export async function refreshSoft(): Promise<void> {
  const [myBids, orders, notifs] = await Promise.all([
    apiAll<Obj>("/v1/creators/me/campaigns/").catch(() => null),
    apiAll<Obj>("/v1/creators/me/orders/").catch(() => null),
    apiAll<Obj>("/v1/notifications/", {}, 100).catch(() => null),
  ]);
  store.set(s => {
    if (myBids)
      s.bids = myBids
        .map(r => (r.price !== undefined ? r : ((r.myBid || r.bid) as Obj | undefined) ? { ...(r.myBid || r.bid) as Obj, campaign: r } : null))
        .filter((r): r is Obj => !!r)
        .map(b => mapBid(b, s.jobs));
    if (orders) {
      const threads = new Map(s.active.map(a => [a.id, a.thread]));
      s.active = orders.map(o => {
        const a = mapOrder(o);
        a.thread = threads.get(a.id) || s.threads.find(t => t.job === a.id)?.id || "";
        return a;
      });
    }
    if (notifs) s.notifications = notifs.map(mapNotification);
  }, "live-refresh");
  void refreshThreads().catch(() => undefined);
}

/* ---------- actions ---------- */

/** Wording for an error a screen shows inline. */
export function errorText(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === "KYC_REQUIRED") return "Verify your ID first. Your draft is saved.";
    return e.message;
  }
  return "Something went wrong. Please try again.";
}

export const isKycRequired = (e: unknown): boolean => e instanceof ApiError && e.code === "KYC_REQUIRED";

export const creatorApi = {
  errorText,
  async placeBid(jobId: string, p: { price: number; why: string; views: number | null; postDate: string; links: string[] }): Promise<Bid> {
    const days = Math.max(1, daysUntil(p.postDate));
    const message = p.links.length ? `${p.why}\n\nSimilar work:\n${p.links.join("\n")}` : p.why;
    const body: Obj = { price: p.price, message, deliveryDays: days };
    if (p.views) body.expectedViews = p.views;
    const r = await api<Obj>(`/v1/campaigns/${jobId}/bids/`, { method: "POST", body });
    const b = mapBid({ ...r, campaign: r.campaign || jobId }, store.s.jobs);
    b.postDate = p.postDate;
    b.links = p.links;
    b.why = p.why;
    return b;
  },

  async withdrawBid(bid: Bid): Promise<void> {
    await api(`/v1/campaigns/${bid.job}/bids/${bid.id}/withdraw/`, { method: "POST" });
  },

  async reviewOrder(orderId: string, stars: number, text: string): Promise<void> {
    await api(`/v1/orders/${orderId}/review/`, { method: "POST", body: { stars, text } });
  },

  /** One brief by id, added to the list so job detail can show it. */
  async fetchJob(id: string): Promise<void> {
    const c = await api<ApiCampaign>(`/v1/campaigns/${id}/`);
    store.set(s => {
      const j = mapJob(c, s.me);
      s.jobs = s.jobs.filter(x => x.id !== j.id).concat(j);
    }, "live-refresh");
  },

  /* jobs: saved and hidden are kept per account on this device */
  saveJobs(saved: string[], hidden: string[]): void {
    ex().set({ saved, hiddenJobs: hidden });
  },

  /* messages */
  async loadThread(threadId: string): Promise<void> {
    const msgs = await apiAll<Obj>(`/v1/conversations/${threadId}/messages/`, {}, 300);
    store.set(s => {
      const t = s.threads.find(x => x.id === threadId);
      if (!t) return;
      t.msgs = msgs.map(mapMessage).reverse();
      (t as Thread & { loaded: boolean }).loaded = true;
    }, "chat-loaded");
  },

  async sendMessage(threadId: string, text: string, file?: File): Promise<Message> {
    let attachmentUploadId: string | undefined;
    if (file) attachmentUploadId = (await uploadFile("chat_attachment", file)).id;
    const r = await api<Obj>(`/v1/conversations/${threadId}/messages/`, {
      method: "POST",
      body: { ...(text ? { text } : {}), ...(attachmentUploadId ? { attachmentUploadId } : {}) },
    });
    return mapMessage({ ...r, fromMe: true });
  },

  async markRead(threadId: string): Promise<void> {
    await api(`/v1/conversations/${threadId}/read/`, { method: "POST" });
  },

  async openThreadWithBrand(brandId: string): Promise<string> {
    const r = await api<Obj>("/v1/conversations/", { method: "POST", body: { brandId } });
    await refreshThreads();
    return String(r.id);
  },

  /* notifications */
  async readNotification(id: string): Promise<void> {
    await api(`/v1/notifications/${id}/read/`, { method: "PATCH" });
  },
  async readAllNotifications(): Promise<void> {
    await api("/v1/notifications/read-all/", { method: "POST" });
  },

  /* work */
  async submitDeliverable(orderId: string, d: { file?: File; url?: string; note?: string }): Promise<UploadedFile | null> {
    let up: UploadedFile | null = null;
    const body: Obj = {};
    if (d.file) {
      up = await uploadFile("deliverable", d.file);
      body.fileUploadId = up.id;
    } else if (d.url) body.contentUrl = d.url.startsWith("http") ? d.url : "https://" + d.url;
    if (d.note) body.note = d.note;
    await api(`/v1/orders/${orderId}/deliverables/`, { method: "POST", body });
    return up;
  },
  async refreshOrders(): Promise<void> {
    await refreshSoft();
  },
  async orderAction(orderId: string, action: "cancel" | "disputes", reason: string): Promise<void> {
    await api(`/v1/orders/${orderId}/${action}/`, { method: "POST", body: { reason } });
  },
  async offers(): Promise<Obj[]> {
    return apiAll<Obj>("/v1/creators/me/offers/");
  },
  async answerOffer(id: string, status: "accepted" | "rejected"): Promise<void> {
    await api(`/v1/creators/me/offers/${id}/`, { method: "PATCH", body: { status } });
    await refreshSoft();
  },

  /* profile */
  async saveProfile(p: {
    name?: string;
    bio?: string;
    categories?: string[];
    city?: string;
    region?: string;
    primaryPlatform?: "instagram" | "youtube";
    extras?: Partial<CreatorExtras>;
  }): Promise<void> {
    const body: Obj = {};
    if (p.name !== undefined) body.displayName = p.name.trim();
    if (p.bio !== undefined) body.bio = p.bio.trim();
    if (p.categories !== undefined) body.categories = p.categories;
    if (p.city !== undefined) body.location = [p.city.trim(), (p.region || "").trim()].filter(Boolean).join(", ");
    if (p.primaryPlatform) body.primaryPlatform = p.primaryPlatform;
    if (Object.keys(body).length) await api("/v1/creators/me/", { method: "PATCH", body });
    if (p.extras) ex().set(p.extras);
  },
  async uploadAvatar(file: Blob): Promise<string | null> {
    const r = await uploadFile("avatar", file);
    return r.url;
  },

  /* KYC */
  async kycPan(pan: string, nameOnPan: string): Promise<void> {
    const k = await api<Obj>("/v1/kyc/pan/", { method: "PUT", body: { pan: pan.toUpperCase(), nameOnPan } });
    store.set(s => (s.kyc = mapKyc(k, s.kyc)), "kyc-live");
  },
  async kycId(idType: Kyc["idType"], file: File): Promise<void> {
    const ID: Record<string, string> = {
      Aadhaar: "aadhaar",
      Passport: "passport",
      "Voter ID": "voter_id",
      "Driving licence": "driving_licence",
    };
    const up = await uploadFile("kyc_document", file);
    const k = await api<Obj>("/v1/kyc/id/", { method: "PUT", body: { idType: ID[idType] || "aadhaar", uploadId: up.id } });
    store.set(s => (s.kyc = mapKyc(k, s.kyc)), "kyc-live");
  },
  async kycBank(accountHolderName: string, accountNumber: string, ifsc: string): Promise<void> {
    const k = await api<Obj>("/v1/kyc/bank/", {
      method: "PUT",
      body: { accountHolderName, accountNumber: accountNumber.replace(/\s/g, ""), ifsc: ifsc.toUpperCase() },
    });
    store.set(s => (s.kyc = mapKyc(k, s.kyc)), "kyc-live");
  },
  async kycSubmit(): Promise<void> {
    const k = await api<Obj>("/v1/kyc/submit/", { method: "POST" });
    store.set(s => (s.kyc = mapKyc(k, s.kyc)), "kyc-live");
  },
};

export const idempotencyKey = idemKey;
export const currentUser = storedUser;
