// @ts-nocheck
/* Find Jobs (#jobs) and the shared brief-card kit (LLD.jobkit) used by Home, Job detail, Bid and My Bids.
   Owner: Builder B. Card classes are .jobs-*; styles in jobs.css. */
(() => {
  const L = window.LLD,
    esc = L.esc;
  const S = () => window.LLD_DATA;
  const UI_DEFAULT = {
    q: "",
    city: "",
    platform: "",
    category: "",
    minBudget: 0,
    sort: "match",
    savedOnly: false,
    showHidden: false,
  };
  const SS_KEY = "ll.jobsUI";

  /* ---------- state defaults (screens never assume data.js was extended) ---------- */
  function ensure() {
    const s = S();
    s.jobsUI = Object.assign({}, UI_DEFAULT, s.jobsUI || {});
    s.hiddenJobs = s.hiddenJobs || [];
    s.reports = s.reports || [];
    s.bidDrafts = s.bidDrafts || {};
    s.saved = s.saved || [];
    s.bidRules = Object.assign(
      { minPaise: 100000, overBudgetPct: 25, whyMin: 40, whyMax: 500, maxLinks: 5 },
      s.bidRules || {},
    );
    return s;
  }
  ensure();
  try {
    const raw = sessionStorage.getItem(SS_KEY);
    if (raw) Object.assign(S().jobsUI, JSON.parse(raw), { fromJob: null });
  } catch (e) {}
  const persistUI = () => {
    try {
      const { fromJob, scrollY, ...keep } = S().jobsUI;
      sessionStorage.setItem(SS_KEY, JSON.stringify(keep));
    } catch (e) {}
  };

  /* motion calls never break a screen */
  const mo = (fn, ...a) => {
    try {
      return L.motion[fn] && L.motion[fn](...a);
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

  /* ---------- lookups ---------- */
  const job = id => S().jobs.find(j => j.id === id) || null;
  const bidsFor = id =>
    S()
      .bids.filter(b => b.job === id)
      .sort((a, b) => L.D(b.sent) - L.D(a.sent));
  const LIVE = ["submitted", "viewed", "accepted", "completed", "rejected"]; // a bid in any of these blocks a new bid on the same job
  const openBid = id => bidsFor(id).find(b => LIVE.includes(b.status)) || null;
  const isSaved = id => S().saved.includes(id);
  const isHidden = id => S().hiddenJobs.includes(id);
  const platName = p => (p === "youtube" ? "YouTube" : "Instagram");
  const glyph = p => L.icon(p === "youtube" ? "yt" : "ig");
  const where = j => (j.remote ? "Any city · remote" : j.city);
  const todayISO = () => L.today().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const daysTxt = n => (n < 0 ? "passed" : n === 0 ? "today" : n === 1 ? "1 day left" : n + " days left");
  const daysShort = n => (n < 0 ? "passed" : n === 0 ? "today" : n === 1 ? "1 day" : n + " days");
  /* calendar days in IST from today (core daysLeft rounds part-days up) */
  const daysTo = iso =>
    Math.round(
      (new Date(String(iso).slice(0, 10) + "T12:00:00+05:30") - new Date(todayISO() + "T12:00:00+05:30")) /
        864e5,
    );
  const brandInitials = j => j.bi || L.initials(j.brand || "");

  const STATUS = {
    submitted: { label: "Submitted", pill: "pill-line", ic: "send" },
    viewed: { label: "Viewed", pill: "pill-info", ic: "eye" },
    accepted: { label: "Accepted", pill: "pill-ok", ic: "check" },
    rejected: { label: "Rejected", pill: "pill-err", ic: "alert" },
    withdrawn: { label: "Withdrawn", pill: "pill-paper", ic: "back" },
    completed: { label: "Completed", pill: "pill-butter", ic: "check" },
  };
  /* status pill with its icon; error pills always carry the alert icon */
  const pill = (status, label) => {
    const m = STATUS[status] || STATUS.submitted;
    return `<span class="pill ${m.pill}">${L.icon(m.ic)}${esc(label || m.label)}</span>`;
  };
  const openJobs = () => S().jobs.filter(j => j.status !== "hired"); // hired jobs live in Active jobs, not in discovery

  /* follower requirement like "Min 50K followers" -> 50000 */
  const minFollowers = j => {
    const m = /([\d.]+)\s*([KkLl])?/.exec(j.min || "");
    if (!m) return 0;
    const n = parseFloat(m[1]);
    return Math.round(n * (/[Kk]/.test(m[2] || "") ? 1e3 : /[Ll]/.test(m[2] || "") ? 1e5 : 1));
  };

  /* Best Match breakdown: the six things the ranking looks at, checked against the profile */
  function factors(j) {
    const me = S().me,
      pf = me.platforms[j.platform];
    const need = minFollowers(j),
      have = pf ? pf.followers : 0;
    const langs = j.languages.filter(l => me.languages.includes(l));
    const catHit =
      me.categories.includes(j.category) || (j.reasons || []).some(r => /lifestyle|beauty|overlap/i.test(r));
    const cityHit = j.remote || j.city === me.city;
    const geo = (me.audienceGeo || []).find(g => g[0] === j.city);
    const myBids = S().bids.filter(b => b.status !== "withdrawn");
    const avg = myBids.length
      ? Math.round(myBids.reduce((n, b) => n + b.price, 0) / myBids.length / 10000) * 10000
      : 0;
    const dl = daysTo(j.deadline);
    return [
      {
        k: "Platform",
        ok: !!pf && have >= need,
        txt: pf
          ? `${platName(j.platform)} ${L.compact(have)} · brand asks ${L.compact(need)}+`
          : `You have not added ${platName(j.platform)}`,
      },
      {
        k: "Category",
        ok: catHit,
        txt: me.categories.includes(j.category)
          ? `${j.category} is one of your niches`
          : catHit
            ? `${j.category}, close to your niches`
            : `${j.category} is outside your niches`,
      },
      { k: "Language", ok: langs.length > 0, txt: langs.length ? langs.join(" or ") : "No shared language" },
      {
        k: "City",
        ok: cityHit,
        txt: j.remote
          ? "Open to any city"
          : cityHit
            ? `${j.city}${geo ? `, ${geo[1]}% of your audience` : ""}`
            : `${j.city}${geo ? `, ${geo[1]}% of your audience` : ""}`,
      },
      {
        k: "Budget",
        ok: !avg || j.budget >= avg * 0.8,
        txt: avg ? `${L.inr(j.budget)} vs your average bid ${L.inr(avg)}` : L.inr(j.budget),
      },
      { k: "Deadline", ok: dl >= 7, txt: `${L.fmtDate(j.deadline)}, ${daysTxt(dl)}` },
    ];
  }

  /* match % chip with a 12px ring that fills to the score once (CSS, see .jobs-ring) */
  const pct = m =>
    `<span class="jobs-pct" style="--m:${Number(m) || 0}"><svg class="jobs-ring" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" pathLength="100"/><circle class="jobs-ring-v" cx="8" cy="8" r="6" pathLength="100" style="stroke-dashoffset:${100 - (Number(m) || 0)}"/></svg><b>${Number(m) || 0}%</b> match</span>`;

  /* ---------- the brief card ---------- */
  function brandChip(j) {
    return `<span class="jobs-brand"><span class="jobs-bi" aria-hidden="true">${esc(brandInitials(j))}</span><span class="jobs-bn">${esc(j.brand)}</span></span>`;
  }
  function card(j, o = {}) {
    const feat = o.variant === "feature";
    const saved = isSaved(j.id),
      mine = openBid(j.id),
      dl = daysTo(j.deadline);
    const reasons = (j.reasons || []).slice(0, feat ? 3 : 2);
    const tid = `jc-${o.ctx || "x"}-${j.id}`;
    return `<article class="jobs-card${feat ? " jobs-card--feature" : ""}${saved ? " is-saved" : ""}" data-id="${esc(j.id)}" aria-labelledby="${tid}">
      <div class="jobs-card-top">
        ${brandChip(j)}
        <span class="jobs-plat">${glyph(j.platform)}<span>${esc(platName(j.platform))} ${esc(j.format)}</span></span>
      </div>
      <h3 class="jobs-card-t" id="${tid}"><a class="jobs-card-link" href="#job-${esc(j.id)}">${esc(j.title)}</a></h3>
      <p class="jobs-cat">${esc(j.category)}${mine ? ` · ${pill(mine.status, "You bid · " + STATUS[mine.status].label)}` : ""}</p>
      <div class="jobs-money">
        ${feat ? '<p class="jobs-mlab">Budget</p>' : ""}
        <p class="jobs-price t-money">${L.inr(j.budget)}</p>
        <p class="jobs-loc">${L.icon("pin")}<span>${esc(where(j))}</span></p>
        ${feat ? `<p class="jobs-net">Bid the budget and you receive <b>${L.inr(L.payout(j.budget).net)}</b>, the agreed price. <span>Tax as per confirmed rules.</span></p>` : ""}
      </div>
      <dl class="jobs-meta">
        <div><dt>Deadline</dt><dd>${esc(L.fmtDate(j.deadline))} <span class="muted">· ${esc(daysShort(dl))}</span></dd></div>
        <div><dt>Bids</dt><dd>${j.bids}</dd></div>
      </dl>
      <div class="jobs-match">
        ${pct(j.match)}
        <ul class="jobs-why" aria-label="Why it matches">${reasons.map(r => `<li>${esc(r)}</li>`).join("")}</ul>
      </div>
      <div class="jobs-acts">
        ${feat && !mine ? `<button class="lq lq-p lq-sm jobs-bid" type="button" data-bid="${esc(j.id)}">Bid on this</button>` : ""}
        <span class="jobs-acts-grow"></span>
        <button class="ibtn jobs-save" type="button" aria-pressed="${saved}" aria-label="${saved ? "Saved" : "Save"}: ${esc(j.title)}" title="Save (or swipe right)">${L.icon("bookmark")}</button>
        <button class="ibtn jobs-hide" type="button" aria-label="Hide: ${esc(j.title)}" title="Hide (or swipe left)">${L.icon("close")}</button>
      </div>
    </article>`;
  }

  /* ---------- save / hide ---------- */
  function setSaved(id, on) {
    L.store.set(s => {
      s.saved = s.saved.filter(x => x !== id);
      if (on) s.saved.push(id);
    }, "job-save");
    L.live && L.live.saveJobs(S().saved, S().hiddenJobs);
  }
  function syncSaveButtons(root, id) {
    const on = isSaved(id),
      j = job(id);
    L.$$(`.jobs-card[data-id="${id}"]`, root).forEach(c => {
      c.classList.toggle("is-saved", on);
      const b = c.querySelector(".jobs-save");
      if (b) {
        b.setAttribute("aria-pressed", on);
        b.setAttribute("aria-label", `${on ? "Saved" : "Save"}: ${j ? j.title : ""}`);
        stitch(b, on);
      }
    });
  }
  /* the bookmark is sewn shut when saved: dashed stroke closes, then fills (CSS .is-stitch) */
  function stitch(btn, on) {
    if (!btn) return;
    btn.classList.remove("is-stitch");
    if (!on || L.RM) return;
    void btn.offsetWidth;
    btn.classList.add("is-stitch");
    const off = () => {
      btn.classList.remove("is-stitch");
      btn.removeEventListener("animationend", off);
    };
    btn.addEventListener("animationend", off);
    setTimeout(off, 900);
  }
  /* a chosen filter chip lands with a slight overshoot (CSS .is-settle, translate only so the global press scale stays free) */
  function settle(btn) {
    if (!btn || L.RM) return;
    btn.classList.remove("is-settle");
    void btn.offsetWidth;
    btn.classList.add("is-settle");
    const off = () => {
      btn.classList.remove("is-settle");
      btn.removeEventListener("animationend", off);
    };
    btn.addEventListener("animationend", off);
    setTimeout(off, 700);
  }
  function toggleSave(id, root, force) {
    const on = force === undefined ? !isSaved(id) : force;
    setSaved(id, on);
    syncSaveButtons(root || document, id);
    L.toast(on ? "Saved to your list" : "Removed from saved", on ? "bookmark" : "close");
    return on;
  }
  function setHidden(id, on) {
    L.store.set(s => {
      s.hiddenJobs = s.hiddenJobs.filter(x => x !== id);
      if (on) s.hiddenJobs.push(id);
    }, "job-hide");
    L.live && L.live.saveJobs(S().saved, S().hiddenJobs);
  }

  /* wire every card inside root: buttons, swipe (right = save, left = hide), press, keyboard shortcuts */
  function wire(root, { onHide, onSave } = {}) {
    const detach = [];
    const onClick = e => {
      const c = e.target.closest(".jobs-card");
      if (!c) return;
      const id = c.dataset.id;
      if (e.target.closest(".jobs-save")) {
        e.preventDefault();
        const on = toggleSave(id, root);
        onSave && onSave(id, on, c);
      } else if (e.target.closest(".jobs-hide")) {
        e.preventDefault();
        setHidden(id, true);
        onHide && onHide(id, c);
      } else if (e.target.closest("[data-bid]")) {
        e.preventDefault();
        L.kycGate(id);
      }
    };
    root.addEventListener("click", onClick);
    const attach = c => {
      if (c.dataset.wired) return;
      c.dataset.wired = "1";
      const id = c.dataset.id;
      const off = mo("swipe", c, {
        rightLabel: "Save",
        leftLabel: "Hide",
        rightIcon: "bookmark",
        leftIcon: "close",
        rightTone: "butter",
        leftTone: "ink",
        hint: c === root.querySelector(".jobs-card"),
        onRight: () => {
          const on = toggleSave(id, root, true);
          onSave && onSave(id, on, c);
        },
        onLeft: () => {
          setHidden(id, true);
          onHide && onHide(id, c);
        },
      });
      if (typeof off === "function") detach.push(off);
      mo("press", c);
    };
    L.$$(".jobs-card", root).forEach(attach);
    return {
      attach,
      cleanup: () => {
        root.removeEventListener("click", onClick);
        detach.forEach(f => {
          try {
            f();
          } catch (e) {}
        });
      },
    };
  }

  /* ---------- filtering ---------- */
  const BUDGETS = [0, 500000, 1000000, 2000000, 4000000];
  const CITIES = [
    "Ahmedabad","Amritsar","Aurangabad","Bangalore","Bhopal","Chandigarh",
    "Chennai","Coimbatore","Delhi","Faridabad","Ghaziabad","Guwahati",
    "Gwalior","Howrah","Hyderabad","Indore","Jaipur","Jodhpur","Kanpur",
    "Kochi","Kolkata","Kota","Lucknow","Ludhiana","Madurai","Meerut",
    "Mumbai","Mysore","Nagpur","Nashik","Navi Mumbai","Noida","Patna",
    "Pune","Raipur","Rajkot","Ranchi","Surat","Thiruvananthapuram",
    "Tiruchirappalli","Vadodara","Varanasi","Vijayawada","Visakhapatnam",
  ];
  const SORTS = {
    match: "Best match",
    budget: "Highest budget",
    deadline: "Deadline soonest",
    newest: "Newest",
    bids: "Fewest bids",
  };
  function filtered(ui) {
    const q = ui.q.trim().toLowerCase();
    let list = openJobs().filter(
      j =>
        (!q ||
          [j.title, j.brand, j.category, j.city, j.format, platName(j.platform)]
            .join(" ")
            .toLowerCase()
            .includes(q)) &&
        (!ui.city || (ui.city === "remote" ? j.remote : j.city === ui.city)) &&
        (!ui.platform || j.platform === ui.platform) &&
        (!ui.category || j.category === ui.category) &&
        (!ui.minBudget || j.budget >= ui.minBudget) &&
        (!ui.savedOnly || isSaved(j.id)),
    );
    const hiddenCount = list.filter(j => isHidden(j.id)).length;
    if (!ui.showHidden) list = list.filter(j => !isHidden(j.id));
    const by =
      {
        match: (a, b) => b.match - a.match,
        budget: (a, b) => b.budget - a.budget,
        deadline: (a, b) => (a.deadline > b.deadline ? 1 : -1),
        newest: (a, b) => (b.posted > a.posted ? 1 : -1),
        bids: (a, b) => a.bids - b.bids,
      }[ui.sort] || ((a, b) => b.match - a.match);
    return { list: list.sort(by), hiddenCount };
  }
  const activeCount = ui =>
    ["q", "city", "platform", "category", "minBudget", "savedOnly"].filter(
      k => !!(typeof ui[k] === "string" ? ui[k].trim() : ui[k]),
    ).length;
  const budgetLabel = p => (p ? L.inr(p) + "+" : "Any");

  L.jobkit = {
    ensure,
    job,
    openJobs,
    pill,
    pct,
    stitch,
    settle,
    bidsFor,
    openBid,
    isSaved,
    isHidden,
    platName,
    glyph,
    where,
    todayISO,
    daysTxt,
    daysShort,
    daysTo,
    STATUS,
    factors,
    minFollowers,
    brandChip,
    card,
    wire,
    toggleSave,
    setHidden,
    mo,
    flip,
    persistUI,
  };

  /* ---------- #jobs ---------- */
  L.register("jobs", {
    title: "Find jobs",
    nav: "jobs",
    render(el) {
      const s = ensure(),
        ui = s.jobsUI;
      const pool = openJobs();
      const jobCities = pool.filter(j => !j.remote).map(j => j.city).filter(Boolean);
      const cities = [...new Set([...CITIES, ...jobCities])].sort();
      const cats = [...new Set(pool.map(j => j.category))].filter(Boolean).sort();
      const open = pool.length;
      el.innerHTML = `<div class="view-in jobs">
        <header class="jobs-head">
          <div class="jobs-head-t">
            <h1 class="t-h1">Find jobs</h1>
            <p class="muted">${open} brands want creators this week. <span class="sample">Sample data</span></p>
          </div>
          <div class="jobs-toolbar">
            <div class="jobs-filterbar" role="group" aria-label="Filters">
              <select class="select jobs-fsel" id="jobsCity" aria-label="City"><option value="">All cities</option>${cities.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join("")}<option value="remote">Remote</option></select>
              <div class="seg jobs-seg" role="group" aria-label="Platform">
                <button type="button" data-plat="">All</button><button type="button" data-plat="instagram">${L.icon("ig")}Instagram</button><button type="button" data-plat="youtube">${L.icon("yt")}YouTube</button>
              </div>
              <div class="jobs-fb-break" aria-hidden="true"></div>
              ${cats.length ? `<div class="jobs-chips-wrap" role="group" aria-label="Category">${cats.map(c => `<button class="chip" type="button" data-cat="${esc(c)}">${esc(c)}</button>`).join("")}</div>` : ""}
              <div class="jobs-chips-wrap" role="group" aria-label="Minimum budget">${BUDGETS.map(b => `<button class="chip" type="button" data-min="${b}">${budgetLabel(b)}</button>`).join("")}</div>
              <label class="chip jobs-saved-chip" title="Saved jobs only"><input type="checkbox" id="jobsSaved" class="sr-only"><span>${L.icon("bookmark")}Saved</span></label>
              <button class="btn-q jobs-clear" type="button" data-clear>Clear</button>
            </div>
            <div class="jobs-search">
              <label class="sr-only" for="jobsQ">Search jobs</label>
              ${L.icon("search")}
              <input class="input" id="jobsQ" type="search" autocomplete="off" placeholder="Search brand, product, city" value="${esc(ui.q)}">
            </div>
          </div>
        </header>
        <section class="jobs-results" aria-label="Jobs">
          <div class="jobs-bar">
            <p class="jobs-count" id="jobsCount" aria-live="polite"></p>
            <div class="jobs-sort"><label class="sr-only" for="jobsSort">Sort jobs</label>
              <select class="select" id="jobsSort">${Object.entries(SORTS)
                .map(([k, v]) => `<option value="${k}">${v}</option>`)
                .join("")}</select></div>
          </div>
          <p class="jobs-live help">${L.icon("info")}Bid counts are live and leave out withdrawn bids.</p>
          <p class="jobs-offline" role="status" hidden>${L.icon("alert")}You are offline. These are the jobs from your last visit.</p>
          <div class="jobs-list" id="jobsList">${pool.map(j => card(j, { ctx: "list" })).join("")}</div>
          <div class="empty jobs-empty" hidden>
            <img src="assets/step-01-envelope.svg" width="160" height="117" alt="">
            <p class="t-h2">No briefs match that.</p>
            <p class="muted">Try a lower minimum budget or another city.</p>
            <button class="lq lq-p" type="button" data-clear>Clear filters</button>
          </div>
          <p class="jobs-hidden-line" aria-live="polite"></p>
        </section>
      </div>`;

      L.liquid(el);
      const $ = sel => el.querySelector(sel);
      const list = $("#jobsList");
      const cards = new Map(L.$$(".jobs-card", list).map(c => [c.dataset.id, c]));
      const wired = wire(list, {
        onHide: id => {
          apply();
          hiddenNote(id);
        },
        onSave: () => {
          if (ui.savedOnly) apply();
        },
      });

      function syncControls() {
        $("#jobsQ").value = ui.q;
        $("#jobsCity").value = ui.city;
        L.$$("[data-plat]", el).forEach(b =>
          b.setAttribute("aria-pressed", String(b.dataset.plat === ui.platform)),
        );
        L.$$("[data-cat]", el).forEach(b =>
          b.setAttribute("aria-pressed", String(b.dataset.cat === ui.category)),
        );
        L.$$("[data-min]", el).forEach(b =>
          b.setAttribute("aria-pressed", String(+b.dataset.min === ui.minBudget)),
        );
        $("#jobsSaved").checked = !!ui.savedOnly;
        $("#jobsSort").value = ui.sort;
        const n = activeCount(ui);
        L.$$(".jobs-clear", el).forEach(b => {
          b.textContent = n ? `Clear (${n})` : "Clear";
          b.setAttribute("aria-disabled", String(!n));
        });
        const ft = $(".jobs-ftoggle");
        if (ft) {
          const lab = n ? `Filters · ${n}` : "Filters";
          ft.querySelectorAll(".t,.t2").forEach(x => (x.textContent = lab));
        }
      }
      function apply(animate = true) {
        const { list: vis, hiddenCount } = filtered(ui);
        const ids = vis.map(j => j.id);
        const mutate = () => {
          cards.forEach((c, id) => {
            c.hidden = !ids.includes(id);
            c.classList.toggle("is-hidden-job", isHidden(id));
          });
          ids.forEach(id => list.append(cards.get(id)));
        };
        animate ? flip(mutate, [...cards.values()]) : mutate();
        $("#jobsCount").innerHTML =
          `<b>${ids.length}</b> of ${open} briefs${ui.sort !== "match" ? ` · ${esc(SORTS[ui.sort])}` : " · Best match first"}`;
        $(".jobs-empty").hidden = ids.length > 0;
        list.hidden = !ids.length;
        const hl = $(".jobs-hidden-line");
        hl.innerHTML = hiddenCount
          ? `${hiddenCount} hidden ${hiddenCount === 1 ? "job" : "jobs"} · <button class="btn-q" type="button" data-showhidden>${ui.showHidden ? "Hide them again" : "Show"}</button>`
          : "";
        syncControls();
        persistUI();
      }
      function hiddenNote(id) {
        const j = job(id);
        const hl = $(".jobs-hidden-line");
        hl.innerHTML = `Hidden “${esc(j.title)}”. <button class="btn-q" type="button" data-undo="${esc(id)}">Undo</button>`;
      }
      const set = (k, v) => {
        ui[k] = v;
        apply();
      };

      let qT = 0;
      $("#jobsQ").addEventListener("input", e => {
        clearTimeout(qT);
        const v = e.target.value;
        qT = setTimeout(() => set("q", v), 140);
      });
      $("#jobsCity").addEventListener("change", e => set("city", e.target.value));
      $("#jobsSort").addEventListener("change", e => set("sort", e.target.value));
      $("#jobsSaved").addEventListener("change", e => set("savedOnly", e.target.checked));
      el.firstElementChild.addEventListener("click", e => {
        // on this render's root, not the shared #view outlet
        const t = e.target.closest("button");
        if (!t || !el.contains(t)) return;
        if (t.dataset.plat !== undefined) {
          set("platform", t.dataset.plat);
          settle(t);
        } else if (t.dataset.cat !== undefined) {
          set("category", ui.category === t.dataset.cat ? "" : t.dataset.cat);
          if (ui.category) settle(t);
        } else if (t.dataset.min !== undefined) {
          set("minBudget", +t.dataset.min);
          settle(t);
        } else if (t.hasAttribute("data-clear")) {
          if (!activeCount(ui)) return;
          Object.assign(ui, { q: "", city: "", platform: "", category: "", minBudget: 0, savedOnly: false });
          apply();
          L.toast("Filters cleared", "filter");
          $("#jobsQ").focus();
        } else if (t.hasAttribute("data-showhidden")) set("showHidden", !ui.showHidden);
        else if (t.dataset.undo) {
          setHidden(t.dataset.undo, false);
          apply();
          $(".jobs-hidden-line").textContent = "Back in your list.";
        } else if (t.classList.contains("jobs-ftoggle")) {
          const f = $("#jobsFilters"),
            on = !f.classList.contains("is-open");
          f.classList.toggle("is-open", on);
          t.setAttribute("aria-expanded", String(on));
        }
      });
      // keyboard shortcuts on a focused card: S saves, H hides
      list.addEventListener("keydown", e => {
        const c = e.target.closest(".jobs-card");
        if (!c || e.altKey || e.ctrlKey || e.metaKey) return;
        if (e.key === "s" || e.key === "S") {
          e.preventDefault();
          toggleSave(c.dataset.id, list);
        }
        if (e.key === "h" || e.key === "H") {
          e.preventDefault();
          setHidden(c.dataset.id, true);
          apply();
          hiddenNote(c.dataset.id);
        }
      });
      // network loss message
      const off = () => {
        $(".jobs-offline").hidden = navigator.onLine;
      };
      addEventListener("online", off);
      addEventListener("offline", off);
      off();

      apply(false);
      mo("stagger", L.$$(".jobs-card:not([hidden])", list));

      // coming back from a job: restore scroll and focus that card
      if (ui.fromJob) {
        const back = ui.fromJob,
          y = ui.scrollY || 0;
        ui.fromJob = null;
        requestAnimationFrame(() =>
          setTimeout(() => {
            window.scrollTo({ top: y, behavior: "auto" });
            const a = list.querySelector(`.jobs-card[data-id="${back}"] .jobs-card-link`);
            a && a.focus({ preventScroll: true });
          }, 30),
        );
      }
      const onScroll = () => {
        ui.scrollY = window.scrollY;
      };
      addEventListener("scroll", onScroll, { passive: true });

      return () => {
        wired.cleanup();
        removeEventListener("online", off);
        removeEventListener("offline", off);
        removeEventListener("scroll", onScroll);
        clearTimeout(qT);
      };
    },
  });
})();
