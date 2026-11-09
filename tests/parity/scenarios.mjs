/* Every route in every meaningful data state. `preset` is evaluated on both sides before routing,
   through the test hooks (window.LLD, window.LLD_DATA) that only exist in the parity build of src/. */
const set = body => `(()=>{const s=window.LLD_DATA;${body}})()`;
const VERIFIED = set(`s.kyc.status='verified';s.kyc.note='';`);
const SIGNED_OUT = set(`s.session.signedIn=false;`);
const FIRST_LOGIN = set(`s.session.firstLogin=true;`);
const kycState = st => set(`s.kyc.status='${st}';`);
const EMPTY = set(
  `s.jobs=[];s.saved=[];s.bids=[];s.active=[];s.threads=[];s.ledger=[];s.withdrawals=[];s.notifications=[];s.readyToWithdraw=0;`,
);
const NO_PLAN = set(`s.plan=null;`);

const ROUTES = [
  "home",
  "jobs",
  "job-j1",
  "job-j2",
  "job-j6",
  "job-nope",
  "bid-j1",
  "bid-j6",
  "bid-nope",
  "bids",
  "active",
  "work-a1",
  "work-a2",
  "work-a3",
  "work-nope",
  "messages",
  "chat-t1",
  "chat-t2",
  "chat-t3",
  "chat-nope",
  "earnings",
  "profile",
  "kyc",
  "setup",
  "does-not-exist",
];

export function pageScenarios() {
  const out = [];
  for (const viewport of ["desktop", "tablet", "phone"]) {
    for (const route of ROUTES) out.push({ name: `page/${route}`, route, viewport });
    out.push({ name: "page/login", route: "login", preset: SIGNED_OUT, viewport });
    out.push({ name: "page/login-expired", route: "login-expired", preset: SIGNED_OUT, viewport });
    out.push({ name: "page/signed-out-redirect", route: "home", preset: SIGNED_OUT, viewport });
    out.push({ name: "page/setup-first-login", route: "setup", preset: FIRST_LOGIN, viewport });
  }
  for (const viewport of ["desktop", "phone"]) {
    for (const st of [
      "not_started",
      "in_progress",
      "under_review",
      "verified",
      "action_needed",
      "rejected",
    ]) {
      out.push({ name: `state/kyc-${st}/kyc`, route: "kyc", preset: kycState(st), viewport });
      out.push({ name: `state/kyc-${st}/home`, route: "home", preset: kycState(st), viewport });
      out.push({ name: `state/kyc-${st}/bid`, route: "bid-j1", preset: kycState(st), viewport });
    }
    for (const route of ["bid-j1", "bid-j2", "bid-j3", "profile", "job-j1"])
      out.push({ name: `state/verified/${route}`, route, preset: VERIFIED, viewport });
    for (const route of ["home", "jobs", "bids", "active", "messages", "earnings"])
      out.push({ name: `state/empty/${route}`, route, preset: EMPTY, viewport });
    out.push({ name: "state/no-plan/earnings", route: "earnings", preset: NO_PLAN, viewport });
  }
  return [...out, ...brandScenarios()];
}

const BRAND_ROUTES = [
  "home",
  "creators",
  "saved",
  "creator-cr1",
  "creator-cr5",
  "creator-nope",
  "cart",
  "jobs",
  "post",
  "job-j1",
  "job-j2",
  "job-j3",
  "job-j4",
  "job-j5",
  "job-j6",
  "job-nope",
  "campaigns",
  "campaign-c1",
  "campaign-c2",
  "campaign-c3",
  "campaign-c4",
  "campaign-c5",
  "campaign-c6",
  "campaign-c7",
  "campaign-c8",
  "campaign-nope",
  "messages",
  "chat-t1",
  "chat-t2",
  "chat-t3",
  "chat-nope",
  "payments",
  "reports",
  "profile",
  "setup",
  "does-not-exist",
];
const BRAND_EMPTY = set(
  `s.favorites=[];s.cart=[];s.jobs=[];s.bids=[];s.campaigns=[];s.threads=[];s.payments=[];s.notifications=[];`,
);

function brandScenarios() {
  const page = "brand";
  const out = [];
  for (const viewport of ["desktop", "tablet", "phone"]) {
    for (const route of BRAND_ROUTES) out.push({ page, name: `brand/page/${route}`, route, viewport });
    for (const route of ["login", "signup", "forgot", "reset-nope"])
      out.push({ page, name: `brand/page/${route}`, route, preset: SIGNED_OUT, viewport });
    out.push({
      page,
      name: "brand/page/first-run-setup",
      route: "setup",
      preset: set(`s.session.firstRun=true;`),
      viewport,
    });
  }
  for (const viewport of ["desktop", "phone"]) {
    for (const route of [
      "home",
      "creators",
      "saved",
      "cart",
      "jobs",
      "campaigns",
      "messages",
      "payments",
      "reports",
    ])
      out.push({ page, name: `brand/empty/${route}`, route, preset: BRAND_EMPTY, viewport });
    out.push({ page, name: "brand/no-plan/payments", route: "payments", preset: NO_PLAN, viewport });
  }
  return out;
}
