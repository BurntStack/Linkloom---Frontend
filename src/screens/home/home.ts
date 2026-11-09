// @ts-nocheck
/* Home (#home): IST greeting, "what needs you today" strip of real objects, KYC nudge, Best Match briefs.
   Also owns the notifications sheet opened by the #bell button in the top bar. Owner: Builder B. */
(() => {
  const L = window.LLD,
    esc = L.esc;
  const WORDS = ["Nothing", "One thing", "Two things", "Three things", "Four things", "Five things"];

  /* ---------- notifications sheet (#bell) ---------- */
  function bellLabel() {
    const b = document.getElementById("bell");
    if (!b) return;
    const n = LLD_DATA.notifications.filter(x => !x.read).length;
    b.setAttribute("aria-label", n ? `Notifications, ${n} unread` : "Notifications");
  }
  function openNotifications() {
    const s = LLD_DATA;
    const paint = body => {
      const list = [...s.notifications].sort((a, b) => L.D(b.at) - L.D(a.at));
      const unread = list.filter(n => !n.read).length;
      body.innerHTML = list.length
        ? `<div class="home-nt-h">
          <p class="t-small muted" aria-live="polite">${unread ? `${unread} unread` : "All caught up"}</p>
          <button class="btn-q" type="button" data-allread ${unread ? "" : 'disabled aria-disabled="true"'}>${L.icon("check")}Mark all read</button>
        </div>
        <ul class="home-nt">${list
          .map(
            n => `<li><button class="home-nt-i${n.read ? "" : " is-unread"}" type="button" data-n="${esc(n.id)}">
            <span class="home-nt-dot" aria-hidden="true"></span>
            <span class="home-nt-t"><span>${esc(n.text)}</span><span class="home-nt-at">${esc(L.ago(n.at))}${n.read ? "" : '<span class="sr-only">, unread</span>'}</span></span>
            ${L.icon("chevron")}
          </button></li>`,
          )
          .join("")}</ul>
        <p class="home-nt-foot sample">Sample notifications</p>`
        : `<div class="empty home-nt-empty"><img src="assets/step-01-envelope.svg" width="140" height="103" alt=""><p class="t-h2">You are all caught up.</p><p class="muted">Bid updates, revision requests and payouts land here.</p></div>`;
    };
    L.openSheet({
      title: "Notifications",
      body: "",
      onMount(body, close) {
        paint(body);
        body.addEventListener("click", e => {
          const t = e.target.closest("button");
          if (!t) return;
          if (t.hasAttribute("data-allread")) {
            L.store.set(
              st =>
                st.notifications.forEach(n => {
                  n.read = true;
                }),
              "notif-read-all",
            );
            L.live && L.live.readAllNotifications().catch(() => undefined);
            paint(body);
            L.toast("All marked as read");
            const first = body.querySelector(".home-nt-i");
            first && first.focus();
          } else if (t.dataset.n) {
            const n = s.notifications.find(x => x.id === t.dataset.n);
            if (!n) return;
            if (!n.read && L.live) L.live.readNotification(n.id).catch(() => undefined);
            L.store.set(() => {
              n.read = true;
            }, "notif-read");
            close(true);
            if (n.go) L.go(n.go);
          }
        });
        L.jobkit && L.jobkit.mo("stagger", L.$$(".home-nt-i", body));
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
  L.store.on(bellLabel);
  bellLabel();

  /* ---------- greeting by IST time ---------- */
  /* hour of the app clock in IST */
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

  const KYC_NUDGE = {
    not_started: [
      null,
      "Verify your ID once, before your first bid.",
      "PAN, an ID and where to pay you. Checked once, never shown to brands.",
      "Start verification",
      "",
    ],
    in_progress: [
      "pill-info",
      "Finish your ID check.",
      "You started verification. Pick up where you left off.",
      "Continue",
      "In progress",
    ],
    under_review: [
      "pill-info",
      "Your ID is under review.",
      "You can draft bids now and send them once it clears.",
      "See status",
      "Under review",
    ],
    action_needed: [
      "pill-warn",
      "One detail needs fixing before you can bid.",
      "Your verification is paused until it is fixed.",
      "Fix it",
      "Action needed",
    ],
    rejected: [
      "pill-err",
      "Verification was not approved.",
      "See what to change and try again. Brands never see this.",
      "See why",
      "Rejected",
    ],
  };

  L.register("home", {
    title: "Home",
    nav: "home",
    render(el) {
      const K = L.jobkit,
        s = K.ensure(),
        now = L.today(); // the app clock, same one the top bar shows
      const first = s.me.name.split(/\s+/)[0];
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

      /* what needs you today: real objects from active work and money */
      const objs = [];
      s.active
        .filter(a => a.stage === "revision")
        .forEach(a => {
          const dl = K.daysTo(a.due),
            th = s.threads.find(t => t.id === a.thread);
          objs.push(`<li class="home-obj home-rev">
          <div class="home-obj-top"><span class="pill pill-warn">Revision requested</span><span class="home-due">${L.icon("clock")}Due ${esc(L.fmtDate(a.due))} · ${esc(K.daysTxt(dl))}</span></div>
          <p class="home-from"><span class="jobs-bi" aria-hidden="true">${esc(th ? th.bi : L.initials(a.brand))}</span>${esc(a.brand)} asked</p>
          <blockquote class="home-quote">“${esc(a.revision || "Please take another look.")}”</blockquote>
          <p class="home-job">${esc(a.title)}</p>
          <div class="home-obj-act"><a class="lq lq-p lq-sm" href="#work-${esc(a.id)}">Open the job</a>${th ? `<a class="btn-q" href="#chat-${esc(th.id)}">Reply</a>` : ""}</div>
        </li>`);
        });
      s.active
        .filter(a => a.stage === "review")
        .forEach(a => {
          const up = a.uploads && a.uploads[a.uploads.length - 1];
          objs.push(`<li class="home-obj home-review">
          <div class="home-obj-top"><span class="pill pill-info">In review</span>${up ? `<span class="home-due">Sent ${esc(L.ago(up.at))}</span>` : ""}</div>
          <p class="home-obj-t">${esc(a.brand)} is reviewing your final cut</p>
          <p class="home-job">${esc(a.title)}</p>
          <ol class="home-track" aria-label="Stage"><li class="is-done">Kickoff</li><li class="is-done">Upload</li><li class="is-now" aria-current="step">Review</li></ol>
          <div class="home-obj-act"><span class="pill pill-escrow">${L.icon("lock")}${L.inr(a.price)} in escrow</span><a class="btn-q" href="#work-${esc(a.id)}">See status${L.icon("arrow")}</a></div>
        </li>`);
        });
      const pending = s.ledger.filter(x => x.status === "pending").reduce((n, x) => n + x.amount, 0);
      if (s.readyToWithdraw > 0) {
        objs.push(`<li class="home-obj home-money ink-card dark">
          <p class="home-money-l">Ready to withdraw</p>
          <p class="t-money home-money-v" data-ready>${L.inr(s.readyToWithdraw)}</p>
          <p class="home-money-s">Cleared funds only.${pending ? ` ${L.inr(pending)} still pending is not included.` : ""}</p>
          <div class="home-obj-act"><a class="lq lq-p lq-sm" href="#earnings">Withdraw</a><span class="home-money-to">to UPI or bank</span></div>
        </li>`);
      }

      const kn = s.kyc.status !== "verified" ? KYC_NUDGE[s.kyc.status] || KYC_NUDGE.not_started : null;
      const total = K.openJobs().length;

      el.innerHTML = `<div class="view-in home">
        <header class="home-hi">
          <p class="home-when">${esc(when)}</p>
          <h1 class="home-greet">${esc(greeting(now))}, ${esc(first)}.</h1>
          <p class="home-lede">${objs.length ? `${WORDS[Math.min(objs.length, 5)]} ${objs.length === 1 ? "needs" : "need"} you today.` : "Nothing needs you right now. A good day to find a new brief."} <span class="sample">Sample data</span></p>
        </header>

        ${
          objs.length
            ? `<section class="home-today" aria-labelledby="homeTodayH">
          <h2 class="sr-only" id="homeTodayH">What needs you today</h2>
          <ul class="home-strip">${objs.join("")}</ul>
        </section>`
            : ""
        }

        ${
          kn
            ? `<section class="home-kyc" aria-label="ID verification">
          <img src="assets/trust-id-card.svg" width="96" height="74" alt="">
          <div class="home-kyc-t">${kn[0] ? `<span class="pill ${kn[0]}">${kn[0] === "pill-err" ? L.icon("alert") : ""}${esc(kn[4])}</span>` : ""}<p class="home-kyc-h">${esc(kn[1])}</p><p class="t-small">${esc((/action_needed|rejected/.test(s.kyc.status) && s.kyc.note) || kn[2])}</p></div>
          <a class="lq lq-p" href="#kyc">${esc(kn[3])}</a>
        </section>`
            : ""
        }

        <section class="home-match" aria-labelledby="homeMatchH">
          <div class="home-match-h">
            <div><h2 class="t-h2" id="homeMatchH">Best match for you</h2><p class="muted t-small">Ranked on platform, niche, language, city, budget and deadline.</p></div>
            <a class="btn-q" href="#jobs">All ${total} jobs${L.icon("arrow")}</a>
          </div>
          <p class="home-hint help">${L.icon("info")}Swipe a brief right to save it, left to hide it. The buttons do the same.</p>
          <div class="home-match-grid" id="homeGrid"></div>
          <p class="home-hidden" aria-live="polite"></p>
        </section>
      </div>`;
      L.liquid(el);

      const grid = el.querySelector("#homeGrid");
      let wired = null;
      function picks() {
        return K.openJobs()
          .filter(j => !K.isHidden(j.id) && !K.openBid(j.id))
          .sort((a, b) => b.match - a.match)
          .slice(0, 4);
      }
      function paint() {
        const p = picks();
        if (wired) {
          wired.cleanup();
          grid.classList.add("is-settled");
        } // match rings fill once per visit, not on every repaint
        grid.innerHTML = p.length
          ? `<div class="home-feat">${K.card(p[0], { variant: "feature", ctx: "home" })}</div>
          <div class="home-more">${p
            .slice(1)
            .map(j => K.card(j, { ctx: "home" }))
            .join("")}</div>`
          : `<div class="empty home-empty"><img src="assets/step-04-orbit.svg" width="160" height="117" alt=""><p class="t-h2">No new matches right now.</p><p class="muted">You have bid on or hidden every brief that fits. New ones arrive most days.</p><a class="lq lq-p" href="#jobs">Browse all jobs</a></div>`;
        // the handwritten aside sits inside the bid box, so it can never collide with the section header
        const box = grid.querySelector(".home-feat .jobs-money");
        if (box)
          box.insertAdjacentHTML(
            "afterbegin",
            '<span class="t-note home-note" aria-hidden="true">your best fit this week</span>',
          );
        L.liquid(grid);
        wired = K.wire(grid, { onHide: id => hidden(id) });
        return p;
      }
      function hidden(id) {
        const j = K.job(id);
        K.flip(
          () => paint(),
          () => L.$$(".jobs-card", grid),
        );
        el.querySelector(".home-hidden").innerHTML =
          `Hidden “${esc(j.title)}”. <button class="btn-q" type="button" data-unhide="${esc(id)}">Undo</button>`;
      }
      el.firstElementChild.addEventListener("click", e => {
        // on this render's root, not the shared #view outlet
        const t = e.target.closest("[data-unhide]");
        if (!t) return;
        K.setHidden(t.dataset.unhide, false);
        K.flip(
          () => paint(),
          () => L.$$(".jobs-card", grid),
        );
        el.querySelector(".home-hidden").textContent = "Back in your matches.";
      });
      grid.addEventListener("keydown", e => {
        const c = e.target.closest(".jobs-card");
        if (!c || e.altKey || e.ctrlKey || e.metaKey || e.target.matches("input,textarea")) return;
        if (e.key === "s" || e.key === "S") {
          e.preventDefault();
          K.toggleSave(c.dataset.id, grid);
        }
        if (e.key === "h" || e.key === "H") {
          e.preventDefault();
          K.setHidden(c.dataset.id, true);
          hidden(c.dataset.id);
        }
      });
      paint();

      const ready = el.querySelector("[data-ready]");
      if (ready) K.mo("count", ready, s.readyToWithdraw, L.inr);
      K.mo("stagger", L.$$(".home-obj", el));
      K.mo("stagger", L.$$(".jobs-card", grid));
      L.$$(".home-obj", el).forEach(o => K.mo("press", o));
      return () => {
        wired && wired.cleanup();
      };
    },
  });
})();
