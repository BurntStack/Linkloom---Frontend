/* Messages (#messages inbox) and one chat (#chat-<id>). Owned by Builder D.
   Mirrors the creator app's Messages screen: two panes on desktop, one stacked pane on phones.
   A chat exists only for a campaign the brand has paid into escrow (funded and later stages). Invited and accepted campaigns
   show a calm locked state that links to #campaign-<id> to pay. <id> may be a thread id (t1) or a campaign id (c3).
   Messages carry text and files (deliverables). Nothing is uploaded anywhere: files stay in this tab, delivery is simulated.
   The brand's own bubbles are violet, the creator's are coral-family, system cards (escrow, release) are plum. */
(() => {
  const L = window.LLD, esc = L.esc, ic = L.icon, M = () => L.motion;
  const T0 = Date.now();
  const FUNDED = ['funded', 'in_progress', 'submitted', 'revision', 'approved', 'released'];
  const LIVE = ['funded', 'in_progress', 'submitted', 'revision', 'approved'];
  const LOCKED = ['invited', 'accepted'];
  const s = () => L.store.s;
  const camp = id => s().campaigns.find(c => c.id === id);
  const campOf = t => camp(t.campaign);
  const first = n => n.split(' ')[0];

  /* ---------- time ---------- */
  const iso = () => new Date(L.today().getTime() + (Date.now() - T0)).toISOString();
  const dayN = at => Math.floor((L.D(at).getTime() + 19800000) / 864e5);
  const time = at => L.D(at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }).replace(/\s?([ap])\.?m\.?/i, (m, x) => ' ' + x.toLowerCase() + 'm');
  const day = at => { const d = dayN(L.today().toISOString()) - dayN(at); return d === 0 ? 'Today' : d === 1 ? 'Yesterday' : L.D(at).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }); };
  const when = at => { if (!at) return ''; const d = dayN(L.today().toISOString()) - dayN(at); return d === 0 ? time(at) : d === 1 ? 'Yesterday' : L.fmtDate(at); };

  /* ---------- files ---------- */
  const MAXB = 500 * 1024 * 1024, MAXN = 5;
  const BAD_EXT = /\.(exe|bat|cmd|com|msi|apk|sh|js|vbs|scr|jar)$/i;
  const fmtSize = b => b >= 1073741824 ? (b / 1073741824).toFixed(1).replace(/\.0$/, '') + ' GB' : b >= 1048576 ? Math.max(1, Math.round(b / 1048576)) + ' MB' : b >= 1024 ? Math.round(b / 1024) + ' KB' : b + ' bytes';
  const ext = n => (n.match(/\.([a-z0-9]{1,5})$/i) || [, 'file'])[1].toUpperCase();
  const KIND = { MP4: 'Video', MOV: 'Video', WEBM: 'Video', JPG: 'Image', JPEG: 'Image', PNG: 'Image', HEIC: 'Image', WEBP: 'Image', PDF: 'PDF', DOC: 'Document', DOCX: 'Document', ZIP: 'Archive', MP3: 'Audio', WAV: 'Audio', PPTX: 'Slides', KEY: 'Slides', XLSX: 'Sheet', CSV: 'Sheet', TXT: 'Text' };
  const blobs = new WeakMap();   // message -> object URL, for files the brand attached in this tab

  /* ---------- PII guard (same rules as the creator app): KYC and bank details never go in chat ---------- */
  const BLOCK = [
    [/\b[A-Z]{5}\d{4}[A-Z]\b/i, 'a PAN number'],
    [/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, 'an Aadhaar number'],
    [/\b[A-Z]{4}0[A-Z0-9]{6}\b/i, 'an IFSC code'],
    [/\b[\w.-]{2,}@[a-z]{2,}\b(?!\.)/i, 'a UPI ID'],
    [/\b\d{9,18}\b/, 'a bank account or phone number']
  ];
  const SOFT = /\b(pan card|aadhaa?r|passport|voter id|driving licen[cs]e|cancelled cheque|bank statement)\b/i;
  const check = (v, names) => { for (const [re, what] of BLOCK) if (re.test(v)) return { block: true, what }; return SOFT.test(v) || SOFT.test((names || []).join(' ').replace(/[-_.]/g, ' ')) ? { block: false } : null; };

  /* ---------- threads ---------- */
  const lastAt = t => (t.messages[t.messages.length - 1] || {}).at || '';
  const lastText = t => {
    const m = t.messages.filter(x => x.from !== 'system').slice(-1)[0] || t.messages.slice(-1)[0];
    if (!m) return 'No messages yet';
    const body = m.file ? (m.text ? m.text : m.file.name) : m.text;
    return (m.from === 'brand' ? 'You: ' : '') + (m.file && !m.text ? 'Sent a file · ' : '') + body;
  };
  /* a newly paid campaign (paid from Campaigns by Builder C) gets its chat here, opening with the plum escrow card */
  const ensureThreads = () => {
    const st = s(), need = st.campaigns.filter(c => LIVE.includes(c.stage) && !st.threads.some(t => t.campaign === c.id));
    if (!need.length) return;
    L.store.set(x => need.forEach(c => {
      const id = 't' + c.id;
      x.threads.push({ id, campaign: c.id, creator: c.creator, unread: 0, messages: [{ from: 'system', kind: 'escrow', text: `You paid ${L.inr(c.price)} into escrow. Chat is open.`, at: c.funded || iso() }] });
      c.thread = id;
    }), 'chat-thread-open');
  };
  const threads = () => s().threads.filter(t => { const c = campOf(t); return c && FUNDED.includes(c.stage); }).sort((a, b) => L.D(lastAt(b)) - L.D(lastAt(a)));
  const lockedCamps = () => s().campaigns.filter(c => LOCKED.includes(c.stage));
  const resolve = p => {
    if (!p) return {};
    let t = s().threads.find(x => x.id === p);
    if (t) return { t: FUNDED.includes((campOf(t) || {}).stage) ? t : null, gone: !FUNDED.includes((campOf(t) || {}).stage) };
    const c = camp(p);
    if (!c) return { gone: true };
    t = s().threads.find(x => x.campaign === c.id);
    if (t && FUNDED.includes(c.stage)) return { t };
    if (LOCKED.includes(c.stage)) return { locked: c };
    return { gone: true };
  };

  const STAGE = { funded: 'Paid into escrow · creator is starting', in_progress: 'Creator is working', submitted: 'Delivery to review', revision: 'Revision requested', approved: 'Approved · release on its way', released: 'Paid to the creator' };
  const dueLine = c => { if (!c.due || ['released', 'approved'].includes(c.stage)) return ''; const d = L.daysLeft(c.due); return d < 0 ? ` · ${-d} day${d === -1 ? '' : 's'} late` : d === 0 ? ' · due today' : ` · due ${L.fmtDate(c.due)}`; };
  const payPill = c => c.stage === 'released' ? `<span class="pill pill-ok">${ic('check')}Released</span>` : `<span class="pill pill-escrow">${ic('lock')}In escrow</span>`;
  const tone = cr => cr && cr.tone === 'b' ? ' is-b' : '';
  const av = (cr, cls = '') => `<span class="avatar msg-av${tone(cr)}${cls}" aria-hidden="true">${esc(L.initials(cr ? cr.name : '?'))}</span>`;

  function threadRow(t, cur) {
    const c = campOf(t), cr = L.creator(t.creator);
    return `<li data-t="${esc(t.id)}"><a class="messages-th" href="#chat-${esc(t.id)}"${t.id === cur ? ' aria-current="true"' : ''} aria-label="${esc(`${cr.name}, ${c.title}${t.unread ? `, ${t.unread} unread` : ''}`)}">
      ${av(cr)}
      <span class="messages-th-t">
        <span class="messages-th-r"><b>${esc(cr.name)}</b><time datetime="${esc(lastAt(t))}">${esc(when(lastAt(t)))}</time></span>
        <span class="messages-th-job" data-done="${c.stage === 'released'}"><i aria-hidden="true"></i>${esc(c.title)}</span>
        <span class="messages-th-last">${esc(lastText(t))}</span>
      </span>
      ${t.unread ? `<span class="messages-th-n" aria-hidden="true">${t.unread}</span>` : ''}
    </a></li>`;
  }
  function lockedRow(c, cur) {
    const cr = L.creator(c.creator);
    return `<li data-c="${esc(c.id)}"><a class="messages-th is-locked" href="#chat-${esc(c.id)}"${c.id === cur ? ' aria-current="true"' : ''} aria-label="${esc(`${cr.name}, ${c.title}, chat opens after payment`)}">
      ${av(cr)}
      <span class="messages-th-t">
        <span class="messages-th-r"><b>${esc(cr.name)}</b><span class="messages-th-lk">${ic('lock')}Locked</span></span>
        <span class="messages-th-job"><i aria-hidden="true"></i>${esc(c.title)}</span>
        <span class="messages-th-last">${c.stage === 'accepted' ? `Accepted. Pay ${esc(L.inr(c.price))} to open chat` : 'Invitation sent. Waiting for a reply'}</span>
      </span></a></li>`;
  }

  function render(el, param) {
    ensureThreads();
    const list = threads(), locked = lockedCamps(), r = resolve(param);
    if (!list.length && !locked.length) {
      el.innerHTML = `<div class="view-in messages-none-v"><h1 class="t-h1">Messages</h1>
        <div class="empty"><img src="assets/step-01-envelope.svg" width="220" height="160" alt=""><p class="t-h2">No chats yet</p>
        <p class="muted">A chat opens when a creator accepts your invitation or bid and you pay into escrow. Until then, nobody can message you here.</p>
        <div class="row wrap" style="justify-content:center"><a class="lq lq-p" href="#creators">Find creators</a><a class="lq lq-s" href="#campaigns">See campaigns</a></div></div></div>`;
      return;
    }
    const offs = [];
    const t = r.t, lockC = r.locked;
    const cr = t ? L.creator(t.creator) : lockC ? L.creator(lockC.creator) : null;
    el.innerHTML = `<div class="view-in messages" data-mode="${param ? 'thread' : 'list'}">
      <div class="messages-wrap">
        <aside class="messages-list" aria-labelledby="msgH">
          <header class="messages-list-h">
            <h1 class="t-h2" id="msgH">Messages</h1>
            <p class="help">A chat opens once you pay a campaign into escrow. <span class="sample">Sample</span></p>
          </header>
          <div class="messages-scroll">
            ${list.length ? `<ul class="messages-threads" aria-label="Open chats">${list.map(x => threadRow(x, t && t.id)).join('')}</ul>` : '<p class="messages-nolist muted">No open chats yet.</p>'}
            ${locked.length ? `<p class="messages-grp" id="lockH">${ic('lock')}Opens after payment</p>
              <ul class="messages-threads messages-locked" aria-labelledby="lockH">${locked.map(c => lockedRow(c, lockC && lockC.id)).join('')}</ul>` : ''}
          </div>
        </aside>
        <section class="chat-pane" aria-label="${t ? esc('Chat with ' + cr.name) : lockC ? esc('Chat with ' + cr.name + ', locked') : 'Chat'}">${t ? '' : lockC ? lockedPane(lockC) : param ? missing() : placeholder()}</section>
      </div>
    </div>`;
    const ul = L.$('.messages-threads:not(.messages-locked)', el);
    M().stagger(L.$$('.messages-scroll li', el));
    L.liquid(el);
    if (t) offs.push(openChat(L.$('.chat-pane', el), t, ul));
    return () => offs.forEach(f => f && f());
  }

  const placeholder = () => `<div class="chat-empty">
    <img src="assets/step-01-envelope.svg" width="200" height="146" alt="">
    <p class="t-h2">Pick a chat</p>
    <ul class="chat-rules">
      <li>${ic('lock')}<span>Chats open only after you pay a campaign into escrow.</span></li>
      <li>${ic('file')}<span>Share briefs, product shots and feedback files here. Creators send their deliveries here too.</span></li>
      <li>${ic('shield')}<span>Never send PAN, Aadhaar or bank details in chat. Payments stay on Linkloom.</span></li>
    </ul></div>`;
  const missing = () => `<div class="chat-empty">
    <img src="assets/step-03-lock.svg" width="200" height="146" alt="" class="chat-empty-ink">
    <p class="t-h2">This chat isn’t open</p>
    <p class="muted">Chat is only for campaigns you have paid into escrow. If a campaign was cancelled or refunded, its chat closes too.</p>
    <a class="lq lq-s" href="#messages">All chats</a></div>`;

  /* the calm locked state: why it is locked, where the campaign is, and the next step */
  function lockedPane(c) {
    const cr = L.creator(c.creator), acc = c.stage === 'accepted', fn = first(cr.name);
    const step = (done, cur, label) => `<li class="chat-lk-s${done ? ' is-done' : ''}${cur ? ' is-cur' : ''}"${cur ? ' aria-current="step"' : ''}><i aria-hidden="true">${done ? ic('check') : ''}</i><span>${label}</span></li>`;
    return `<div class="chat-empty chat-lk">
      <img src="assets/step-03-lock.svg" width="200" height="146" alt="" class="chat-empty-ink">
      <p class="t-h2">Chat opens after you pay</p>
      <p class="muted">${acc
        ? `${esc(cr.name)} accepted your invitation for <b>${esc(c.title)}</b>. Pay ${esc(L.inr(c.price))} into escrow and the chat opens straight away. Linkloom holds the money until you approve the work.`
        : `${esc(fn)} hasn’t replied to your invitation for <b>${esc(c.title)}</b> yet. Once ${esc(fn)} accepts and you pay ${esc(L.inr(c.price))} into escrow, the chat opens here.`}</p>
      <ol class="chat-lk-rail" aria-label="Before chat opens">
        ${step(true, false, 'Invitation sent')}
        ${step(acc, !acc, acc ? 'Accepted by ' + esc(fn) : 'Waiting for ' + esc(fn))}
        ${step(false, acc, 'Pay into escrow')}
        ${step(false, false, 'Chat opens')}
      </ol>
      <div class="row wrap chat-lk-acts">${acc ? `<a class="lq lq-p" href="#campaign-${esc(c.id)}">Pay into escrow</a>` : `<a class="lq lq-p" href="#campaign-${esc(c.id)}">Open the campaign</a>`}<a class="lq lq-s" href="#messages">All chats</a></div>
    </div>`;
  }

  function openChat(pane, t, ul) {
    const c = campOf(t), cr = L.creator(t.creator), fresh = t.unread, fn = first(cr.name);
    /* mark read: the thread and its message notifications */
    const goKey = '#chat-' + t.id;
    if (t.unread || s().notifications.some(n => !n.read && n.kind === 'message' && n.go === goKey))
      L.store.set(x => { t.unread = 0; x.notifications.forEach(n => { if (n.kind === 'message' && n.go === goKey) n.read = true; }); }, 'chat-read');
    const rowN = ul && L.$(`[data-t="${t.id}"] .messages-th-n`, ul); rowN && rowN.remove();
    const els = new Map();
    let pending = [];   // File objects waiting to be sent

    const meta = m => {
      if (m.from !== 'brand') return `<time datetime="${esc(m.at)}">${esc(time(m.at))}</time>`;
      const st = m.status || 'delivered';
      const label = { sending: [ic('clock'), 'Sending…'], sent: [ic('check'), 'Sent'], delivered: [ic('check'), 'Delivered'], queued: [ic('alert'), 'Not sent · waiting for network'] }[st] || ['', ''];
      return `<time datetime="${esc(m.at)}">${esc(time(m.at))}</time><span class="chat-st" data-st="${st}">${label[0]}${esc(label[1])}</span>${st === 'queued' ? '<button class="btn-q chat-retry" type="button">Retry</button>' : ''}`;
    };
    const delivOf = m => m.file && (c.deliveries || []).find(d => d.file === m.file.name);
    const fileCard = m => {
      const f = m.file, d = m._deliv || delivOf(m), x = ext(f.name), url = blobs.get(m);
      const kind = (KIND[x] || 'File') + ' · ' + x + (f.size ? ' · ' + f.size : '');
      const act = d ? `<a class="chat-file-a" href="#campaign-${esc(c.id)}">${ic('eye')}Review delivery</a>`
        : url ? `<a class="chat-file-a" href="${esc(url)}" download="${esc(f.name)}">${ic('download')}Download</a>`
        : m.from === 'brand' ? `<span class="chat-file-n">Shared</span>` : `<span class="chat-file-n">Sample file</span>`;
      return `<div class="chat-file${d ? ' is-deliv' : ''}">
        <span class="chat-file-ic" aria-hidden="true">${ic('file')}<b>${esc(x.slice(0, 4))}</b></span>
        <span class="chat-file-t">${d ? `<span class="chat-file-k">Delivery v${esc(d.v)}${c.stage === 'submitted' && d === (c.deliveries || []).slice(-1)[0] ? ' · to review' : ''}</span>` : ''}<b title="${esc(f.name)}">${esc(f.name)}</b><span class="chat-file-m">${esc(kind)}</span></span>
        ${act}
        ${d && d.note ? `<p class="chat-file-note">${esc(d.note)}</p>` : ''}
      </div>`;
    };
    const item = m => {
      if (m.from === 'system') {
        const k = m.kind || (/release/i.test(m.text) ? 'released' : 'escrow');
        return `<li class="chat-sys is-plum" data-k="${esc(k)}"><span class="chat-sys-c">${ic(k === 'released' ? 'coin' : k === 'refund' ? 'refund' : 'lock')}<span><b>${k === 'released' ? 'Released' : k === 'refund' ? 'Refunded' : 'Escrow paid'}</b>${esc(m.text)}</span></span><time datetime="${esc(m.at)}">${esc(time(m.at))}</time></li>`;
      }
      const me = m.from === 'brand';
      return `<li class="chat-msg ${me ? 'is-me' : 'is-them'}${m.file ? ' has-file' : ''}">${m.file ? fileCard(m) : ''}${m.text ? `<p class="chat-b">${esc(m.text)}</p>` : ''}<p class="chat-meta">${meta(m)}</p></li>`;
    };
    /* deliveries from the campaign that never came through chat still show, as creator file cards */
    const synth = () => (c.deliveries || []).filter(d => !t.messages.some(m => m.file && m.file.name === d.file))
      .map(d => ({ from: 'creator', at: d.at, file: { name: d.file, size: d.size || '' }, _deliv: d, _syn: true }));
    const all = () => {
      const rows = [], msgs = [...t.messages, ...synth()].sort((x, y) => L.D(x.at) - L.D(y.at));
      let dk = '', newFrom = -1;
      for (let i = msgs.length - 1, left = fresh; i >= 0 && left > 0; i--) if (msgs[i].from === 'creator') { newFrom = i; left--; }
      msgs.forEach((m, i) => {
        const k = dayN(m.at);
        if (k !== dk) { dk = k; rows.push(`<li class="chat-day"><span>${esc(day(m.at))}</span></li>`); }
        if (i === newFrom) rows.push(`<li class="chat-new"><span>${fresh} new</span></li>`);
        rows.push(item(m));
      });
      if (t.reported) rows.push(`<li class="chat-sys is-flag"><span class="chat-sys-c">${ic('flag')}<span>You reported this chat on ${esc(L.fmtDate(t.reported.at))}. Linkloom’s trust team reviews it within 24 hours.</span></span></li>`);
      return { html: rows.join(''), order: msgs };
    };

    const A = all();
    pane.innerHTML = `<div class="chat">
      <header class="chat-h">
        <a class="ibtn chat-back" href="#messages" aria-label="All chats">${ic('back')}</a>
        ${av(cr)}
        <div class="chat-h-t"><h2 class="chat-name">${esc(cr.name)}</h2><p class="help">${esc(cr.handle)} · paid into escrow ${esc(L.fmtDate(c.funded || lastAt(t)))}</p></div>
        <div class="chat-more">
          <button class="chat-opt" type="button" aria-haspopup="menu" aria-expanded="false" aria-controls="chatMenu">Options${ic('down')}</button>
          <ul class="chat-menu" id="chatMenu" role="menu" aria-label="Chat options" hidden>
            <li role="none"><a role="menuitem" tabindex="-1" href="#campaign-${esc(c.id)}">${ic('rail')}Open the campaign</a></li>
            <li role="none"><a role="menuitem" tabindex="-1" href="#creator-${esc(cr.id)}">${ic('user')}View ${esc(fn)}’s profile</a></li>
            <li role="none"><button role="menuitem" tabindex="-1" type="button" data-report>${ic('flag')}Report this chat</button></li>
          </ul>
        </div>
      </header>
      <a class="chat-job" href="#campaign-${esc(c.id)}" data-done="${c.stage === 'released'}">
        <span class="chat-job-t"><span class="chat-job-k">Campaign</span><b>${esc(c.title)}</b><span class="chat-job-s"><i aria-hidden="true"></i>${esc((STAGE[c.stage] || '') + dueLine(c))}</span></span>
        <span class="chat-job-m"><b class="t-money">${L.inr(c.price)}</b>${payPill(c)}</span>
        ${ic('chevron')}
      </a>
      <p class="chat-net" role="status" hidden>${ic('alert')}<span>You are offline. New messages wait and send when you are back.</span></p>
      <ol class="chat-log" role="log" aria-live="polite" aria-label="Messages with ${esc(cr.name)}" tabindex="0">
        <li class="chat-safe">${ic('lock')}<span>Never send PAN, Aadhaar or bank details in chat. Keep payments on Linkloom so your money stays in escrow.</span></li>
        ${A.html}
      </ol>
      <div class="chat-foot"></div>
      <div class="chat-drop" aria-hidden="true"><span>${ic('paperclip')}Drop files to attach</span></div>
    </div>`;
    const chat = L.$('.chat', pane), log = L.$('.chat-log', pane), foot = L.$('.chat-foot', pane), net = L.$('.chat-net', pane);
    const onNet = () => { net.hidden = navigator.onLine; };
    onNet(); addEventListener('offline', onNet); addEventListener('online', onNet);
    const bottom = () => { log.scrollTop = log.scrollHeight; };
    requestAnimationFrame(bottom);
    const newMark = L.$('.chat-new', log); newMark && requestAnimationFrame(() => { log.scrollTop = Math.max(0, newMark.offsetTop - 80); });
    // map message objects to their nodes so delivery states can update in place
    const nodes = L.$$('.chat-msg', log), ord = A.order.filter(m => m.from !== 'system');
    nodes.forEach((n, i) => ord[i] && els.set(ord[i], n));
    /* escrow is held: the plum stitch wraps the pinned pill once per session per chat */
    const pill = L.$('.chat-job .pill-escrow', pane);
    if (pill && !t._locked) { t._locked = true; setTimeout(() => { M().lock && pill.isConnected && M().lock(pill, { color: 'plum' }); }, 420); }

    /* ---------- composer ---------- */
    foot.innerHTML = `<form class="chat-compose" novalidate>
      <p class="chat-warn" id="chatWarn" role="alert" hidden></p>
      <ul class="chat-att" aria-label="Files to send" hidden></ul>
      <div class="chat-compose-r">
        <input class="sr-only" type="file" id="chatFile" multiple tabindex="-1" aria-hidden="true">
        <button class="chat-clip" type="button" aria-label="Attach files" aria-describedby="chatHint" data-press>${ic('paperclip')}</button>
        <label class="sr-only" for="chatIn">Message ${esc(cr.name)}</label>
        <textarea class="chat-in" id="chatIn" rows="1" maxlength="1000" placeholder="Write to ${esc(fn)}" aria-describedby="chatWarn chatHint"></textarea>
        <button class="chat-send" type="submit" aria-label="Send" data-press>${ic('send')}</button>
      </div>
      <p class="chat-hint" id="chatHint"><span class="chat-hint-k">${ic('lock')}Never send PAN, Aadhaar or bank details here.</span><span class="chat-hint-e">Files up to 500 MB each · Enter to send</span></p>
    </form>`;
    const form = L.$('form', foot), inp = L.$('#chatIn', foot), warn = L.$('#chatWarn', foot), btn = L.$('.chat-send', foot);
    const fileIn = L.$('#chatFile', foot), clip = L.$('.chat-clip', foot), att = L.$('.chat-att', foot);
    M().press(btn); M().press(clip);
    const grow = () => { inp.style.height = 'auto'; inp.style.height = Math.min(inp.scrollHeight, 160) + 'px'; };
    let fileErr = '';
    const lint = () => {
      const r = check(inp.value, pending.map(f => f.name));
      const show = r || fileErr;
      warn.hidden = !show; warn.classList.toggle('is-soft', !fileErr && !!r && !r.block);
      if (r && r.block) warn.innerHTML = `${ic('alert')}<span>This looks like ${esc(r.what)}. Remove it to send; KYC and bank details never go in chat.</span>`;
      else if (fileErr) warn.innerHTML = `${ic('alert')}<span>${esc(fileErr)}</span>`;
      else if (r) warn.innerHTML = `${ic('shield')}<span>Reminder: ID documents and bank papers never go in chat. Linkloom handles payments for you.</span>`;
      btn.disabled = (!inp.value.trim() && !pending.length) || !!(r && r.block);
      return r;
    };
    const drawAtt = () => {
      att.hidden = !pending.length;
      att.innerHTML = pending.map((f, i) => `<li class="chat-chip">${ic('file')}<span class="chat-chip-n" title="${esc(f.name)}">${esc(f.name)}</span><span class="chat-chip-s">${esc(fmtSize(f.size))}</span><button type="button" class="chat-chip-x" data-x="${i}" aria-label="Remove ${esc(f.name)}">${ic('close')}</button></li>`).join('');
      clip.classList.toggle('is-on', !!pending.length);
      lint();
    };
    const addFiles = list => {
      const errs = [];
      [...list].forEach(f => {
        if (pending.length >= MAXN) { errs.push(`You can attach up to ${MAXN} files at a time.`); return; }
        if (BAD_EXT.test(f.name)) { errs.push(`${f.name} can’t be sent. Program files are blocked for safety.`); return; }
        if (f.size > MAXB) { errs.push(`${f.name} is ${fmtSize(f.size)}. Files can be up to 500 MB; share a cloud link for bigger cuts.`); return; }
        if (!f.size) { errs.push(`${f.name} is empty.`); return; }
        if (!pending.some(p => p.name === f.name && p.size === f.size)) pending.push(f);
      });
      fileErr = [...new Set(errs)].join(' ');
      drawAtt();
      if (fileErr && M().shake) M().shake(warn);
      const last = att.lastElementChild; last && !errs.length && M().bump && M().bump(last, 1.02);
    };
    clip.addEventListener('click', () => fileIn.click());
    fileIn.addEventListener('change', () => { addFiles(fileIn.files); fileIn.value = ''; inp.focus(); });
    att.addEventListener('click', e => { const x = e.target.closest('[data-x]'); if (!x) return; pending.splice(+x.dataset.x, 1); fileErr = ''; drawAtt(); (L.$('.chat-chip-x', att) || inp).focus(); });
    /* drag and drop onto the chat */
    let dragN = 0;
    const hasFiles = e => [...(e.dataTransfer && e.dataTransfer.types || [])].includes('Files');
    const dEnter = e => { if (!hasFiles(e)) return; e.preventDefault(); dragN++; chat.classList.add('is-drag'); };
    const dLeave = e => { if (!hasFiles(e)) return; dragN = Math.max(0, dragN - 1); if (!dragN) chat.classList.remove('is-drag'); };
    const dOver = e => { if (hasFiles(e)) e.preventDefault(); };
    const dDrop = e => { if (!hasFiles(e)) return; e.preventDefault(); dragN = 0; chat.classList.remove('is-drag'); addFiles(e.dataTransfer.files); inp.focus(); };
    chat.addEventListener('dragenter', dEnter); chat.addEventListener('dragleave', dLeave); chat.addEventListener('dragover', dOver); chat.addEventListener('drop', dDrop);

    inp.addEventListener('input', () => { grow(); lint(); });
    inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); } });
    form.addEventListener('submit', e => {
      e.preventDefault();
      const v = inp.value.trim(), r = lint();
      if ((!v && !pending.length) || (r && r.block)) { if (r && r.block && M().shake) M().shake(warn); inp.focus(); return; }
      send(v, pending.slice()); pending = []; fileErr = ''; inp.value = ''; grow(); drawAtt(); inp.focus();
    });
    lint();

    const paintMsg = m => { const li = els.get(m); if (li) li.querySelector('.chat-meta').innerHTML = meta(m); };
    const deliver = m => {
      setTimeout(() => {
        if (!navigator.onLine) { m.status = 'queued'; return paintMsg(m); }
        m.status = 'sent'; paintMsg(m);
        setTimeout(() => { if (m.status === 'sent') { m.status = 'delivered'; paintMsg(m); } }, 900);
      }, m.file ? 900 : 550);
    };
    const append = m => {
      const lastDay = L.$$('.chat-day', log).pop();
      if (!lastDay || lastDay.textContent !== day(m.at)) log.insertAdjacentHTML('beforeend', `<li class="chat-day"><span>${esc(day(m.at))}</span></li>`);
      log.insertAdjacentHTML('beforeend', item(m));
      const li = log.lastElementChild; els.set(m, li);
      li.classList.add('is-new'); li.addEventListener('animationend', () => li.classList.remove('is-new'), { once: true });
    };
    /* sending adds no notification for the brand: it is the brand's own action */
    const send = (text, files) => {
      const st = navigator.onLine ? 'sending' : 'queued', made = [];
      files.forEach((f, i) => {
        const m = { from: 'brand', at: iso(), file: { name: f.name, size: fmtSize(f.size), type: f.type || '' }, text: i === 0 && files.length === 1 ? text : '', status: st };
        try { blobs.set(m, URL.createObjectURL(f)); } catch (e) {}
        made.push(m);
      });
      if (text && files.length !== 1) made.push({ from: 'brand', at: iso(), text, status: st });
      L.store.set(() => { made.forEach(m => t.messages.push(m)); }, 'chat-send');
      made.forEach(m => { append(m); if (m.status === 'sending') deliver(m); });
      bottom(); reorder();
      if (files.length) L.toast(files.length === 1 ? `${files[0].name} sent to ${fn}` : `${files.length} files sent to ${fn}`, 'check');
    };
    const retryAll = () => t.messages.filter(m => m.status === 'queued').forEach(m => { m.status = 'sending'; paintMsg(m); deliver(m); });
    log.addEventListener('click', e => { if (e.target.closest('.chat-retry')) { if (navigator.onLine) retryAll(); else L.toast('Still offline. It sends when you reconnect.', 'alert'); } });
    addEventListener('online', retryAll);

    /* keep the inbox in step: preview text, time, and order (FLIP when a thread jumps to the top) */
    const reorder = () => {
      if (!ul) return;
      const li = L.$(`[data-t="${t.id}"]`, ul);
      if (li) { L.$('.messages-th-last', li).textContent = lastText(t); const tm = L.$('time', li); tm.textContent = when(lastAt(t)); tm.setAttribute('datetime', lastAt(t)); }
      const items = L.$$(':scope > li', ul), order = threads().map(x => L.$(`[data-t="${x.id}"]`, ul)).filter(Boolean);
      if (order.some((n, i) => n !== items[i])) M().flip(() => order.forEach(n => ul.append(n)), items);
    };

    /* ---------- options menu ---------- */
    const opt = L.$('.chat-opt', pane), menu = L.$('.chat-menu', pane), mi = () => L.$$('[role=menuitem]', menu);
    const closeMenu = focus => { menu.hidden = true; opt.setAttribute('aria-expanded', 'false'); if (focus) opt.focus(); };
    const openMenu = () => { menu.hidden = false; opt.setAttribute('aria-expanded', 'true'); mi()[0].focus(); };
    opt.addEventListener('click', () => menu.hidden ? openMenu() : closeMenu());
    opt.addEventListener('keydown', e => { if (e.key === 'ArrowDown') { e.preventDefault(); openMenu(); } });
    menu.addEventListener('keydown', e => {
      const items = mi(), i = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
      else if (e.key === 'Home') { e.preventDefault(); items[0].focus(); }
      else if (e.key === 'End') { e.preventDefault(); items[items.length - 1].focus(); }
      else if (e.key === 'Escape') { e.preventDefault(); closeMenu(true); }
      else if (e.key === 'Tab') closeMenu();
    });
    const outside = e => { if (!menu.hidden && !e.target.closest('.chat-more')) closeMenu(); };
    document.addEventListener('click', outside);
    L.$('[data-report]', menu).addEventListener('click', () => { closeMenu(); report(); });

    const report = () => {
      const reasons = ['Asked to pay or talk outside Linkloom', 'Asked for bank, PAN or Aadhaar details', 'Sent something unsafe', 'Rude or abusive', 'Something else'];
      L.openSheet({
        title: 'Report this chat',
        body: `<form class="chat-sheet" novalidate>
          <p class="muted">Linkloom’s trust team reads the chat and replies within 24 hours. ${esc(cr.name)} is not told who reported it, and your escrow stays as it is.</p>
          <fieldset class="chat-reasons"><legend>What happened?</legend>
            ${reasons.map((x, i) => `<label class="check"><input type="radio" name="rr" value="${esc(x)}"${i === 0 ? ' checked' : ''}><span>${esc(x)}</span></label>`).join('')}
          </fieldset>
          <div class="field"><label for="rrNote">Anything else? <span class="muted">(optional)</span></label><textarea class="textarea" id="rrNote" maxlength="500" placeholder="What should the team look at?"></textarea></div>
          <div class="row wrap"><button class="lq lq-p" type="submit">Send report</button><button class="lq lq-s" type="button" data-cancel>Cancel</button></div>
        </form>`,
        onMount(b, close) {
          L.$('[data-cancel]', b).addEventListener('click', () => close());
          L.$('form', b).addEventListener('submit', e => {
            e.preventDefault();
            const reason = (L.$('input[name=rr]:checked', b) || {}).value;
            L.store.set(() => { t.reported = { at: iso(), reason, note: L.$('#rrNote', b).value.trim() }; }, 'chat-report');
            close(); L.toast('Report sent. The trust team replies within 24 hours.', 'flag');
            L.$$('.chat-sys.is-flag', log).forEach(n => n.remove());
            log.insertAdjacentHTML('beforeend', `<li class="chat-sys is-flag"><span class="chat-sys-c">${ic('flag')}<span>You reported this chat on ${esc(L.fmtDate(t.reported.at))}. Linkloom’s trust team reviews it within 24 hours.</span></span></li>`);
            bottom();
          });
        }
      });
    };

    L.liquid(pane);
    return () => {
      removeEventListener('online', retryAll); removeEventListener('offline', onNet); removeEventListener('online', onNet);
      document.removeEventListener('click', outside);
    };
  }

  const nameFor = p => { const r = resolve(p), x = r.t ? L.creator(r.t.creator) : r.locked ? L.creator(r.locked.creator) : null; return x ? x.name : ''; };
  L.register('messages', { title: 'Messages', nav: 'messages', render: el => render(el, null) });
  L.register('chat', {
    title: p => { const n = nameFor(p); return n ? 'Chat with ' + n : 'Chat'; },
    crumb: p => { const n = nameFor(p); return '<a href="#messages">Messages</a>' + (n ? ' / ' + esc(n) : ''); },
    nav: 'messages', render
  });
})();
