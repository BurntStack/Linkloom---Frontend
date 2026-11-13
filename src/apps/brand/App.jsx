import React, { useRef, useLayoutEffect, useCallback, useEffect } from "react";
import { useHashRoute } from "./useHashRoute";
import { useStore } from "./useStore";

const views = window.LLD.views;

function ScreenMount({ name, param, renderKey, isFocus }) {
  const elRef = useRef(null);
  useLayoutEffect(() => {
    const el = elRef.current;
    const view = views[name];
    if (!view) return;
    el.innerHTML = "";
    let cleanup = view.render(el, param) || null;
    window.LLD.liquid(el);
    window.LLD.motion.enter(el, { name });
    return () => {
      window.LLD.closeSheet?.(true);
      if (cleanup) cleanup();
    };
  }, [name, param, renderKey]);

  if (isFocus) return <div ref={elRef} className="view light" tabIndex={-1} />;
  return <main id="view" className="view light" ref={elRef} tabIndex={-1} />;
}

function initials(brand) {
  return (brand || "")
    .split(/\s+/)
    .map(w => w[0] || "")
    .join("")
    .slice(0, 2)
    .toUpperCase() || "B";
}

export default function App() {
  const rawRoute = useHashRoute();
  const unread = useStore(s => s.threads.reduce((n, t) => n + t.unread, 0));
  const notifUnread = useStore(s => s.notifications.filter(n => !n.read).length);
  const cartLen = useStore(s => s.cart.length);
  const brand = useStore(s => s.me.brand);
  const logo = useStore(s => s.me.logo);
  const handle = useStore(s => s.me.city || "");
  const heldInEscrow = useStore(s =>
    s.payments.filter(p => p.status === "held").reduce((sum, p) => sum + (p.amount || 0), 0),
  );
  const liveCampaigns = useStore(s =>
    s.campaigns.filter(
      c => !["released", "refunded", "declined", "cancelled"].includes(c.stage),
    ).length,
  );
  const plan = useStore(s => s.plan?.name || "");

  const { name: rawName, param, _k: renderKey } = rawRoute;
  const guard = window.LLD.getGuard();
  const redirectTo = guard ? guard(rawName) : undefined;

  useEffect(() => {
    if (!redirectTo) return;
    if (redirectTo.startsWith("#")) window.LLD.go(redirectTo);
    else location.replace(redirectTo);
  }, [redirectTo]);

  if (redirectTo) return null;

  let name = rawName || "home";
  if (!views[name]) name = "home";

  const v = views[name];

  // Track every screen navigation in GTM
  useEffect(() => {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: "screen_view", screen_name: name, app: "brand" });
  }, [name]);

  const isFocus = v?.shell === "focus";

  const openNotifications = useCallback(() => {
    const notifs = window.LLD_DATA?.notifications || [];
    if (!notifs.length) {
      window.LLD.toast("No notifications yet", "bell");
      return;
    }
    window.LLD.openSheet({
      title: "Notifications",
      body: notifs
        .slice(0, 20)
        .map(n =>
          `<a class="notif-row ${n.read ? "" : "notif-new"}" href="${window.LLD.esc(n.go)}" data-go="${window.LLD.esc(n.go)}">
            <span class="notif-text">${window.LLD.esc(n.text)}</span>
            <span class="notif-at muted">${window.LLD.ago(n.at)}</span>
          </a>`,
        )
        .join(""),
      onMount(el) {
        window.LLD.store.set(s => {
          s.notifications.forEach(n => { n.read = true; });
        }, "notif-read-all");
      },
    });
  }, []);

  const escrowFmt = window.LLD.inr ? window.LLD.inr(heldInEscrow) : "₹0";

  return (
    <>
      <div id="app" className="app" hidden={isFocus || undefined}>
        <aside className="side" aria-label="Main">
          <a className="sbox brand" href="#home" aria-label="Linkloom home">
            <img src="assets/logo-mark.svg" width="28" height="28" alt="" />
            <span>linkloom</span>
          </a>
          <div className="sbox nav-box">
            <nav className="nav" aria-label="Sections">
              <a href="#home" data-nav="home" className={name === "home" ? "active" : undefined}>Home</a>
              <a href="#creators" data-nav="creators" className={name === "creators" ? "active" : undefined}>Find creators</a>
              <a href="#jobs" data-nav="jobs" className={name === "jobs" || name === "job" ? "active" : undefined}>Jobs</a>
              <a href="#campaigns" data-nav="campaigns" className={name === "campaigns" ? "active" : undefined}>Campaigns</a>
              <a href="#payments" data-nav="payments" className={name === "payments" ? "active" : undefined}>Payments</a>
              <a href="#reports" data-nav="reports" className={name === "reports" ? "active" : undefined}>Reports</a>
              <a href="#messages" data-nav="messages" className={name === "messages" ? "active" : undefined}>
                Messages{" "}
                {unread > 0 && <span className="badge">{unread}</span>}
              </a>
            </nav>
            <p className="nav-note">Instagram · YouTube · English</p>
          </div>
          <a className="sbox slipbox" href="#payments">
            <span className="t-cap slip-l">Held in escrow</span>
            <span className="t-money t-money-m">{escrowFmt}</span>
            {liveCampaigns > 0 && (
              <span className="pill pill-escrow">{liveCampaigns} live</span>
            )}
            {plan && <span className="slip-plan">{plan}</span>}
          </a>
          <a className="sbox me" href="#profile" data-nav="profile">
            {logo ? (
              <img className="avatar" src={logo} alt={brand} />
            ) : (
              <span className="avatar">{initials(brand)}</span>
            )}
            <span className="me-t">
              <b>{brand}</b>
              <span>{handle}</span>
              <span className="me-role">Brand</span>
            </span>
          </a>
        </aside>

        <div className="main">
          <header className="top">
            <a className="hbox hlogo" href="#home" aria-label="Linkloom home">
              <img src="assets/logo-mark.svg" width="26" height="26" alt="" />
              <span>linkloom</span>
            </a>
            <p className="hbox crumb" id="crumb" hidden></p>
            <div className="grow"></div>
            <div className="hbox icons">
              <a className="ibtn bell" href="#cart" id="cartBtn" aria-label="Hiring cart" data-ic="cart">
                {cartLen > 0 && <span className="bell-n">{cartLen}</span>}
              </a>
              <a className="ibtn bell" href="#messages" id="inbox" aria-label="Messages" data-ic="chat">
                {unread > 0 && <span className="bell-n">{unread}</span>}
              </a>
              <button className="ibtn bell" type="button" id="bell" aria-label="Notifications" data-ic="bell" onClick={openNotifications}>
                {notifUnread > 0 && <span className="bell-n">{notifUnread}</span>}
              </button>
              {logo ? (
                <a className="avatar avatar-img" href="#profile" aria-label="Brand profile">
                  <img src={logo} alt={brand} />
                </a>
              ) : (
                <a className="avatar" href="#profile" aria-label="Brand profile">{initials(brand)}</a>
              )}
            </div>
          </header>
          {!isFocus && <ScreenMount name={name} param={param} renderKey={renderKey} />}
        </div>

        <nav className="tabbar dark" aria-label="Sections">
          <a href="#home" data-nav="home" data-ic="home" className={name === "home" ? "active" : undefined}>Home</a>
          <a href="#creators" data-nav="creators" data-ic="users" className={name === "creators" ? "active" : undefined}>Creators</a>
          <a href="#jobs" data-nav="jobs" data-ic="brief" className={name === "jobs" || name === "job" ? "active" : undefined}>Jobs</a>
          <a href="#campaigns" data-nav="campaigns" data-ic="rail" className={name === "campaigns" ? "active" : undefined}>Campaigns</a>
          <a href="#payments" data-nav="payments" data-ic="coin" className={name === "payments" ? "active" : undefined}>Payments</a>
        </nav>
      </div>

      <div id="focusRoot" hidden={!isFocus || undefined}>
        {isFocus && <ScreenMount name={name} param={param} renderKey={renderKey} isFocus />}
      </div>
    </>
  );
}
