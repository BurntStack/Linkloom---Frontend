// @ts-nocheck
/* Job detail (#job-<id>): full brief, why it matches, save/share/report, sticky Bid through LLD.kycGate.
   Owner: Builder B. Uses LLD.jobkit from jobs.js. */
(() => {
  const L = window.LLD,
    esc = L.esc;
  const REPORT_REASONS = [
    "Pay looks misleading",
    "Asks to pay or chat outside Linkloom",
    "Inappropriate or unsafe content",
    "Spam or a duplicate brief",
    "Something else",
  ];

  L.register("job", {
    title: id => {
      const j = L.jobkit && L.jobkit.job(id);
      return j ? j.title : "Job";
    },
    crumb: id => {
      const j = L.jobkit && L.jobkit.job(id);
      return `<a href="#jobs">Find jobs</a> / ${j ? L.esc(j.title) : "Brief"}`;
    },
    nav: "jobs",
    render: function render(el, id) {
      const K = L.jobkit,
        s = K.ensure(),
        j = K.job(id);
      if (!j && L.live && !L.live.guest && !render.tried?.[id]) {
        /* a link to a brief that isn't in the open list (closed, or opened from a notification) */
        (render.tried = render.tried || {})[id] = true;
        el.innerHTML = `<div class="view-in"><div class="empty" role="status"><p class="t-h2">Loading the brief…</p></div></div>`;
        L.live.fetchJob(id).then(
          () => L.current()?.name === "job" && L.route(),
          () => L.current()?.name === "job" && L.route(),
        );
        return;
      }
      if (!j) {
        el.innerHTML = `<div class="view-in"><div class="empty">
          <img src="assets/step-01-envelope.svg" width="160" height="117" alt="">
          <p class="t-h2">This brief is no longer open.</p><p class="muted">The brand may have closed it or picked a creator.</p>
          <a class="lq lq-p" href="#jobs">See open jobs</a></div></div>`;
        return;
      }
      const dl = K.daysTo(j.deadline),
        bid = K.openBid(j.id);
      const prev = K.bidsFor(j.id).find(b => b.status === "withdrawn");
      const fac = K.factors(j);
      const pay = L.payout(j.budget);
      const verified = s.kyc.status === "verified";
      const reported = s.reports.some(r => r.job === j.id);

      const act = bid && bid.status === "accepted" ? s.active.find(a => a.job === j.id) : null;
      const mineHref = act ? "#work-" + act.id : "#bids";
      const mineLabel = act ? "Open active job" : "See it in My Bids";
      const bidBlock = bid
        ? `<div class="job-mine">
             <p class="row wrap">${K.pill(bid.status)}<span class="t-small">You bid <b class="num">${L.inr(bid.price)}</b> on ${esc(L.fmtDate(bid.sent))}</span></p>
             <p class="help">${esc(j.status === "hired" ? "You are hired on this job. Work and chat live in Active jobs." : bid.note || "")}</p>
             <a class="lq lq-p job-bid-btn" href="${esc(mineHref)}">${mineLabel}</a>
           </div>`
        : `${prev ? `<p class="help job-prev">You withdrew a ${L.inr(prev.price)} bid. You can bid again.</p>` : ""}
           <button class="lq lq-p job-bid-btn" type="button" data-bidnow>Bid on this job</button>
           <p class="job-kyc help">${L.icon(verified ? "check" : "shield")}${verified ? "ID verified. You can send bids." : "ID is checked once, at your first bid. Brands never see it."}</p>`;

      el.innerHTML = `<div class="view-in job">
        <a class="btn-q job-back" href="#jobs">${L.icon("back")}All jobs</a>
        <div class="job-layout">
          <article class="job-main" aria-labelledby="jobH">
            <header class="job-h">
              <div class="job-src">${K.brandChip(j)}<span class="jobs-plat">${K.glyph(j.platform)}<span>${esc(K.platName(j.platform))} ${esc(j.format)} · ${esc(j.category)}</span></span></div>
              <h1 class="t-h1" id="jobH">${esc(j.title)}</h1>
              <p class="muted t-small">Posted ${esc(L.ago(j.posted))} · <span class="sample">Sample brief</span></p>
              <div class="job-tools" role="group" aria-label="Job actions">
                <button class="chip job-save" type="button" aria-pressed="${K.isSaved(j.id)}">${L.icon("bookmark")}<span>${K.isSaved(j.id) ? "Saved" : "Save"}</span></button>
                <button class="chip job-share" type="button">${L.icon("link")}<span>Share</span></button>
                <button class="chip job-report" type="button" ${reported ? 'aria-disabled="true"' : ""}>${L.icon("flag")}<span>${reported ? "Reported" : "Report"}</span></button>
              </div>
            </header>

            <section class="job-sec" aria-labelledby="jobBriefH">
              <h2 class="t-eyebrow muted" id="jobBriefH">The brief</h2>
              <p class="job-brief">${esc(j.brief)}</p>
            </section>

            <section class="job-sec" aria-labelledby="jobDelH">
              <h2 class="t-eyebrow muted" id="jobDelH">Deliverables</h2>
              <ol class="job-dels">${j.deliverables.map((d, i) => `<li><span class="job-n">${String(i + 1).padStart(2, "0")}</span><span>${esc(d)}</span></li>`).join("")}</ol>
            </section>

            <section class="job-sec" aria-labelledby="jobReqH">
              <h2 class="t-eyebrow muted" id="jobReqH">Requirements</h2>
              <dl class="job-kv">
                <div class="kv"><dt>Audience</dt><dd>${esc(j.min)}</dd></div>
                <div class="kv"><dt>Languages</dt><dd>${esc(j.languages.join(", "))}</dd></div>
                <div class="kv"><dt>Location</dt><dd>${esc(j.remote ? "Any city, shoot from home" : j.city + ", shoot in the city")}</dd></div>
                <div class="kv"><dt>Usage rights</dt><dd>${esc(j.usage)}</dd></div>
                <div class="kv"><dt>Post by</dt><dd>${esc(L.fmtDate(j.deadline, { year: true }))} · ${esc(K.daysTxt(dl))}</dd></div>
              </dl>
            </section>

            <section class="job-sec" aria-labelledby="jobFitH">
              <div class="row between wrap"><h2 class="t-eyebrow muted" id="jobFitH">Why it is a match</h2>${K.pct(j.match)}</div>
              <ul class="job-fit">${fac.map(f => `<li class="${f.ok ? "is-ok" : "is-no"}"><span class="job-fit-i" aria-hidden="true">${L.icon(f.ok ? "check" : "minus")}</span><span class="job-fit-k">${esc(f.k)}</span><span class="job-fit-v">${esc(f.txt)}</span><span class="sr-only">${f.ok ? "fits" : "does not fit"}</span></li>`).join("")}</ul>
            </section>
          </article>

          <aside class="job-side" aria-label="Budget and bid">
            <div class="job-deal card">
              <p class="job-lab">Budget</p>
              <p class="t-money job-budget" data-budget>${L.inr(j.budget)}</p>
              <p class="jobs-loc">${L.icon("pin")}<span>${esc(K.where(j))}</span></p>
              <dl class="jobs-meta">
                <div><dt>Deadline</dt><dd>${esc(L.fmtDate(j.deadline))}</dd></div>
                <div><dt>Bids so far</dt><dd>${j.bids}</dd></div>
              </dl>
              <p class="help">Live count. Withdrawn bids are not included.</p>
              <p class="job-payline">Bid the full budget and you receive <b class="num">${L.inr(pay.net)}</b>, the agreed price. <span class="muted">Tax as per confirmed rules.</span></p>
              ${bidBlock}
            </div>
          </aside>
        </div>
        <div class="job-sticky dark" role="region" aria-label="Bid on this job">
          <div class="job-sticky-t"><p class="t-money">${L.inr(j.budget)}</p><p class="jobs-loc">${L.icon("pin")}<span>${esc(K.where(j))}</span></p></div>
          ${bid ? `<a class="lq lq-p" href="${esc(mineHref)}">${mineLabel}</a>` : `<button class="lq lq-p" type="button" data-bidnow>Bid on this job</button>`}
        </div>
      </div>`;
      L.liquid(el);

      const $ = q => el.querySelector(q);
      const onClick = e => {
        const t = e.target.closest("button");
        if (!t || !el.contains(t)) return;
        if (t.hasAttribute("data-bidnow")) {
          K.mo("press", t);
          L.kycGate(j.id);
        } else if (t.classList.contains("job-save")) {
          const on = K.toggleSave(j.id, el);
          t.setAttribute("aria-pressed", String(on));
          t.querySelector("span").textContent = on ? "Saved" : "Save";
          K.stitch && K.stitch(t, on);
        } else if (t.classList.contains("job-share")) share(t);
        else if (t.classList.contains("job-report")) {
          if (t.getAttribute("aria-disabled") !== "true") report(t);
        }
      };
      el.addEventListener("click", onClick);
      K.mo("count", $("[data-budget]"), j.budget, L.inr);
      K.mo("stagger", L.$$(".job-sec, .job-deal", el));

      async function share(btn) {
        const url = location.href.split("#")[0] + "#job-" + j.id;
        try {
          if (navigator.share) {
            await navigator.share({ title: j.title, text: `${j.brand} is hiring on Linkloom`, url });
            return;
          }
        } catch (e) {
          if (e && e.name === "AbortError") return;
        }
        try {
          await navigator.clipboard.writeText(url);
          L.toast("Link copied");
          return;
        } catch (e) {}
        L.openSheet({
          title: "Share this brief",
          body: `<div class="stack"><p class="muted">Copy the link and send it to a creator friend.</p>
            <div class="field"><label for="jobShareUrl">Link to this brief</label><input class="input" id="jobShareUrl" readonly value="${esc(url)}"></div>
            <button class="lq lq-p" type="button" data-copy>Select link</button></div>`,
          onMount(b) {
            const i = b.querySelector("#jobShareUrl");
            b.querySelector("[data-copy]").addEventListener("click", () => {
              i.focus();
              i.select();
              L.toast("Link selected. Copy it with your keyboard or long-press.", "link");
            });
          },
        });
      }

      function report(btn) {
        L.openSheet({
          title: "Report this brief",
          body: `<form class="stack job-rep" novalidate>
            <p class="muted">Tell us what is wrong. The brand will not see who reported it.</p>
            <fieldset class="job-rep-set"><legend class="t-label">What is the problem?</legend>
              ${REPORT_REASONS.map(r => `<label class="check"><input type="radio" name="reason" value="${esc(r)}"> ${esc(r)}</label>`).join("")}
            </fieldset>
            <div class="field"><label for="jobRepTx">Anything else? (optional)</label><textarea class="textarea" id="jobRepTx" maxlength="300" placeholder="For example: they asked for my number in the brief"></textarea></div>
            <p class="err" id="jobRepErr" aria-live="polite"></p>
            <div class="row wrap"><button class="lq lq-p" type="submit">Send report</button><button class="lq lq-s" type="button" data-cancel>Cancel</button></div>
          </form>`,
          onMount(b, close) {
            const f = b.querySelector("form");
            b.querySelector("[data-cancel]").addEventListener("click", () => close());
            f.addEventListener("submit", e => {
              e.preventDefault();
              const r = f.querySelector("input[name=reason]:checked");
              if (!r) {
                b.querySelector("#jobRepErr").textContent = "Pick what the problem is.";
                f.querySelector("input[name=reason]").focus();
                return;
              }
              L.store.set(st => {
                st.reports.push({
                  job: j.id,
                  reason: r.value,
                  text: b.querySelector("#jobRepTx").value.trim(),
                  at: new Date().toISOString(),
                });
              }, "job-report");
              /* No report endpoint on the server yet: the report goes to the trust team by email. */
              if (L.live) {
                const body = `Brief: ${j.title} (${j.id})\nBrand: ${j.brand}\nReason: ${r.value}\n\n${b.querySelector("#jobRepTx").value.trim()}`;
                window.open(`mailto:support@linkloom.in?subject=${encodeURIComponent("Report a brief: " + j.title)}&body=${encodeURIComponent(body)}`, "_blank");
              }
              close();
              btn.setAttribute("aria-disabled", "true");
              btn.querySelector("span").textContent = "Reported";
              L.toast("Report sent. Our team will look at it.", "flag");
            });
          },
        });
      }

      return () => {
        el.removeEventListener("click", onClick);
        // the jobs list restores scroll and focus only when we go straight back to it
        s.jobsUI.fromJob = location.hash === "#jobs" ? j.id : null;
      };
    },
  });
})();
