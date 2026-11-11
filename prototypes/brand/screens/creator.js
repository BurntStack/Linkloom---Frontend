/* Creator profile as a brand sees it (#creator-<id>). Owner: Builder B.
   Mirrors the creator app's "See what brands see" profile: masthead, ink audience band, platform rows, work, reviews.
   Actions: save to favourites, add to cart, Invite now (adds to the cart, then opens #cart on that creator).
   Uses the creator kit (LLD.ck) from creators.js. Classes are .creator-*; styles in creator.css. */
(() => {
  const L = window.LLD, esc = L.esc, S = () => window.LLD_DATA;
  const mo = (fn, ...a) => { try { const m = L.motion; return m && m[fn] ? m[fn](...a) : null; } catch (e) { return null; } };

  const STAGE = {
    invited: ['pill-info', 'send', 'Invitation sent'], accepted: ['pill-butter', 'check', 'Accepted · pay to start'],
    funded: ['pill-escrow', 'lock', 'In escrow'], in_progress: ['pill-escrow', 'lock', 'In progress'], submitted: ['pill-info', 'file', 'Delivered for review'],
    revision: ['pill-warn', 'edit', 'Revision requested'], approved: ['pill-ok', 'check', 'Approved'], released: ['pill-ok', 'check', 'Paid out'],
    declined: ['pill-err', 'alert', 'Declined'], cancelled: ['pill-paper', 'close', 'Cancelled'], refunded: ['pill-paper', 'refund', 'Refunded']
  };
  const stagePill = st => { const m = STAGE[st] || STAGE.invited; return `<span class="pill ${m[0]}">${L.icon(m[1])}${esc(m[2])}</span>`; };
  const LIVE = ['invited', 'accepted', 'funded', 'in_progress', 'submitted', 'revision'];
  const first = n => String(n || '').split(/\s+/)[0];
  const stars = r => `<span class="creator-stars" aria-hidden="true">${[1, 2, 3, 4, 5].map(i => `<i class="${r >= i - .25 ? 'is-on' : ''}">${L.icon('star')}</i>`).join('')}</span>`;

  L.register('creator', {
    title: id => { const c = L.creator(id); return c ? c.name : 'Creator'; },
    nav: 'creators',
    crumb: id => { const c = L.creator(id); return `<a href="#creators">Find creators</a>${c ? ' / ' + esc(c.name) : ''}`; },
    render(el, id) {
      const K = L.ck; const s = S(); const c = L.creator(id);
      if (!K || !c) {
        el.innerHTML = `<div class="view-in"><div class="empty"><img src="assets/step-04-orbit.svg" width="160" height="117" alt="">
          <p class="t-h2">This creator is no longer listed.</p><p class="muted">They may have paused their profile. Your saved list and cart are unchanged.</p>
          <button class="lq lq-p" type="button" data-go="#creators">Find creators</button></div></div>`;
        return;
      }
      K.ensure();
      const me = s.me, P = K.PLAT;
      const fol = K.reach(c), er = K.erOf(c), views = K.viewsOf(c);
      const mine = s.campaigns.filter(x => x.creator === c.id);
      const live = mine.filter(x => LIVE.includes(x.stage));
      const reviews = mine.filter(x => x.review && x.review.text);
      const from = K.fromRate(c);
      const rates = Object.entries(c.rates || {}).sort((a, b) => a[1] - b[1]);
      const fromSaved = !!(s.ui && s.ui.creators && s.ui.creators.from === 'saved');
      el.innerHTML = `<div class="view-in creator">
        <a class="btn-q creator-back" href="#creators">${L.icon('back')}Find creators</a>
        <header class="creator-mast">
          <div class="creator-photo" aria-hidden="true"><span>${esc(c.name.trim()[0].toUpperCase())}</span></div>
          <div class="creator-id">
            <p class="t-eyebrow">Creator · ${esc(c.city)}, ${esc(c.state)}</p>
            <h1 class="t-display creator-name">${esc(c.name)}${c.verified ? `<span class="creator-ver" title="Verified by Linkloom">${L.icon('verified')}<span class="sr-only">, verified</span></span>` : ''}</h1>
            <ul class="creator-handles">${c.platforms.map(p => `<li>${K.glyph(p.p)}<span>${esc(p.handle)}</span><span class="sr-only"> on ${P[p.p].name}</span></li>`).join('')}</ul>
            <p class="creator-bio">${esc(c.bio)}</p>
            <p class="creator-meta">${c.categories.map(x => `<span class="pill pill-line">${esc(x)}</span>`).join('')}<span class="creator-langs">Creates in ${esc(c.languages.join(', '))}</span></p>
          </div>
          <div class="creator-act">
            ${K.availPill(c)}
            <div class="creator-btns">
              <button class="lq lq-s creator-fav" type="button" data-fav aria-pressed="${K.isFav(c.id)}"></button>
              <button class="lq lq-s" type="button" data-cart></button>
              <button class="lq lq-p" type="button" data-invite>Invite now</button>
            </div>
            ${live.length ? `<p class="creator-live">${L.icon('info')}<span>${esc(live[0].title)}: ${esc((STAGE[live[0].stage] || STAGE.invited)[2].toLowerCase())}. A new invitation is a separate campaign.</span></p>` : ''}
          </div>
        </header>

        <section class="creator-band" aria-labelledby="creator-aud">
          <div class="creator-band-h">
            <h2 class="t-eyebrow" id="creator-aud">Audience</h2>
            <p class="creator-src">Shared by ${esc(first(c.name))}${c.platforms.length > 1 ? ' · views and engagement weighted by followers' : ''} <span class="sample">Sample</span></p>
          </div>
          <dl class="creator-nums">
            <div><dt>Followers</dt><dd class="t-money" data-n="${fol}" data-f="c">${esc(L.compact(fol))}</dd><p>${esc(c.platforms.map(p => P[p.p].name).join(' and '))}</p></div>
            <div><dt>Avg views</dt><dd class="t-money" data-n="${views}" data-f="c">${esc(L.compact(views))}</dd><p>per post</p></div>
            <div><dt>Engagement</dt><dd class="t-money" data-n="${er}" data-f="p">${esc(K.pct(er))}</dd><p>engagement rate</p></div>
          </dl>
        </section>

        <div class="creator-grid">
          <div class="creator-col">
            <section class="creator-sec" aria-labelledby="creator-plat">
              <h2 class="t-h2" id="creator-plat">Platforms</h2>
              <ul class="creator-plats">${c.platforms.map(p => `
                <li class="creator-plat" data-st>
                  <span class="creator-plat-ic">${K.glyph(p.p)}</span>
                  <div class="creator-plat-id"><p class="t-h3">${P[p.p].name}</p><p class="creator-plat-h">${esc(p.handle)}</p></div>
                  <dl class="creator-plat-n">
                    <div><dt>${P[p.p].unit}</dt><dd class="t-money">${esc(L.compact(p.followers))}</dd></div>
                    <div><dt>Avg views</dt><dd class="t-money">${esc(L.compact(p.avgViews))}</dd></div>
                    <div><dt>Engagement</dt><dd class="t-money">${esc(K.pct(p.er))}</dd></div>
                  </dl>
                </li>`).join('')}</ul>
            </section>

            <section class="creator-sec" aria-labelledby="creator-work">
              <h2 class="t-h2" id="creator-work">Past work</h2>
              ${c.work.length ? `<ol class="creator-work">${c.work.map((w, i) => `
                <li data-st>
                  <span class="creator-work-n num">${String(i + 1).padStart(2, '0')}</span>
                  <span class="creator-work-t"><b>${esc(w.title)}</b><span>${esc(w.brand)}${w.brand === me.brand ? ' <span class="pill pill-paper">With you</span>' : ''}</span></span>
                  ${w.views ? `<span class="creator-work-v"><b class="t-money">${esc(L.compact(w.views))}</b><span>views</span></span>` : '<span class="creator-work-v"><span>Not live yet</span></span>'}
                </li>`).join('')}</ol>`
              : `<div class="empty"><img src="assets/step-01-envelope.svg" width="160" height="117" alt=""><p class="t-h3">No past work on Linkloom yet</p><p class="muted">${esc(first(c.name))} is new here. Check the platform numbers above, or start with a small brief.</p></div>`}
            </section>

            <section class="creator-sec" aria-labelledby="creator-rev">
              <h2 class="t-h2" id="creator-rev">Rating and reviews</h2>
              <div class="creator-rating">
                ${c.rating ? `<p class="t-money creator-rating-v">${c.rating.toFixed(1)}</p><div>${stars(c.rating)}<p class="muted">${c.reviews} ${c.reviews === 1 ? 'review' : 'reviews'} from brands on Linkloom</p></div>`
                  : `<p class="muted">No ratings yet. Brands rate creators after approving their work.</p>`}
              </div>
              ${reviews.length ? reviews.map(x => `
                <figure class="creator-rev" data-st>
                  <blockquote>${esc(x.review.text)}</blockquote>
                  <figcaption><b>${esc(me.brand)}</b><span>${esc(x.title)}</span><span class="num">${x.review.rating} out of 5 · ${esc(L.fmtDate(x.review.at, { year: true }))}</span></figcaption>
                </figure>`).join('') : c.rating ? `<p class="creator-rev-none muted">You have not reviewed ${esc(first(c.name))} yet. Your reviews appear here after you approve their work.</p>` : ''}
            </section>
          </div>

          <div class="creator-col">
            <section class="creator-sec creator-card" aria-labelledby="creator-rates">
              <h2 class="t-h3" id="creator-rates">Rates</h2>
              <dl class="creator-rates">${rates.map(([k, v]) => `<div class="kv"><dt>${esc(K.cap(k))}</dt><dd class="t-money">${L.inr(v)}</dd></div>`).join('')}</dl>
              <p class="t-cap muted">Listed by ${esc(first(c.name))}. You set the agreed price in the cart. It goes into escrow only after ${esc(first(c.name))} accepts. No platform fee.</p>
            </section>

            <section class="creator-sec creator-card" aria-labelledby="creator-avail">
              <h2 class="t-h3" id="creator-avail">Availability</h2>
              <p class="creator-avail">${K.availPill(c)}</p>
              <p class="muted">${K.availDays(c) <= 0 ? `Open to new briefs now. Give at least 3 days for a first draft.` : `Can start a new brief ${K.availDays(c) === 1 ? 'tomorrow' : 'in ' + K.availDays(c) + ' days'}. Set your due date after that.`}</p>
              <p class="t-cap muted">Posts ${esc(c.content.join(', '))}</p>
            </section>

            <section class="creator-sec creator-card" aria-labelledby="creator-you">
              <h2 class="t-h3" id="creator-you">With ${esc(me.brand)}</h2>
              ${mine.length ? `<ul class="creator-you">${mine.map(x => `<li><a href="#campaign-${esc(x.id)}"><span class="creator-you-t"><b>${esc(x.title)}</b><span class="num">${L.inr(x.price)} · due ${esc(L.fmtDate(x.due))}</span></span>${stagePill(x.stage)}</a></li>`).join('')}</ul>`
                : `<p class="muted">You have not worked together yet.</p>`}
            </section>
          </div>
        </div>
      </div>
      <div class="creator-dock" role="region" aria-label="Hire ${esc(c.name)}">
        <p class="creator-dock-t">${from ? `<span>From</span><b class="t-money">${L.inr(from.price)}</b>` : ''}</p>
        <button class="lq lq-s lq-sm" type="button" data-cart></button>
        <button class="lq lq-p lq-sm" type="button" data-invite>Invite now</button>
      </div>`;

      const $$ = q => L.$$(q, el);
      const paintBtns = () => {
        const fav = K.isFav(c.id), cart = K.inCart(c.id);
        $$('[data-fav]').forEach(b => { b.setAttribute('aria-pressed', String(fav)); b.innerHTML = `${L.icon('heart', 'ic')}${fav ? 'Saved' : 'Save'}`; b.setAttribute('aria-label', fav ? `Saved. Remove ${c.name} from favourites` : `Save ${c.name} to favourites`); });
        $$('[data-cart]').forEach(b => { b.innerHTML = cart ? `${L.icon('check', 'ic')}In cart` : `${L.icon('cart', 'ic')}Add to cart`; b.setAttribute('aria-label', cart ? `${c.name} is in your cart. Open cart` : `Add ${c.name} to cart`); });
        L.liquid(el);
      };
      paintBtns();
      L.liquid(el);

      el.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.hasAttribute('data-fav')) {
          const on = K.toggleFav(c.id); paintBtns();
          if (on) K.stitch(el.querySelector('.creator-btns [data-fav]'), true);
        } else if (b.hasAttribute('data-cart')) {
          if (K.inCart(c.id)) { L.go('#cart'); return; }
          K.addToCart(c.id, b); paintBtns();
        } else if (b.hasAttribute('data-invite')) {
          if (!K.inCart(c.id)) L.store.set(st => { st.cart.push(c.id); }, 'cart-add');
          S().ui.cart = S().ui.cart || {}; S().ui.cart.focus = c.id;
          L.go('#cart');
        }
      });
      if (fromSaved) { const bk = el.querySelector('.creator-back'); bk.setAttribute('href', '#saved'); bk.innerHTML = `${L.icon('back')}Saved creators`; }

      el.querySelectorAll('.creator-nums [data-n]').forEach(d => {
        const n = +d.dataset.n; if (!n) return;
        mo('count', d, n, d.dataset.f === 'c' ? L.compact : K.pct);
      });
      mo('stagger', [...el.querySelectorAll('[data-st]')]);
    }
  });
})();
