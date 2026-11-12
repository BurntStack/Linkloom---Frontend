import { inject } from "@vercel/analytics";

/* Vercel Analytics — passive, no config needed. */
inject();

/* GTM dataLayer is already created by the GTM snippet in HTML.
   This ensures it exists even if the snippet hasn't run yet (e.g. blocked by an ad blocker). */
window.dataLayer = window.dataLayer || [];

/**
 * Push a custom event to GTM's dataLayer.
 * In GTM: add a Custom Event trigger for each event name, then connect it to GA4 / Meta Pixel / etc.
 *
 * Usage: track("sign_up", { method: "email", user_role: "creator" })
 */
export function track(event, params = {}) {
  window.dataLayer.push({ event, ...params });
}

/* Make track available globally so screen IIFEs and vanilla JS can call it
   without importing from this module. */
window.LLD_TRACK = track;

/* ── Virtual page views ──────────────────────────────────────────────────
   The app is a hash-routed SPA. Browsers don't fire a real navigation event
   when only the hash changes, so GTM's built-in page-view trigger misses them.
   We push a virtual_page_view event on every hash change so GTM/GA4 can track
   which screens users visit inside the dashboard.
   ─────────────────────────────────────────────────────────────────────── */
function pushPageView() {
  const hash = location.hash || "#home";
  const screen = hash.replace(/^#/, "").split("-")[0] || "home";
  window.dataLayer.push({
    event: "virtual_page_view",
    page_location: location.href,
    page_path: location.pathname + hash,
    page_title: document.title,
    screen_name: screen,
  });
}

window.addEventListener("hashchange", pushPageView);

/* Initial page view — delayed 50 ms so React has mounted and document.title is set. */
setTimeout(pushPageView, 50);
