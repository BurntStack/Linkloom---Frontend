/* Bid form (#bid-<id>): a bid slip with live payout receipt, every validation, final summary sheet.
   Sending needs verified KYC; the draft survives the KYC detour in LLD_DATA.bidDrafts. Owner: Builder B. */
(() => {
  const L = window.LLD, esc = L.esc;
  const SS_KEY = 'll.bidDrafts';
  const digits = v => String(v ?? '').replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  const group = d => (d ? Number(d).toLocaleString('en-IN') : '');
  const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00+05:30'); d.setUTCDate(d.getUTCDate() + n); return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); };
  const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00:00+05:30') - new Date(a + 'T12:00:00+05:30')) / 864e5);

  /* URL check: accepts "instagram.com/reel/x" or a full https:// link; needs a real-looking host */
  function checkUrl(raw) {
    const v = String(raw || '').trim();
    if (!v) return { empty: true };
    if (/\s/.test(v) || /^(javascript|data|file):/i.test(v)) return { ok: false };
    const withP = /^https?:\/\//i.test(v) ? v : 'https://' + v;
    try {
      const u = new URL(withP);
      if (!/^([a-z0-9-]+\.)+[a-z]{2,}$/i.test(u.hostname)) return { ok: false };
      return { ok: true, href: u.href, short: u.hostname.replace(/^www\./, '') + (u.pathname.length > 1 ? u.pathname.replace(/\/$/, '') : '') + u.search };
    } catch (e) { return { ok: false }; }
  }

  const saveDrafts = () => { try { sessionStorage.setItem(SS_KEY, JSON.stringify(LLD_DATA.bidDrafts || {})); } catch (e) {} };
  try { const raw = sessionStorage.getItem(SS_KEY); if (raw) LLD_DATA.bidDrafts = Object.assign({}, JSON.parse(raw), LLD_DATA.bidDrafts || {}); } catch (e) {}

  const KYC_BANNER = {
    not_started: ['pill-paper', 'ID not verified', 'Verify your ID once to send bids. Your draft stays right here.', 'Verify ID'],
    in_progress: ['pill-info', 'Verification in progress', 'Finish verification to send this bid. Your draft is saved.', 'Continue verification'],
    under_review: ['pill-info', 'Under review', 'Your ID is being checked. Finish the draft now and send it once you are verified.', 'See status'],
    action_needed: ['pill-warn', 'Action needed', 'Verification needs one fix before you can send.', 'Fix it'],
    rejected: ['pill-err', 'Not approved', 'Verification was not approved. See what to change, then send.', 'See what to fix']
  };

  L.register('bid', {
    title: id => { const j = L.jobkit && L.jobkit.job(id); return j ? 'Bid · ' + j.title : 'Bid'; },
    crumb: id => { const j = L.jobkit && L.jobkit.job(id); return j ? `<a href="#jobs">Find jobs</a> / <a href="#job-${L.esc(j.id)}">${L.esc(j.title)}</a> / Your bid` : '<a href="#jobs">Find jobs</a> / Your bid'; },
    nav: 'jobs',
    render(el, id) {
      const K = L.jobkit, s = K.ensure(), j = K.job(id), R = s.bidRules;
      if (!j) {
        el.innerHTML = `<div class="view-in"><div class="empty"><img src="assets/step-01-envelope.svg" width="160" height="117" alt="">
          <p class="t-h2">This brief is no longer open.</p><p class="muted">Nothing to bid on here.</p><a class="lq lq-p" href="#jobs">See open jobs</a></div></div>`;
        return;
      }
      const existing = K.openBid(j.id);
      if (existing) {
        el.innerHTML = `<div class="view-in"><div class="empty">
          <img src="assets/step-02-plane.svg" width="72" height="72" alt="" class="bid-plane">
          <p class="t-h2">You already bid on this brief.</p>
          <p class="row wrap bid-already">${K.pill(existing.status)}<span class="num">${L.inr(existing.price)}</span><span class="muted">sent ${esc(L.fmtDate(existing.sent))}</span></p>
          <a class="lq lq-p" href="#bids">See it in My Bids</a></div></div>`;
        return;
      }

      const today = K.todayISO(), minDate = addDays(today, 1), maxDate = j.deadline;
      const maxPaise = Math.round(j.budget * (1 + R.overBudgetPct / 100) / 100) * 100;
      const pf = s.me.platforms[j.platform];
      const portfolio = (s.me.portfolio || []).map(p => ({ ...p, chk: checkUrl(p.url) })).filter(p => p.chk.ok);
      const d = s.bidDrafts[j.id] || (s.bidDrafts[j.id] = { price: '', why: '', views: '', postDate: '', links: [''] });
      if (!d.links || !d.links.length) d.links = [''];
      const kyc = s.kyc.status, verified = kyc === 'verified';
      const kb = KYC_BANNER[kyc] || KYC_BANNER.not_started;
      const touched = new Set();
      let tried = false;

      el.innerHTML = `<div class="view-in bid">
        <a class="btn-q bid-back" href="#job-${esc(j.id)}">${L.icon('back')}Back to the brief</a>
        <header class="bid-h">
          <div class="job-src">${K.brandChip(j)}<span class="jobs-plat">${K.glyph(j.platform)}<span>${esc(K.platName(j.platform))} ${esc(j.format)}</span></span></div>
          <h1 class="t-h1">Your bid for ${esc(j.title)}</h1>
          <p class="muted t-small">Budget ${L.inr(j.budget)} · post by ${esc(L.fmtDate(j.deadline))} · ${j.bids} bids so far<span class="bid-h-s"> · <span class="sample">Sample brief</span></span></p>
        </header>
        ${verified ? '' : `<div class="bid-kyc" role="status">
          <img src="assets/trust-id-card.svg" width="72" height="56" alt="">
          <div class="bid-kyc-t"><span class="pill ${kb[0]}">${kb[0] === 'pill-err' ? L.icon('alert') : ''}${esc(kb[1])}</span><p>${esc((/action_needed|rejected/.test(kyc) && s.kyc.note) || kb[2])}</p></div>
          <button class="lq lq-s lq-sm" type="button" data-kyc>${esc(kb[3])}</button>
        </div>`}
        <div class="bid-layout">
          <form class="bid-slip" id="bidForm" novalidate>
            <section class="bid-sec" aria-labelledby="bidPriceL">
              <span class="bid-n" aria-hidden="true">01</span>
              <div class="field" id="fPrice">
                <label id="bidPriceL" for="bidPrice">Your price</label>
                <div class="money-in bid-money">
                  <span aria-hidden="true">₹</span>
                  <input id="bidPrice" name="price" type="text" inputmode="numeric" autocomplete="off" maxlength="11" placeholder="0" value="${esc(group(d.price))}" aria-describedby="bidPriceHelp bidPriceErr bidPriceWarn">
                  <button class="bid-step" type="button" data-step="-500" aria-label="Lower by ₹500">${L.icon('minus')}</button>
                  <button class="bid-step" type="button" data-step="500" aria-label="Raise by ₹500">${L.icon('plus')}</button>
                </div>
                <p class="help" id="bidPriceHelp">Indian rupees (INR). Budget ${L.inr(j.budget)}; this brand takes bids from ${L.inr(R.minPaise)} to ${L.inr(maxPaise)}.</p>
                <p class="err" id="bidPriceErr"></p>
                <p class="bid-warn" id="bidPriceWarn"></p>
              </div>
            </section>

            <section class="bid-sec" aria-labelledby="bidWhyL">
              <span class="bid-n" aria-hidden="true">02</span>
              <div class="field" id="fWhy">
                <div class="bid-why-h"><label id="bidWhyL" for="bidWhy">Why this price</label><span class="t-note bid-note" aria-hidden="true">brands read this first</span></div>
                <textarea class="textarea" id="bidWhy" name="why" maxlength="${R.whyMax}" rows="4" aria-describedby="bidWhyHelp bidWhyN bidWhyErr" placeholder="Audience fit, effort, past results. For example: 34% of my audience is in Mumbai and my last skincare Reel reached 2.1 lakh views.">${esc(d.why)}</textarea>
                <div class="bid-why-f"><p class="help" id="bidWhyHelp">At least ${R.whyMin} characters.</p><p class="bid-count num" id="bidWhyN"></p></div>
                <p class="err" id="bidWhyErr"></p>
              </div>
            </section>

            <section class="bid-sec" aria-label="Post date and expected views">
              <span class="bid-n" aria-hidden="true">03</span>
              <div class="bid-pair">
              <div class="field" id="fPost">
                <label for="bidPost">Post date</label>
                <input class="input" id="bidPost" name="postDate" type="date" min="${minDate}" max="${maxDate}" value="${esc(d.postDate)}" aria-describedby="bidPostHelp bidPostErr">
                <p class="help" id="bidPostHelp">Live by ${esc(L.fmtDate(j.deadline))}, the brand's deadline.</p>
                <p class="err" id="bidPostErr"></p>
              </div>
              <div class="field" id="fViews">
                <label for="bidViews">Expected views <span class="bid-opt">optional</span></label>
                <input class="input" id="bidViews" name="views" type="text" inputmode="numeric" autocomplete="off" maxlength="13" placeholder="${pf ? esc(group(String(pf.avgViews))) : '50,000'}" value="${esc(group(d.views))}" aria-describedby="bidViewsHelp bidViewsErr">
                <p class="help" id="bidViewsHelp">Your estimate, not a guarantee.${pf ? ` Your ${esc(K.platName(j.platform))} average is ${esc(L.compact(pf.avgViews))}.` : ''}</p>
                <p class="err" id="bidViewsErr"></p>
              </div>
              </div>
            </section>

            <section class="bid-sec" aria-labelledby="bidLinksL">
              <span class="bid-n" aria-hidden="true">04</span>
              <div class="field" id="fLinks">
                <p class="lab" id="bidLinksL">Similar work links</p>
                <ul class="bid-links" id="bidLinks" aria-labelledby="bidLinksL"></ul>
                <div class="bid-links-f">
                  <button class="btn-q" type="button" data-addlink>${L.icon('plus')}Add link</button>
                  <span class="help" id="bidLinksMax">Up to ${R.maxLinks}. Reels, videos or campaign pages.</span>
                </div>
                ${portfolio.length ? `<div class="bid-port"><p class="help">From your profile</p><div class="chips" id="bidPort"></div></div>` : ''}
                <p class="err" id="bidLinksErr"></p>
              </div>
            </section>

            <div class="bid-foot">
              <p class="bid-sum" id="bidSum" aria-live="polite"></p>
              <button class="lq lq-p bid-review-btn" type="submit">Review bid</button>
              <p class="help">Nothing is sent until you confirm on the next step.</p>
            </div>
          </form>

          <aside class="bid-side" aria-label="Payout preview">
            <div class="bid-receipt ink-card">
              <p class="bid-rc-h">Payout preview</p>
              <dl class="bid-rows">
                <div><dt>Your price</dt><dd data-r="price">₹ —</dd></div>
                <div><dt>Tax / withholding</dt><dd>As per confirmed rules</dd></div>
              </dl>
              <p class="bid-rc-l">You receive</p>
              <p class="bid-rc-net"><span class="t-money" data-r="net">₹ —</span></p>
              <p class="bid-rc-s">The agreed price, in full. Tax as per confirmed rules.</p>
              <span class="pill pill-escrow">${L.icon('lock')}Paid from escrow after the brand approves</span>
            </div>
            <p class="help bid-side-note">${L.icon('lock')}The brand sees your price, note, date, views and links. Never your ID or payout details.</p>
          </aside>
        </div>
        <p class="sr-only" id="bidLive" aria-live="polite"></p>
        <div class="bid-dock dark" role="region" aria-label="Bid total">
          <p class="bid-dock-t"><span>You receive, the agreed price</span><b class="t-money bid-dock-v" data-r="dock">₹ —</b></p>
          <button class="lq lq-p" type="button" data-dockreview>Review bid</button>
        </div>
      </div>`;
      L.liquid(el);

      const $ = q => el.querySelector(q);
      const form = $('#bidForm'), priceIn = $('#bidPrice'), whyIn = $('#bidWhy'), postIn = $('#bidPost'), viewsIn = $('#bidViews'), linksUl = $('#bidLinks');

      /* ---------- links list ---------- */
      function renderLinks(focusIdx) {
        linksUl.innerHTML = d.links.map((v, i) => `<li class="bid-link" data-i="${i}">
            <div class="bid-link-row">
              <span class="bid-link-ic" aria-hidden="true">${L.icon('link')}</span>
              <label class="sr-only" for="bidL${i}">Link ${i + 1}</label>
              <input class="input" id="bidL${i}" type="url" inputmode="url" autocomplete="off" spellcheck="false" placeholder="instagram.com/reel/…" value="${esc(v)}" aria-describedby="bidLErr${i}">
              <button class="ibtn bid-link-x" type="button" data-rmlink="${i}" aria-label="Remove link ${i + 1}" ${d.links.length === 1 && !v ? 'hidden' : ''}>${L.icon('close')}</button>
            </div>
            <p class="err" id="bidLErr${i}"></p>
          </li>`).join('');
        const add = $('[data-addlink]'); add.disabled = d.links.length >= R.maxLinks; add.setAttribute('aria-disabled', String(add.disabled));
        const port = $('#bidPort');
        if (port) {
          const have = new Set(d.links.map(v => (checkUrl(v).href || '')));
          const left = portfolio.filter(p => !have.has(p.chk.href));
          port.innerHTML = left.map(p => `<button class="chip" type="button" data-port="${esc(p.url)}">${L.icon('plus')}<span>${esc(p.title)}</span></button>`).join('') || '<span class="help">All added.</span>';
        }
        if (focusIdx !== undefined) { const i = linksUl.querySelector('#bidL' + focusIdx); i && i.focus(); }
        if (tried || touched.has('links')) validate();
      }

      /* ---------- validation ---------- */
      function readPrice() { const dg = digits(priceIn.value); return dg ? L.rupees(Number(dg)) : 0; }
      function validate() {
        const e = {};
        const price = readPrice();
        if (!price) e.price = 'Enter your price in rupees.';
        else if (price < R.minPaise) e.price = `The lowest bid on Linkloom is ${L.inr(R.minPaise)}.`;
        else if (price > maxPaise) e.price = `This brand takes bids up to ${L.inr(maxPaise)}.`;
        const why = whyIn.value.trim();
        if (!why) e.why = 'Tell the brand why this price is fair.';
        else if (why.length < R.whyMin) e.why = `Add ${R.whyMin - why.length} more characters. Say what the brand gets for this price.`;
        const pd = postIn.value;
        if (!pd) e.post = 'Pick the day you will post.';
        else if (pd < minDate) e.post = `Pick a date from ${L.fmtDate(minDate)} onwards.`;
        else if (pd > maxDate) e.post = `The brand needs it live by ${L.fmtDate(maxDate)}. Pick that day or earlier.`;
        const vd = digits(viewsIn.value);
        if (viewsIn.value.trim() && !vd) e.views = 'Use a whole number, like 60,000.';
        else if (vd && Number(vd) > 1e8) e.views = 'That is more than 10 crore views. Check the number.';
        const linkErr = {}; const seen = new Set(); let good = 0;
        d.links.forEach((v, i) => {
          const c = checkUrl(v);
          if (c.empty) return;
          if (!c.ok) linkErr[i] = 'Enter a full link, like instagram.com/reel/abc.';
          else if (seen.has(c.href)) linkErr[i] = 'You added this link already.';
          else { seen.add(c.href); good++; }
        });
        if (!good && !Object.keys(linkErr).length) e.links = 'Add at least one link to similar work.';
        if (Object.keys(linkErr).length) e.linkItems = linkErr;

        const show = k => tried || touched.has(k);
        const put = (fid, eid, msg, k) => { const m = show(k) ? msg || '' : ''; $(eid).textContent = m; $(fid).classList.toggle('is-err', !!m); };
        put('#fPrice', '#bidPriceErr', e.price, 'price');
        put('#fWhy', '#bidWhyErr', e.why, 'why');
        put('#fPost', '#bidPostErr', e.post, 'post');
        put('#fViews', '#bidViewsErr', e.views, 'views');
        $('#bidLinksErr').textContent = show('links') ? e.links || '' : '';
        d.links.forEach((_, i) => {
          const p = linksUl.querySelector('#bidLErr' + i), inp = linksUl.querySelector('#bidL' + i);
          const m = show('links') ? linkErr[i] || '' : '';
          if (p) p.textContent = m;
          if (inp) { inp.closest('.bid-link').classList.toggle('is-err', !!m); inp.setAttribute('aria-invalid', String(!!m)); }
        });
        [['#bidPrice', e.price], ['#bidWhy', e.why], ['#bidPost', e.post], ['#bidViews', e.views]].forEach(([q, m]) => $(q).setAttribute('aria-invalid', String(!!(m && tried))));
        // soft warning: above the brand's budget but inside the rule
        $('#bidPriceWarn').textContent = !e.price && price > j.budget ? `${L.inr(price - j.budget)} over the brand's budget. Say why in your note.` : '';
        // post date positive note
        if (!e.post && pd) $('#bidPostHelp').textContent = `${L.fmtDate(pd)} is ${daysBetween(pd, maxDate) === 0 ? 'the deadline day' : daysBetween(pd, maxDate) + ' days before the deadline'}.`;
        else $('#bidPostHelp').textContent = `Live by ${L.fmtDate(maxDate)}, the brand's deadline.`;
        if (tried) summary(e);   // after the first Review, the summary tracks fixes live
        return e;
      }
      const NAMES = { price: 'your price', why: 'why this price', post: 'post date', views: 'expected views', links: 'similar work', linkItems: 'a link' };
      function summary(e) {
        const keys = Object.keys(e), box = $('#bidSum');
        box.innerHTML = keys.length ? `${L.icon('alert')}<span>Fix ${keys.length === 1 ? 'one thing' : keys.length + ' things'} first: ${keys.map(k => esc(NAMES[k])).join(', ')}.</span>` : '';
        return keys;
      }

      /* ---------- receipt ---------- */
      let liveT = 0;
      /* the total ticks to the new amount in Indian grouping (LLD.motion.count); plain text when motion is missing */
      function tick(node, to) {
        if (!node) return;
        if (L.motion && L.motion.ready && !L.RM) K.mo('count', node, to, L.inr, { duration: 320 });
        else node.textContent = L.inr(to);
        if (!L.RM && node.dataset.v !== undefined && +node.dataset.v !== to) { node.classList.remove('is-tick'); void node.offsetWidth; node.classList.add('is-tick'); }
        node.dataset.v = to;
      }
      function receipt() {
        const p = L.payout(readPrice());
        $('[data-r="price"]').textContent = p.price ? L.inr(p.price) : '₹ —';
        /* no price typed yet: show a quiet dash, not "₹0" */
        [$('[data-r="net"]'), $('[data-r="dock"]')].forEach(n => { if (!n) return; if (p.price) tick(n, p.net); else { n.textContent = '₹ —'; delete n.dataset.v; } });
        clearTimeout(liveT); liveT = setTimeout(() => { $('#bidLive').textContent = p.price ? `You receive ${L.inr(p.net)}, the agreed price. Tax as per confirmed rules.` : ''; }, 700);
      }
      function counter() {
        const n = whyIn.value.length, c = $('#bidWhyN');
        c.textContent = `${n} / ${R.whyMax}`;
        c.classList.toggle('is-near', n >= R.whyMax - 40);
        c.classList.toggle('is-short', n > 0 && whyIn.value.trim().length < R.whyMin);
      }
      const save = () => { d.price = digits(priceIn.value); d.why = whyIn.value; d.postDate = postIn.value; d.views = digits(viewsIn.value); saveDrafts(); };

      /* format money-like inputs as you type (Indian grouping), caret kept from the right */
      function grouped(inp, maxDigits) {
        const fromRight = inp.value.length - (inp.selectionEnd ?? inp.value.length);
        const dg = digits(inp.value).slice(0, maxDigits);
        inp.value = group(dg);
        const pos = Math.max(0, inp.value.length - fromRight);
        try { inp.setSelectionRange(pos, pos); } catch (e) {}
      }

      priceIn.addEventListener('input', () => { grouped(priceIn, 8); receipt(); save(); validate(); });
      viewsIn.addEventListener('input', () => { grouped(viewsIn, 10); save(); if (touched.has('views') || tried) validate(); });
      whyIn.addEventListener('input', () => { counter(); save(); if (touched.has('why') || tried) validate(); });
      postIn.addEventListener('change', () => { touched.add('post'); save(); validate(); });
      postIn.addEventListener('input', () => { save(); });
      [['price', priceIn], ['why', whyIn], ['post', postIn], ['views', viewsIn]].forEach(([k, inp]) => inp.addEventListener('blur', () => { touched.add(k); validate(); }));
      linksUl.addEventListener('input', e => { const li = e.target.closest('.bid-link'); if (!li) return; d.links[+li.dataset.i] = e.target.value; save(); const x = li.querySelector('.bid-link-x'); if (x) x.hidden = d.links.length === 1 && !e.target.value; if (touched.has('links') || tried) validate(); });
      linksUl.addEventListener('focusout', e => { if (e.target.matches('input')) { touched.add('links'); validate(); } });

      el.firstElementChild.addEventListener('click', e => {   // on this render's root, not the shared #view outlet
        const t = e.target.closest('button'); if (!t || !el.contains(t)) return;
        if (t.dataset.step) {
          const cur = Number(digits(priceIn.value)) || j.budget / 100;
          const next = Math.max(0, cur + Number(t.dataset.step));
          priceIn.value = group(String(next)); touched.add('price'); receipt(); save(); validate(); K.mo('press', t);
        } else if (t.hasAttribute('data-addlink')) {
          if (d.links.length >= R.maxLinks) return;
          d.links.push(''); save(); renderLinks(d.links.length - 1);
        } else if (t.dataset.rmlink !== undefined) {
          const i = +t.dataset.rmlink; d.links.splice(i, 1); if (!d.links.length) d.links = ['']; save(); renderLinks(Math.min(i, d.links.length - 1));
        } else if (t.dataset.port) {
          const empty = d.links.findIndex(v => !v.trim());
          if (empty >= 0) d.links[empty] = t.dataset.port; else if (d.links.length < R.maxLinks) d.links.push(t.dataset.port); else { L.toast(`Up to ${R.maxLinks} links`, 'info'); return; }
          touched.add('links'); save(); renderLinks();
          const add = $('[data-addlink]'); (add.disabled ? priceIn : add).focus();
        } else if (t.hasAttribute('data-kyc')) { save(); L.kycGate(j.id); }
        else if (t.hasAttribute('data-dockreview')) review();
      });
      form.addEventListener('submit', e => { e.preventDefault(); review(); });

      function review() {
        tried = true;
        const e = validate();
        const keys = summary(e);
        if (keys.length) {
          const first = { price: priceIn, why: whyIn, post: postIn, views: viewsIn, links: linksUl.querySelector('input'), linkItems: linksUl.querySelector('.bid-link.is-err input') }[keys[0]];
          first && first.focus();
          return;
        }
        $('#bidSum').textContent = '';
        openSummary();
      }

      function openSummary() {
        const price = readPrice(), p = L.payout(price), pd = postIn.value;
        const views = digits(viewsIn.value);
        const links = d.links.map(checkUrl).filter(c => c.ok);
        const uniq = [...new Map(links.map(c => [c.href, c])).values()];
        const kycNow = LLD_DATA.kyc.status, ok = kycNow === 'verified';
        const lead = daysBetween(pd, maxDate);
        L.openSheet({
          title: 'Check your bid',
          body: `<div class="bid-rv">
            <div class="bid-rv-slip">
              <div class="job-src">${K.brandChip(j)}<span class="t-small muted">${esc(j.title)}</span></div>
              <p class="bid-rv-lab">Your price</p>
              <p class="t-money bid-rv-price">${L.inr(price)}</p>
              <dl class="bid-rv-kv">
                <div class="kv"><dt>Post date</dt><dd>${esc(L.fmtDate(pd, { year: true }))}<span class="muted"> · ${lead === 0 ? 'deadline day' : lead + ' days early'}</span></dd></div>
                <div class="kv"><dt>Expected views</dt><dd>${views ? esc(group(views)) + '<span class="muted"> · your estimate</span>' : '<span class="muted">Not given</span>'}</dd></div>
                <div class="kv"><dt>Similar work</dt><dd><ul class="bid-rv-links">${uniq.map(c => `<li>${esc(c.short)}</li>`).join('')}</ul></dd></div>
              </dl>
              <div class="bid-rv-why"><p class="bid-rv-lab">Why this price</p><p>${esc(whyIn.value.trim())}</p></div>
            </div>
            <div class="bid-rv-rc ink-card">
              <dl>
                <div class="bid-rv-net"><dt>You receive</dt><dd><span class="t-money">${L.inr(p.net)}</span></dd></div>
                <div><dt>Tax / withholding</dt><dd>As per confirmed rules</dd></div>
              </dl>
              <p class="bid-rv-s">The agreed price, in full. Tax as per confirmed rules.</p>
            </div>
            <p class="help bid-rv-rule">${L.icon('info')}You can withdraw until the brand accepts. Once accepted, the price and post date are locked.</p>
            ${ok ? `<p class="bid-rv-kyc is-ok">${L.icon('check')}ID verified</p>` : `<div class="bid-rv-kyc is-no">${L.icon('shield')}<span>Verify your ID to send. Your draft is saved.</span><button class="lq lq-s lq-sm" type="button" data-kyc2>Verify ID</button></div>`}
            <p class="err" id="bidSendErr" aria-live="assertive"></p>
            <div class="bid-rv-acts">
              <button class="lq lq-p" type="button" data-send ${ok ? '' : 'disabled aria-disabled="true"'}>${L.icon('send')}Send bid</button>
              <button class="lq lq-s" type="button" data-edit>Keep editing</button>
            </div>
          </div>`,
          onMount(b, close) {
            b.querySelector('[data-edit]').addEventListener('click', () => close());
            const k2 = b.querySelector('[data-kyc2]'); if (k2) k2.addEventListener('click', () => { save(); L.kycGate(j.id); });
            const sendBtn = b.querySelector('[data-send]');
            sendBtn.addEventListener('click', () => {
              if (LLD_DATA.kyc.status !== 'verified') { b.querySelector('#bidSendErr').textContent = 'Verify your ID before sending.'; return; }
              if (!navigator.onLine) { b.querySelector('#bidSendErr').textContent = 'You are offline. Your bid is saved here; send it when you are back online.'; return; }
              sendBtn.disabled = true;
              const nb = {
                id: 'b' + Date.now().toString(36), job: j.id, price, status: 'submitted', sent: L.today().toISOString(),
                note: 'Waiting for the brand to review.', postDate: pd, views: views ? Number(views) : null, why: whyIn.value.trim(), links: uniq.map(c => c.href)
              };
              L.store.set(st => {
                st.bids.unshift(nb);
                const jj = st.jobs.find(x => x.id === j.id); if (jj) jj.bids += 1;
                if (st.me) st.me.totalBids = (st.me.totalBids || 0) + 1;
                delete st.bidDrafts[j.id];
                st.justSent = nb.id;
              }, 'bid-sent');
              saveDrafts();
              K.mo('celebrate', sendBtn);
              close(true);
              L.go('#bids');
            });
            K.mo('stagger', L.$$('.bid-rv > *', b));
            K.mo('print', b.querySelector('.bid-rv-rc'));
          }
        });
      }

      renderLinks(); counter(); receipt();
      if (d.price || d.why || d.postDate) { /* returning to a draft (for example after KYC): show where it stands */ ['price', 'why', 'post'].forEach(k => { if ((k === 'price' && d.price) || (k === 'why' && d.why) || (k === 'post' && d.postDate)) touched.add(k); }); validate(); }
      K.mo('stagger', L.$$('.bid-sec, .bid-receipt', el));
      K.mo('press', $('.bid-review-btn'));

      return () => { save(); clearTimeout(liveT); };
    }
  });
})();
