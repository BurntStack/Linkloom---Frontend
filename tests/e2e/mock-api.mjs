/* Stand-in for the backend in browser tests: the response shapes the backend documents, plus a request log.
   Used by live-mocked.mjs (render every screen) and live-actions.mjs (click the actions). */
export const API = "https://collab-api-ewju.onrender.com";

const money = r => ({ amount: r * 100, currency: "INR" });
const now = new Date().toISOString();
const days = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const brandRef = { id: "b1", name: "Test Brand Co", logoUrl: "" };
const creatorRef = { id: "c1", displayName: "Test Creator", slug: "test-creator-ab12cd", avatarUrl: "" };
const campaign = (id, title, extra = {}) => ({
  id, title, brief: "Show the product in a real morning routine.", platform: "instagram",
  deliverables: "1 Reel + 2 Stories", budgetMin: money(5000), budgetMax: money(15000), closesAt: days(10),
  status: "open", usageRights: "Brand can repost for 30 days", brand: brandRef, createdAt: now, bidCount: 1, ...extra,
});
const order = (id, status, extra = {}) => ({
  id, status, price: money(12000), campaign: campaign("k1", "Morning routine Reel"), brand: brandRef, creator: creatorRef,
  allowedActions: ["submit_deliverable"], createdAt: now, fundedAt: now, dueAt: days(7), ...extra,
});

export function fixtures(role) {
  const user = { id: role === "brand" ? "u-b" : "u-c", role, phone: "+919999999999", email: "qa@example.com", fullName: "QA Person", needsOnboarding: false, kycStatus: "verified" };
  return {
    "GET /v1/auth/me/": user,
    "GET /v1/creators/me/": { id: "c1", slug: "test-creator-ab12cd", displayName: "Test Creator", bio: "Food and travel, Hyderabad.", categories: ["Food"], location: "Hyderabad, Telangana", primaryPlatform: "instagram", repliesWithin: "24h", verified: true, followerCount: 52000, avatarUrl: "", rating: 4.6, reviewCount: 3, startingPrice: money(8000) },
    "GET /v1/brands/me/": { id: "b1", name: "Test Brand Co", website: "https://test.example", industry: "Food", legalName: "Test Brand Pvt Ltd", gstin: "36ABCDE1234F1Z5", stateCode: "36", billingAddress: "Hyderabad" },
    "GET /v1/kyc/": { status: "verified", rejectionReason: null, submittedAt: now, steps: { pan: { done: true, nameOnPan: "QA PERSON", panLast4: "234F" }, id: { done: true, idType: "aadhaar" }, bank: { done: true, accountHolderName: "QA PERSON", accountLast4: "4821", ifsc: "HDFC0001234" } } },
    "GET /v1/campaigns/": [campaign("k1", "Morning routine Reel"), campaign("k2", "Weekend cafe vlog", { platform: "youtube", deliverables: "1 video, 8 min" })],
    "GET /v1/campaigns/k1/": campaign("k1", "Morning routine Reel"),
    "GET /v1/campaigns/k1/bids/": [{ id: "bid1", campaign: "k1", creator: creatorRef, price: money(12000), message: "I post daily food Reels.\n\nSimilar work:\ninstagram.com/reel/x", expectedViews: 40000, deliveryDays: 6, status: "pending", createdAt: now }],
    "GET /v1/campaigns/k2/bids/": [],
    "GET /v1/creators/me/campaigns/": [{ id: "bid1", campaign: campaign("k1", "Morning routine Reel"), price: money(12000), message: "I post daily food Reels.", expectedViews: 40000, deliveryDays: 6, status: "pending", createdAt: now }],
    "GET /v1/creators/me/orders/": [order("o1", "in_progress"), order("o2", "submitted"), order("o3", "completed", { approvedAt: now })],
    "GET /v1/orders/": [order("o1", "in_progress"), order("o2", "submitted", { allowedActions: ["approve", "request_revision"] }), order("o3", "completed", { approvedAt: now })],
    "GET /v1/orders/o2/deliverables/": [{ id: "d1", fileUploadId: "up1", fileName: "draft-v1.mp4", note: "First cut", createdAt: now }],
    "GET /v1/orders/o1/deliverables/": [],
    "GET /v1/orders/o3/deliverables/": [{ id: "d2", contentUrl: "https://instagram.com/reel/live", note: "Live post", createdAt: now }],
    "GET /v1/conversations/": [{ id: "cv1", withParty: role === "brand" ? { type: "creator", id: "c1", name: "Test Creator", image: "" } : { type: "brand", id: "b1", name: "Test Brand Co", image: "" }, lastMessage: { text: "Hi! Draft is up.", hasAttachment: false, fromMe: false, sentAt: now }, unread: 1, updatedAt: now }],
    "GET /v1/conversations/cv1/messages/": [{ id: "m2", senderId: "x", fromMe: false, text: "Hi! Draft is up.", attachment: null, sentAt: now }, { id: "m1", senderId: "y", fromMe: true, text: "Thanks, looking now.", attachment: null, sentAt: now }],
    "POST /v1/conversations/cv1/read/": null,
    "GET /v1/notifications/": [{ id: "n1", type: "new_message", title: "New message from Test Brand Co", data: { conversationId: "cv1" }, read: false, createdAt: now }],
    "GET /v1/creators/me/earnings/": { inEscrow: money(24000), earned: money(12000), tdsDeducted: money(120), ordersInEscrow: 2, ordersEarned: 1, payoutsEnabled: false },
    "GET /v1/creators/me/offers/": [{ id: "of1", brand: brandRef, deliverable: "1 Reel, 30 s", budget: money(9000), deadline: days(14), message: "Love your food Reels", usageRights: "No repost", status: "pending" }],
    "GET /v1/offers/": [{ id: "of2", creator: creatorRef, deliverable: "1 Story", budget: money(4000), deadline: days(12), message: "Quick story", status: "pending", createdAt: now }],
    "GET /v1/creators/": [{ ...creatorRef, bio: "Food and travel", categories: ["Food"], location: "Hyderabad, Telangana", primaryPlatform: "instagram", repliesWithin: "24h", verified: true, followerCount: 52000, rating: 4.6, reviewCount: 3, startingPrice: money(8000) }],
    "GET /v1/creators/c1/": { ...creatorRef, bio: "Food and travel", categories: ["Food"], location: "Hyderabad, Telangana", primaryPlatform: "instagram", verified: true, followerCount: 52000, rating: 4.6, reviewCount: 3, startingPrice: money(8000), packages: [{ id: "p1", title: "One Reel", platform: "instagram", deliverables: "1 Reel", price: money(8000), deliveryDays: 5 }], gallery: [] },
    "GET /v1/creators/c1/reviews/": [{ id: "r1", brand: brandRef, stars: 5, text: "Great work", createdAt: now }],
    "GET /v1/lists/": [{ id: "l1", name: "Favourites", creators: ["c1"] }],
    "POST /v1/realtime/ticket/": { ticket: "t", expiresIn: 30, path: "/ws/" },
  };
}


