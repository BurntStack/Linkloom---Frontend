/* The brand dashboard's connection to the backend. Same pattern as live/creator.ts: load into the store the screens
   already read (window.LLD_DATA), and give the screens actions that talk to the server first.

   Backend → screen vocabulary:
   - campaigns the brand posted        → s.jobs   ("jobs" on screen: briefs creators bid on)
   - bids on those campaigns           → s.bids
   - orders + open/declined offers     → s.campaigns ("campaigns" on screen: each hire, with its stage)
   - public creators                   → s.creators
   - the "Favourites" list             → s.favorites
   - conversations                     → s.threads
   - escrow and release, from orders   → s.payments */
import { api, apiAll, ApiError, type ApiUser } from "@/shared/api/client";
import { fetchMe } from "@/shared/api/auth";
import { onLive, startLive, type LiveEvent } from "@/shared/api/realtime";
import { openPrivateFile, uploadFile } from "@/shared/api/uploads";
import {
  amount,
  day,
  extras,
  formatOf,
  idOf,
  isoOr,
  listOf,
  nameOf,
  nowIso,
  platformOf,
  settle,
  splitLocation,
  toneOf,
  usageText,
} from "@/shared/live";

type Obj = Record<string, unknown>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the brand screens are still untyped (@ts-nocheck)
type S = any;

const W = window as unknown as { LLD: S; LLD_DATA: S };
const S = (): S => W.LLD_DATA;
const set = (fn: (s: S) => void, why: string): void => W.LLD.store.set(fn, why);

let userId = "";
let brandId = "";
let favListId = "";
const ex = () => extras<{ budget: unknown; cart: string[]; drafts: unknown[] }>("brand", userId || "anon");

/* ---------- mappers ---------- */

const FORMAT_KEY: Record<string, string> = {
  Reel: "reel",
  Story: "story",
  Carousel: "carousel",
  Video: "video",
  Short: "short",
};

export function mapCreator(c: Obj): S {
  const name = String(c.displayName || c.name || "Creator");
  const [city, state] = splitLocation(c.location);
  const p = platformOf(c.primaryPlatform);
  const rates: Record<string, number> = {};
  const packages = Array.isArray(c.packages) ? (c.packages as Obj[]) : [];
  for (const pk of packages) {
    const k = FORMAT_KEY[formatOf(pk.deliverables || pk.title, String(pk.platform || p))];
    const pr = amount(pk.price as never);
    if (k && pr && (!rates[k] || pr < rates[k])) rates[k] = pr;
  }
  const start = amount(c.startingPrice as never);
  if (!Object.keys(rates).length && start) rates[p === "youtube" ? "video" : "reel"] = start;
  const gallery = Array.isArray(c.gallery) ? (c.gallery as Obj[]) : [];
  return {
    id: String(c.id),
    slug: String(c.slug || ""),
    name,
    handle: c.slug ? "@" + String(c.slug).replace(/-[a-z0-9]{6}$/, "") : "",
    tone: toneOf(name),
    city: city || "India",
    state,
    country: "India",
    gender: String(c.gender || ""),
    age: Number(c.age) || "",
    languages: Array.isArray(c.languages) ? c.languages : [],
    categories: Array.isArray(c.categories) ? c.categories : [],
    content: Object.keys(rates).map(k => k[0].toUpperCase() + k.slice(1)),
    platforms: [{ p, handle: "", followers: Number(c.followerCount) || 0, er: 0, avgViews: 0 }],
    verified: !!c.verified,
    rating: Number(c.rating) || 0,
    reviews: Number(c.reviewCount) || 0,
    availability: "open",
    rates,
    bio: String(c.bio || ""),
    work: gallery.map(g => ({ brand: "", title: String(g.caption || "Gallery"), views: 0, image: g.url })),
    avatarUrl: String(c.avatarUrl || ""),
    repliesWithin: String(c.repliesWithin || ""),
    packages: packages.map(pk => ({
      id: String(pk.id),
      title: String(pk.title || ""),
      platform: platformOf(pk.platform),
      deliverables: String(pk.deliverables || ""),
      price: amount(pk.price as never),
      deliveryDays: Number(pk.deliveryDays) || 0,
    })),
  };
}

