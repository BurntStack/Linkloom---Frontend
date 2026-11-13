/* A brand's way into the dashboard. */
import { clearAuth, isSignedIn, setSessionLostHandler } from "../../shared/api/client";
import { signOut } from "../../shared/api/auth";
import { stopLive } from "../../shared/api/realtime";
import { addSiteLink } from "../signin/handoff";
import { brandApi, loadBrand } from "./live";
import { registerBrandKyc } from "./kyc";

const w = window;
const OPEN_DURING_SETUP = new Set(["setup", "kyc"]);

/* Writes to #preload while React has not mounted yet. */
const preload = () => document.getElementById("preload");

function loading(text = "Loading your dashboard…") {
  const v = preload();
  if (!v) return;
  v.innerHTML = `<div class="empty" role="status" aria-live="polite"><p class="t-h2">${text}</p><p class="muted" data-slow hidden>The server is waking up. This can take up to a minute the first time.</p></div>`;
  setTimeout(() => {
    const s = v.querySelector("[data-slow]");
    if (s) s.hidden = false;
  }, 4000);
}

function failed(retry) {
  const v = preload();
  if (!v) return;
  v.innerHTML = `<div class="empty" role="alert"><p class="t-h2">We couldn't load your dashboard</p><p class="muted">Check your connection and try again.</p><button class="lq lq-p" type="button" data-retry>Try again</button></div>`;
  v.querySelector("[data-retry]")?.addEventListener("click", retry, { once: true });
}

function hideDemoBits() {
  const st = document.createElement("style");
  st.textContent =
    ".sample,.bk-sample,.work-demo{display:none!important}" +
    "html.is-guest [data-me-handle]{opacity:.7}";
  document.head.appendChild(st);
}

function promptSignIn(why = "Sign in to continue") {
  w.LLD.openSheet({
    title: why,
    body: `<div class="stack">
      <p class="muted">Create a free brand account or sign in to post briefs, save creators, message them and hire with escrow.</p>
      <div class="row wrap">
        <a class="lq lq-p" href="signin.html?role=brand">Sign in</a>
        <a class="lq lq-s" href="signin.html?role=brand&join=1">Create a brand account</a>
      </div>
    </div>`,
    onMount() {},
  });
}

function guardClicks() {
  document.addEventListener(
    "click",
    e => {
      const s = w.LLD_DATA.session;
      if (!s.guest || s.signedIn) return;
      const t = e.target;
      if (t.closest(".sheet, [role=dialog], .nav-site, [data-guest-ok]")) return;
      const nav = t.closest("a[href^='#']");
      if (nav) {
        const h = (nav.getAttribute("href") || "").replace(/^#/, "");
        if (GUEST_ROUTES.has(h)) return;
      }
      if (t.closest("#view .creators-filters, #view .creators-search, #view [data-filter], #view select, #view input[type=search]")) return;
      const hit = t.closest("a, button, input, select, textarea, label, summary, [data-go], [role=button]");
      if (!hit) return;
      e.preventDefault();
      e.stopPropagation();
      promptSignIn();
    },
    true,
  );
}

async function enterSignedIn() {
  loading();
  try {
    const user = await loadBrand();
    if (user.role === "creator") {
      location.replace("app.html#home");
      return false;
    }
    document.documentElement.classList.remove("is-guest");
    w.LLD.store.set(s => {
      s.session.signedIn = true;
      s.session.firstRun = !!user.needsOnboarding || !user.role;
    }, "signed-in");
    return true;
  } catch (e) {
    if (e.status === 401) {
      clearAuth();
      return enterGuest(true);
    }
    return new Promise(resolve => failed(() => resolve(enterSignedIn())));
  }
}

async function enterGuest(fromExpiry = false) {
  location.replace(`signin.html?role=brand${fromExpiry ? "&expired=1" : ""}`);
  return false;
}

export function initBrandSession() {
  if (import.meta.env.VITE_TEST_HOOKS) return true;
  hideDemoBits();
  registerBrandKyc();

  w.LLD.live = Object.assign(Object.create(null), brandApi, {
    promptSignIn,
    get guest() {
      return !!w.LLD_DATA.session.guest;
    },
  });

  setSessionLostHandler(() => {
    stopLive();
    location.href = "signin.html?role=brand&expired=1";
  });

  addSiteLink();

  w.LLD.setRouteGuard(name => {
    const s = w.LLD_DATA.session;
    if (!s.signedIn) return "signin.html?role=brand";
    return s.firstRun && !OPEN_DURING_SETUP.has(name) ? "#setup" : null;
  });

  let favs = new Set(),
    reads = new Set();
  const snap = () => {
    favs = new Set(w.LLD_DATA.favorites);
    reads = new Set(w.LLD_DATA.notifications.filter(n => n.read).map(n => n.id));
  };
  w.LLD.store.on(why => {
    const s = w.LLD_DATA;
    if (why === "live-loaded" || why === "live-refresh") return snap();
    if (!s.session.signedIn) return;
    if (why === "favorite") {
      const now = new Set(s.favorites);
      const changes = [
        ...[...now].filter(id => !favs.has(id)).map(id => [id, true]),
        ...[...favs].filter(id => !now.has(id)).map(id => [id, false]),
      ];
      favs = now;
      for (const [id, on] of changes)
        brandApi.setFavorite(id, on).catch(e => w.LLD.toast(brandApi.errorText(e), "alert"));
    } else if (why === "cart-add" || why === "cart-remove" || why === "invite") brandApi.saveCart(s.cart);
    else if (why === "budget-changed") brandApi.saveBudget(s.budget);
    else if (why === "job-draft" || why === "job-published" || why === "job-deleted") brandApi.saveDrafts(s.jobs);
    else if (why === "notif-read" || why === "notif-read-all") {
      const now = s.notifications.filter(n => n.read).map(n => n.id);
      const fresh = now.filter(id => !reads.has(id));
      reads = new Set(now);
      if (why === "notif-read-all" || fresh.length > 1) void brandApi.readAllNotifications().catch(() => undefined);
      else fresh.forEach(id => void brandApi.readNotification(id).catch(() => undefined));
    }
  });

  w.LLD.store.on(why => {
    if (why === "chat-live" && location.hash === "#messages") w.LLD.route();
  });

  const fetched = new Set();
  const creatorDetail = () => {
    const m = /^#creator-(.+)$/.exec(location.hash);
    if (!m || fetched.has(m[1]) || !w.LLD_DATA.session.signedIn) return;
    fetched.add(m[1]);
    brandApi.creatorDetail(m[1]).then(
      () => location.hash === "#creator-" + m[1] && w.LLD.route(),
      () => undefined,
    );
  };
  addEventListener("hashchange", creatorDetail);
  setTimeout(creatorDetail, 0);

  let was = isSignedIn();
  w.LLD.store.on(why => {
    const now = w.LLD_DATA.session.signedIn;
    if (was && !now && why === "signed-out") {
      stopLive();
      void signOut().finally(() => (location.href = "signin.html?role=brand&out=1"));
    }
    was = now;
  });
  if (w.LLD.auth) {
    w.LLD.auth.signOut = () => {
      stopLive();
      void signOut().finally(() => (location.href = "signin.html?role=brand&out=1"));
    };
  }

  return isSignedIn() ? enterSignedIn() : enterGuest();
}
