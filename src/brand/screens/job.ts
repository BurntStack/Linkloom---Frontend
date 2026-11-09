// @ts-nocheck
/* Brand side · One job (#job-<id>): the brief, then the bids received. Builder C.
   Mirrors the creator job page (main column + sticky deal card). Flow a–c: view bids → shortlist / decline / compare up to 3 →
   Confirm creator (creates a campaign at stage 'accepted') → LLD.payEscrow opens the pay sheet. */
(() => {
  const L = window.LLD,
    esc = L.esc,
    ic = L.icon;
  const S = () => window.LLD_DATA;
  const SORTS = {
    newest: "Newest first",
    low: "Price, low to high",
    high: "Price, high to low",
    reach: "Most followers",
    rating: "Highest rated",
    soon: "Earliest post date",
  };
  const FILTERS = ["new", "viewed", "shortlisted", "declined"];
  const MAXCMP = 3;

  L.register("job", {
    title: id => {
      const j = L.bk && L.bk.job(id);
      return j ? j.title : "Job";
    },
    crumb: id => {
      const j = L.bk && L.bk.job(id);
      return `<a href="#jobs">Jobs</a> / ${j ? esc(j.title) : "Job"}`;
    },
    nav: "jobs",
    render(el, id) {
      const K = L.bk,
        j = K.job(id);
      if (!j) {
        el.innerHTML = `<div class="view-in"><div class="empty"><img src="assets/step-01-envelope.svg" width="160" height="117" alt="">
          <p class="t-h2">This job is gone.</p><p class="muted">It may have been deleted. Your other jobs are safe.</p><a class="lq lq-p" href="#jobs">See all jobs</a></div></div>`;
        return;
      }
      const u = K.ui("job");
      u.sort = SORTS[u.sort] ? u.sort : "newest";
      u.f = u.f || "";
      u.cmp = u.cmp || {};
      const cmp = () =>
        (u.cmp[j.id] = (u.cmp[j.id] || []).filter(b =>
          S().bids.some(x => x.id === b && x.status !== "declined"),
        ));
      const bids = () => K.bidsFor(j.id);
      const canHire = () => j.status === "open";

      function fol(c) {
        const p = K.pf(c, j.platform);
        return p ? p.followers : 0;
      }
      function sorted(list) {
        const by = {
          newest: (a, b) => L.D(b.sent) - L.D(a.sent),
          low: (a, b) => a.price - b.price,
          high: (a, b) => b.price - a.price,
          reach: (a, b) => fol(K.cr(b.creator)) - fol(K.cr(a.creator)),
          rating: (a, b) => (K.cr(b.creator).rating || 0) - (K.cr(a.creator).rating || 0),
          soon: (a, b) => String(a.postDate).localeCompare(String(b.postDate)),
        }[u.sort];
        const rank = b => (b.status === "hired" ? 0 : b.status === "declined" ? 2 : 1);
        return [...list].sort((a, b) => rank(a) - rank(b) || by(a, b));
      }
      const vsBudget = p =>
        p === j.budget
          ? "On budget"
          : p < j.budget
            ? `${L.inr(j.budget - p)} under budget`
            : `${L.inr(p - j.budget)} over budget`;

      function bidCard(b) {
        const c = K.cr(b.creator),
          p = K.pf(c, j.platform),
          inCmp = cmp().includes(b.id),
          c0 = b.status === "hired" && S().campaigns.find(x => x.job === j.id && x.creator === b.creator);
        const acts = [];
        if (b.status === "hired")
          acts.push(c0 ? `<a class="lq lq-p lq-sm" href="#campaign-${esc(c0.id)}">Open campaign</a>` : "");
        else if (b.status === "declined") {
          if (canHire())
            acts.push(`<button class="btn-q" type="button" data-undo="${esc(b.id)}">Undo decline</button>`);
        } else if (canHire()) {
          acts.push(
            `<button class="lq lq-p lq-sm" type="button" data-hire="${esc(b.id)}">Confirm ${esc(K.first(c))}</button>`,
          );
          acts.push(
            `<button class="chip jd-short" type="button" data-short="${esc(b.id)}" aria-pressed="${b.status === "shortlisted"}">${ic("bookmark")}<span>${b.status === "shortlisted" ? "Shortlisted" : "Shortlist"}</span></button>`,
          );
          acts.push(
            `<button class="chip jd-cmp-t" type="button" data-cmp="${esc(b.id)}" aria-pressed="${inCmp}">${inCmp ? ic("check") : ic("plus")}<span>Compare</span></button>`,
          );
          acts.push(`<button class="btn-q" type="button" data-decline="${esc(b.id)}">Decline</button>`);
        }
        if (b.status === "new" && canHire())
          acts.push(
            `<button class="btn-q jd-seen" type="button" data-seen="${esc(b.id)}">${ic("eye")}Mark as viewed</button>`,
          );
        return `<article class="jd-bid is-${b.status}" data-id="${esc(b.id)}" aria-labelledby="jb-${esc(b.id)}">
          <div class="jd-bid-h">
            <a class="jd-bid-who" href="#creator-${esc(c.id)}" data-prof="${esc(b.id)}" id="jb-${esc(b.id)}">${K.crChip(c, `${c.handle} · ${c.city}`)}</a>
            ${K.pill(K.BST, b.status)}
          </div>
          <div class="jd-bid-g">
            <div class="jd-bid-p"><p class="jd-lab">Bid</p><p class="t-money jd-bid-price">${L.inr(b.price)}</p><p class="jd-bid-vs${b.price > j.budget ? " is-over" : ""}">${esc(vsBudget(b.price))}</p></div>
            <dl class="bk-meta jd-bid-m">
              <div><dt>${esc(p ? K.plat(p.p) : "Followers")}</dt><dd>${p ? `${L.compact(p.followers)} <span class="muted">· ${p.er}% ER</span>` : "—"}</dd></div>
              <div><dt>Rating</dt><dd>${c.rating ? `${Number(c.rating).toFixed(1)} <span class="muted">· ${c.reviews} reviews</span>` : '<span class="muted">New</span>'}</dd></div>
              <div><dt>Post date</dt><dd>${b.postDate ? esc(L.fmtDate(b.postDate)) : "—"}</dd></div>
              <div><dt>Expected views</dt><dd>${b.views ? esc(L.compact(b.views)) : '<span class="muted">Not given</span>'}</dd></div>
            </dl>
          </div>
          <blockquote class="jd-pitch"><p>“${esc(b.pitch || "No note.")}”</p></blockquote>
          ${(b.links || []).length ? `<ul class="jd-links">${b.links.map(x => `<li>${ic("link")}<span>${esc(x)}</span></li>`).join("")}</ul>` : ""}
          <p class="jd-sent">Sent ${esc(L.ago(b.sent))}${b.closedWithJob ? " · declined when the job closed" : ""}</p>
          ${acts.filter(Boolean).length ? `<div class="jd-acts">${acts.join("")}</div>` : ""}
        </article>`;
      }

      function bidsBlock() {
        const all = bids(),
          hiddenCount = Math.max(0, (j.bids || 0) - all.length);
        const counts = FILTERS.reduce((o, k) => ((o[k] = all.filter(b => b.status === k).length), o), {});
        if (j.status === "draft")
          return `<div class="empty jd-empty"><p class="t-h2">No bids on a draft.</p><p class="muted">Publish the job and creators who fit can bid on it.</p><a class="lq lq-p" href="#post-${esc(j.id)}">Finish and publish</a></div>`;
        if (!all.length) {
          const c = K.campOfJob(j.id),
            k = c && K.cr(c.creator);
          return `<div class="empty jd-empty">${
            j.bids
              ? `<p class="t-h2">${j.bids} bids came in.</p><p class="muted">${k ? `You hired ${esc(k.name)}. The other bids closed with the job.` : "They closed with the job."}</p>${c ? `<a class="lq lq-p" href="#campaign-${esc(c.id)}">Open campaign</a>` : ""}`
              : `<p class="t-h2">No bids yet.</p><p class="muted">New jobs usually get their first bids within a day. You get a notification for each one.</p>`
          }</div>`;
        }
        const list = sorted(u.f ? all.filter(b => b.status === u.f) : all);
        return `<div class="jd-tools">
            <div class="chips jd-filter" role="group" aria-label="Filter bids"><button class="chip" type="button" data-f="" aria-pressed="${!u.f}">All <span class="jl-cn">${all.length}</span></button>${FILTERS.map(k => `<button class="chip" type="button" data-f="${k}" aria-pressed="${u.f === k}" ${counts[k] ? "" : "disabled"}>${K.BST[k].label} <span class="jl-cn">${counts[k]}</span></button>`).join("")}</div>
            <div class="field jd-sort"><label class="sr-only" for="jdSort">Sort bids</label><select class="select" id="jdSort">${Object.entries(
              SORTS,
            )
              .map(([k, t]) => `<option value="${k}"${k === u.sort ? " selected" : ""}>${t}</option>`)
              .join("")}</select></div>
          </div>
          <div class="jd-bids" id="jdBids">${list.length ? list.map(bidCard).join("") : `<p class="muted jd-none">No ${esc(K.BST[u.f].label.toLowerCase())} bids.</p>`}</div>
          ${hiddenCount ? `<p class="help jd-more">${all.length} of ${j.bids} bids are shown in this sample. <span class="sample">Sample data</span></p>` : ""}`;
      }

      function tray() {
        const ids = cmp();
        const t = el.querySelector("#jdTray");
        if (!t) return;
        t.hidden = !ids.length || !canHire();
        t.innerHTML = `<p class="jd-tray-t"><span class="jd-tray-av">${ids.map(b => K.cav(K.cr(S().bids.find(x => x.id === b).creator))).join("")}</span><span><b>${ids.length} of ${MAXCMP}</b> picked to compare</span></p>
          <div class="row"><button class="btn-q jd-tray-x" type="button" data-clearcmp>Clear</button><button class="lq lq-p lq-sm" type="button" data-opencmp ${ids.length < 2 ? 'disabled aria-disabled="true"' : ""}>${ids.length < 2 ? "Pick one more" : "Compare " + ids.length}</button></div>`;
        L.liquid(t);
      }

      function side() {
        const all = bids(),
          c = K.campOfJob(j.id),
          n = k => all.filter(b => b.status === k).length;
        return `<div class="jd-deal card">
            <p class="jd-lab">Budget</p>
            <p class="t-money jd-budget" data-budget>${L.inr(j.budget)}</p>
            <p class="bk-loc">${ic("pin")}<span>${esc(K.where(j))}</span></p>
            <dl class="bk-meta">
              <div><dt>Live by</dt><dd>${esc(L.fmtDate(j.deadline))}</dd></div>
              <div><dt>Bids</dt><dd>${j.bids || 0}</dd></div>
            </dl>
            ${all.length ? `<ul class="jd-tally">${FILTERS.map(k => `<li class="is-${k}"><span class="dot" aria-hidden="true"></span>${K.BST[k].label}<b class="num">${n(k)}</b></li>`).join("")}</ul>` : ""}
            <p class="jd-payline">You pay the agreed price into escrow when you confirm a creator. No platform fee. <span class="muted">Taxes as per confirmed rules.</span></p>
            ${c ? `<a class="lq lq-p jd-side-btn" href="#campaign-${esc(c.id)}">Open campaign</a>` : ""}
            ${j.status === "open" || j.status === "draft" ? `<a class="lq ${c ? "lq-s" : "lq-s"} jd-side-btn" href="#post-${esc(j.id)}">${ic("edit")}${j.status === "draft" ? "Continue editing" : "Edit job"}</a>` : ""}
          </div>`;
      }

      function paint() {
        const banner =
          j.status === "draft"
            ? `<p class="jd-banner">${ic("edit")}<span>This is a draft. Creators can’t see it yet.</span></p>`
            : j.status === "closed"
              ? `<p class="jd-banner">${ic("close")}<span>Closed${j.closedAt ? " on " + esc(L.fmtDate(j.closedAt)) : ""}. Creators can no longer bid.</span></p>`
              : "";
        const fol = j.minFollowers ? L.compact(j.minFollowers) + "+ followers" : "No minimum";
        el.innerHTML = `<div class="view-in jd">
          <a class="btn-q jd-back" href="#jobs">${ic("back")}All jobs</a>
          <div class="jd-layout">
            <article class="jd-main" aria-labelledby="jdH">
              <header class="jd-h">
                <div class="bk-src"><span class="bk-plat">${K.glyph(j.platform)}<span>${esc(K.plat(j.platform))} ${esc(j.format)} · ${esc(j.category)}</span></span>${K.pill(K.JST, j.status)}</div>
                <h1 class="t-h1" id="jdH">${esc(j.title)}</h1>
                <p class="muted t-small">${j.posted ? "Posted " + esc(L.ago(j.posted)) : "Not posted yet"} · <span class="sample">Sample brief</span></p>
                <div class="jd-tools-h" role="group" aria-label="Job actions">
                  ${j.status === "open" || j.status === "draft" ? `<a class="chip" href="#post-${esc(j.id)}">${ic("edit")}<span>Edit</span></a>` : ""}
                  ${j.status === "open" || j.status === "hired" ? `<button class="chip" type="button" data-closejob>${ic("close")}<span>${j.status === "hired" ? "Close listing" : "Close job"}</span></button>` : ""}
                  ${S().campaigns.some(c => c.job === j.id) ? "" : `<button class="chip" type="button" data-deljob>${ic("trash")}<span>Delete</span></button>`}
                </div>
              </header>
              ${banner}
              <section class="jd-sec" aria-labelledby="jdBriefH">
                <h2 class="t-eyebrow muted" id="jdBriefH">The brief</h2>
                <p class="jd-brief">${esc(j.brief || "No brief yet.")}</p>
                <dl class="cw-facts jd-facts">
                  <div><dt>Followers</dt><dd>${esc(fol)}</dd></div>
                  <div><dt>Languages</dt><dd>${esc((j.languages || []).join(", ") || "—")}</dd></div>
                  <div><dt>Location</dt><dd>${esc(j.remote ? "Any city" : j.city)}</dd></div>
                  <div><dt>Usage</dt><dd>${esc(j.usage || "—")}</dd></div>
                </dl>
                <ol class="jd-dels">${(j.deliverables || []).map((d, i) => `<li><span class="jd-n">${String(i + 1).padStart(2, "0")}</span><span>${esc(d)}</span></li>`).join("")}</ol>
              </section>
              <section class="jd-sec jd-bids-sec" aria-labelledby="jdBidsH">
                <div class="row between wrap"><h2 class="t-h2" id="jdBidsH">Bids received</h2>${canHire() && bids().length ? `<p class="help">Shortlist the ones you like, compare up to ${MAXCMP}, then confirm one.</p>` : ""}</div>
                <div id="jdBidsBox">${bidsBlock()}</div>
              </section>
            </article>
            <aside class="jd-side" aria-label="Budget and bids">${side()}</aside>
          </div>
          <p class="sr-only" id="jdLive" aria-live="polite"></p>
          <div class="jd-tray dark" id="jdTray" role="region" aria-label="Compare bids" hidden></div>
        </div>`;
        L.liquid(el);
        tray();
      }

      const live = m => {
        const n = el.querySelector("#jdLive");
        if (n) n.textContent = m;
      };
      const refreshBids = (animate = true, msg) => {
        const mutate = () => {
          el.querySelector("#jdBidsBox").innerHTML = bidsBlock();
          el.querySelector(".jd-side").innerHTML = side();
          L.liquid(el.querySelector(".jd-layout"));
          tray();
        };
        animate ? K.flip(mutate, () => L.$$(".jd-bid", el)) : mutate();
        msg && live(msg);
      };
      const setBid = (bid, fn, why) =>
        L.store.set(s => {
          const b = s.bids.find(x => x.id === bid);
          b && fn(b);
        }, why);
      const seen = bid => {
        const b = S().bids.find(x => x.id === bid);
        if (b && b.status === "new")
          setBid(
            bid,
            x => {
              x.status = "viewed";
            },
            "bid-viewed",
          );
      };

      const onClick = e => {
        const t = e.target.closest("button,a[data-prof]");
        if (!t || !el.contains(t)) return;
        const d = t.dataset;
        if (d.prof) {
          seen(d.prof);
          return;
        } // the link still navigates to the creator profile
        if (d.f !== undefined) {
          u.f = d.f;
          refreshBids(true, u.f ? `Showing ${K.BST[u.f].label.toLowerCase()} bids` : "Showing all bids");
          const s2 = el.querySelector(`.jd-filter [data-f="${u.f}"]`);
          s2 && s2.focus();
        } else if (d.seen) {
          seen(d.seen);
          refreshBids(false, "Marked as viewed");
        } else if (d.short) {
          const b = S().bids.find(x => x.id === d.short),
            on = b.status !== "shortlisted";
          setBid(
            d.short,
            x => {
              x.status = on ? "shortlisted" : "viewed";
            },
            "bid-shortlist",
          );
          const card = t.closest(".jd-bid"),
            pl = card && card.querySelector("[data-pill]");
          const apply = () => {
            refreshBids(false, on ? `${K.cr(b.creator).name} shortlisted` : "Removed from shortlist");
            const nb = el.querySelector(`[data-short="${d.short}"]`);
            nb && nb.focus();
          };
          if (pl && L.motion.morph && !L.RM) {
            K.mo("morph", pl, () => {
              pl.className = "pill " + K.BST[on ? "shortlisted" : "viewed"].pill;
              pl.innerHTML = ic(K.BST[on ? "shortlisted" : "viewed"].ic) + (on ? "Shortlisted" : "Viewed");
            });
            setTimeout(apply, 340);
          } else apply();
        } else if (d.decline) {
          const b = S().bids.find(x => x.id === d.decline),
            c = K.cr(b.creator);
          setBid(
            d.decline,
            x => {
              x.status = "declined";
            },
            "bid-declined",
          );
          u.cmp[j.id] = cmp().filter(x => x !== d.decline);
          refreshBids(true, `${c.name}’s bid declined`);
          L.toast(`Declined. ${K.first(c)} is told kindly.`, "check");
        } else if (d.undo) {
          setBid(
            d.undo,
            x => {
              x.status = "viewed";
              delete x.closedWithJob;
            },
            "bid-undo",
          );
          refreshBids(true, "Decline undone");
        } else if (d.cmp) {
          const list = cmp(),
            i = list.indexOf(d.cmp);
          if (i >= 0) list.splice(i, 1);
          else if (list.length >= MAXCMP) {
            L.toast(`Compare up to ${MAXCMP} bids. Remove one first.`, "info");
            K.mo("shake", el.querySelector("#jdTray"));
            return;
          } else {
            list.push(d.cmp);
            seen(d.cmp);
          }
          refreshBids(false);
          const nb = el.querySelector(`[data-cmp="${d.cmp}"]`);
          nb && nb.focus();
          live(`${list.length} of ${MAXCMP} picked to compare`);
        } else if (t.hasAttribute("data-clearcmp")) {
          u.cmp[j.id] = [];
          refreshBids(false, "Compare cleared");
        } else if (t.hasAttribute("data-opencmp")) compare();
        else if (d.hire) hire(d.hire);
        else if (t.hasAttribute("data-closejob"))
          K.closeJob(j.id, () => {
            paint();
          });
        else if (t.hasAttribute("data-deljob")) K.deleteJob(j.id, () => L.go("#jobs"));
      };
      el.addEventListener("click", onClick);
      el.addEventListener("change", e => {
        if (e.target.id === "jdSort") {
          u.sort = e.target.value;
          refreshBids(true, "Sorted by " + SORTS[u.sort].toLowerCase());
        }
      });

      /* ---------- compare up to three, side by side ---------- */
      function compare() {
        const list = cmp()
          .map(b => S().bids.find(x => x.id === b))
          .filter(Boolean);
        if (list.length < 2) return;
        const low = Math.min(...list.map(b => b.price)),
          best = Math.max(...list.map(b => K.cr(b.creator).rating || 0));
        const reach = Math.max(...list.map(b => fol(K.cr(b.creator))));
        const row = (label, cells) =>
          `<div class="jd-cmp-r"><p class="jd-cmp-l">${esc(label)}</p>${cells.join("")}</div>`;
        const cell = (html, top) => `<div class="jd-cmp-c${top ? " is-top" : ""}">${html}</div>`;
        const cols = list.map(b => ({ b, c: K.cr(b.creator) }));
        const lead = d => {
          if (!d) return "—";
          const n = K.daysTo(j.deadline) - K.daysTo(d);
          return `${L.fmtDate(d)}<span class="muted">${n > 0 ? ` · ${n} day${n === 1 ? "" : "s"} early` : " · on the day"}</span>`;
        };
        L.openSheet({
          title: "Compare bids",
          wide: true,
          body: `<div class="jd-cmp" style="--n:${cols.length}">
            <div class="jd-cmp-r jd-cmp-head">${cols.map(({ b, c }) => `<div class="jd-cmp-c">${K.cav(c)}<p class="jd-cmp-n">${esc(c.name)}${K.ver(c)}</p><p class="help">${esc(c.handle)}</p>${K.pill(K.BST, b.status)}</div>`).join("")}</div>
            ${row(
              "Bid",
              cols.map(({ b }) =>
                cell(
                  `<span class="t-money jd-cmp-price">${L.inr(b.price)}</span>${b.price === low ? '<span class="jd-cmp-tag">Lowest</span>' : ""}`,
                  b.price === low,
                ),
              ),
            )}
            ${row(
              "Against your budget of " + L.inr(j.budget),
              cols.map(({ b }) => cell(esc(vsBudget(b.price)))),
            )}
            ${row(
              `${K.plat(j.platform)} followers`,
              cols.map(({ c }) => {
                const p = K.pf(c, j.platform);
                return cell(
                  p ? `${L.compact(p.followers)}<span class="muted"> · ${p.er}% ER</span>` : "—",
                  p && p.followers === reach,
                );
              }),
            )}
            ${row(
              "Average views",
              cols.map(({ c }) => {
                const p = K.pf(c, j.platform);
                return cell(p ? L.compact(p.avgViews) : "—");
              }),
            )}
            ${row(
              "Expected views",
              cols.map(({ b }) =>
                cell(b.views ? L.compact(b.views) : '<span class="muted">Not given</span>'),
              ),
            )}
            ${row(
              "Post date",
              cols.map(({ b }) => cell(lead(b.postDate))),
            )}
            ${row(
              "Rating",
              cols.map(({ c }) =>
                cell(
                  c.rating
                    ? `${ic("star")}${Number(c.rating).toFixed(1)}<span class="muted"> · ${c.reviews}</span>`
                    : '<span class="muted">No reviews yet</span>',
                  c.rating && c.rating === best,
                ),
              ),
            )}
            ${row(
              "City",
              cols.map(({ c }) => cell(esc(c.city))),
            )}
            ${row(
              "Speaks your languages",
              cols.map(({ c }) => {
                const m = (j.languages || []).filter(l => (c.languages || []).includes(l));
                return cell(m.length ? esc(m.join(", ")) : '<span class="muted">None of them</span>');
              }),
            )}
            ${row(
              "Their note",
              cols.map(({ b }) => cell(`<span class="jd-cmp-pitch">“${esc(b.pitch || "")}”</span>`)),
            )}
            <div class="jd-cmp-r jd-cmp-foot">${cols
              .map(
                ({
                  b,
                  c,
                }) => `<div class="jd-cmp-c"><button class="lq lq-p lq-sm" type="button" data-chire="${esc(b.id)}">Confirm ${esc(K.first(c))}</button>
              <button class="chip" type="button" data-cshort="${esc(b.id)}" aria-pressed="${b.status === "shortlisted"}">${ic("bookmark")}<span>${b.status === "shortlisted" ? "Shortlisted" : "Shortlist"}</span></button></div>`,
              )
              .join("")}</div>
          </div>`,
          onMount(body, close) {
            body.addEventListener("click", e => {
              const t = e.target.closest("button");
              if (!t) return;
              if (t.dataset.chire) {
                close(true);
                hire(t.dataset.chire);
              } else if (t.dataset.cshort) {
                const b = S().bids.find(x => x.id === t.dataset.cshort),
                  on = b.status !== "shortlisted";
                setBid(
                  b.id,
                  x => {
                    x.status = on ? "shortlisted" : "viewed";
                  },
                  "bid-shortlist",
                );
                t.setAttribute("aria-pressed", String(on));
                t.querySelector("span").textContent = on ? "Shortlisted" : "Shortlist";
                const pl = t.closest(".jd-cmp").querySelectorAll(".jd-cmp-head [data-pill]")[
                  cols.findIndex(x => x.b.id === b.id)
                ];
                if (pl) {
                  pl.className = "pill " + K.BST[b.status].pill;
                  pl.innerHTML = ic(K.BST[b.status].ic) + K.BST[b.status].label;
                  K.mo("bump", pl);
                }
                refreshBids(false);
              }
            });
            K.mo("stagger", L.$$(".jd-cmp-r", body));
          },
        });
      }

      /* ---------- confirm creator → campaign at 'accepted' → pay sheet ---------- */
      function hire(bid) {
        const b = S().bids.find(x => x.id === bid);
        if (!b || !canHire()) return;
        if (L.live && L.needKyc("#job-" + j.id)) return;
        const c = K.cr(b.creator),
          others = bids().filter(x => x.id !== bid && K.OPEN_BID.includes(x.status)).length;
        K.confirm({
          title: `Hire ${c.name}?`,
          yes: `Confirm ${K.first(c)}`,
          no: "Not yet",
          mini: `<div class="jl-mini">${K.crChip(c)}<p class="t-money jl-mini-p">${L.inr(b.price)}</p><p class="t-small muted">${esc(j.title)} · post by ${esc(L.fmtDate(b.postDate || j.deadline))}</p></div>`,
          bullets: [
            `A campaign starts at Accepted for ${L.inr(b.price)}, the agreed price.`,
            `Next you pay ${L.inr(b.price)} into escrow. Linkloom holds it until you approve the work.`,
            `Chat with ${K.first(c)} opens once you pay. No platform fee.`,
          ],
          extra: others
            ? `<label class="check jd-close-others"><input type="checkbox" checked data-closeothers> Close the job and decline the other ${others} open bid${others === 1 ? "" : "s"}</label>`
            : "",
          onYes(body) {
            if (L.live) {
              L.live.selectBid(j.id, bid).then(
                () => {
                  const camp = S().campaigns.find(x => x.job === j.id && x.creator === b.creator);
                  L.toast(`${c.name} confirmed`, "check");
                  L.go(camp ? "#campaign-" + camp.id : "#campaigns");
                },
                e => {
                  if (L.live.isKycRequired(e)) return L.kycGate("#job-" + j.id);
                  L.toast(L.live.errorText(e), "alert");
                },
              );
              return;
            }
            const closeOthers = !!(body.querySelector("[data-closeothers]") || { checked: true }).checked;
            const cid = "c" + Date.now().toString(36),
              at = K.nowISO();
            L.store.set(s => {
              const x = s.bids.find(y => y.id === bid);
              x.status = "hired";
              const jj = s.jobs.find(y => y.id === j.id);
              if (closeOthers) {
                jj.status = "hired";
                jj.hired = b.creator;
                s.bids.forEach(y => {
                  if (y.job === j.id && y.id !== bid && K.OPEN_BID.includes(y.status)) {
                    y.status = "declined";
                    y.closedWithJob = true;
                  }
                });
              }
              s.campaigns.unshift({
                id: cid,
                creator: b.creator,
                source: "job",
                job: j.id,
                title: j.title,
                platform: j.platform,
                format: j.format,
                price: b.price,
                stage: "accepted",
                revisionsIncluded: 2,
                revisionsUsed: 0,
                due: b.postDate || j.deadline,
                thread: null,
                deliverables: (j.deliverables || []).slice(),
                deliveries: [],
                log: [[at, "accepted"]],
              });
            }, "creator-confirmed");
            u.cmp[j.id] = [];
            paint();
            live(`${c.name} confirmed. Pay into escrow to start.`);
            setTimeout(() => L.payEscrow && L.payEscrow(cid), L.RM ? 0 : 120);
          },
        });
      }

      paint();
      K.mo("count", el.querySelector("[data-budget]"), j.budget, L.inr);
      K.mo("stagger", L.$$(".jd-sec, .jd-deal, .jd-bid", el));
      const off = L.store.on(why => {
        if (why === "escrow-paid") paint();
      });
      return () => {
        el.removeEventListener("click", onClick);
        off();
      };
    },
  });
})();
