// @ts-nocheck
/* Earnings (#earnings). Owned by Builder C.
   Every total here is derived from LLD_DATA.ledger and LLD_DATA.withdrawals in integer paise, never typed in:
   ready = Σ net(paid rows) − Σ withdrawals paid or processing; earned = Σ net(paid + pending rows).
   Pending (still clearing) and failed rows are never ready. Subscription model: no per-deal fee, so net = the agreed price
   (LLD.payout(p).net === p). Tax is never computed; it is always "as per confirmed rules". */
(() => {
  const L = window.LLD,
    esc = L.esc,
    ic = L.icon;
  const C = (window.LLD_C = window.LLD_C || {});
  const net = p => L.payout(p).net;
  const sum = (rows, f) => rows.reduce((n, r) => n + f(r), 0);
  const OUT = w => w.status === "paid" || w.status === "processing";

  C.money = () => {
    const s = L.store.s,
      by = st => s.ledger.filter(l => l.status === st);
    const cleared = sum(by("paid"), l => net(l.amount)),
      clearing = sum(by("pending"), l => net(l.amount)),
      failed = sum(by("failed"), l => net(l.amount));
    const out = sum(s.withdrawals.filter(OUT), w => w.amount);
    return { cleared, clearing, failed, out, ready: cleared - out, earned: cleared + clearing };
  };
  /* keep the shared field (read by the sidebar slip) equal to the ledger result; call inside store.set */
  C.syncReady = s => {
    s.readyToWithdraw = C.money().ready;
  };

  /* the ink payout slip with the scalloped edge (same object as the homepage receipt); also used on the work board */
  /* no fee row: the creator receives the agreed price; the status pill takes the header slot */
  C.slip = o => {
    const p = L.payout(o.price),
      head = o.head || "Payout slip";
    return `<div class="earnings-slip-w">
      <article class="earnings-slip${o.failed ? " is-failed" : ""}" aria-label="${esc(head)}">
        <header class="earnings-slip-h"><span>${esc(head)}</span>${o.status || ""}</header>
        ${o.brand ? `<p class="earnings-slip-who"><b>${esc(o.brand)}</b><span>${esc(o.job || "")}</span></p>` : ""}
        <dl class="earnings-slip-rows">
          <div><dt>Agreed price</dt><dd>${L.inr(p.price, { dec: true })}</dd></div>
          <div><dt>Tax / withholding</dt><dd>As per confirmed rules</dd></div>
        </dl>
        <div class="earnings-slip-net"><span>${o.failed ? "Not released" : "You receive"}</span><span class="earnings-slip-amt">${L.inr(p.net)}</span></div>
        ${o.failed ? "" : '<p class="earnings-slip-why">The agreed price.</p>'}
        ${o.foot ? `<p class="earnings-slip-f">${esc(o.foot)}</p>` : ""}
      </article></div>`;
  };

  const STATUS = {
    paid: { pill: "pill-ok", icon: "check", label: "Paid" },
    pending: { pill: "pill-warn", icon: "clock", label: "Pending" },
    failed: { pill: "pill-err", icon: "alert", label: "Failed" },
    processing: { pill: "pill-info", icon: "clock", label: "Processing" },
  };
  const pill = (st, extra) => {
    const x = STATUS[st] || STATUS.pending;
    return `<span class="pill ${x.pill}">${ic(x.icon)}${esc(x.label + (extra ? " · " + extra : ""))}</span>`;
  };
  const ledgerSlip = l =>
    C.slip({
      price: l.amount,
      brand: l.brand,
      job: l.job,
      failed: l.status === "failed",
      status:
        l.status === "paid"
          ? pill("paid", "released " + L.fmtDate(l.date))
          : l.status === "pending"
            ? pill("pending", l.clears ? "clears " + L.fmtDate(l.clears) : "clearing")
            : pill("failed"),
      foot:
        l.status === "paid"
          ? `In your balance since ${L.fmtDate(l.date, { year: true })}. Ref LL-PS-${l.id.toUpperCase()}`
          : l.status === "pending"
            ? `Approved ${L.fmtDate(l.date)}. Not in your balance until it clears.`
            : l.reason || "The release did not go through. It is not counted in your balance.",
    });

  const RANGES = [
    ["30", "30 days"],
    ["90", "90 days"],
    ["fy", "This FY"],
    ["all", "All time"],
  ];
  const rangeFrom = k => {
    const t = C.today ? C.today() : "2026-11-04";
    if (k === "30") return C.addDays(t, -30);
    if (k === "90") return C.addDays(t, -90);
    if (k === "fy") {
      const [y, m] = t.split("-").map(Number);
      return (m >= 4 ? y : y - 1) + "-04-01";
    } // Indian financial year starts 1 April
    return null;
  };
  const earnedIn = k => {
    const from = rangeFrom(k),
      rows = L.store.s.ledger.filter(
        l => (l.status === "paid" || l.status === "pending") && (!from || l.date >= from),
      );
    const first = from || rows.reduce((a, l) => (a && a < l.date ? a : l.date), null) || C.today();
    return {
      total: sum(rows, l => net(l.amount)),
      n: rows.length,
      label: `${L.fmtDate(first, { year: L.D(first).getFullYear() !== L.D(C.today()).getFullYear() })} – ${L.fmtDate(C.today(), { year: true })}`,
    };
  };
  const FILTERS = [
    ["all", "All"],
    ["paid", "Paid"],
    ["pending", "Pending"],
    ["failed", "Failed"],
  ];
  /* a receipt feeds out of its slot (motion.js print); falls back to the plain reveal */
  const feed = (n, delay) => {
    if (!n) return;
    if (n.matches(".earnings-slip-w,.earnings-mini-w") && n.firstElementChild) n = n.firstElementChild; // clip the paper, not its shadow wrapper
    L.motion.print ? L.motion.print(n, { delay }) : L.motion.reveal(n);
  };
  const narrow = () => matchMedia("(max-width:900px)").matches;

  function render(el) {
    const s = L.store.s,
      ui = s.workUI || (s.workUI = {});
    let detachNet = null,
      timers = [];
    C.syncReady(s); // the ledger is the source of truth for the sidebar slip too
    if (!s.ledger.length && !s.withdrawals.length) {
      el.innerHTML = `<div class="view-in earnings"><h1 class="t-h1">Earnings</h1>
        <div class="empty earnings-empty"><img src="assets/step-06-coins.svg" width="220" height="160" alt="">
          <p class="t-h2">No earnings yet</p><p class="muted">${s.earningsSummary && s.earningsSummary.inEscrow ? `${L.inr(s.earningsSummary.inEscrow)} is held in escrow for ${s.earningsSummary.ordersInEscrow} job${s.earningsSummary.ordersInEscrow === 1 ? "" : "s"} in progress. ` : ""}When a brand approves your work, the payout is released from escrow and shows up here with a full slip.</p>
          <a class="lq lq-p" href="#active">See active jobs</a></div></div>`;
      return;
    }

    const paint = from => {
      const m = C.money(),
        meth = s.payoutMethods || [],
        led = [...s.ledger].sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
      const wds = [...s.withdrawals].sort((a, b) => b.date.localeCompare(a.date));
      if (s.readyToWithdraw !== m.ready) s.readyToWithdraw = m.ready; // the ledger is the source of truth
      let range = RANGES.some(r => r[0] === ui.earnRange) ? ui.earnRange : "fy",
        f = FILTERS.some(x => x[0] === ui.earnFilter) ? ui.earnFilter : "all";
      let pick = led.find(l => l.id === ui.earnPick) ? ui.earnPick : led[0] && led[0].id;
      const E = earnedIn(range),
        cnt = k => (k === "all" ? led.length : led.filter(l => l.status === k).length);
      /* Payouts are off on the server for launch: no withdraw button, no withdrawals list, keyed off payoutsEnabled. */
      const noPayouts = !!L.live && !s.payoutsEnabled;
      const sum0 = s.earningsSummary || { inEscrow: 0, earned: m.earned, tds: 0, ordersInEscrow: 0, ordersEarned: led.length };
      el.innerHTML = `<div class="view-in earnings">
        <div class="earnings-top"><h1 class="t-h1">Earnings</h1><span class="sample">Sample data · amounts in ₹</span>${s.plan && s.plan.renews ? `<span class="earnings-plan">${esc(s.plan.name || "Creator plan")} · renews ${esc(L.fmtDate(s.plan.renews))}</span>` : ""}</div>

        <section class="earnings-hero butter" aria-labelledby="earnReadyH">
          <div class="earnings-hero-a">
            <h2 class="earnings-hero-l" id="earnReadyH">${noPayouts ? "Earned" : "Ready to withdraw"}</h2>
            <p class="earnings-ready"><span class="earnings-rs">₹</span><span data-ready>${L.inr(noPayouts ? sum0.earned : from == null ? m.ready : from).slice(1)}</span></p>
            <p class="earnings-ready-sub">${noPayouts ? `From ${sum0.ordersEarned} approved job${sum0.ordersEarned === 1 ? "" : "s"}. Withdrawals to your bank open soon; everything you earn is kept here.` : `Cleared money only.${m.clearing ? ` ${L.inr(m.clearing)} still clearing is not included.` : ""}`}</p>
            <div class="earnings-cta"${noPayouts ? " hidden" : ""}>
              <button class="lq lq-p lq-xl" type="button" data-withdraw${m.ready <= 0 ? " disabled" : ""}>${ic("arrow")}Withdraw</button>
              <span class="earnings-to">${m.ready > 0 ? `to ${esc(meth[0] ? meth[0].kind + " " + meth[0].label : "your payout method")}` : "Nothing cleared to withdraw right now."}</span>
            </div>
          </div>
          <div class="earnings-recon">
            <p class="earnings-recon-h">How it adds up</p>
            ${noPayouts ? `<dl>
              <div><dt>In escrow, ${sum0.ordersInEscrow} job${sum0.ordersInEscrow === 1 ? "" : "s"}</dt><dd>${L.inr(sum0.inEscrow)}</dd></div>
              <div><dt>Earned, approved work</dt><dd>${L.inr(sum0.earned)}</dd></div>
              <div><dt>TDS deducted</dt><dd>${L.inr(-sum0.tds)}</dd></div>
            </dl>` : ""}
            <dl${noPayouts ? " hidden" : ""}>
              <div><dt>Earned, all time</dt><dd>${L.inr(m.earned)}</dd></div>
              <div><dt>Withdrawn</dt><dd>${L.inr(-m.out)}</dd></div>
              <div><dt>Still clearing</dt><dd>${L.inr(-m.clearing)}</dd></div>
              <div class="is-total"><dt>Ready to withdraw</dt><dd>${L.inr(m.ready)}</dd></div>
            </dl>
            <p class="earnings-recon-ok">${ic("check")}<span>Matches your ledger${m.failed ? `. ${L.inr(m.failed)} failed is not counted.` : "."}</span></p>
            <p class="t-note earnings-recon-note" aria-hidden="true">to the paisa</p>
          </div>
        </section>

        <div class="earnings-grid">
          <div class="earnings-main">
            <section class="earnings-total" aria-labelledby="earnTotH">
              <div class="earnings-total-t">
                <h2 class="earnings-sec-h" id="earnTotH">Total earned</h2>
                <p class="t-money earnings-total-n" data-total>${L.inr(E.total)}</p>
                <p class="earnings-total-r"><span data-range>${esc(E.label)}</span> · <span data-jobs>${E.n} approved job${E.n === 1 ? "" : "s"}</span></p>
                <p class="help">Agreed prices, before tax. Includes money still clearing.</p>
              </div>
              <div class="seg earnings-range" role="group" aria-label="Date range">
                ${RANGES.map(([k, n]) => `<button type="button" data-r="${k}" aria-pressed="${k === range}">${n}</button>`).join("")}
              </div>
            </section>

            <section class="earnings-sec" aria-labelledby="earnActH">
              <div class="earnings-sec-top">
                <h2 class="earnings-sec-h" id="earnActH">Activity</h2>
                <div class="chips earnings-filter" role="group" aria-label="Filter activity">
                  ${FILTERS.map(([k, n]) => `<button class="chip" type="button" data-f="${k}" aria-pressed="${k === f}">${n} <span class="earnings-chip-n">${cnt(k)}</span></button>`).join("")}
                </div>
              </div>
              <ol class="earnings-list">${led
                .map(
                  l => `<li class="earnings-row" data-status="${esc(l.status)}">
                <button type="button" class="earnings-row-b" data-pick="${esc(l.id)}" aria-pressed="${l.id === pick}" aria-label="${esc(`${l.brand}, ${l.job}, ${L.inr(net(l.amount))}, ${STATUS[l.status] ? STATUS[l.status].label : l.status}. Open payout slip`)}">
                  <span class="earnings-date"><b>${L.D(l.date).toLocaleDateString("en-IN", { day: "numeric", timeZone: "Asia/Kolkata" })}</b><span>${L.D(l.date).toLocaleDateString("en-IN", { month: "short", timeZone: "Asia/Kolkata" })}</span></span>
                  <span class="earnings-what"><b>${esc(l.brand)}</b><span>${esc(l.job)}</span></span>
                  <span class="earnings-amt"><b class="t-money">${L.inr(net(l.amount))}</b></span>
                  ${pill(l.status)}
                </button></li>`,
                )
                .join("")}</ol>
              <p class="earnings-none muted" hidden>Nothing with this status.</p>
            </section>

            <section class="earnings-sec" aria-labelledby="earnWdH"${noPayouts ? " hidden" : ""}>
              <div class="earnings-sec-top"><h2 class="earnings-sec-h" id="earnWdH">Withdrawals</h2><span class="help">Methods are masked. UTR is the bank’s reference.</span></div>
              ${
                wds.length
                  ? `<ol class="earnings-wds">${wds
                      .map(
                        w => `<li class="earnings-wd" data-status="${esc(w.status)}">
                <span class="earnings-date"><b>${L.D(w.date).toLocaleDateString("en-IN", { day: "numeric", timeZone: "Asia/Kolkata" })}</b><span>${L.D(w.date).toLocaleDateString("en-IN", { month: "short", timeZone: "Asia/Kolkata" })}</span></span>
                <span class="earnings-wd-m"><b>${esc(w.method)}</b><span>${esc(w.ref || "")}</span></span>
                <b class="t-money earnings-wd-a">${L.inr(w.amount)}</b>
                ${pill(w.status)}
                ${w.reason ? `<p class="earnings-wd-why">${esc(w.reason)}</p>` : ""}
              </li>`,
                      )
                      .join("")}</ol>`
                  : `<p class="muted">No withdrawals yet.</p>`
              }
            </section>
          </div>

          <aside class="earnings-side" aria-label="Payout slip" aria-live="polite" data-slip>${pick ? ledgerSlip(led.find(l => l.id === pick)) : ""}</aside>
        </div>
      </div>`;

      const root = L.$(".earnings", el);
      detachNet && detachNet();
      detachNet = C.net(
        root,
        "earnings-net",
        "You are offline. Amounts are from your last sync; withdrawing waits until you are back.",
      );
      L.liquid(el);
      C.press(el);
      L.motion.count(L.$("[data-ready]", el), m.ready, p => L.inr(p).slice(1), from == null ? {} : { from });

      // date range for total earned
      L.$$(".earnings-range button", el).forEach(b =>
        b.addEventListener("click", () => {
          range = ui.earnRange = b.dataset.r;
          L.$$(".earnings-range button", el).forEach(x => x.setAttribute("aria-pressed", String(x === b)));
          const e = earnedIn(range);
          L.$("[data-range]", el).textContent = e.label;
          L.$("[data-jobs]", el).textContent = `${e.n} approved job${e.n === 1 ? "" : "s"}`;
          L.motion.count(L.$("[data-total]", el), e.total, L.inr);
        }),
      );
      // status filter with a FLIP so rows glide into place
      const rows = L.$$(".earnings-row", el),
        none = L.$(".earnings-none", el);
      const apply = () => {
        let n = 0;
        rows.forEach(r => {
          const on = f === "all" || r.dataset.status === f;
          r.hidden = !on;
          n += on;
        });
        none.hidden = n > 0;
      };
      apply();
      L.$$(".earnings-filter .chip", el).forEach(b =>
        b.addEventListener("click", () => {
          f = ui.earnFilter = b.dataset.f;
          L.$$(".earnings-filter .chip", el).forEach(x => x.setAttribute("aria-pressed", String(x === b)));
          L.motion.flip(apply, rows);
        }),
      );
      // a row opens its payout slip (beside the list on desktop, in a sheet on phones)
      L.$$("[data-pick]", el).forEach(b =>
        b.addEventListener("click", () => {
          const l = s.ledger.find(x => x.id === b.dataset.pick);
          if (!l) return;
          pick = ui.earnPick = l.id;
          L.$$("[data-pick]", el).forEach(x => x.setAttribute("aria-pressed", String(x === b)));
          if (narrow()) {
            L.openSheet({
              title: "Payout slip",
              body: `<div class="earnings-sheet-slip">${ledgerSlip(l)}</div>`,
              onMount: b => feed(L.$(".earnings-slip-w", b), 160),
            });
            return;
          }
          const side = L.$("[data-slip]", el);
          side.innerHTML = ledgerSlip(l);
          feed(side.firstElementChild);
        }),
      );
      const wb = L.$("[data-withdraw]", el);
      wb &&
        wb.addEventListener("click", () =>
          openWithdraw(
            prev => paint(prev),
            t => timers.push(t),
          ),
        );
      L.motion.stagger(rows.filter(r => !r.hidden));
    };
    paint();
    return () => {
      detachNet && detachNet();
      timers.forEach(clearTimeout);
    };
  }

  /* rupee text -> integer paise without floating point ("12,600.5" -> 1260050) */
  const toPaise = str => {
    const v = String(str).replace(/[,\s₹]/g, "");
    if (!/^\d{1,9}(\.\d{0,2})?$/.test(v)) return NaN;
    const [r, d = ""] = v.split(".");
    return parseInt(r, 10) * 100 + parseInt((d + "00").slice(0, 2), 10);
  };
  const rupeesText = p => L.inr(p, { dec: p % 100 !== 0 }).slice(1);
  const MIN = 10000; // ₹100 sample minimum

  function openWithdraw(repaint, keep) {
    const s = L.store.s,
      methods = s.payoutMethods || [];
    let m = C.money(),
      amount = m.ready,
      method = methods[0] ? methods[0].id : "upi",
      box = null,
      closeFn = null,
      startReady = m.ready;
    const M = () => methods.find(x => x.id === method) || methods[0];
    let stepN = 0;
    const show = (html, n) => {
      const dir = n == null || n >= stepN ? 1 : -1,
        put = () => {
          box.innerHTML = html;
          L.liquid(box);
          C.press(box);
        };
      if (n != null && stepN && L.motion.swap) L.motion.swap(box, put, { dir });
      else put();
      if (n != null) stepN = n;
      const f = L.$("input,button", box);
      f && f.focus({ preventScroll: true });
    };

    const step1 = msg => {
      m = C.money();
      show(
        `<form class="earnings-wf" novalidate>
        <p class="earnings-wf-avail"><span>Ready to withdraw</span><b class="t-money">${L.inr(m.ready)}</b></p>
        <div class="field${msg ? " is-err" : ""}">
          <label for="wdAmt">Amount</label>
          <div class="money-in"><span aria-hidden="true">₹</span><input id="wdAmt" inputmode="decimal" autocomplete="off" value="${esc(rupeesText(amount))}" aria-describedby="wdAmtHelp wdAmtErr"${msg ? ' aria-invalid="true"' : ""}></div>
          <p class="help" id="wdAmtHelp">Up to ${L.inr(m.ready)}. Minimum ₹100. Only cleared money can leave.</p>
          <p class="err" id="wdAmtErr"${msg ? "" : " hidden"}>${esc(msg || "")}</p>
          <div class="chips"><button class="chip" type="button" data-amt="all">All ${L.inr(m.ready)}</button><button class="chip" type="button" data-amt="half">Half</button></div>
        </div>
        <fieldset class="earnings-wf-m"><legend>Send to</legend>
          ${methods
            .map(
              x => `<label class="earnings-mth"><input type="radio" name="wdM" value="${esc(x.id)}"${x.id === method ? " checked" : ""}>
            <span class="earnings-mth-t"><b>${esc(x.kind)}</b><span class="num">${esc(x.label)}</span><span class="help">${esc(x.note || "")}</span></span></label>`,
            )
            .join("")}
        </fieldset>
        <p class="help earnings-wf-mask">${ic("lock")}<span>Payout details stay masked and are never shown to brands.</span></p>
        <button class="lq lq-p lq-xl" type="submit">Review withdrawal</button>
      </form>`,
        msg ? null : 1,
      );
      const inp = L.$("#wdAmt", box);
      L.$$("[data-amt]", box).forEach(b =>
        b.addEventListener("click", () => {
          const p = b.dataset.amt === "all" ? m.ready : Math.floor(m.ready / 2);
          inp.value = rupeesText(p);
          inp.focus();
        }),
      );
      inp.addEventListener("blur", () => {
        const p = toPaise(inp.value);
        if (!isNaN(p)) inp.value = rupeesText(p);
      });
      L.$("form", box).addEventListener("submit", e => {
        e.preventDefault();
        const p = toPaise(inp.value);
        method = (L.$("input[name=wdM]:checked", box) || {}).value || method;
        const err = isNaN(p)
          ? "Enter an amount in rupees, like 5,000."
          : p < MIN
            ? "The minimum withdrawal is ₹100."
            : p > m.ready
              ? `You can withdraw up to ${L.inr(m.ready)}. Money still clearing is not ready yet.`
              : "";
        if (err) {
          amount = isNaN(p) ? amount : p;
          step1(err);
          L.$("#wdAmt", box).focus();
          return;
        }
        amount = p;
        step2();
      });
    };

    const step2 = () => {
      const x = M();
      show(
        `<div class="earnings-wf">
        <div class="earnings-mini-w"><div class="earnings-mini">
          <p class="earnings-mini-h">You are withdrawing</p>
          <p class="t-money earnings-mini-a">${L.inr(amount, { dec: amount % 100 !== 0 })}</p>
          <dl>
            <div><dt>To</dt><dd>${esc(x.kind + " " + x.label)}</dd></div>
            <div><dt>From</dt><dd>Linkloom balance</dd></div>
            <div><dt>Left after this</dt><dd>${L.inr(m.ready - amount)}</dd></div>
          </dl>
        </div></div>
        <p class="help">${esc(x.note || "")}. You will get a UTR reference you can quote to your bank.</p>
        <label class="check earnings-wf-fail"><input type="checkbox" data-fail><span><span class="sample">Sample</span> Make this payout fail, to see what happens</span></label>
        <div class="row wrap earnings-wf-acts"><button class="lq lq-p lq-xl" type="button" data-confirm>Confirm and withdraw</button><button class="lq lq-s lq-xl" type="button" data-back>Change</button></div>
      </div>`,
        2,
      );
      feed(L.$(".earnings-mini-w", box), 120);
      L.$("[data-back]", box).addEventListener("click", () => step1());
      L.$("[data-confirm]", box).addEventListener("click", () => {
        const fail = L.$("[data-fail]", box).checked;
        step3(fail);
      });
    };

    const step3 = fail => {
      const x = M();
      show(
        `<div class="earnings-wf earnings-wf-p" role="status" aria-live="polite"><span class="earnings-coin earnings-spin" aria-hidden="true">₹</span><p class="t-h2">Sending ${L.inr(amount)}</p><p class="muted">To ${esc(x.kind + " " + x.label)}. Keep this open for a moment.</p></div>`,
        3,
      );
      keep(
        setTimeout(
          () => {
            if (!navigator.onLine) return bad("offline");
            if (fail) return bad("bank");
            const ref = "UTR " + String(431000000000 + Math.floor(Math.random() * 899999999));
            const id = "w" + Date.now().toString(36);
            L.store.set(st => {
              st.withdrawals.unshift({
                id,
                amount,
                method: x.method,
                date: C.today(),
                status: "processing",
                ref,
              });
              C.syncReady(st);
            }, "withdraw");
            good(ref, id);
          },
          L.RM ? 300 : 1400,
        ),
      );
    };

    const good = (ref, id) => {
      const x = M();
      const left = C.money().ready;
      show(
        `<div class="earnings-wf earnings-wf-ok" role="status" aria-live="polite">
        <p class="t-h2">${L.inr(amount)} is on its way</p>
        <p class="muted">To ${esc(x.kind + " " + x.label)}. ${esc(x.note || "")}.</p>
        <div class="earnings-mini-w earnings-rcpt"><div class="earnings-mini">
          <p class="earnings-mini-h">Withdrawal receipt</p>
          <p class="t-money earnings-mini-a">${L.inr(amount, { dec: amount % 100 !== 0 })}</p>
          <dl>
            <div><dt>Reference</dt><dd>${esc(ref)}</dd></div>
            <div><dt>Status</dt><dd>Processing</dd></div>
            <div><dt>Left to withdraw</dt><dd data-left>${L.inr(left)}</dd></div>
          </dl>
        </div></div>
        <button class="lq lq-p lq-xl" type="button" data-done>Done</button>
      </div>`,
        4,
      );
      feed(L.$(".earnings-rcpt", box), 80);
      L.motion.count(L.$("[data-left]", box), left, L.inr, { from: startReady });
      L.motion.celebrate(L.$(".earnings-rcpt", box));
      L.$("[data-done]", box).addEventListener("click", () => closeFn && closeFn());
      repaint(startReady);
      // the bank confirms a moment later: processing -> paid (totals do not change, the money already left the balance)
      keep(
        setTimeout(() => {
          L.store.set(st => {
            const w = st.withdrawals.find(v => v.id === id);
            if (w) w.status = "paid";
          }, "withdraw-paid");
          if (L.current().name === "earnings") repaint();
        }, 6000),
      );
    };

    const bad = kind => {
      const x = M(),
        other = methods.find(v => v.id !== method);
      if (kind === "bank")
        L.store.set(st => {
          st.withdrawals.unshift({
            id: "w" + Date.now().toString(36),
            amount,
            method: x.method,
            date: C.today(),
            status: "failed",
            ref: "Not sent",
            reason: `Declined by ${x.kind === "UPI" ? "the UPI app" : "the bank"}. Nothing left your balance.`,
          });
          C.syncReady(st);
        }, "withdraw-failed");
      show(
        `<div class="earnings-wf earnings-wf-bad" role="alert">
        <span class="earnings-bad-ic" aria-hidden="true">${ic("alert")}</span>
        <p class="t-h2">${kind === "offline" ? "No connection" : "Payout failed"}</p>
        <p class="muted">${
          kind === "offline"
            ? `You went offline before it was sent. Nothing left your balance; ${L.inr(C.money().ready)} is still ready.`
            : `${esc(x.kind === "UPI" ? "Your UPI app" : "Your bank")} declined the transfer to ${esc(x.label)}. Nothing left your balance; ${L.inr(C.money().ready)} is still ready to withdraw.`
        }</p>
        <div class="row wrap"><button class="lq lq-p" type="button" data-retry>Try again</button>${kind === "bank" && other ? `<button class="lq lq-s" type="button" data-other>Send to ${esc(other.kind)} instead</button>` : ""}<button class="btn-q" type="button" data-x>Close</button></div>
      </div>`,
        4,
      );
      L.$("[data-retry]", box).addEventListener("click", () => step2());
      const o = L.$("[data-other]", box);
      o &&
        o.addEventListener("click", () => {
          method = other.id;
          step2();
        });
      L.$("[data-x]", box).addEventListener("click", () => closeFn && closeFn());
      repaint();
    };

    L.openSheet({
      title: "Withdraw",
      body: '<div class="earnings-wf-host"></div>',
      onMount(b, close) {
        box = L.$(".earnings-wf-host", b);
        closeFn = close;
        step1();
      },
    });
  }

  L.register("earnings", { title: "Earnings", nav: "earnings", render });
})();
