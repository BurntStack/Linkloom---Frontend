/* The creator's way into the dashboard.
   - Signed in (tokens stored): load everything from the API, then open the dashboard. A brand account is sent to the
     brand dashboard; an account that hasn't finished sign-up goes to #setup.
   - Signed out: a read-only guest view of Home and Find Jobs with the public briefs. Any other click asks them to sign in.
   - Session lost (refresh token expired or revoked): back to #login with the "session expired" note.

   The parity build runs on the prototype's sample data and skips all of this. */
import { clearAuth, isSignedIn, setSessionLostHandler, type ApiUser } from "./api/client";
import { signOut } from "./api/auth";
import { stopLive } from "./api/realtime";
import { LLD, setRouteGuard, store } from "./core";
import { setGuestRoutes } from "./core/router";
import { creatorApi, loadCreator, loadGuest } from "./live/creator";
import { wireCreatorOffers } from "./live/creator-offers";
import { addSiteLink } from "./signin/handoff";

const OPEN_DURING_SETUP = new Set(["setup", "login"]);
const GUEST_ROUTES = new Set(["home", "jobs", "login"]);

type Live = typeof creatorApi & {
  guest: boolean;
  afterSignIn(user: ApiUser, method?: string): void;
  promptSignIn(why?: string): void;
  reload(): Promise<void>;
};

const view = (): HTMLElement | null => document.getElementById("view");

function loading(on: boolean, text = "Loading your dashboard…"): void {
  const v = view();
  if (!v) return;
  if (on) {
    v.innerHTML = `<div class="empty live-loading" role="status" aria-live="polite"><p class="t-h2">${text}</p><p class="muted" data-slow hidden>The server is waking up. This can take up to a minute the first time.</p></div>`;
    setTimeout(() => {
      const s = v.querySelector<HTMLElement>("[data-slow]");
      if (s) s.hidden = false;
    }, 4000);
  }
}

function failed(retry: () => void): void {
  const v = view();
  if (!v) return;
  v.innerHTML = `<div class="empty" role="alert"><p class="t-h2">We couldn't load your dashboard</p><p class="muted">Check your connection and try again.</p><button class="lq lq-p" type="button" data-retry>Try again</button></div>`;
  v.querySelector("[data-retry]")?.addEventListener("click", retry, { once: true });
}

/* ---------- guest mode: look, don't touch ---------- */

function promptSignIn(why = "Sign in to continue"): void {
  LLD.openSheet({
    title: why,
    body: `<div class="stack">
      <p class="muted">Create a free creator account or sign in to bid on briefs, message brands and get paid from escrow.</p>
      <div class="row wrap">
        <a class="lq lq-p" href="signin.html?role=creator">Sign in</a>
        <a class="lq lq-s" href="#login" data-close-sheet>Create a creator account</a>
      </div>
    </div>`,
    onMount(b: HTMLElement, close: () => void) {
      b.querySelector("[data-close-sheet]")?.addEventListener("click", () => close());
    },
  });
}

