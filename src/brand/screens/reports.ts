// @ts-nocheck
/* Reports (#reports). Owned by Builder D.
   Sections: Overview, Total spent, Total views, Budget & spending, Creator-wise report. One period filter above scopes all of them
   except Budget & spending, which always shows the budget's own period (LLD_DATA.budget) and says so.
   Every number is derived, in integer paise:
     spent  = Σ escrow payments − Σ refunds (LLD_DATA.payments); a refund counts against the month of the payment it returns
     views  = Σ campaign.views (dated by release); cost per 1,000 views = price of campaigns with views ÷ their views × 1,000
   Charts are inline SVG drawn at the container's real width (redrawn on resize), coloured with palette tokens in CSS:
   violet = your spend (brand = you), coral = creators' views, hatched violet = refunded. Palette validated with the dataviz
   validator (violet #8981ee / coral #eb6273 on white: all checks pass). Every chart has a text summary and a table view. */
(() => {
  const L = window.LLD,
    esc = L.esc,
    ic = L.icon,
    M = () => L.motion;
  const TODAY = L.today().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  /* the calendar quarter today falls in: first day, last day, and its three months */
  const QY = +TODAY.slice(0, 4),
    QM = Math.floor((+TODAY.slice(5, 7) - 1) / 3) * 3 + 1;
  const pad2 = n => String(n).padStart(2, "0");
  const Q_FROM = `${QY}-${pad2(QM)}-01`,
    Q_TO = `${QY}-${pad2(QM + 2)}-${pad2(new Date(Date.UTC(QY, QM + 2, 0)).getUTCDate())}`,
    Q_MONTHS = [0, 1, 2].map(i => `${QY}-${pad2(QM + i)}`);
  const FY_START = (() => { const y = +TODAY.slice(0, 4), m = +TODAY.slice(5, 7); return (m >= 4 ? y : y - 1) + "-04-01"; })();
  const sum = (rows, f) => rows.reduce((n, r) => n + f(r), 0);
  const addDays = (iso, n) => {
    const d = L.D(iso);
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  };
  const day = s => (s || "").slice(0, 10);
  const PERIODS = [
    ["q", "This quarter"],
    ["90", "90 days"],
    ["fy", "This FY"],
    ["all", "All time"],
  ];
  const MON = m => L.D(m + "-15").toLocaleDateString("en-IN", { month: "short", timeZone: "Asia/Kolkata" });
  const MONY = m =>
    L.D(m + "-15").toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
  const monthsBetween = (a, b) => {
    const out = [];
    let [y, m] = a.split("-").map(Number);
    const [Y, Mo] = b.split("-").map(Number);
    while (y < Y || (y === Y && m <= Mo)) {
      out.push(`${y}-${String(m).padStart(2, "0")}`);
      m++;
      if (m > 12) {
        m = 1;
        y++;
      }
    }
    return out;
  };
  const num = n => Math.round(n).toLocaleString("en-IN");
  const rs = p => L.compact(Math.round(p / 100)); // paise -> "54K" / "1.5L" (rupees)
  let uid = 0;

  /* ---------- the model for a period ---------- */
  const hiredOn = c => day(c.funded || (c.log && c.log[0] && c.log[0][0]) || c.due);
  function model(k) {
    const s = L.store.s,
      quarterFrom = Q_FROM;
    const from =
      k === "q" ? quarterFrom : k === "90" ? addDays(TODAY, -90) : k === "fy" ? FY_START : null;
    const inP = d => !!d && (!from || d >= from) && d <= TODAY;
    const pay = s.payments,
      escrowOf = id => pay.find(p => p.kind === "escrow" && p.campaign === id);
    const esc_ = pay.filter(p => p.kind === "escrow" && inP(p.date));
    const refs = pay.filter(p => p.kind === "refund" && inP((escrowOf(p.campaign) || p).date)); // a refund nets against its own payment
    const paidIn = sum(esc_, p => p.amount),
      refunded = sum(refs, p => p.amount),
      spent = paidIn - refunded;
    const camps = s.campaigns.filter(c => inP(hiredOn(c)));
    const viewed = s.campaigns.filter(c => c.views > 0 && inP(day(c.released || c.due)));
    const views = sum(viewed, c => c.views),
      viewedPrice = sum(viewed, c => c.price);
    const cpm = views ? (viewedPrice / views) * 1000 : null;
    /* months on the axis: the period's first month (or the first payment) to this month */
    const firstPay = pay.reduce((a, p) => (a && a < p.date ? a : p.date), null) || TODAY;
    const start = (from || firstPay).slice(0, 7);
    const end = k === "q" ? Q_MONTHS[2] : TODAY.slice(0, 7);
    const months = monthsBetween(start, end).map(m => {
      const e = esc_.filter(p => p.date.startsWith(m)),
        r = refs.filter(p => (escrowOf(p.campaign) || p).date.startsWith(m));
      const pi = sum(e, p => p.amount),
        rf = sum(r, p => p.amount);
      return { m, paidIn: pi, refunded: rf, spent: pi - rf, future: m > TODAY.slice(0, 7) };
    });
    /* per creator */
    const ids = [...new Set([...camps.map(c => c.creator), ...esc_.map(p => p.creator)])];
    const creators = ids
      .map(id => {
        const cr = L.creator(id),
          cs = camps.filter(c => c.creator === id);
        const sp =
          sum(
            esc_.filter(p => p.creator === id),
            p => p.amount,
          ) -
          sum(
            refs.filter(p => p.creator === id),
            p => p.amount,
          );
        const v = viewed.filter(c => c.creator === id),
          vw = sum(v, c => c.views),
          vp = sum(v, c => c.price);
        const rated = s.campaigns.filter(c => c.creator === id && c.review && c.review.rating);
        const unrated = s.campaigns.find(c => c.creator === id && c.stage === "released" && !c.review);
        const running = cs.filter(c =>
          ["funded", "in_progress", "submitted", "revision", "approved"].includes(c.stage),
        ).length;
        const done = cs.filter(c => c.stage === "released").length;
        return {
          cr,
          n: cs.length,
          running,
          done,
          spent: sp,
          views: vw,
          cpm: vw ? (vp / vw) * 1000 : null,
          rating: rated.length ? sum(rated, c => c.review.rating) / rated.length : null,
          ratedN: rated.length,
          unrated,
        };
      })
      .sort((a, b) => b.spent - a.spent || b.views - a.views || a.cr.name.localeCompare(b.cr.name));
    const by = st => camps.filter(c => st.includes(c.stage)).length;
    return {
      k,
      from,
      paidIn,
      refunded,
      spent,
      views,
      viewed,
      cpm,
      camps,
      months,
      creators,
      running: by(["funded", "in_progress", "submitted", "revision", "approved"]),
      done: by(["released"]),
      waiting: by(["invited", "accepted"]),
      refundedN: by(["refunded"]),
      notLive: s.campaigns.filter(
        c =>
          inP(hiredOn(c)) && ["funded", "in_progress", "submitted", "revision", "approved"].includes(c.stage),
      ),
    };
  }
  function budget() {
    const s = L.store.s,
      b = s.budget,
      from = Q_FROM,
      to = Q_TO;
    const inQ = d => d >= from && d <= to;
    const escrowOf = id => s.payments.find(p => p.kind === "escrow" && p.campaign === id);
    const e = s.payments.filter(p => p.kind === "escrow" && inQ(p.date)),
      r = s.payments.filter(p => p.kind === "refund" && inQ((escrowOf(p.campaign) || p).date));
    const spent = sum(e, p => p.amount) - sum(r, p => p.amount);
    const committedC = s.campaigns.filter(c => ["invited", "accepted"].includes(c.stage) && inQ(hiredOn(c)));
    const committed = sum(committedC, c => c.price);
    const left = Math.max(0, b.total - spent - committed);
    const months = Q_MONTHS.map(m => ({
      m,
      spent:
        sum(
          e.filter(p => p.date.startsWith(m)),
          p => p.amount,
        ) -
        sum(
          r.filter(p => (escrowOf(p.campaign) || p).date.startsWith(m)),
          p => p.amount,
        ),
      future: m > TODAY.slice(0, 7),
    }));
    const elapsed = (L.D(TODAY) - L.D(from)) / (L.D(to) - L.D(from) + 864e5);
    return {
      b,
      spent,
      committed,
      committedC,
      left,
      months,
      pace: b.total / 3,
      used: spent / b.total,
      elapsed,
      over: spent + committed > b.total,
    };
  }

  /* ---------- chart pieces ---------- */
  const niceMax = v => {
    if (v <= 0) return 1000000;
    const r = v / 100,
      p = Math.pow(10, Math.floor(Math.log10(r))),
      n = r / p;
    const step = [1, 1.2, 1.6, 2, 2.4, 3, 4, 6, 8, 10].find(x => n <= x);
    return step * p * 100;
  }; // quarters land on round ticks
  const topRound = (x, y, w, h, r = 4) => {
    if (h <= 0) return "";
    r = Math.min(r, h, w / 2);
    return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
  };
  const rightRound = (x, y, w, h, r = 4) => {
    if (w <= 0) return "";
    r = Math.min(r, w, h / 2);
    return `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z`;
  };
  const hatch = id =>
    `<defs><pattern id="${id}" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)"><rect width="6" height="6" class="rp-hatch-bg"/><line x1="0" y1="0" x2="0" y2="6" class="rp-hatch-ln"/></pattern></defs>`;

  /* columns: spent (solid violet) with refunded stacked on top (hatched), optional reference line */
  function columns(data, w, o = {}) {
    const H = o.h || 240,
      ml = 52,
      mr = 12,
      mt = 28,
      mb = 32,
      ih = H - mt - mb,
      iw = Math.max(40, w - ml - mr);
    const max = niceMax(Math.max(o.ref || 0, ...data.map(d => d.spent + (d.refunded || 0))));
    const y = v => mt + ih - (v / max) * ih,
      band = iw / data.length,
      bw = Math.min(24, band * 0.56),
      pid = "rpH" + ++uid;
    const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => t * max);
    const peak = data.reduce((a, d, i) => (d.spent > (data[a] || {}).spent ? i : a), 0);
    let g = `<svg class="rp-svg" width="${w}" height="${H}" viewBox="0 0 ${w} ${H}" role="group" aria-label="${esc(o.label)}">${hatch(pid)}`;
    g += ticks
      .map(
        t =>
          `<line class="rp-grid${t ? "" : " is-base"}" x1="${ml}" x2="${w - mr}" y1="${y(t)}" y2="${y(t)}"/><text class="rp-tick" x="${ml - 10}" y="${y(t) + 4}" text-anchor="end">₹${esc(rs(t))}</text>`,
      )
      .join("");
    data.forEach((d, i) => {
      const cx = ml + band * i + band / 2,
        x = cx - bw / 2,
        hs = (d.spent / max) * ih,
        hr = ((d.refunded || 0) / max) * ih;
      const ys = mt + ih - hs,
        gap = hr > 0 && hs > 0 ? 2 : 0;
      g += `<g class="rp-col${d.future ? " is-future" : ""}" style="--i:${i}">`;
      if (hr > 0 && hs > 0)
        g += `<rect class="rp-bar" x="${x}" y="${ys}" width="${bw}" height="${hs}"/><path class="rp-bar-r" fill="url(#${pid})" d="${topRound(x, ys - gap - hr, bw, hr)}"/>`;
      else if (hs > 0) g += `<path class="rp-bar" d="${topRound(x, ys, bw, hs)}"/>`;
      else if (hr > 0)
        g += `<path class="rp-bar-r" fill="url(#${pid})" d="${topRound(x, mt + ih - hr, bw, hr)}"/>`;
      g += `</g>`;
      g += `<text class="rp-x${d.future ? " is-future" : ""}" x="${cx}" y="${H - 10}" text-anchor="middle">${esc(MON(d.m))}</text>`;
      if (i === peak && d.spent > 0)
        g += `<text class="rp-val" x="${cx}" y="${ys - (hr > 0 ? hr + 2 : 0) - 8}" text-anchor="middle">₹${esc(rs(d.spent))}</text>`;
      const tip = [
        MONY(d.m),
        d.future ? "Not started yet" : "Spent " + L.inr(d.spent),
        d.refunded ? "Refunded " + L.inr(d.refunded) : "",
        o.ref ? "Even pace " + L.inr(o.ref) : "",
      ]
        .filter(Boolean)
        .join("|");
      g += `<rect class="rp-hit" x="${ml + band * i}" y="${mt}" width="${band}" height="${ih}" tabindex="0" role="img" aria-label="${esc(tip.replace(/\|/g, ", "))}" data-tip="${esc(tip)}"/>`;
    });
    if (o.ref)
      g += `<line class="rp-ref" x1="${ml}" x2="${w - mr}" y1="${y(o.ref)}" y2="${y(o.ref)}"/><text class="rp-ref-t" x="${w - mr}" y="${y(o.ref) - 8}" text-anchor="end">Even pace ₹${esc(rs(o.ref))} a month</text>`;
    return g + "</svg>";
  }
  /* horizontal bars: views per campaign (coral, the creators' work) */
  function hbars(items, w) {
    const two = w < 480,
      row = two ? 72 : 56,
      by = two ? 42 : 26,
      H = items.length * row + 8,
      mr = 56,
      iw = Math.max(40, w - mr);
    const max = Math.max(...items.map(d => d.value), 1);
    let g = `<svg class="rp-svg" width="${w}" height="${H}" viewBox="0 0 ${w} ${H}" role="group" aria-label="Views by campaign">`;
    items.forEach((d, i) => {
      const y0 = i * row,
        bw = (d.value / max) * iw;
      g += two
        ? `<text class="rp-lab" x="0" y="${y0 + 16}">${esc(d.label)}</text><text class="rp-lab-s" x="0" y="${y0 + 33}">${esc(d.sub)}</text>`
        : `<text class="rp-lab" x="0" y="${y0 + 16}">${esc(d.label)}<tspan class="rp-lab-s" dx="8">${esc(d.sub)}</tspan></text>`;
      g += `<g class="rp-hcol" style="--i:${i}"><path class="rp-bar is-coral" d="${rightRound(0, y0 + by, bw, 16)}"/></g>`;
      g += `<text class="rp-val" x="${bw + 8}" y="${y0 + by + 13}">${esc(L.compact(d.value))}</text>`;
      g += `<rect class="rp-hit" x="0" y="${y0}" width="${w}" height="${row}" tabindex="0" role="img" aria-label="${esc(`${d.label}, ${d.sub}: ${num(d.value)} views`)}" data-tip="${esc(`${num(d.value)} views|${d.label}|${d.sub}`)}"/>`;
    });
    return g + "</svg>";
  }
  /* one tooltip per chart: values lead, labels follow; built with textContent */
  function tips(fig) {
    const tip = L.$(".rp-tip", fig);
    if (!tip) return;
    const show = t => {
      const parts = t.dataset.tip.split("|");
      tip.textContent = "";
      parts.forEach((p, i) => {
        const e = document.createElement(i === 0 ? "b" : "span");
        e.textContent = p;
        tip.append(e);
      });
      const fr = fig.getBoundingClientRect(),
        r = t.getBoundingClientRect();
      tip.hidden = false;
      const tw = tip.offsetWidth,
        left = Math.min(Math.max(0, r.left - fr.left + r.width / 2 - tw / 2), fr.width - tw);
      tip.style.left = left + "px";
      tip.style.top = Math.max(0, r.top - fr.top + (t.dataset.top ? 0 : 8)) + "px";
      L.$$(".is-hot", fig).forEach(n => n.classList.remove("is-hot"));
      const mark = [...t.parentNode.children]
        .slice(0, [...t.parentNode.children].indexOf(t))
        .reverse()
        .find(n => n.matches(".rp-col,.rp-hcol"));
      mark && mark.classList.add("is-hot");
    };
    const hide = () => {
      tip.hidden = true;
      L.$$(".is-hot", fig).forEach(n => n.classList.remove("is-hot"));
    };
    fig.addEventListener("pointerover", e => {
      const t = e.target.closest("[data-tip]");
      if (t) show(t);
    });
    fig.addEventListener("pointerleave", hide);
    fig.addEventListener("focusin", e => {
      const t = e.target.closest("[data-tip]");
      if (t) show(t);
    });
    fig.addEventListener("focusout", hide);
  }

  const stars = r =>
    `<span class="rp-stars" aria-hidden="true">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= Math.round(r) ? "on" : ""}">${ic("star")}</i>`).join("")}</span>`;
  const plat = p => (p === "youtube" ? "YouTube" : "Instagram");

  function render(el) {
    const s = L.store.s,
      ui = s.ui.reports || (s.ui.reports = {});
    let per = PERIODS.some(p => p[0] === ui.period) ? ui.period : "fy";
    let ro = null,
      first = true;

    const paint = () => {
      const m = model(per),
        B = budget();
      const plabel =
        per === "q"
          ? `${new Date(Q_FROM + "T12:00:00+05:30").toLocaleDateString("en-IN", { month: "short", timeZone: "Asia/Kolkata" })}–${new Date(Q_TO + "T12:00:00+05:30").toLocaleDateString("en-IN", { month: "short", timeZone: "Asia/Kolkata" })} ${QY}`
          : m.from
            ? `${L.fmtDate(m.from, { year: true })} – ${L.fmtDate(TODAY, { year: true })}`
            : `All time to ${L.fmtDate(TODAY, { year: true })}`;
      const empty = !m.camps.length && !m.paidIn;
      const share = v => (B.b.total ? Math.round((v / B.b.total) * 100) : 0);
      const segs = [
        ["spent", "Spent", B.spent],
        ["committed", "Waiting for payment", B.committed],
        ["left", "Left to spend", B.left],
      ].filter(x => x[2] > 0);
      const views = m.viewed.slice().sort((a, b) => b.views - a.views);

      el.innerHTML = `<div class="view-in rp">
        <div class="earnings-top rp-top"><h1 class="t-h1">Reports</h1><span class="sample">Sample data · amounts in ₹</span></div>
        <div class="rp-filter">
          <div class="seg rp-seg" role="group" aria-label="Report period">${PERIODS.map(([k, n]) => `<button type="button" data-p="${k}" aria-pressed="${k === per}">${n}</button>`).join("")}</div>
          <p class="help rp-plabel" aria-live="polite"><span>${esc(plabel)}</span> · ${esc((s.report && s.report.note) || "")}</p>
        </div>

        <section class="rp-sec" aria-labelledby="rpOvH">
          <h2 class="rp-h" id="rpOvH">Overview</h2>
          <div class="rp-tiles">
            <div class="rp-tile"><p class="rp-tile-l">Total spent</p><p class="t-money rp-tile-v" data-v="spent">${L.inr(m.spent)}</p><p class="rp-tile-s">Paid into escrow, minus refunds</p></div>
            <div class="rp-tile"><p class="rp-tile-l">Total views</p><p class="t-money rp-tile-v" data-v="views">${num(m.views)}</p><p class="rp-tile-s">${m.viewed.length} live campaign${m.viewed.length === 1 ? "" : "s"}</p></div>
            <div class="rp-tile"><p class="rp-tile-l">Campaigns</p><p class="t-money rp-tile-v" data-v="camps">${m.camps.length}</p><p class="rp-tile-s">${[m.running && m.running + " running", m.done && m.done + " done", m.waiting && m.waiting + " waiting", m.refundedN && m.refundedN + " refunded"].filter(Boolean).join(" · ") || "None in this period"}</p></div>
            <div class="rp-tile"><p class="rp-tile-l">Cost per 1,000 views</p><p class="t-money rp-tile-v">${m.cpm == null ? "—" : L.inr(m.cpm * 1)}</p><p class="rp-tile-s">${m.cpm == null ? "Shows once a campaign is live" : "On campaigns with views"}</p></div>
          </div>
          ${empty ? `<div class="empty rp-empty"><p class="t-h2">Nothing in this period</p><p class="muted">No campaigns were hired or paid between these dates. Try a longer period.</p><button class="lq lq-s" type="button" data-p="all">See all time</button></div>` : ""}
        </section>

        <div class="rp-grid2">
        <section class="rp-sec rp-card" aria-labelledby="rpSpH">
          <div class="rp-sec-top"><div><h2 class="rp-h" id="rpSpH">Total spent</h2><p class="t-money rp-big">${L.inr(m.spent)}</p></div>
            <ul class="rp-legend" aria-label="Legend"><li><i class="rp-key"></i>Spent</li>${m.refunded ? '<li><i class="rp-key is-hatch"></i>Refunded</li>' : ""}</ul></div>
          <dl class="rp-eq">
            <div><dt>Paid into escrow</dt><dd>${L.inr(m.paidIn)}</dd></div>
            <div><dt>Refunds</dt><dd>${L.inr(-m.refunded)}</dd></div>
            <div class="is-total"><dt>Spent</dt><dd>${L.inr(m.spent)}</dd></div>
          </dl>
          <figure class="rp-fig" data-chart="spend"><div class="rp-svgw" data-draw="spend"></div><div class="rp-tip" role="presentation" hidden></div>
            <figcaption class="sr-only">${esc(
              `Spend by month, ${plabel}. ` +
                m.months
                  .filter(x => !x.future)
                  .map(
                    x =>
                      `${MONY(x.m)}: ${L.inr(x.spent)}${x.refunded ? `, ${L.inr(x.refunded)} refunded` : ""}`,
                  )
                  .join("; ") +
                ".",
            )}</figcaption></figure>
          <details class="rp-tbl"><summary>Show as a table</summary>
            <table><thead><tr><th scope="col">Month</th><th scope="col">Paid into escrow</th><th scope="col">Refunds</th><th scope="col">Spent</th></tr></thead>
            <tbody>${m.months
              .filter(x => !x.future)
              .map(
                x =>
                  `<tr><th scope="row">${esc(MONY(x.m))}</th><td>${L.inr(x.paidIn)}</td><td>${L.inr(x.refunded)}</td><td>${L.inr(x.spent)}</td></tr>`,
              )
              .join("")}</tbody></table></details>
        </section>

        <section class="rp-sec rp-card" aria-labelledby="rpViH">
          <div class="rp-sec-top"><div><h2 class="rp-h" id="rpViH">Total views</h2><p class="t-money rp-big">${num(m.views)}</p></div></div>
          ${
            views.length
              ? `<figure class="rp-fig" data-chart="views"><div class="rp-svgw" data-draw="views"></div><div class="rp-tip" role="presentation" hidden></div>
            <figcaption class="sr-only">${esc("Views by campaign: " + views.map(c => `${c.title} by ${L.creator(c.creator).name}, ${num(c.views)} views`).join("; ") + ".")}</figcaption></figure>
            <details class="rp-tbl"><summary>Show as a table</summary><table><thead><tr><th scope="col">Campaign</th><th scope="col">Creator</th><th scope="col">Views</th><th scope="col">Per 1,000 views</th></tr></thead>
            <tbody>${views.map(c => `<tr><th scope="row">${esc(c.title)}</th><td>${esc(L.creator(c.creator).name)}</td><td>${num(c.views)}</td><td>${L.inr((c.price / c.views) * 1000)}</td></tr>`).join("")}</tbody></table></details>`
              : `<p class="muted rp-none">No campaign in this period is live with views yet.</p>`
          }
          ${m.notLive.length ? `<div class="rp-pending"><p class="rp-pending-h">${ic("clock")}Views appear once these go live</p><ul>${m.notLive.map(c => `<li><a href="#campaign-${esc(c.id)}"><b>${esc(c.title)}</b><span>${esc(L.creator(c.creator).name)} · ${esc(plat(c.platform))} ${esc(c.format)}</span></a></li>`).join("")}</ul></div>` : ""}
        </section>
        </div>

        <section class="rp-sec rp-card" aria-labelledby="rpBuH">
          <div class="rp-sec-top"><div><h2 class="rp-h" id="rpBuH">Budget &amp; spending</h2>
            <p class="rp-bu-l"><span class="t-money rp-big">${L.inr(B.spent)}</span><span class="rp-bu-of">of ${L.inr(B.b.total)} spent · ${esc(B.b.label)}</span></p></div>
            <p class="rp-pace${B.over ? " is-over" : ""}">${ic(B.over ? "alert" : "check")}<span>${B.over ? `Spent and waiting payments come to ${L.inr(B.spent + B.committed)}, over the budget.` : `${Math.round(B.used * 100)}% used with ${Math.round(B.elapsed * 100)}% of the quarter gone. ${B.used <= B.elapsed ? "You are under pace." : "You are ahead of pace."}`}</span></p></div>
          <div class="rp-seg-bar" role="img" aria-label="${esc(`Budget ${L.inr(B.b.total)}: ` + segs.map(x => `${x[1]} ${L.inr(x[2])}, ${share(x[2])}%`).join("; "))}">
            ${segs.map(x => `<span class="rp-part is-${x[0]}" style="flex:${x[2]} 1 0" title="${esc(`${x[1]} ${L.inr(x[2])}`)}">${share(x[2]) >= 9 ? `<b>${share(x[2])}%</b>` : ""}</span>`).join("")}
          </div>
          <ul class="rp-legend rp-legend-b" aria-hidden="true">${segs.map(x => `<li><i class="rp-key is-${x[0]}"></i>${esc(x[1])} <b class="num">${L.inr(x[2])}</b></li>`).join("")}</ul>
          ${B.committedC.length ? `<p class="help rp-bu-n">Waiting for payment: ${B.committedC.map(c => `<a class="btn-q" href="#campaign-${esc(c.id)}">${esc(c.title)}</a> (${esc(L.creator(c.creator).name)}, ${c.stage === "accepted" ? "accepted" : "invited"})`).join(", ")}.</p>` : ""}
          <div class="rp-sec-top rp-sub"><h3 class="rp-h3">By month</h3><ul class="rp-legend" aria-label="Legend"><li><i class="rp-key"></i>Spent</li><li><i class="rp-key is-line"></i>Even pace</li></ul></div>
          <figure class="rp-fig" data-chart="budget"><div class="rp-svgw" data-draw="budget"></div><div class="rp-tip" role="presentation" hidden></div>
            <figcaption class="sr-only">${esc(`Spend by month against an even pace of ${L.inr(B.pace)} a month: ` + B.months.map(x => `${MONY(x.m)} ${x.future ? "not started" : L.inr(x.spent)}`).join("; ") + ".")}</figcaption></figure>
          <details class="rp-tbl"><summary>Show as a table</summary><table><thead><tr><th scope="col">Month</th><th scope="col">Even pace</th><th scope="col">Spent</th><th scope="col">Difference</th></tr></thead>
            <tbody>${B.months.map(x => `<tr><th scope="row">${esc(MONY(x.m))}</th><td>${L.inr(B.pace)}</td><td>${x.future ? "—" : L.inr(x.spent)}</td><td>${x.future ? "—" : x.spent > B.pace ? L.inr(x.spent - B.pace) + " over" : L.inr(B.pace - x.spent) + " under"}</td></tr>`).join("")}</tbody></table></details>
          <p class="help">Budget period ${esc(B.b.label)}. The period filter above doesn’t change this section. Change the budget in <a class="btn-q" href="#profile">your profile</a>.</p>
        </section>

        <section class="rp-sec rp-card rp-cw" aria-labelledby="rpCwH">
          <div class="rp-sec-top"><div><h2 class="rp-h" id="rpCwH">Creator-wise report</h2><p class="help">${esc(plabel)} · sorted by spend</p></div></div>
          ${
            m.creators.length
              ? `<div class="rp-tw"><table class="rp-cwt">
            <thead><tr><th scope="col">Creator</th><th scope="col">Campaigns</th><th scope="col">Spent</th><th scope="col">Views</th><th scope="col">Per 1,000 views</th><th scope="col">Rating given</th></tr></thead>
            <tbody>${m.creators
              .map(
                r => `<tr>
              <th scope="row" data-l="Creator"><a class="rp-who" href="#creator-${esc(r.cr.id)}"><span class="avatar msg-av${r.cr.tone === "b" ? " is-b" : ""}" aria-hidden="true">${esc(L.initials(r.cr.name))}</span><span><b>${esc(r.cr.name)}</b><span>${esc(r.cr.handle)}</span></span></a></th>
              <td data-l="Campaigns"><b class="num">${r.n}</b>${r.running || r.done ? `<span class="rp-cell-s">${[r.running && r.running + " running", r.done && r.done + " done"].filter(Boolean).join(" · ")}</span>` : ""}</td>
              <td data-l="Spent" class="num">${r.spent ? L.inr(r.spent) : `<span class="rp-cell-s">${s.campaigns.some(c => c.creator === r.cr.id && c.stage === "refunded") ? "Refunded" : "Not paid yet"}</span>`}</td>
              <td data-l="Views" class="num">${r.views ? num(r.views) : '<span class="rp-cell-s">Not live yet</span>'}</td>
              <td data-l="Per 1,000 views" class="num">${r.cpm == null ? "—" : L.inr(r.cpm)}</td>
              <td data-l="Rating given">${r.rating != null ? `<span class="rp-rate">${stars(r.rating)}<b class="num">${r.rating.toFixed(1)}</b><span class="sr-only"> out of 5 from ${r.ratedN} review${r.ratedN === 1 ? "" : "s"}</span></span>${r.unrated ? `<a class="btn-q rp-rate-a" href="#campaign-${esc(r.unrated.id)}">Rate ${esc(r.unrated.title)}</a>` : ""}` : r.unrated ? `<a class="btn-q" href="#campaign-${esc(r.unrated.id)}">${ic("star")}Rate now</a>` : '<span class="rp-cell-s">After completion</span>'}</td>
            </tr>`,
              )
              .join("")}</tbody>
            <tfoot><tr><th scope="row">All creators</th><td data-l="Campaigns" class="num">${sum(m.creators, r => r.n)}</td><td data-l="Spent" class="num">${L.inr(sum(m.creators, r => r.spent))}</td><td data-l="Views" class="num">${num(sum(m.creators, r => r.views))}</td><td data-l="Per 1,000 views" class="num">${m.cpm == null ? "—" : L.inr(m.cpm)}</td><td></td></tr></tfoot>
          </table></div>`
              : `<p class="muted rp-none">No creators were hired in this period.</p>`
          }
        </section>
      </div>`;

      /* charts drawn at the real container width */
      const draw = () => {
        const W = n => Math.floor(n.clientWidth) || 300;
        const sp = L.$('[data-draw="spend"]', el);
        sp && (sp.innerHTML = columns(m.months, W(sp), { label: "Spend by month" }));
        const vw = L.$('[data-draw="views"]', el);
        vw &&
          (vw.innerHTML = hbars(
            views.map(c => ({ label: c.title, sub: L.creator(c.creator).name, value: c.views })),
            W(vw),
          ));
        const bu = L.$('[data-draw="budget"]', el);
        bu &&
          (bu.innerHTML = columns(B.months, W(bu), { label: "Budget pace by month", ref: B.pace, h: 220 }));
      };
      draw();
      if (first) el.classList.add("rp-first");
      L.$$(".rp-fig", el).forEach(tips);
      ro && ro.disconnect();
      let lastW = 0;
      ro = new ResizeObserver(() => {
        const w = (L.$(".rp-svgw", el) || {}).clientWidth;
        if (w && Math.abs(w - lastW) > 2) {
          if (lastW) {
            el.classList.remove("rp-first");
            draw();
          }
          lastW = w;
        }
      });
      L.$$(".rp-svgw", el).forEach(n => ro.observe(n));
      L.liquid(el);
      if (first) {
        M().count(L.$('[data-v="spent"]', el), m.spent, L.inr);
        M().count(L.$('[data-v="views"]', el), m.views, num);
        M().stagger(L.$$(".rp-tile", el));
      }
      L.$$("[data-p]", el).forEach(b =>
        b.addEventListener("click", () => {
          if (b.dataset.p === per) return;
          const prev = model(per);
          per = ui.period = b.dataset.p;
          first = false;
          const open = L.$$("details", el).map(d => d.open),
            y = window.scrollY;
          paint();
          L.$$("details", el).forEach((d, i) => {
            if (open[i]) d.open = true;
          });
          window.scrollTo(0, y);
          const n = model(per);
          M().count(L.$('[data-v="spent"]', el), n.spent, L.inr, { from: prev.spent });
          M().count(L.$('[data-v="views"]', el), n.views, num, { from: prev.views });
          const nb = L.$(`.rp-seg [data-p="${per}"]`, el);
          nb && nb.focus({ preventScroll: true });
        }),
      );
      setTimeout(() => el.classList.remove("rp-first"), 900);
    };
    paint();
    return () => {
      ro && ro.disconnect();
    };
  }

  L.register("reports", { title: "Reports", nav: "reports", render });
})();