const JOB_STATUS: Record<string, string> = {
  open: "open",
  active: "open",
  live: "open",
  closed: "closed",
  awarded: "hired",
  hired: "hired",
  filled: "hired",
  draft: "draft",
};

function mapJob(c: Obj, bidCount: number): S {
  const [city] = splitLocation(c.location);
  return {
    id: String(c.id),
    title: String(c.title || ""),
    status: JOB_STATUS[String(c.status || "open").toLowerCase()] || "open",
    platform: platformOf(c.platform),
    format: formatOf(c.deliverables, String(c.platform || "")),
    category: String(c.category || ""),
    budget: amount(c.budgetMax as never) || amount(c.budgetMin as never),
    budgetMin: amount(c.budgetMin as never),
    deadline: day(c.closesAt),
    posted: isoOr(c.createdAt, nowIso()),
    city: city || "Any city",
    remote: !city,
    languages: Array.isArray(c.languages) ? c.languages : [],
    minFollowers: Number(c.minFollowers) || 0,
    deliverables: listOf(c.deliverables),
    usage: usageText(c.usageRights),
    brief: String(c.brief || ""),
    bids: Number(c.bidCount ?? c.bidsCount ?? bidCount) || bidCount,
  };
}

const BID_STATUS: Record<string, string> = {
  pending: "new",
  submitted: "new",
  open: "new",
  viewed: "viewed",
  shortlisted: "shortlisted",
  selected: "hired",
  accepted: "hired",
  hired: "hired",
  rejected: "declined",
  declined: "declined",
  not_selected: "declined",
  closed: "declined",
};

function mapBid(b: Obj, jobId: string): S | null {
  const st = String(b.status || "pending").toLowerCase();
  if (st === "withdrawn") return null;
  const sent = isoOr(b.createdAt, nowIso());
  const days = Number(b.deliveryDays) || 0;
  const msg = String(b.message || "");
  const [pitch, links = ""] = msg.split(/\n+Similar work:\n/);
  const d = new Date(sent);
  d.setDate(d.getDate() + days);
  return {
    id: String(b.id),
    job: jobId,
    creator: idOf(b.creator) || String(b.creatorId || ""),
    price: amount(b.price as never),
    status: BID_STATUS[st] || "new",
    sent,
    postDate: days ? d.toISOString().slice(0, 10) : "",
    views: b.expectedViews == null ? 0 : Number(b.expectedViews),
    pitch,
    links: links
      .split("\n")
      .map(x => x.trim())
      .filter(Boolean),
  };
}

function stageOf(status: string): string {
  const s = status.toLowerCase();
  if (/refund|cancel/.test(s)) return "refunded";
  if (/approved|completed|released|paid_out/.test(s)) return "released";
  if (/revision/.test(s)) return "revision";
  if (/submitted|delivered|in_review/.test(s)) return "submitted";
  if (/progress|started|disput/.test(s)) return "in_progress";
  if (/funded|paid|active|escrow/.test(s)) return "funded";
  return "accepted";
}

