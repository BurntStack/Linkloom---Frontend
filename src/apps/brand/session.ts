/* A brand's way into the dashboard.
   - Signed in (tokens stored): load everything from the API. A creator account is sent to the creator dashboard;
     an account that hasn't finished its brand profile goes to #setup.
   - Signed out: a read-only guest view of the creator directory. Any other click asks them to sign in.
   - The old email-and-password screens (#login, #signup, #forgot, #reset) hand over to the shared sign-in page,
     because sign-in is by one-time code or Google.

   The parity build runs on the prototype's sample data and skips all of this. */
import { clearAuth, isSignedIn, setSessionLostHandler, type ApiUser } from "../../shared/api/client";
import { signOut } from "../../shared/api/auth";
import { stopLive } from "../../shared/api/realtime";
import { addSiteLink } from "../signin/handoff";
import { brandApi, loadBrand, loadBrandGuest } from "./live";
import { registerBrandKyc } from "./kyc";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the brand runtime is still untyped
const w = window as any;
const OPEN_DURING_SETUP = new Set(["setup", "kyc"]);
const PASSWORD_SCREENS = new Set(["login", "signup", "forgot", "reset"]);
const GUEST_ROUTES = new Set(["home", "creators"]);

const view = (): HTMLElement | null => document.getElementById("view");

function loading(text = "Loading your dashboard…"): void {
  const v = view();
  if (!v) return;
  v.innerHTML = `<div class="empty" role="status" aria-live="polite"><p class="t-h2">${text}</p><p class="muted" data-slow hidden>The server is waking up. This can take up to a minute the first time.</p></div>`;
  setTimeout(() => {
    const s = v.querySelector<HTMLElement>("[data-slow]");
    if (s) s.hidden = false;
  }, 4000);
}

function failed(retry: () => void): void {
  const v = view();
  if (!v) return;
  v.innerHTML = `<div class="empty" role="alert"><p class="t-h2">We couldn't load your dashboard</p><p class="muted">Check your connection and try again.</p><button class="lq lq-p" type="button" data-retry>Try again</button></div>`;
  v.querySelector("[data-retry]")?.addEventListener("click", retry, { once: true });
}

function hideDemoBits(): void {
  const st = document.createElement("style");
  st.textContent =
    ".sample,.bk-sample,.work-demo{display:none!important}" +
    "html.is-guest [data-me-handle]{opacity:.7}";
  document.head.appendChild(st);
}

