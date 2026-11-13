// @ts-nocheck
/* Brand side · All jobs (#jobs) and the Builder C kit (LLD.bk) used by post.js, job.js and campaigns.js.
   Mirrors the creator My bids board: lanes of ticket slips, each with a stub, a status pill and a progress rail.
   Job status: open | draft | hired | closed. Tabs: all, open, drafts, closed (closed also holds hired). Money is integer paise. */
(() => {
  const L = window.LLD,
    esc = L.esc,
    ic = L.icon;
  const S = () => window.LLD_DATA;

  /* ---------- kit ---------- */
  const ui = k => {
    const s = S();
    s.ui = s.ui || {};
    return (s.ui[k] = s.ui[k] || {});
  };
  const mo = (fn, ...a) => {
    try {
      return (L.motion[fn] && L.motion[fn](...a)) || null;
    } catch (e) {
      return null;
    }
  };
  const flip = (mutate, nodes) => {
    let done = false;
    const m = () => {
      done = true;
      mutate();
    };
    try {
      L.motion.flip(m, nodes);
    } catch (e) {}
    if (!done) mutate();
  };
  const todayISO = () => L.today().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const nowISO = () => L.today().toISOString();
  const addDays = (iso, n) => {
    const d = new Date(String(iso).slice(0, 10) + "T12:00:00+05:30");
    d.setUTCDate(d.getUTCDate() + n);
    return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  };
  const daysTo = iso =>
    Math.round(
      (new Date(String(iso).slice(0, 10) + "T12:00:00+05:30") - new Date(todayISO() + "T12:00:00+05:30")) /
        864e5,
    );
  const daysTxt = n =>
    n < 0
      ? n === -1
        ? "1 day ago"
        : -n + " days ago"
      : n === 0
        ? "today"
        : n === 1
          ? "1 day left"
          : n + " days left";
  const time = s =>
    L.D(s).toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    });
  const plat = p => (p === "youtube" ? "YouTube" : "Instagram");
  const glyph = p => ic(p === "youtube" ? "yt" : "ig");
  const where = j => (j.remote ? "Any city · remote" : j.city);
  const job = id => S().jobs.find(j => j.id === id) || null;
  const camp = id => S().campaigns.find(c => c.id === id) || null;
  const cr = id =>
    L.creator(id) || {
      id,
      name: "Creator",
      handle: "",
      tone: "c",
      platforms: [],
      languages: [],
      rating: null,
      reviews: 0,
    };
  const first = c => String(c.name || "the creator").split(" ")[0];
  const bidsFor = jid => S().bids.filter(b => b.job === jid);
  const campOfJob = jid =>
    S().campaigns.find(c => c.job === jid && !["cancelled", "declined"].includes(c.stage)) || null;
  /* creators always read in the coral family: full coral, or the subtle coral with a coral ring */
  const cav = (c, cls = "") =>
    `<span class="avatar bk-cav is-${c.tone === "b" ? "b" : "c"}${cls ? " " + cls : ""}" aria-hidden="true">${esc(L.initials(c.name || "?"))}</span>`;
  const ver = c =>
    c.verified
      ? `<span class="bk-ver" title="Verified creator">${ic("verified")}<span class="sr-only">, verified</span></span>`
      : "";
  const crChip = (c, sub) =>
    `<span class="bk-cr">${cav(c)}<span class="bk-cr-t"><b>${esc(c.name)}${ver(c)}</b><span>${esc(sub == null ? c.handle : sub)}</span></span></span>`;
  const pf = (c, p) => (c.platforms || []).find(x => x.p === p) || (c.platforms || [])[0] || null;
  const rating = c =>
    c.rating
      ? `<span class="bk-rate">${ic("star")}<b class="num">${Number(c.rating).toFixed(1)}</b><span class="muted">(${c.reviews})</span></span>`
      : '<span class="bk-rate is-none">No reviews yet</span>';
  const nextInvoice = (prefix = "LL-INV") => {
    const y = todayISO().slice(0, 4),
      re = new RegExp("^" + prefix + "-" + y + "-(\\d+)$");
    const n = S().payments.reduce((m, p) => {
      const x = re.exec(p.invoice || "");
      return x ? Math.max(m, +x[1]) : m;
    }, 0);
    return `${prefix}-${y}-${String(n + 1).padStart(4, "0")}`;
  };
  const notify = (kind, text, go) =>
    L.store.set(
      s =>
        s.notifications.unshift({
          id: "n" + Date.now() + Math.random().toString(36).slice(2, 5),
          kind,
          text,
          at: nowISO(),
          go,
          read: false,
        }),
      "notify",
    );

  const JST = {
    open: { label: "Open", pill: "pill-info", ic: "eye" },
    draft: { label: "Draft", pill: "pill-line", ic: "edit" },
    hired: { label: "Hired", pill: "pill-ok", ic: "check" },
    closed: { label: "Closed", pill: "pill-paper", ic: "close" },
  };
  const BST = {
    new: { label: "New", pill: "pill-butter", ic: "bell" },
    viewed: { label: "Viewed", pill: "pill-line", ic: "eye" },
    shortlisted: { label: "Shortlisted", pill: "pill-violet", ic: "bookmark" },
    declined: { label: "Declined", pill: "pill-paper", ic: "close" },
    hired: { label: "Hired", pill: "pill-ok", ic: "check" },
  };
  const pill = (map, k, label) => {
    const m = map[k] || Object.values(map)[0];
    return `<span class="pill ${m.pill}" data-pill>${ic(m.ic)}${esc(label || m.label)}</span>`;
  };

  /* a confirm sheet in the creator "Withdraw this bid?" pattern: a mini slip, plain consequences, one clear choice */
  function confirm({
    title,
    mini = "",
    bullets = [],
    extra = "",
    yes,
    no = "Keep it",
    danger = false,
    onYes,
  }) {
    L.openSheet({
      title,
      body: `<div class="stack jl-sheet">${mini}<ul class="jl-conseq">${bullets.map(b => `<li>${esc(b)}</li>`).join("")}</ul>${extra}
        <div class="row wrap"><button class="lq ${danger ? "lq-p bk-danger" : "lq-p"}" type="button" data-yes>${esc(yes)}</button><button class="lq lq-s" type="button" data-no>${esc(no)}</button></div></div>`,
      onMount(b, close) {
        b.querySelector("[data-no]").addEventListener("click", () => close());
        b.querySelector("[data-yes]").addEventListener("click", () => {
          const r = onYes && onYes(b);
          if (r !== false) close();
        });
      },
    });
  }
  const jobMini =
    j => `<div class="jl-mini"><span class="bk-plat">${glyph(j.platform)}<span>${esc(plat(j.platform))} ${esc(j.format)} · ${esc(j.category)}</span></span>
    <p class="t-money jl-mini-p">${L.inr(j.budget)}</p><p class="t-small muted">${esc(j.title)}</p></div>`;
  const OPEN_BID = ["new", "viewed", "shortlisted"];

  function closeJob(id, after) {
    const j = job(id);
    if (!j) return;
    const open = bidsFor(id).filter(b => OPEN_BID.includes(b.status)).length;
    const c = campOfJob(id),
      k = c && cr(c.creator);
    confirm({
      title: "Close this job?",
      mini: jobMini(j),
      yes: "Close job",
      no: "Keep it open",
      bullets: [
        c
          ? `Your campaign with ${k.name} carries on. Only the listing closes.`
          : "Creators can no longer find it or bid on it.",
        open
          ? `${open} open bid${open === 1 ? " is" : "s are"} declined, and ${open === 1 ? "that creator is" : "those creators are"} told the job closed.`
          : "No open bids are waiting on you.",
        "Nothing is charged. It stays under Closed with its history.",
      ],
      onYes() {
        if (L.live && j.status !== "draft") {
          L.live.closeJob(id).then(applyClose, e => L.toast(L.live.errorText(e), "alert"));
          return;
        }
        applyClose();
      },
    });
    function applyClose() {
        L.store.set(s => {
          const x = s.jobs.find(y => y.id === id);
          if (!x) return;
          x.status = "closed";
          x.closedAt = nowISO();
          s.bids.forEach(b => {
            if (b.job === id && OPEN_BID.includes(b.status)) {
              b.status = "declined";
              b.closedWithJob = true;
            }
          });
        }, "job-closed");
        L.toast("Job closed", "check");
        after && after();
    }
  }
  function deleteJob(id, after) {
    const j = job(id);
    if (!j) return;
    const c = S().campaigns.find(x => x.job === id);
    if (c) {
      const k = cr(c.creator);
      L.openSheet({
        title: "This job can’t be deleted",
        body: `<div class="stack jl-sheet">${jobMini(j)}
          <p class="muted">You hired ${esc(k.name)} through it, so it is part of a campaign and its invoices. Close the listing instead. It stays in your records.</p>
          <div class="row wrap">${j.status === "closed" ? "" : '<button class="lq lq-p" type="button" data-close-instead>Close job instead</button>'}<button class="lq lq-s" type="button" data-no>Got it</button></div></div>`,
        onMount(b, close) {
          b.querySelector("[data-no]").addEventListener("click", () => close());
          const ci = b.querySelector("[data-close-instead]");
          ci &&
            ci.addEventListener("click", () => {
              close(true);
              closeJob(id, after);
            });
        },
      });
      return;
    }
    const n = bidsFor(id).length || j.bids || 0,
      draft = j.status === "draft";
    confirm({
      title: draft ? "Delete this draft?" : "Delete this job?",
      mini: jobMini(j),
      yes: draft ? "Delete draft" : "Delete job",
      no: "Keep it",
      danger: true,
      bullets: [
        draft
          ? "The draft is removed. Creators never saw it."
          : `It disappears for creators${n ? `, and the ${n} bid${n === 1 ? "" : "s"} on it are withdrawn` : ""}.`,
        "This can’t be undone.",
        "Nothing is charged.",
      ],
      onYes() {
        if (L.live && !draft) {
          /* published briefs stay on record: they are closed, not erased */
          L.live.closeJob(id).then(
            () => {
              L.store.set(s => {
                const x = s.jobs.find(y => y.id === id);
                if (x) x.status = "closed";
              }, "job-closed");
              L.toast("Job closed and removed from creators' search", "check");
              after && after();
            },
            e => L.toast(L.live.errorText(e), "alert"),
          );
          return;
        }
        L.store.set(s => {
          s.jobs = s.jobs.filter(y => y.id !== id);
          s.bids = s.bids.filter(b => b.job !== id);
        }, "job-deleted");
        L.toast(draft ? "Draft deleted" : "Job deleted", "trash");
        after && after();
      },
    });
  }

  L.bk = {
    ui,
    mo,
    flip,
    todayISO,
    nowISO,
    addDays,
    daysTo,
    daysTxt,
    time,
    plat,
    glyph,
    where,
    job,
    camp,
    cr,
    first,
    bidsFor,
    campOfJob,
    cav,
    ver,
    crChip,
    pf,
    rating,
    nextInvoice,
    notify,
    JST,
    BST,
    pill,
    confirm,
    jobMini,
    closeJob,
    deleteJob,
    OPEN_BID,
  };

  /* ---------- #jobs ---------- */
  const TABS = [
    ["all", "All"],
    ["open", "Open"],
    ["drafts", "Drafts"],
    ["closed", "Closed"],
  ];
  const inTab = (j, t) =>
    t === "all" ||
    (t === "open" && j.status === "open") ||
    (t === "drafts" && j.status === "draft") ||
    (t === "closed" && (j.status === "closed" || j.status === "hired"));
  const GROUPS = [
    { key: "open", title: "Taking bids", has: j => j.status === "open" },
    { key: "drafts", title: "Drafts", has: j => j.status === "draft" },
    { key: "closed", title: "Hired and closed", has: j => j.status === "hired" || j.status === "closed" },
  ];

  /* rail: Drafted → Published → Bids in → Hired; a job closed without a hire ends on its own node */
  function rail(j) {
    const steps = ["Drafted", "Published", "Bids in", "Hired"];
    if (j.status === "closed" && !j.hired) {
      const reached = ["Drafted", "Published"].concat(j.bids ? ["Bids in"] : []);
      return `<ol class="jl-rail is-withdrawn" aria-label="Progress">${reached.map(t => `<li class="is-done"><span>${t}</span></li>`).join("")}<li class="is-end" aria-current="step"><span>Closed, no hire</span></li></ol>`;
    }
    const at = j.status === "draft" ? 0 : j.status === "open" ? (j.bids ? 2 : 1) : 3;
    const allDone = j.status === "closed";
    return `<ol class="jl-rail${allDone ? " is-all" : ""}" aria-label="Progress">${steps.map((t, i) => `<li class="${i < at || allDone ? "is-done" : i === at ? "is-now" : "is-next"}"${i === at ? ' aria-current="step"' : ""}><span>${t}</span></li>`).join("")}</ol>`;
  }

  function slip(j) {
    const listed = bidsFor(j.id),
      nNew = listed.filter(b => b.status === "new").length,
      nShort = listed.filter(b => b.status === "shortlisted").length;
    const c = S().campaigns.find(x => x.job === j.id),
      k = j.hired ? cr(j.hired) : c ? cr(c.creator) : null;
    const dl = daysTo(j.deadline),
      draft = j.status === "draft";
    let note = "";
    if (j.status === "open")
      note = j.bids
        ? `${j.bids} bid${j.bids === 1 ? "" : "s"} so far${nNew ? `, ${nNew} new` : ""}${nShort ? `, ${nShort} shortlisted` : ""}. Bids stay open until you hire or close the job.`
        : "Published. Creators who match will start bidding soon.";
    else if (draft) note = "Only you can see this. Publish it when the brief is ready.";
    else if (j.status === "hired")
      note = k
        ? `You hired ${k.name}. The work and payment live in Campaigns.`
        : "Hired. The work lives in Campaigns.";
    else note = k ? `Closed after hiring ${k.name}.` : "Closed without a hire.";
    const acts = [];
    if (j.status === "open") {
      acts.push(
        `<a class="lq lq-p lq-sm" href="#job-${esc(j.id)}">${j.bids ? `See ${j.bids} bid${j.bids === 1 ? "" : "s"}` : "Open job"}</a>`,
      );
      acts.push(`<a class="btn-q" href="#post-${esc(j.id)}">${ic("edit")}Edit</a>`);
      acts.push(`<button class="btn-q" type="button" data-close="${esc(j.id)}">Close job</button>`);
    } else if (draft) {
      acts.push(`<a class="lq lq-p lq-sm" href="#post-${esc(j.id)}">Continue editing</a>`);
      acts.push(`<a class="btn-q" href="#job-${esc(j.id)}">${ic("eye")}Preview</a>`);
      acts.push(`<button class="btn-q" type="button" data-del="${esc(j.id)}">${ic("trash")}Delete</button>`);
    } else {
      if (c)
        acts.push(
          `<a class="lq ${j.status === "hired" ? "lq-p" : "lq-s"} lq-sm" href="#campaign-${esc(c.id)}">Open campaign</a>`,
        );
      acts.push(`<a class="btn-q" href="#job-${esc(j.id)}">View job</a>`);
      if (j.status === "hired")
        acts.push(`<button class="btn-q" type="button" data-close="${esc(j.id)}">Close listing</button>`);
      if (!c)
        acts.push(
          `<button class="btn-q" type="button" data-del="${esc(j.id)}">${ic("trash")}Delete</button>`,
        );
    }
    const st =
      j.status === "open" && nNew
        ? `${pill(JST, "open")}<span class="pill pill-butter jl-new">${nNew} new</span>`
        : pill(JST, j.status);
    return `<article class="jl-slip is-${j.status}" data-id="${esc(j.id)}" aria-labelledby="jt-${esc(j.id)}">
      <div class="jl-stub">
        <p class="jl-stub-l">Budget</p>
        <p class="jl-price t-money">${L.inr(j.budget)}</p>
        <p class="jl-stub-d">${draft ? "Not posted yet" : "Posted " + esc(L.fmtDate(j.posted))}</p>
      </div>
      <div class="jl-body">
        <div class="jl-top"><span class="bk-plat">${glyph(j.platform)}<span>${esc(plat(j.platform))} ${esc(j.format)} · ${esc(j.category)}</span></span><span class="row jl-pills">${st}</span></div>
        <h3 class="jl-t" id="jt-${esc(j.id)}"><a href="#${draft ? "post" : "job"}-${esc(j.id)}">${esc(j.title)}</a></h3>
        <dl class="bk-meta jl-meta">
          <div><dt>Deadline</dt><dd>${esc(L.fmtDate(j.deadline))}${j.status === "open" || draft ? ` <span class="muted">· ${esc(daysTxt(dl))}</span>` : ""}</dd></div>
          <div><dt>Bids</dt><dd>${j.bids || 0}${nNew ? ` <span class="muted">· ${nNew} new</span>` : ""}</dd></div>
          <div class="jl-meta-w"><dt>Where</dt><dd>${esc(where(j))}</dd></div>
        </dl>
        ${rail(j)}
        <p class="jl-note">${esc(note)}</p>
        <div class="jl-acts">${acts.join("")}</div>
      </div>
    </article>`;
  }

  L.register("jobs", {
    title: "Jobs",
    nav: "jobs",
    render(el) {
      const u = ui("jobs");
      if (!TABS.some(t => t[0] === u.tab)) u.tab = "all";
      const count = t => S().jobs.filter(j => inTab(j, t)).length;
      const summary = () => {
        const n = t => count(t),
          nNew = S().bids.filter(b => b.status === "new" && (job(b.job) || {}).status === "open").length;
        return `${n("open")} open, ${n("drafts")} draft${n("drafts") === 1 ? "" : "s"}, ${n("closed")} hired or closed.${nNew ? ` ${nNew} new bid${nNew === 1 ? "" : "s"} to look at.` : ""}`;
      };
      const tabs = () =>
        TABS.map(
          ([k, n]) =>
            `<button class="chip" type="button" data-tab="${k}" aria-pressed="${u.tab === k}">${n} <span class="jl-cn">${count(k)}</span></button>`,
        ).join("");
      function board() {
        const all = S().jobs;
        if (!all.length)
          return `<div class="empty jl-empty"><img src="assets/step-01-envelope.svg" width="160" height="117" alt="">
          <p class="t-h2">No jobs yet.</p><p class="muted">Post a brief and creators who fit will bid on it. It takes about three minutes.</p><a class="lq lq-p" href="#post">Post a job</a></div>`;
        const list = all.filter(j => inTab(j, u.tab));
        if (!list.length) {
          const m = {
            open: ["No open jobs.", "Publish a draft or post a new brief to start getting bids."],
            drafts: ["No drafts.", "Save a job as a draft when the brief is not ready yet."],
            closed: ["Nothing closed yet.", "Jobs you hire on or close show up here."],
          }[u.tab];
          return `<div class="empty jl-empty"><p class="t-h2">${m[0]}</p><p class="muted">${m[1]}</p><div class="row wrap jl-empty-cta"><a class="lq lq-p" href="#post">Post a job</a><button class="lq lq-s" type="button" data-tab="all">Show all jobs</button></div></div>`;
        }
        const by = (a, b) =>
          (a.status === "draft" ? 0 : 1) - (b.status === "draft" ? 0 : 1) ||
          String(b.posted || "9").localeCompare(String(a.posted || "9")) ||
          a.deadline.localeCompare(b.deadline);
        return GROUPS.map(g => {
          const rows = list.filter(g.has).sort(by);
          if (!rows.length) return "";
          return `<section class="jl-group" aria-labelledby="jg-${g.key}"><h2 class="jl-gh" id="jg-${g.key}"><span class="t-h2">${g.title}</span><span class="jl-gn num">${rows.length}</span></h2>
            <div class="jl-list">${rows.map(slip).join("")}</div></section>`;
        }).join("");
      }
      el.innerHTML = `<div class="view-in jl">
        <header class="jl-head">
          <div class="jl-head-t"><h1 class="t-h1">Jobs</h1><p class="muted" id="jlSum">${esc(summary())} <span class="sample">Sample data</span></p></div>
          <a class="lq lq-p" href="#post">${ic("plus")}Post a job</a>
        </header>
        <div class="chips jl-filter" role="group" aria-label="Show jobs">${tabs()}</div>
        <p class="sr-only" id="jlLive" aria-live="polite"></p>
        <div class="jl-board" id="jlBoard">${board()}</div>
      </div>`;
      L.liquid(el);
      const $ = q => el.querySelector(q);
      const refresh = (animate, msg) => {
        const mutate = () => {
          $("#jlBoard").innerHTML = board();
          $(".jl-filter").innerHTML = tabs();
          $("#jlSum").innerHTML = `${esc(summary())} <span class="sample">Sample data</span>`;
          L.liquid($("#jlBoard"));
        };
        animate ? flip(mutate, () => L.$$(".jl-slip", el)) : mutate();
        if (msg) $("#jlLive").textContent = msg;
      };
      el.firstElementChild.addEventListener("click", e => {
        const t = e.target.closest("button");
        if (!t || !el.contains(t)) return;
        if (t.dataset.tab) {
          u.tab = t.dataset.tab;
          refresh(true, `Showing ${u.tab === "all" ? "all" : u.tab} jobs`);
          const same = el.querySelector(`.jl-filter [data-tab="${u.tab}"]`);
          same && same.focus();
        } else if (t.dataset.close) closeJob(t.dataset.close, () => refresh(true, "Job closed"));
        else if (t.dataset.del) deleteJob(t.dataset.del, () => refresh(true, "Job deleted"));
      });
      mo("stagger", L.$$(".jl-slip", el));
      if (u.justSaved) {
        const id = u.justSaved;
        u.justSaved = null;
        const n = el.querySelector(`.jl-slip[data-id="${id}"]`);
        if (n) {
          n.classList.add("is-new");
          requestAnimationFrame(() => {
            n.scrollIntoView({ block: "center", behavior: L.RM ? "auto" : "smooth" });
            mo("celebrate", n);
          });
        }
      }
    },
  });
})();