function mapOrder(o: Obj, deliveries: Obj[]): S {
  const camp = (o.campaign && typeof o.campaign === "object" ? o.campaign : null) as Obj | null;
  const pkg = (o.package && typeof o.package === "object" ? o.package : null) as Obj | null;
  const status = String(o.status || "");
  const stage = stageOf(status);
  const created = isoOr(o.createdAt, nowIso());
  const funded = (o.fundedAt || o.paidAt) as string | undefined;
  const deliverablesTxt = o.deliverables ?? camp?.deliverables ?? pkg?.deliverables ?? "";
  const platform = platformOf(o.platform ?? camp?.platform ?? pkg?.platform);
  const dv = deliveries
    .slice()
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
    .map((d, i) => ({
      v: i + 1,
      file: String(
        d.fileName ||
          (d.contentUrl ? String(d.contentUrl).replace(/^https?:\/\//, "") : `delivery-v${i + 1}`),
      ),
      at: isoOr(d.createdAt, created),
      note: String(d.note || ""),
      uploadId: idOf(d.file || d.fileUpload) || String(d.fileUploadId || ""),
      url: String(d.contentUrl || ""),
    }));
  const revs = Array.isArray(o.revisions) ? (o.revisions as Obj[]) : [];
  const log: [string, string][] = [[created, "accepted"]];
  if (funded) log.push([funded, "funded"]);
  dv.forEach(d => log.push([d.at, "submitted"]));
  if (stage === "released")
    log.push([isoOr(o.approvedAt || o.completedAt || o.updatedAt, created), "released"]);
  const review = o.review as Obj | null;
  return {
    id: String(o.id),
    creator: idOf(o.creator),
    source: camp || o.campaignId ? "job" : "direct",
    job: idOf(o.campaign) || (o.campaignId as string) || null,
    title: String(o.title || camp?.title || pkg?.title || "Order"),
    platform,
    format: formatOf(deliverablesTxt, String(platform)),
    price: amount((o.price ?? o.amount ?? o.total) as never),
    stage,
    status,
    allowed: Array.isArray(o.allowedActions) ? o.allowedActions : [],
    revisionsIncluded: Number(o.revisionsIncluded ?? o.revisionsAllowed ?? 1) || 1,
    revisionsUsed: Number(o.revisionsUsed ?? revs.length) || 0,
    due: day(o.dueAt || o.deadline || o.dueDate || camp?.closesAt),
    funded: funded || (["accepted"].includes(stage) ? undefined : created),
    released: stage === "released" ? isoOr(o.approvedAt || o.completedAt || o.updatedAt, created) : undefined,
    refunded: stage === "refunded" ? isoOr(o.updatedAt, created) : undefined,
    refundReason: String(o.cancelReason || o.reason || ""),
    thread: null,
    deliverables: listOf(deliverablesTxt),
    deliveries: dv,
    revisionNote: String((revs[revs.length - 1] as Obj | undefined)?.feedback || o.revisionFeedback || ""),
    review: review
      ? { rating: Number(review.stars) || 0, text: String(review.text || ""), at: day(review.createdAt) }
      : null,
    log,
  };
}

const OFFER_STAGE: Record<string, string> = {
  pending: "invited",
  sent: "invited",
  open: "invited",
  rejected: "declined",
  declined: "declined",
  withdrawn: "cancelled",
  expired: "cancelled",
};

function mapOffer(o: Obj): S | null {
  const st = String(o.status || "pending").toLowerCase();
  const stage = OFFER_STAGE[st];
  if (!stage) return null; // accepted offers show up as their order
  const at = isoOr(o.createdAt, nowIso());
  const deliverable = String(o.deliverable || "");
  return {
    id: "offer-" + String(o.id),
    offerId: String(o.id),
    creator: idOf(o.creator) || String(o.creatorId || ""),
    source: "direct",
    job: null,
    title: deliverable.split(/[,\n]/)[0] || "Direct offer",
    platform: platformOf(deliverable),
    format: formatOf(deliverable),
    price: amount(o.budget as never),
    stage,
    revisionsIncluded: 1,
    revisionsUsed: 0,
    due: day(o.deadline),
    thread: null,
    invited: at,
    declined: stage === "declined" ? isoOr(o.updatedAt, at) : undefined,
    cancelled: stage === "cancelled" ? isoOr(o.updatedAt, at) : undefined,
    deliverables: listOf(deliverable),
    log: [[at, "invited"]],
  };
}

function mapThread(c: Obj): S {
  const party = (c.withParty || {}) as Obj;
  const last = c.lastMessage as Obj | null;
  return {
    id: String(c.id),
    campaign: null,
    creator: idOf(party),
    creatorName: nameOf(party, "Creator"),
    unread: Number(c.unread) || 0,
    loaded: false,
    messages:
      last && (last.text || last.hasAttachment)
        ? [
            {
              from: last.fromMe ? "brand" : "creator",
              text: String(last.text || "📎 Attachment"),
              at: isoOr(last.sentAt, nowIso()),
            },
          ]
        : [],
  };
}

export function mapMessage(m: Obj): S {
  const att = m.attachment as { uploadId: string; contentType: string; size?: number } | null;
  return {
    id: String(m.id || ""),
    from: m.fromMe ? "brand" : "creator",
    text: String(m.text || ""),
    at: isoOr(m.sentAt, nowIso()),
    ...(att
      ? {
          file: {
            name: att.contentType.startsWith("image/") ? "Image" : "File",
            size: att.size ? Math.round(att.size / 1024) + " KB" : "",
            uploadId: att.uploadId,
          },
        }
      : {}),
  };
}

/** billingAddress is an object on the backend ({} when unset; otherwise line1, line2, city, state, pincode or similar).
    Older rows and the sample data are text. The profile shows one line either way. */
function addressText(v: unknown): string {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v !== "object") return "";
  const r = v as Record<string, unknown>;
  const order = [
    "line1",
    "line2",
    "street",
    "area",
    "city",
    "district",
    "state",
    "pincode",
    "postalCode",
    "zip",
    "country",
  ];
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const k of [...order, ...Object.keys(r)]) {
    if (seen.has(k)) continue;
    seen.add(k);
    const x = r[k];
    if (typeof x === "string" || typeof x === "number") {
      const t = String(x).trim();
      if (t) parts.push(t);
    }
  }
  return parts.join(", ");
}

