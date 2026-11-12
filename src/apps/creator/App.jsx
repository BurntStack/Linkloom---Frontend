import React, { useLayoutEffect, useRef, useEffect } from "react";
import { useHashRoute } from "./useHashRoute";
import { useStore } from "./useStore";
import { views, getGuard, getGuestRoutes } from "./core/router";
import { store } from "./core/store";
import { esc } from "./core/dom";
import { inr, fmtDate } from "./core/format";
import { icon } from "./core/icons";
import { liquid } from "./core/dom";
import { motion } from "./core/motion-api";
import { closeSheet } from "./core/overlays";

function ScreenMount({ name, param, renderKey, isFocus }) {
  const elRef = useRef(null);

  useLayoutEffect(() => {
    const el = elRef.current;
    if (!el) return;

    const view = views[name];
    if (!view) {
      el.innerHTML = '<div class="empty"><p class="t-h2">Page not found.</p></div>';
      return;
    }

    document.title =
      (view.title ? (typeof view.title === "function" ? view.title(param) : view.title) + " · " : "") +
      "Linkloom";

    el.innerHTML = "";
    let cleanup = null;
    try {
      cleanup = view.render(el, param) || null;
    } catch (e) {
      console.error(e);
      el.innerHTML =
        '<div class="empty"><p class="t-h2">This screen could not load.</p><p class="muted">Reload the page to try again.</p></div>';
    }

    liquid(el);
    if (!isFocus) window.scrollTo({ top: 0, behavior: "auto" });
    el.setAttribute("tabindex", "-1");
    el.focus({ preventScroll: true });
    motion.enter(el, { name });

    return () => {
      closeSheet(true);
      if (cleanup) {
        try { cleanup(); } catch (e) { console.error(e); }
      }
    };
  }, [name, param, renderKey]);

  if (isFocus) {
    return <div ref={elRef} className="view light" tabIndex={-1} />;
  }
  return <main id="view" className="view light" ref={elRef} tabIndex={-1} />;
}

