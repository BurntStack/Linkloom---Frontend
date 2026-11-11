/* Active jobs (#active) and the production board for one deal (#work-<id>). Owned by Builder C.
   Work status (a.stage, six stages) and payment status (a.pay: 'escrow' | 'released') are separate fields on purpose:
   "completed" never implies "paid". Money is integer paise. */
(() => {
  const L = window.LLD, esc = L.esc, ic = L.icon;
  const C = window.LLD_C = window.LLD_C || {};

  /* ---------- helpers shared by the Builder C screens (messages.js and earnings.js use these at render time) ---------- */
  const T0 = Date.now();
  C.now = () => new Date(L.today().getTime() + (Date.now() - T0));       // sample "today" that keeps ticking
  C.iso = () => C.now().toISOString();
  C.key = d => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD in IST
  C.today = () => C.key(C.now());
  C.addDays = (ymd, n) => { const d = new Date(ymd + 'T12:00:00+05:30'); d.setDate(d.getDate() + n); return C.key(d); };
  C.time = s => L.D(s).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
  C.dayDiff = s => Math.round((Date.parse(C.today()) - Date.parse(C.key(L.D(s)))) / 864e5);
  C.day = s => { const n = C.dayDiff(s); return n === 0 ? 'Today' : n === 1 ? 'Yesterday' : L.fmtDate(s); };
  C.when = s => { const n = C.dayDiff(s); return n === 0 ? C.time(s) : n === 1 ? 'Yesterday' : L.fmtDate(s); };
  C.days = ymd => Math.round((Date.parse(String(ymd).slice(0, 10)) - Date.parse(C.key(L.today()))) / 864e5);   // whole IST calendar days from the sample today
  C.bi = brand => { const s = L.store.s, x = s.threads.find(t => t.brand === brand && t.bi) || s.jobs.find(j => j.brand === brand && j.bi); return (x && x.bi) || L.initials(brand); };
  C.plat = p => p === 'youtube' ? 'YouTube' : 'Instagram';
  C.sum = (rows, f) => rows.reduce((n, r) => n + f(r), 0);
  C.press = root => L.$$('.lq-p,.lq-coral,[data-press]', root).forEach(b => L.motion.press(b));
  /* network banner: shows while the browser is offline; returns a detach function */
  C.net = (host, cls, text) => {
    const b = document.createElement('p'); b.className = cls; b.setAttribute('role', 'status');
    b.innerHTML = `${ic('alert')}<span>${esc(text)}</span>`;
    const sync = () => { b.hidden = navigator.onLine; };
    sync(); host.prepend(b);
    addEventListener('online', sync); addEventListener('offline', sync);
    return () => { removeEventListener('online', sync); removeEventListener('offline', sync); };
  };

  C.STAGES = [
    { k: 'kickoff', n: 'Accepted', long: 'Accepted, awaiting kickoff' },
    { k: 'in_progress', n: 'In progress', long: 'Promotion in progress' },
    { k: 'submitted', n: 'Submitted', long: 'Content uploaded, submitted for review' },
    { k: 'revision', n: 'Revision', long: 'Revision requested' },
    { k: 'review', n: 'Brand review', long: 'Completed, awaiting brand review' },
    { k: 'approved', n: 'Approved', long: 'Approved by the brand' }
  ];
  C.ix = a => Math.max(0, C.STAGES.findIndex(x => x.k === a.stage));
  C.who = a => a.stage === 'approved' ? 'done' : (a.stage === 'review' || (a.stage === 'submitted' && !a.draftOk)) ? 'brand' : 'you';
  C.whoPill = a => ({ you: '<span class="pill pill-coral">Your move</span>', brand: '<span class="pill pill-violet">With the brand</span>', done: '<span class="pill pill-ok">Done</span>' })[C.who(a)];
  /* the lock icon split into shackle + body so the shackle can click shut when escrow is shown (CSS, reduced-motion safe) */
  C.lock = () => ic('lock').replace(/<path d="[^"]*"\/>/, '<path class="active-shackle" d="M7 11V8a5 5 0 0 1 10 0v3"/><path d="M5 11h14v10H5z"/>');
  C.escrowPill = (text = 'In escrow') => `<span class="pill pill-escrow active-lockin">${C.lock()}${esc(text)}</span>`;
  C.payPill = a => a.pay === 'released' ? `<span class="pill pill-ok">${ic('check')}Released</span>` : C.escrowPill();
  C.deal = a => { const j = L.store.s.jobs.find(x => x.id === a.job) || {}; return { platform: j.platform, format: j.format, brief: j.brief, usage: j.usage, languages: j.languages, deliverables: j.deliverables, ...a }; };
  C.threadFor = a => L.store.s.threads.find(t => t.id === a.thread) || L.store.s.threads.find(t => t.job === a.id);
  C.revUsed = a => (a.log || []).filter(e => e.kind === 'revision').length || (a.revision ? 1 : 0);
  C.next = a => {
    const d = C.deal(a);
    switch (a.stage) {
      case 'kickoff': return `Start work. Draft due ${L.fmtDate(a.draftDue || a.due)}.`;
      case 'in_progress': return `Upload your ${(d.format || 'content').toLowerCase()} by ${L.fmtDate(a.draftDue || a.due)}.`;
      case 'submitted': return a.draftOk ? 'Draft OKed. Post it and add the live link.' : `${a.brand} is reviewing your draft.`;
      case 'revision': return `Changes asked: “${a.revision || 'see the brand’s note'}”`;
      case 'review': return `${a.brand} is doing the final check.`;
      default: return 'Approved. Your payout is clearing.';
    }
  };
  C.due = a => {
    if (a.stage === 'approved') return 'Approved';
    const n = C.days(a.due);
    return n < 0 ? `${-n} day${n === -1 ? '' : 's'} late` : n === 0 ? 'Due today' : `Due ${L.fmtDate(a.due)} · ${n} day${n === 1 ? '' : 's'} left`;
  };
  const order = a => ({ you: 0, brand: 1, done: 2 })[C.who(a)];
  const sorted = list => [...list].sort((x, y) => order(x) - order(y) || L.D(x.due) - L.D(y.due));
  const log = (a, kind, extra) => { (a.log = a.log || []).push({ at: C.iso(), kind, ...extra }); };
  const sizeOf = b => b >= 1024 ** 3 ? (b / 1024 ** 3).toFixed(1) + ' GB' : b >= 1024 ** 2 ? Math.max(1, Math.round(b / 1024 ** 2)) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';

  /* ====================================================================================
     #active: one ticket per deal. Whose move it is reads as colour (coral = you, violet = brand).
     ==================================================================================== */
  const FILTERS = [['all', 'All'], ['you', 'Your move'], ['brand', 'With brand'], ['done', 'Done']];

  function ticket(a) {
    const d = C.deal(a), i = C.ix(a), t = C.threadFor(a), who = C.who(a), used = C.revUsed(a) > 0;
    const mini = C.STAGES.map((st, k) => {
      const skip = st.k === 'revision' && !used && k !== i;
      return `<li class="${k < i && !skip ? 'is-done' : k === i ? 'is-now' : ''}${skip ? ' is-skip' : ''}"></li>`;
    }).join('');
    const late = a.stage !== 'approved' && C.days(a.due) < 0;
    return `<li class="active-tk" data-who="${who}" data-id="${esc(a.id)}">
      <div class="active-tk-a">
        <span class="avatar v" aria-hidden="true">${esc(C.bi(a.brand))}</span>
        <div class="active-tk-tx">
          <p class="active-tk-brand">${esc(a.brand)}<span aria-hidden="true">·</span>${ic(d.platform === 'youtube' ? 'yt' : 'ig')}<span>${esc(d.format || '')}</span></p>
          <h2 class="active-tk-t"><a class="active-tk-link" href="#work-${esc(a.id)}">${esc(a.title)}</a></h2>
          <p class="active-tk-next">${esc(C.next(a))}</p>
        </div>
      </div>
      <div class="active-tk-rail">
        <ol class="active-mini" aria-label="Stage ${i + 1} of 6: ${esc(C.STAGES[i].long)}">${mini}</ol>
        <p class="active-tk-stage">${C.whoPill(a)}<span>${esc(C.STAGES[i].long)}</span></p>
      </div>
      <div class="active-tk-m">
        <p class="t-money active-tk-price">${L.inr(a.price)}</p>
        ${C.payPill(a)}
        <p class="active-tk-due${late ? ' is-late' : ''}">${ic('clock')}<span>${esc(C.due(a))}</span></p>
      </div>
      ${t ? `<a class="active-tk-chat" href="#chat-${esc(t.id)}" aria-label="Chat with ${esc(a.brand)}${t.unread ? `, ${t.unread} unread` : ''}">${ic('chat')}${t.unread ? `<b>${t.unread}</b>` : ''}</a>` : ''}
    </li>`;
  }

  function renderList(el) {
    const s = L.store.s, ui = s.workUI || (s.workUI = {});
    if (!s.active.length) {
      el.innerHTML = `<div class="view-in active">
        <header class="active-head"><div class="active-head-t"><h1 class="t-h1">Active jobs</h1></div></header>
        <div class="empty active-empty">
          <img src="assets/trust-lock-coin.svg" width="200" height="140" alt="">
          <p class="t-h2">No active work yet</p>
          <p class="muted">When a brand accepts your bid and pays into escrow, the job lands here with its brief, dates and chat.</p>
          <div class="row wrap active-empty-cta"><a class="lq lq-p" href="#jobs">Find jobs</a><a class="lq lq-s" href="#bids">See my bids</a></div>
        </div></div>`;
      return;
    }
    const list = sorted(s.active);
    const held = C.sum(s.active.filter(a => a.pay === 'escrow'), a => a.price);
    const count = k => k === 'all' ? list.length : list.filter(a => C.who(a) === k).length;
    let f = FILTERS.some(x => x[0] === ui.activeFilter) ? ui.activeFilter : 'all';
    el.innerHTML = `<div class="view-in active">
      <header class="active-head">
        <div class="active-head-t">
          <h1 class="t-h1">Active jobs</h1>
          <p class="muted">Brands accepted these bids and paid in first. <span class="sample">Sample data</span></p>
        </div>
        <div class="active-held">
          <span class="active-coin" aria-hidden="true">₹</span>
          <p><span class="active-held-l">Held in escrow for you</span><b class="t-money" data-held>${L.inr(held)}</b></p>
          <p class="t-note active-held-note" aria-hidden="true">paid in before you start</p>
        </div>
      </header>
      <div class="seg active-seg" role="group" aria-label="Filter active jobs">
        ${FILTERS.map(([k, n]) => `<button type="button" data-f="${k}" aria-pressed="${k === f}">${n}<span class="active-seg-n">${count(k)}</span></button>`).join('')}
      </div>
      <ol class="active-list" aria-live="polite">${list.map(ticket).join('')}</ol>
      <p class="active-none muted" hidden>Nothing here right now.</p>
    </div>`;
    const rows = L.$$('.active-tk', el), none = L.$('.active-none', el);
    const apply = () => { let n = 0; rows.forEach(r => { const on = f === 'all' || r.dataset.who === f; r.hidden = !on; n += on; }); none.hidden = n > 0; };
    apply();
    L.$$('.active-seg button', el).forEach(b => b.addEventListener('click', () => {
      if (b.dataset.f === f) return;
      f = ui.activeFilter = b.dataset.f;
      L.$$('.active-seg button', el).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      L.motion.flip(apply, rows);
    }));
    L.motion.count(L.$('[data-held]', el), held, L.inr);
    L.motion.stagger(rows.filter(r => !r.hidden));
  }

  L.register('active', { title: 'Active jobs', nav: 'active', render: renderList });

  /* ====================================================================================
     #work-<id>: the production board for one deal.
     ==================================================================================== */
  const LOGT = {
    accepted: (a) => `Bid accepted at ${L.inr(a.price)}`,
    funded: (a) => `${L.inr(a.price)} paid into escrow`,
    kickoff: () => 'Work started',
    upload: (a, e) => `Uploaded ${e.file || 'a file'}`,
    revision: () => 'Revision asked',
    draftok: () => 'Draft OKed by the brand',
    live: () => 'Posted live, sent for final review',
    approved: () => 'Approved, released from escrow'
  };
  const lastAt = (a, kind) => { const e = (a.log || []).filter(x => x.kind === kind).pop(); return e && e.at; };

  function rail(a, from) {
    const cur = C.ix(a), used = C.revUsed(a), pull0 = Math.max(0, Math.min(from == null ? cur - 1 : from, cur - 1));
    const dateOf = { kickoff: lastAt(a, 'accepted') || a.accepted, in_progress: lastAt(a, 'kickoff'), submitted: lastAt(a, 'upload'), revision: lastAt(a, 'revision') || a.revisionAt, review: lastAt(a, 'live'), approved: lastAt(a, 'approved') };
    const ahead = { in_progress: 'Next', submitted: `Draft due ${L.fmtDate(a.draftDue || a.due)}`, review: `Due ${L.fmtDate(a.due)}`, approved: 'Releases payout' };
    return C.STAGES.map((st, i) => {
      let cls = i < cur ? 'is-done' : i === cur ? 'is-now' : 'is-next', sub, state = i < cur ? 'done' : i === cur ? 'current stage' : 'not yet';
      if (i <= cur && dateOf[st.k]) sub = (i === cur ? 'Now · ' : '') + L.fmtDate(dateOf[st.k]);
      else if (i === cur) sub = 'Now';
      else sub = ahead[st.k] || '';
      if (st.k === 'revision' && i !== cur) {
        const n = a.revisionsIncluded || 2;
        if (used) { sub = `${used} of ${n} used`; if (i > cur) cls = 'is-next is-used'; }
        else { cls = (i < cur ? 'is-done' : 'is-next') + ' is-skip'; sub = i < cur ? 'Not needed' : 'Only if needed'; state = i < cur ? 'not needed' : 'only if needed'; }
      }
      const pull = i >= pull0 && i < cur ? ` is-pull" style="--k:${i - pull0}` : '';
      return `<li class="work-node ${cls}${pull}"${i === cur ? ` aria-current="step" style="--k:${Math.max(0, cur - pull0)}"` : ''}>
        <span class="work-nh"><span class="work-n" aria-hidden="true">0${i + 1}</span>
        <span class="work-nt">${esc(st.n)}<span class="sr-only">, ${esc(st.long)}, ${state}</span></span></span>
        <span class="work-rl" aria-hidden="true"><i></i></span>
        <span class="work-nd">${esc(sub)}</span>
      </li>`;
    }).join('');
  }

  function money(a) {
    const out = a.pay === 'released', funded = lastAt(a, 'funded') || a.funded;
    return `<div class="work-money" data-pay="${out ? 'released' : 'escrow'}">
      <div class="work-mn work-mn-in is-done"><span class="work-mdot" aria-hidden="true"></span><b>Paid in</b><span>${funded ? L.fmtDate(funded) : 'Funded'}</span></div>
      <div class="work-mn work-mn-hold${out ? ' is-done' : ' is-now'}"><span class="work-mdot" data-slot="hold" aria-hidden="true"></span><b>Held in escrow</b><span>${out ? 'Released ' + L.fmtDate(lastAt(a, 'approved') || C.iso()) : 'Since ' + (funded ? L.fmtDate(funded) : 'funding')}</span><span class="work-band" aria-hidden="true"></span></div>
      <div class="work-mn work-mn-out${out ? ' is-now' : ''}"><span class="work-mdot" data-slot="out" aria-hidden="true"></span><b>Released to you</b><span>${out ? 'Clearing into your balance' : 'When ' + esc(a.brand.split(' ')[0]) + ' approves'}</span></div>
    </div>`;
  }

  function nowPanel(a) {
    const d = C.deal(a), t = C.threadFor(a), fmt = d.format || 'content', first = a.brand.split(' ')[0];
    const up = (verb, sub) => `<div class="work-up" data-state="idle">
        <input class="sr-only" type="file" id="workFile" accept="video/mp4,video/quicktime,image/jpeg,image/png,.mp4,.mov,.m4v,.jpg,.jpeg,.png" aria-describedby="workFileHelp">
        <label class="work-drop" for="workFile">
          <span class="work-drop-ic">${ic('upload')}</span>
          <span class="work-drop-t"><b>Drop your ${esc(fmt.toLowerCase())} here</b> or <u>choose a file</u></span>
          <span class="help" id="workFileHelp">MP4, MOV, JPG or PNG, up to 4 GB</span>
        </label>
        <div class="work-prog" hidden>
          <p class="work-prog-n"><b data-fname></b><span data-fsize></span></p>
          <div class="work-bar" role="progressbar" aria-label="Upload progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span></span></div>
          <div class="row between"><p class="work-prog-s" aria-live="polite" data-pmsg>Uploading</p><button class="btn-q" type="button" data-cancel>Cancel</button></div>
        </div>
        <p class="err work-up-err" role="alert" hidden></p>
        <div class="work-ready" hidden>
          <p class="work-ready-f">${ic('check')}<span><b data-rname></b><span class="muted" data-rsize></span></span><button class="btn-q" type="button" data-replace>Replace</button></p>
          <div class="field"><label for="workNote">Note for ${esc(first)} <span class="muted">(optional)</span></label><input class="input" id="workNote" maxlength="200" placeholder="${esc(sub)}"></div>
          <button class="lq lq-p" type="button" data-submit>${esc(verb)}</button>
        </div>
      </div>`;
    const demo = (btns) => `<div class="work-demo" role="group" aria-label="Sample controls for the brand side"><p><span class="sample">Sample</span> Brand side, for this demo</p><div class="row wrap">${btns}</div></div>`;
    const head = (title) => `<div class="work-now-h">${C.whoPill(a)}<h2 class="t-h2" id="workNowH">${esc(title)}</h2></div>`;
    switch (a.stage) {
      case 'kickoff':
        return `${head('Ready when you are')}
          <p class="work-now-p">${esc(a.brand)} paid ${L.inr(a.price)} into escrow. Start when you have the brief and any product you need.</p>
          <button class="lq lq-p" type="button" data-start>Start work</button>`;
      case 'in_progress':
        return `${head('Upload your ' + fmt.toLowerCase())}
          <p class="work-now-p">Draft due ${L.fmtDate(a.draftDue || a.due)}. ${esc(a.brand)} reviews it before anything goes live.</p>${up('Submit for review', 'Anything they should check first?')}`;
      case 'revision': {
        const n = a.revisionsIncluded || 2, used = C.revUsed(a);
        return `${head('Revision requested')}
          <figure class="work-note">
            <blockquote class="work-quote"><p>“${esc(a.revision || 'Please see the chat for the changes.')}”</p></blockquote>
            <figcaption><span class="avatar v" aria-hidden="true">${esc(C.bi(a.brand))}</span><span><b>${esc(a.brand)}</b><span class="muted">${a.revisionAt ? esc(L.fmtDate(a.revisionAt) + ', ' + C.time(a.revisionAt)) : ''} · Revision ${used} of ${n} included</span></span></figcaption>
          </figure>
          ${up('Resubmit to ' + first, 'What did you change?')}`;
      }
      case 'submitted': {
        const f = (a.uploads || []).slice(-1)[0];
        if (a.draftOk) return `${head('Draft OKed. Post it.')}
          <p class="work-now-p">Post on ${C.plat(d.platform)} as agreed, then add the live link. ${esc(first)} does a final check before the money leaves escrow.</p>
          <form class="work-live" novalidate>
            <div class="field"><label for="workLive">Live link</label><input class="input" id="workLive" inputmode="url" autocomplete="off" placeholder="${d.platform === 'youtube' ? 'youtube.com/watch?v=…' : 'instagram.com/reel/…'}" aria-describedby="workLiveErr"><p class="err" id="workLiveErr" hidden></p></div>
            <button class="lq lq-p" type="submit">Send for final review</button>
          </form>`;
        return `${head('With ' + a.brand)}
          <p class="work-now-p">Your draft is in. Brands on Linkloom usually reply within a day; you will see it here and in chat.</p>
          ${f ? `<p class="work-file-now">${ic('check')}<span><b>${esc(f.name)}</b><span class="muted">${esc(f.size || '')} · sent ${esc(C.when(f.at))}</span></span></p>` : ''}
          ${demo('<button class="lq lq-s lq-sm" type="button" data-brand="revise">Ask for a revision</button><button class="lq lq-s lq-sm" type="button" data-brand="ok">OK the draft</button>')}`;
      }
      case 'review':
        return `${head('Final check with ' + first)}
          <p class="work-now-p">You have delivered. ${L.inr(a.price)} stays in escrow until ${esc(a.brand)} approves, then it is released to you.</p>
          ${a.liveUrl ? `<p class="work-file-now">${ic('link')}<span><b>Live link</b><span class="muted">${esc(a.liveUrl)}</span></span></p>` : ''}
          ${demo('<button class="lq lq-s lq-sm" type="button" data-brand="approve">Approve the work</button>')}`;
      default: {
        const net = L.payout(a.price).net, led = L.store.s.ledger.find(l => l.id === 'l-' + a.id);
        return `${head('Approved')}
          <p class="work-now-p">${esc(a.brand)} approved on ${L.fmtDate(lastAt(a, 'approved') || C.iso())}. You receive ${L.inr(net)}, the agreed price, released from escrow${led && led.clears ? ' and clearing into your balance by ' + L.fmtDate(led.clears) : ''}. Tax as per confirmed rules.</p>
          <a class="lq lq-p" href="#earnings">See it in earnings</a>`;
      }
    }
  }

  function renderWork(el, id) {
    const s = L.store.s, a = s.active.find(x => x.id === id);
    if (!a) {
      el.innerHTML = `<div class="view-in"><div class="empty"><img src="assets/step-05-stamp.svg" width="200" height="146" alt=""><p class="t-h2">This job is not in your active work</p><p class="muted">It may have been closed or the link is old.</p><a class="lq lq-p" href="#active">Back to active jobs</a></div></div>`;
      return;
    }
    let up = null, detachNet = null, seen = null;   // seen: the stage index last drawn, so the thread pulls only through new segments
    const set = (fn, why) => L.store.set(() => fn(a), why);

    const paint = () => {
      const d = C.deal(a), t = C.threadFor(a), last = t && t.msgs.filter(m => m.from !== 'sys').slice(-1)[0];
      const dl = d.deliverables || [], files = a.uploads || [];
      const late = a.stage !== 'approved' && C.days(a.due) < 0;
      const draftDone = files.length > 0;
      el.innerHTML = `<div class="view-in work" data-who="${C.who(a)}">
        <a class="btn-q work-back" href="#active">${ic('back')}<span>Active jobs</span></a>
        <header class="work-head">
          <div class="work-head-t">
            <p class="work-brand"><span class="avatar v" aria-hidden="true">${esc(C.bi(a.brand))}</span><span><b>${esc(a.brand)}</b><span class="muted">${ic(d.platform === 'youtube' ? 'yt' : 'ig')}${esc(C.plat(d.platform))} ${esc(d.format || '')}</span></span><span class="sample">Sample</span></p>
            <h1 class="t-h1">${esc(a.title)}</h1>
          </div>
          <div class="work-head-m">
            <p class="work-price"><span class="t-money" data-price>${L.inr(a.price)}</span><span class="muted">agreed price, locked at acceptance</span></p>
            <div class="row wrap">${C.payPill(a)}${t ? `<a class="lq lq-s lq-sm" href="#chat-${esc(t.id)}">${ic('chat')}Chat${t.unread ? ` · ${t.unread} new` : ''}</a>` : ''}</div>
          </div>
        </header>

        <section class="card work-board" aria-labelledby="workBoardH">
          <h2 class="sr-only" id="workBoardH">Where this deal stands</h2>
          <div class="work-lane">
            <p class="work-lane-h">Work</p>
            <ol class="work-rail${seen === C.ix(a) ? '' : ' is-pulling'}">${rail(a, seen)}</ol>
          </div>
          <div class="work-lane work-lane-m">
            <p class="work-lane-h">Money <span>tracked apart from the work</span></p>
            ${money(a)}
            <p class="work-money-note">${a.pay === 'released' ? 'Released on approval. It reaches your balance once it clears.' : `Completed is not paid. The ${L.inr(a.price)} leaves escrow only when ${esc(a.brand)} approves.`}</p>
          </div>
          <span class="work-coin" aria-hidden="true">₹</span>
        </section>

        <div class="work-grid">
          <div class="work-main">
            <section class="card work-now" aria-labelledby="workNowH" aria-live="polite">${nowPanel(a)}</section>

            <section class="work-sec" aria-labelledby="workBriefH">
              <h2 class="work-sec-h" id="workBriefH">Brief</h2>
              <p class="work-brief">${esc(d.brief || 'The brand’s brief is attached to the accepted bid.')}</p>
              <dl class="work-facts">
                <div><dt>Platform</dt><dd>${esc(C.plat(d.platform) + ' ' + (d.format || ''))}</dd></div>
                <div><dt>Usage rights</dt><dd>${esc(d.usage || 'As agreed in the bid')}</dd></div>
                ${d.languages ? `<div><dt>Languages</dt><dd>${esc(d.languages.join(', '))}</dd></div>` : ''}
              </dl>
            </section>

            <section class="work-sec" aria-labelledby="workDelH">
              <h2 class="work-sec-h" id="workDelH">Deliverables</h2>
              <ol class="work-dl">${dl.map((x, i) => `<li class="${a.stage === 'approved' ? 'is-ok' : ''}"><span class="work-dl-n" aria-hidden="true">0${i + 1}</span><span>${esc(x)}</span>${a.stage === 'approved' ? `<span class="pill pill-ok">Approved</span>` : ''}</li>`).join('')}</ol>
            </section>

            <section class="work-sec" aria-labelledby="workFilesH">
              <h2 class="work-sec-h" id="workFilesH">Uploads</h2>
              ${files.length ? `<ol class="work-files">${files.map((f, i) => `<li><span class="work-v">v${i + 1}</span><span class="work-files-n"><b>${esc(f.name)}</b><span class="muted">${esc(f.size || '')} · ${esc(L.fmtDate(f.at) + ', ' + C.time(f.at))}</span></span>${i === files.length - 1 ? '<span class="pill pill-paper">Latest</span>' : ''}</li>`).reverse().join('')}</ol>`
                : `<p class="muted work-files-none">Nothing uploaded yet. Your drafts and versions show up here.</p>`}
            </section>
          </div>

          <aside class="work-side" aria-label="Deal details">
            ${C.slip ? C.slip({ price: a.price, head: a.pay === 'released' ? 'Payout slip' : 'Payout if approved', brand: a.brand, job: a.title, status: a.pay === 'released' ? `<span class="pill pill-ok">${ic('check')}Released from escrow</span>` : C.escrowPill('Held in escrow until approval') }) : ''}

            <section class="work-sec" aria-labelledby="workDatesH">
              <h2 class="work-sec-h" id="workDatesH">Dates</h2>
              <dl>
                <div class="kv"><dt>Bid accepted</dt><dd>${a.accepted ? L.fmtDate(a.accepted) : '—'}</dd></div>
                <div class="kv"><dt>Escrow funded</dt><dd>${a.funded ? L.fmtDate(a.funded) : '—'}</dd></div>
                <div class="kv"><dt>Draft due</dt><dd>${L.fmtDate(a.draftDue || a.due)}${draftDone ? ' · sent' : ''}</dd></div>
                <div class="kv"><dt>Due</dt><dd class="${late ? 'work-late' : ''}">${esc(C.due(a).replace(/^Due /, ''))}</dd></div>
              </dl>
            </section>

            ${t ? `<a class="work-chat" href="#chat-${esc(t.id)}">
              <span class="avatar v" aria-hidden="true">${esc(C.bi(a.brand))}</span>
              <span class="work-chat-t"><b>Chat with ${esc(a.brand.split(' ')[0])}</b><span class="muted">${last ? esc((last.from === 'me' ? 'You: ' : '') + last.text) : 'Say hello'}</span></span>
              ${t.unread ? `<span class="work-chat-n" aria-label="${t.unread} unread">${t.unread}</span>` : ic('chevron')}
            </a>` : ''}

            <section class="work-sec" aria-labelledby="workLogH">
              <h2 class="work-sec-h" id="workLogH">Log</h2>
              <ol class="work-log">${(a.log || []).slice().reverse().map(e => `<li><span>${esc((LOGT[e.kind] || (() => e.kind))(a, e))}</span><time datetime="${esc(e.at)}">${esc(L.fmtDate(e.at) + ', ' + C.time(e.at))}</time></li>`).join('')}</ol>
            </section>
          </aside>
        </div>
      </div>`;
      // the coin sits in the money lane slot that matches the payment status
      const coin = L.$('.work-coin', el), slot = L.$(`[data-slot="${a.pay === 'released' ? 'out' : 'hold'}"]`, el);
      slot && slot.append(coin);
      detachNet && detachNet();
      detachNet = C.net(L.$('.work', el), 'work-net', 'You are offline. Uploads pause and resume when you are back.');
      L.liquid(el); C.press(el);
      seen = C.ix(a);
      wire();
    };

    const wire = () => {
      const q = sel => L.$(sel, el);
      q('[data-start]') && q('[data-start]').addEventListener('click', () => {
        set(a => { a.stage = 'in_progress'; log(a, 'kickoff'); }, 'work-start');
        L.toast('Work started. Draft due ' + L.fmtDate(a.draftDue || a.due), 'check'); paint();
      });
      const box = q('.work-up');
      if (box) up = uploader(box, a, (file, note) => {
        const t = C.threadFor(a);
        set(a => {
          (a.uploads = a.uploads || []).push({ name: file.name, size: file.size, at: C.iso() });
          log(a, 'upload', { file: file.name });
          a.stage = 'submitted'; a.draftOk = false;
          if (t) t.msgs.push({ from: 'sys', at: C.iso(), text: `You uploaded ${file.name} for review` }, ...(note ? [{ from: 'me', at: C.iso(), text: note, status: 'delivered' }] : []));
        }, 'work-upload');
        L.toast('Sent to ' + a.brand + ' for review', 'send'); paint();
      });
      L.$$('[data-brand]', el).forEach(b => b.addEventListener('click', () => brandSide(b.dataset.brand)));
      const live = q('.work-live');
      live && live.addEventListener('submit', e => {
        e.preventDefault();
        const inp = q('#workLive'), err = q('#workLiveErr'), v = inp.value.trim().replace(/^https?:\/\//, '');
        const ok = /^(www\.)?(instagram\.com|youtube\.com|youtu\.be)\/\S+$/i.test(v);
        inp.closest('.field').classList.toggle('is-err', !ok); err.hidden = ok;
        inp.setAttribute('aria-invalid', String(!ok));
        if (!ok) { err.textContent = 'Paste the link to the live post on Instagram or YouTube.'; inp.focus(); return; }
        set(a => { a.liveUrl = v; a.stage = 'review'; log(a, 'live'); }, 'work-live');
        L.toast('Sent for final review', 'send'); paint();
      });
    };

    const brandSide = kind => {
      const t = C.threadFor(a), at = C.iso();
      if (kind === 'revise') {
        const note = 'Looks great. Can you add the price on screen in the last 3 s?';
        set(a => { a.stage = 'revision'; a.revision = note; a.revisionAt = at; log(a, 'revision'); if (t) { t.msgs.push({ from: 'brand', at, text: note }); t.unread++; } }, 'work-revision');
        paint();
      } else if (kind === 'ok') {
        const note = 'Draft approved. Go ahead and post it!';
        set(a => { a.draftOk = true; log(a, 'draftok'); if (t) { t.msgs.push({ from: 'brand', at, text: note }); t.unread++; } }, 'work-draftok');
        paint();
      } else if (kind === 'approve') {
        const coin = L.$('.work-coin', el), out = L.$('[data-slot="out"]', el);
        set(st => {
          a.stage = 'approved'; a.pay = 'released'; log(a, 'approved');
          const s = L.store.s, day = C.today();
          if (!s.ledger.some(l => l.id === 'l-' + a.id)) s.ledger.unshift({ id: 'l-' + a.id, date: day, brand: a.brand, job: a.title, amount: a.price, status: 'pending', clears: C.addDays(day, 7) });
          const b = s.bids.find(x => x.job === a.job && x.status === 'accepted');
          if (b) { b.status = 'completed'; b.note = 'Approved and closed. Leave feedback for the brand.'; }
          s.notifications.unshift({ id: 'n-' + a.id, at, text: `${a.brand} approved your work. ${L.inr(L.payout(a.price).net)} is clearing.`, go: '#earnings', read: false });
          if (t) t.msgs.push({ from: 'brand', at, text: 'Approved. Thank you, this is lovely.' }, { from: 'sys', at, text: `Approved. ${L.inr(a.price)} released from escrow` });
        }, 'work-approved');
        // move the coin out of escrow first, then redraw the board
        L.motion.flip(() => { out && coin && out.append(coin); L.$('.work-money', el).dataset.pay = 'released'; }, coin ? [coin] : []);
        setTimeout(() => { paint(); L.motion.celebrate(L.$('.work-board', el)); L.toast('Approved. Payout released from escrow', 'check'); }, L.RM ? 0 : 650);
      }
    };

    paint();
    L.motion.stagger(L.$$('.work-node', el));
    return () => { up && up.stop(); detachNet && detachNet(); };
  }

  /* file upload with validation, simulated progress and pause on network loss (nothing leaves the browser) */
  function uploader(box, a, onSend) {
    const q = s => L.$(s, box), inp = q('input[type=file]'), drop = q('.work-drop'), prog = q('.work-prog'), bar = q('.work-bar'), fill = q('.work-bar span'),
      pmsg = q('[data-pmsg]'), err = q('.work-up-err'), ready = q('.work-ready');
    const OK = /\.(mp4|mov|m4v|jpe?g|png)$/i, TYPES = /^(video\/(mp4|quicktime|x-m4v)|image\/(jpeg|png))$/, MAX = 4 * 1024 ** 3;
    let timer = 0, pct = 0, file = null, step = 4;
    const state = s => { box.dataset.state = s; drop.hidden = s !== 'idle' && s !== 'error'; prog.hidden = s !== 'busy' && s !== 'paused'; ready.hidden = s !== 'done'; };
    const fail = m => { stop(); err.innerHTML = `${ic('alert')}<span>${esc(m)}</span>`; err.hidden = false; state('error'); inp.value = ''; };
    const draw = () => { fill.style.width = pct + '%'; bar.setAttribute('aria-valuenow', String(Math.round(pct))); };
    const stop = () => { clearInterval(timer); timer = 0; removeEventListener('online', resume); removeEventListener('offline', pause); };
    const pause = () => { if (box.dataset.state !== 'busy') return; state('paused'); pmsg.textContent = `Connection lost at ${Math.round(pct)}%. It resumes when you are back online.`; };
    const resume = () => { if (box.dataset.state !== 'paused') return; state('busy'); pmsg.textContent = 'Back online. Resuming…'; };
    const tick = () => {
      if (box.dataset.state !== 'busy') return;
      if (!navigator.onLine) return pause();
      pct = Math.min(100, pct + step); draw();
      if (pct > 2) pmsg.textContent = `Uploading · ${Math.round(pct)}%`;
      if (pct >= 100) { stop(); state('done'); q('[data-rname]').textContent = file.name; q('[data-rsize]').textContent = ' · ' + file.size; const s = q('[data-submit]'); s && s.focus({ preventScroll: true }); }
    };
    const start = f => {
      err.hidden = true;
      if (!f) return;
      if (!OK.test(f.name) && !TYPES.test(f.type)) return fail(`${f.name} can’t be uploaded. Use MP4, MOV, JPG or PNG.`);
      if (f.size === 0) return fail('That file is empty. Export it again and retry.');
      if (f.size > MAX) return fail('That file is over 4 GB. Export a smaller version and retry.');
      if (!navigator.onLine) return fail('You are offline. Connect to the internet, then upload again.');
      file = { name: f.name, size: sizeOf(f.size) }; pct = 0;
      const ms = Math.min(4200, Math.max(1600, f.size / 1024 ** 2 * 28)); step = 100 / (ms / 90);
      q('[data-fname]').textContent = f.name; q('[data-fsize]').textContent = file.size; pmsg.textContent = 'Starting upload…';
      state('busy'); draw();
      addEventListener('online', resume); addEventListener('offline', pause);
      timer = setInterval(tick, 90);
    };
    inp.addEventListener('change', () => start(inp.files[0]));
    ['dragenter', 'dragover'].forEach(n => drop.addEventListener(n, e => { e.preventDefault(); drop.classList.add('is-over'); }));
    ['dragleave', 'drop'].forEach(n => drop.addEventListener(n, () => drop.classList.remove('is-over')));
    drop.addEventListener('drop', e => { e.preventDefault(); start(e.dataTransfer.files[0]); });
    q('[data-cancel]').addEventListener('click', () => { stop(); state('idle'); inp.value = ''; L.toast('Upload cancelled', 'close'); inp.focus(); });
    q('[data-replace]').addEventListener('click', () => { state('idle'); inp.value = ''; inp.click(); });
    q('[data-submit]').addEventListener('click', () => {
      if (!navigator.onLine) { err.innerHTML = `${ic('alert')}<span>You are offline. Your file is ready; send it when you are back online.</span>`; err.hidden = false; return; }
      onSend(file, (q('#workNote') || {}).value ? q('#workNote').value.trim() : '');
    });
    state('idle');
    return { stop };
  }

  L.register('work', {
    title: p => { const a = L.store.s.active.find(x => x.id === p); return a ? a.title : 'Active job'; },
    crumb: p => { const a = L.store.s.active.find(x => x.id === p); return '<a href="#active">Active jobs</a>' + (a ? ' / ' + esc(a.brand) : ''); },
    nav: 'active', render: renderWork
  });
})();