const NOTIF_KIND: Record<string, string> = {
  bid_received: "bid",
  new_bid: "bid",
  new_message: "message",
  deliverable_submitted: "delivery",
  offer_accepted: "accepted",
  offer_rejected: "declined",
  order_approved: "payment",
  kyc_verified: "accepted",
  kyc_rejected: "declined",
};

function mapNotification(n: Obj): S {
  const d = (n.data || {}) as Obj;
  const type = String(n.type || "");
  const go = type.startsWith("kyc")
    ? "#kyc"
    : d.conversationId
      ? "#chat-" + d.conversationId
      : d.orderId
        ? "#campaign-" + d.orderId
        : d.campaignId
          ? "#job-" + d.campaignId
          : "#home";
  return {
    id: String(n.id),
    kind: NOTIF_KIND[type] || "accepted",
    text: String(n.title || n.text || "Update"),
    at: isoOr(n.createdAt, nowIso()),
    go,
    read: !!n.read,
  };
}

/** GST state codes → state names (the backend stores the code). */
const GST_STATE: Record<string, string> = {
  "01": "Jammu and Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "26": "Dadra and Nagar Haveli and Daman and Diu",
  "27": "Maharashtra",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman and Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh",
};

function mapMe(b: Obj, u: ApiUser): S {
  const prev = S().me;
  const [city, state] = splitLocation(b.location || b.city);
  return {
    ...prev,
    brand: String(b.name || b.brandName || prev.brand || "Your brand"),
    name: String(u.fullName || prev.name || ""),
    email: String(u.email || prev.email || ""),
    mobile: String(u.phone || "").replace(/^\+91/, ""),
    logo: (b.logoUrl as string) || null,
    website: String(b.website || ""),
    industry: String(b.industry || ""),
    city: city || prev.city || "",
    state: state || GST_STATE[String(b.stateCode || "")] || prev.state || "",
    about: String(b.about || b.description || prev.about || ""),
    billing: {
      legal: String(b.legalName || ""),
      gstin: String(b.gstin || ""),
      address: addressText(b.billingAddress),
      email: String(b.billingEmail || u.email || ""),
    },
  };
}