function guardClicks(): void {
  document.addEventListener(
    "click",
    e => {
      if (!store.s.session.guest || store.s.session.signedIn) return;
      const t = e.target as Element;
      if (t.closest(".sheet, [role=dialog], .nav-site, [data-guest-ok]")) return;
      const nav = t.closest<HTMLAnchorElement>("a[data-nav], a[href^='#']");
      if (nav) {
        const name = (nav.getAttribute("href") || "").replace(/^#/, "").split("-")[0];
        if (GUEST_ROUTES.has(name) && !(nav.getAttribute("href") || "").includes("-")) return;
      }
      /* searching, filtering and sorting the briefs is looking, not doing */
      if (t.closest("#view .jobs-filters, #view .jobs-search, #view .jobs-sort, #view .jobs-bar, .ui-select, [role=listbox]")) return;
      const hit = t.closest("a, button, input, select, textarea, label, summary, [data-go], [role=button], [tabindex]");
      if (!hit || hit.id === "view") return;
      e.preventDefault();
      e.stopPropagation();
      promptSignIn();
    },
    true,
  );
}

/* ---------- signed in ---------- */

async function enterSignedIn(): Promise<boolean> {
  loading(true);
  try {
    const user = await loadCreator(store);
    if (user.role === "brand") {
      location.replace("brand.html#home");
      return false;
    }
    document.documentElement.classList.remove("is-guest");
    store.set(s => {
      s.session.guest = false;
      s.session.expired = false;
      s.session.firstLogin = !!user.needsOnboarding || !user.role;
    }, "signed-in");
    return true;
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (status === 401) {
      clearAuth();
      return enterGuest();
    }
    return new Promise(resolve => failed(() => resolve(enterSignedIn())));
  }
}

async function enterGuest(): Promise<boolean> {
  loading(true, "Loading Linkloom…");
  await loadGuest(store);
  document.documentElement.classList.add("is-guest");
  store.set(s => {
    s.session.signedIn = false;
    s.session.guest = true;
    s.me.name = "Guest";
    s.me.handle = "Not signed in";
  }, "guest");
  return true;
}

/** The prototype marks demo-only bits ("Sample" tags, the brand-side demo buttons, KYC demo outcomes). The real app hides them. */
function hideDemoBits(): void {
  const st = document.createElement("style");
  /* a guest has no profile to match against, so match scores are hidden until they sign in */
  st.textContent =
    ".sample,.kyc-sample,.work-demo,.login-sample{display:none!important}" +
    "html.is-guest .jobs-pct,html.is-guest .jobs-match,html.is-guest #jobFitH{display:none!important}";
  document.head.appendChild(st);
}

/** Returns false (or resolves to false) when the page is leaving, so the dashboard should not boot. */
export function initSession(): boolean | Promise<boolean> {
  if (import.meta.env.VITE_TEST_HOOKS) return true;
  hideDemoBits();

  const live = LLD as unknown as { live: Live };
  live.live = Object.assign(Object.create(null), creatorApi, {
    guest: !isSignedIn(),
    promptSignIn,
    async reload() {
      await loadCreator(store);
    },
    afterSignIn(user: ApiUser) {
      if (user.role === "brand") {
        location.href = "brand.html#home";
        return;
      }
      loading(true);
      void loadCreator(store)
        .then(u => {
          const isNew = !!u.needsOnboarding || !u.role;
          store.set(s => {
            s.session.signedIn = true;
            s.session.guest = false;
            s.session.expired = false;
            s.session.firstLogin = isNew;
          }, "signed-in");
          LLD.toast(isNew ? "Signed in. Let's set up your profile." : "Signed in", "check");
          LLD.go(isNew ? "#setup" : "#home");
        })
        .catch(() => failed(() => location.reload()));
    },
  }) as Live;

  setSessionLostHandler(() => {
    stopLive();
    store.set(s => {
      s.session.signedIn = false;
      s.session.expired = true;
    }, "session-expired");
    LLD.go("#login-expired");
  });

  setGuestRoutes(GUEST_ROUTES);
  wireCreatorOffers();
  guardClicks();
  addSiteLink();

  setRouteGuard(name => {
    const { signedIn, firstLogin } = store.s.session;
    return signedIn && firstLogin && !OPEN_DURING_SETUP.has(name) ? "#setup" : null;
  });

  store.on(why => {
    if (why === "chat-live" && location.hash === "#messages") LLD.route();
  });

  /* Signing out anywhere (profile, setup) ends the server session too, then hands over to the shared page. */
  let was = isSignedIn();
  store.on(why => {
    const now = store.s.session.signedIn;
    if (was && !now && why === "signed-out") {
      stopLive();
      void signOut().finally(() => (location.href = "signin.html?role=creator&out=1"));
    }
    was = now;
  });

  return isSignedIn() ? enterSignedIn() : enterGuest();
}