export default function App() {
  const rawRoute = useHashRoute();

  const unread = useStore(s => s.threads.reduce((n, t) => n + t.unread, 0));
  const nbNotifs = useStore(s => s.notifications.filter(n => !n.read).length);
  const meName = useStore(s => s.me.name);
  const meHandle = useStore(s => [s.me.handle, s.me.city].filter(Boolean).join(" · "));
  const mePhoto = useStore(s => s.me.photo);
  const readyToWithdraw = useStore(s => s.readyToWithdraw || 0);
  const planName = useStore(s => s.plan?.name || "");
  const planStatus = useStore(s => s.plan?.status || "");
  const planRenews = useStore(s => s.plan?.renews || "");
  const hasPlan = useStore(s => !!s.plan);
  const heldInEscrow = useStore(s =>
    s.active.filter(a => a.pay === "escrow").reduce((n, a) => n + a.price, 0),
  );
  const signedIn = useStore(s => s.session.signedIn);
  const isGuest = useStore(s => s.session.guest);

  const { name: rawName, param, _k: renderKey } = rawRoute;
  let routeName = rawName;
  if (!views[routeName]) {
    routeName = signedIn || isGuest ? "home" : "login";
  }

  const guard = getGuard();
  const guardRedirect = guard ? guard(routeName) : null;
  const guestRoutes = getGuestRoutes();
  const v = views[routeName];
  const guestOk = !!isGuest && guestRoutes.has(routeName) && !param;
  let authRedirect = null;
  if (!guardRedirect && v?.auth !== false && !signedIn && !guestOk && routeName !== "login") {
    authRedirect = isGuest ? "#home" : "#login";
  }
  const redirect = guardRedirect || authRedirect;

  useEffect(() => {
    if (redirect) location.replace(redirect);
  }, [redirect]);

  if (redirect) return null;

  // Track every screen navigation in GTM
  useEffect(() => {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: "screen_view", screen_name: routeName, app: "creator" });
  }, [routeName]);

  const isFocus = v?.shell === "focus";
  const navName = v?.nav || routeName;
  const initials = mePhoto ? "" : (meName.trim()[0] || "?").toUpperCase();
  const avatarStyle = mePhoto ? { background: `center/cover url("${mePhoto}")` } : {};

  const crumbHtml = v?.crumb
    ? typeof v.crumb === "function"
      ? v.crumb(param)
      : v.crumb
    : "";

  const escrowHtml = icon("lock") + " " + esc(inr(heldInEscrow)) + " in escrow";
  const planLabel = planName + (planStatus === "active" && planRenews ? " · renews " + fmtDate(planRenews) : "");

  return (
    <>
      <a
        className="skip"
        href="#view"
        onClick={e => {
          e.preventDefault();
          document.getElementById("view")?.focus();
        }}
      >
        Skip to content
      </a>

      {/* Main shell — hidden when a focus-screen (login/kyc/setup) is active */}
      <div id="app" className="app" aria-hidden={isFocus || undefined} hidden={isFocus || undefined}>
        <aside className="side" aria-label="Main">
          <a className="sbox brand" href="#home" aria-label="Linkloom home">
            <img src="assets/logo-mark.svg" width="28" height="28" alt="" />
            <span>linkloom</span>
          </a>
          <div className="sbox nav-box">
            <nav className="nav" aria-label="Sections">
              {[
                ["home", "Home"],
                ["jobs", "Find jobs"],
                ["bids", "My bids"],
                ["active", "Active jobs"],
                ["earnings", "Earnings"],
              ].map(([n, label]) => (
                <a
                  key={n}
                  href={`#${n}`}
                  data-nav={n}
                  aria-current={navName === n ? "page" : undefined}
                >
                  {label}
                </a>
              ))}
              <a
                href="#messages"
                data-nav="messages"
                aria-current={navName === "messages" ? "page" : undefined}
              >
                Messages{" "}
                <span className="badge" data-badge="messages" hidden={!unread || undefined}>
                  {unread || undefined}
                </span>
              </a>
            </nav>
            <p className="nav-note">Instagram · YouTube · English</p>
          </div>
          <a className="sbox slipbox" href="#earnings">
            <span className="t-cap slip-l">Ready to withdraw</span>
            <span className="t-money t-money-m">{inr(readyToWithdraw)}</span>
            {heldInEscrow > 0 && (
              <span
                className="pill pill-escrow"
                data-side-escrow
                dangerouslySetInnerHTML={{ __html: escrowHtml }}
              />
            )}
            {hasPlan && <span className="slip-plan" data-side-plan>{planLabel}</span>}
          </a>
          <a
            className="sbox me"
            href="#profile"
            data-nav="profile"
            aria-current={navName === "profile" ? "page" : undefined}
          >
            <span className="avatar" data-me-initials style={avatarStyle}>
              {initials}
            </span>
            <span className="me-t">
              <b data-me-name>{meName}</b>
              <span data-me-handle>{meHandle}</span>
            </span>
          </a>
        </aside>

        <div className="main">
          <header className="top">
            <a className="hbox hlogo" href="#home" aria-label="Linkloom home">
              <img src="assets/logo-mark.svg" width="26" height="26" alt="" />
              <span>linkloom</span>
            </a>
            <p
              className="hbox crumb"
              id="crumb"
              hidden={!crumbHtml || undefined}
              dangerouslySetInnerHTML={{ __html: crumbHtml }}
            />
            <div className="grow" />
            <div className="hbox icons">
              <a
                className="ibtn bell"
                href="#messages"
                id="inbox"
                aria-label={unread ? `Messages, ${unread} unread` : "Messages"}
                dangerouslySetInnerHTML={{
                  __html:
                    icon("chat") +
                    (unread
                      ? `<span class="bell-n" data-badge="messages">${unread}</span>`
                      : `<span class="bell-n" data-badge="messages" hidden></span>`),
                }}
              />
              <button
                className="ibtn bell"
                type="button"
                id="bell"
                aria-label="Notifications"
                dangerouslySetInnerHTML={{
                  __html:
                    icon("bell") +
                    (nbNotifs
                      ? `<span class="bell-n" data-badge="bell">${nbNotifs}</span>`
                      : `<span class="bell-n" data-badge="bell" hidden></span>`),
                }}
              />
              <a
                className="avatar"
                href="#profile"
                aria-label="Your profile"
                data-me-initials
                style={avatarStyle}
              >
                {initials}
              </a>
            </div>
          </header>
          {!isFocus && (
            <ScreenMount name={routeName} param={param} renderKey={renderKey} />
          )}
        </div>

        <nav className="tabbar dark" aria-label="Sections">
          {[
            ["home", "Home", "home"],
            ["jobs", "Find jobs", "brief"],
            ["bids", "My bids", "send"],
            ["active", "Active jobs", "rail"],
            ["earnings", "Earnings", "coin"],
          ].map(([n, label, ic]) => (
            <a
              key={n}
              href={`#${n}`}
              data-nav={n}
              aria-current={navName === n ? "page" : undefined}
              dangerouslySetInnerHTML={{ __html: icon(ic) + label }}
            />
          ))}
        </nav>
      </div>

      {/* Focus-screen outlet (login, kyc, setup) */}
      <div id="focusRoot" hidden={!isFocus || undefined}>
        {isFocus && (
          <ScreenMount name={routeName} param={param} renderKey={renderKey} isFocus />
        )}
      </div>
    </>
  );
}