/** Escrow rows come from the orders: paid in when funded, released on approval, refunded on cancellation. */
function payments(camps: S[]): S[] {
  const out: S[] = [];
  for (const c of camps) {
    if (!c.funded || String(c.id).startsWith("offer-")) continue;
    out.push({
      id: "p-" + c.id,
      date: day(c.funded),
      kind: "escrow",
      campaign: c.id,
      creator: c.creator,
      amount: c.price,
      status: c.stage === "released" ? "released" : c.stage === "refunded" ? "refunded" : "held",
      method: "Escrow",
      invoice: "",
    });
    if (c.stage === "released")
      out.push({
        id: "r-" + c.id,
        date: day(c.released),
        kind: "release",
        campaign: c.id,
        creator: c.creator,
        amount: c.price,
        status: "released",
        method: "From escrow",
        invoice: "",
      });
    if (c.stage === "refunded")
      out.push({
        id: "f-" + c.id,
        date: day(c.refunded),
        kind: "refund",
        campaign: c.id,
        creator: c.creator,
        amount: c.price,
        status: "refunded",
        method: "To your account",
        invoice: "",
      });
  }
  return out.sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

/* ---------- loading ---------- */

function addCreators(s: S, rows: Obj[]): void {
  for (const r of rows) {
    if (!r || !r.id) continue;
    const c = mapCreator(r);
    const i = s.creators.findIndex((x: S) => x.id === c.id);
    if (i < 0) s.creators.push(c);
    else
      s.creators[i] = {
        ...s.creators[i],
        ...c,
        packages: c.packages.length ? c.packages : s.creators[i].packages,
      };
  }
}

export async function loadBrandGuest(): Promise<void> {
  const creators = await apiAll<Obj>("/v1/creators/", { auth: false }).catch(() => [] as Obj[]);
  set(s => {
    s.creators = [];
    addCreators(s, creators);
  }, "live-loaded");
}

export async function loadBrand(): Promise<ApiUser> {
  /* Everything is asked for at once: the account check no longer holds the other requests back. */
  const me = fetchMe();
  const errors: string[] = [];
  const wave = Promise.all([
    settle(api<Obj>("/v1/brands/me/"), {} as Obj, "profile", errors),
    settle(api<Obj>("/v1/kyc/"), null as Obj | null, "kyc", errors),
    settle(apiAll<Obj>("/v1/creators/"), [] as Obj[], "creators", errors),
    settle(apiAll<Obj>("/v1/campaigns/"), [] as Obj[], "jobs", errors),
    settle(apiAll<Obj>("/v1/offers/"), [] as Obj[], "offers", errors),
    settle(apiAll<Obj>("/v1/orders/"), [] as Obj[], "orders", errors),
    settle(apiAll<Obj>("/v1/conversations/"), [] as Obj[], "messages", errors),
    settle(apiAll<Obj>("/v1/notifications/", {}, 100), [] as Obj[], "notifications", errors),
    settle(apiAll<Obj>("/v1/lists/"), [] as Obj[], "lists", errors),
  ]);
  const user = await me;
  userId = user.id;
  if (user.role !== "brand") return user;
  const [bme, kyc, creators, camps, offers, orders, convs, notifs, lists] = await wave;
  brandId = String(bme.id || "");
  /* only this brand's own briefs: the list endpoint may also return other brands' open briefs */
  const mine = camps.filter(c => !c.brand || !brandId || idOf(c.brand) === brandId);
  const [bidsBy, deliveriesBy, favList] = await Promise.all([
    Promise.all(mine.map(c => apiAll<Obj>(`/v1/campaigns/${c.id}/bids/`).catch(() => [] as Obj[]))),
    Promise.all(orders.map(o => apiAll<Obj>(`/v1/orders/${o.id}/deliverables/`).catch(() => [] as Obj[]))),
    favouritesList(lists),
  ]);
  const x = ex().get();
  set(s => {
    s.session.signedIn = true;
    s.session.guest = false;
    s.session.status = "verified";
    s.session.email = user.email || "";
    s.session.firstRun = !!user.needsOnboarding;
    s.me = mapMe(bme, user);
    s.kyc = kyc ? { ...kyc } : { status: user.kycStatus || "not_started", steps: {} };
    s.creators = [];
    addCreators(s, creators);
    const bidRows: S[] = [];
    mine.forEach((c, i) => {
      for (const b of bidsBy[i]) {
        if (b.creator && typeof b.creator === "object") addCreators(s, [b.creator as Obj]);
        const m = mapBid(b, String(c.id));
        if (m) bidRows.push(m);
      }
    });
    /* drafts never reach the server: keep the ones in memory and the ones saved on this device */
    const drafts = [...(s.jobs || []), ...((x.drafts as S[]) || [])].filter(
      (j: S) => j && j.status === "draft",
    );
    const seen = new Set<string>();
    s.jobs = mine
      .map((c, i) => mapJob(c, bidsBy[i].filter(b => String(b.status) !== "withdrawn").length))
      .concat(drafts.filter((j: S) => !seen.has(j.id) && seen.add(j.id)));
    s.bids = bidRows;
    const campaignRows = orders.map((o, i) => {
      if (o.creator && typeof o.creator === "object") addCreators(s, [o.creator as Obj]);
      return mapOrder(o, deliveriesBy[i]);
    });
    for (const o of offers) {
      if (o.creator && typeof o.creator === "object") addCreators(s, [o.creator as Obj]);
      const m = mapOffer(o);
      if (m) campaignRows.push(m);
    }
    s.campaigns = campaignRows;
    s.threads = convs.map(mapThread);
    linkThreads(s);
    s.payments = payments(s.campaigns);
    s.notifications = notifs.map(mapNotification);
    s.favorites = favList.ids;
    s.cart = (x.cart || []).filter((id: string) => s.creators.some((c: S) => c.id === id));
    if (x.budget) s.budget = x.budget;
    s.payMethods = [];
    s.plan = null;
  }, "live-loaded");
  favListId = favList.id;
  if (errors.length) console.warn("Some sections could not load:", errors.join(", "));
  startLive();
  wireLive();
  return user;
}

/** There is one conversation per brand and creator: every campaign with that creator uses it, and the thread
    shows the newest one. */
function linkThreads(s: S): void {
  for (const t of s.threads) {
    const mine = s.campaigns
      .filter((x: S) => x.creator === t.creator && !String(x.id).startsWith("offer-"))
      .sort((a: S, b: S) => String(b.log?.[0]?.[0] || "").localeCompare(String(a.log?.[0]?.[0] || "")));
    const c = mine[0];
    t.campaign = c ? c.id : null;
    mine.forEach((x: S) => (x.thread = t.id));
    if (!s.creators.some((x: S) => x.id === t.creator))
      s.creators.push(mapCreator({ id: t.creator, displayName: t.creatorName }));
  }
}

async function favouritesList(lists: Obj[]): Promise<{ id: string; ids: string[] }> {
  let fav = lists.find(l => /^favou?rites$/i.test(String(l.name)));
  if (!fav) return { id: "", ids: [] };
  if (!Array.isArray(fav.creators)) fav = await api<Obj>(`/v1/lists/${fav.id}/`).catch(() => fav!);
  const ids = (Array.isArray(fav.creators) ? (fav.creators as unknown[]) : []).map(c =>
    typeof c === "string" ? c : idOf((c as Obj).creator || c),
  );
  return { id: String(fav.id), ids };
}

let wired = false;
function wireLive(): void {
  if (wired) return;
  wired = true;
  onLive((e: LiveEvent) => {
    if (e.event === "connected") return void refresh();
    if (e.event === "new_message") {
      const m = mapMessage(e.message);
      set(s => {
        const t = s.threads.find((x: S) => x.id === e.conversationId);
        if (!t) return void refreshThreads();
        if (m.id && t.messages.some((x: S) => x.id === m.id)) return;
        if (m.from === "brand") {
          const mine = t.messages.find((x: S) => x.from === "brand" && !x.id && x.text === m.text);
          if (mine) return void (mine.id = m.id);
        }
        t.messages.push(m);
        if (m.from !== "brand") t.unread = (t.unread || 0) + 1;
      }, "chat-live");
      return;
    }
    if (e.event === "notification") {
      const n = mapNotification(e.notification as unknown as Obj);
      set(s => {
        if (!s.notifications.some((x: S) => x.id === n.id)) s.notifications.unshift(n);
      }, "notif-live");
      void refresh();
    }
  });
}

async function refreshThreads(): Promise<void> {
  const convs = await apiAll<Obj>("/v1/conversations/");
  set(s => {
    const old = new Map(s.threads.map((t: S) => [t.id, t]));
    s.threads = convs.map(c => {
      const t = mapThread(c);
      const o = old.get(t.id) as S;
      if (o?.loaded) {
        t.messages = o.messages;
        t.loaded = true;
      }
      return t;
    });
    linkThreads(s);
  }, "chat-live");
}

/** Reloads everything the other side can change. Cheap enough at this size. */
export async function refresh(): Promise<void> {
  try {
    await loadBrand();
    set(() => undefined, "live-refresh");
  } catch {
    /* the next live event or reload tries again */
  }
}

/* ---------- actions ---------- */

export function errorText(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === "KYC_REQUIRED") return "Verify your business first. It takes a few minutes.";
    return e.message;
  }
  return (e as Error)?.message || "Something went wrong. Please try again.";
}
export const isKycRequired = (e: unknown): boolean => e instanceof ApiError && e.code === "KYC_REQUIRED";

