/* The creator dashboard's connection to the backend. */
import { api, apiAll, ApiError, idemKey, storedUser } from "@/shared/api/client";
import { fetchMe } from "@/shared/api/auth";
import { onLive, startLive } from "@/shared/api/realtime";
import { uploadFile } from "@/shared/api/uploads";
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
  usageText,
} from "../../../shared/live";

export function emptyCreatorState() {
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
    jobsUI: {
      q: "",
      city: "",
      platform: "",
      category: "",
      minBudget: 0,
      sort: "newest",
      savedOnly: false,
      showHidden: false,
    },
    hiddenJobs: [],
    reports: [],
    bidDrafts: {},
    justSent: null,
    bidRules: { minPaise: 100000, overBudgetPct: 25, whyMin: 40, whyMax: 500, maxLinks: 5 },
    payoutMethods: [],
    workUI: { activeFilter: "all", earnRange: "fy", earnFilter: "all" },
  };
}

const BID_STATUS = {
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

const KYC_STATUS = {
  not_started: "not_started",
  in_progress: "in_progress",
  pending: "under_review",
  verified: "verified",
  rejected: "action_needed",
};

function stageOf(status) {
  const s = status.toLowerCase();
  if (/revision/.test(s)) return "revision";
  if (/submitted|delivered|in_review/.test(s)) return "submitted";
  if (/approved|completed|released|paid_out/.test(s)) return "approved";
  if (/progress|started|funded|active|paid|accepted/.test(s)) return "in_progress";
  return "kickoff";
}

export function mapJob(c, me) {
  const brand = nameOf(c.brand, "Brand on Linkloom");
  const platform = platformOf(c.platform);
  const category = String(c.category || c.categories?.[0] || "");
  const [city] = splitLocation(c.location);
  const languages = Array.isArray(c.languages) ? c.languages : [];
  const j = {
    id: c.id,
    brand,
    bi: initialsOf(brand),
    tone: toneOf(brand),
    title: c.title || "Untitled brief",
    platform,
    format: formatOf(c.deliverables, c.platform),
    category,
    budget: amount(c.budgetMax) || amount(c.budgetMin),
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
    usage: usageText(c.usageRights),
  };
  if (c.status && !/open|active|live/i.test(String(c.status))) j.status = "hired";
  if (me) scoreJob(j, me);
  return j;
}

function scoreJob(j, me) {
  const reasons = [];
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

export function mapBid(b, jobs) {
  const camp = b.campaign && typeof b.campaign === "object" ? b.campaign : null;
  const jobId = idOf(b.campaign) || String(b.campaignId || "");
  const j = jobs.find(x => x.id === jobId);
  const status = BID_STATUS[String(b.status || "pending").toLowerCase()] || "submitted";
  const sent = isoOr(b.createdAt || b.sentAt, nowIso());
  const deliveryDays = Number(b.deliveryDays) || 0;
  const message = String(b.message || "");
  const out = {
    id: String(b.id),
    job: jobId,
    price: amount(b.price),
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

export function mapOrder(o) {
  const camp = o.campaign && typeof o.campaign === "object" ? o.campaign : {};
  const brand = nameOf(o.brand || camp.brand, "Brand");
  const status = String(o.status || "");
  const deliverablesTxt = o.deliverables ?? camp.deliverables ?? o.package?.deliverables;
  const platform = platformOf(o.platform ?? camp.platform ?? o.package?.platform);
  const created = isoOr(o.createdAt, nowIso());
  const funded = isoOr(o.fundedAt || o.paidAt, created);
  const due =
    day(o.dueAt || o.deadline || o.dueDate || camp.closesAt) ||
    addDaysIso(created, Number(o.deliveryDays) || 7);
  const stage = stageOf(status);
  const released = /approved|completed|released/.test(status.toLowerCase());
  const a = {
    id: String(o.id),
    job: idOf(o.campaign) || "",
    brand,
    title: String(o.title || camp.title || o.package?.title || "Order"),
    platform,
    format: formatOf(deliverablesTxt, String(platform)),
    price: amount(o.price ?? o.amount ?? o.total),
    stage,
    pay: released ? "released" : "escrow",
    due,
    uploads: [],
    deliverables: listOf(typeof deliverablesTxt === "string" ? deliverablesTxt : ""),
    thread: "",
    revisionsIncluded: Number(o.revisionsIncluded ?? o.revisionsAllowed ?? 1) || 1,
    brief: String(o.brief || camp.brief || ""),
    usage: usageText(o.usageRights ?? camp.usageRights),
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
  a.allowed = Array.isArray(o.allowedActions) ? o.allowedActions : [];
  a.brandId = idOf(o.brand || camp.brand);
  a.status = status;
  return a;
}

export function mapMessage(m) {
  const att = m.attachment || null;
  const text =
    String(m.text || "") || (att ? (att.contentType.startsWith("image/") ? "📎 Image" : "📎 File") : "");
  const out = { from: m.fromMe ? "me" : "brand", at: isoOr(m.sentAt, nowIso()), text };
  if (m.fromMe) out.status = "delivered";
  if (att) out.attachment = att;
  out.id = String(m.id || "");
  return out;
}

function mapThread(c, active) {
  const party = c.withParty || {};
  const brand = nameOf(party, "Brand");
  const brandId = idOf(party);
  const a = active.find(x => x.brandId === brandId);
  const t = {
    id: String(c.id),
    brand,
    bi: initialsOf(brand),
    tone: toneOf(brand),
    job: a?.id || "",
    unread: Number(c.unread) || 0,
    msgs: [],
  };
  const last = c.lastMessage || null;
  if (last && (last.text || last.hasAttachment))
    t.msgs.push({
      from: last.fromMe ? "me" : "brand",
      at: isoOr(last.sentAt, isoOr(c.updatedAt, nowIso())),
      text: String(last.text || "📎 Attachment"),
      ...(last.fromMe ? { status: "delivered" } : {}),
    });
  t.loaded = false;
  t.image = String(party.image || "");
  if (a) a.thread = t.id;
  return t;
}

const NOTIF_GO = {
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

export function mapNotification(n) {
  const data = n.data || {};
  const type = String(n.type || "");
  const go =
    NOTIF_GO[type]?.(data) ||
    (data.orderId ? "#work-" + data.orderId : data.campaignId ? "#job-" + data.campaignId : "#home");
  return {
    id: String(n.id),
    at: isoOr(n.createdAt || n.at, nowIso()),
    text: String(n.title || n.text || n.body || "Update"),
    go,
    read: !!n.read,
  };
}

export function mapKyc(k, prev) {
  const steps = k.steps || {};
  const pan = steps.pan || {}, id = steps.id || {}, bank = steps.bank || {};
  const ID_NAME = {
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
    submittedAt: k.submittedAt || undefined,
    selfie: true,
    gstDone: true,
    fix: status === "action_needed" ? ["pan", "id", "payout"] : null,
    steps: { pan: !!pan.done, id: !!id.done, bank: !!bank.done },
  };
}

function mapMe(c, user, x, prev) {
  const [city, region] = splitLocation(c.location);
  const name = String(c.displayName || user?.fullName || prev.name || "Creator");
  const primary = platformOf(c.primaryPlatform);
  const platforms = { ...(x.platforms || {}) };
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
  const handle =
    platforms.instagram?.handle ||
    platforms.youtube?.handle ||
    (c.slug ? "@" + String(c.slug).replace(/-[a-z0-9]{6}$/, "") : "");
  return {
    ...prev,
    name,
    handle,
    city: city || prev.city,
    region: region || x.region || prev.region,
    dob: x.dob || prev.dob,
    gender: x.gender || prev.gender,
    languages: x.languages || prev.languages,
    categories: Array.isArray(c.categories) ? c.categories : prev.categories,
    bio: String(c.bio ?? prev.bio),
    photo: c.avatarUrl || null,
    platforms,
    portfolio: x.portfolio || prev.portfolio,
  };
}

let store;
let creatorId = "";
let userId = "";
const ex = () => extras("creator", userId || "anon");

export const creatorProfileId = () => creatorId;

export async function loadGuest(st) {
  store = st;
  const camps = await apiAll("/v1/campaigns/", { auth: false }).catch(() => []);
  st.set(s => {
    s.jobs = camps.map(c => mapJob(c));
  }, "live-loaded");
}

export async function loadCreator(st) {
  store = st;
  const me = fetchMe();
  const errors = [];
  const knownUser = storedUser()?.id || "";
  const knownCreator = knownUser
    ? extras("creator", knownUser).get().creatorId || ""
    : "";
  const loadReviews = (id) =>
    settle(apiAll(`/v1/creators/${id}/reviews/`, {}, 50), [], "reviews", errors);
  const earlyReviews = knownCreator ? loadReviews(knownCreator) : null;
  const wave = Promise.all([
    settle(api("/v1/creators/me/"), {}, "profile", errors),
    settle(api("/v1/kyc/"), null, "kyc", errors),
    settle(apiAll("/v1/campaigns/"), [], "jobs", errors),
    settle(apiAll("/v1/creators/me/bids/"), [], "bids", errors),
    settle(apiAll("/v1/creators/me/orders/"), [], "orders", errors),
    settle(apiAll("/v1/conversations/"), [], "messages", errors),
    settle(apiAll("/v1/notifications/", {}, 100), [], "notifications", errors),
    settle(api("/v1/creators/me/earnings/"), null, "earnings", errors),
  ]);
  const user = await me;
  userId = user.id;
  if (user.role === "brand") return user;
  const [cme, kyc, camps, myBids, orders, convs, notifs, earnings] = await wave;
  creatorId = String(cme.id || "");
  const x = ex().get();
  if (creatorId && creatorId !== knownCreator)
    extras("creator", userId).set({ creatorId });
  const reviews = !creatorId
    ? []
    : earlyReviews && creatorId === knownCreator
      ? await earlyReviews
      : await loadReviews(creatorId);

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
    s.bids = myBids
      .map(r =>
        r.price !== undefined
          ? r
          : (r.myBid || r.bid)
            ? { ...(r.myBid || r.bid), campaign: r }
            : null,
      )
      .filter(r => !!r)
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

function maskPhone(p) {
  const d = p.replace(/\D/g, "").slice(-10);
  return d.length === 10 ? `+91 ${d.slice(0, 2)}•••••${d.slice(7)}` : p;
}

function applyEarnings(s, e) {
  const approved = s.active.filter(a => a.pay === "released");
  s.ledger = approved.map(a => ({
    id: "l-" + a.id,
    date: day(a.log.find(l => l.kind === "approved")?.at || a.funded),
    brand: a.brand,
    job: a.title,
    amount: a.price,
    status: "paid",
  }));
  const payouts = !!e?.payoutsEnabled;
  s.payoutsEnabled = payouts;
  s.earningsSummary = e
    ? {
        inEscrow: amount(e.inEscrow),
        earned: amount(e.earned),
        tds: amount(e.tdsDeducted),
        ordersInEscrow: Number(e.ordersInEscrow) || 0,
        ordersEarned: Number(e.ordersEarned) || 0,
      }
    : null;
  s.readyToWithdraw = payouts ? amount(e?.earned) : 0;
  s.withdrawals = [];
  s.payoutMethods = [];
}

let wired = false;
function wireLive() {
  if (wired) return;
  wired = true;
  onLive(e => {
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
        const id = m.id;
        if (id && t.msgs.some(x => x.id === id)) return;
        if (m.from === "me") {
          const mine = t.msgs.find(x => x.from === "me" && !x.id && x.text === m.text);
          if (mine) {
            mine.id = id;
            return;
          }
        }
        t.msgs.push(m);
        if (m.from !== "me") t.unread += 1;
      }, "chat-live");
      return;
    }
    if (e.event === "notification") {
      const n = mapNotification(e.notification);
      store.set(s => {
        if (!s.notifications.some(x => x.id === n.id)) s.notifications.unshift(n);
      }, "notif-live");
      const t = e.notification.type;
      if (t === "kyc_verified" || t === "kyc_rejected") void refreshKyc();
      else void refreshSoft();
    }
  });
}

export async function refreshKyc() {
  const k = await api("/v1/kyc/");
  store.set(s => {
    s.kyc = mapKyc(k, s.kyc);
  }, "kyc-live");
}

async function refreshThreads() {
  const convs = await apiAll("/v1/conversations/");
  store.set(s => {
    const old = new Map(s.threads.map(t => [t.id, t]));
    s.threads = convs.map(c => {
      const t = mapThread(c, s.active);
      const o = old.get(t.id);
      if (o?.loaded) {
        t.msgs = o.msgs;
        t.loaded = true;
      }
      return t;
    });
  }, "chat-live");
}

export async function refreshSoft() {
  const [myBids, orders, notifs] = await Promise.all([
    apiAll("/v1/creators/me/bids/").catch(() => null),
    apiAll("/v1/creators/me/orders/").catch(() => null),
    apiAll("/v1/notifications/", {}, 100).catch(() => null),
  ]);
  store.set(s => {
    if (myBids)
      s.bids = myBids
        .map(r =>
          r.price !== undefined
            ? r
            : (r.myBid || r.bid)
              ? { ...(r.myBid || r.bid), campaign: r }
              : null,
        )
        .filter(r => !!r)
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

export function errorText(e) {
  if (e instanceof ApiError) {
    if (e.code === "KYC_REQUIRED") return "Verify your ID first. Your draft is saved.";
    return e.message;
  }
  return "Something went wrong. Please try again.";
}

export const isKycRequired = (e) => e instanceof ApiError && e.code === "KYC_REQUIRED";

export const creatorApi = {
  errorText,
  async placeBid(jobId, p) {
    const days = Math.max(1, daysUntil(p.postDate));
    const message = p.links.length ? `${p.why}\n\nSimilar work:\n${p.links.join("\n")}` : p.why;
    const body = { price: p.price, message, deliveryDays: days };
    if (p.views) body.expectedViews = p.views;
    const r = await api(`/v1/campaigns/${jobId}/bids/`, { method: "POST", body });
    const b = mapBid({ ...r, campaign: r.campaign || jobId }, store.s.jobs);
    b.postDate = p.postDate;
    b.links = p.links;
    b.why = p.why;
    return b;
  },

  async withdrawBid(bid) {
    await api(`/v1/campaigns/${bid.job}/bids/${bid.id}/withdraw/`, { method: "POST" });
  },

  async reviewOrder(orderId, stars, text) {
    await api(`/v1/orders/${orderId}/review/`, { method: "POST", body: { stars, text } });
  },

  async fetchJob(id) {
    const c = await api(`/v1/campaigns/${id}/`);
    store.set(s => {
      const j = mapJob(c, s.me);
      s.jobs = s.jobs.filter(x => x.id !== j.id).concat(j);
    }, "live-refresh");
  },

  saveJobs(saved, hidden) {
    ex().set({ saved, hiddenJobs: hidden });
  },

  async loadThread(threadId) {
    const msgs = await apiAll(`/v1/conversations/${threadId}/messages/`, {}, 300);
    store.set(s => {
      const t = s.threads.find(x => x.id === threadId);
      if (!t) return;
      t.msgs = msgs.map(mapMessage).reverse();
      t.loaded = true;
    }, "chat-loaded");
  },

  async sendMessage(threadId, text, file) {
    let attachmentUploadId;
    if (file) attachmentUploadId = (await uploadFile("chat_attachment", file)).id;
    const r = await api(`/v1/conversations/${threadId}/messages/`, {
      method: "POST",
      body: { ...(text ? { text } : {}), ...(attachmentUploadId ? { attachmentUploadId } : {}) },
    });
    return mapMessage({ ...r, fromMe: true });
  },

  async markRead(threadId) {
    await api(`/v1/conversations/${threadId}/read/`, { method: "POST" });
  },

  async openThreadWithBrand(brandId) {
    const r = await api("/v1/conversations/", { method: "POST", body: { brandId } });
    await refreshThreads();
    return String(r.id);
  },

  async readNotification(id) {
    await api(`/v1/notifications/${id}/read/`, { method: "PATCH" });
  },
  async readAllNotifications() {
    await api("/v1/notifications/read-all/", { method: "POST" });
  },

  async submitDeliverable(orderId, d) {
    let up = null;
    const body = {};
    if (d.file) {
      up = await uploadFile("deliverable", d.file);
      body.fileUploadId = up.id;
    } else if (d.url) body.contentUrl = d.url.startsWith("http") ? d.url : "https://" + d.url;
    if (d.note) body.note = d.note;
    await api(`/v1/orders/${orderId}/deliverables/`, { method: "POST", body });
    return up;
  },
  async refreshOrders() {
    await refreshSoft();
  },
  async orderAction(orderId, action, reason) {
    await api(`/v1/orders/${orderId}/${action}/`, { method: "POST", body: { reason } });
  },
  async offers() {
    return apiAll("/v1/creators/me/offers/");
  },
  async answerOffer(id, status) {
    await api(`/v1/creators/me/offers/${id}/`, { method: "PATCH", body: { status } });
    await refreshSoft();
  },

  async saveProfile(p) {
    const body = {};
    if (p.name !== undefined) body.displayName = p.name.trim();
    if (p.bio !== undefined) body.bio = p.bio.trim();
    if (p.categories !== undefined) body.categories = p.categories;
    if (p.city !== undefined)
      body.location = [p.city.trim(), (p.region || "").trim()].filter(Boolean).join(", ");
    if (p.primaryPlatform) body.primaryPlatform = p.primaryPlatform;
    if (Object.keys(body).length) await api("/v1/creators/me/", { method: "PATCH", body });
    if (p.extras) ex().set(p.extras);
  },
  async uploadAvatar(file) {
    const r = await uploadFile("avatar", file);
    return r.url;
  },

  async kycPan(pan, nameOnPan) {
    const k = await api("/v1/kyc/pan/", { method: "PUT", body: { pan: pan.toUpperCase(), nameOnPan } });
    store.set(s => (s.kyc = mapKyc(k, s.kyc)), "kyc-live");
  },
  async kycId(idType, file) {
    const ID = {
      Aadhaar: "aadhaar",
      Passport: "passport",
      "Voter ID": "voter_id",
      "Driving licence": "driving_licence",
    };
    const up = await uploadFile("kyc_document", file);
    const k = await api("/v1/kyc/id/", {
      method: "PUT",
      body: { idType: ID[idType] || "aadhaar", uploadId: up.id },
    });
    store.set(s => (s.kyc = mapKyc(k, s.kyc)), "kyc-live");
  },
  async kycBank(accountHolderName, accountNumber, ifsc) {
    const k = await api("/v1/kyc/bank/", {
      method: "PUT",
      body: { accountHolderName, accountNumber: accountNumber.replace(/\s/g, ""), ifsc: ifsc.toUpperCase() },
    });
    store.set(s => (s.kyc = mapKyc(k, s.kyc)), "kyc-live");
  },
  async kycSubmit() {
    const k = await api("/v1/kyc/submit/", { method: "POST" });
    store.set(s => (s.kyc = mapKyc(k, s.kyc)), "kyc-live");
  },
};

export const idempotencyKey = idemKey;
export const currentUser = storedUser;
