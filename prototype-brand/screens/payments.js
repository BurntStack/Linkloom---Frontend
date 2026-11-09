/* Payments (#payments). Owned by Builder D. The brand-side sibling of the creator Earnings screen.
   Every total is derived from LLD_DATA.payments in integer paise, never typed in:
     paid in   = Σ escrow rows (every status)        released = Σ release rows        refunds = Σ refund rows
     held      = LLD.heldInEscrow() (escrow rows still 'held')  and  paid in − released − refunds === held (shown as a check).
   Subscription model: no platform fee on any row, the creator receives the agreed price; taxes are "as per confirmed rules".
   Each row downloads a printable invoice (.html via Blob) with the brand's billing details. Plans never show a price. */
(() => {
  const L = window.LLD, esc = L.esc, ic = L.icon, M = () => L.motion;
  const D = window.LLD_D = window.LLD_D || {};
  const sum = (rows, f = r => r.amount) => rows.reduce((n, r) => n + f(r), 0);
  const camp = id => L.store.s.campaigns.find(c => c.id === id);
  const first = n => n.split(' ')[0];
  const TODAY = '2026-11-04';
  const addDays = (iso, n) => { const d = L.D(iso); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

  D.money = () => {
    const p = L.store.s.payments, k = x => p.filter(r => r.kind === x);
    const paidIn = sum(k('escrow')), released = sum(k('release')), refunds = sum(k('refund')), held = L.heldInEscrow();
    return { paidIn, released, refunds, held, spent: paidIn - refunds, ok: paidIn - released - refunds === held };
  };

  /* ---------- labels ---------- */
  const releaseOf = r => L.store.s.payments.find(x => x.kind === 'release' && x.campaign === r.campaign);
  const refundOf = r => L.store.s.payments.find(x => x.kind === 'refund' && x.campaign === r.campaign);
  const PILL = r => {
    if (r.kind === 'release') return `<span class="pill pill-ok">${ic('check')}Paid to creator</span>`;
    if (r.kind === 'refund') return `<span class="pill pill-info">${ic('refund')}Refunded</span>`;
    if (r.status === 'held') return `<span class="pill pill-escrow">${ic('lock')}Held in escrow</span>`;
    if (r.status === 'released') { const x = releaseOf(r); return `<span class="pill pill-paper">${ic('check')}Released${x ? ' ' + esc(L.fmtDate(x.date)) : ''}</span>`; }
    if (r.status === 'refunded') { const x = refundOf(r); return `<span class="pill pill-paper">${ic('refund')}Refunded${x ? ' ' + esc(L.fmtDate(x.date)) : ''}</span>`; }
    return `<span class="pill pill-paper">${esc(r.status)}</span>`;
  };
  const KINDL = { escrow: 'Paid into escrow', release: 'Released to creator', refund: 'Refund to you' };
  const DOC = { escrow: 'Invoice', release: 'Release invoice', refund: 'Credit note' };
  const amt = r => (r.kind === 'refund' ? '+' : '') + L.inr(r.amount);
  const FILTERS = [['all', 'All'], ['escrow', 'Escrow'], ['release', 'Released'], ['refund', 'Refunded']];
  const RANGES = [['30', '30 days'], ['90', '90 days'], ['fy', 'This FY'], ['all', 'All time']];
  const rangeFrom = k => k === '30' ? addDays(TODAY, -30) : k === '90' ? addDays(TODAY, -90) : k === 'fy' ? '2026-04-01' : null;   // Indian FY starts 1 April
  const paidIn = k => {
    const from = rangeFrom(k), rows = L.store.s.payments.filter(r => r.kind === 'release' && (!from || r.date >= from));
    const start = from || rows.reduce((a, r) => (a && a < r.date ? a : r.date), null) || TODAY;
    return { total: sum(rows), n: rows.length, label: `${L.fmtDate(start, { year: start.slice(0, 4) !== TODAY.slice(0, 4) })} – ${L.fmtDate(TODAY, { year: true })}` };
  };

  /* ---------- the printable invoice (also used by reports and anyone else via LLD_D.invoice) ---------- */
  D.invoiceHTML = r => {
    const st = L.store.s, me = st.me, b = me.billing || {}, c = camp(r.campaign) || {}, cr = L.creator(r.creator) || {}, plan = st.plan;
    const doc = DOC[r.kind] || 'Invoice', when = L.fmtDate(r.date, { year: true });
    const plat = c.platform === 'youtube' ? 'YouTube' : c.platform === 'instagram' ? 'Instagram' : (c.platform || '');
    const line = r.kind === 'refund' ? `Refund of escrow · ${c.title || ''}` : r.kind === 'release' ? `Released from escrow to ${cr.name || 'the creator'} · ${c.title || ''}` : `Agreed price, held in escrow · ${c.title || ''}`;
    const totalL = r.kind === 'refund' ? 'Refunded to you' : r.kind === 'release' ? 'Paid to creator' : 'Total paid';
    const note = r.kind === 'refund' ? (c.refundReason || 'The escrow was returned to you in full.') + ' The refund goes back to the original payment method.'
      : r.kind === 'release' ? `Released on your approval. ${cr.name || 'The creator'} receives the agreed price in full.`
      : 'Linkloom holds this amount in escrow. It is released to the creator only when you approve the delivery, and refunded if the creator rejects after payment or does not deliver.';
    const x = s => esc(s == null ? '' : s);
    return `<!doctype html><html lang="en-IN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${x(doc)} ${x(r.invoice)} · Linkloom</title>
<style>
:root{--ink:#121212;--slate:#575757;--rule:#e4e4e4;--paper:#f8f8f8;--plum:#7a2e6e;--plum-bg:#f6e3f1}
*{box-sizing:border-box}html{background:var(--paper)}body{margin:0;padding:48px 16px;font:15px/1.5 "Figtree","Helvetica Neue",Arial,sans-serif;color:var(--ink);-webkit-font-smoothing:antialiased}
.inv{max-width:760px;margin:0 auto;padding:48px;background:#fff;border-radius:20px;box-shadow:0 18px 40px -26px rgba(18,18,18,.18)}
h1,h2,p{margin:0}.top{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;flex-wrap:wrap;padding-bottom:32px;border-bottom:1.5px solid var(--ink)}
.logo{font:400 26px/1 "Faculty Glyphic",Georgia,serif;letter-spacing:-.02em}.logo small{display:block;margin-top:8px;font:500 13px/18px "Figtree",Arial,sans-serif;color:var(--slate);letter-spacing:0}
.doc{text-align:right}.doc h1{font:400 34px/1.1 "Faculty Glyphic",Georgia,serif;letter-spacing:-.02em}.doc p{color:var(--slate);font-size:14px;font-variant-numeric:tabular-nums}.doc b{color:var(--ink)}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:24px 48px;padding:32px 0}.k{margin-bottom:8px;font-weight:700;font-size:11px;line-height:14px;letter-spacing:.08em;text-transform:uppercase;color:var(--slate)}
.cols p{font-size:14px;line-height:21px}.cols p b{font-size:15px}
table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}th{padding:0 0 12px;text-align:left;font-weight:700;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--slate);border-bottom:1px solid var(--rule)}
th:last-child,td:last-child{text-align:right}td{padding:16px 0;border-bottom:1px solid var(--rule);vertical-align:top}td small{display:block;color:var(--slate);font-size:13px}
tr.tot td{border-bottom:0;border-top:1.5px solid var(--ink);padding-top:20px;font-weight:600}tr.tot td:last-child{font:400 30px/1 "Faculty Glyphic",Georgia,serif;letter-spacing:-.02em}
.note{margin-top:32px;padding:16px 20px;border-radius:12px;background:var(--plum-bg);color:var(--plum);font-size:14px;line-height:20px}
.foot{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-top:32px;font-size:12px;line-height:18px;color:var(--slate)}
.bar{max-width:760px;margin:0 auto 16px;display:flex;justify-content:flex-end}.bar button{min-height:44px;padding:0 24px;border:1.5px solid var(--ink);border-radius:999px;background:var(--ink);color:#fff;font:600 14px/20px "Figtree",Arial,sans-serif;cursor:pointer}
.bar button:focus-visible{outline:2px solid var(--ink);outline-offset:3px}
@media (max-width:600px){body{padding:16px}.inv{padding:24px 20px}.cols{grid-template-columns:1fr}.doc{text-align:left}}
@media print{html,body{background:#fff}body{padding:0}.inv{box-shadow:none;padding:0;max-width:none}.bar{display:none}.note{border:1px solid var(--plum)}}
</style></head><body>
<div class="bar"><button type="button" onclick="window.print()">Print or save as PDF</button></div>
<main class="inv">
  <header class="top"><div class="logo">Linkloom<small>Creator marketplace · escrow-backed campaigns</small></div>
    <div class="doc"><h1>${x(doc)}</h1><p>No. <b>${x(r.invoice)}</b></p><p>Date <b>${x(when)}</b></p><p>Payment ID ${x(r.id.toUpperCase())}</p></div></header>
  <section class="cols">
    <div><p class="k">Billed to</p><p><b>${x(b.legal || me.brand)}</b><br>${x(b.address || '')}<br>GSTIN ${x(b.gstin || 'not added')}<br>${x(b.email || me.email)}<br>Attn. ${x(me.name)}, ${x(me.role || '')}</p></div>
    <div><p class="k">Creator</p><p><b>${x(cr.name || '')}</b><br>${x(cr.handle || '')}<br>${x([cr.city, cr.state].filter(Boolean).join(', '))}</p></div>
    <div><p class="k">Campaign</p><p><b>${x(c.title || '')}</b><br>${x([plat, c.format].filter(Boolean).join(' · '))}<br>${c.source === 'job' ? 'Hired from a job post' : 'Direct hire'} · ${x((c.id || '').toUpperCase())}</p></div>
    <div><p class="k">Payment</p><p><b>${x(KINDL[r.kind] || '')}</b><br>${x(r.method || '')}<br>Status: ${x({ held: 'Held in escrow', released: 'Released', refunded: 'Refunded' }[r.status] || r.status)}</p></div>
  </section>
  <table><thead><tr><th>Description</th><th>Amount</th></tr></thead><tbody>
    <tr><td>${x(line)}<small>Agreed price</small></td><td>${x(L.inr(r.amount, { dec: true }))}</td></tr>
    <tr><td>Platform fee<small>Linkloom runs on a subscription</small></td><td>No platform fee</td></tr>
    <tr><td>Taxes</td><td>As per confirmed rules</td></tr>
    <tr class="tot"><td>${x(totalL)}</td><td>${x(L.inr(r.amount, { dec: true }))}</td></tr>
  </tbody></table>
  <p class="note">${x(note)}</p>
  <footer class="foot"><span>${x(plan ? plan.name + ' · renews ' + L.fmtDate(plan.renews, { year: true }) : '')}. No per-campaign fee.</span><span>Computer-generated document. Sample data.</span></footer>
</main></body></html>`;
  };
  D.downloadInvoice = r => {
    try {
      const blob = new Blob([D.invoiceHTML(r)], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = `${r.invoice}.html`; a.rel = 'noopener'; document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      return true;
    } catch (e) { console.error(e); return false; }
  };

  /* the ink slip (creator Earnings' payout slip, brand words) */
  const slip = r => {
    const c = camp(r.campaign) || {}, cr = L.creator(r.creator) || {};
    const head = r.kind === 'escrow' ? 'Escrow payment' : r.kind === 'release' ? 'Release to creator' : 'Refund';
    const netL = r.kind === 'escrow' ? 'You paid' : r.kind === 'release' ? `Paid to ${first(cr.name || 'creator')}` : 'Back to you';
    return `<div class="earnings-slip-w">
      <article class="earnings-slip dark" aria-label="${esc(head)}">
        <header class="earnings-slip-h"><span>${esc(head)}</span>${PILL(r)}</header>
        <p class="earnings-slip-who"><b>${esc(cr.name || '')}</b><span>${esc(c.title || '')}</span></p>
        <dl class="earnings-slip-rows">
          <div><dt>Agreed price</dt><dd>${L.inr(r.amount, { dec: true })}</dd></div>
          <div><dt>Platform fee</dt><dd>No platform fee</dd></div>
          <div><dt>Taxes</dt><dd>As per confirmed rules</dd></div>
          <div><dt>${r.kind === 'refund' ? 'Back to' : 'Method'}</dt><dd>${esc(r.method)}</dd></div>
        </dl>
        <div class="earnings-slip-net"><span>${esc(netL)}</span><span class="earnings-slip-amt">${amt(r)}</span></div>
        ${r.kind === 'refund' && c.refundReason ? `<p class="earnings-slip-why">${esc(c.refundReason)}</p>` : ''}
        <p class="earnings-slip-f">${esc(DOC[r.kind])} ${esc(r.invoice)} · ${esc(L.fmtDate(r.date, { year: true }))}</p>
        <button class="lq lq-p pay-slip-dl" type="button" data-dl="${esc(r.id)}">${ic('download', 'ic')}Download ${esc(DOC[r.kind].toLowerCase())}</button>
      </article></div>`;
  };
  const feed = n => { if (!n) return; if (n.matches('.earnings-slip-w') && n.firstElementChild) n = n.firstElementChild; M().print ? M().print(n) : M().reveal(n); };
  const narrow = () => matchMedia('(max-width:900px)').matches;
  const dateBlock = d => `<span class="earnings-date"><b>${L.D(d).toLocaleDateString('en-IN', { day: 'numeric', timeZone: 'Asia/Kolkata' })}</b><span>${L.D(d).toLocaleDateString('en-IN', { month: 'short', timeZone: 'Asia/Kolkata' })}</span></span>`;

  function render(el, param) {
    const s = L.store.s, ui = s.ui.pay || (s.ui.pay = {});
    /* deep link #payments-<paymentId> (from a campaign's invoice list): open that slip with every row visible */
    if (param && s.payments.some(x => x.id === param)) { ui.pick = param; ui.filter = 'all'; ui.range = 'all'; }
    if (!s.payments.length) {
      el.innerHTML = `<div class="view-in earnings"><h1 class="t-h1">Payments</h1>
        <div class="empty earnings-empty"><img src="assets/step-06-coins.svg" width="220" height="160" alt="">
          <p class="t-h2">No payments yet</p><p class="muted">When a creator accepts and you pay into escrow, the payment shows up here with an invoice you can download.</p>
          <a class="lq lq-p" href="#creators">Find creators</a></div></div>`;
      return;
    }
    const m = D.money(), rows = [...s.payments].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
    let range = RANGES.some(r => r[0] === ui.range) ? ui.range : 'fy', f = FILTERS.some(x => x[0] === ui.filter) ? ui.filter : 'all';
    let pick = rows.find(r => r.id === ui.pick) ? ui.pick : rows[0].id;
    const live = s.campaigns.filter(c => s.payments.some(p => p.kind === 'escrow' && p.status === 'held' && p.campaign === c.id)).length;
    const E = paidIn(range), cnt = k => k === 'all' ? rows.length : rows.filter(r => r.kind === k).length;
    const refunds = rows.filter(r => r.kind === 'refund');
    const plan = s.plan;

    el.innerHTML = `<div class="view-in earnings pay">
      <div class="earnings-top"><h1 class="t-h1">Payments</h1><span class="sample">Sample data · amounts in ₹</span>${plan && plan.renews ? `<span class="earnings-plan">${esc(plan.name)} · renews ${esc(L.fmtDate(plan.renews))}</span>` : ''}</div>

      <section class="earnings-hero butter" aria-labelledby="payHeldH">
        <div class="earnings-hero-a">
          <h2 class="earnings-hero-l pay-hero-l" id="payHeldH">${ic('lock')}Held in escrow</h2>
          <p class="earnings-ready"><span class="earnings-rs">₹</span><span data-held>${L.inr(m.held).slice(1)}</span></p>
          <p class="earnings-ready-sub">For ${live} running campaign${live === 1 ? '' : 's'}. Linkloom holds it until you approve the work, and refunds it if the creator rejects after payment or doesn’t deliver.</p>
          <div class="earnings-cta">
            <a class="lq lq-p lq-xl" href="#campaigns">Review deliveries</a>
            <span class="earnings-to">No platform fee. Taxes as per confirmed rules.</span>
          </div>
        </div>
        <div class="earnings-recon">
          <p class="earnings-recon-h">How it adds up</p>
          <dl>
            <div><dt>Paid into escrow, all time</dt><dd>${L.inr(m.paidIn)}</dd></div>
            <div><dt>Released to creators</dt><dd>${L.inr(-m.released)}</dd></div>
            <div><dt>Refunded to you</dt><dd>${L.inr(-m.refunds)}</dd></div>
            <div class="is-total"><dt>Held in escrow</dt><dd>${L.inr(m.held)}</dd></div>
          </dl>
          <p class="earnings-recon-ok${m.ok ? '' : ' is-off'}">${ic(m.ok ? 'check' : 'alert')}<span>${m.ok ? 'Matches your payment history.' : 'Does not match your payment history. Linkloom support has been told.'}</span></p>
          <p class="t-note earnings-recon-note" aria-hidden="true">to the paisa</p>
        </div>
      </section>

      <div class="earnings-grid">
        <div class="earnings-main">
          <section class="earnings-total" aria-labelledby="payTotH">
            <div class="earnings-total-t">
              <h2 class="earnings-sec-h" id="payTotH">Total paid to creators</h2>
              <p class="t-money earnings-total-n" data-total>${L.inr(E.total)}</p>
              <p class="earnings-total-r"><span data-range>${esc(E.label)}</span> · <span data-n>${E.n} release${E.n === 1 ? '' : 's'}</span></p>
              <p class="help">Agreed prices released on your approval. Money still in escrow is not counted.</p>
            </div>
            <div class="seg earnings-range" role="group" aria-label="Date range">
              ${RANGES.map(([k, n]) => `<button type="button" data-r="${k}" aria-pressed="${k === range}">${n}</button>`).join('')}
            </div>
          </section>

          <section class="earnings-sec" aria-labelledby="payHisH">
            <div class="earnings-sec-top">
              <h2 class="earnings-sec-h" id="payHisH">Payment history</h2>
              <div class="chips earnings-filter" role="group" aria-label="Filter payments">
                ${FILTERS.map(([k, n]) => `<button class="chip" type="button" data-f="${k}" aria-pressed="${k === f}">${n} <span class="earnings-chip-n">${cnt(k)}</span></button>`).join('')}
              </div>
            </div>
            <ol class="earnings-list pay-list">${rows.map(r => { const c = camp(r.campaign) || {}, cr = L.creator(r.creator) || {}; return `<li class="earnings-row pay-row" data-kind="${esc(r.kind)}">
              <button type="button" class="earnings-row-b pay-row-b" data-pick="${esc(r.id)}" aria-pressed="${r.id === pick}" aria-label="${esc(`${L.fmtDate(r.date, { year: true })}, ${KINDL[r.kind]}, ${cr.name}, ${c.title}, ${amt(r)}. Open payment slip`)}">
                ${dateBlock(r.date)}
                <span class="earnings-what"><b>${esc(cr.name || '')}</b><span>${esc(KINDL[r.kind])} · ${esc(c.title || '')}</span></span>
                <span class="earnings-amt"><b class="t-money">${amt(r)}</b></span>
                ${PILL(r)}
              </button>
              <button type="button" class="ibtn pay-dl" data-dl="${esc(r.id)}" aria-label="${esc(`Download ${DOC[r.kind].toLowerCase()} ${r.invoice}`)}" title="Download ${esc(DOC[r.kind].toLowerCase())}">${ic('download')}</button>
            </li>`; }).join('')}</ol>
            <p class="earnings-none muted" hidden>Nothing of this kind yet.</p>
            <p class="help pay-hint">${ic('file')}<span>Each row has an invoice with your billing details: ${esc((s.me.billing || {}).legal || s.me.brand)}, GSTIN ${esc((s.me.billing || {}).gstin || 'not added')}. <a class="btn-q" href="#profile">Edit billing</a></span></p>
          </section>

          <section class="earnings-sec" aria-labelledby="payRefH">
            <div class="earnings-sec-top"><h2 class="earnings-sec-h" id="payRefH">Refunds</h2><span class="help">${refunds.length ? `${L.inr(m.refunds)} back to you` : 'None so far'}</span></div>
            <div class="pay-ref-why">
              <p class="pay-ref-h">When you get a refund</p>
              <ul class="chat-rules pay-rules">
                <li>${ic('close')}<span><b>The creator rejects after you pay.</b> The full agreed price comes back from escrow.</span></li>
                <li>${ic('clock')}<span><b>The creator doesn’t deliver.</b> If nothing arrives by the due date and can’t be fixed, Linkloom returns your escrow in full.</span></li>
                <li>${ic('refund')}<span>Refunds go back to the method you paid with, usually in 5 to 7 working days, with a credit note.</span></li>
              </ul>
            </div>
            ${refunds.length ? `<ol class="pay-refs">${refunds.map(r => { const c = camp(r.campaign) || {}, cr = L.creator(r.creator) || {}; const paid = s.payments.find(x => x.kind === 'escrow' && x.campaign === r.campaign); return `<li class="pay-ref">
              <div class="pay-ref-t"><span class="avatar msg-av${cr.tone === 'b' ? ' is-b' : ''}" aria-hidden="true">${esc(L.initials(cr.name || '?'))}</span>
                <div><b>${esc(c.title || '')}</b><span>${esc(cr.name || '')} · paid ${paid ? esc(L.fmtDate(paid.date)) : ''}, refunded ${esc(L.fmtDate(r.date, { year: true }))}</span></div>
                <b class="t-money pay-ref-a">+${L.inr(r.amount)}</b></div>
              <p class="pay-ref-r"><span class="pill pill-info">${ic('refund')}Refunded</span><span>${esc(c.refundReason || 'Escrow returned in full.')}</span></p>
              <div class="pay-ref-f"><span class="help">${esc(r.method)} · Credit note ${esc(r.invoice)}</span><button class="btn-q" type="button" data-dl="${esc(r.id)}">${ic('download')}Download credit note</button></div>
            </li>`; }).join('')}</ol>` : ''}
          </section>
        </div>

        <aside class="earnings-side" aria-label="Payment slip" aria-live="polite" data-slip>${slip(rows.find(r => r.id === pick))}</aside>
      </div>
    </div>`;

    L.liquid(el);
    M().count(L.$('[data-held]', el), m.held, p => L.inr(p).slice(1));

    L.$$('.earnings-range button', el).forEach(b => b.addEventListener('click', () => {
      range = ui.range = b.dataset.r;
      L.$$('.earnings-range button', el).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      const e = paidIn(range);
      L.$('[data-range]', el).textContent = e.label; L.$('[data-n]', el).textContent = `${e.n} release${e.n === 1 ? '' : 's'}`;
      M().count(L.$('[data-total]', el), e.total, L.inr);
    }));
    const lis = L.$$('.pay-row', el), none = L.$('.earnings-none', el);
    const apply = () => { let n = 0; lis.forEach(r => { const on = f === 'all' || r.dataset.kind === f; r.hidden = !on; n += on; }); none.hidden = n > 0; };
    apply();
    L.$$('.earnings-filter .chip', el).forEach(b => b.addEventListener('click', () => {
      f = ui.filter = b.dataset.f;
      L.$$('.earnings-filter .chip', el).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      M().flip(apply, lis);
    }));
    L.$$('[data-pick]', el).forEach(b => b.addEventListener('click', () => {
      const r = s.payments.find(x => x.id === b.dataset.pick); if (!r) return;
      pick = ui.pick = r.id;
      L.$$('[data-pick]', el).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      if (narrow()) { L.openSheet({ title: 'Payment slip', body: `<div class="earnings-sheet-slip">${slip(r)}</div>`, onMount: bd => { L.liquid(bd); feed(L.$('.earnings-slip-w', bd)); } }); return; }
      const side = L.$('[data-slip]', el); side.innerHTML = slip(r); L.liquid(side); feed(side.firstElementChild);
    }));
    /* invoice download: one handler for row buttons, the slip, the refund card and the phone sheet */
    const onDl = e => {
      const b = e.target.closest('[data-dl]'); if (!b) return;
      const r = s.payments.find(x => x.id === b.dataset.dl); if (!r) return;
      if (!D.downloadInvoice(r)) { L.toast('The invoice could not be made. Try again.', 'alert'); return; }
      const svg = b.querySelector('svg');
      if (svg && b.classList.contains('pay-dl')) { svg.outerHTML = ic('check'); b.classList.add('is-done'); M().check && M().check(b); setTimeout(() => { if (b.isConnected) { b.querySelector('svg').outerHTML = ic('download'); b.classList.remove('is-done'); } }, 2400); }
      const sl = b.closest('.earnings-slip'); sl && M().bump && M().bump(sl, 1.01);
      L.toast(`${DOC[r.kind]} ${r.invoice} downloaded`, 'check');
    };
    el.addEventListener('click', onDl);
    document.addEventListener('click', onSheetDl);
    function onSheetDl(e) { if (e.target.closest('.sheet [data-dl]')) onDl(e); }
    M().stagger(lis.filter(r => !r.hidden));
    const lk = L.$('.pay-hero-l svg', el); lk && setTimeout(() => M().lock && lk.isConnected && M().lock(lk, { color: 'plum' }), 500);
    return () => document.removeEventListener('click', onSheetDl);
  }

  L.register('payments', { title: 'Payments', nav: 'payments', render });
})();
