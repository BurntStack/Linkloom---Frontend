/* Find creators (#creators), Saved creators (#saved) and the shared creator kit (LLD.ck) used by the profile and the cart.
   Owner: Builder B. Mirrors the creator app's Find jobs screen: filter column, cards, sort, hide with undo, swipe, keyboard keys.
   View state lives in LLD_DATA.ui.creators (and a sessionStorage copy, in try/catch). Classes are .creators-*; styles in creators.css. */
(() => {
  const L = window.LLD, esc = L.esc, S = () => window.LLD_DATA;
  /* motion calls are always guarded: a missing or failing hook never breaks a screen */
  const mo = (fn, ...a) => { try { const m = L.motion; return m && m[fn] ? m[fn](...a) : null; } catch (e) { return null; } };
  const flip = (mutate, nodes) => { let done = false; const m = () => { done = true; mutate(); }; try { L.motion && L.motion.flip && L.motion.flip(m, nodes); } catch (e) {} if (!done) mutate(); };

  const UI0 = { q: '', cats: [], platform: '', country: '', state: '', city: '', lang: '', followers: '', er: 0, pmin: '', pmax: '', rating: 0,
    verified: false, avail: '', content: [], gender: '', age: '', sort: 'match', hidden: [], showHidden: false };
  const SS_KEY = 'll.b.creatorsUI';
  function ensure() {
    const s = S();
    s.ui = s.ui || {};
    s.favorites = s.favorites || [];
    s.cart = s.cart || [];
    const u = s.ui.creators || (s.ui.creators = {});
    Object.keys(UI0).forEach(k => { if (!(k in u)) u[k] = Array.isArray(UI0[k]) ? [] : UI0[k]; });
    ['cats', 'content', 'hidden'].forEach(k => { if (!Array.isArray(u[k])) u[k] = []; });
    return s;
  }
  ensure();
  try { const raw = sessionStorage.getItem(SS_KEY); if (raw) Object.assign(S().ui.creators, JSON.parse(raw)); } catch (e) {}
  const persist = () => { try { const { scrollY, ...keep } = S().ui.creators; sessionStorage.setItem(SS_KEY, JSON.stringify(keep)); } catch (e) {} };

  /* ---------- lookups and numbers ---------- */
  const PLAT = { instagram: { name: 'Instagram', ic: 'ig', unit: 'Followers' }, youtube: { name: 'YouTube', ic: 'yt', unit: 'Subscribers' } };
  const FORMATS = { instagram: ['Reel', 'Story', 'Carousel'], youtube: ['Video', 'Short'] };
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const pct = n => (Math.round(n * 10) / 10).toFixed(1) + '%';
  const isFav = id => S().favorites.includes(id);
  const inCart = id => S().cart.includes(id);
  const plats = (c, p) => c.platforms.filter(x => !p || x.p === p);
  const reach = (c, p) => plats(c, p).reduce((n, x) => n + x.followers, 0);
  const weighted = (c, p, k) => { const ps = plats(c, p), f = ps.reduce((n, x) => n + x.followers, 0); return f ? ps.reduce((n, x) => n + x.followers * x[k], 0) / f : 0; };
  const erOf = (c, p) => weighted(c, p, 'er');
  const viewsOf = (c, p) => Math.round(weighted(c, p, 'avgViews'));
  const rateList = (c, types) => Object.entries(c.rates || {}).filter(([k]) => !types || !types.length || types.some(t => t.toLowerCase() === k));
  const fromRate = (c, types) => { const r = rateList(c, types).sort((a, b) => a[1] - b[1])[0]; return r ? { fmt: cap(r[0]), price: r[1] } : null; };
  const glyph = p => L.icon(PLAT[p] ? PLAT[p].ic : 'link');

  /* availability: 'open' | 'from 15 Nov' | 'busy until 20 Nov' -> days from today until the creator can start */
  const MON = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
  function availDays(c) {
    const a = c.availability || 'open'; if (a === 'open') return 0;
    const m = /(\d{1,2})\s+([A-Z][a-z]{2})/.exec(a); if (!m || !(m[2] in MON)) return 0;
    const t = L.today(); let y = t.getFullYear(); if (MON[m[2]] < t.getMonth()) y++;
    const d = new Date(Date.UTC(y, MON[m[2]], +m[1], 6, 30));
    const n = Math.round((d - new Date(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate(), 6, 30))) / 864e5);
    return /until/.test(a) ? n + 1 : n;
  }
  const availLabel = c => { const a = c.availability || 'open'; return a === 'open' ? 'Available now' : /until/.test(a) ? cap(a) : 'Free ' + a; };
  const availPill = c => availDays(c) <= 0
    ? `<span class="pill pill-ok creators-av-pill"><span class="dot" aria-hidden="true"></span>${esc(availLabel(c))}</span>`
    : `<span class="pill pill-line creators-av-pill">${L.icon('cal')}${esc(availLabel(c))}</span>`;

  /* Best match: how well a creator fits this brand (industry, city, quality signals) */
  function score(c) {
    const me = S().me; let s = 0;
    if (c.categories.includes(me.industry)) s += 30;
    if (c.city === me.city) s += 8;
    s += (c.rating || 4.2) * 6 + erOf(c) * 1.5 + (c.verified ? 6 : 0) + (availDays(c) <= 0 ? 4 : 0);
    return s;
  }

  /* ---------- filter vocabularies ---------- */
  const FOLLOW = [['', 'Any'], ['0-50000', 'Under 50K'], ['50000-100000', '50K–1L'], ['100000-300000', '1L–3L'], ['300000-', '3L+']];
  const ERS = [[0, 'Any'], [3, '3%+'], [5, '5%+'], [7, '7%+']];
  const RATINGS = [[0, 'Any'], [4, '4.0+'], [4.5, '4.5+'], [4.8, '4.8+']];
  const AVAIL = [['', 'Any time'], ['now', 'Available now'], ['2w', 'Within 2 weeks']];
  const GENDERS = [['', 'Any'], ['Woman', 'Women'], ['Man', 'Men']];
  const AGES = [['', 'Any'], ['18-24', '18–24'], ['25-34', '25–34'], ['35-', '35+']];
  const CONTENT = ['Reel', 'Story', 'Carousel', 'Video', 'Short'];
  const SORTS = { match: 'Best match', followers: 'Most followers', er: 'Highest engagement', price: 'Price: low to high', rating: 'Highest rating' };
  const range = v => { const [a, b] = String(v).split('-'); return [+a || 0, b ? +b : Infinity]; };
  const rup = v => (v === '' || v == null ? null : Math.max(0, parseInt(v, 10) || 0));
  const priceErr = ui => { const a = rup(ui.pmin), b = rup(ui.pmax); return a != null && b != null && a > b ? 'Minimum is above maximum.' : ''; };

  function passes(c, ui, skip) {
    const on = k => k !== skip;
    const q = ui.q.trim().toLowerCase().replace(/^@/, '');
    if (on('q') && q && ![c.name, c.handle, ...c.platforms.map(p => p.handle)].join(' ').toLowerCase().replace(/@/g, '').includes(q)) return false;
    if (on('platform') && ui.platform && !c.platforms.some(p => p.p === ui.platform)) return false;
    if (on('country') && ui.country && c.country !== ui.country) return false;
    if (on('state') && ui.state && c.state !== ui.state) return false;
    if (on('city') && ui.city && c.city !== ui.city) return false;
    if (on('lang') && ui.lang && !c.languages.includes(ui.lang)) return false;
    if (on('followers') && ui.followers) { const [a, b] = range(ui.followers), f = reach(c, ui.platform); if (f < a || f >= b) return false; }
    if (on('er') && ui.er && erOf(c, ui.platform) < ui.er) return false;
    if (on('price') && !priceErr(ui) && (rup(ui.pmin) != null || rup(ui.pmax) != null)) {
      const a = (rup(ui.pmin) || 0) * 100, b = rup(ui.pmax) != null ? rup(ui.pmax) * 100 : Infinity;
      if (!rateList(c, ui.content).some(([, v]) => v >= a && v <= b)) return false;
    }
    if (on('rating') && ui.rating && !(c.rating && c.rating >= ui.rating)) return false;
    if (on('verified') && ui.verified && !c.verified) return false;
    if (on('avail') && ui.avail && availDays(c) > (ui.avail === 'now' ? 0 : 14)) return false;
    const ct = ui.content.filter(x => skip !== 'ct:' + x);
    if (ct.length && !ct.some(t => c.content.includes(t))) return false;
    if (on('gender') && ui.gender && c.gender !== ui.gender) return false;
    if (on('age') && ui.age) { const [a, b] = range(ui.age); if (!c.age || c.age < a || c.age > (b === Infinity ? 200 : b)) return false; }
    return true;
  }
  /* categories are any-of; `skip` lets the empty state ask "how many would come back without this one filter?" */
  const catOk = (c, ui, skip) => { const cs = ui.cats.filter(x => skip !== 'cat:' + x); return !cs.length || c.categories.some(x => cs.includes(x)); };
  const keep = (c, ui, skip) => catOk(c, ui, skip) && passes(c, Object.assign({}, ui, { cats: [] }), skip);

  function filtered(ui) {
    let list = S().creators.filter(c => keep(c, ui));
    const hiddenCount = list.filter(c => ui.hidden.includes(c.id)).length;
    if (!ui.showHidden) list = list.filter(c => !ui.hidden.includes(c.id));
    const by = {
      match: (a, b) => score(b) - score(a),
      followers: (a, b) => reach(b, ui.platform) - reach(a, ui.platform),
      er: (a, b) => erOf(b, ui.platform) - erOf(a, ui.platform),
      price: (a, b) => ((fromRate(a, ui.content) || {}).price || 9e12) - ((fromRate(b, ui.content) || {}).price || 9e12),
      rating: (a, b) => (b.rating || 0) - (a.rating || 0) || b.reviews - a.reviews
    }[ui.sort] || ((a, b) => score(b) - score(a));
    return { list: list.sort(by), hiddenCount };
  }

  /* the chips above the results: one per active filter, each removable */
  function actives(ui) {
    const A = [], lab = (arr, v) => (arr.find(x => String(x[0]) === String(v)) || [, v])[1];
    if (ui.q.trim()) A.push({ k: 'q', label: `“${ui.q.trim()}”`, off: u => { u.q = ''; } });
    ui.cats.forEach(x => A.push({ k: 'cat:' + x, label: x, off: u => { u.cats = u.cats.filter(y => y !== x); } }));
    if (ui.platform) A.push({ k: 'platform', label: PLAT[ui.platform].name, off: u => { u.platform = ''; } });
    ui.content.forEach(x => A.push({ k: 'ct:' + x, label: x, off: u => { u.content = u.content.filter(y => y !== x); } }));
    if (ui.followers) A.push({ k: 'followers', label: lab(FOLLOW, ui.followers) + ' followers', off: u => { u.followers = ''; } });
    if (ui.er) A.push({ k: 'er', label: 'Engagement ' + lab(ERS, ui.er), off: u => { u.er = 0; } });
    if (ui.lang) A.push({ k: 'lang', label: ui.lang, off: u => { u.lang = ''; } });
    if (ui.city) A.push({ k: 'city', label: ui.city, off: u => { u.city = ''; } });
    if (ui.state) A.push({ k: 'state', label: ui.state, off: u => { u.state = ''; u.city = ''; } });
    if (ui.country) A.push({ k: 'country', label: ui.country, off: u => { u.country = ''; u.state = ''; u.city = ''; } });
    const a = rup(ui.pmin), b = rup(ui.pmax);
    if ((a != null || b != null) && !priceErr(ui)) A.push({ k: 'price', label: a != null && b != null ? `${L.inr(a * 100)}–${L.inr(b * 100)}` : a != null ? `From ${L.inr(a * 100)}` : `Up to ${L.inr(b * 100)}`, off: u => { u.pmin = ''; u.pmax = ''; } });
    if (ui.rating) A.push({ k: 'rating', label: 'Rated ' + lab(RATINGS, ui.rating), off: u => { u.rating = 0; } });
    if (ui.verified) A.push({ k: 'verified', label: 'Verified only', off: u => { u.verified = false; } });
    if (ui.avail) A.push({ k: 'avail', label: lab(AVAIL, ui.avail), off: u => { u.avail = ''; } });
    if (ui.gender) A.push({ k: 'gender', label: lab(GENDERS, ui.gender), off: u => { u.gender = ''; } });
    if (ui.age) A.push({ k: 'age', label: 'Age ' + lab(AGES, ui.age), off: u => { u.age = ''; } });
    return A;
  }
  const clearAll = ui => Object.assign(ui, { q: '', cats: [], platform: '', country: '', state: '', city: '', lang: '', followers: '', er: 0, pmin: '', pmax: '', rating: 0, verified: false, avail: '', content: [], gender: '', age: '' });

  /* ---------- favourites and cart (shared) ---------- */
  function setFav(id, on) {
    L.store.set(s => { s.favorites = s.favorites.filter(x => x !== id); if (on) s.favorites.push(id); }, 'favorite');
  }
  function toggleFav(id, force) {
    const on = force === undefined ? !isFav(id) : force, c = L.creator(id);
    setFav(id, on);
    L.toast(on ? `${c.name} saved to favourites` : `${c.name} removed from saved`, on ? 'heart' : 'close');
    return on;
  }
  /* add to cart: a short thread runs from the button to the cart in the top bar, so you see where it went */
  function addToCart(id, fromEl) {
    const c = L.creator(id); if (!c) return;
    if (!inCart(id)) L.store.set(s => { s.cart.push(id); }, 'cart-add');
    const cartBtn = document.getElementById('cartBtn');
    if (fromEl && cartBtn && L.motion && L.motion.thread) mo('thread', fromEl, cartBtn);
    else if (cartBtn) mo('bump', cartBtn);
    L.toast(`${c.name} added to your hiring cart`, 'cart');
  }
  function removeFromCart(id) {
    L.store.set(s => { s.cart = s.cart.filter(x => x !== id); }, 'cart-remove');
  }

  /* ---------- the creator card ---------- */
  const avatar = (c, cls = '') => `<span class="creators-av ${cls}" aria-hidden="true">${esc(L.initials(c.name))}</span>`;
  const verBadge = c => c.verified ? `<span class="creators-ver" title="Verified by Linkloom">${L.icon('verified')}<span class="sr-only">, verified</span></span>` : '';
  const heartBtn = (c, cls = 'ibtn creators-fav') => { const on = isFav(c.id); return `<button class="${cls}" type="button" aria-pressed="${on}" aria-label="${on ? 'Saved' : 'Save'}: ${esc(c.name)}" title="${on ? 'Remove from saved' : 'Save to favourites'} (or swipe right)">${L.icon('heart')}</button>`; };
  const cartLabel = id => inCart(id) ? `${L.icon('check', 'ic')}In cart` : `${L.icon('cart', 'ic')}Add to cart`;
  const ratingTxt = c => c.rating ? `${L.icon('star')}<span>${c.rating.toFixed(1)}</span><span class="muted">(${c.reviews})</span>` : `<span class="muted">New</span>`;
  const priceHTML = (c, types) => { const r = fromRate(c, types); return r ? `<span class="creators-from">From</span><b class="t-money">${L.inr(r.price)}</b><span class="creators-per">per ${esc(r.fmt)}</span>` : `<span class="creators-from">No rate for that format</span>`; };

  function card(c, o = {}) {
    const tid = `cc-${o.ctx || 'x'}-${c.id}`, ui = S().ui.creators;
    return `<article class="creators-card${isFav(c.id) ? ' is-fav' : ''}" data-id="${esc(c.id)}" aria-labelledby="${tid}">
      <div class="creators-top">
        ${avatar(c)}
        <div class="creators-id">
          <h3 class="creators-name" id="${tid}"><a class="creators-card-link" href="#creator-${esc(c.id)}">${esc(c.name)}</a>${verBadge(c)}</h3>
          <p class="creators-handle">${esc(c.handle)} · ${esc(c.city)}</p>
        </div>
      </div>
      <p class="creators-cats">${c.categories.map(esc).join(' · ')}</p>
      <dl class="creators-meta">
        ${c.platforms.map(p => `<div><dt title="${PLAT[p.p].name} ${PLAT[p.p].unit.toLowerCase()}">${glyph(p.p)}<span>${p.p === 'youtube' ? 'Subs' : 'Followers'}</span><span class="sr-only"> on ${PLAT[p.p].name}</span></dt><dd>${L.compact(p.followers)}</dd></div>`).join('')}
        <div><dt><abbr title="Engagement rate">ER</abbr></dt><dd data-erv>${pct(erOf(c, o.platform !== undefined ? o.platform : ui.platform))}</dd></div>
        <div><dt>Rating</dt><dd class="creators-rate">${ratingTxt(c)}</dd></div>
      </dl>
      <div class="creators-pricerow"><p class="creators-price" data-price>${priceHTML(c, o.content !== undefined ? o.content : ui.content)}</p>${availPill(c)}</div>
      <div class="creators-acts">
        <button class="lq ${inCart(c.id) ? 'lq-s is-in' : 'lq-p'} lq-sm creators-cart" type="button" data-cart>${cartLabel(c.id)}</button>
        <span class="creators-acts-grow"></span>
        ${heartBtn(c)}
        ${o.hide === false ? '' : `<button class="ibtn creators-hide" type="button" aria-label="Hide: ${esc(c.name)}" title="Hide (or swipe left)">${L.icon('close')}</button>`}
      </div>
    </article>`;
  }
  /* sew the heart shut when saved: dashes close into a line, then it fills (CSS .is-stitch) */
  function stitch(btn, on) {
    if (!btn) return; btn.classList.remove('is-stitch');
    if (!on || L.RM) return;
    void btn.offsetWidth; btn.classList.add('is-stitch');
    const off = () => { btn.classList.remove('is-stitch'); btn.removeEventListener('animationend', off); };
    btn.addEventListener('animationend', off); setTimeout(off, 900);
  }
  function settle(btn) {
    if (!btn || L.RM) return; btn.classList.remove('is-settle'); void btn.offsetWidth; btn.classList.add('is-settle');
    const off = () => { btn.classList.remove('is-settle'); btn.removeEventListener('animationend', off); };
    btn.addEventListener('animationend', off); setTimeout(off, 700);
  }
  function syncCard(root, id) {
    const on = isFav(id), c = L.creator(id);
    L.$$(`.creators-card[data-id="${id}"]`, root).forEach(k => {
      k.classList.toggle('is-fav', on);
      const h = k.querySelector('.creators-fav');
      if (h && h.getAttribute('aria-pressed') !== String(on)) { h.setAttribute('aria-pressed', on); h.setAttribute('aria-label', `${on ? 'Saved' : 'Save'}: ${c.name}`); h.title = on ? 'Remove from saved' : 'Save to favourites (or swipe right)'; stitch(h, on); }
      const b = k.querySelector('[data-cart]');
      if (b) { const inn = inCart(id); b.classList.toggle('is-in', inn); b.classList.toggle('lq-s', inn); b.classList.toggle('lq-p', !inn); b.querySelectorAll('.t,.t2').forEach(x => { x.innerHTML = cartLabel(id); }); b.setAttribute('aria-label', inn ? `${c.name} is in your cart. Open cart` : `Add ${c.name} to cart`); }
    });
  }

  /* wire every card inside root: buttons, swipe (right = save, left = hide), press, keys S / C / H */
  function wire(root, { onHide, onFav } = {}) {
    const detach = [];
    const onClick = e => {
      const k = e.target.closest('.creators-card'); if (!k || !root.contains(k)) return;
      const id = k.dataset.id;
      if (e.target.closest('.creators-fav')) { e.preventDefault(); const on = toggleFav(id); syncCard(root, id); onFav && onFav(id, on, k); }
      else if (e.target.closest('[data-cart]')) { e.preventDefault(); if (inCart(id)) L.go('#cart'); else { addToCart(id, e.target.closest('[data-cart]')); syncCard(root, id); } }
      else if (e.target.closest('.creators-hide')) { e.preventDefault(); onHide && onHide(id, k); }
    };
    root.addEventListener('click', onClick);
    const onKey = e => {
      const k = e.target.closest('.creators-card'); if (!k || e.altKey || e.ctrlKey || e.metaKey || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      const id = k.dataset.id, key = e.key.toLowerCase();
      if (key === 's') { e.preventDefault(); const on = toggleFav(id); syncCard(root, id); onFav && onFav(id, on, k); }
      else if (key === 'c') { e.preventDefault(); if (!inCart(id)) { addToCart(id, k.querySelector('[data-cart]')); syncCard(root, id); } }
      else if (key === 'h' && onHide && k.querySelector('.creators-hide')) { e.preventDefault(); onHide(id, k); }
    };
    root.addEventListener('keydown', onKey);
    const attach = k => {
      if (k.dataset.wired) return; k.dataset.wired = '1';
      const id = k.dataset.id;
      const off = mo('swipe', k, {
        rightLabel: 'Save', rightIcon: 'heart', rightTone: 'coral',
        ...(onHide && k.querySelector('.creators-hide') ? { leftLabel: 'Hide', leftIcon: 'close', leftTone: 'ink', onLeft: () => onHide(id, k) } : {}),
        hint: k === root.querySelector('.creators-card'),
        onRight: () => { const on = toggleFav(id, true); syncCard(root, id); onFav && onFav(id, on, k); }
      });
      if (typeof off === 'function') detach.push(off);
      mo('press', k);
    };
    L.$$('.creators-card', root).forEach(attach);
    return { attach, cleanup: () => { root.removeEventListener('click', onClick); root.removeEventListener('keydown', onKey); detach.forEach(f => { try { f(); } catch (e) {} }); } };
  }

  L.ck = { ensure, PLAT, FORMATS, cap, pct, isFav, inCart, reach, erOf, viewsOf, fromRate, rateList, availDays, availLabel, availPill, avatar, verBadge, heartBtn,
    glyph, card, wire, syncCard, stitch, settle, toggleFav, setFav, addToCart, removeFromCart, mo, flip, score };

  /* ---------- the tabs above both screens: All creators / Saved ---------- */
  const tabs = mode => `<div class="seg creators-tabs" role="group" aria-label="Show">
      <button type="button" aria-pressed="${mode === 'all'}" data-go="#creators">${L.icon('users')}All creators</button>
      <button type="button" aria-pressed="${mode === 'saved'}" data-go="#saved">${L.icon('heart')}Saved <span class="creators-tab-n num" data-favn>${S().favorites.length}</span></button>
    </div>`;
  const syncFavN = el => L.$$('[data-favn]', el).forEach(n => { n.textContent = S().favorites.length; });

  /* ---------- #creators ---------- */
  function renderAll(el) {
    const s = ensure(), ui = s.ui.creators, all = s.creators;
    const uniq = a => [...new Set(a)].sort();
    const cats = uniq(all.flatMap(c => c.categories)), langs = uniq(all.flatMap(c => c.languages)), countries = uniq(all.map(c => c.country));
    const chip = (attr, v, label, extra = '') => `<button class="chip" type="button" data-${attr}="${esc(v)}" ${extra}>${label}</button>`;
    const chipRow = (id, label, attr, opts, opt) => `<div class="field"><span class="lab" id="${id}">${label}${opt ? ' <span class="creators-opt">Optional</span>' : ''}</span>
        <div class="chips" role="group" aria-labelledby="${id}">${opts.map(([v, t]) => chip(attr, v, esc(t))).join('')}</div></div>`;
    el.innerHTML = `<div class="view-in creators">
      <header class="creators-head">
        <div class="creators-head-t">
          <h1 class="t-h1">Find creators</h1>
          <p class="muted">${all.length} creators on Instagram and YouTube, ${all.filter(c => c.verified).length} of them verified. <span class="sample">Sample data</span></p>
        </div>
        <div class="creators-search">
          <label class="sr-only" for="crQ">Search by creator name or username</label>
          ${L.icon('search')}
          <input class="input" id="crQ" type="search" autocomplete="off" spellcheck="false" placeholder="Search name or @username" value="${esc(ui.q)}">
        </div>
      </header>
      ${tabs('all')}
      <div class="creators-layout">
        <aside class="creators-filters" id="crFilters" aria-label="Filters">
          <div class="creators-f-h"><p class="t-label">Filters</p><button class="btn-q creators-clear" type="button" data-clear>Clear all</button></div>

          <fieldset class="creators-g"><legend class="t-eyebrow">Niche and platform</legend>
            <div class="field"><span class="lab" id="crCatL">Category</span>
              <div class="chips" role="group" aria-labelledby="crCatL">${cats.map(c => chip('cat', c, esc(c))).join('')}</div></div>
            <div class="field"><span class="lab" id="crPlatL">Platform</span>
              <div class="seg creators-seg" role="group" aria-labelledby="crPlatL">
                <button type="button" data-plat="">All</button><button type="button" data-plat="instagram">${L.icon('ig')}Instagram</button><button type="button" data-plat="youtube">${L.icon('yt')}YouTube</button>
              </div></div>
            <div class="field"><span class="lab" id="crCtL">Content type</span>
              <div class="chips" role="group" aria-labelledby="crCtL">${CONTENT.map(c => chip('ct', c, esc(c))).join('')}</div></div>
          </fieldset>

          <fieldset class="creators-g"><legend class="t-eyebrow">Audience</legend>
            ${chipRow('crFolL', 'Followers', 'fol', FOLLOW)}
            ${chipRow('crErL', 'Engagement rate', 'er', ERS)}
            <div class="field"><label for="crLang">Language</label>
              <select class="select" id="crLang"><option value="">Any language</option>${langs.map(x => `<option value="${esc(x)}">${esc(x)}</option>`).join('')}</select></div>
            <div class="creators-loc">
              <div class="field"><label for="crCountry">Country</label><select class="select" id="crCountry"><option value="">Any country</option>${countries.map(x => `<option value="${esc(x)}">${esc(x)}</option>`).join('')}</select></div>
              <div class="field"><label for="crState">State</label><select class="select" id="crState"></select></div>
              <div class="field"><label for="crCity">City</label><select class="select" id="crCity"></select></div>
            </div>
          </fieldset>

          <fieldset class="creators-g"><legend class="t-eyebrow">Price and trust</legend>
            <div class="field creators-pricef"><span class="lab" id="crPriceL">Price per post</span>
              <div class="creators-pin" role="group" aria-labelledby="crPriceL">
                <label class="creators-pi"><span class="sr-only">Minimum, in rupees</span><span aria-hidden="true">₹</span><input class="input num" id="crPmin" inputmode="numeric" autocomplete="off" placeholder="Min" value="${esc(ui.pmin)}"></label>
                <span class="creators-dash" aria-hidden="true">to</span>
                <label class="creators-pi"><span class="sr-only">Maximum, in rupees</span><span aria-hidden="true">₹</span><input class="input num" id="crPmax" inputmode="numeric" autocomplete="off" placeholder="Max" value="${esc(ui.pmax)}"></label>
              </div>
              <p class="err" id="crPriceE" aria-live="polite"></p>
              <p class="help">Any listed rate in this range counts. Narrow it with Content type.</p></div>
            ${chipRow('crRateL', 'Rating', 'rating', RATINGS)}
            ${chipRow('crAvL', 'Availability', 'avail', AVAIL)}
            <label class="check creators-verified"><input type="checkbox" id="crVer"> <span>Verified creators only<span class="help">ID and platform checked by Linkloom</span></span></label>
          </fieldset>

          <fieldset class="creators-g"><legend class="t-eyebrow">Optional</legend>
            ${chipRow('crGenL', 'Gender', 'gender', GENDERS, true)}
            ${chipRow('crAgeL', 'Age range', 'age', AGES, true)}
            <p class="help">Creators choose whether to share these. Leave them on Any unless the brief needs it.</p>
          </fieldset>
          <button class="lq lq-p creators-f-done" type="button" data-done>Show creators</button>
        </aside>

        <section class="creators-results" aria-label="Creators">
          <div class="creators-bar">
            <p class="creators-count" id="crCount" aria-live="polite"></p>
            <button class="lq lq-s lq-sm creators-ftoggle" type="button" aria-expanded="false" aria-controls="crFilters">${L.icon('filter', 'ic')}Filters</button>
            <div class="creators-sort"><label class="sr-only" for="crSort">Sort creators</label>
              <select class="select" id="crSort">${Object.entries(SORTS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
          </div>
          <div class="creators-active" id="crActive" aria-label="Active filters"></div>
          <div class="creators-list" id="crList">${all.map(c => card(c, { ctx: 'list' })).join('')}</div>
          <div class="empty creators-empty" hidden>
            <img src="assets/step-04-orbit.svg" width="160" height="117" alt="">
            <p class="t-h2">No creators match all of that.</p>
            <p class="muted" data-suggest>Remove a filter or two. Price and availability narrow the list fastest.</p>
            <button class="lq lq-p" type="button" data-clear>Clear all filters</button>
          </div>
          <p class="creators-hidden-line" aria-live="polite"></p>
        </section>
      </div>
    </div>`;

    L.liquid(el);
    const $ = q => el.querySelector(q);
    const list = $('#crList');
    const cards = new Map(L.$$('.creators-card', list).map(k => [k.dataset.id, k]));
    const wired = wire(list, {
      onHide: id => { if (!ui.hidden.includes(id)) ui.hidden.push(id); apply(); hiddenNote(id); },
      onFav: () => syncFavN(el)
    });

    function locOptions() {
      const st = $('#crState'), ci = $('#crCity');
      const pool = all.filter(c => !ui.country || c.country === ui.country);
      const states = [...new Set(pool.map(c => c.state))].sort();
      if (ui.state && !states.includes(ui.state)) ui.state = '';
      const cities = [...new Set(pool.filter(c => !ui.state || c.state === ui.state).map(c => c.city))].sort();
      if (ui.city && !cities.includes(ui.city)) ui.city = '';
      const html = (any, arr) => `<option value="">${any}</option>` + arr.map(x => `<option value="${esc(x)}">${esc(x)}</option>`).join('');
      const sH = html('Any state', states), cH = html(ui.state ? 'Any city in ' + esc(ui.state) : 'Any city', cities);
      if (st.dataset.h !== sH) { st.innerHTML = sH; st.dataset.h = sH; }
      if (ci.dataset.h !== cH) { ci.innerHTML = cH; ci.dataset.h = cH; }
      st.value = ui.state; ci.value = ui.city;
    }
    function syncControls(n) {
      if ($('#crQ').value !== ui.q && document.activeElement !== $('#crQ')) $('#crQ').value = ui.q;
      L.$$('[data-cat]', el).forEach(b => b.setAttribute('aria-pressed', String(ui.cats.includes(b.dataset.cat))));
      L.$$('[data-ct]', el).forEach(b => b.setAttribute('aria-pressed', String(ui.content.includes(b.dataset.ct))));
      L.$$('[data-plat]', el).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.plat === ui.platform)));
      L.$$('[data-fol]', el).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.fol === ui.followers)));
      L.$$('[data-er]', $('#crFilters')).forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.er === +ui.er)));
      L.$$('[data-rating]', el).forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.rating === +ui.rating)));
      L.$$('[data-avail]', el).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.avail === ui.avail)));
      L.$$('[data-gender]', el).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.gender === ui.gender)));
      L.$$('[data-age]', el).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.age === ui.age)));
      $('#crLang').value = ui.lang; $('#crCountry').value = ui.country; locOptions();
      $('#crVer').checked = !!ui.verified; $('#crSort').value = ui.sort;
      if (document.activeElement !== $('#crPmin')) $('#crPmin').value = ui.pmin;
      if (document.activeElement !== $('#crPmax')) $('#crPmax').value = ui.pmax;
      const pe = priceErr(ui); $('#crPriceE').textContent = pe; $('.creators-pricef').classList.toggle('is-err', !!pe);
      L.$$('.creators-clear', el).forEach(b => { b.textContent = n ? `Clear all (${n})` : 'Clear all'; b.setAttribute('aria-disabled', String(!n)); });
      const ft = $('.creators-ftoggle'); ft.querySelectorAll('.t,.t2').forEach(x => { x.innerHTML = L.icon('filter', 'ic') + (n ? `Filters · ${n}` : 'Filters'); });
    }
    function apply(animate = true) {
      const { list: vis, hiddenCount } = filtered(ui), ids = vis.map(c => c.id), act = actives(ui);
      const mutate = () => {
        cards.forEach((k, id) => { k.hidden = !ids.includes(id); k.classList.toggle('is-hidden-c', ui.hidden.includes(id)); });
        ids.forEach(id => list.append(cards.get(id)));
      };
      animate ? flip(mutate, [...cards.values()]) : mutate();
      /* engagement follows the platform filter, the price follows the content type filter */
      vis.forEach(c => { const k = cards.get(c.id); const er = k.querySelector('[data-erv]'); if (er) er.textContent = pct(erOf(c, ui.platform)); const p = k.querySelector('[data-price]'); const h = priceHTML(c, ui.content); if (p.dataset.h !== h) { p.innerHTML = h; p.dataset.h = h; } });
      $('#crCount').innerHTML = `<b>${ids.length}</b> of ${all.length} creators · ${ui.sort === 'match' ? 'Best match first' : esc(SORTS[ui.sort])}`;
      $('#crActive').innerHTML = act.length ? act.map(a => `<button class="chip creators-achip" type="button" data-off="${esc(a.k)}" aria-label="Remove filter: ${esc(a.label)}">${esc(a.label)}${L.icon('close')}</button>`).join('') + `<button class="btn-q" type="button" data-clear>Clear all</button>` : '';
      $('#crActive').hidden = !act.length;
      const empty = !ids.length;
      $('.creators-empty').hidden = !empty; list.hidden = empty;
      if (empty) {
        const best = act.map(a => ({ a, n: S().creators.filter(c => keep(c, ui, a.k) && !ui.hidden.includes(c.id)).length })).sort((x, y) => y.n - x.n)[0];
        $('[data-suggest]').innerHTML = best && best.n ? `Removing <b>${esc(best.a.label)}</b> brings back ${best.n} ${best.n === 1 ? 'creator' : 'creators'}. <button class="btn-q" type="button" data-off="${esc(best.a.k)}">Remove it</button>` : 'Remove a filter or two. Price and availability narrow the list fastest.';
      }
      const done = $('[data-done]'); done.querySelectorAll('.t,.t2').forEach(x => { x.textContent = ids.length ? `Show ${ids.length} ${ids.length === 1 ? 'creator' : 'creators'}` : 'No matches yet'; });
      const hl = $('.creators-hidden-line');
      if (!hl.dataset.undo) hl.innerHTML = hiddenCount ? `${hiddenCount} hidden ${hiddenCount === 1 ? 'creator' : 'creators'} · <button class="btn-q" type="button" data-showhidden>${ui.showHidden ? 'Hide them again' : 'Show'}</button>` : '';
      syncControls(act.length); persist();
    }
    function hiddenNote(id) {
      const c = L.creator(id), hl = $('.creators-hidden-line');
      hl.dataset.undo = id;
      hl.innerHTML = `Hidden ${esc(c.name)}. <button class="btn-q" type="button" data-undo="${esc(id)}">Undo</button>`;
    }
    const set = (k, v) => { delete $('.creators-hidden-line').dataset.undo; ui[k] = v; apply(); };
    const toggleIn = (k, v) => { set(k, ui[k].includes(v) ? ui[k].filter(x => x !== v) : [...ui[k], v]); };

    let qT = 0, pT = 0;
    $('#crQ').addEventListener('input', e => { clearTimeout(qT); const v = e.target.value; qT = setTimeout(() => set('q', v), 140); });
    const priceIn = (k, inp) => { const clean = inp.value.replace(/[^\d]/g, '').slice(0, 7); if (clean !== inp.value) inp.value = clean; clearTimeout(pT); pT = setTimeout(() => set(k, clean), 260); };
    $('#crPmin').addEventListener('input', e => priceIn('pmin', e.target));
    $('#crPmax').addEventListener('input', e => priceIn('pmax', e.target));
    $('#crLang').addEventListener('change', e => set('lang', e.target.value));
    $('#crCountry').addEventListener('change', e => { ui.state = ''; ui.city = ''; set('country', e.target.value); });
    $('#crState').addEventListener('change', e => { ui.city = ''; set('state', e.target.value); });
    $('#crCity').addEventListener('change', e => {
      const v = e.target.value, c = all.find(x => x.city === v);
      if (v && c && !ui.state) ui.state = c.state;   // picking a city fills in its state, so the chips read correctly
      set('city', v);
    });
    $('#crVer').addEventListener('change', e => set('verified', e.target.checked));
    $('#crSort').addEventListener('change', e => set('sort', e.target.value));
    const root = el.firstElementChild;
    root.addEventListener('click', e => {
      const t = e.target.closest('button'); if (!t || !root.contains(t) || t.closest('.creators-card')) return;
      const d = t.dataset;
      if (d.cat !== undefined) { toggleIn('cats', d.cat); settle(t); }
      else if (d.ct !== undefined) { toggleIn('content', d.ct); settle(t); }
      else if (d.plat !== undefined) { set('platform', d.plat); }
      else if (d.fol !== undefined) { set('followers', d.fol); settle(t); }
      else if (d.er !== undefined && t.closest('#crFilters')) { set('er', +d.er); settle(t); }
      else if (d.rating !== undefined) { set('rating', +d.rating); settle(t); }
      else if (d.avail !== undefined) { set('avail', d.avail); settle(t); }
      else if (d.gender !== undefined) { set('gender', d.gender); settle(t); }
      else if (d.age !== undefined) { set('age', d.age); settle(t); }
      else if (d.off !== undefined) {
        const a = actives(ui).find(x => x.k === d.off); if (!a) return;
        const next = t.nextElementSibling || t.previousElementSibling;
        a.off(ui); delete $('.creators-hidden-line').dataset.undo; apply();
        const again = next && next.dataset && next.dataset.off ? $(`#crActive [data-off="${CSS.escape(next.dataset.off)}"]`) : null;
        (again || $('#crQ')).focus({ preventScroll: true });
      }
      else if (t.hasAttribute('data-clear')) {
        if (!actives(ui).length) return;
        clearAll(ui); delete $('.creators-hidden-line').dataset.undo; apply(); L.toast('Filters cleared', 'filter'); $('#crQ').focus({ preventScroll: true });
      }
      else if (t.hasAttribute('data-showhidden')) set('showHidden', !ui.showHidden);
      else if (d.undo) { ui.hidden = ui.hidden.filter(x => x !== d.undo); const hl = $('.creators-hidden-line'); delete hl.dataset.undo; apply(); hl.textContent = 'Back in your list.'; }
      else if (t.classList.contains('creators-ftoggle')) {
        const f = $('#crFilters'), on = !f.classList.contains('is-open');
        f.classList.toggle('is-open', on); t.setAttribute('aria-expanded', String(on));
        if (on) { mo('reveal', f); const first = f.querySelector('button.chip'); first && first.focus({ preventScroll: true }); }
      }
      else if (t.hasAttribute('data-done')) {
        const f = $('#crFilters'), tg = $('.creators-ftoggle');
        f.classList.remove('is-open'); tg.setAttribute('aria-expanded', 'false');
        const top = $('.creators-bar').getBoundingClientRect().top + scrollY - 80;
        window.scrollTo({ top: Math.max(0, top), behavior: L.RM ? 'auto' : 'smooth' }); tg.focus({ preventScroll: true });
      }
    });

    apply(false);
    mo('stagger', L.$$('.creators-card:not([hidden])', list));
    if (ui.scrollY && ui.back) { const y = ui.scrollY, back = ui.back; ui.back = null; requestAnimationFrame(() => setTimeout(() => { window.scrollTo({ top: y, behavior: 'auto' }); const a = list.querySelector(`.creators-card[data-id="${back}"] .creators-card-link`); a && a.focus({ preventScroll: true }); }, 30)); }
    const onScroll = () => { ui.scrollY = window.scrollY; };
    addEventListener('scroll', onScroll, { passive: true });
    /* remember which card opened a profile, so Back lands on it */
    const onOpen = e => { const a = e.target.closest('.creators-card-link'); if (a) { ui.back = a.closest('.creators-card').dataset.id; ui.from = 'creators'; } };
    list.addEventListener('click', onOpen, true);
    return () => { wired.cleanup(); clearTimeout(qT); clearTimeout(pT); removeEventListener('scroll', onScroll); };
  }

  /* ---------- #saved (favourites) ---------- */
  function renderSaved(el) {
    const s = ensure();
    const paint = () => {
      const favs = s.favorites.map(L.creator).filter(Boolean);
      const notInCart = favs.filter(c => !inCart(c.id));
      el.innerHTML = `<div class="view-in creators creators--saved">
        <header class="creators-head">
          <div class="creators-head-t">
            <h1 class="t-h1">Saved creators</h1>
            <p class="muted">Your shortlist. Only you can see it. <span class="sample">Sample data</span></p>
          </div>
          ${notInCart.length > 1 ? `<button class="lq lq-s" type="button" data-allcart>${L.icon('cart', 'ic')}Add all ${notInCart.length} to cart</button>` : ''}
        </header>
        ${tabs('saved')}
        <section class="creators-results" aria-label="Saved creators">
          ${favs.length ? `<p class="creators-count" aria-live="polite"><b>${favs.length}</b> saved · newest last</p>
          <div class="creators-list creators-list--3" id="crSaved">${favs.map(c => card(c, { ctx: 'saved', hide: false, platform: '', content: [] })).join('')}</div>` : ''}
          <div class="empty creators-empty" ${favs.length ? 'hidden' : ''}>
            <img src="assets/step-04-orbit.svg" width="160" height="117" alt="">
            <p class="t-h2">Nobody saved yet.</p>
            <p class="muted">Tap the heart on a creator to keep them here while you decide.</p>
            <button class="lq lq-p" type="button" data-go="#creators">Find creators</button>
          </div>
          <p class="creators-hidden-line" aria-live="polite"></p>
        </section>
      </div>`;
      L.liquid(el);
    };
    paint();
    let wired = null, last = null;
    const hook = () => {
      const list = el.querySelector('#crSaved'); if (!list) return;
      wired = wire(list, {
        onFav: (id, on, k) => {
          syncFavN(el);
          if (on) return;
          last = id;
          flip(() => { k.remove(); }, () => [...list.children]);
          const n = s.favorites.length, cnt = el.querySelector('.creators-count');
          if (cnt) cnt.innerHTML = `<b>${n}</b> saved · newest last`;
          const hl = el.querySelector('.creators-hidden-line');
          hl.innerHTML = `Removed ${esc(L.creator(id).name)} from saved. <button class="btn-q" type="button" data-undo="${esc(id)}">Undo</button>`;
          if (!n) { list.hidden = true; if (cnt) cnt.hidden = true; el.querySelector('.creators-empty').hidden = false; }
        }
      });
    };
    hook();
    el.addEventListener('click', e => {
      if (e.target.closest('.creators-card-link')) { s.ui.creators.from = 'saved'; return; }
      const t = e.target.closest('button'); if (!t) return;
      if (t.dataset.undo) {
        const id = t.dataset.undo;
        L.store.set(st => { st.favorites = st.favorites.filter(x => x !== id); st.favorites.push(id); }, 'favorite');
        wired && wired.cleanup(); paint(); hook(); syncFavN(el);
        const k = el.querySelector(`.creators-card[data-id="${id}"]`); if (k) { mo('fresh', k); const a = k.querySelector('.creators-fav'); a && a.focus({ preventScroll: true }); }
        el.querySelector('.creators-hidden-line').textContent = 'Back in your saved list.';
      } else if (t.hasAttribute('data-allcart')) {
        const ids = s.favorites.filter(id => !inCart(id));
        L.store.set(st => { ids.forEach(id => st.cart.push(id)); }, 'cart-add');
        const cartBtn = document.getElementById('cartBtn');
        if (cartBtn) mo('thread', t, cartBtn);
        L.toast(`${ids.length} creators added to your hiring cart`, 'cart');
        wired && wired.cleanup(); paint(); hook();
      }
    });
    mo('stagger', L.$$('.creators-card', el));
    return () => { wired && wired.cleanup(); };
  }

  L.register('creators', { title: 'Find creators', nav: 'creators', render: el => renderAll(el) });
  L.register('saved', { title: 'Saved creators', nav: 'creators', crumb: '<a href="#creators">Find creators</a> / Saved', render: el => renderSaved(el) });
})();
