// @ts-nocheck
/* Home (#home, Builder A): IST greeting, the two numbers the spec asks for (creators hired, active campaigns) with escrow held
   and budget used, "Needs you today" derived from bids and campaigns, what is waiting on creators, and a short "creators for you" strip.
   Also owns the notifications sheet opened by the #bell button (attached on load). */
(() => {
  const L = window.LLD,
    { esc, icon, store } = L;
  const mo = (k, ...a) => {
    const f = L.motion && L.motion[k];
    if (typeof f === "function") {
      try {
        return f(...a);
      } catch (e) {}
    }
  };
  const WORDS = ["Nothing", "One thing", "Two things", "Three things", "Four things", "Five things"];
  const LIVE = ["funded", "in_progress", "submitted", "revision", "approved"];
  const first = n =>
    String(n || "")
      .trim()
      .split(/\s+/)[0] || "";
  /* small avatars carry one letter (two-letter initials like "AI" read as a label); large ones carry two */
  const avatar = (c, cls = "") => {
    const n = c ? c.name : "?";
    return `<span class="home-av ${c && c.tone === "b" ? "is-b" : ""} ${cls}" aria-hidden="true">${esc(cls.includes("lg") ? L.initials(n) : n.trim()[0].toUpperCase())}</span>`;
  };
  const dayTxt = d =>
    d === 0
      ? "today"
      : d === 1
        ? "tomorrow"
        : d < 0
          ? `${-d} ${d === -1 ? "day" : "days"} late`
          : `${d} days left`;

  /* ---------- notification kinds (the spec's list, plus the ones other flows add) ---------- */
  const KIND = {
    accepted: ["check", "Invitation accepted", "ok"],
    declined: ["close", "Invitation declined", "err"],
    rejected: ["close", "Invitation declined", "err"],
    bid: ["bids", "New bid", "brand"],
    message: ["chat", "New message", "plain"],
    delivery: ["upload", "Delivery submitted", "info"],
    paid: ["lock", "Payment successful", "escrow"],
    escrow: ["lock", "Payment successful", "escrow"],
    funded: ["lock", "Payment successful", "escrow"],
    payment: ["coin", "Payment released", "escrow"],
    release: ["coin", "Payment released", "escrow"],
    released: ["coin", "Payment released", "escrow"],
    refund: ["refund", "Refund", "info"],
    refunded: ["refund", "Refund", "info"],
    revision: ["edit", "Revision", "warn"],
    review: ["star", "Review", "plain"],
    invite: ["send", "Invitation sent", "plain"],
    invited: ["send", "Invitation sent", "plain"],
    cancelled: ["close", "Invitation cancelled", "plain"],
    canceled: ["close", "Invitation cancelled", "plain"],
    submitted: ["upload", "Delivery submitted", "info"],
    approved: ["check", "Work approved", "ok"],
    job: ["brief", "Job", "plain"],
    closed: ["brief", "Job closed", "plain"],
    posted: ["brief", "Job posted", "plain"],
  };
  const kindOf = k =>
    KIND[String(k || "").toLowerCase()] || [
      "bell",
      "Update",
      "plain",
    ]; /* unknown kinds still read sensibly */

  /* the sample data has no "declined" or "payment successful" notice yet; add them once so every kind in the spec appears */
  (function seed() {
    const n = (LLD_DATA.notifications = LLD_DATA.notifications || []);
    if (!n.some(x => x.kind === "declined" || x.kind === "rejected"))
      n.push({
        id: "n6",
        kind: "declined",
        text: "Meher Gill declined your invitation for Wedding-season glow Reel. Nothing was charged.",
        at: "2026-10-28T13:05:00+05:30",
        go: "#creator-cr6",
        read: true,
      });
    if (!n.some(x => ["paid", "escrow", "funded"].includes(x.kind)))
      n.push({
        id: "n7",
        kind: "paid",
        text: "Payment successful. ₹16,000 is held in escrow for Sunscreen reapplication, office day.",
        at: "2026-10-24T15:30:00+05:30",
        go: "#campaign-c1",
        read: true,
      });
  })();

  /* ---------- notifications sheet (#bell) ---------- */
  function bellLabel() {
    const b = document.getElementById("bell");
    if (!b) return;
    const n = LLD_DATA.notifications.filter(x => !x.read).length;
    b.setAttribute("aria-label", n ? `Notifications, ${n} unread` : "Notifications");
  }
  const UI = () => (LLD_DATA.ui.home = LLD_DATA.ui.home || { nfilter: "all" });
  function groupOf(at) {
    const d = -L.daysLeft(at.slice(0, 10));
    return d <= 0 ? "Today" : d === 1 ? "Yesterday" : d < 7 ? "This week" : "Earlier";
  }
  function openNotifications() {
    const s = LLD_DATA,
      ui = UI();
    const paint = (body, opts = {}) => {
      const all = [...s.notifications].sort((a, b) => L.D(b.at) - L.D(a.at));
      const unread = all.filter(n => !n.read).length;
      if (ui.nfilter === "unread" && !unread && !opts.keep) ui.nfilter = "all";
      const list = ui.nfilter === "unread" ? all.filter(n => !n.read) : all;
      const groups = [];
      list.forEach(n => {
        const g = groupOf(n.at);
        let G = groups.find(x => x.g === g);
        if (!G) groups.push((G = { g, items: [] }));
        G.items.push(n);
      });
      body.innerHTML = all.length
        ? `<div class="home-nt-h">
          <div class="seg home-nt-seg" role="group" aria-label="Show">
            <button type="button" data-f="all" aria-pressed="${ui.nfilter === "all"}">All</button>
            <button type="button" data-f="unread" aria-pressed="${ui.nfilter === "unread"}">Unread${unread ? ` <span class="num">${unread}</span>` : ""}</button>
          </div>
          <button class="btn-q" type="button" data-allread ${unread ? "" : 'disabled aria-disabled="true"'}>${icon("check")}Mark all read</button>
        </div>
        <p class="sr-only" aria-live="polite" data-ntlive>${unread ? `${unread} unread` : "All caught up"}</p>
        ${
          list.length
            ? groups
                .map(
                  G =>
                    `<section class="home-nt-g" aria-label="${esc(G.g)}"><h3 class="t-eyebrow">${esc(G.g)}</h3><ul class="home-nt">${G.items
                      .map(n => {
                        const [ic, label, tone] = kindOf(n.kind);
                        return `<li class="${n.read ? "" : "is-unread"}" data-li="${esc(n.id)}">
            <button class="home-nt-i" type="button" data-n="${esc(n.id)}">
              <span class="home-nt-ic is-${tone}" aria-hidden="true">${icon(ic)}</span>
              <span class="home-nt-t"><span class="home-nt-txt">${esc(n.text)}</span><span class="home-nt-at">${esc(label)} · ${esc(L.ago(n.at))}${n.read ? "" : '<span class="sr-only">, unread</span>'}</span></span>
              <span class="home-nt-dot" aria-hidden="true"></span>
            </button>
            ${n.read ? "" : `<button class="ibtn home-nt-mark" type="button" data-mark="${esc(n.id)}" aria-label="Mark as read: ${esc(n.text)}" title="Mark as read">${icon("check")}</button>`}
          </li>`;
                      })
                      .join("")}</ul></section>`,
                )
                .join("")
            : `<div class="home-nt-none"><p class="t-h3">No unread notifications</p><p class="muted">You've seen everything. <button type="button" class="btn-q" data-f="all">Show all</button></p></div>`
        }
        <p class="home-nt-foot sample">Sample notifications</p>`
        : `<div class="empty home-nt-empty"><img src="assets/step-01-envelope.svg" width="140" height="103" alt=""><p class="t-h2">You're all caught up.</p><p class="muted">Bids, accepted invitations, deliveries and payments land here.</p></div>`;
      if (!opts.quiet) mo("stagger", L.$$(".home-nt li", body));
    };
    L.openSheet({
      title: "Notifications",
      body: "",
      onMount(body, close) {
        paint(body);
        body.addEventListener("click", e => {
          const t = e.target.closest("button");
          if (!t) return;
          if (t.dataset.f) {
            ui.nfilter = t.dataset.f;
            paint(body, { keep: true });
            const b = body.querySelector(`[data-f="${ui.nfilter}"]`);
            b && b.focus();
            return;
          }
          if (t.hasAttribute("data-allread")) {
            L.store.set(
              st =>
                st.notifications.forEach(n => {
                  n.read = true;
                }),
              "notif-read-all",
            );
            paint(body, { quiet: true });
            L.toast("All marked as read", "check");
            const f = body.querySelector(".home-nt-i");
            f && f.focus();
            return;
          }
          if (t.dataset.mark) {
            const n = s.notifications.find(x => x.id === t.dataset.mark);
            if (!n) return;
            const li = t.closest("li"),
              nextFocus = li && (li.nextElementSibling || li.previousElementSibling);
            L.store.set(() => {
              n.read = true;
            }, "notif-read");
            const keepId = nextFocus && nextFocus.dataset.li;
            paint(body, { quiet: true, keep: true });
            const live = body.querySelector("[data-ntlive]");
            if (live) live.textContent = "Marked as read";
            const back =
              (keepId && body.querySelector(`[data-li="${keepId}"] .home-nt-i`)) ||
              body.querySelector(`[data-n="${n.id}"]`) ||
              body.querySelector(".home-nt-i") ||
              body.querySelector('[data-f="all"]');
            back && back.focus();
            return;
          }
          if (t.dataset.n) {
            const n = s.notifications.find(x => x.id === t.dataset.n);
            if (!n) return;
            L.store.set(() => {
              n.read = true;
            }, "notif-read");
            close(true);
            if (n.go) L.go(n.go);
          }
        });
      },
    });
  }
  L.openNotifications = openNotifications;
  const bell = document.getElementById("bell");
  if (bell && !bell.dataset.wired) {
    bell.dataset.wired = "1";
    bell.addEventListener("click", openNotifications);
    bell.setAttribute("aria-haspopup", "dialog");
  }
  store.on(bellLabel);
  bellLabel();

  /* ---------- greeting by IST time ---------- */
  function greeting(now) {
    let h = 12;
    try {
      h =
        Number(
          new Intl.DateTimeFormat("en-GB", {
            hour: "2-digit",
            hour12: false,
            timeZone: "Asia/Kolkata",
          }).format(now),
        ) % 24;
    } catch (e) {}
    return h < 4
      ? "Up late"
      : h < 12
        ? "Good morning"
        : h < 17
          ? "Good afternoon"
          : h < 23
            ? "Good evening"
            : "Up late";
  }

  /* budget: escrow paid in this budget window and not refunded */
  function budget(s) {
    const b = s.budget || { total: 0, label: "" };
    const from = b.from || "2026-10-01",
      to = b.to || "2026-12-31";
    const used = s.payments
      .filter(p => p.kind === "escrow" && p.status !== "refunded" && p.date >= from && p.date <= to)
      .reduce((n, p) => n + p.amount, 0);
    const owed = s.campaigns.filter(c => c.stage === "accepted").reduce((n, c) => n + c.price, 0); // accepted, not paid yet
    return { total: b.total, label: b.label, used, owed, left: Math.max(0, b.total - used) };
  }

  /* creators worth a look: not already working with you, ranked on fit with your industry */
  function picks(s) {
    const busy = new Set(
      s.campaigns.filter(c => [...LIVE, "accepted", "invited"].includes(c.stage)).map(c => c.creator),
    );
    const ind = String(s.me.industry || "").toLowerCase();
    const score = c =>
      (c.categories.some(x => x.toLowerCase() === ind) ? 4 : 0) +
      (c.verified ? 1 : 0) +
      (c.availability === "open" ? 1 : 0) +
      (c.rating || 3.5) +
      (s.favorites.includes(c.id) ? 0.3 : 0);
    return s.creators
      .filter(c => !busy.has(c.id))
      .sort((a, b) => score(b) - score(a))
      .slice(0, 4);
  }

  function render(el) {
    const draw = initial => {
      const s = store.s,
        now = L.today(),
        st = L.brandStats ? L.brandStats() : { hired: 0, hiredIds: [], active: [] };
      const bud = budget(s),
        held = L.heldInEscrow();
      let when = "";
      try {
        const tz = { timeZone: "Asia/Kolkata" };
        const day = new Intl.DateTimeFormat("en-IN", {
          weekday: "long",
          day: "numeric",
          month: "short",
          ...tz,
        })
          .format(now)
          .replace(",", "");
        const time = new Intl.DateTimeFormat("en-IN", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
          ...tz,
        })
          .format(now)
          .replace(/\s?(am|pm)/i, m => " " + m.trim().toUpperCase());
        when = `${day} · ${time} IST`;
      } catch (e) {}

      /* ---- needs you today: real objects derived from bids and campaigns ---- */
      const objs = [];
      s.campaigns
        .filter(c => c.stage === "submitted")
        .forEach(c => {
          const cr = L.creator(c.creator) || {},
            d = c.deliveries && c.deliveries[c.deliveries.length - 1];
          objs.push(`<li class="home-obj home-del">
          <div class="home-obj-top"><span class="pill pill-info">${icon("upload")}Delivery to verify</span>${d ? `<span class="home-due">Sent ${esc(L.ago(d.at))}</span>` : ""}</div>
          <p class="home-from">${avatar(cr)}<span><b>${esc(cr.name)}</b> sent ${c.deliveries.length > 1 ? "a new version" : "the final cut"}</span></p>
          ${d && d.note ? `<blockquote class="home-quote">“${esc(d.note)}”</blockquote>` : ""}
          <p class="home-job">${esc(c.title)}</p>${d ? `<p class="home-file">${icon("file")}${esc(d.file)}</p>` : ""}
          <div class="home-obj-act"><a class="lq lq-p lq-sm" href="#campaign-${esc(c.id)}">Review delivery</a><span class="pill pill-escrow">${icon("lock")}${L.inr(c.price)} in escrow</span></div>
          <p class="home-obj-foot">Approve to release the money, or ask for a revision. ${c.revisionsIncluded - c.revisionsUsed} of ${c.revisionsIncluded} revision${c.revisionsIncluded === 1 ? "" : "s"} left.</p>
        </li>`);
        });
      const openJobs = s.jobs
        .filter(j => j.status === "open")
        .map(j => ({ j, fresh: s.bids.filter(b => b.job === j.id && b.status === "new") }))
        .filter(x => x.fresh.length)
        .sort((a, b) => b.fresh.length - a.fresh.length);
      if (openJobs.length) {
        const { j, fresh } = openJobs[0],
          prices = fresh.map(b => b.price),
          lo = Math.min(...prices),
          hi = Math.max(...prices);
        const crs = fresh.map(b => L.creator(b.creator)).filter(Boolean);
        objs.push(`<li class="home-obj home-bids">
          <div class="home-obj-top"><span class="pill pill-violet">${icon("bids")}${fresh.length} new bid${fresh.length === 1 ? "" : "s"}</span><span class="home-due">${icon("clock")}Post by ${esc(L.fmtDate(j.deadline))}</span></div>
          <p class="home-obj-t">${esc(j.title)}</p>
          <div class="home-stack"><span class="home-avs">${crs
            .slice(0, 3)
            .map(c => avatar(c))
            .join(
              "",
            )}</span><span>${esc(crs.map(c => first(c.name)).join(" and "))} bid since yesterday</span></div>
          <dl class="home-mini">
            <div><dt>New bids</dt><dd class="t-money">${lo === hi ? L.inr(lo) : `${L.inr(lo)}–${L.inr(hi).slice(1)}`}</dd></div>
            <div><dt>Your budget</dt><dd class="t-money">${L.inr(j.budget)}</dd></div>
            <div><dt>All bids</dt><dd class="t-money">${esc(j.bids)}</dd></div>
          </dl>
          <div class="home-obj-act"><a class="lq lq-p lq-sm" href="#job-${esc(j.id)}">Compare bids</a>${openJobs[1] ? `<a class="btn-q" href="#job-${esc(openJobs[1].j.id)}">+${openJobs[1].fresh.length} on ${esc(openJobs[1].j.title)}</a>` : ""}</div>
        </li>`);
      }
      s.campaigns
        .filter(c => c.stage === "accepted")
        .forEach(c => {
          const cr = L.creator(c.creator) || {},
            acc = (c.log || []).find(x => x[1] === "accepted");
          objs.push(`<li class="home-obj home-pay ink-card dark">
          <p class="home-pay-l">${esc(cr.name)} accepted${acc ? ` ${esc(L.ago(acc[0]))}` : ""}</p>
          <p class="t-money home-pay-v">${L.inr(c.price)}</p>
          <p class="home-pay-s">Pay into escrow to start <b>${esc(c.title)}</b>. Linkloom holds it until you approve the work; chat opens once it's paid.</p>
          <div class="home-obj-act"><button class="lq lq-p lq-sm" type="button" data-pay="${esc(c.id)}">${icon("lock", "ic")}Pay into escrow</button><a class="btn-q" href="#campaign-${esc(c.id)}">Details</a></div>
          ${bud.total ? `<p class="home-pay-b">Leaves ${L.inr(Math.max(0, bud.left - c.price))} of your ${esc(bud.label)} budget.</p>` : ""}
        </li>`);
        });

      /* waiting on creators: nothing for you to do, but worth knowing */
      const waits = [];
      s.campaigns
        .filter(c => c.stage === "revision")
        .forEach(c => {
          const cr = L.creator(c.creator) || {},
            th = s.threads.find(t => t.id === c.thread),
            last = th && [...th.messages].reverse().find(m => m.from === "creator");
          waits.push(`<li class="home-wait">${avatar(cr)}
          <div class="home-wait-t"><p><b>${esc(cr.name)}</b> is working on your revision <span class="pill pill-warn">Revision ${c.revisionsUsed} of ${c.revisionsIncluded}</span></p>
            <p class="home-wait-s">${esc(c.title)} · due ${esc(L.fmtDate(c.due))}, ${esc(dayTxt(L.daysLeft(c.due)))}${last ? ` · “${esc(last.text)}”` : ""}</p></div>
          <div class="home-wait-a">${th ? `<a class="btn-q" href="#chat-${esc(th.id)}">${icon("chat")}Message</a>` : ""}<a class="btn-q" href="#campaign-${esc(c.id)}">Open${icon("arrow")}</a></div></li>`);
        });
      s.campaigns
        .filter(c => c.stage === "invited")
        .forEach(c => {
          const cr = L.creator(c.creator) || {},
            inv = (c.log || []).find(x => x[1] === "invited");
          waits.push(`<li class="home-wait">${avatar(cr)}
          <div class="home-wait-t"><p><b>${esc(cr.name)}</b> hasn't replied to your invitation <span class="pill pill-paper">${icon("clock")}Pending</span></p>
            <p class="home-wait-s">${esc(c.title)} · ${L.inr(c.price)}${inv ? ` · sent ${esc(L.ago(inv[0]))}` : ""} · nothing is charged until ${esc(first(cr.name))} accepts and you pay</p></div>
          <div class="home-wait-a"><a class="btn-q" href="#campaign-${esc(c.id)}">View or cancel${icon("arrow")}</a></div></li>`);
        });

      const crs = picks(s);
      const hiredCr = st.hiredIds.map(id => L.creator(id)).filter(Boolean);
      const act = st.active,
        review = act.filter(c => c.stage === "submitted").length,
        rev = act.filter(c => c.stage === "revision").length;
      const actNote =
        [
          review && `${review} to review`,
          rev && `${rev} in revision`,
          act.length - review - rev > 0 && `${act.length - review - rev} in progress`,
        ]
          .filter(Boolean)
          .join(" · ") || "None running right now";
      const pct = bud.total ? Math.min(100, (bud.used / bud.total) * 100) : 0,
        opct = bud.total ? Math.min(100 - pct, (bud.owed / bud.total) * 100) : 0;

      el.innerHTML = `<div class="view-in home">
        <header class="home-hi">
          <h1 class="home-greet">${esc(greeting(now))}, ${esc(first(s.me.name))}.</h1>
          <p class="home-lede">${objs.length ? `${WORDS[Math.min(objs.length, 5)]} ${objs.length === 1 ? "needs" : "need"} you today${waits.length ? `, and ${WORDS[Math.min(waits.length, 5)].toLowerCase()} ${waits.length === 1 ? "is" : "are"} with creators` : ""}.` : "Nothing needs you right now. A good day to find a creator."} <span class="sample">Sample data</span></p>
        </header>

        <section class="home-band" aria-label="${esc(s.me.brand)} at a glance">
          <dl class="home-nums">
            <div><dt>Creators hired</dt><dd class="t-money" data-n="${st.hired}">${st.hired}</dd>
              <p class="home-num-s">${
                hiredCr.length
                  ? `<span class="home-avs">${hiredCr
                      .slice(0, 3)
                      .map(c => avatar(c))
                      .join("")}</span>${esc(hiredCr.map(c => c.name).join(" and "))}`
                  : "Paid through escrow"
              }</p></div>
            <div><dt>Active campaigns</dt><dd class="t-money" data-n="${act.length}">${act.length}</dd><p class="home-num-s">${esc(actNote)}</p></div>
            <div><dt>Held in escrow</dt><dd class="t-money" data-inr="${held}">${L.inr(held)}</dd><p class="home-num-s"><span class="pill pill-escrow">${icon("lock")}Released only when you approve</span></p></div>
          </dl>
          ${
            bud.total
              ? `<div class="home-bud">
            <div class="home-bud-h"><p><b>Budget used</b> · ${esc(bud.label)}</p><p class="num"><b>${L.inr(bud.used)}</b> of ${L.inr(bud.total)}</p></div>
            <div class="home-bud-bar" role="img" aria-label="${Math.round(pct)}% of the ${esc(bud.label)} budget used${bud.owed ? `, ${L.inr(bud.owed)} more to pay for accepted invitations` : ""}"><i style="width:${pct.toFixed(2)}%"></i>${bud.owed ? `<i class="is-owed" style="width:${opct.toFixed(2)}%"></i>` : ""}</div>
            <p class="home-bud-s"><span class="num">${L.inr(bud.left)}</span> left${bud.owed ? ` · <span class="home-key"></span>${L.inr(bud.owed)} more once you pay accepted invitations` : ""} · <a class="btn-q" href="#reports">Spending report</a></p>
          </div>`
              : ""
          }
        </section>

        <section class="home-today" aria-labelledby="homeTodayH">
          <div class="home-sec-h"><h2 class="t-h2" id="homeTodayH">Needs you today</h2></div>
          ${
            objs.length
              ? `<ul class="home-strip home-strip-${Math.min(objs.length, 3)}">${objs.join("")}</ul>`
              : `<div class="empty home-empty"><img src="assets/step-05-stamp.svg" width="160" height="117" alt=""><p class="t-h3">You're all caught up.</p><p class="muted">New bids, deliveries and accepted invitations show up here.</p></div>`
          }
          ${waits.length ? `<div class="home-waits"><h3 class="t-eyebrow">With creators</h3><ul>${waits.join("")}</ul></div>` : ""}
        </section>

        <section class="home-crs" aria-labelledby="homeCrH">
          <div class="home-sec-h">
            <div><h2 class="t-h2" id="homeCrH">Creators for you</h2><p class="muted t-small">Ranked on ${esc((s.me.industry || "your industry").toLowerCase())}, verification, availability and rating.</p></div>
            <a class="btn-q" href="#creators">Find creators${icon("arrow")}</a>
          </div>
          ${
            crs.length
              ? `<ul class="home-cr-list">${crs
                  .map((c, i) => {
                    const top = [...c.platforms].sort((a, b) => b.followers - a.followers)[0],
                      min = Math.min(...Object.values(c.rates || { x: 0 }));
                    const saved = s.favorites.includes(c.id),
                      inCart = s.cart.includes(c.id);
                    return `<li><a class="card home-cr" href="#creator-${esc(c.id)}">
              ${i === 0 ? '<span class="t-note home-note" aria-hidden="true">worth a look</span>' : ""}
              <div class="home-cr-top">${avatar(c, "lg")}<span class="home-cr-tags">${saved ? `<span class="pill pill-line">${icon("heart")}Saved</span>` : ""}${inCart ? `<span class="pill pill-line">${icon("cart")}In cart</span>` : ""}</span></div>
              <p class="home-cr-n"><b>${esc(c.name)}</b>${c.verified ? `<span class="home-cr-v" title="Verified">${icon("verified")}<span class="sr-only">, verified</span></span>` : ""}</p>
              <p class="home-cr-h">${esc(c.handle)} · ${esc(c.city)}</p>
              <dl class="home-cr-st">
                <div><dt>${top.p === "youtube" ? "Subscribers" : "Followers"}</dt><dd>${icon(top.p === "youtube" ? "yt" : "ig")}${esc(L.compact(top.followers))}</dd></div>
                <div><dt>Engagement</dt><dd>${esc(top.er)}%</dd></div>
                <div><dt>Rating</dt><dd>${c.rating ? `${icon("star")}${esc(c.rating)}` : "New"}</dd></div>
              </dl>
              <p class="home-cr-f"><span>${esc(c.categories.slice(0, 2).join(" · "))}</span><span class="num">from <b>${L.inr(min)}</b></span></p>
            </a></li>`;
                  })
                  .join("")}</ul>`
              : `<div class="empty home-empty"><img src="assets/step-04-orbit.svg" width="160" height="117" alt=""><p class="t-h3">You're working with everyone we'd suggest.</p><a class="lq lq-p" href="#creators">Search all creators</a></div>`
          }
        </section>
      </div>`;
      L.liquid(el);

      el.querySelectorAll("[data-pay]").forEach(b =>
        b.addEventListener("click", () => {
          if (typeof L.payEscrow === "function") L.payEscrow(b.dataset.pay);
          else L.go("#campaign-" + b.dataset.pay);
        }),
      );
      if (initial) {
        el.querySelectorAll(".home-nums [data-n]").forEach(d => {
          const n = +d.dataset.n;
          if (n) mo("count", d, n, v => String(Math.round(v)));
        });
        const h = el.querySelector("[data-inr]");
        if (h && +h.dataset.inr) mo("count", h, +h.dataset.inr, L.inr);
        mo("stagger", L.$$(".home-obj, .home-wait", el));
        mo("stagger", L.$$(".home-cr-list>li", el));
        const bar = el.querySelector(".home-bud-bar");
        bar && bar.classList.add("is-in");
      } else {
        el.querySelectorAll(".home-bud-bar").forEach(b => b.classList.add("is-in", "is-now"));
      }
      mo("lift", L.$$(".home-cr", el));
    };
    draw(true);
    let raf = 0;
    const off = store.on(why => {
      if (/^notif/.test(String(why))) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (el.isConnected) draw(false);
      });
    });
    return () => {
      off();
      cancelAnimationFrame(raf);
    };
  }

  L.register("home", { title: "Home", nav: "home", render });
})();