const usageFor = (u: unknown): string => String(u || "");

export const brandApi = {
  errorText,
  isKycRequired,
  refresh,

  /* creators */
  async creatorDetail(id: string): Promise<void> {
    const [c, reviews] = await Promise.all([
      api<Obj>(`/v1/creators/${id}/`),
      apiAll<Obj>(`/v1/creators/${id}/reviews/`, {}, 50).catch(() => [] as Obj[]),
    ]);
    set(s => {
      addCreators(s, [c]);
      const cc = s.creators.find((x: S) => x.id === id);
      if (cc)
        cc.reviewList = reviews.map(r => ({
          brand: nameOf(r.brand || r.author, "Brand"),
          rating: Number(r.stars) || 0,
          text: String(r.text || ""),
          at: day(r.createdAt),
        }));
    }, "live-refresh");
  },

  async setFavorite(creatorId: string, on: boolean): Promise<void> {
    if (!favListId)
      favListId = String((await api<Obj>("/v1/lists/", { method: "POST", body: { name: "Favourites" } })).id);
    if (on) await api(`/v1/lists/${favListId}/creators/`, { method: "POST", body: { creatorId } });
    else await api(`/v1/lists/${favListId}/creators/${creatorId}/`, { method: "DELETE" });
  },

  saveCart(ids: string[]): void {
    ex().set({ cart: ids });
  },
  saveBudget(b: unknown): void {
    ex().set({ budget: b });
  },
  saveDrafts(jobs: S[]): void {
    ex().set({ drafts: jobs.filter(j => j.status === "draft") });
  },

  /* jobs (briefs) */
  async postJob(rec: S, existingId?: string): Promise<string> {
    const body: Obj = {
      title: rec.title,
      brief: rec.brief,
      platform: rec.platform,
      deliverables: (rec.deliverables || []).join(" + "),
      budgetMin: Math.round(rec.budget * 0.8),
      budgetMax: rec.budget,
      closesAt: rec.deadline,
      usageRights: usageFor(rec.usage),
    };
    const r = existingId
      ? await api<Obj>(`/v1/campaigns/${existingId}/`, { method: "PATCH", body })
      : await api<Obj>("/v1/campaigns/", { method: "POST", body });
    return String(r.id);
  },
  async closeJob(id: string): Promise<void> {
    await api(`/v1/campaigns/${id}/close/`, { method: "POST" });
  },
  async selectBid(jobId: string, bidId: string): Promise<void> {
    await api(`/v1/campaigns/${jobId}/bids/${bidId}/select/`, { method: "POST" });
    await refresh();
  },

  /* direct offers (the hiring cart) */
  async sendOffer(o: {
    creatorId: string;
    deliverable: string;
    budget: number;
    deadline: string;
    message: string;
    usageRights: string;
  }): Promise<void> {
    await api("/v1/offers/", { method: "POST", body: o });
  },
  async withdrawOffer(offerId: string): Promise<void> {
    await api(`/v1/offers/${offerId}/withdraw/`, { method: "POST" });
  },

  /* orders (campaigns on screen) */
  async approve(orderId: string): Promise<void> {
    await api(`/v1/orders/${orderId}/approve/`, { method: "POST" });
  },
  async requestRevision(orderId: string, feedback: string): Promise<void> {
    await api(`/v1/orders/${orderId}/revisions/`, { method: "POST", body: { feedback } });
  },
  async review(orderId: string, stars: number, text: string): Promise<void> {
    await api(`/v1/orders/${orderId}/review/`, { method: "POST", body: { stars, text } });
  },
  async cancelOrder(orderId: string, reason: string): Promise<void> {
    await api(`/v1/orders/${orderId}/cancel/`, { method: "POST", body: { reason } });
  },
  async dispute(orderId: string, reason: string): Promise<void> {
    await api(`/v1/orders/${orderId}/disputes/`, { method: "POST", body: { reason } });
  },
  async openDelivery(d: { uploadId?: string; url?: string }): Promise<void> {
    if (d.uploadId) return openPrivateFile(d.uploadId);
    if (d.url) window.open(d.url, "_blank", "noopener");
  },

  /* messages */
  async loadThread(id: string): Promise<void> {
    const msgs = await apiAll<Obj>(`/v1/conversations/${id}/messages/`, {}, 300);
    set(s => {
      const t = s.threads.find((x: S) => x.id === id);
      if (!t) return;
      t.messages = msgs.map(mapMessage).reverse();
      t.loaded = true;
    }, "chat-loaded");
  },
  async sendMessage(id: string, text: string, file?: File): Promise<S> {
    const attachmentUploadId = file ? (await uploadFile("chat_attachment", file)).id : undefined;
    const r = await api<Obj>(`/v1/conversations/${id}/messages/`, {
      method: "POST",
      body: { ...(text ? { text } : {}), ...(attachmentUploadId ? { attachmentUploadId } : {}) },
    });
    return mapMessage({ ...r, fromMe: true });
  },
  async markRead(id: string): Promise<void> {
    await api(`/v1/conversations/${id}/read/`, { method: "POST" });
  },
  async openChatWith(creatorId: string): Promise<string> {
    const r = await api<Obj>("/v1/conversations/", { method: "POST", body: { creatorId } });
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

  /* brand profile */
  async saveBrand(me: S): Promise<void> {
    const body: Obj = {
      name: me.brand,
      website: me.website ? (/^https?:/.test(me.website) ? me.website : "https://" + me.website) : "",
      industry: me.industry || "",
      legalName: me.billing?.legal || "",
      gstin: me.billing?.gstin || "",
      billingAddress: me.billing?.address || "",
    };
    const sc = String(me.billing?.gstin || "").slice(0, 2);
    if (/^\d{2}$/.test(sc)) body.stateCode = sc;
    await api("/v1/brands/me/", { method: "PATCH", body });
  },
  async uploadLogo(file: Blob): Promise<string | null> {
    return (await uploadFile("brand_logo", file)).url;
  },

  /* KYC */
  async kyc(): Promise<Obj> {
    const k = await api<Obj>("/v1/kyc/");
    set(s => (s.kyc = k), "kyc-live");
    return k;
  },
  async kycPan(pan: string, nameOnPan: string): Promise<void> {
    const k = await api<Obj>("/v1/kyc/pan/", { method: "PUT", body: { pan: pan.toUpperCase(), nameOnPan } });
    set(s => (s.kyc = k), "kyc-live");
  },
  async kycId(idType: string, file: File): Promise<void> {
    const up = await uploadFile("kyc_document", file);
    const k = await api<Obj>("/v1/kyc/id/", { method: "PUT", body: { idType, uploadId: up.id } });
    set(s => (s.kyc = k), "kyc-live");
  },
  async kycBank(accountHolderName: string, accountNumber: string, ifsc: string): Promise<void> {
    const k = await api<Obj>("/v1/kyc/bank/", {
      method: "PUT",
      body: { accountHolderName, accountNumber, ifsc: ifsc.toUpperCase() },
    });
    set(s => (s.kyc = k), "kyc-live");
  },
  async kycSubmit(): Promise<void> {
    const k = await api<Obj>("/v1/kyc/submit/", { method: "POST" });
    set(s => (s.kyc = k), "kyc-live");
  },
};

export const currentBrandId = (): string => brandId;
