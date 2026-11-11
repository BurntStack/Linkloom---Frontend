/* Brand side · Post or edit a job (#post, #post-<id>). Builder C.
   Mirrors the creator bid form: a numbered slip on the left, an ink preview on the right, a dock on phones.
   Save as draft needs only a title; Publish checks everything. The working copy lives in LLD_DATA.ui.post[<id>|new]. */
(() => {
  const L = window.LLD, esc = L.esc, ic = L.icon;
  const FORMATS = { instagram: ['Reel', 'Story', 'Carousel'], youtube: ['Video', 'Short'] };
  const CATS = ['Skincare', 'Beauty', 'Makeup', 'Grooming', 'Lifestyle', 'Fitness', 'Science', 'Tech', 'Travel', 'Books'];
  const CITIES = ['Mumbai', 'New Delhi', 'Bengaluru', 'Chennai', 'Hyderabad', 'Kolkata', 'Pune', 'Ahmedabad', 'Kochi', 'Chandigarh'];
  const LANGS = ['English', 'Hindi', 'Marathi', 'Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Bengali', 'Gujarati', 'Punjabi', 'Urdu'];
  const FOLLOW = [[0, 'No minimum'], [10000, '10K+ followers'], [30000, '30K+ followers'], [50000, '50K+ followers'], [100000, '1L+ followers'], [250000, '2.5L+ followers']];
  const USAGE = ['No repost', 'Brand can repost for 30 days', 'Brand can repost for 90 days', 'Brand can embed on site', 'Paid ads for 30 days'];
  const R = { titleMin: 8, titleMax: 80, minBudget: 100000, maxBudget: 100000000, briefMin: 40, briefMax: 600, maxDel: 6, delMax: 120 };
  const digits = v => String(v ?? '').replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  const group = d => (d ? Number(d).toLocaleString('en-IN') : '');

  const fromJob = j => ({ title: j.title || '', platform: j.platform || 'instagram', format: j.format || 'Reel', category: j.category || 'Skincare',
    budget: j.budget ? String(Math.round(j.budget / 100)) : '', deadline: j.deadline || '', remote: !!j.remote, city: j.remote ? 'Mumbai' : (j.city || 'Mumbai'),
    languages: (j.languages || []).slice(), minFollowers: j.minFollowers || 0, deliverables: (j.deliverables && j.deliverables.length ? j.deliverables : ['']).slice(),
    usage: j.usage || USAGE[1], brief: j.brief || '' });
  const blank = () => fromJob({ platform: 'instagram', format: 'Reel', category: 'Skincare', city: 'Mumbai', languages: ['English', 'Hindi'], minFollowers: 30000, deliverables: [''], usage: USAGE[1] });

  L.register('post', {
    title: id => (id ? 'Edit job' : 'Post a job'),
    crumb: id => { const j = id && L.bk.job(id); return `<a href="#jobs">Jobs</a> / ${j ? esc(j.title) + ' / Edit' : 'Post a job'}`; },
    nav: 'jobs',
    render(el, id) {
      const K = L.bk, u = K.ui('post'), j = id ? K.job(id) : null;
      if (id && !j) {
        el.innerHTML = `<div class="view-in"><div class="empty"><img src="assets/step-01-envelope.svg" width="160" height="117" alt="">
          <p class="t-h2">This job is gone.</p><p class="muted">It may have been deleted. Your other jobs are safe.</p><a class="lq lq-p" href="#jobs">See all jobs</a></div></div>`;
        return;
      }
      if (j && (j.status === 'hired' || j.status === 'closed')) {
        const c = K.campOfJob(j.id);
        el.innerHTML = `<div class="view-in"><div class="empty"><img src="assets/step-05-stamp.svg" width="160" height="117" alt="">
          <p class="t-h2">${j.status === 'hired' ? 'You hired on this job, so the brief is locked.' : 'This job is closed, so it can’t be edited.'}</p>
          <p class="muted">${j.status === 'hired' ? 'The creator bid on this brief. Change details with them in the campaign chat.' : 'Post a new job if you need another creator.'}</p>
          <div class="row wrap pj-locked-cta">${c ? `<a class="lq lq-p" href="#campaign-${esc(c.id)}">Open campaign</a>` : '<a class="lq lq-p" href="#post">Post a new job</a>'}<a class="lq lq-s" href="#job-${esc(j.id)}">View job</a></div></div></div>`;
        L.liquid(el);
        return;
      }
      const key = id || 'new';
      const d = u[key] || (u[key] = j ? fromJob(j) : blank());
      const today = K.todayISO(), minDate = K.addDays(today, 1), maxDate = K.addDays(today, 365);
      const isOpen = j && j.status === 'open', isDraft = !j || j.status === 'draft';
      const touched = new Set(); let tried = false;

      el.innerHTML = `<div class="view-in pj">
        <a class="btn-q pj-back" href="${j ? '#job-' + esc(j.id) : '#jobs'}">${ic('back')}${j ? 'Back to the job' : 'All jobs'}</a>
        <header class="pj-h">
          <h1 class="t-h1">${j ? (isOpen ? 'Edit job' : 'Finish your draft') : 'Post a job'}</h1>
          <p class="muted t-small">${isOpen ? `Live since ${esc(L.fmtDate(j.posted))} · ${j.bids} bids so far. Creators who bid see the changes.` : 'Creators who fit bid with a price, a date and their reasons. You pick, then pay into escrow.'}</p>
        </header>
        <div class="pj-layout">
          <form class="pj-slip" id="pjForm" novalidate>
            <section class="pj-sec" aria-labelledby="pjS1">
              <span class="pj-n" aria-hidden="true">01</span>
              <div class="stack pj-stack">
                <p class="pj-sec-h" id="pjS1">What you need</p>
                <div class="field" id="fTitle">
                  <label for="pjTitle">Job title</label>
                  <input class="input" id="pjTitle" maxlength="${R.titleMax}" autocomplete="off" placeholder="For example: Barrier Repair Serum launch" value="${esc(d.title)}" aria-describedby="pjTitleErr">
                  <p class="err" id="pjTitleErr"></p>
                </div>
                <div class="pj-pair">
                  <div class="field"><p class="lab" id="pjPlatL">Platform</p>
                    <div class="seg pj-seg" role="group" aria-labelledby="pjPlatL">${['instagram', 'youtube'].map(p => `<button type="button" data-plat="${p}" aria-pressed="${d.platform === p}">${K.glyph(p)}${K.plat(p)}</button>`).join('')}</div></div>
                  <div class="field"><label for="pjCat">Category</label>
                    <select class="select" id="pjCat">${CATS.map(c => `<option${c === d.category ? ' selected' : ''}>${c}</option>`).join('')}</select></div>
                </div>
                <div class="field" id="fFormat"><p class="lab" id="pjFmtL">Format</p>
                  <div class="chips" role="group" aria-labelledby="pjFmtL" id="pjFormats"></div>
                  <p class="err" id="pjFormatErr"></p></div>
              </div>
            </section>

            <section class="pj-sec" aria-labelledby="pjBudgetL">
              <span class="pj-n" aria-hidden="true">02</span>
              <div class="stack pj-stack">
                <div class="field" id="fBudget">
                  <label id="pjBudgetL" for="pjBudget">Budget</label>
                  <div class="money-in pj-money">
                    <span aria-hidden="true">₹</span>
                    <input id="pjBudget" type="text" inputmode="numeric" autocomplete="off" maxlength="11" placeholder="0" value="${esc(group(d.budget))}" aria-describedby="pjBudgetHelp pjBudgetErr">
                    <button class="pj-step" type="button" data-step="-500" aria-label="Lower by ₹500">${ic('minus')}</button>
                    <button class="pj-step" type="button" data-step="500" aria-label="Raise by ₹500">${ic('plus')}</button>
                  </div>
                  <p class="help" id="pjBudgetHelp">What you expect to pay one creator. Creators may bid a little above or below. You pay the agreed price into escrow when you hire. No platform fee.</p>
                  <p class="err" id="pjBudgetErr"></p>
                </div>
                <div class="field pj-date" id="fDeadline">
                  <label for="pjDeadline">Live by</label>
                  <input class="input" id="pjDeadline" type="date" min="${minDate}" max="${maxDate}" value="${esc(d.deadline)}" aria-describedby="pjDeadlineHelp pjDeadlineErr">
                  <p class="help" id="pjDeadlineHelp">The last day the post can go live.</p>
                  <p class="err" id="pjDeadlineErr"></p>
                </div>
              </div>
            </section>

            <section class="pj-sec" aria-labelledby="pjS3">
              <span class="pj-n" aria-hidden="true">03</span>
              <div class="stack pj-stack">
                <p class="pj-sec-h" id="pjS3">Who can bid</p>
                <div class="pj-pair">
                  <div class="field"><p class="lab" id="pjWhereL">Where they shoot</p>
                    <div class="seg pj-seg" role="group" aria-labelledby="pjWhereL"><button type="button" data-remote="0" aria-pressed="${!d.remote}">${ic('pin')}In a city</button><button type="button" data-remote="1" aria-pressed="${d.remote}">Any city</button></div></div>
                  <div class="field" id="fCity" ${d.remote ? 'hidden' : ''}><label for="pjCity">City</label>
                    <select class="select" id="pjCity">${CITIES.map(c => `<option${c === d.city ? ' selected' : ''}>${c}</option>`).join('')}</select></div>
                </div>
                <div class="field" id="fLangs"><p class="lab" id="pjLangL">Languages <span class="pj-opt">pick all that work</span></p>
                  <div class="chips" role="group" aria-labelledby="pjLangL" id="pjLangs"></div>
                  <p class="err" id="pjLangsErr"></p></div>
                <div class="field pj-date"><label for="pjFollow">Minimum followers</label>
                  <select class="select" id="pjFollow">${FOLLOW.map(([v, t]) => `<option value="${v}"${v === +d.minFollowers ? ' selected' : ''}>${t}</option>`).join('')}</select>
                  <p class="help">On the platform above. Smaller creators often have the most engaged audiences.</p></div>
              </div>
            </section>

            <section class="pj-sec" aria-labelledby="pjDelL">
              <span class="pj-n" aria-hidden="true">04</span>
              <div class="stack pj-stack">
                <div class="field" id="fDels">
                  <p class="lab" id="pjDelL">Deliverables</p>
                  <ol class="pj-dels" id="pjDels" aria-labelledby="pjDelL"></ol>
                  <div class="pj-dels-f"><button class="btn-q" type="button" data-adddel>${ic('plus')}Add a deliverable</button><span class="help">Up to ${R.maxDel}. One line each, as the creator should read it.</span></div>
                  <p class="err" id="pjDelsErr"></p>
                </div>
                <div class="field pj-date"><label for="pjUsage">Usage rights</label>
                  <select class="select" id="pjUsage">${USAGE.map(x => `<option${x === d.usage ? ' selected' : ''}>${x}</option>`).join('')}</select>
                  <p class="help">What you may do with the content after it goes live.</p></div>
              </div>
            </section>

            <section class="pj-sec" aria-labelledby="pjBriefL">
              <span class="pj-n" aria-hidden="true">05</span>
              <div class="field" id="fBrief">
                <div class="pj-why-h"><label id="pjBriefL" for="pjBrief">The brief</label><span class="t-note pj-note" aria-hidden="true">creators read this first</span></div>
                <textarea class="textarea" id="pjBrief" maxlength="${R.briefMax}" rows="5" aria-describedby="pjBriefHelp pjBriefN pjBriefErr" placeholder="What the product is, the one thing to say, the feel you want, and anything to avoid. For example: show a real morning routine, no filters.">${esc(d.brief)}</textarea>
                <div class="pj-why-f"><p class="help" id="pjBriefHelp">At least ${R.briefMin} characters.</p><p class="pj-count num" id="pjBriefN"></p></div>
                <p class="err" id="pjBriefErr"></p>
              </div>
            </section>

            <div class="pj-foot">
              <p class="pj-sum" id="pjSum" aria-live="polite"></p>
              <button class="lq lq-p" type="submit">${isOpen ? 'Save changes' : 'Publish job'}</button>
              ${isDraft ? `<button class="lq lq-s" type="button" data-draft>${j ? 'Save draft' : 'Save as draft'}</button>` : `<a class="lq lq-s" href="#job-${esc(j.id)}">Cancel</a>`}
              <p class="help pj-foot-h">${isOpen ? 'Changes show to creators straight away.' : 'Creators see it as soon as you publish. A draft stays private.'}</p>
            </div>
            ${j ? `<div class="pj-danger" role="group" aria-label="Close or delete">
              <div><p class="t-label">${isOpen ? 'Done hiring, or changed your mind?' : 'Not needed any more?'}</p><p class="help">${isOpen ? 'Closing stops new bids and tells the creators who bid.' : 'Delete the draft. Creators never saw it.'}</p></div>
              <div class="row wrap">${isOpen ? '<button class="lq lq-s lq-sm" type="button" data-closejob>Close job</button>' : ''}<button class="lq lq-s lq-sm" type="button" data-deljob>${ic('trash')}${isOpen ? 'Delete job' : 'Delete draft'}</button></div>
            </div>` : ''}
          </form>

          <aside class="pj-side" aria-label="Preview">
            <div class="pj-receipt ink-card">
              <p class="pj-rc-h">How creators see it</p>
              <p class="pj-pv-plat" data-p="plat"></p>
              <p class="pj-pv-t" data-p="title"></p>
              <p class="pj-rc-l">Budget</p>
              <p class="pj-rc-net"><span class="t-money" data-p="budget">₹ —</span></p>
              <dl class="pj-rows">
                <div><dt>Live by</dt><dd data-p="deadline">—</dd></div>
                <div><dt>Where</dt><dd data-p="where">—</dd></div>
                <div><dt>Deliverables</dt><dd data-p="dels">—</dd></div>
                <div><dt>Taxes</dt><dd>As per confirmed rules</dd></div>
              </dl>
              <p class="pj-rc-s">The creator you hire receives the agreed price in full. No platform fee.</p>
              <span class="pill pill-escrow">${ic('lock')}Paid into escrow when you hire</span>
            </div>
            <p class="help pj-side-note">${ic('info')}Your brand name and logo show on the brief. Your billing details never do.</p>
          </aside>
        </div>
        <p class="sr-only" id="pjLive" aria-live="polite"></p>
        <div class="pj-dock dark" role="region" aria-label="Publish">
          <p class="pj-dock-t"><span>Budget</span><b class="t-money pj-dock-v" data-p="dock">₹ —</b></p>
          <button class="lq lq-p" type="button" data-dock>${isOpen ? 'Save changes' : 'Publish'}</button>
        </div>
      </div>`;
      L.liquid(el);

      const $ = q => el.querySelector(q);
      const form = $('#pjForm'), titleIn = $('#pjTitle'), budgetIn = $('#pjBudget'), dlIn = $('#pjDeadline'), briefIn = $('#pjBrief'), delsOl = $('#pjDels');

      /* ---------- choice groups ---------- */
      function formats() {
        const list = FORMATS[d.platform]; if (!list.includes(d.format)) d.format = list[0];
        $('#pjFormats').innerHTML = list.map(f => `<button class="chip" type="button" data-fmt="${f}" aria-pressed="${f === d.format}">${f}</button>`).join('');
      }
      function langs() { $('#pjLangs').innerHTML = LANGS.map(l => `<button class="chip" type="button" data-lang="${l}" aria-pressed="${d.languages.includes(l)}">${d.languages.includes(l) ? ic('check') : ''}${l}</button>`).join(''); }
      function dels(focus) {
        delsOl.innerHTML = d.deliverables.map((v, i) => `<li class="pj-del" data-i="${i}">
          <span class="pj-del-n" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
          <label class="sr-only" for="pjD${i}">Deliverable ${i + 1}</label>
          <input class="input" id="pjD${i}" maxlength="${R.delMax}" autocomplete="off" placeholder="${i === 0 ? '1 Reel, 30–45 s' : i === 1 ? 'Product on screen in the first 3 s' : 'One line'}" value="${esc(v)}">
          <button class="ibtn pj-del-x" type="button" data-rmdel="${i}" aria-label="Remove deliverable ${i + 1}" ${d.deliverables.length === 1 && !v ? 'hidden' : ''}>${ic('close')}</button>
        </li>`).join('');
        const add = $('[data-adddel]'); add.disabled = d.deliverables.length >= R.maxDel;
        if (focus !== undefined) { const i = delsOl.querySelector('#pjD' + focus); i && i.focus(); }
      }

      /* ---------- validation ---------- */
      const readBudget = () => { const g = digits(budgetIn.value); return g ? L.rupees(Number(g)) : 0; };
      function check(publish) {
        const e = {};
        const t = titleIn.value.trim();
        if (!t) e.title = publish ? 'Give the job a title creators will understand.' : 'Give the draft a name so you can find it later.';
        else if (publish && t.length < R.titleMin) e.title = `Make the title a little longer, at least ${R.titleMin} characters.`;
        if (!publish) return e;
        const b = readBudget();
        if (!b) e.budget = 'Enter a budget in rupees.';
        else if (b < R.minBudget) e.budget = `The lowest budget on Linkloom is ${L.inr(R.minBudget)}.`;
        else if (b > R.maxBudget) e.budget = `Budgets go up to ${L.inr(R.maxBudget)} per job. Split bigger work into more jobs.`;
        const dl = dlIn.value;
        if (!dl) e.deadline = 'Pick the last day the post can go live.';
        else if (dl < minDate) e.deadline = `Pick ${L.fmtDate(minDate)} or later, so creators have time.`;
        else if (dl > maxDate) e.deadline = 'Pick a date within the next year.';
        if (!d.languages.length) e.langs = 'Pick at least one language.';
        if (!d.deliverables.some(x => x.trim())) e.dels = 'Add at least one deliverable.';
        const br = briefIn.value.trim();
        if (!br) e.brief = 'Write the brief. Two or three sentences is enough.';
        else if (br.length < R.briefMin) e.brief = `Add ${R.briefMin - br.length} more characters. Say what to show and what to avoid.`;
        return e;
      }
      function show(e) {
        const vis = k => tried || touched.has(k);
        const put = (fid, eid, k, inp) => { const m = vis(k) ? e[k] || '' : ''; $(eid).textContent = m; $(fid).classList.toggle('is-err', !!m); inp && inp.setAttribute('aria-invalid', String(!!m)); };
        put('#fTitle', '#pjTitleErr', 'title', titleIn); put('#fBudget', '#pjBudgetErr', 'budget', budgetIn); put('#fDeadline', '#pjDeadlineErr', 'deadline', dlIn);
        put('#fLangs', '#pjLangsErr', 'langs'); put('#fDels', '#pjDelsErr', 'dels'); put('#fBrief', '#pjBriefErr', 'brief', briefIn);
        const dl = dlIn.value;
        $('#pjDeadlineHelp').textContent = dl && !e.deadline ? `${L.fmtDate(dl, { year: true })}, ${K.daysTo(dl)} days from today.` : 'The last day the post can go live.';
        if (tried) summary(e);
      }
      const NAMES = { title: 'title', budget: 'budget', deadline: 'live-by date', langs: 'languages', dels: 'deliverables', brief: 'the brief' };
      function summary(e) {
        const keys = Object.keys(e);
        $('#pjSum').innerHTML = keys.length ? `${ic('alert')}<span>Fix ${keys.length === 1 ? 'one thing' : keys.length + ' things'} first: ${keys.map(k => esc(NAMES[k])).join(', ')}.</span>` : '';
        return keys;
      }
      const validate = () => show(check(true));

      /* ---------- live preview ---------- */
      function preview() {
        const b = readBudget(), n = d.deliverables.filter(x => x.trim()).length;
        $('[data-p="plat"]').innerHTML = `${K.glyph(d.platform)}<span>${esc(K.plat(d.platform))} ${esc(d.format)} · ${esc(d.category)}</span>`;
        $('[data-p="title"]').textContent = titleIn.value.trim() || 'Your job title';
        $('[data-p="title"]').classList.toggle('is-ph', !titleIn.value.trim());
        [$('[data-p="budget"]'), $('[data-p="dock"]')].forEach(nd => { if (!b) { nd.textContent = '₹ —'; delete nd.dataset.v; return; } if (+nd.dataset.v !== b) { if (nd.dataset.v && !L.RM) K.mo('count', nd, b, L.inr, { duration: 320 }); else nd.textContent = L.inr(b); nd.dataset.v = b; } });
        $('[data-p="deadline"]').textContent = dlIn.value ? L.fmtDate(dlIn.value, { year: true }) : '—';
        $('[data-p="where"]').textContent = d.remote ? 'Any city · remote' : d.city;
        $('[data-p="dels"]').textContent = n ? `${n} item${n === 1 ? '' : 's'}` : '—';
      }
      const sync = () => { d.title = titleIn.value; d.budget = digits(budgetIn.value); d.deadline = dlIn.value; d.brief = briefIn.value; d.category = $('#pjCat').value; d.city = $('#pjCity').value; d.minFollowers = +$('#pjFollow').value; d.usage = $('#pjUsage').value; };
      const counter = () => { const n = briefIn.value.length, c = $('#pjBriefN'); c.textContent = `${n} / ${R.briefMax}`; c.classList.toggle('is-near', n >= R.briefMax - 40); };
      function grouped(inp, max) {
        const fromRight = inp.value.length - (inp.selectionEnd ?? inp.value.length);
        inp.value = group(digits(inp.value).slice(0, max));
        const pos = Math.max(0, inp.value.length - fromRight); try { inp.setSelectionRange(pos, pos); } catch (e) {}
      }
      const changed = () => { sync(); preview(); if (tried || touched.size) validate(); };

      titleIn.addEventListener('input', changed);
      budgetIn.addEventListener('input', () => { grouped(budgetIn, 8); changed(); });
      dlIn.addEventListener('change', () => { touched.add('deadline'); changed(); });
      briefIn.addEventListener('input', () => { counter(); changed(); });
      ['pjCat', 'pjCity', 'pjFollow', 'pjUsage'].forEach(x => $('#' + x).addEventListener('change', changed));
      [['title', titleIn], ['budget', budgetIn], ['deadline', dlIn], ['brief', briefIn]].forEach(([k, inp]) => inp.addEventListener('blur', () => { if (inp.value.trim()) touched.add(k); validate(); }));
      delsOl.addEventListener('input', e => { const li = e.target.closest('.pj-del'); if (!li) return; d.deliverables[+li.dataset.i] = e.target.value; const x = li.querySelector('.pj-del-x'); if (x) x.hidden = d.deliverables.length === 1 && !e.target.value; changed(); });
      delsOl.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('input')) { e.preventDefault(); if (d.deliverables.length < R.maxDel && e.target.value.trim()) { d.deliverables.push(''); dels(d.deliverables.length - 1); } } });

      el.firstElementChild.addEventListener('click', e => {
        const t = e.target.closest('button'); if (!t || !el.contains(t)) return;
        if (t.dataset.plat) { d.platform = t.dataset.plat; L.$$('[data-plat]', el).forEach(b => b.setAttribute('aria-pressed', String(b === t))); formats(); changed(); }
        else if (t.dataset.fmt) { d.format = t.dataset.fmt; formats(); $(`[data-fmt="${d.format}"]`).focus(); changed(); }
        else if (t.dataset.remote !== undefined) { d.remote = t.dataset.remote === '1'; L.$$('[data-remote]', el).forEach(b => b.setAttribute('aria-pressed', String(b === t))); $('#fCity').hidden = d.remote; changed(); }
        else if (t.dataset.lang) { const l = t.dataset.lang; d.languages = d.languages.includes(l) ? d.languages.filter(x => x !== l) : [...d.languages, l]; langs(); $(`[data-lang="${l}"]`).focus(); touched.add('langs'); changed(); }
        else if (t.dataset.step) { const cur = Number(digits(budgetIn.value)) || 0; budgetIn.value = group(String(Math.max(0, cur + Number(t.dataset.step)))); touched.add('budget'); changed(); }
        else if (t.hasAttribute('data-adddel')) { if (d.deliverables.length < R.maxDel) { d.deliverables.push(''); dels(d.deliverables.length - 1); } }
        else if (t.dataset.rmdel !== undefined) { const i = +t.dataset.rmdel; d.deliverables.splice(i, 1); if (!d.deliverables.length) d.deliverables = ['']; dels(Math.min(i, d.deliverables.length - 1)); touched.add('dels'); changed(); }
        else if (t.hasAttribute('data-draft')) save(false, t);
        else if (t.hasAttribute('data-dock')) save(true, t);
        else if (t.hasAttribute('data-closejob')) K.closeJob(j.id, () => { delete u[key]; L.go('#jobs'); });
        else if (t.hasAttribute('data-deljob')) K.deleteJob(j.id, () => { delete u[key]; L.go('#jobs'); });
      });
      form.addEventListener('submit', e => { e.preventDefault(); save(true, form.querySelector('[type=submit]')); });

      function save(publish, btn) {
        sync();
        if (publish) tried = true;
        const e = check(publish);
        if (publish) show(e); else { touched.add('title'); show(e); }
        const keys = Object.keys(e);
        if (keys.length) {
          if (publish) summary(e);
          const f = { title: titleIn, budget: budgetIn, deadline: dlIn, langs: $('#pjLangs .chip'), dels: delsOl.querySelector('input'), brief: briefIn }[keys[0]];
          f && f.focus(); K.mo('shake', f && f.closest('.field'));
          return;
        }
        const rec = {
          title: d.title.trim(), platform: d.platform, format: d.format, category: d.category, budget: readBudget() || (j ? j.budget : 0),
          deadline: d.deadline || (j ? j.deadline : ''), city: d.remote ? 'Any city' : d.city, remote: d.remote, languages: d.languages.slice(),
          minFollowers: +d.minFollowers || 0, deliverables: d.deliverables.map(x => x.trim()).filter(Boolean), usage: d.usage, brief: d.brief.trim()
        };
        let jid = j && j.id;
        const wasDraft = !j || j.status === 'draft';
        L.store.set(s => {
          if (j) { const x = s.jobs.find(y => y.id === j.id); Object.assign(x, rec); if (publish && x.status === 'draft') { x.status = 'open'; x.posted = K.nowISO(); } }
          else { jid = 'j' + Date.now().toString(36); s.jobs.unshift({ id: jid, status: publish ? 'open' : 'draft', posted: publish ? K.nowISO() : null, bids: 0, ...rec }); }
        }, publish ? 'job-published' : 'job-draft');
        delete u[key];
        K.ui('jobs').justSaved = jid;
        K.ui('jobs').tab = 'all';
        L.toast(!publish ? 'Draft saved. Only you can see it.' : wasDraft ? 'Job published. Creators can bid now.' : 'Changes saved', 'check');
        L.go('#jobs');
      }

      formats(); langs(); dels(); counter(); preview();
      if (j && isDraft) { touched.add('title'); }
      K.mo('stagger', L.$$('.pj-sec, .pj-receipt', el));
      return () => sync();
    }
  });
})();
