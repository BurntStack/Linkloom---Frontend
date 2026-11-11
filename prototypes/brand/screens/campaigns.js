/* Brand side · Campaigns (#campaigns), one campaign (#campaign-<id>) and LLD.payEscrow(campaignId). Builder C.
   Mirrors the creator Active jobs list and work page (ticket list, stage rail with a money lane, a "now" panel, paperwork).
   Stages: invited → accepted → funded → in_progress → submitted → revision → approved → released, or declined / cancelled / refunded.
   Colour is meaning: violet = your move (the brand), coral = the creator's move, plum = money held in escrow. */
(() => {
  const L = window.LLD, esc = L.esc, ic = L.icon;
  const S = () => window.LLD_DATA;
  const K = () => L.bk;

  const STAGES = [
    { k: 'invited', n: 'Invited', nJob: 'Bid' }, { k: 'accepted', n: 'Accepted' }, { k: 'funded', n: 'Paid in' }, { k: 'in_progress', n: 'In progress' },
    { k: 'submitted', n: 'Delivered' }, { k: 'revision', n: 'Revision' }, { k: 'approved', n: 'Approved' }, { k: 'released', n: 'Released' }
  ];
  const LONG = {
    invited: 'Invitation sent, waiting for the creator', accepted: 'Accepted, waiting for your payment', funded: 'Paid into escrow, creator is starting',
    in_progress: 'Creator is making the content', submitted: 'Delivered, waiting for your review', revision: 'Revision asked, creator is on it',
    approved: 'Approved, release the payment', released: 'Paid and complete', declined: 'Creator declined the invitation',
    cancelled: 'You cancelled the invitation', refunded: 'Refunded to you'
  };
  const ENDS = { declined: 'Declined', cancelled: 'Cancelled', refunded: 'Refunded' };
  const HELD = ['funded', 'in_progress', 'submitted', 'revision', 'approved'];
  const who = c => ({ accepted: 'you', submitted: 'you', approved: 'you', released: c.review ? 'done' : 'you', invited: 'creator', funded: 'creator', in_progress: 'creator', revision: 'creator' })[c.stage] || 'done';
  const whoPill = c => ({ you: '<span class="pill pill-violet">Your move</span>', creator: '<span class="pill pill-coral">Creator’s move</span>', done: '<span class="pill pill-ok">Done</span>' })[who(c)];
  const ix = c => { const i = STAGES.findIndex(x => x.k === c.stage); return i >= 0 ? i : reached(c); };
  /* where an ended campaign stopped on the rail */
  const reached = c => c.stage === 'refunded' ? (c.refundedFrom ? STAGES.findIndex(x => x.k === c.refundedFrom) : c.funded ? 2 : 1) : 0;
  const isEnd = c => !!ENDS[c.stage];
  const payState = c => c.stage === 'released' ? 'released' : c.stage === 'refunded' ? 'refunded' : HELD.includes(c.stage) ? 'held' : 'none';
  const payPill = c => ({
    none: `<span class="pill pill-line">${c.stage === 'accepted' ? 'Not paid yet' : 'Nothing paid'}</span>`,
    held: `<span class="pill pill-escrow cg-lockin">${lockIc()}In escrow</span>`,
    released: `<span class="pill pill-ok">${ic('check')}Released</span>`,
    refunded: `<span class="pill pill-paper">${ic('refund')}Refunded</span>`
  })[payState(c)];
  const lockIc = () => ic('lock').replace(/<path d="[^"]*"\/>/, '<path class="cg-shackle" d="M7 11V8a5 5 0 0 1 10 0v3"/><path d="M5 11h14v10H5z"/>');
  const logAt = (c, kind) => { const e = (c.log || []).filter(x => x[1] === kind).pop(); return e ? e[0] : null; };
  const log = (c, kind) => { (c.log = c.log || []).push([K().nowISO(), kind]); };
  const thread = c => S().threads.find(t => t.id === c.thread) || S().threads.find(t => t.campaign === c.id) || null;
  const deal = c => { const j = c.job ? K().job(c.job) : null; return { brief: j ? j.brief : null, usage: j ? j.usage : null, languages: j ? j.languages : null, deliverables: (c.deliverables && c.deliverables.length ? c.deliverables : j ? j.deliverables : []) || [], items: dlItems(c, j) }; };
  /* deliverable lines: the cart's structured items when present ({platform, format, count, notes}), else the plain strings */
  const dlItems = (c, j) => (Array.isArray(c.items) && c.items.length)
    ? c.items.map(it => ({ p: it.platform || c.platform, t: `${it.count || 1} ${it.format || c.format || 'post'}${(it.count || 1) > 1 && !/s$/.test(it.format || '') ? 's' : ''} on ${K().plat(it.platform || c.platform)}`, sub: it.notes || '' }))
    : ((c.deliverables && c.deliverables.length ? c.deliverables : j ? j.deliverables : []) || []).map(x => ({ t: x, sub: '' }));
  const due = c => {
    if (c.stage === 'released') return c.released ? 'Paid ' + L.fmtDate(c.released) : 'Paid';
    if (isEnd(c)) return ENDS[c.stage] + (c[c.stage] ? ' ' + L.fmtDate(c[c.stage]) : '');
    if (!c.due) return 'No date set';
    const n = K().daysTo(c.due);
    return n < 0 ? `${-n} day${n === -1 ? '' : 's'} late` : n === 0 ? 'Due today' : `Due ${L.fmtDate(c.due)} · ${n} day${n === 1 ? '' : 's'} left`;
  };
  const next = c => {
    const k = K().cr(c.creator), f = K().first(k), d = c.deliveries || [];
    return ({
      invited: `Waiting for ${f} to accept. Nothing is paid until then.`,
      accepted: `${f} accepted. Pay ${L.inr(c.price)} into escrow to start.`,
      funded: `${f} has the brief and is starting.`,
      in_progress: `${f} is making it. ${c.due ? 'Due ' + L.fmtDate(c.due) + '.' : ''}`,
      submitted: `v${d.length || 1} is in. Approve it or ask for a revision.`,
      revision: `You asked: “${c.revisionNote || 'see chat'}”`,
      approved: `Approved. Release ${L.inr(c.price)} to ${f}.`,
      released: c.review ? `You rated ${f} ${c.review.rating} of 5.` : `Paid. Rate and review ${f}.`,
      declined: c.declineNote ? `${f} declined: “${c.declineNote}”` : `${f} declined. Nothing was paid.`,
      cancelled: 'You cancelled before it was accepted. Nothing was paid.',
      refunded: c.refundReason || 'Escrow returned in full.'
    })[c.stage] || '';
  };
  const order = c => ({ you: 0, creator: 1, done: 2 })[who(c)];
  const sorted = list => [...list].sort((x, y) => order(x) - order(y) || String(x.due || '').localeCompare(String(y.due || '')));
  const campPays = c => S().payments.filter(p => p.campaign === c.id);

  /* ====================================================================================
     #campaigns: one ticket per hire, grouped by whose move it is
     ==================================================================================== */
  const FILTERS = [['all', 'All'], ['you', 'Your move'], ['creator', 'Creator’s move'], ['done', 'Done']];
  const GROUPS = [['you', 'Your move'], ['creator', 'Creator’s move'], ['done', 'Done']];

  function ticket(c) {
    const k = K().cr(c.creator), i = ix(c), t = thread(c), w = who(c), used = (c.revisionsUsed || 0) > 0, end = isEnd(c);
    const mini = STAGES.map((st, n) => {
      const skip = st.k === 'revision' && !used && n !== i;
      const cls = end ? (n < i || (n === i && c.stage === 'refunded') ? 'is-done' : n === i ? 'is-end' : 'is-off') : n < i && !skip ? 'is-done' : n === i ? 'is-now' : '';
      return `<li class="${cls}${skip && !end ? ' is-skip' : ''}"></li>`;
    }).join('');
    const late = !end && c.stage !== 'released' && c.due && K().daysTo(c.due) < 0;
    return `<li class="cg-tk${end ? ' is-ended' : ''}" data-who="${w}" data-id="${esc(c.id)}">
      <div class="cg-tk-a">
        ${K().cav(k)}
        <div class="cg-tk-tx">
          <p class="cg-tk-brand">${esc(k.name)}<span aria-hidden="true">·</span>${K().glyph(c.platform)}<span>${esc(c.format || '')}</span><span aria-hidden="true">·</span><span>${c.source === 'job' ? 'From a job' : 'Direct invite'}</span></p>
          <h3 class="cg-tk-t"><a class="cg-tk-link" href="#campaign-${esc(c.id)}">${esc(c.title)}</a></h3>
          <p class="cg-tk-next">${esc(next(c))}</p>
        </div>
      </div>
      <div class="cg-tk-rail">
        <ol class="cg-mini" aria-label="${esc(LONG[c.stage] || c.stage)}">${mini}</ol>
        <p class="cg-tk-stage">${whoPill(c)}<span>${esc(LONG[c.stage] || '')}</span></p>
      </div>
      <div class="cg-tk-m">
        <p class="t-money cg-tk-price">${L.inr(c.price)}</p>
        ${payPill(c)}
        <p class="cg-tk-due${late ? ' is-late' : ''}">${ic('clock')}<span>${esc(due(c))}</span></p>
      </div>
      ${t ? `<a class="cg-tk-chat" href="#chat-${esc(t.id)}" aria-label="Chat with ${esc(k.name)}${t.unread ? `, ${t.unread} unread` : ''}">${ic('chat')}${t.unread ? `<b>${t.unread}</b>` : ''}</a>` : ''}
    </li>`;
  }

  function renderList(el) {
    const s = S(), u = K().ui('camps');
    if (!s.campaigns.length) {
      el.innerHTML = `<div class="view-in cg"><header class="cg-head"><div class="cg-head-t"><h1 class="t-h1">Campaigns</h1></div></header>
        <div class="empty cg-empty"><img src="assets/trust-lock-coin.svg" width="200" height="140" alt="">
          <p class="t-h2">No campaigns yet</p><p class="muted">When you hire from a job or a creator accepts your invitation, it lands here with its stage, payment and chat.</p>
          <div class="row wrap cg-empty-cta"><a class="lq lq-p" href="#creators">Find creators</a><a class="lq lq-s" href="#post">Post a job</a></div></div></div>`;
      L.liquid(el); return;
    }
    let f = FILTERS.some(x => x[0] === u.f) ? u.f : 'all';
    const list = sorted(s.campaigns), held = L.heldInEscrow();
    const count = k => (k === 'all' ? list.length : list.filter(c => who(c) === k).length);
    el.innerHTML = `<div class="view-in cg">
      <header class="cg-head">
        <div class="cg-head-t"><h1 class="t-h1">Campaigns</h1>
          <p class="muted">Every hire, from your jobs and direct invitations. ${count('you')} need${count('you') === 1 ? 's' : ''} you. <span class="sample">Sample data</span></p></div>
        <div class="cg-held">
          <span class="cg-coin" aria-hidden="true">₹</span>
          <p><span class="cg-held-l">Held in escrow</span><b class="t-money" data-held>${L.inr(held)}</b></p>
          <p class="t-note cg-held-note" aria-hidden="true">released only when you approve</p>
        </div>
      </header>
      <div class="seg cg-seg" role="group" aria-label="Filter campaigns">${FILTERS.map(([k, n]) => `<button type="button" data-f="${k}" aria-pressed="${k === f}">${n}<span class="cg-seg-n">${count(k)}</span></button>`).join('')}</div>
      <div class="cg-groups">${GROUPS.map(([k, n]) => {
        const rows = list.filter(c => who(c) === k);
        return rows.length ? `<section class="cg-group" data-g="${k}" aria-labelledby="cgg-${k}"><h2 class="jl-gh" id="cgg-${k}"><span class="t-h2">${n}</span><span class="jl-gn num">${rows.length}</span></h2>
          <ol class="cg-list">${rows.map(ticket).join('')}</ol></section>` : '';
      }).join('')}</div>
      <p class="cg-none muted" hidden>Nothing here right now.</p>
    </div>`;
    const groups = L.$$('.cg-group', el), none = L.$('.cg-none', el);
    const apply = () => { let n = 0; groups.forEach(g => { const on = f === 'all' || g.dataset.g === f; g.hidden = !on; n += on; }); none.hidden = n > 0; };
    apply();
    L.$$('.cg-seg button', el).forEach(b => b.addEventListener('click', () => {
      if (b.dataset.f === f) return;
      f = u.f = b.dataset.f;
      L.$$('.cg-seg button', el).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      K().flip(apply, L.$$('.cg-tk', el));
    }));
    K().mo('count', L.$('[data-held]', el), held, L.inr);
    K().mo('stagger', L.$$('.cg-tk', el).filter(r => !r.closest('[hidden]')));
  }
  L.register('campaigns', { title: 'Campaigns', nav: 'campaigns', render: renderList });

  /* ====================================================================================
     #campaign-<id>: the production board for one hire
     ==================================================================================== */
  const LOGT = {
    invited: () => 'Invitation sent', accepted: c => c.source === 'job' ? `Bid confirmed at ${L.inr(c.price)}` : `Accepted at ${L.inr(c.price)}`,
    funded: c => `${L.inr(c.price)} paid into escrow`, in_progress: () => 'Work started', submitted: () => 'Delivery received', revision: () => 'Revision asked',
    approved: () => 'Delivery approved', released: c => `${L.inr(c.price)} released to the creator`, declined: () => 'Invitation declined',
    cancelled: () => 'You cancelled the invitation', invite: () => 'Invitation sent', sent: () => 'Invitation sent', refunded: c => `${L.inr(c.price)} refunded to you`, reviewed: () => 'You left a review'
  };

  function rail(c, from) {
    const cur = ix(c), end = isEnd(c), used = c.revisionsUsed || 0, inc = c.revisionsIncluded || 1;
    const pull0 = Math.max(0, Math.min(from == null ? cur - 1 : from, cur - 1));
    const dateOf = { invited: logAt(c, 'invited'), accepted: logAt(c, 'accepted'), funded: logAt(c, 'funded') || c.funded, in_progress: logAt(c, 'in_progress'),
      submitted: logAt(c, 'submitted') || ((c.deliveries || [])[0] || {}).at, revision: logAt(c, 'revision'), approved: logAt(c, 'approved'), released: logAt(c, 'released') || c.released };
    const ahead = { accepted: 'Creator accepts', funded: 'You pay in', in_progress: 'Creator starts', submitted: c.due ? 'Due ' + L.fmtDate(c.due) : 'Delivery', approved: 'You approve', released: 'You release' };
    const nodes = (end ? STAGES.slice(0, c.stage === 'refunded' ? cur + 1 : cur + 1) : STAGES).map((st, i) => {
      let cls = i < cur ? 'is-done' : i === cur && !end ? 'is-now' : i === cur ? 'is-done' : 'is-next', sub, state = i < cur || (end && i === cur) ? 'done' : i === cur ? 'current stage' : 'not yet';
      if (i <= cur && dateOf[st.k]) sub = (i === cur && !end ? 'Now · ' : '') + L.fmtDate(dateOf[st.k]);
      else if (i === cur && !end) sub = 'Now';
      else if (i < cur && st.k === 'invited' && c.source === 'job') sub = 'From your job';
      else sub = i < cur ? 'Done' : ahead[st.k] || '';
      if (st.k === 'revision' && i !== cur) {
        if (used) { sub = `${used} of ${inc} used`; if (i > cur) cls = 'is-next is-used'; }
        else { cls = (i < cur ? 'is-done' : 'is-next') + ' is-skip'; sub = i < cur ? 'Not needed' : 'Only if needed'; state = i < cur ? 'not needed' : 'only if needed'; }
      }
      const name = st.k === 'invited' && c.source === 'job' ? st.nJob : st.n;
      const pull = !end && i >= pull0 && i < cur ? ` is-pull" style="--k:${i - pull0}` : '';
      return `<li class="cw-node ${cls}${pull}"${i === cur && !end ? ` aria-current="step" style="--k:${Math.max(0, cur - pull0)}"` : ''}>
        <span class="cw-nh"><span class="cw-n" aria-hidden="true">0${i + 1}</span><span class="cw-nt">${esc(name)}<span class="sr-only">, ${state}</span></span></span>
        <span class="cw-rl" aria-hidden="true"><i></i></span><span class="cw-nd">${esc(sub)}</span></li>`;
    });
    if (end) nodes.push(`<li class="cw-node is-end is-${c.stage}" aria-current="step"><span class="cw-nh"><span class="cw-n" aria-hidden="true">—</span><span class="cw-nt">${ENDS[c.stage]}<span class="sr-only">, where it ended</span></span></span>
      <span class="cw-rl" aria-hidden="true"><i>${ic(c.stage === 'refunded' ? 'refund' : 'close')}</i></span><span class="cw-nd">${c[c.stage] ? L.fmtDate(c[c.stage]) : c.stage === 'cancelled' ? 'By you' : 'By the creator'}</span></li>`);
    return nodes.join('');
  }

  function money(c) {
    const st = payState(c), k = K().cr(c.creator), f = K().first(k);
    const fund = logAt(c, 'funded') || c.funded, rel = logAt(c, 'released') || c.released, ref = c.refunded;
    const inTxt = st === 'none' ? (c.stage === 'accepted' ? 'Your move: pay to start' : 'After the creator accepts') : 'Paid ' + (fund ? L.fmtDate(fund) : '');
    return `<div class="cw-money" data-pay="${st}">
      <div class="cw-mn cw-mn-in${st === 'none' ? (c.stage === 'accepted' ? ' is-now' : '') : ' is-done'}"><span class="cw-mdot" data-slot="in" aria-hidden="true"></span><b>Paid in</b><span>${esc(inTxt)}</span></div>
      <div class="cw-mn cw-mn-hold${st === 'held' ? ' is-now' : st === 'none' ? '' : ' is-done'}"><span class="cw-mdot" data-slot="hold" aria-hidden="true"></span><b>Held in escrow</b><span>${st === 'held' ? 'Since ' + L.fmtDate(fund || K().nowISO()) + ' · by Linkloom' : st === 'none' ? 'Linkloom holds it while the work happens' : st === 'released' ? 'Until you approved' : 'Until the refund'}</span><span class="cw-band" aria-hidden="true"></span></div>
      <div class="cw-mn cw-mn-out${st === 'released' || st === 'refunded' ? ' is-now' : ''}"><span class="cw-mdot" data-slot="out" aria-hidden="true"></span><b>${st === 'refunded' ? 'Refunded to you' : 'Released to ' + esc(f)}</b><span>${st === 'released' ? L.fmtDate(rel || K().nowISO()) : st === 'refunded' ? (ref ? L.fmtDate(ref) : 'In full') : 'When you approve'}</span></div>
    </div>`;
  }

  function reviewForm(c, k) {
    const labels = ['Poor', 'Fair', 'Good', 'Very good', 'Great'], r = c.review || {};
    return `<form class="cw-review" novalidate>
      <fieldset class="cw-rate"><legend class="t-label">How was working with ${esc(K().first(k))}?</legend>
        <div class="cw-stars" role="radiogroup">${labels.map((t, i) => `<label class="cw-star"><input type="radio" name="rate" value="${i + 1}"${r.rating === i + 1 ? ' checked' : ''}><span class="cw-star-i">${ic('star')}</span><small>${t}</small></label>`).join('')}</div>
      </fieldset>
      <div class="field"><label for="cwRvTx">Your review <span class="muted">(shows on ${esc(K().first(k))}’s profile)</span></label>
        <textarea class="textarea" id="cwRvTx" maxlength="400" rows="3" placeholder="Was it on time, on brief, easy to work with? What did your audience think?">${esc(r.text || '')}</textarea>
        <p class="help num" id="cwRvN">${(r.text || '').length} / 400</p></div>
      <p class="err" id="cwRvErr" aria-live="polite"></p>
      <div class="row wrap"><button class="lq lq-p" type="submit">${c.review ? 'Update review' : 'Save review'}</button>${c.review ? '<button class="lq lq-s" type="button" data-rvcancel>Cancel</button>' : ''}</div>
      <p class="help">Your rating counts toward ${esc(K().first(k))}’s average, which brands filter by in creator search.</p>
    </form>`;
  }
  const starsRow = n => `<span class="cw-starrow" aria-label="${n} out of 5">${[1, 2, 3, 4, 5].map(i => `<span class="${i <= n ? 'is-on' : ''}">${ic('star')}</span>`).join('')}</span>`;

  function nowPanel(c, ui) {
    const k = K().cr(c.creator), f = K().first(k), t = thread(c), d = c.deliveries || [], last = d[d.length - 1];
    const head = title => `<div class="cw-now-h">${whoPill(c)}<h2 class="t-h2" id="cwNowH">${esc(title)}</h2></div>`;
    const sample = btns => `<div class="bk-sample" role="group" aria-label="Sample controls for the creator side"><p><span class="sample">Sample</span> Creator side, for this demo</p><div class="row wrap">${btns}</div></div>`;
    const chatBtn = t ? `<a class="lq lq-s lq-sm" href="#chat-${esc(t.id)}">${ic('chat')}Chat with ${esc(f)}</a>` : '';
    const file = (x, cur) => x ? `<div class="cw-dv${cur ? ' is-cur' : ''}"><span class="cw-v">v${x.v}</span><span class="cw-dv-n"><b>${esc(x.file)}</b><span class="muted">${esc(L.fmtDate(x.at) + ', ' + K().time(x.at))}</span></span><button class="btn-q" type="button" data-openfile="${esc(x.file)}">${ic('download')}Open</button></div>` : '';
    const revMeter = () => { const inc = c.revisionsIncluded || 1, used = c.revisionsUsed || 0; return `<p class="cw-revs"><span class="cw-revs-d" aria-hidden="true">${Array.from({ length: inc }, (_, i) => `<i class="${i < used ? 'is-used' : ''}"></i>`).join('')}</span><span>Revisions used <b class="num">${used} of ${inc}</b> included</span></p>`; };
    switch (c.stage) {
      case 'invited':
        return `${head(`Waiting for ${f} to accept`)}
          <p class="cw-now-p">You invited ${esc(f)} on ${esc(L.fmtDate(logAt(c, 'invited') || K().nowISO()))} for ${L.inr(c.price)}. Creators usually answer within two days. Nothing is paid until ${esc(f)} accepts, so you can still cancel.</p>
          <div class="row wrap"><button class="lq lq-s" type="button" data-cancelinv>Cancel invitation</button></div>
          ${sample('<button class="lq lq-s lq-sm" type="button" data-cr="accept">Accept the invitation</button><button class="lq lq-s lq-sm" type="button" data-cr="decline">Decline it</button>')}`;
      case 'accepted':
        return `${head('Pay into escrow to start')}
          <p class="cw-now-p">${esc(f)} ${c.source === 'job' ? 'is confirmed' : 'accepted'}. Pay the agreed price into escrow. Linkloom holds it, ${esc(f)} sees it is paid and starts, and it is released only when you approve.</p>
          <p class="cw-due"><span class="t-money" data-amt>${L.inr(c.price)}</span><span class="muted">No platform fee. Taxes as per confirmed rules.</span></p>
          <button class="lq lq-p" type="button" data-payescrow>${ic('lock')}Pay ${L.inr(c.price)} into escrow</button>
          <p class="help cw-chatlock">${ic('chat')}Chat with ${esc(f)} opens once you pay.</p>`;
      case 'funded':
      case 'in_progress':
        return `${head(c.stage === 'funded' ? `${f} is starting` : `${f} is making it`)}
          <p class="cw-now-p">${L.inr(c.price)} is held in escrow. ${c.due ? `The delivery is due ${esc(L.fmtDate(c.due))}. ` : ''}You get a notification when it is in.</p>
          <div class="row wrap">${chatBtn}</div>
          ${sample(`${c.stage === 'funded' ? '<button class="lq lq-s lq-sm" type="button" data-cr="start">Start work</button>' : ''}<button class="lq lq-s lq-sm" type="button" data-cr="deliver">Submit a delivery</button>`)}`;
      case 'submitted': {
        const inc = c.revisionsIncluded || 1, used = c.revisionsUsed || 0, canRev = used < inc;
        return `${head('Review the delivery')}
          ${file(last, true)}
          ${last && last.note ? `<figure class="cw-note"><blockquote class="cw-quote"><p>“${esc(last.note)}”</p></blockquote><figcaption>${K().cav(k)}<span><b>${esc(k.name)}</b><span class="muted">Note with v${last.v}</span></span></figcaption></figure>` : ''}
          ${revMeter()}
          <div class="field cw-vnote" id="fVnote"><label for="cwVnote">Note for ${esc(f)} <span class="muted">(needed for a revision)</span></label>
            <textarea class="textarea" id="cwVnote" rows="3" maxlength="300" placeholder="What should change? Be specific: the hook, a line, a frame." aria-describedby="cwVnoteErr">${esc(ui.vnote || '')}</textarea>
            <p class="err" id="cwVnoteErr"></p></div>
          <div class="row wrap cw-verify"><button class="lq lq-p" type="button" data-approve>${ic('check')}Approve delivery</button><button class="lq lq-s" type="button" data-revise ${canRev ? '' : 'disabled aria-disabled="true"'}>Request revision</button></div>
          <p class="help">${canRev ? 'Approving does not pay yet. You release the payment as the next step.' : `All ${inc} included revision${inc === 1 ? ' is' : 's are'} used. Approve, or talk to ${esc(f)} in chat about more changes.`}</p>`;
      }
      case 'revision':
        return `${head('Revision asked')}
          <figure class="cw-note is-you"><blockquote class="cw-quote"><p>“${esc(c.revisionNote || 'See chat for the changes.')}”</p></blockquote>
            <figcaption><span class="avatar v" aria-hidden="true">${esc(L.initials(S().me.brand))}</span><span><b>You</b><span class="muted">${logAt(c, 'revision') ? esc(L.fmtDate(logAt(c, 'revision')) + ', ' + K().time(logAt(c, 'revision'))) : ''} · on v${(last || {}).v || 1}</span></span></figcaption></figure>
          ${revMeter()}
          <p class="cw-now-p">${esc(f)} is working on it. The next version shows up here for you to review.</p>
          <div class="row wrap">${chatBtn}</div>
          ${sample('<button class="lq lq-s lq-sm" type="button" data-cr="deliver">Send the next version</button>')}`;
      case 'approved':
        return `${head(`Release ${L.inr(c.price)} to ${f}`)}
          <p class="cw-now-p">You approved v${(last || {}).v || 1} on ${esc(L.fmtDate(logAt(c, 'approved') || K().nowISO()))}. Releasing moves the money from escrow to ${esc(f)}. This can’t be undone.</p>
          <button class="lq lq-p" type="button" data-release>Release payment</button>`;
      case 'released': {
        const top = `${head(c.review && !ui.editReview ? 'Done. Thank you.' : `Rate and review ${f}`)}
          <p class="cw-now-p">${L.inr(c.price)} was released to ${esc(f)} on ${esc(L.fmtDate(logAt(c, 'released') || c.released || K().nowISO()))}.${c.views ? ` The post has ${esc(L.compact(c.views))} views so far.` : ''}</p>
          ${c.liveUrl ? `<p class="cw-file-now">${ic('link')}<span><b>Live post</b><span class="muted">${esc(c.liveUrl)}</span></span></p>` : ''}`;
        if (c.review && !ui.editReview) return `${top}<div class="cw-myrev">${starsRow(c.review.rating)}<p class="cw-myrev-t">${c.review.text ? '“' + esc(c.review.text) + '”' : '<span class="muted">No written review.</span>'}</p><p class="help">Your review · ${esc(L.fmtDate(c.review.at))}</p><button class="btn-q" type="button" data-editrev>${ic('edit')}Edit review</button></div>`;
        return top + reviewForm(c, k);
      }
      case 'refunded': {
        const p = campPays(c).find(x => x.kind === 'refund');
        return `${head('Refunded')}
          <figure class="cw-note"><blockquote class="cw-quote"><p>“${esc(c.refundReason || 'Escrow returned in full.')}”</p></blockquote><figcaption><span class="cw-sys" aria-hidden="true">${ic('refund')}</span><span><b>Refund reason</b><span class="muted">${c.refunded ? esc(L.fmtDate(c.refunded, { year: true })) : ''}</span></span></figcaption></figure>
          <dl class="cw-kv"><div class="kv"><dt>Returned to you</dt><dd>${L.inr(c.price)}</dd></div>${p ? `<div class="kv"><dt>To</dt><dd>${esc(p.method)}</dd></div><div class="kv"><dt>Credit note</dt><dd>${esc(p.invoice)}</dd></div>` : ''}</dl>
          <a class="lq lq-s" href="#payments${p ? '-' + esc(p.id) : ''}">See it in payments</a>`;
      }
      case 'declined':
        return `${head(`${f} declined`)}
          ${c.declineNote ? `<figure class="cw-note"><blockquote class="cw-quote"><p>“${esc(c.declineNote)}”</p></blockquote><figcaption>${K().cav(k)}<span><b>${esc(k.name)}</b><span class="muted">${c.declined ? esc(L.fmtDate(c.declined)) + ' · ' : ''}Their note</span></span></figcaption></figure>` : ''}
          <p class="cw-now-p">${esc(f)} could not take this one on. Nothing was paid, so there is nothing to refund.</p>
          <div class="row wrap"><a class="lq lq-p" href="#creators">Find similar creators</a><a class="lq lq-s" href="#creator-${esc(k.id)}">View ${esc(f)}’s profile</a></div>`;
      case 'cancelled':
        return `${head('Invitation cancelled')}
          <p class="cw-now-p">You cancelled this invitation${c.cancelled ? ' on ' + esc(L.fmtDate(c.cancelled)) : ''}, before ${esc(f)} accepted. Nothing was paid.</p>
          <div class="row wrap"><a class="lq lq-s" href="#creator-${esc(k.id)}">Invite ${esc(f)} again</a></div>`;
      default: return head(LONG[c.stage] || c.stage);
    }
  }

  function renderCampaign(el, id) {
    const s = S(), c = s.campaigns.find(x => x.id === id);
    if (!c) {
      el.innerHTML = `<div class="view-in"><div class="empty"><img src="assets/step-05-stamp.svg" width="200" height="146" alt=""><p class="t-h2">This campaign isn’t here</p><p class="muted">The link may be old. Your other campaigns are safe.</p><a class="lq lq-p" href="#campaigns">Back to campaigns</a></div></div>`;
      L.liquid(el); return;
    }
    const ui = {};
    let seen = null, firstPaint = true;
    const set = (fn, why) => L.store.set(st => fn(c, st), why);

    const paint = (o = {}) => {
      const k = K().cr(c.creator), f = K().first(k), d = deal(c), t = thread(c), last = t && t.messages.filter(m => m.from !== 'system').slice(-1)[0];
      const pays = campPays(c), dv = c.deliveries || [], w = who(c), held = payState(c) === 'held';
      const late = !isEnd(c) && c.stage !== 'released' && c.due && K().daysTo(c.due) < 0;
      const prev = seen;
      el.innerHTML = `<div class="view-in cw" data-who="${w}">
        <a class="btn-q cw-back" href="#campaigns">${ic('back')}<span>Campaigns</span></a>
        <header class="cw-head">
          <div class="cw-head-t">
            <p class="cw-brand">${K().cav(k)}<span><b>${esc(k.name)}${K().ver(k)}</b><span class="muted">${K().glyph(c.platform)}${esc(K().plat(c.platform))} ${esc(c.format || '')} · ${c.source === 'job' ? 'hired from a job' : 'direct invite'}</span></span><span class="sample">Sample</span></p>
            <h1 class="t-h1">${esc(c.title)}</h1>
          </div>
          <div class="cw-head-m">
            <p class="cw-price"><span class="t-money" data-price>${L.inr(c.price)}</span><span class="muted">agreed price · no platform fee</span></p>
            <div class="row wrap">${payPill(c)}${t ? `<a class="lq lq-s lq-sm" href="#chat-${esc(t.id)}">${ic('chat')}Chat${t.unread ? ` · ${t.unread} new` : ''}</a>` : `<span class="pill pill-line cw-chat-off">${ic('lock')}Chat opens after payment</span>`}</div>
          </div>
        </header>

        <section class="card cw-board" aria-labelledby="cwBoardH">
          <h2 class="sr-only" id="cwBoardH">Where this campaign stands</h2>
          <div class="cw-lane"><p class="cw-lane-h">Work</p>
            <ol class="cw-rail" style="--n:8">${rail(c, prev)}</ol></div>
          <div class="cw-lane cw-lane-m"><p class="cw-lane-h">Money <span>tracked apart from the work</span></p>
            ${money(c)}
            <p class="cw-money-note">${({ none: c.stage === 'accepted' ? `Nothing has moved yet. Pay ${L.inr(c.price)} into escrow and ${esc(f)} starts.` : 'Nothing is paid before the creator accepts.',
              held: `${L.inr(c.price)} sits with Linkloom. It goes to ${esc(f)} only when you approve, and back to you if the work is not delivered.`,
              released: `Released on your approval. ${esc(f)} received the agreed price in full.`, refunded: 'Returned to you in full. No fee was kept.' })[payState(c)]}</p></div>
          <span class="cw-coin" aria-hidden="true">₹</span>
        </section>

        <div class="cw-grid">
          <div class="cw-main">
            <section class="card cw-now" aria-labelledby="cwNowH" aria-live="polite">${nowPanel(c, ui)}</section>
            <section class="cw-sec" aria-labelledby="cwBriefH">
              <h2 class="cw-sec-h" id="cwBriefH">${c.source === 'job' ? 'Brief' : 'What you asked for'}</h2>
              ${d.brief ? `<p class="cw-brief">${esc(d.brief)}</p>` : `<p class="cw-brief">${c.source === 'job' ? 'The brief was agreed when you confirmed the bid. Changes since then are in the chat.' : `A direct invitation for one ${esc((c.format || 'post').toLowerCase())} on ${esc(K().plat(c.platform))}.`}</p>`}
              <dl class="cw-facts">
                <div><dt>Platform</dt><dd>${esc(K().plat(c.platform) + ' ' + (c.format || ''))}</dd></div>
                <div><dt>Due</dt><dd>${c.due ? esc(L.fmtDate(c.due, { year: true })) : '—'}</dd></div>
                <div><dt>Revisions</dt><dd>${c.revisionsIncluded || 1} included</dd></div>
                ${d.usage ? `<div><dt>Usage rights</dt><dd>${esc(d.usage)}</dd></div>` : ''}
              </dl>
              ${d.items.length ? `<ol class="cw-dl">${d.items.map((x, i) => `<li class="${c.stage === 'released' || c.stage === 'approved' ? 'is-ok' : ''}"><span class="cw-dl-n" aria-hidden="true">0${i + 1}</span><span class="cw-dl-t">${x.p ? K().glyph(x.p) : ''}<span>${esc(x.t)}${x.sub ? `<span class="muted">${esc(x.sub)}</span>` : ''}</span></span>${c.stage === 'released' || c.stage === 'approved' ? '<span class="pill pill-ok">Approved</span>' : ''}</li>`).join('')}</ol>` : ''}
              ${c.job ? `<a class="btn-q" href="#job-${esc(c.job)}">Open the job${ic('arrow')}</a>` : ''}
            </section>
            <section class="cw-sec" aria-labelledby="cwFilesH">
              <h2 class="cw-sec-h" id="cwFilesH">Deliveries</h2>
              ${dv.length ? `<ol class="cw-files">${dv.slice().reverse().map((x, i) => `<li><span class="cw-v">v${x.v}</span><span class="cw-files-n"><b>${esc(x.file)}</b><span class="muted">${esc(L.fmtDate(x.at) + ', ' + K().time(x.at))}${x.note ? ' · ' + esc(x.note) : ''}</span></span>${i === 0 ? '<span class="pill pill-paper">Latest</span>' : ''}</li>`).join('')}</ol>`
                : `<p class="muted cw-files-none">${['released'].includes(c.stage) ? 'Delivered and approved before this sample started.' : 'Nothing delivered yet. Each version the creator sends shows up here.'}</p>`}
            </section>
          </div>

          <aside class="cw-side" aria-label="Payment and details">
            <div class="cw-slip ink-card">
              <p class="cw-slip-h">${({ none: 'To pay into escrow', held: 'In escrow', released: 'Paid to ' + esc(f), refunded: 'Refunded to you' })[payState(c)]}</p>
              <p class="cw-slip-amt"><span class="t-money" data-slipamt>${L.inr(c.price)}</span></p>
              <dl class="cw-slip-rows"><div><dt>Agreed price</dt><dd>${L.inr(c.price)}</dd></div><div><dt>Taxes</dt><dd>As per confirmed rules</dd></div></dl>
              <p class="cw-slip-s">No platform fee. You are on the Brand plan.</p>
              ${pays.length ? `<ul class="cw-inv">${pays.map(p => `<li><a href="#payments-${esc(p.id)}">${ic('file')}<span><b>${esc(p.invoice)}</b><span>${esc({ escrow: 'Escrow payment', release: 'Release', refund: 'Refund' }[p.kind] || p.kind)} · ${esc(L.fmtDate(p.date))}</span></span>${ic('download')}</a></li>`).join('')}</ul>` : '<p class="cw-slip-s">The invoice appears here once you pay.</p>'}
            </div>
            ${t ? `<a class="cw-chat" href="#chat-${esc(t.id)}">${K().cav(k)}<span class="cw-chat-t"><b>Chat with ${esc(f)}</b><span class="muted">${last ? esc((last.from === 'brand' ? 'You: ' : '') + (last.text || (last.file ? last.file.name : ''))) : 'Say hello'}</span></span>${t.unread ? `<span class="cw-chat-n" aria-label="${t.unread} unread">${t.unread}</span>` : ic('chevron')}</a>`
              : `<div class="cw-chat is-locked"><span class="cw-lockic" aria-hidden="true">${ic('lock')}</span><span class="cw-chat-t"><b>Chat opens after payment</b><span class="muted">${isEnd(c) ? 'This campaign closed before any payment.' : c.stage === 'invited' ? `Once ${esc(f)} accepts and you pay into escrow, you can message and share files here.` : `Pay into escrow and you can message ${esc(f)} and share files here.`}</span></span></div>`}
            <section class="cw-sec" aria-labelledby="cwDatesH">
              <h2 class="cw-sec-h" id="cwDatesH">Dates</h2>
              <dl>
                <div class="kv"><dt>${c.source === 'job' ? 'Hired' : 'Invited'}</dt><dd>${esc(L.fmtDate(logAt(c, 'invited') || logAt(c, 'accepted') || c.funded || K().nowISO()))}</dd></div>
                <div class="kv"><dt>Paid into escrow</dt><dd>${c.funded ? esc(L.fmtDate(c.funded)) : '—'}</dd></div>
                <div class="kv"><dt>Due</dt><dd class="${late ? 'cw-late' : ''}">${c.due ? esc(L.fmtDate(c.due)) + (late ? ' · late' : '') : '—'}</dd></div>
                <div class="kv"><dt>${c.stage === 'refunded' ? 'Refunded' : 'Released'}</dt><dd>${c.released ? esc(L.fmtDate(c.released)) : c.refunded ? esc(L.fmtDate(c.refunded)) : '—'}</dd></div>
              </dl>
            </section>
            ${(c.log || []).length ? `<section class="cw-sec" aria-labelledby="cwLogH"><h2 class="cw-sec-h" id="cwLogH">Log</h2>
              <ol class="cw-log">${c.log.slice().reverse().map(e => `<li><span>${esc((LOGT[e[1]] || (() => e[1]))(c))}</span><time datetime="${esc(e[0])}">${esc(L.fmtDate(e[0]) + ', ' + K().time(e[0]))}</time></li>`).join('')}</ol></section>` : ''}
          </aside>
        </div>
      </div>`;
      const coin = L.$('.cw-coin', el), st = payState(c), slot = st === 'none' ? null : L.$(`[data-slot="${st === 'held' ? 'hold' : 'out'}"]`, el);
      if (slot) slot.append(coin); else coin.hidden = true;
      L.liquid(el);
      seen = ix(c);
      wire();
      /* the rail: a thread pulls from the stage you left to the one you reached (once per advance) */
      if (prev != null && prev < seen && !o.noPull) {
        const nodes = L.$$('.cw-node', el), a = nodes[prev] && nodes[prev].querySelector('.cw-rl i'), b = nodes[seen] && nodes[seen].querySelector('.cw-rl i');
        a && b && K().mo('pull', a, b, { color: w === 'you' ? 'violet' : w === 'done' ? 'ink' : 'coral' });
      }
      if (firstPaint) { firstPaint = false; K().mo('stagger', L.$$('.cw-node', el)); }
    };

    const wire = () => {
      const q = x => L.$(x, el), k = K().cr(c.creator), f = K().first(k);
      q('[data-payescrow]') && q('[data-payescrow]').addEventListener('click', () => L.payEscrow(c.id));
      q('[data-cancelinv]') && q('[data-cancelinv]').addEventListener('click', () => {
        K().confirm({
          title: 'Cancel this invitation?', yes: 'Cancel invitation', no: 'Keep it', danger: true,
          mini: `<div class="jl-mini">${K().crChip(k)}<p class="t-money jl-mini-p">${L.inr(c.price)}</p><p class="t-small muted">${esc(c.title)}</p></div>`,
          bullets: [`${f} is told the invitation was withdrawn.`, 'Nothing was paid, so there is nothing to refund.', `You can invite ${f} again later.`],
          onYes() {
            set(x => { x.stage = 'cancelled'; x.cancelled = K().nowISO(); log(x, 'cancelled'); }, 'invite-cancelled');
            K().notify('cancelled', `You cancelled the invitation to ${k.name} for ${c.title}.`, '#campaign-' + c.id);
            L.toast('Invitation cancelled', 'check'); paint();
          }
        });
      });
      L.$$('[data-cr]', el).forEach(b => b.addEventListener('click', () => creatorSide(b.dataset.cr)));
      L.$$('[data-openfile]', el).forEach(b => b.addEventListener('click', () => L.toast('Sample file. In the live app it opens the video here.', 'file')));
      const vn = q('#cwVnote'); vn && vn.addEventListener('input', () => { ui.vnote = vn.value; if (vn.value.trim()) { q('#fVnote').classList.remove('is-err'); q('#cwVnoteErr').textContent = ''; } });
      q('[data-approve]') && q('[data-approve]').addEventListener('click', () => {
        const note = (vn && vn.value.trim()) || '', t = thread(c), at = K().nowISO(), v = (c.deliveries || []).slice(-1)[0];
        set((x, st) => {
          x.stage = 'approved'; log(x, 'approved');
          if (t) { const tt = st.threads.find(y => y.id === t.id); note && tt.messages.push({ from: 'brand', text: note, at }); tt.messages.push({ from: 'system', kind: 'approved', text: `You approved v${v ? v.v : 1}. Release the payment next.`, at }); }
        }, 'delivery-approved');
        ui.vnote = '';
        L.toast(`Approved. Release ${L.inr(c.price)} when you are ready.`, 'check'); paint();
      });
      q('[data-revise]') && q('[data-revise]').addEventListener('click', () => {
        const note = vn ? vn.value.trim() : '';
        if (note.length < 8) { q('#fVnote').classList.add('is-err'); q('#cwVnoteErr').textContent = note ? 'Say a little more, so the creator knows exactly what to change.' : `Tell ${f} what to change.`; vn.setAttribute('aria-invalid', 'true'); vn.focus(); K().mo('shake', q('#fVnote')); return; }
        const t = thread(c), at = K().nowISO();
        set((x, st) => { x.stage = 'revision'; x.revisionsUsed = (x.revisionsUsed || 0) + 1; x.revisionNote = note; log(x, 'revision'); if (t) st.threads.find(y => y.id === t.id).messages.push({ from: 'brand', text: note, at }); }, 'revision-asked');
        ui.vnote = '';
        L.toast(`Revision sent to ${f}`, 'send'); paint();
      });
      q('[data-release]') && q('[data-release]').addEventListener('click', () => {
        K().confirm({
          title: `Release ${L.inr(c.price)} to ${f}?`, yes: 'Release payment', no: 'Not yet',
          mini: `<div class="jl-mini">${K().crChip(k)}<p class="t-money jl-mini-p">${L.inr(c.price)}</p><p class="t-small muted">${esc(c.title)}</p></div>`,
          bullets: [`${f} receives ${L.inr(c.price)}, the agreed price, in full.`, 'It leaves escrow now and can’t be undone.', 'The release appears in Payments with its invoice.'],
          onYes() { release(); }
        });
      });
      L.$$('[data-editrev]', el).forEach(b => b.addEventListener('click', () => { ui.editReview = true; paint({ noPull: true }); const r = q('.cw-review input[name=rate]:checked') || q('.cw-review input[name=rate]'); r && r.focus(); }));
      const rf = q('.cw-review');
      if (rf) {
        const tx = q('#cwRvTx');
        tx.addEventListener('input', () => { q('#cwRvN').textContent = `${tx.value.length} / 400`; });
        const cx = q('[data-rvcancel]'); cx && cx.addEventListener('click', () => { ui.editReview = false; paint({ noPull: true }); });
        rf.addEventListener('submit', e => {
          e.preventDefault();
          const r = rf.querySelector('input[name=rate]:checked');
          if (!r) { q('#cwRvErr').textContent = 'Pick a rating from 1 to 5 stars.'; rf.querySelector('input[name=rate]').focus(); return; }
          const rating = +r.value, old = c.review ? c.review.rating : null;
          set((x, st) => {
            x.review = { rating, text: tx.value.trim(), at: K().todayISO() };
            if (old == null) log(x, 'reviewed');
            /* reviews feed the creator's average, which the rating filter in search reads */
            const cc = st.creators.find(y => y.id === x.creator);
            if (cc) {
              const n = cc.reviews || 0, avg = cc.rating || 0;
              if (old == null) { cc.rating = Math.round(((avg * n + rating) / (n + 1)) * 10) / 10; cc.reviews = n + 1; }
              else if (n) cc.rating = Math.round(((avg * n - old + rating) / n) * 10) / 10;
            }
          }, 'review-saved');
          ui.editReview = false;
          L.toast(old == null ? `Review saved. It now counts in ${f}’s rating.` : 'Review updated', 'check');
          paint({ noPull: true });
          K().mo('bump', L.$('.cw-starrow', el));
        });
      }
    };

    /* sample controls: what the creator does on their side, so the whole flow can be walked here */
    const creatorSide = kind => {
      const k = K().cr(c.creator), at = K().nowISO(), t = thread(c);
      if (kind === 'accept') {
        set(x => { x.stage = 'accepted'; log(x, 'accepted'); }, 'invite-accepted');
        K().notify('accepted', `${k.name} accepted your invitation. Pay into escrow to start.`, '#campaign-' + c.id);
        L.toast(`${K().first(k)} accepted`, 'check');
      } else if (kind === 'decline') {
        set(x => { x.stage = 'declined'; x.declined = at; log(x, 'declined'); }, 'invite-declined');
        K().notify('declined', `${k.name} declined your invitation for ${c.title}.`, '#campaign-' + c.id);
        L.toast(`${K().first(k)} declined`, 'close');
      } else if (kind === 'start') {
        set(x => { x.stage = 'in_progress'; log(x, 'in_progress'); }, 'work-started');
      } else if (kind === 'deliver') {
        const n = (c.deliveries || []).length + 1, slug = c.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 28);
        const file = `${slug}-v${n}.${c.format === 'Carousel' ? 'zip' : 'mp4'}`, note = n === 1 ? 'First cut. Product is on screen in the first 3 s.' : 'Changed as you asked. Everything else is the same.';
        set((x, st) => {
          (x.deliveries = x.deliveries || []).push({ v: n, file, at, note }); x.stage = 'submitted'; log(x, 'submitted');
          if (t) { const tt = st.threads.find(y => y.id === t.id); tt.messages.push({ from: 'creator', file: { name: file, size: '52 MB' }, text: note, at }); tt.unread = (tt.unread || 0) + 1; }
        }, 'delivery-submitted');
        K().notify('delivery', `${k.name} submitted v${n} for ${c.title}`, '#campaign-' + c.id);
        L.toast(`v${n} is in. Review it here.`, 'file');
      }
      paint();
    };

    const release = () => {
      const k = K().cr(c.creator), at = K().nowISO(), t = thread(c), inv = K().nextInvoice();
      set((x, st) => {
        st.payments.forEach(p => { if (p.campaign === x.id && p.kind === 'escrow' && p.status === 'held') p.status = 'released'; });
        st.payments.unshift({ id: 'p' + Date.now().toString(36), date: K().todayISO(), kind: 'release', campaign: x.id, creator: x.creator, amount: x.price, status: 'released', method: 'From escrow', invoice: inv });
        x.stage = 'released'; x.released = at; log(x, 'released');
        if (t) st.threads.find(y => y.id === t.id).messages.push({ from: 'system', kind: 'released', text: `${L.inr(x.price)} released to ${k.name}.`, at });
      }, 'payment-released');
      K().notify('payment', `${L.inr(c.price)} released to ${k.name} for ${c.title}`, '#payments');
      paint({ noPull: true });
      K().mo('celebrate', L.$('.cw-board', el));
      L.toast(`${L.inr(c.price)} released to ${K().first(k)}`, 'check');
    };

    paint();
    if (payState(c) === 'held' && !L.RM) { const p = L.$('.cw-head-m .pill-escrow', el); p && setTimeout(() => K().mo('lock', p), 420); }
    const off = L.store.on(why => { if (why === 'escrow-paid') paint(); });
    return () => off();
  }

  L.register('campaign', {
    title: p => { const c = S().campaigns.find(x => x.id === p); return c ? c.title : 'Campaign'; },
    crumb: p => { const c = S().campaigns.find(x => x.id === p), k = c && L.creator(c.creator); return '<a href="#campaigns">Campaigns</a>' + (k ? ' / ' + esc(k.name) : ''); },
    nav: 'campaigns', render: renderCampaign
  });

  /* ====================================================================================
     LLD.payEscrow(campaignId): the pay sheet. Other screens call it (for example the cart or home).
     ==================================================================================== */
  const MIC = { upi: 'send', nb: 'home', card: 'wallet' };
  L.payEscrow = function (cid) {
    const c = S().campaigns.find(x => x.id === cid); if (!c) { L.toast('That campaign could not be found', 'alert'); return; }
    const k = K().cr(c.creator), f = K().first(k), u = K().ui('pay'), methods = S().payMethods || [];
    if (c.stage !== 'accepted') {
      const paid = payState(c) !== 'none';
      L.openSheet({ title: 'Pay into escrow', body: `<div class="stack pe"><p class="t-h2">${paid ? 'This campaign is already paid.' : `Waiting for ${esc(f)} to accept.`}</p>
        <p class="muted">${paid ? 'The money is in escrow or already released. See the campaign for where it stands.' : 'You pay only after the creator accepts. You get a notification when they do.'}</p>
        <div class="row wrap"><a class="lq lq-p" href="#campaign-${esc(c.id)}" data-close-go>Open campaign</a></div></div>`,
        onMount(b, close) { b.querySelector('[data-close-go]').addEventListener('click', () => close(true)); } });
      return;
    }
    const sel = methods.some(m => m.id === u.method) ? u.method : (methods[0] || {}).id;
    L.openSheet({
      title: 'Pay into escrow',
      body: `<div class="pe">
        <div class="pe-slip">
          <div class="pe-who">${K().crChip(k)}</div>
          <p class="t-small muted">${esc(c.title)}</p>
          <p class="pe-lab">Agreed price</p>
          <p class="t-money pe-amt" data-amt>${L.inr(c.price)}</p>
          <p class="pe-line">No platform fee. Taxes as per confirmed rules.</p>
        </div>
        <fieldset class="pe-methods"><legend class="t-label">Pay with</legend>
          ${methods.map(m => `<label class="pe-m"><input type="radio" name="pm" value="${esc(m.id)}"${m.id === sel ? ' checked' : ''}><span class="pe-m-ic" aria-hidden="true">${ic(MIC[m.id] || 'coin')}</span><span class="pe-m-t"><b>${esc(m.label)}</b><span>${esc(m.detail)}</span></span><span class="pe-m-k" aria-hidden="true">${ic('check')}</span></label>`).join('')}
        </fieldset>
        <ul class="jl-conseq pe-rules"><li>Linkloom holds the money. ${esc(f)} sees it is paid and starts.</li><li>It is released only when you approve the delivery.</li><li>Refunded in full if ${esc(f)} cannot deliver.</li></ul>
        <p class="err" id="peErr" role="alert"></p>
        <div class="row wrap pe-acts"><button class="lq lq-p" type="button" data-paynow>${ic('lock')}Pay ${L.inr(c.price)}</button><button class="lq lq-s" type="button" data-no>Not now</button></div>
      </div>`,
      onMount(b, close) {
        const btn = b.querySelector('[data-paynow]'), err = b.querySelector('#peErr');
        b.querySelector('[data-no]').addEventListener('click', () => close());
        b.addEventListener('change', e => { if (e.target.name === 'pm') u.method = e.target.value; });
        btn.addEventListener('click', () => {
          const m = methods.find(x => x.id === (b.querySelector('input[name=pm]:checked') || {}).value);
          if (!m) { err.textContent = 'Choose how you want to pay.'; return; }
          if (!navigator.onLine) { err.textContent = 'You are offline. Nothing was charged. Try again when you are back online.'; return; }
          const cur = S().campaigns.find(x => x.id === cid);
          if (!cur || cur.stage !== 'accepted') { err.textContent = 'This campaign changed. Close this and check it again.'; return; }
          err.textContent = ''; btn.disabled = true; btn.setAttribute('aria-busy', 'true');
          L.$$('.t,.t2', btn).forEach(x => { x.textContent = 'Paying…'; });
          setTimeout(() => {
            const at = K().nowISO(), inv = K().nextInvoice(), tid = 't' + Date.now().toString(36), pid = 'p' + Date.now().toString(36);
            const method = m.id === 'upi' ? `UPI ${m.detail}` : m.id === 'card' ? `Card ${m.detail.replace(/\s+/g, '')}` : `${m.label} · ${m.detail}`;
            L.store.set(st => {
              const x = st.campaigns.find(y => y.id === cid);
              st.payments.unshift({ id: pid, date: K().todayISO(), kind: 'escrow', campaign: x.id, creator: x.creator, amount: x.price, status: 'held', method, invoice: inv });
              x.stage = 'funded'; x.funded = at; (x.log = x.log || []).push([at, 'funded']);
              if (!x.thread) { st.threads.unshift({ id: tid, campaign: x.id, creator: x.creator, unread: 0, messages: [{ from: 'system', kind: 'escrow', text: `You paid ${L.inr(x.price)} into escrow. Chat is open.`, at }] }); x.thread = tid; }
            }, 'escrow-paid');
            K().notify('payment', `${L.inr(c.price)} paid into escrow for ${c.title}. Chat with ${k.name} is open.`, '#campaign-' + c.id);
            const here = location.hash === '#campaign-' + c.id, t = thread(S().campaigns.find(y => y.id === cid));
            b.innerHTML = `<div class="pe pe-done">
              <div class="pe-slip">
                <span class="pill pill-escrow">${ic('lock')}In escrow</span>
                <p class="pe-lab">Held by Linkloom</p>
                <p class="t-money pe-amt" data-amt>${L.inr(c.price)}</p>
                <p class="pe-line">No platform fee. Taxes as per confirmed rules.</p>
                <dl class="pe-kv"><div class="kv"><dt>Paid with</dt><dd>${esc(method)}</dd></div><div class="kv"><dt>Invoice</dt><dd>${esc(inv)}</dd></div><div class="kv"><dt>Date</dt><dd>${esc(L.fmtDate(at, { year: true }))}</dd></div></dl>
              </div>
              <p class="pe-ok">${ic('chat')}<span>Chat with ${esc(f)} is open. ${esc(f)} has been told to start.</span></p>
              <div class="row wrap pe-acts">${t ? `<a class="lq lq-p" href="#chat-${esc(t.id)}" data-go-close>Open chat</a>` : ''}${here ? '' : `<a class="lq lq-s" href="#campaign-${esc(c.id)}" data-go-close>Open campaign</a>`}<button class="lq lq-s" type="button" data-done>Done</button></div>
            </div>`;
            L.liquid(b);
            L.$$('[data-go-close]', b).forEach(a => a.addEventListener('click', () => close(true)));
            b.querySelector('[data-done]').addEventListener('click', () => close());
            const first = b.querySelector('[data-go-close],[data-done]'); first && first.focus({ preventScroll: true });
            K().mo('lock', b.querySelector('[data-amt]'));
          }, L.RM ? 0 : 650);
        });
      }
    });
  };
})();