/** Serves fixtures for one browser context; every request lands in `log` as "METHOD /path body". */
export async function installMock(ctx, role, log = [], overrides = {}) {
  const fx = { ...fixtures(role), ...overrides };
  await ctx.addInitScript(r => {
    localStorage.setItem("ll-auth", JSON.stringify({ access: "a", refresh: "r", user: { id: "u", role: r } }));
  }, role);
  const unknown = new Set();
  await ctx.route(API + "/**", route => {
    const req = route.request();
    const u = new URL(req.url());
    const key = `${req.method()} ${u.pathname}`;
    if (req.method() !== "GET") log.push(`${key} ${req.postData() || ""}`.trim());
    if (key in fx) {
      const data = fx[key];
      return route.fulfill({ status: data === null ? 204 : 200, contentType: "application/json", body: data === null ? "" : JSON.stringify({ success: true, data, error: null, meta: Array.isArray(data) ? { nextCursor: null, hasMore: false } : null }) });
    }
    if (req.method() !== "GET") {
      /* writes succeed with an echo, so the screens can carry on */
      let body = {};
      try { body = JSON.parse(req.postData() || "{}"); } catch {}
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: { id: "new-" + Date.now(), ...body, createdAt: new Date().toISOString(), status: "pending" }, error: null, meta: null }) });
    }
    unknown.add(key);
    return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ success: false, data: null, error: { code: "NOT_FOUND", message: "Not found" } }) });
  });
  await ctx.route("wss://**", r => r.abort());
  return unknown;
}
