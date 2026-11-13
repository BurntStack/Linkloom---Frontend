// @ts-nocheck
/* Linkloom Brand Dashboard: core runtime (router, store, helpers, overlays, icons).
   Screens live in screens/<name>.js and call LLD.register(). Money is always integer paise. */
(() => {
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (s, c = document) => c.querySelector(s),
    $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const esc = v =>
    String(v ?? "").replace(
      /[&<>"']/g,
      ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch],
    );

  /* ---------- money and dates ---------- */
  const inr = (paise, o = {}) => {
    // 1250000 -> "₹12,500"; o.dec -> "₹12,500.00"; o.sign -> "−₹..."
    const neg = paise < 0,
      p = Math.abs(Math.round(paise || 0));
    const r = Math.floor(p / 100),
      d = String(p % 100).padStart(2, "0");
    const s = "₹" + r.toLocaleString("en-IN") + (o.dec ? "." + d : "");
    return neg || o.sign ? "−" + s : s;
  };
  const rupees = n => Math.round(n * 100); // rupees -> paise (inputs only)
  const compact = n =>
    n >= 1e5
      ? (n / 1e5).toFixed(n % 1e5 ? 1 : 0).replace(/\.0$/, "") + "L"
      : n >= 1e3
        ? Math.round(n / 1e3) + "K"
        : String(n);
  /* Linkloom runs on subscriptions: no per-deal platform fee. The brand pays the agreed price into escrow and the creator receives it on approval; taxes are 'as per confirmed rules'. */
  const FEE_EXAMPLE = 0;
  const payout = paise => ({ price: paise, fee: 0, net: paise });
  const D = s => new Date(s + (s.length === 10 ? "T12:00:00+05:30" : ""));
  const fmtDate = (s, o = {}) =>
    D(s).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      ...(o.year ? { year: "numeric" } : {}),
      timeZone: "Asia/Kolkata",
    });
  const istDay = d => Math.floor((d.getTime() + 19800000) / 864e5); // calendar day in IST
  const daysLeft = s => istDay(D(s)) - istDay(LLD.today());
  const ago = s => {
    const m = Math.round((LLD.today() - D(s)) / 6e4);
    if (m < 60) return m + " min ago";
    const h = Math.round(m / 60);
    if (h < 24) return h + " h ago";
    const d = Math.round(h / 24);
    return d === 1 ? "yesterday" : d + " days ago";
  };
  const ageFrom = dob => {
    const t = LLD.today(),
      b = D(dob);
    let a = t.getFullYear() - b.getFullYear();
    const m = t.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && t.getDate() < b.getDate())) a--;
    return a;
  };

  /* ---------- store: one in-memory state object, change events ---------- */
  const subs = new Set();
  const store = {
    get s() {
      return window.LLD_DATA;
    },
    set(fn, why) {
      fn(window.LLD_DATA);
      subs.forEach(f => {
        try {
          f(why);
        } catch (e) {
          console.error(e);
        }
      });
    },
    on(f) {
      subs.add(f);
      return () => subs.delete(f);
    },
  };

  /* ---------- router: #name or #name-param ---------- */
  const views = {};
  let current = null,
    cleanup = null;
  const register = (name, def) => {
    views[name] = def;
    if (booted) route();
  };
  const parse = () => {
    const h = location.hash.replace(/^#/, "");
    const i = h.indexOf("-");
    return i < 0 ? { name: h, param: null } : { name: h.slice(0, i), param: h.slice(i + 1) };
  };
  const go = hash => {
    if (location.hash === hash) route();
    else location.hash = hash;
  };
  let booted = false,
    routed = false,
    guard = null;
  const setRouteGuard = g => {
    guard = g;
  };
  /* screens a signed-out visitor may look at, read-only (empty in the parity build) */
  let guestRoutes = new Set();
  const setGuestRoutes = r => {
    guestRoutes = r;
  };
  function route() {
    let { name, param } = parse();
    if (!views[name]) {
      name = LLD_DATA.session.signedIn || LLD_DATA.session.guest ? "home" : "login";
      param = null;
    }
    const v = views[name] || {
      title: "Linkloom",
      render: el => {
        el.innerHTML = '<div class="empty"><p class="t-h2">This screen is being built.</p></div>';
      },
    };
    const guestOk = !!LLD_DATA.session.guest && guestRoutes.has(name) && !param;
    if (v.auth !== false && !LLD_DATA.session.signedIn && !guestOk && name !== "login") {
      if (LLD_DATA.session.guest) {
        location.replace("#creators");
        setTimeout(() => LLD.live && LLD.live.promptSignIn && LLD.live.promptSignIn(), 0);
        return;
      }
      location.replace("#login");
      return;
    }
    const redirect = guard && guard(name);
    if (redirect) {
      location.replace(redirect);
      return;
    }
    if (cleanup) {
      try {
        cleanup();
      } catch (e) {}
      cleanup = null;
    }
    closeSheet(true);
    const focus = v.shell === "focus";
    $("#app").hidden = focus;
    $("#focusRoot").hidden = !focus;
    const old = focus ? $("#focusRoot") : $("#view");
    const el = old.cloneNode(false);
    old.replaceWith(el); // fresh outlet each route, so listeners never pile up
    current = { name, param };
    document.title =
      (v.title ? (typeof v.title === "function" ? v.title(param) : v.title) + " · " : "") + "Linkloom";
    $$("[data-nav]").forEach(a => {
      if (a.dataset.nav === (v.nav || name)) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    const crumb = $("#crumb");
    if (crumb) {
      const c = v.crumb ? (typeof v.crumb === "function" ? v.crumb(param) : v.crumb) : "";
      crumb.innerHTML = c;
      crumb.hidden = !c;
    }
    try {
      cleanup = v.render(el, param) || null;
    } catch (e) {
      console.error(e);
      el.innerHTML = `<div class="empty"><p class="t-h2">This screen could not load.</p><p class="muted">Reload the page to try again.</p></div>`;
    }
    liquid(el);
    if (!focus) window.scrollTo({ top: 0, behavior: "auto" });
    if (routed) {
      const f = focus ? $("#focusRoot") : $("#view");
      f.setAttribute("tabindex", "-1");
      f.focus({ preventScroll: true });
    }
    routed = true;
    LLD.motion.enter(el, { name });
    renderChrome();
  }
  addEventListener("hashchange", route);

  /* ---------- chrome: badges, avatar, KYC banner ---------- */
  function renderChrome() {
    const s = LLD_DATA;
    const unread = s.threads.reduce((n, t) => n + t.unread, 0);
    $$('[data-badge="messages"]').forEach(b => {
      b.textContent = unread;
      b.hidden = !unread;
    });
    const nb = s.notifications.filter(n => !n.read).length;
    $$('[data-badge="bell"]').forEach(b => {
      b.textContent = nb;
      b.hidden = !nb;
    });
    $$('[data-badge="cart"]').forEach(b => {
      b.textContent = s.cart.length;
      b.hidden = !s.cart.length;
    });
    $$("[data-me-initials]").forEach(e => {
      const lg = s.me.logo;
      e.textContent = lg ? "" : (s.me.brand.trim()[0] || "?").toUpperCase();
      e.style.background = lg ? `center/cover url("${lg}")` : "";
    });
    $$("[data-me-name]").forEach(e => (e.textContent = s.me.brand));
    $$("[data-me-handle]").forEach(e => (e.textContent = [s.me.name, s.me.city].filter(Boolean).join(" · ")));
    const ib = $("#inbox");
    if (ib) ib.setAttribute("aria-label", unread ? `Messages, ${unread} unread` : "Messages");
    const held = heldInEscrow();
    const live = s.campaigns.filter(c =>
      ["funded", "in_progress", "submitted", "revision", "approved"].includes(c.stage),
    ).length;
    $$("[data-side-held]").forEach(e => (e.textContent = inr(held)));
    $$("[data-side-live]").forEach(e => {
      e.innerHTML = icon("lock") + " " + live + (live === 1 ? " campaign running" : " campaigns running");
      e.hidden = !live;
    }); /* escrow pills always carry the lock */
    /* subscription plan, shown quietly; never a price */
    const p = s.plan;
    $$("[data-side-plan]").forEach(e => {
      e.textContent = p
        ? p.name + (p.status === "active" && p.renews ? " · renews " + fmtDate(p.renews) : "")
        : "";
      e.hidden = !p;
    });
  }
  /* money the brand has paid in that is still held: escrow rows not yet released or refunded */
  const heldInEscrow = () =>
    LLD_DATA.payments
      .filter(x => x.kind === "escrow" && x.status === "held")
      .reduce((n, x) => n + x.amount, 0);
  const creator = id => LLD_DATA.creators.find(c => c.id === id);
  store.on(renderChrome);
  /* one letter, like the creator app: two-letter "AI" (Ananya Iyer) reads as an AI button */
  const initials = n => (String(n || "").trim()[0] || "?").toUpperCase();

  /* ---------- overlays ---------- */
  let sheetEl = null,
    scrimEl = null,
    lastFocus = null;
  function openSheet({ title, body, onMount, wide }) {
    closeSheet(true);
    lastFocus = document.activeElement;
    scrimEl = document.createElement("div");
    scrimEl.className = "scrim";
    scrimEl.addEventListener("click", () => closeSheet());
    sheetEl = document.createElement("aside");
    sheetEl.className = "sheet light";
    sheetEl.setAttribute("role", "dialog");
    sheetEl.setAttribute("aria-modal", "true");
    sheetEl.setAttribute("aria-label", title);
    if (wide) sheetEl.style.width = "min(720px,100%)";
    $("#app").inert = true;
    $("#focusRoot").inert = true;
    sheetEl.innerHTML = `<div class="sheet-h"><p class="t-h2">${esc(title)}</p><button class="ibtn" type="button" data-close aria-label="Close">${icon("close")}</button></div><div class="sheet-b"></div>`;
    const b = $(".sheet-b", sheetEl);
    if (typeof body === "string") b.innerHTML = body;
    else if (body) b.append(body);
    document.body.append(scrimEl, sheetEl);
    $("[data-close]", sheetEl).addEventListener("click", () => closeSheet());
    sheetEl.addEventListener("keydown", e => {
      if (e.key === "Escape") closeSheet();
    });
    requestAnimationFrame(() => {
      scrimEl.classList.add("on");
      sheetEl.classList.add("on");
      const f = $("input,button:not([data-close]),select,textarea,a", b) || $("[data-close]", sheetEl);
      f && f.focus({ preventScroll: true });
    });
    liquid(sheetEl);
    onMount && onMount(b, closeSheet);
    return { el: b, close: closeSheet };
  }
  function closeSheet(instant) {
    if (!sheetEl) return;
    const s = sheetEl,
      c = scrimEl;
    sheetEl = scrimEl = null;
    $("#app").inert = false;
    $("#focusRoot").inert = false;
    if (instant || RM) {
      s.remove();
      c.remove();
    } else {
      s.classList.remove("on");
      c.classList.remove("on");
      setTimeout(() => {
        s.remove();
        c.remove();
      }, 500);
    }
    lastFocus && lastFocus.focus && lastFocus.focus({ preventScroll: true });
  }
  let toastT = 0;
  function toast(msg, ic = "check") {
    let t = $(".toast");
    if (!t) {
      t = document.createElement("div");
      t.className = "toast";
      t.setAttribute("role", "status");
      document.body.append(t);
    }
    t.innerHTML = `${icon(ic)}<span>${esc(msg)}</span>`;
    t.querySelector("svg").style.cssText = "width:18px;height:18px";
    requestAnimationFrame(() => t.classList.add("on"));
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove("on"), 3200);
  }

  /* liquid buttons: <a class="lq lq-p">Label</a> -> label roll markup */
  function liquid(root = document) {
    $$(".lq", root).forEach(b => {
      if (b.querySelector(":scope > .t")) return;
      const label = b.innerHTML.trim();
      b.innerHTML = `<span class="t">${label}</span><span class="t2" aria-hidden="true">${label}</span>`;
    });
  }

  /* ---------- icons (24px grid, 1.8 stroke, round caps) ---------- */
  const P = {
    home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z",
    search: "M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zM20 20l-4-4",
    bids: "M4 7h12M4 12h9M4 17h6M17 14l3 3-3 3",
    active: "M4 6h16v12H4zM4 10h16M9 14h6",
    wallet: "M3 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 7l12-3v3M16 13.5h2",
    chat: "M4 5h16v11H9l-5 4z",
    user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
    bell: "M6 17V11a6 6 0 1 1 12 0v6l2 2H4zM10 21h4",
    plus: "M12 5v14M5 12h14",
    minus: "M5 12h14",
    arrow: "M5 12h14M13 6l6 6-6 6",
    back: "M19 12H5M11 6l-6 6 6 6",
    chevron: "M9 6l6 6-6 6",
    down: "M6 9l6 6 6-6",
    check: "M5 12.5 10 17l9-10",
    close: "M6 6l12 12M18 6 6 18",
    lock: "M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z",
    shield: "M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z",
    upload: "M12 16V4M7 9l5-5 5 5M4 20h16",
    filter: "M4 6h16M7 12h10M10 18h4",
    cal: "M4 6h16v14H4zM4 10h16M9 3v4M15 3v4",
    pin: "M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12zM12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
    link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
    eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
    bookmark: "M6 3h12v18l-6-4-6 4z",
    send: "M4 12 20 4l-6 16-3-7z",
    clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
    flag: "M5 21V4h11l-2 4 2 4H5",
    info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01",
    alert: "M12 3 2 20h20zM12 10v4M12 17h.01",
    camera: "M4 7h4l2-3h4l2 3h4v13H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
    logout: "M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10",
    brief: "M3 6h18v12H3zM3 7l9 6 9-6",
    rail: "M7 12h3M14 12h3M5 10a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM12 9.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM19 10a2 2 0 1 1 0 4 2 2 0 0 1 0-4z",
    coin: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9 8h6M9 11h6M11 8a3 3 0 0 1 0 6H9l4 3.5",
    heart: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z",
    cart: "M3 4h2l2.4 11h10.2L20 8H6.3M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM17 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z",
    users:
      "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14a6.5 6.5 0 0 1 3.5 6",
    file: "M6 3h8l4 4v14H6zM14 3v4h4",
    download: "M12 4v12M7 11l5 5 5-5M4 20h16",
    star: "M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.9z",
    chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
    edit: "M4 20h4L19 9l-4-4L4 16zM14 6l4 4",
    trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13",
    refund: "M4 9h11a5 5 0 0 1 0 10H8M4 9l4-4M4 9l4 4",
    verified:
      "M12 3l2.4 1.8 3-.2.9 2.9 2.4 1.8-1 2.8 1 2.8-2.4 1.8-.9 2.9-3-.2L12 21l-2.4-1.8-3 .2-.9-2.9-2.4-1.8 1-2.8-1-2.8 2.4-1.8.9-2.9 3 .2zM8.5 12l2.4 2.4 4.6-4.8",
    paperclip: "M20 11.5l-8 8a5 5 0 0 1-7-7l8.5-8.5a3.5 3.5 0 0 1 5 5L10 17.5a2 2 0 0 1-3-3l7.5-7.5",
  };
  function icon(n, cls = "") {
    if (n === "ig")
      return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" stroke="none"/></svg>`;
    if (n === "yt")
      return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="2.5" y="5.5" width="19" height="13" rx="4"/><path d="M10 9.5v5l4.5-2.5z" fill="currentColor" stroke="none"/></svg>`;
    return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${P[n] || P.info}"/></svg>`;
  }

  /* ---------- motion API (implemented in motion.js; safe no-ops until then) ---------- */
  const motion = {
    enter() {},
    stagger() {},
    count(el, to, fmt) {
      if (el) el.textContent = fmt ? fmt(to) : to;
    },
    press() {},
    swipe() {
      return () => {};
    },
    reveal() {},
    celebrate() {},
    flip(fn) {
      fn && fn();
    },
  };

  window.LLD = {
    RM,
    $,
    $$,
    esc,
    inr,
    rupees,
    compact,
    payout,
    FEE_EXAMPLE,
    fmtDate,
    daysLeft,
    ago,
    ageFrom,
    D,
    store,
    register,
    go,
    route,
    views,
    current: () => current,
    setRouteGuard,
    setGuestRoutes,
    heldInEscrow,
    creator,
    openSheet,
    closeSheet,
    toast,
    liquid,
    icon,
    initials,
    motion,
    today: () => (import.meta.env.VITE_TEST_HOOKS ? new Date("2026-11-04T10:42:00+05:30") : new Date()),
  };

  window.LLD.boot = () => {
    booted = true;
    $$("[data-ic]").forEach(e => e.insertAdjacentHTML("afterbegin", icon(e.dataset.ic)));
    const clk = $("#clock");
    const tick = () => {
      if (!clk) return;
      let t = "";
      try {
        t = new Intl.DateTimeFormat("en-IN", {
          weekday: "short",
          day: "numeric",
          month: "short",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
          timeZone: "Asia/Kolkata",
        }).format(LLD.today());
      } catch (e) {}
      clk.innerHTML = esc(t.replace(/\s?(am|pm)/i, m => " " + m.trim().toUpperCase())) + " <b>IST</b>";
    };
    tick();
    setInterval(tick, 30000);
    const sk = $("[data-skip]");
    sk &&
      sk.addEventListener("click", e => {
        e.preventDefault();
        const v = $("#view");
        v && v.focus();
      });
    document.addEventListener("click", e => {
      const a = e.target.closest("[data-go]");
      if (a) {
        e.preventDefault();
        go(a.dataset.go);
      }
    });
    route();
  };
})();
