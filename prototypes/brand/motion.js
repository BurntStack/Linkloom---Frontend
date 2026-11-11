/* Linkloom Creator Dashboard: motion layer (owned by the motion agent; catalogue in review/MOTION.md).
   Polish pass. House rules this file keeps:
   - quiet, exact, tactile: durations 160 to 480 ms on shared tokens (E, D below = CSS --mo-*),
   - element tweens run on the Web Animations API over opacity and the independent translate/scale
     properties with no fill afterwards: nothing stays inline, nothing fights a screen's own transform,
   - the signature is the thread: 1.5px lines that stitch (draw as a running stitch), tighten (the gaps
     close, landing with a slight overshoot) and pull through. They live on one fixed SVG layer that
     exists only while a thread runs,
   - no layout shift (numbers change in place), nothing blocks input, nothing is left behind,
   - prefers-reduced-motion is read live: a short fade or nothing, and every Promise still resolves,
   - the ui-select dropdown animates itself; this file leaves it alone (NOMO). */
(() => {
  const LLD = window.LLD;
  if (!LLD || !LLD.motion) return;
  const G = window.gsap || null;
  const doc = document, root = doc.documentElement;
  const mRM = matchMedia('(prefers-reduced-motion: reduce)'), mFine = matchMedia('(hover: hover) and (pointer: fine)'), mPhone = matchMedia('(max-width: 900px)');
  const RM = () => mRM.matches;
  const WA = typeof Element !== 'undefined' && 'animate' in Element.prototype;
  const sup = (p, v) => !!(window.CSS && CSS.supports && CSS.supports(p, v));
  const IND = sup('translate', '1px') && sup('scale', '1');
  const LIN = sup('transition-timing-function', 'linear(0, 1)');
  const $ = (s, c = doc) => c.querySelector(s), $$ = (s, c = doc) => [...c.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const warn = e => { try { console.warn('[motion]', e); } catch (_) {} };
  const buzz = ms => { try { if (!mFine.matches && navigator.vibrate) navigator.vibrate(ms); } catch (_) {} };
  const ss = { get(k) { try { return sessionStorage.getItem(k); } catch (_) { return null; } }, set(k, v) { try { sessionStorage.setItem(k, v); } catch (_) {} } };
  const NOMO = '.ui-select,[class*="ui-select"],[data-ui-select],[role="listbox"],[role="option"],[role="combobox"]';
  const nomo = n => !!(n && n.closest && n.closest(NOMO));

  /* ---------- springs: linear() easings for WAAPI/CSS, the same curve as a JS function, a rAF integrator for gestures ---------- */
  function springEase(k, c, fb) {
    const w0 = Math.sqrt(k), z = c / (2 * w0), wd = w0 * Math.sqrt(Math.max(1e-6, 1 - z * z));
    const x = t => z < 1 ? 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + (z * w0 / wd) * Math.sin(wd * t)) : 1 - Math.exp(-w0 * t) * (1 + w0 * t);
    let T = .1; for (let t = 0; t < 3; t += 1 / 240) if (Math.abs(x(t) - 1) > .003) T = t;
    T = Math.min(1.2, T + .02);
    const pts = []; for (let i = 0; i <= 40; i++) pts.push(+x(i / 40 * T).toFixed(4)); pts[40] = 1;
    return { ease: LIN ? `linear(${pts.join(',')})` : fb, ms: Math.round(T * 1000), f: p => p >= 1 ? 1 : p <= 0 ? 0 : x(p * T) };
  }
  const SP = {
    press: springEase(520, 26, 'cubic-bezier(.3,1.2,.5,1)'),     // release after a press: tiny overshoot
    land: springEase(300, 26, 'cubic-bezier(.3,1.15,.45,1)'),     // weighty landing, about 3% overshoot
    settle: springEase(260, 27, 'cubic-bezier(.22,1,.36,1)'),     // large travel (sheets), under 1% overshoot
    pop: springEase(380, 24, 'cubic-bezier(.34,1.4,.64,1)')       // small things arriving, about 7%
  };
  const E = { out: 'cubic-bezier(.22,1,.36,1)', soft: 'cubic-bezier(.33,1,.68,1)', in: 'cubic-bezier(.5,0,.75,0)', io: 'cubic-bezier(.65,0,.35,1)', press: 'cubic-bezier(.3,.7,.4,1)',
    land: SP.land.ease, settle: SP.settle.ease, pop: SP.pop.ease, back: SP.pop.ease };
  const D = { xs: 160, s: 240, m: 320, l: 400, xl: 480 };
  try { if (LIN) { root.style.setProperty('--mo-land', SP.land.ease); root.style.setProperty('--mo-settle', SP.settle.ease); root.style.setProperty('--mo-pop', SP.pop.ease); } } catch (_) {}
  const eo = p => 1 - Math.pow(1 - clamp(p, 0, 1), 4);                // quart-out (matches E.out closely)
  const ei = p => Math.pow(clamp(p, 0, 1), 3);
  const eio = p => { p = clamp(p, 0, 1); return p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; };

  function runSpring({ from, to, v = 0, k = 500, c = 40, write, done }) {
    let x = from, vel = v, last = performance.now(), raf = 0, stopped = false;
    const step = now => {
      if (stopped) return;
      const dt = Math.min(.05, Math.max(0, (now - last) / 1000)); last = now;
      const n = Math.max(1, Math.ceil(dt * 240)), h = dt / n;
      for (let i = 0; i < n; i++) { vel += (-k * (x - to) - c * vel) * h; x += vel * h; }
      const rest = Math.abs(x - to) < .35 && Math.abs(vel) < 6;
      if (rest) x = to;
      write(x);
      if (rest) { stopped = true; done && done(); } else raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return { stop() { stopped = true; cancelAnimationFrame(raf); }, get x() { return x; } };
  }

  /* ---------- low-level helpers ---------- */
  const px = v => typeof v === 'number' ? v + 'px' : v;
  function kf(p) {                                       // keyframe on opacity + independent translate/scale
    const k = {};
    if ('o' in p) k.opacity = p.o;
    if ('off' in p) k.offset = p.off;
    const t = 'x' in p || 'y' in p, s = 's' in p;
    if (IND) { if (t) k.translate = `${px(p.x || 0)} ${px(p.y || 0)}`; if (s) k.scale = String(p.s); }
    else if (t || s) k.transform = (t ? `translate(${px(p.x || 0)},${px(p.y || 0)}) ` : '') + (s ? `scale(${p.s})` : '');
    return k;
  }
  function ani(el, frames, o) {
    if (!WA || !el || !el.isConnected) return null;
    try { return el.animate(frames, o); } catch (e) { return null; }
  }
  const fin = a => (a && a.finished) ? a.finished.then(() => {}, () => {}) : Promise.resolve();
  const hasBox = n => !!n && n.nodeType === 1 && n.isConnected && n.getClientRects().length > 0;
  const inView = (n, m = 0) => { if (!hasBox(n)) return false; const r = n.getBoundingClientRect(); return r.bottom > -m && r.top < innerHeight + m && r.right > -m && r.left < innerWidth + m; };
  const isBig = n => n.getBoundingClientRect().height > innerHeight * .7;
  const order = (a, b) => a === b ? 0 : (a.compareDocumentPosition(b) & 4 ? -1 : 1);
  const toEls = (t, kids) => {
    if (!t) return [];
    if (typeof t === 'string') return $$(t);
    if (t.nodeType === 1) return kids ? [...t.children] : [t];
    if (typeof t.length === 'number') return [...t].filter(n => n && n.nodeType === 1);
    return [];
  };
  const setT = (el, x, y = 0) => { if (IND) el.style.translate = (x || y) ? `${x.toFixed(2)}px ${y.toFixed(2)}px` : ''; else el.style.transform = (x || y) ? `translate(${x}px,${y}px)` : ''; };
  function bump(el, s = 1.03) {                          // "this changed": a small scale bump on a spring
    if (!el || RM() || !hasBox(el)) return Promise.resolve();
    const fr = IND ? [{ scale: '1' }, { scale: String(s), offset: .3 }, { scale: '1' }] : [{ transform: 'none' }, { transform: `scale(${s})`, offset: .3 }, { transform: 'none' }];
    return fin(ani(el, fr, { duration: D.m, easing: 'ease-out' }));
  }

  /* palette: core.css tokens only */
  const TOK = { coral: '--ll-coral', violet: '--ll-violet', butter: '--ll-butter', plum: '--ll-escrow-fg', escrow: '--ll-escrow-fg', ink: '--ll-ink-900', info: '--ll-info-fg',
    white: '--ll-white', mist: '--ll-mist', paper: '--ll-paper', 'coral-deep': '--ll-coral-deep', 'violet-deep': '--ll-violet-deep', ok: '--ll-ok-fg' };
  const col = c => !c ? 'var(--ll-violet)' : TOK[c] ? `var(${TOK[c]})` : c.startsWith('--') ? `var(${c})` : c;
  const bgOf = el => {
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) { const b = getComputedStyle(n).backgroundColor; if (b && b !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(b)) return b; }
    return 'rgb(248,248,248)';
  };
  const isDarkBg = el => { const m = bgOf(el).match(/\d+(\.\d+)?/g); if (!m) return false; const [r, g, b] = m.map(Number); return (r * .299 + g * .587 + b * .114) < 110; };

  /* route bookkeeping: count/stagger/reveal behave differently while a screen is entering */
  let lastKey = null, lastName = null, entT = -1e9, booted = false;
  const entering = () => (location.hash || '#') !== lastKey || performance.now() - entT < 700;

  /* ---------- the mask and rise (headings): rises 14px from behind its own baseline ---------- */
  function maskRise(h, { delay = 0, dur = 440, y = 14 } = {}) {
    if (!hasBox(h)) return null;
    const a = IND ? { translate: `0 ${y}px` } : { transform: `translateY(${y}px)` }, b = IND ? { translate: '0 0' } : { transform: 'none' };
    return ani(h, [{ opacity: 0, clipPath: `inset(-24px -24px ${y}px -24px)`, ...a }, { opacity: 1, clipPath: 'inset(-24px -24px -24px -24px)', ...b }],
      { duration: dur, delay, easing: E.out, fill: 'backwards' });
  }
  function rise(n, { y = 10, dur = 380, delay = 0, ease = E.out } = {}) {
    if (!hasBox(n)) return null;
    const move = y && !isBig(n);
    return ani(n, [kf(move ? { o: 0, y, off: 0 } : { o: 0, off: 0 })], { duration: dur, delay, easing: ease, fill: 'backwards' });
  }
  /* the blocks a container is made of: descend single-child wrappers, open up tall panes, keep the heading's own line */
  const SKIPU = '[data-motion~="skip"],script,style,template,.mo-flood,.mo-sw-under';
  function unitsOf(r0, heading) {
    let r = r0;
    while (r.children.length === 1 && r.firstElementChild.children.length && !r.firstElementChild.matches(SKIPU)) r = r.firstElementChild;
    const out = [];
    [...r.children].forEach(it => {
      if (!hasBox(it) || it.matches(SKIPU)) return;
      if (heading && it.contains(heading)) {
        let n = heading;
        while (n && n !== it) { const p = n.parentElement; [...p.children].forEach(c => { if (c !== n && hasBox(c) && !c.matches(SKIPU)) out.push(c); }); n = p; }
        return;
      }
      if (isBig(it) && it.children.length > 1 && it.children.length <= 8) { out.push(...[...it.children].filter(c => hasBox(c) && !c.matches(SKIPU))); return; }
      out.push(it);
    });
    return out.sort(order);
  }
  const findHeading = el => { const h = el.querySelector('.t-display,.t-h1,h1'); return h && inView(h) && h.getBoundingClientRect().top < innerHeight * .7 ? h : null; };

  /* ---------- enter: route entrance (heading mask-rise, blocks rise 10px, sequence ends by ~560 ms) ---------- */
  const stSet = new Set();                               // nodes a screen asked to stagger during this render
  function entrance(el, { light = false, base = 0 } = {}) {
    try {
      const anims = [];
      const h = light ? null : findHeading(el);
      if (h) { h._moDelay = base; anims.push(fin(maskRise(h, { delay: base }))); }
      const units = unitsOf(el, h).filter(u => inView(u)).slice(0, 10);
      units.forEach((u, i) => {
        const delay = base + (light ? 0 : 60 + Math.min(i * 35, 175));
        u._moDelay = delay;
        if (stSet.has(u)) return;                        // the screen's own stagger plays this block
        const holds = stSet.size > 0 && [...stSet].some(n => u.contains(n));
        anims.push(fin(rise(u, holds ? { y: 0, dur: D.m, delay } : { y: light ? 6 : 10, dur: light ? D.s : 380, delay })));
      });
      return Promise.all(anims).then(() => {});
    } catch (e) { warn(e); return Promise.resolve(); }
  }
  function enter(el, ctx = {}) {
    const key = location.hash || '#', name = ctx.name || '';
    const first = !booted; booted = true;
    const same = !first && key === lastKey, sameScreen = !first && name === lastName;
    lastKey = key; lastName = name; entT = performance.now();
    if (io) { io.disconnect(); io = null; }
    try { indicators(!first); } catch (e) { warn(e); }
    let pre = null;
    if (first) { try { pre = preload(); } catch (e) { warn(e); pre = null; } }
    const app = !!el && el.id === 'view';
    if (app && !shellDone) { shellDone = true; if (!pre) { try { shellIntro(); } catch (e) { warn(e); } } }
    if (!el) return Promise.resolve();
    try { scan(el); } catch (e) { warn(e); }
    if (same || !WA) return Promise.resolve();
    if (RM()) return fin(ani(el, [{ opacity: 0 }, { opacity: 1 }], { duration: D.xs, easing: 'linear' }));
    const run = () => entrance(el, { light: sameScreen, base: first && app ? 100 : 0 });
    if (pre) return pre.then(() => { if (!el.isConnected) return; entT = performance.now(); if (app) { try { shellIntro(); } catch (e) { warn(e); } } return run(); });
    return run();
  }

  /* ---------- stagger: siblings rise one after another (only those on screen) ---------- */
  function stagger(nodes, o = {}) {
    const els = toEls(nodes, true);
    if (!els.length || RM() || !WA) return Promise.resolve();
    const ent = entering();
    els.forEach(n => stSet.add(n));
    return new Promise(res => queueMicrotask(() => {
      try {
        els.forEach(n => stSet.delete(n));
        const vis = els.filter(n => inView(n, 24)).slice(0, o.max || 12);
        let base = o.delay || 0;
        if (ent && vis[0]) { let p = vis[0]; while (p && p._moDelay == null) p = p.parentElement; base += (p ? p._moDelay : 0) + 50; }
        const each = o.each ?? (vis.length > 6 ? 25 : 35), cap = o.cap ?? 200;
        Promise.all(vis.map((n, i) => fin(rise(n, { y: o.y ?? 10, dur: o.dur ?? 380, delay: base + Math.min(i * each, cap) })))).then(() => res());
      } catch (e) { warn(e); res(); }
    }));
  }

  /* ---------- count / tick: number ticks in Indian grouping. The final text is set at once (no layout
     shift); digits that changed tick into place, the old digit leaves (drawn by ::before, so textContent
     always reads the true value). ---------- */
  const lastVals = new Map();
  function stopTick(el) {
    const k = el._moTk; if (!k) return;
    el._moTk = null; k.anims.forEach(a => { try { a && a.cancel(); } catch (_) {} });
    clearTimeout(k.safe); k.live && k.live.removeAttribute('aria-busy');
    if (el.isConnected && el.querySelector('.mo-dg')) el.textContent = k.txt;
  }
  function count(el, to, fmt, o = {}) {
    if (!el) return;
    to = +to || 0;
    const dec = o.decimals ?? ((String(to).split('.')[1] || '').length);
    const f = typeof fmt === 'function' ? fmt : (v => (+v).toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec }));
    const key = o.key || el.id || (el.dataset && el.dataset.key) || null;
    let from = o.from ?? el._moV;
    if (from == null && key && lastVals.has(key)) from = lastVals.get(key);
    const ent = from == null && entering();
    stopTick(el);
    el._moV = to; if (key) lastVals.set(key, to);
    const txt = String(f(to)), prev = from != null ? String(f(from)) : null;
    const set = () => { if (el.textContent !== txt) el.textContent = txt; el._moTxt = txt; };
    const done = () => { try { o.done && o.done(); } catch (e) { warn(e); } };
    set();
    if (RM() || !WA || (!ent && (prev == null || prev === txt))) { done(); return; }
    const go = () => {
      if (!el.isConnected || el.textContent !== txt || !inView(el) || doc.hidden) { done(); return; }
      const up = from == null || to >= from, same = prev != null && prev.length === txt.length;
      const frag = doc.createDocumentFragment(), moving = [];
      let plain = '';
      const flush = () => { if (plain) { frag.append(plain); plain = ''; } };
      for (let i = 0; i < txt.length; i++) {
        const ch = txt[i], dig = /\d/.test(ch);
        const tick = ent ? !/\s/.test(ch) : dig && (!same || prev[i] !== ch);
        if (!tick) { plain += ch; continue; }
        flush();
        const s = doc.createElement('span'); s.className = 'mo-dg'; s.textContent = ch;
        if (!ent && same && /\d/.test(prev[i])) s.dataset.o = prev[i];
        frag.append(s); moving.push(s);
      }
      flush();
      if (!moving.length) { done(); return; }
      el.textContent = ''; el.append(frag);
      const live = el.closest('[aria-live]'); live && live.setAttribute('aria-busy', 'true');
      let base = 0;
      if (ent) { let p = el; while (p && p._moDelay == null) p = p.parentElement; base = (p ? p._moDelay : 0) + 80; }
      const n = moving.length, each = n > 1 ? Math.min(ent ? 22 : 26, 170 / (n - 1)) : 0, dy = up ? .42 : -.42;
      const tk = { txt, anims: [], live, safe: 0 }; el._moTk = tk;
      moving.forEach((s, i) => {
        const j = ent ? i : n - 1 - i, delay = base + j * each, dur = ent ? 320 : 280;
        tk.anims.push(ani(s, [kf({ o: 0, y: dy + 'em' }), kf({ o: 1, y: 0 })], { duration: dur, delay, easing: E.out, fill: 'backwards' }));
        if (s.dataset.o) tk.anims.push(ani(s, [kf({ o: 1, y: 0 }), kf({ o: 0, y: -dy + 'em' })], { duration: 220, delay, easing: E.out, fill: 'both', pseudoElement: '::before' }));
      });
      const end = () => { if (el._moTk !== tk) return; stopTick(el); done(); };
      Promise.all(tk.anims.map(fin)).then(end);
      tk.safe = setTimeout(end, base + 900);
    };
    if (ent) requestAnimationFrame(go); else go();
  }

  /* ---------- press: scale 0.98 on pointerdown, released on a spring; delegated for the core controls ---------- */
  const PRESS = '.lq,.ibtn,.chip,.seg button,.tabbar a,[data-go],.mo-press,[data-motion~="press"]';
  let pressed = null, pressT = 0, pStart = null;
  function press(t) {
    const els = toEls(t);
    els.forEach(e => e.classList.add('mo-press'));
    return () => els.forEach(e => e.classList.remove('mo-press'));
  }
  function pDown(el) {
    pUp();
    if (!IND || RM() || !WA) return;
    const r = el.getBoundingClientRect();
    const s = r.width > 240 && r.height > 80 ? .99 : .98;
    pressed = el;
    el._moP = ani(el, [{ scale: String(s) }], { duration: 120, easing: E.press, fill: 'forwards' });
  }
  function pUp(instant) {
    clearTimeout(pressT); pressT = 0;
    const el = pressed; pressed = null;
    if (!el || !el._moP) return;
    const cur = getComputedStyle(el).scale; el._moP.cancel(); el._moP = null;
    if (!instant && cur && cur !== 'none' && cur !== '1') ani(el, [{ scale: cur }, { scale: '1' }], { duration: SP.press.ms, easing: SP.press.ease });
  }
  const pressable = t => { const el = t && t.closest && t.closest(PRESS); return el && !nomo(el) && !el.matches('[disabled],[aria-disabled="true"]') ? el : null; };
  doc.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    const el = pressable(e.target); if (!el) return;
    pStart = { x: e.clientX, y: e.clientY };
    if (e.pointerType === 'touch') { clearTimeout(pressT); pressT = setTimeout(() => { pressT = 0; pDown(el); }, 70); pStart.el = el; }
    else pDown(el);
  }, { passive: true, capture: true });
  doc.addEventListener('pointermove', e => {
    if (pStart && Math.hypot(e.clientX - pStart.x, e.clientY - pStart.y) > 8) { pStart = null; pUp(true); }
  }, { passive: true });
  doc.addEventListener('pointerup', () => {
    if (pressT && pStart && pStart.el) { const el = pStart.el; clearTimeout(pressT); pressT = 0; pDown(el); setTimeout(() => pUp(), 90); }
    else pUp();
    pStart = null;
  }, { passive: true });
  doc.addEventListener('pointercancel', () => { pStart = null; pUp(true); }, { passive: true });
  doc.addEventListener('keydown', e => {
    if (e.repeat || (e.key !== ' ' && e.key !== 'Enter')) return;
    const el = pressable(e.target); if (!el || el !== e.target) return;
    pDown(el); if (e.key === 'Enter') setTimeout(() => pUp(), 110);
  });
  doc.addEventListener('keyup', e => { if (e.key === ' ') pUp(); });

  /* ---------- swipe: horizontal drag with an action label underneath; returns detach ---------- */
  const TONE = { butter: ['--ll-butter', '--ll-ink-text'], coral: ['--ll-coral', '--ll-ink-text'], violet: ['--ll-violet', '--ll-ink-text'], ink: ['--ll-ink-900', '--ll-white'],
    err: ['--ll-err-bg', '--ll-err-fg'], ok: ['--ll-ok-bg', '--ll-ok-fg'], warn: ['--ll-warn-bg', '--ll-warn-fg'], escrow: ['--ll-escrow-bg', '--ll-escrow-fg'], paper: ['--ll-paper-raised', '--ll-ink-text'] };
  function swipe(el, o = {}) {
    if (!el || !el.addEventListener) return () => {};
    const can = d => typeof (d > 0 ? o.onRight : o.onLeft) === 'function';
    const thr = () => o.threshold || clamp(el.offsetWidth * .28, 72, 132);
    const prevTA = el.style.touchAction;
    el.style.touchAction = 'pan-y'; el.classList.add('mo-swipe');
    let g = null, x = 0, under = null, lab = null, dir = 0, armed = false, sp = null, settling = false, madeZ = false, madePos = false;
    const fill = d => {
      const k = d > 0 ? 'right' : 'left', tn = TONE[o[k + 'Tone']] || TONE[d > 0 ? 'butter' : 'ink'], ic = o[k + 'Icon'];
      under.style.background = `var(${tn[0]})`; under.style.color = `var(${tn[1]})`; under.dataset.dir = k;
      lab.innerHTML = (ic ? LLD.icon(ic) : '') + '<span>' + LLD.esc(o[k + 'Label'] || '') + '</span>';
      armed = false; under.classList.remove('is-armed');
    };
    const mkUnder = () => {
      under = doc.createElement('div'); under.className = 'mo-sw-under'; under.setAttribute('aria-hidden', 'true');
      lab = doc.createElement('span'); lab.className = 'mo-sw-lab'; under.append(lab);
      const cs = getComputedStyle(el);
      under.style.borderRadius = cs.borderRadius;
      if (cs.position === 'static') { el.style.position = 'relative'; madePos = true; }
      if (cs.zIndex === 'auto') { el.style.zIndex = '1'; madeZ = true; }
      el.after(under);
      Object.assign(under.style, { left: '0px', top: '0px', width: el.offsetWidth + 'px', height: el.offsetHeight + 'px' });
      const a = under.getBoundingClientRect(), b = el.getBoundingClientRect();
      under.style.left = (b.left - x - a.left) + 'px'; under.style.top = (b.top - a.top) + 'px';
    };
    const paint = () => {
      const d = Math.sign(x);
      if (!d || !can(d) || (settling && d !== dir)) { if (under) under.style.opacity = '0'; return; }
      if (!under) mkUnder();
      if (d !== dir) { dir = d; fill(d); }
      const t = thr(), p = Math.min(1, Math.abs(x) / t);
      under.style.opacity = '1';
      lab.style.opacity = String(clamp((Math.abs(x) - 10) / (t * .5), 0, 1));
      setT(lab, (1 - p) * 12 * -d);
      const arm = !settling && Math.abs(x) >= t;
      if (arm !== armed) {
        armed = arm; under.classList.toggle('is-armed', arm);
        if (arm) { buzz(8); if (!RM()) ani(lab, [{ scale: '1' }, { scale: '1.06', offset: .35 }, { scale: '1' }], { duration: D.s, easing: E.out }); }
      }
    };
    const write = v => { x = v; setT(el, v); paint(); };
    const clear = () => {
      if (under) { under.remove(); under = lab = null; }
      dir = 0; armed = false; settling = false;
      if (madeZ) { el.style.zIndex = ''; madeZ = false; }
      if (madePos) { el.style.position = ''; madePos = false; }
    };
    const settle = (v = 0) => {
      settling = true;
      if (RM() || !x) { write(0); clear(); return; }
      sp = runSpring({ from: x, to: 0, v: v * 1000, k: 520, c: 40, write, done: () => { sp = null; clear(); } });
    };
    const band = v => {
      const d = Math.sign(v), a = Math.abs(v);
      if (!d) return 0;
      if (!can(d)) return d * 26 * (1 - Math.exp(-a / 80));
      const lim = thr() * 1.4;
      return a <= lim ? v : d * (lim + (a - lim) * .3);
    };
    /* the handler removed or hid the card: a copy of it flies out where it was, the list closes up underneath */
    const flyGhost = (ghost, parent, r, w, h, d) => {
      const host = parent && parent.isConnected ? parent : doc.body;
      ghost.removeAttribute('id'); ghost.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
      ghost.setAttribute('aria-hidden', 'true'); ghost.inert = true;
      Object.assign(ghost.style, { position: host === doc.body ? 'fixed' : 'absolute', left: '0px', top: '0px', width: w + 'px', height: h + 'px', margin: '0', zIndex: '2', pointerEvents: 'none', translate: '', transform: 'none' });
      ghost.classList.remove('is-drag');
      host.append(ghost);
      const a = ghost.getBoundingClientRect();
      ghost.style.left = (r.left - a.left) + 'px'; ghost.style.top = (r.top - a.top) + 'px';
      const u = under; under = lab = null; clear();
      if (u) { u.style.zIndex = '1'; ani(u, [{ opacity: 1 }, { opacity: 0 }], { duration: D.s, easing: 'ease-out', fill: 'forwards' }); }
      if (RM() || !WA) { ghost.remove(); u && u.remove(); return; }
      const a1 = ani(ghost, [kf({ o: 1, x: 0 }), kf({ o: 0, x: d * (w * .6 + 40) })], { duration: D.s, easing: E.in, fill: 'forwards' });
      fin(a1).then(() => { ghost.remove(); u && u.remove(); });
      setTimeout(() => { ghost.remove(); u && u.remove(); }, 900);
    };
    const commit = (d, v) => {
      const fn = d > 0 ? o.onRight : o.onLeft;
      const parent = el.parentNode, r = el.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight, ghost = el.cloneNode(true);
      try { fn(el); } catch (err) { console.error(err); }
      if (!el.isConnected || !hasBox(el)) { x = 0; setT(el, 0); flyGhost(ghost, parent, r, w, h, d); return; }
      settle(v);
    };
    const eatClick = () => {
      const h = ev => { ev.stopPropagation(); ev.preventDefault(); };
      el.addEventListener('click', h, true); setTimeout(() => el.removeEventListener('click', h, true), 320);
    };
    const unlisten = () => { removeEventListener('pointermove', onMove); removeEventListener('pointerup', onUp); removeEventListener('pointercancel', onUp); };
    function onDown(e) {
      if (g && g.on) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.target.closest('input,textarea,select,[contenteditable="true"],[data-noswipe]') || nomo(e.target)) return;
      if (sp) { sp.stop(); sp = null; settling = false; }
      g = { id: e.pointerId, x0: e.clientX, y0: e.clientY, base: x, on: false, pts: [[e.clientX, performance.now()]] };
      unlisten();
      addEventListener('pointermove', onMove, { passive: false }); addEventListener('pointerup', onUp); addEventListener('pointercancel', onUp);
    }
    function onMove(e) {
      if (!g || e.pointerId !== g.id) return;
      const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
      if (!g.on) {
        if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { g = null; unlisten(); if (x) settle(0); return; }
        if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
        g.on = true; g.slop = Math.sign(dx) * 10;
        try { el.setPointerCapture(g.id); } catch (_) {}
        pStart = null; pUp(true);
        el.classList.add('is-drag'); doc.body.classList.add('mo-dragging');
        try { getSelection().removeAllRanges(); } catch (_) {}
      }
      if (e.cancelable) e.preventDefault();
      write(band(g.base + dx - g.slop));
      g.pts.push([e.clientX, performance.now()]); if (g.pts.length > 6) g.pts.shift();
    }
    function onUp(e) {
      if (!g || e.pointerId !== g.id) return;
      const s = g; g = null; unlisten();
      el.classList.remove('is-drag'); doc.body.classList.remove('mo-dragging');
      if (!s.on) { if (x) settle(0); return; }
      eatClick();
      const now = performance.now(), pts = s.pts.filter(p => now - p[1] < 120);
      const v = pts.length > 1 ? (pts[pts.length - 1][0] - pts[0][0]) / Math.max(8, pts[pts.length - 1][1] - pts[0][1]) : 0;
      const d = Math.sign(x);
      const fire = e.type === 'pointerup' && d && can(d) && (Math.abs(x) >= thr() || (Math.abs(v) > .5 && Math.sign(v) === d && Math.abs(x) > 32));
      if (fire) commit(d, v); else settle(v);
    }
    const noDrag = e => e.preventDefault();
    el.addEventListener('pointerdown', onDown); el.addEventListener('dragstart', noDrag);
    /* optional one-time peek on touch screens so the gesture is discoverable */
    if (o.hint && !RM() && !mFine.matches) {
      const first = !ss.get('mo-swipe-hint'); if (first) ss.set('mo-swipe-hint', '1');
      if (first) setTimeout(() => {
        if (g || !inView(el)) return;
        const d = can(-1) ? -1 : 1; settling = false;
        sp = runSpring({ from: 0, to: d * 36, k: 260, c: 30, write, done: () => setTimeout(() => settle(0), 220) });
      }, 900);
    }
    return () => {
      el.removeEventListener('pointerdown', onDown); el.removeEventListener('dragstart', noDrag); unlisten();
      if (sp) sp.stop(); sp = null; g = null;
      x = 0; setT(el, 0); clear();
      el.style.touchAction = prevTA; el.classList.remove('mo-swipe', 'is-drag'); doc.body.classList.remove('mo-dragging');
    };
  }

  /* ---------- reveal: rise once when scrolled into view (instant for whatever is already on screen) ---------- */
  let io = null;
  function playReveal(el, o = {}) {
    el.classList.remove('mo-pre');
    if (RM() || !WA) return;
    if (o.words || el.matches('.t-display,.t-h1,.t-h2,[data-motion~="words"]')) { maskRise(el, { dur: 420 }); return; }
    if (o.stagger || el.matches('[data-motion~="stagger"]')) { [...el.children].filter(n => inView(n, 40)).slice(0, 12).forEach((n, i) => rise(n, { y: 10, dur: 380, delay: Math.min(i * 35, 200) })); return; }
    rise(el, { y: o.y ?? 12, dur: 420 });
  }
  function reveal(t, o = {}) {
    const els = toEls(t);
    if (!els.length || RM() || !WA || !('IntersectionObserver' in window)) return;
    const ent = entering();
    queueMicrotask(() => els.forEach(el => {
      try {
        if (!el.isConnected || el._moRev) return;
        el._moRev = true;
        if (inView(el, -24)) { if (!ent) playReveal(el, o); return; }   // on screen at load: the route entrance covers it
        el._moRevO = o; el.classList.add('mo-pre');
        (io || (io = new IntersectionObserver(es => es.forEach(e => {
          if (!e.isIntersecting) return; io.unobserve(e.target); playReveal(e.target, e.target._moRevO || {});
        }), { rootMargin: '0px 0px -6% 0px', threshold: .01 }))).observe(el);
      } catch (e) { el.classList.remove('mo-pre'); warn(e); }
    }));
  }

  /* ================= THE THREAD: one fixed SVG layer, present only while a thread runs ================= */
  const NS = 'http://www.w3.org/2000/svg';
  const mk = (parent, tag, attrs = {}) => { const n = doc.createElementNS(NS, tag); Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v)); parent.append(n); return n; };
  const P2 = p => p[0].toFixed(1) + ' ' + p[1].toFixed(1);
  const TL = (() => {
    let svg = null, raf = 0; const items = new Set();
    const finish = it => {
      if (!items.delete(it)) return;
      clearTimeout(it._safe); it.g && it.g.remove();
      try { it.done && it.done(); } catch (e) { warn(e); }
      if (!items.size) { cancelAnimationFrame(raf); raf = 0; svg && svg.remove(); }
    };
    const frame = now => {
      raf = 0;
      items.forEach(it => { let alive = false; try { alive = it.draw(now - it.t0, now) !== false; } catch (e) { warn(e); } if (!alive) finish(it); });
      if (items.size) raf = requestAnimationFrame(frame);
    };
    return {
      add(it, build) {
        if (!svg) { svg = doc.createElementNS(NS, 'svg'); svg.setAttribute('class', 'mo-threads'); svg.setAttribute('aria-hidden', 'true'); }
        if (!svg.isConnected) doc.body.append(svg);
        it.g = mk(svg, 'g'); it.t0 = performance.now(); items.add(it);
        const draw = build(it);
        it.draw = (t, now) => {
          if (it.fadeAt) { const a = 1 - (now - it.fadeAt) / D.xs; if (a <= 0) return false; it.g.style.opacity = a.toFixed(3); }
          return draw(t, now);
        };
        it._safe = setTimeout(() => finish(it), it.max || 2000);   // hidden tab / stalled rAF backstop
        try { if (it.draw(0, it.t0) === false) { finish(it); return; } } catch (e) { warn(e); finish(it); return; }
        if (!raf) raf = requestAnimationFrame(frame);
      },
      kill(pred) { [...items].forEach(it => { if (!pred || pred(it)) finish(it); }); },
      fade() { const n = performance.now(); items.forEach(it => { if (!it.fadeAt) it.fadeAt = n; }); },
      get size() { return items.size; }
    };
  })();
  /* a running stitch: visible between lengths a..b, dash d / gap g (g → 0 is the stitch tightening into a line) */
  function dashes(L, a, b, d, g) {
    const iv = [];
    if (b > a + .01) {
      if (g < .05) iv.push([a, b]);
      else { const P = d + g; for (let k = Math.floor(a / P); k * P < b; k++) { const s = Math.max(a, k * P), e = Math.min(b, k * P + d); if (e > s) iv.push([s, e]); } }
    }
    if (!iv.length) return `0 ${(L + 10).toFixed(1)}`;
    const arr = [0, iv[0][0]];
    iv.forEach(([s, e], i) => { arr.push(e - s, i + 1 < iv.length ? iv[i + 1][0] - e : L + 10); });
    return arr.map(v => (+v).toFixed(2)).join(' ');
  }
  const ST = { d: 4, g: 4.5 };                           // stitch length and gap, px (1.5px round caps)
  const ctr = r => [r.left + r.width / 2, r.top + r.height / 2];
  function edgePt(r, tx, ty, inset = 0) {                // where the ray from a rect's centre towards (tx,ty) leaves it
    const [cx0, cy0] = ctr(r), dx = tx - cx0, dy = ty - cy0;
    if (!dx && !dy) return [cx0, cy0];
    const hw = Math.max(0, r.width / 2 - inset), hh = Math.max(0, r.height / 2 - inset);
    const s = Math.min(dx ? hw / Math.abs(dx) : Infinity, dy ? hh / Math.abs(dy) : Infinity);
    return [cx0 + dx * Math.min(1, s), cy0 + dy * Math.min(1, s)];
  }
  const tracker = el => { let last = el && hasBox(el) ? el.getBoundingClientRect() : null; return () => { if (el && hasBox(el)) last = el.getBoundingClientRect(); return last; }; };
  const strokeOf = (n, c) => { n.setAttribute('class', 'mo-th'); n.style.stroke = c; return n; };
  const moments = new Set();
  function moment(build, max) {
    return new Promise(res => {
      let ok = false; const arrive = () => { if (!ok) { ok = true; res(); } };
      const it = { max, arrive, done() { moments.delete(it); arrive(); } };
      moments.add(it); TL.add(it, build);
    });
  }
  const ok = (...els) => !RM() && WA && els.every(hasBox);

  /* thread(from, to): bid sent. A slack coral stitch draws A → B, B bumps, the stitch tightens, then pulls through into B */
  function thread(fromEl, toEl, o = {}) {
    if (!ok(fromEl, toEl)) return Promise.resolve();
    const A = tracker(fromEl), B = tracker(toEl), c = col(o.color || 'violet');
    const DRAW = 420, TIGHT = 200, PULL = 260, END = DRAW + TIGHT + PULL;
    return moment(it => {
      const p = strokeOf(mk(it.g, 'path'), c), head = mk(it.g, 'circle', { r: 2.25 }); head.style.fill = c;
      let arrived = false;
      return t => {
        const a = A(), b = B(); if (!a || !b) return false;
        const ac = ctr(a), bc = ctr(b), p0 = edgePt(a, bc[0], bc[1], -6), p2 = edgePt(b, ac[0], ac[1], -6);
        const d = Math.hypot(p2[0] - p0[0], p2[1] - p0[1]) || 1, q = clamp((t - DRAW) / TIGHT, 0, 1);
        const sag = clamp(d * .2, 14, 90) * (o.sag ?? 1) * (1 - SP.land.f(q));
        let nx = -(p2[1] - p0[1]) / d, ny = (p2[0] - p0[0]) / d; if (ny < 0) { nx = -nx; ny = -ny; }   // it hangs: gravity
        const c1 = [(p0[0] + p2[0]) / 2 + nx * sag, (p0[1] + p2[1]) / 2 + ny * sag];
        p.setAttribute('d', `M${P2(p0)}Q${P2(c1)} ${P2(p2)}`);
        const L = p.getTotalLength(), h = eo(t / DRAW), tl = ei((t - DRAW - TIGHT) / PULL);
        p.setAttribute('stroke-dasharray', dashes(L, tl * L, h * L, ST.d, ST.g * (1 - clamp(q * 1.4, 0, 1))));
        if (t < DRAW) { const hp = p.getPointAtLength(h * L); head.setAttribute('cx', hp.x.toFixed(1)); head.setAttribute('cy', hp.y.toFixed(1)); } else head.style.opacity = '0';
        if (t >= DRAW && !arrived) { arrived = true; bump(toEl, 1.03); buzz(8); it.arrive(); }
        return t < END;
      };
    }, END + 700);
  }

  /* lock(el): escrow. A plum stitch runs in and wraps the element's outline, the loop tightens onto it */
  function lock(el, o = {}) {
    if (!ok(el)) return Promise.resolve();
    const R = tracker(el), F = o.from && hasBox(o.from) ? tracker(o.from) : null, c = col(o.color || 'plum');
    const cs = getComputedStyle(el), brs = cs.borderTopLeftRadius || '0', br = parseFloat(brs) || 0, pct = /%/.test(brs);
    const LEAD = 160, LOOP = 300, ARR = LEAD + LOOP, TIGHT = 200, HOLD = 140, FADE = 200, END = ARR + TIGHT + HOLD + FADE;
    return moment(it => {
      const lead = strokeOf(mk(it.g, 'path'), c), loop = strokeOf(mk(it.g, 'path'), c), knot = mk(it.g, 'circle', { r: 0 }); knot.style.fill = c;
      let arrived = false, s0 = null;
      return t => {
        const r = R(); if (!r) return false;
        const q = clamp((t - ARR) / TIGHT, 0, 1), out = 8 - 5.5 * SP.land.f(q);
        const l = r.left - out, tp = r.top - out, w = r.width + 2 * out, h = r.height + 2 * out;
        let rad = pct ? Math.min(r.width, r.height) * br / 100 + out : br + out; rad = Math.max(0, Math.min(rad, h / 2, w / 2));
        const sy = tp + h / 2;
        loop.setAttribute('d', `M${l.toFixed(1)} ${sy.toFixed(1)}V${(tp + rad).toFixed(1)}A${rad.toFixed(1)} ${rad.toFixed(1)} 0 0 1 ${(l + rad).toFixed(1)} ${tp.toFixed(1)}H${(l + w - rad).toFixed(1)}` +
          `A${rad.toFixed(1)} ${rad.toFixed(1)} 0 0 1 ${(l + w).toFixed(1)} ${(tp + rad).toFixed(1)}V${(tp + h - rad).toFixed(1)}A${rad.toFixed(1)} ${rad.toFixed(1)} 0 0 1 ${(l + w - rad).toFixed(1)} ${(tp + h).toFixed(1)}` +
          `H${(l + rad).toFixed(1)}A${rad.toFixed(1)} ${rad.toFixed(1)} 0 0 1 ${l.toFixed(1)} ${(tp + h - rad).toFixed(1)}Z`);
        const st = [l, sy];
        if (F && F()) s0 = edgePt(F(), st[0], st[1], -4); else if (!s0) s0 = [st[0] - Math.min(96, innerWidth * .1), st[1] + 22];
        const cc = [(s0[0] + st[0]) / 2, Math.max(s0[1], st[1]) + 16];
        lead.setAttribute('d', `M${P2(s0)}Q${P2(cc)} ${P2(st)}`);
        const gap = ST.g * (1 - clamp(q * 1.4, 0, 1));
        const LL = lead.getTotalLength(), LP = loop.getTotalLength();
        lead.setAttribute('stroke-dasharray', dashes(LL, eio((t - LEAD) / (LOOP + TIGHT)) * LL, eo(t / LEAD) * LL, ST.d, gap));
        loop.setAttribute('stroke-dasharray', dashes(LP, 0, eo((t - LEAD) / LOOP) * LP, ST.d, gap));
        knot.setAttribute('cx', st[0].toFixed(1)); knot.setAttribute('cy', st[1].toFixed(1)); knot.setAttribute('r', (2.5 * SP.pop.f(q)).toFixed(2));
        if (t >= ARR && !arrived) { arrived = true; bump(el, 1.03); buzz(12); it.arrive(); }
        if (t > ARR + TIGHT + HOLD) it.g.style.opacity = (1 - clamp((t - ARR - TIGHT - HOLD) / FADE, 0, 1)).toFixed(3);
        return t < END;
      };
    }, END + 700);
  }

  /* pull(from, to): stage rails. A taut thread is pulled to the new node, lands with a slight overshoot, the node bumps */
  function pull(fromEl, toEl, o = {}) {
    if (!ok(fromEl, toEl)) return Promise.resolve();
    const A = tracker(fromEl), B = tracker(toEl), c = col(o.color || 'violet');
    const RUN = 380, HOLD = 140, FADE = 200, END = RUN + HOLD + FADE;
    return moment(it => {
      const p = strokeOf(mk(it.g, 'path'), c), bead = mk(it.g, 'circle', { r: 2.25 }); bead.style.fill = c;
      let arrived = false;
      return t => {
        const a = A(), b = B(); if (!a || !b) return false;
        const ac = ctr(a), bc = ctr(b), p0 = edgePt(a, bc[0], bc[1], -2), p2 = edgePt(b, ac[0], ac[1], -2);
        const d = Math.hypot(p2[0] - p0[0], p2[1] - p0[1]) || 1, pr = clamp(t / RUN, 0, 1), hp = SP.land.f(pr);
        const hx = lerp(p0[0], p2[0], hp), hy = lerp(p0[1], p2[1], hp), sag = 6 * (1 - pr);
        const nx = -(p2[1] - p0[1]) / d, ny = (p2[0] - p0[0]) / d, mid = [(p0[0] + hx) / 2 + nx * sag, (p0[1] + hy) / 2 + ny * sag];
        p.setAttribute('d', `M${P2(p0)}Q${P2(mid)} ${hx.toFixed(1)} ${hy.toFixed(1)}`);
        const L = p.getTotalLength();
        p.setAttribute('stroke-dasharray', dashes(L, 0, L, ST.d, ST.g * (1 - clamp(pr * 1.25, 0, 1))));
        bead.setAttribute('cx', hx.toFixed(1)); bead.setAttribute('cy', hy.toFixed(1)); bead.style.opacity = pr < 1 ? '1' : '0';
        if (t >= RUN * .8 && !arrived) { arrived = true; bump(toEl, 1.08); buzz(8); it.arrive(); }
        if (t > RUN + HOLD) it.g.style.opacity = (1 - clamp((t - RUN - HOLD) / FADE, 0, 1)).toFixed(3);
        return t < END;
      };
    }, END + 700);
  }

  /* unspool(from, to): withdraw. The thread leaves a spool in loose loops that straighten as it runs, then tightens */
  function unspool(fromEl, toEl, o = {}) {
    if (!ok(fromEl, toEl)) return Promise.resolve();
    const A = tracker(fromEl), B = tracker(toEl), c = col(o.color || (isDarkBg(fromEl) ? 'butter' : 'violet'));
    const RUN = 520, TIGHT = 180, PULL = 260, END = RUN + TIGHT + PULL;
    return moment(it => {
      const p = strokeOf(mk(it.g, 'path'), c), spool = mk(it.g, 'circle', { r: 5 });
      spool.setAttribute('class', 'mo-th'); spool.style.stroke = c;
      let arrived = false;
      return t => {
        const a = A(), b = B(); if (!a || !b) return false;
        const ac = ctr(a), bc = ctr(b), p0 = edgePt(a, bc[0], bc[1], -6), p2 = edgePt(b, ac[0], ac[1], -6);
        const L0 = Math.hypot(p2[0] - p0[0], p2[1] - p0[1]) || 1, tx = (p2[0] - p0[0]) / L0, ty = (p2[1] - p0[1]) / L0, nx = -ty, ny = tx;
        const turns = clamp(Math.round(L0 / 80), 2, 6), aa = L0 / (6.2832 * turns), b0 = Math.min(14, aa * 1.6);
        const bb = b0 * (1 - eio((t - 120) / (RUN + TIGHT - 120))), N = turns * 24;
        let dd = `M${P2(p0)}`;
        for (let i = 1; i <= N; i++) { const th = i / N * 6.2832 * turns, al = aa * th - bb * Math.sin(th), nn = bb * (1 - Math.cos(th)) * .8; dd += `L${(p0[0] + tx * al + nx * nn).toFixed(1)} ${(p0[1] + ty * al + ny * nn).toFixed(1)}`; }
        p.setAttribute('d', dd);
        const L = p.getTotalLength(), q = clamp((t - RUN) / TIGHT, 0, 1);
        p.setAttribute('stroke-dasharray', dashes(L, ei((t - RUN - TIGHT) / PULL) * L, eo(t / RUN) * L, ST.d, ST.g * (1 - clamp(q * 1.4, 0, 1))));
        spool.setAttribute('cx', p0[0].toFixed(1)); spool.setAttribute('cy', p0[1].toFixed(1)); spool.setAttribute('r', (5 * (1 - .5 * eo(t / RUN))).toFixed(2));
        spool.style.opacity = (1 - clamp((t - RUN) / TIGHT, 0, 1)).toFixed(3);
        if (t >= RUN && !arrived) { arrived = true; bump(toEl, 1.03); buzz(10); it.arrive(); }
        return t < END;
      };
    }, END + 700);
  }

  /* check(el): a check that draws as a running stitch, then the stitches close into a solid line */
  const CHECK_D = 'M5 12.5 10 17l9-10';
  function check(el, o = {}) {
    if (!el) return Promise.resolve();
    let svg = el.tagName && el.tagName.toLowerCase() === 'svg' ? el : el.querySelector && el.querySelector('svg');
    let path = svg && svg.querySelector('path');
    if (!path || o.add) {
      el.insertAdjacentHTML('beforeend', `<svg class="mo-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${CHECK_D}"/></svg>`);
      svg = el.lastElementChild; path = svg.querySelector('path');
    }
    if (o.color) path.style.stroke = col(o.color);
    if (RM() || !WA || !hasBox(svg)) return Promise.resolve();
    let L = 0; try { L = path.getTotalLength(); } catch (_) {}
    if (!L) return Promise.resolve();
    const sw = parseFloat(getComputedStyle(path).strokeWidth) || 1.8, sd = Math.max(1.4, sw), sg = sw + 1.6;
    const DRAW = 300, TIGHT = 180, delay = o.delay || 0;
    path.setAttribute('stroke-dasharray', `0 ${L + 2}`);
    return new Promise(res => {
      let raf = 0, t0 = performance.now(), over = false;
      const end = () => { if (over) return; over = true; cancelAnimationFrame(raf); clearTimeout(safe); path.removeAttribute('stroke-dasharray'); res(); };
      const safe = setTimeout(end, delay + DRAW + TIGHT + 800);
      const step = now => {
        const t = now - t0 - delay;
        if (!path.isConnected) { end(); return; }
        if (t >= 0) {
          const q = clamp((t - DRAW) / TIGHT, 0, 1);
          path.setAttribute('stroke-dasharray', dashes(L, 0, eo(t / DRAW) * L, sd, sg * (1 - SP.land.f(q))));
          if (t >= DRAW + TIGHT) { end(); return; }
        }
        raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    });
  }

  /* ---------- celebrate: quiet. Two 1.5px rings (coral creator, violet brand) stitch, interlock (a real weave:
     coral over violet at the top crossing, violet over coral at the bottom), tighten and fade. ~1 s ---------- */
  let cel = null;
  function celebrate(el, o = {}) {
    if (cel) cel.kill();
    if (RM() || !WA) return Promise.resolve();
    const R = el && hasBox(el) ? tracker(el) : () => ({ left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0, right: innerWidth / 2, bottom: innerHeight / 2 });
    const DRAW = 420, TIGHT = 200, HOLD = 200, FADE = 220, END = DRAW + TIGHT + HOLD + FADE;
    const rr = mPhone.matches ? 13 : 15, off = rr * .44;
    let pill = null;
    if (o.text) { pill = doc.createElement('span'); pill.className = 'mo-cel-pill'; pill.setAttribute('aria-hidden', 'true'); pill.textContent = o.text; doc.body.append(pill); }
    return new Promise(res => {
      const it = { max: END + 600, done() { if (cel === me) cel = null; pill && pill.remove(); res(); } };
      const me = { kill: () => TL.kill(x => x === it) }; cel = me;
      TL.add(it, it2 => {
        const v = strokeOf(mk(it2.g, 'path'), 'var(--ll-violet)'), cr = strokeOf(mk(it2.g, 'path'), 'var(--ll-coral)'), patch = strokeOf(mk(it2.g, 'path'), 'var(--ll-violet)');
        return t => {
          const r = R(); if (!r) return false;
          const small = r.height < 88 && r.width < 360;
          let cx, cy;
          if (small) { cx = r.left + r.width / 2; cy = r.top - rr - 12; if (cy < rr + 8) cy = r.bottom + rr + 12; }
          else { cx = r.right - rr * 1.6 - 20; cy = r.top + rr + 20; }
          const q = clamp((t - DRAW) / TIGHT, 0, 1), Rr = rr * (1 + .14 * (1 - SP.land.f(q))), h = eo(t / DRAW), gap = ST.g * (1 - clamp(q * 1.4, 0, 1));
          const a = cx - off, b = cx + off;
          cr.setAttribute('d', `M${(a - Rr).toFixed(1)} ${cy.toFixed(1)}A${Rr.toFixed(1)} ${Rr.toFixed(1)} 0 1 1 ${(a + Rr).toFixed(1)} ${cy.toFixed(1)}A${Rr.toFixed(1)} ${Rr.toFixed(1)} 0 1 1 ${(a - Rr).toFixed(1)} ${cy.toFixed(1)}`);
          v.setAttribute('d', `M${(b + Rr).toFixed(1)} ${cy.toFixed(1)}A${Rr.toFixed(1)} ${Rr.toFixed(1)} 0 1 0 ${(b - Rr).toFixed(1)} ${cy.toFixed(1)}A${Rr.toFixed(1)} ${Rr.toFixed(1)} 0 1 0 ${(b + Rr).toFixed(1)} ${cy.toFixed(1)}`);
          const Lc = cr.getTotalLength(), Lv = v.getTotalLength();
          cr.setAttribute('stroke-dasharray', dashes(Lc, 0, h * Lc, ST.d, gap)); v.setAttribute('stroke-dasharray', dashes(Lv, 0, h * Lv, ST.d, gap));
          /* the bottom crossing: a short violet arc laid over coral once the weave locks */
          const hy = Math.sqrt(Math.max(0, Rr * Rr - off * off)), th = Math.atan2(hy, -off), s = .38;
          patch.setAttribute('d', `M${(b + Rr * Math.cos(th - s)).toFixed(1)} ${(cy + Rr * Math.sin(th - s)).toFixed(1)}A${Rr.toFixed(1)} ${Rr.toFixed(1)} 0 0 1 ${(b + Rr * Math.cos(th + s)).toFixed(1)} ${(cy + Rr * Math.sin(th + s)).toFixed(1)}`);
          patch.style.opacity = t >= DRAW ? '1' : '0';
          if (pill) {
            const pw = pill.offsetWidth, x0 = clamp(cx - pw / 2, 12, innerWidth - pw - 12), y0 = cy + rr + 12 + 6 * (1 - eo((t - 260) / D.s));
            pill.style.transform = `translate(${x0.toFixed(1)}px,${y0.toFixed(1)}px)`;
            pill.style.opacity = t < DRAW + TIGHT + HOLD ? clamp((t - 260) / D.s, 0, 1).toFixed(3) : (1 - clamp((t - DRAW - TIGHT - HOLD) / FADE, 0, 1)).toFixed(3);
          }
          if (t >= DRAW && !it2._bz) { it2._bz = true; buzz(12); }
          if (t > DRAW + TIGHT + HOLD) it2.g.style.opacity = (1 - clamp((t - DRAW - TIGHT - HOLD) / FADE, 0, 1)).toFixed(3);
          return t < END;
        };
      });
    });
  }

  /* ---------- flip: measure, mutate, glide every kept item from where it was; new items arrive ---------- */
  function flip(mutate, nodes, o = {}) {
    let ran = false;
    const run = () => { if (ran) return; ran = true; try { mutate && mutate(); } catch (e) { console.error(e); } };
    if (RM() || !WA || !nodes) { run(); return Promise.resolve(); }
    let anims = [];
    try {
      const live = typeof nodes === 'function' || typeof nodes === 'string' || nodes.nodeType === 1;
      const get = () => typeof nodes === 'function' ? toEls(nodes()) : typeof nodes === 'string' ? $$(nodes) : nodes.nodeType === 1 ? [...nodes.children] : toEls(nodes);
      const before = get();
      if (before.length > 150) { run(); return Promise.resolve(); }
      const key = n => (n.dataset && (n.dataset.flip || n.dataset.key || n.dataset.id)) || n.id || n;
      const first = new Map();
      before.forEach(n => { if (hasBox(n)) first.set(key(n), n.getBoundingClientRect()); });
      before.forEach(n => { if (n._moF) { n._moF.cancel(); n._moF = null; } });
      run();
      const after = (live ? get() : before).filter(hasBox);
      let k = 0;
      after.forEach(n => {
        const f = first.get(key(n)), r = n.getBoundingClientRect();
        const near = r.bottom > -200 && r.top < innerHeight + 200;
        if (f) {
          const dx = f.left - r.left, dy = f.top - r.top;
          if ((Math.abs(dx) < .5 && Math.abs(dy) < .5) || (!near && !(f.bottom > 0 && f.top < innerHeight))) return;
          n._moF = ani(n, [kf({ x: dx, y: dy, off: 0 })], { duration: o.dur || 420, easing: E.out });
        } else if (near) {
          n._moF = ani(n, [kf({ o: 0, s: .98, y: 10, off: 0 })], { duration: 360, delay: 60 + Math.min(k++ * 30, 180), easing: E.out, fill: 'backwards' });
        }
        n._moF && anims.push(n._moF);
      });
    } catch (e) { warn(e); run(); }
    return Promise.all(anims.map(fin)).then(() => {});
  }

  /* ---------- extras: shake, swap, flood, roll, print, fresh, rings, morph, lift ---------- */
  function shake(el) {
    if (!el || RM() || !WA) return Promise.resolve();
    return fin(ani(el, [0, -6, 5, -3, 2, 0].map(v => kf({ x: v })), { duration: D.m, easing: 'ease-out' }));
  }
  function swap(el, render, o = {}) {                    // step change in a flow: render runs at once, new content slides in
    try { render && render(); } catch (e) { console.error(e); }
    if (!el || RM() || !WA) return Promise.resolve();
    const dir = o.dir < 0 ? -1 : 1, h = el.querySelector('.t-display,.t-h1,.t-h2'), hv = h && inView(h) ? h : null;
    const us = unitsOf(el, hv).filter(u => inView(u)).slice(0, 10);
    return Promise.all([hv ? fin(maskRise(hv, { dur: 400 })) : null, ...us.map((u, i) => fin(ani(u, [kf({ o: 0, x: dir * 16, off: 0 })], { duration: 360, delay: Math.min(i * 30, 150), easing: E.out, fill: 'backwards' })))]).then(() => {});
  }
  function flood(target, o = {}) {                       // a colour circle grows from `from` behind the content
    const mutate = o.mutate || (() => {});
    if (!target || RM() || !WA || !hasBox(target)) { mutate(); return Promise.resolve(); }
    const tr = target.getBoundingClientRect(), fr = o.from && hasBox(o.from) ? o.from.getBoundingClientRect() : tr;
    const bg = getComputedStyle(target).backgroundColor;
    mutate();
    if (!target.isConnected) return Promise.resolve();
    const x = fr.left + fr.width / 2 - tr.left, y = fr.top + fr.height / 2 - tr.top;
    const R = Math.ceil(Math.max(...[[0, 0], [tr.width, 0], [0, tr.height], [tr.width, tr.height]].map(([a, b]) => Math.hypot(a - x, b - y))) + 8);
    if (getComputedStyle(target).position === 'static') target.style.position = 'relative';
    const css = target.style.cssText;
    target.style.backgroundColor = bg; target.classList.add('mo-flooding');
    const layer = doc.createElement('span'); layer.className = 'mo-flood'; layer.setAttribute('aria-hidden', 'true');
    const dot = doc.createElement('i');
    dot.style.cssText = `left:${x - R}px;top:${y - R}px;width:${2 * R}px;height:${2 * R}px;background:${o.color || 'var(--ll-violet-subtle)'}`;
    layer.append(dot); target.append(layer);
    const us = unitsOf(target).filter(u => inView(u)).slice(0, 10);
    us.forEach((u, i) => ani(u, [kf({ o: 0, y: 8, off: 0 })], { duration: 360, delay: 120 + Math.min(i * 30, 150), easing: E.out, fill: 'backwards' }));
    const done = () => { if (!layer.isConnected) return; target.style.cssText = css; target.classList.remove('mo-flooding'); layer.remove(); };
    setTimeout(done, (o.duration || D.xl) + 500);
    return fin(ani(dot, [{ transform: 'scale(0)' }, { transform: 'scale(1)' }], { duration: o.duration || D.xl, easing: E.io, fill: 'forwards' })).then(done);
  }
  const rollHosts = new WeakMap();
  function roll(coin, target, o = {}) {                  // the ₹ coin rolls along a rail to `target` and rests upright
    if (!coin || !target || !hasBox(coin) || !hasBox(target)) return Promise.resolve();
    coin._moT = target;
    const host = coin.offsetParent || coin.parentElement;
    if (host && window.ResizeObserver && !rollHosts.has(host)) {
      const ro = new ResizeObserver(() => $$('.mo-rolling', host).forEach(c => c._moT && roll(c, c._moT, { instant: true })));
      ro.observe(host); rollHosts.set(host, ro);
    }
    coin.classList.add('mo-rolling');
    const a = coin.getBoundingClientRect(), b = target.getBoundingClientRect();
    const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2), dist = Math.hypot(dx, dy);
    if (!G) { coin._moXY = coin._moXY || [0, 0]; coin._moXY[0] += dx; coin._moXY[1] += dy; setT(coin, coin._moXY[0], coin._moXY[1]); return Promise.resolve(); }
    const nx = (+G.getProperty(coin, 'x') || 0) + dx, ny = (+G.getProperty(coin, 'y') || 0) + dy;
    if (o.instant || RM() || dist < 1) { G.set(coin, { x: nx, y: ny }); return Promise.resolve(); }
    const turns = Math.max(1, Math.round(dist / (Math.PI * (coin.offsetWidth || 40)))), dirn = Math.sign(dx || dy) || 1;
    const rot = Math.round((+G.getProperty(coin, 'rotation') || 0) / 360) * 360 + 360 * turns * dirn;
    return new Promise(res => G.to(coin, { x: nx, y: ny, rotation: rot, duration: clamp(.36 + dist / 1200, .4, .7), ease: dist > 160 ? 'power2.inOut' : 'power3.out', overwrite: true,
      onComplete: () => { G.set(coin, { rotation: 0 }); res(); }, onInterrupt: res }));
  }
  function print(el, o = {}) {                           // receipt: the slip feeds out of a slot, top edge first
    if (!el || RM() || !WA) return Promise.resolve();
    return fin(ani(el, [{ clipPath: 'inset(-40px -40px 100% -40px)', ...kf({ y: -16 }) }, { clipPath: 'inset(-40px -40px -40px -40px)', ...kf({ y: 0 }) }],
      { duration: o.dur || 440, delay: o.delay || 0, easing: E.out, fill: 'backwards' }));
  }
  function fresh(el) {                                   // a new row: butter wash that fades into the row's own colour
    if (!el || RM() || !WA) return Promise.resolve();
    const c = getComputedStyle(root).getPropertyValue('--ll-butter').trim() || '#ffef85';
    return fin(ani(el, [{ backgroundColor: c, offset: 0 }], { duration: 900, delay: 200, easing: E.io, fill: 'backwards' }));
  }
  function rings(el) {                                   // brand glyph: two rings that link when seen (and on hover)
    if (!el) return;
    if (!el.querySelector('.mo-knot')) el.insertAdjacentHTML('beforeend', '<span class="mo-knot" aria-hidden="true"><i class="mo-r mo-rc"></i><i class="mo-r mo-rv"></i><i class="mo-r mo-rc mo-rc2"></i></span>');
    if (RM() || !WA) return;
    const k = el.querySelector('.mo-knot'), cs = $$('.mo-rc', k), v = $('.mo-rv', k);
    const link = (far, ms, ease) => {
      cs.forEach(c => ani(c, [kf({ x: `-${far}em`, o: far > .2 ? 0 : 1, off: 0 })], { duration: ms, easing: ease, fill: 'backwards' }));
      ani(v, [kf({ x: `${far}em`, o: far > .2 ? 0 : 1, off: 0 })], { duration: ms, easing: ease, fill: 'backwards' });
    };
    const go = () => link(.3, D.xl, E.land);
    if (inView(el)) go();
    else if ('IntersectionObserver' in window) { const ob = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { ob.disconnect(); go(); } }, { threshold: .4 }); ob.observe(el); }
    if (mFine.matches) el.addEventListener('pointerenter', () => link(.08, D.l, E.pop));
  }
  /* morph(pill, mutate): status change. Width eases old → new, colours cross-fade, the new label rises in */
  function morph(el, m, o = {}) {
    const run = () => {
      try {
        if (typeof m === 'function') m(el);
        else if (m) { if (m.cls != null) el.className = m.cls; if (m.html != null) el.innerHTML = m.html; else if (m.text != null) el.textContent = m.text; }
      } catch (e) { console.error(e); }
    };
    if (!el || RM() || !WA || !hasBox(el)) { run(); return Promise.resolve(); }
    const pick = cs => ({ backgroundColor: cs.backgroundColor, color: cs.color, boxShadow: cs.boxShadow === 'none' ? 'inset 0 0 0 0 transparent' : cs.boxShadow });
    const w0 = el.getBoundingClientRect().width, s0 = pick(getComputedStyle(el));
    run();
    if (!el.isConnected || !hasBox(el)) return Promise.resolve();
    const w1 = el.getBoundingClientRect().width, s1 = pick(getComputedStyle(el));
    const anims = [ani(el, [{ width: w0 + 'px', overflow: 'hidden', boxSizing: 'border-box', ...s0 }, { width: w1 + 'px', overflow: 'hidden', boxSizing: 'border-box', ...s1 }], { duration: o.dur || D.m, easing: E.out })];
    const wrapped = [];
    [...el.childNodes].forEach(n => {
      if (n.nodeType === 3 && n.textContent.trim()) { const s = doc.createElement('span'); s.className = 'mo-mt'; n.replaceWith(s); s.append(n); wrapped.push(s); anims.push(ani(s, [kf({ o: 0, y: 6 }), kf({ o: 1, y: 0 })], { duration: D.s, delay: 60, easing: E.out, fill: 'backwards' })); }
      else if (n.nodeType === 1) anims.push(ani(n, [kf({ o: 0, y: 6 }), kf({ o: 1, y: 0 })], { duration: D.s, delay: 60, easing: E.out, fill: 'backwards' }));
    });
    return Promise.all(anims.map(fin)).then(() => { wrapped.forEach(s => { if (s.parentNode) s.replaceWith(...s.childNodes); }); });
  }
  function lift(t) { const els = toEls(t); els.forEach(e => e.classList.add('mo-lift')); return () => els.forEach(e => e.classList.remove('mo-lift')); }
  function navItem(name) {
    const vis = s => $$(s).find(hasBox) || null;
    return vis(`.tabbar [data-nav="${name}"]`) || vis(`.side [data-nav="${name}"]`) ||
      (name === 'messages' ? vis('#inbox') : name === 'profile' ? vis('.top .avatar') : null) || vis(`[data-nav="${name}"]`);
  }

  /* ---------- data-motion hooks (markup-only motion, see MOTION.md) ---------- */
  const FMT = { inr: v => LLD.inr(v), num: v => Math.round(v).toLocaleString('en-IN'), compact: v => LLD.compact(Math.round(v)), pct: v => (+v).toFixed(1) + '%' };
  function scan(r0 = doc) {
    $$('[data-motion]', r0).forEach(n => {
      if (n._moScan || nomo(n)) return; n._moScan = true;
      const v = ' ' + n.dataset.motion + ' ', has = k => v.includes(' ' + k + ' ');
      if (has('count')) { const to = +n.dataset.to; if (!isNaN(to)) count(n, to, FMT[n.dataset.fmt] || FMT.num); }
      if (has('magnet')) n.classList.add('mo-mag');
      if (has('lift')) n.classList.add('mo-lift');
      if (has('rings')) rings(n);
      if (has('fresh')) fresh(n);
      if (has('print')) print(n);
      if (has('check')) { if (inView(n)) check(n, { delay: entering() ? 240 : 0 }); else if ('IntersectionObserver' in window) { const ob = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { ob.disconnect(); check(n); } }, { threshold: .6 }); ob.observe(n); } }
      if (has('reveal') || (has('words') && !inView(n))) reveal(n);
    });
  }

  /* ================= global micro-interactions (no screen code needed) ================= */

  /* page load: the bento boxes settle, the header boxes settle, the tab bar rises (once) */
  let shellDone = false;
  function shellIntro() {
    if (RM() || !WA) return;
    $$('.side > .sbox').filter(hasBox).forEach((b, i) => ani(b, [kf({ o: 0, y: 10, off: 0 })], { duration: D.l, delay: i * 50, easing: E.out, fill: 'backwards' }));
    $$('.top > *').filter(hasBox).forEach((n, i) => ani(n, [kf({ o: 0, y: -6, off: 0 })], { duration: D.l, delay: 40 + i * 40, easing: E.out, fill: 'backwards' }));
    const tb = $('.tabbar'); if (hasBox(tb)) ani(tb, [kf({ o: 0, y: 16, off: 0 })], { duration: D.xl, delay: 80, easing: E.land, fill: 'backwards' });
  }

  /* nav indicators. Sidebar: the coral dot (the needle) leads, the underline travels as a running stitch and
     tightens into the solid 1.5px line when it lands. Tab bar: the butter cell glides, an ink stitch tightens in it. */
  let dot = null, ul = null, cell = null;
  function sideInd(anim) {
    const nav = $('.side .nav'); if (!nav) return;
    if (!dot) {
      dot = doc.createElement('i'); dot.className = 'mo-dot'; dot.setAttribute('aria-hidden', 'true');
      ul = doc.createElement('i'); ul.className = 'mo-ul'; ul.setAttribute('aria-hidden', 'true');
      nav.prepend(dot, ul); nav.classList.add('mo-ind-on');
    }
    const a = $('a[aria-current="page"]', nav);
    if (!a || !hasBox(a)) { dot.style.opacity = ul.style.opacity = '0'; ul._p = null; return; }
    const x = a.offsetLeft, y = a.offsetTop + a.offsetHeight - 5.5, w = a.offsetWidth, dy = a.offsetTop + a.offsetHeight / 2 - 3;
    const p = ul._p, was = ul.style.opacity !== '0' && p; ul._p = { x, y, w, dy };
    const T = (X, Y, s) => `translate(${X.toFixed(1)}px,${Y.toFixed(1)}px)` + (s != null ? ` scaleX(${s.toFixed(3)})` : '');
    ul.style.width = w + 'px'; ul.style.transform = T(x, y); ul.style.opacity = '1';
    dot.style.transform = T(x - 14, dy); dot.style.opacity = '1';
    if (!anim || RM() || !WA) return;
    clearTimeout(ul._t); ul.classList.add('is-stitch');
    if (!was) {
      ani(ul, [{ transform: T(x, y, 0) }, { transform: T(x, y, 1) }], { duration: D.m, easing: E.out });
      ani(dot, [{ opacity: 0, transform: T(x - 14, dy) + ' scale(.4)' }, { opacity: 1, transform: T(x - 14, dy) + ' scale(1)' }], { duration: D.m, easing: E.pop });
      ul._t = setTimeout(() => ul.classList.remove('is-stitch'), 240);
      return;
    }
    if (p.x === x && p.y === y && p.w === w) { ul.classList.remove('is-stitch'); return; }
    /* the needle (dot) travels; the underline never crosses text: it stitches itself in under the new link, then tightens */
    ani(dot, [{ transform: T(p.x - 14, p.dy) }, { transform: T(x - 14, dy) }], { duration: 380, easing: E.land });
    ani(ul, [{ transform: T(x, y, 0) }, { transform: T(x, y, 1) }], { duration: D.m, delay: 120, easing: E.out, fill: 'backwards' });
    ul._t = setTimeout(() => ul.classList.remove('is-stitch'), 120 + 280);   // the stitch tightens as it completes
  }
  function tabInd(anim) {
    const tb = $('.tabbar'); if (!tb) return;
    if (!cell) { cell = doc.createElement('i'); cell.className = 'mo-cell'; cell.setAttribute('aria-hidden', 'true'); tb.prepend(cell); tb.classList.add('mo-ind-on'); }
    const a = $('a[aria-current="page"]', tb);
    if (!a || !hasBox(a)) { cell.style.opacity = '0'; cell._p = null; return; }
    const x = a.offsetLeft;
    Object.assign(cell.style, { width: a.offsetWidth + 'px', height: a.offsetHeight + 'px', top: a.offsetTop + 'px' });
    const prev = cell._p, fresh = prev == null || cell.style.opacity === '0';
    cell._p = x; cell.style.transform = `translateX(${x}px)`; cell.style.opacity = '1';
    if (!anim || RM() || !WA || prev === x) return;
    if (fresh) { ani(cell, [{ opacity: 0, transform: `translateX(${x}px) scale(.9)` }, { opacity: 1, transform: `translateX(${x}px) scale(1)` }], { duration: D.m, easing: E.pop }); return; }
    ani(cell, [{ transform: `translateX(${prev}px)` }, { transform: `translateX(${x}px)` }], { duration: 420, easing: E.land });
    clearTimeout(cell._t); clearTimeout(cell._t2);
    cell.classList.remove('is-tight'); cell.classList.add('is-glide');
    cell._t = setTimeout(() => { cell.classList.remove('is-glide'); cell.classList.add('is-tight'); cell._t2 = setTimeout(() => cell.classList.remove('is-tight'), 120); }, 300);
  }
  function indicators(anim) { sideInd(anim); tabInd(anim); }
  mPhone.addEventListener && mPhone.addEventListener('change', () => { try { indicators(false); } catch (_) {} });
  addEventListener('resize', () => { try { indicators(false); } catch (_) {} }, { passive: true });
  doc.fonts && doc.fonts.ready && doc.fonts.ready.then(() => { try { indicators(false); } catch (_) {} });

  /* segment glide: when the pressed .seg button changes, the fill glides to the new one. Concentric with the
     track: inset = the track's own padding, inner radius = outer radius − inset; no ring. */
  doc.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('.seg button');
    if (!b || RM() || !WA || nomo(b)) return;
    const seg = b.closest('.seg'), cur = seg && seg.querySelector('[aria-pressed="true"],[aria-selected="true"]');
    if (!cur || cur === b) return;
    const r0 = cur.getBoundingClientRect(), pt = [e.clientX, e.clientY], fill = getComputedStyle(cur).backgroundColor;
    requestAnimationFrame(() => {
      try {
        let s2 = seg.isConnected ? seg : (doc.elementFromPoint(pt[0], pt[1]) || doc.body).closest('.seg');
        const nb = s2 && s2.querySelector('[aria-pressed="true"],[aria-selected="true"]');
        if (!nb || !hasBox(nb)) return;
        const r1 = nb.getBoundingClientRect(); if (Math.abs(r1.left - r0.left) < 1 && Math.abs(r1.top - r0.top) < 1) return;
        const sr = s2.getBoundingClientRect(), cs = getComputedStyle(s2);
        const bl = parseFloat(cs.borderLeftWidth) || 0, bt = parseFloat(cs.borderTopWidth) || 0, inset = parseFloat(cs.paddingTop) || 0;
        const H = s2.clientHeight - 2 * inset, outer = Math.min(parseFloat(cs.borderTopLeftRadius) || 0, sr.height / 2), rad = Math.max(0, Math.min(outer - inset, H / 2));
        $$('.mo-seg-g', s2).forEach(n => n.remove());
        const g = doc.createElement('i'); g.className = 'mo-seg-g'; g.setAttribute('aria-hidden', 'true');
        const L0 = r0.left - sr.left - bl, L1 = r1.left - sr.left - bl;
        Object.assign(g.style, { top: inset + 'px', height: H + 'px', left: L1 + 'px', width: r1.width + 'px', borderRadius: rad + 'px', background: fill && !/rgba\(.*,\s*0\)$/.test(fill) && fill !== 'transparent' ? fill : 'var(--ll-coral)' });
        s2.classList.add('mo-seg-on', 'mo-seg-gliding'); s2.prepend(g);
        const a = ani(g, [{ left: L0 + 'px', width: r0.width + 'px' }, { left: L1 + 'px', width: r1.width + 'px' }], { duration: D.m, easing: E.land });
        const end = () => {
          if (!g.isConnected) return;
          s2.classList.add('mo-seg-settle'); s2.classList.remove('mo-seg-gliding'); g.remove();
          requestAnimationFrame(() => requestAnimationFrame(() => s2.classList.remove('mo-seg-settle')));
        };
        fin(a).then(end); setTimeout(end, 900);
      } catch (err) { warn(err); }
    });
  }, true);

  /* magnetic lean, opt-in only (data-motion="magnet"), at most 3px x / 2px y */
  const mags = new Set(); let magRaf = 0;
  function magTick(now) {
    magRaf = 0;
    mags.forEach(s => {
      const dt = Math.min(.05, Math.max(0, (now - s.t) / 1000)); s.t = now;
      const n = Math.max(1, Math.ceil(dt * 240)), h = dt / n;
      for (let i = 0; i < n; i++) { s.vx += (-s.k * (s.x - s.tx) - s.c * s.vx) * h; s.vy += (-s.k * (s.y - s.ty) - s.c * s.vy) * h; s.x += s.vx * h; s.y += s.vy * h; }
      const rest = Math.abs(s.x - s.tx) < .05 && Math.abs(s.y - s.ty) < .05 && Math.abs(s.vx) < .6 && Math.abs(s.vy) < .6;
      if (rest) { s.x = s.tx; s.y = s.ty; s.vx = s.vy = 0; mags.delete(s); }
      setT(s.el, s.x, s.y);
    });
    if (mags.size) magRaf = requestAnimationFrame(magTick);
  }
  const magKick = s => { s.t = performance.now(); mags.add(s); if (!magRaf) magRaf = requestAnimationFrame(magTick); };
  let magEl = null;
  doc.addEventListener('pointerover', e => {
    if (e.pointerType !== 'mouse' || !mFine.matches || RM() || !IND) return;
    const el = e.target.closest && e.target.closest('.mo-mag');
    if (!el || el === magEl || el.matches('[disabled],[aria-disabled="true"]') || el.closest('.mo-swipe.is-drag')) return;
    magEl = el;
    const s = el._moMag || (el._moMag = { el, x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, k: 300, c: 30 });
    const r = el.getBoundingClientRect(), cx = r.left + r.width / 2 - s.x, cy = r.top + r.height / 2 - s.y;
    const move = ev => { s.tx = clamp((ev.clientX - cx) * .08, -3, 3); s.ty = clamp((ev.clientY - cy) * .1, -2, 2); magKick(s); };
    const leave = () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', leave); s.tx = s.ty = 0; magKick(s); if (magEl === el) magEl = null; };
    el.addEventListener('pointermove', move, { passive: true }); el.addEventListener('pointerleave', leave);
  }, { passive: true });

  /* sheets: weighty settle (CSS), contents follow 12px behind; on phones a bottom sheet you can drag down */
  function sheetDrag(s) {
    const h = $('.sheet-h', s); if (!h) return;
    let gg = null, sp = null;
    const scrim = () => $('.scrim.on');
    const put = y => { s.style.translate = y ? `0 ${y.toFixed(1)}px` : ''; const c = scrim(); if (c) c.style.opacity = y > 0 ? String(clamp(1 - y / (s.offsetHeight || 600), .2, 1)) : ''; };
    h.addEventListener('pointerdown', e => {
      if (!mPhone.matches || e.button > 0 || e.target.closest('button,a,input,select,textarea') || nomo(e.target)) return;
      sp && sp.stop(); sp = null;
      gg = { id: e.pointerId, y0: e.clientY, y: 0, t: [[e.clientY, performance.now()]] };
      try { h.setPointerCapture(e.pointerId); } catch (_) {}
    });
    h.addEventListener('pointermove', e => {
      if (!gg || e.pointerId !== gg.id) return;
      const dy = e.clientY - gg.y0; gg.y = dy > 0 ? dy : -14 * (1 - Math.exp(dy / 40));
      put(gg.y); gg.t.push([e.clientY, performance.now()]); if (gg.t.length > 5) gg.t.shift();
    });
    const end = e => {
      if (!gg || e.pointerId !== gg.id) return; const g = gg; gg = null;
      const a = g.t[0], z = g.t[g.t.length - 1], v = (z[0] - a[0]) / Math.max(8, z[1] - a[1]);
      if (e.type !== 'pointercancel' && (g.y > Math.min(140, s.offsetHeight * .3) || (v > .6 && g.y > 24))) { const c = scrim(); if (c) c.style.opacity = ''; LLD.closeSheet(); return; }
      if (RM()) { put(0); return; }
      sp = runSpring({ from: g.y, to: 0, v: v * 1000, k: 520, c: 42, write: put });
    };
    h.addEventListener('pointerup', end); h.addEventListener('pointercancel', end);
  }
  function onSheet(s) {
    try { scan(s); } catch (e) { warn(e); }
    sheetDrag(s);
    if (RM() || !WA) return;
    const from = mPhone.matches ? { y: 12 } : { x: 12 };
    const title = $('.sheet-h .t-h2', s), b = $('.sheet-b', s);
    if (title) ani(title, [kf({ o: 0, ...from, off: 0 })], { duration: 360, delay: 80, easing: E.out, fill: 'backwards' });
    if (b) unitsOf(b).filter(u => !nomo(u)).slice(0, 8).forEach((u, i) => ani(u, [kf({ o: 0, ...from, off: 0 })], { duration: 360, delay: 120 + Math.min(i * 35, 175), easing: E.out, fill: 'backwards' }));
  }
  /* toasts: settle (CSS), a check icon stitches in, other icons pop; a small bump when a message replaces one on screen */
  function toastIcon(t) {
    const svg = $('svg', t), p = svg && $('path', svg);
    if (!svg || RM() || !WA) return;
    if (p && (p.getAttribute('d') || '').replace(/\s+/g, ' ').trim() === CHECK_D) check(svg, { delay: 100 });
    else ani(svg, [{ opacity: 0, scale: '.6' }, { opacity: 1, scale: '1' }], { duration: D.m, delay: 80, easing: E.pop, fill: 'backwards' });
  }
  function onToast(t) {
    let wasOn = t.classList.contains('on');
    new MutationObserver(ms => {
      const on = t.classList.contains('on'), content = ms.some(m => m.type === 'childList');
      if (on && !wasOn) toastIcon(t);
      else if (on && content && !RM()) { ani(t, [kf({ s: 1 }), kf({ s: 1.03, off: .35 }), kf({ s: 1 })], { duration: D.s, easing: E.out }); toastIcon(t); }
      wasOn = on;
    }).observe(t, { childList: true, attributes: true, attributeFilter: ['class'] });
  }
  new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => {
    if (n.nodeType !== 1 || nomo(n)) return;
    if (n.classList.contains('sheet')) onSheet(n);
    else if (n.classList.contains('toast')) onToast(n);
  }))).observe(doc.body, { childList: true });
  $$('.toast').forEach(onToast);

  /* the sidebar payout slip ticks to its new amount when money moves (e.g. after a withdrawal) */
  $$('[data-side-ready]').forEach(n => {
    let shown = null;
    const val = s => { const m = String(s).replace(/[^\d.]/g, ''); return m ? Math.round(parseFloat(m) * 100) : null; };
    new MutationObserver(() => {
      if (n._moTk || n.textContent === n._moTxt) return;
      const v = val(n.textContent);
      if (v == null || v === shown) return;
      if (shown == null || RM() || !inView(n)) { shown = v; n._moV = v; return; }
      const from = shown; shown = v;
      count(n, v, LLD.inr, { from });
    }).observe(n, { childList: true, characterData: true, subtree: true });
  });

  /* ---------- preloader: first load only, at most ~1.15 s, never blocks input (any key, click or scroll skips).
     Five cut-paper creator objects land with a weighty settle, a coral thread stitches through them, the paper lifts. ---------- */
  const F = v => `style="fill:var(${v})"`;
  const ngon = (cx, cy, r, n, rot = 0, j = .08, seed = 1) => { const p = []; for (let i = 0; i < n; i++) { const a = rot + i / n * 6.2832, k = 1 + j * Math.sin(seed * 7.3 + i * 2.1); p.push(`${(cx + Math.cos(a) * r * k).toFixed(1)},${(cy + Math.sin(a) * r * k).toFixed(1)}`); } return p.join(' '); };
  const PRE_OBJ = [
    /* phone showing a reel (creator) */
    `<polygon points="24,5 76,3 80,95 22,97" ${F('--ll-coral-deep')}/><polygon points="30,13 71,12 73,82 31,84" ${F('--ll-coral-subtle')}/><polygon points="44,36 62,47 44,59" ${F('--ll-coral')}/><polygon points="36,68 66,67 66,72 36,73" ${F('--ll-coral')}/>`,
    /* ring light */
    `<path fill-rule="evenodd" d="M${ngon(50, 40, 36, 11, .2, .06, 2).replace(/ /g, ' L')}Z M${ngon(50, 40, 22, 9, .5, .05, 3).replace(/ /g, ' L')}Z" ${F('--ll-coral')}/><polygon points="46,74 55,74 57,97 44,97" ${F('--ll-coral-deep')}/>`,
    /* brief card with a folded corner (brand) */
    `<polygon points="12,5 69,6 90,27 88,95 11,94" ${F('--ll-violet')}/><polygon points="69,6 70,27 90,27" ${F('--ll-violet-deep')}/><polygon points="22,40 76,39 76,45 22,46" ${F('--ll-violet-subtle')}/><polygon points="22,54 70,53 70,59 22,60" ${F('--ll-violet-subtle')}/><polygon points="22,68 58,67 58,73 22,74" ${F('--ll-violet-subtle')}/>`,
    /* ₹ coin */
    `<polygon points="${ngon(50, 50, 45, 11, 0, .05, 7)}" ${F('--ll-butter')}/><polygon fill="none" stroke-width="3" style="stroke:var(--ll-ink-900);fill:none" points="${ngon(50, 50, 35, 11, .1, .04, 8)}"/><text x="50" y="66" text-anchor="middle" font-size="44" style="fill:var(--ll-ink-900);font-family:var(--ll-display)">₹</text>`,
    /* thread spool (the loom) */
    `<polygon points="12,8 88,7 84,20 16,21" ${F('--ll-ink-900')}/><polygon points="24,20 76,20 76,80 24,80" ${F('--ll-butter')}/><polygon points="24,32 76,30 76,35 24,37" ${F('--ll-coral')}/><polygon points="24,46 76,44 76,49 24,51" ${F('--ll-coral')}/><polygon points="24,60 76,58 76,63 24,65" ${F('--ll-coral')}/><polygon points="16,80 84,79 88,93 12,92" ${F('--ll-ink-900')}/>`
  ];
  const PRE_KEY = 'mo-pre-v2';
  let preP = null;
  function preload(o = {}) {
    if (preP) return preP;
    const q = /[?&]preload\b/.test(location.search);
    if (!o.force && (RM() || !WA || doc.hidden || (navigator.webdriver && !q) || (!q && ss.get(PRE_KEY)))) return null;
    if (RM() || !WA) return null;
    ss.set(PRE_KEY, '1');
    const ov = doc.createElement('div'); ov.className = 'mo-pl'; ov.setAttribute('aria-hidden', 'true');
    const rot = [-6, 4, -3, 7, -4];
    ov.innerHTML = `<div class="mo-pl-row">${PRE_OBJ.map((s, i) => `<i class="mo-pl-o${i % 2 ? ' is-up' : ''}"><svg viewBox="0 0 100 100">${s}</svg></i>`).join('')}<svg class="mo-pl-th"><path/></svg></div>`;
    doc.body.append(ov);
    const row = $('.mo-pl-row', ov), objs = $$('.mo-pl-o', ov), path = $('.mo-pl-th path', ov), rr = row.getBoundingClientRect();
    const cs = objs.map(n => { const r = n.getBoundingClientRect(); return [r.left - rr.left + r.width / 2, r.top - rr.top + r.height / 2, r.width]; });
    const pts = [[cs[0][0] - cs[0][2] * .9, cs[0][1] + 10], ...cs.map((c, i) => [c[0], c[1] + (i % 2 ? -6 : 6)]), [cs[4][0] + cs[4][2] * .9, cs[4][1] - 10]];
    let dd = `M${P2(pts[0])}`; for (let i = 1; i < pts.length - 1; i++) dd += `Q${P2(pts[i])} ${P2([(pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2])}`; dd += `T${P2(pts[pts.length - 1])}`;
    path.setAttribute('d', dd);
    const L = path.getTotalLength(); path.setAttribute('stroke-dasharray', `0 ${L + 10}`);
    const anims = objs.map((n, k) => ani(n, [
      { opacity: 0, transform: `translateY(-28px) rotate(${rot[k] - 10}deg)` },
      { opacity: 1, transform: `translateY(0) rotate(${rot[k]}deg) scale(1.04,.94)`, offset: .62 },
      { transform: `translateY(-2px) rotate(${rot[k]}deg) scale(.99,1.01)`, offset: .82 },
      { opacity: 1, transform: `rotate(${rot[k]}deg)` }], { duration: 440, delay: 40 + k * 60, easing: E.out, fill: 'both' }));
    let res, handed = false, raf = 0;
    const t0 = performance.now();
    preP = new Promise(r => { res = r; });
    const S0 = 520, SD = 300, ST2 = 100, LIFT = 900, LD = 260;
    const step = now => {
      const t = now - t0;
      const q = clamp((t - S0 - SD) / ST2, 0, 1);
      path.setAttribute('stroke-dasharray', dashes(L, 0, eo((t - S0) / SD) * L, ST.d, ST.g * (1 - q)));
      if (t >= LIFT) { hand(false); return; }
      raf = requestAnimationFrame(step);
    };
    const cleanup = () => { removeEventListener('keydown', skip, true); removeEventListener('pointerdown', skip, true); removeEventListener('wheel', skip, true); removeEventListener('touchstart', skip, true); };
    const gone = () => { ov.remove(); anims.forEach(a => a && a.cancel()); preP = null; };
    function hand(fast) {
      if (handed) return; handed = true; cancelAnimationFrame(raf); clearTimeout(back); cleanup();
      const a = fast ? ani(ov, [{ opacity: 1 }, { opacity: 0 }], { duration: D.xs, easing: 'linear', fill: 'forwards' })
        : ani(ov, [{ clipPath: 'inset(0 0 0 0)' }, { clipPath: 'inset(0 0 100% 0)' }], { duration: LD, easing: E.io, fill: 'forwards' });
      if (!fast) ani(row, [kf({ y: 0, o: 1 }), kf({ y: -16, o: 0 })], { duration: LD, easing: E.in, fill: 'forwards' });
      fin(a).then(gone); setTimeout(gone, LD + 400);
      res();
    }
    const skip = e => { if (e && e.type === 'keydown' && /^(Shift|Alt|Control|Meta)$/.test(e.key)) return; hand(true); };
    addEventListener('keydown', skip, true); addEventListener('pointerdown', skip, { capture: true, passive: true });
    addEventListener('wheel', skip, { capture: true, passive: true }); addEventListener('touchstart', skip, { capture: true, passive: true });
    const back = setTimeout(() => hand(true), 1600);     // backstop: stalled rAF / hidden tab
    raf = requestAnimationFrame(step);
    return preP;
  }

  /* a moment belongs to the screen it happened on: leaving the route ends it */
  addEventListener('hashchange', () => { if (cel) cel.kill(); TL.fade(); }, true);

  Object.assign(LLD.motion, { enter, stagger, count, tick: count, press, swipe, reveal, celebrate, flip, shake, swap, flood, roll, print, fresh, rings, scan,
    thread, lock, pull, unspool, check, morph, lift, bump, navItem, preload: o => preload({ force: true, ...o }) || Promise.resolve(), ease: E, dur: D, ready: true });
  root.classList.add('mo-on');
})();