function promptSignIn(why = "Sign in to continue"): void {
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

function guardClicks(): void {
  document.addEventListener(
    "click",
    e => {
      const s = w.LLD_DATA.session;
      if (!s.guest || s.signedIn) return;
      const t = e.target as Element;
      if (t.closest(".sheet, [role=dialog], .nav-site, [data-guest-ok]")) return;
      const nav = t.closest<HTMLAnchorElement>("a[href^='#']");
      if (nav) {
        const h = (nav.getAttribute("href") || "").replace(/^#/, "");
        if (GUEST_ROUTES.has(h)) return;
      }
      /* searching and filtering the directory is looking, not doing */
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

async function enterSignedIn(): Promise<boolean> {
  loading();
  try {
    const user = await loadBrand();
    if (user.role === "creator") {
      location.replace("app.html#home");
      return false;
    }
    document.documentElement.classList.remove("is-guest");
    w.LLD.store.set((s: { session: { firstRun: boolean } }) => {
      s.session.firstRun = !!user.needsOnboarding || !user.role;
    }, "signed-in");
    return true;
  } catch (e) {
    if ((e as { status?: number }).status === 401) {
      clearAuth();
      return enterGuest();
    }
    return new Promise(resolve => failed(() => resolve(enterSignedIn())));
  }
}

async function enterGuest(): Promise<boolean> {
  loading("Loading Linkloom…");
  await loadBrandGuest();
  document.documentElement.classList.add("is-guest");
  w.LLD.store.set((s: { session: Record<string, unknown>; me: Record<string, unknown> }) => {
    s.session.signedIn = false;
    s.session.guest = true;
    s.me.brand = "Guest";
    s.me.name = "Not signed in";
  }, "guest");
  if (!location.hash || location.hash === "#home" || location.hash === "#login") location.replace("#creators");
  return true;
}

/** Returns false (or resolves to false) when the page is leaving, so the dashboard should not boot. */
export function initBrandSession(): boolean | Promise<boolean> {
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

  w.LLD.setGuestRoutes(GUEST_ROUTES);
  guardClicks();
  addSiteLink();

  w.LLD.setRouteGuard((name: string) => {
    const s = w.LLD_DATA.session;
    if (PASSWORD_SCREENS.has(name)) {
      if (s.signedIn) return "#home";
      location.replace("signin.html?role=brand");
      return null;
    }
    return s.signedIn && s.firstRun && !OPEN_DURING_SETUP.has(name) ? "#setup" : null;
  });

  /* Changes the screens make to the store that map one-to-one onto the server: favourites, the cart (kept per account
     on this device), read notifications and the budget. Each is diffed against what was there before. */
  let favs = new Set<string>(),
    reads = new Set<string>();
  const snap = () => {
    favs = new Set(w.LLD_DATA.favorites);
    reads = new Set(w.LLD_DATA.notifications.filter((n: { read: boolean }) => n.read).map((n: { id: string }) => n.id));
  };
  w.LLD.store.on((why: string) => {
    const s = w.LLD_DATA;
    if (why === "live-loaded" || why === "live-refresh") return snap();
    if (!s.session.signedIn) return;
    if (why === "favorite") {
      const now = new Set<string>(s.favorites);
      const changes: [string, boolean][] = [
        ...[...now].filter(id => !favs.has(id)).map((id): [string, boolean] => [id, true]),
        ...[...favs].filter(id => !now.has(id)).map((id): [string, boolean] => [id, false]),
      ];
      favs = now;
      for (const [id, on] of changes)
        brandApi.setFavorite(id, on).catch(e => w.LLD.toast(brandApi.errorText(e), "alert"));
    } else if (why === "cart-add" || why === "cart-remove" || why === "invite") brandApi.saveCart(s.cart);
    else if (why === "budget-changed") brandApi.saveBudget(s.budget);
    else if (why === "job-draft" || why === "job-published" || why === "job-deleted") brandApi.saveDrafts(s.jobs);
    else if (why === "notif-read" || why === "notif-read-all") {
      const now = s.notifications.filter((n: { read: boolean }) => n.read).map((n: { id: string }) => n.id);
      const fresh = now.filter((id: string) => !reads.has(id));
      reads = new Set(now);
      if (why === "notif-read-all" || fresh.length > 1) void brandApi.readAllNotifications().catch(() => undefined);
      else fresh.forEach((id: string) => void brandApi.readNotification(id).catch(() => undefined));
    }
  });

  w.LLD.store.on((why: string) => {
    if (why === "chat-live" && location.hash === "#messages") w.LLD.route();
  });

  /* a creator's full profile (packages, gallery, reviews) loads when it is opened */
  const fetched = new Set<string>();
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

  /* signing out (profile) ends the server session, then hands over to the shared page */
  let was = isSignedIn();
  w.LLD.store.on((why: string) => {
    const now = w.LLD_DATA.session.signedIn;
    if (was && !now && why === "signed-out") {
      stopLive();
      void signOut().finally(() => (location.href = "signin.html?role=brand&out=1"));
    }
    was = now;
  });
  /* the profile's sign-out goes through LLD.auth when the auth screens loaded it */
  if (w.LLD.auth) {
    w.LLD.auth.signOut = () => {
      stopLive();
      void signOut().finally(() => (location.href = "signin.html?role=brand&out=1"));
    };
  }

  return isSignedIn() ? enterSignedIn() : enterGuest();
}

export type { ApiUser };
