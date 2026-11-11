/* Linkloom Creator Dashboard: select enhancement (owned by Polish A).
   Every <select class="select"> gets a chevron wrapper. On fine pointers it also gets a custom listbox
   (ARIA select-only combobox). The native <select> stays the source of truth: its value changes and it fires
   input + change, so screen code needs no changes. On coarse pointers (phones) the native picker is kept.
   Opt out with data-native on the select. */
(() => {
  const L = window.LLD; if (!L) return;
  const doc = document, coarse = matchMedia('(pointer:coarse)'), RMq = matchMedia('(prefers-reduced-motion: reduce)');
  const proto = HTMLSelectElement.prototype;
  const dVal = Object.getOwnPropertyDescriptor(proto, 'value'), dIdx = Object.getOwnPropertyDescriptor(proto, 'selectedIndex');
  let uid = 0, open = null;                                  // open = the instance whose listbox is showing

  function enhance(sel) {
    if (sel._ui || sel.multiple || sel.hasAttribute('data-native') || sel.size > 1) return;
    const wrap = doc.createElement('span'); wrap.className = 'ui-sel';
    sel.parentNode.insertBefore(wrap, sel); wrap.append(sel);
    wrap.insertAdjacentHTML('beforeend', `<span class="ui-sel-ch" aria-hidden="true">${L.icon('down')}</span>`);
    const inst = { sel, wrap, custom: !coarse.matches };
    sel._ui = inst;
    if (inst.custom) build(inst);
  }

  function build(inst) {
    const { sel, wrap } = inst;
    const id = sel.id || (sel.id = 'uisel' + (++uid));
    wrap.classList.add('is-custom');
    const btn = doc.createElement('button');
    btn.type = 'button'; btn.className = sel.className + ' ui-sel-btn'; btn.id = id + '-ui';
    btn.setAttribute('role', 'combobox'); btn.setAttribute('aria-haspopup', 'listbox'); btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-controls', id + '-lb');
    btn.innerHTML = '<span class="ui-sel-v"></span>';
    wrap.insertBefore(btn, wrap.querySelector('.ui-sel-ch'));
    sel.tabIndex = -1; sel.setAttribute('aria-hidden', 'true');
    inst.btn = btn; inst.lbId = id + '-lb';
    const labels = () => {                                    // name the combobox from the select's <label for> or aria-label
      const ls = [...doc.querySelectorAll(`label[for="${CSS.escape(id)}"]`)];
      if (ls.length) { ls.forEach((l, i) => { if (!l.id) l.id = id + '-l' + i; }); btn.setAttribute('aria-labelledby', ls.map(l => l.id).join(' ') + ' ' + btn.id); }
      else if (sel.getAttribute('aria-label')) btn.setAttribute('aria-label', sel.getAttribute('aria-label'));
      ['aria-describedby', 'aria-invalid', 'aria-required'].forEach(a => sel.hasAttribute(a) ? btn.setAttribute(a, sel.getAttribute(a)) : btn.removeAttribute(a));
      btn.disabled = sel.disabled;
    };
    inst.sync = () => {
      const v = btn.firstChild, i = dIdx.get.call(sel);
      v.innerHTML = [...sel.options].map((o, k) => `<span${k === i ? ' class="is-on"' : ' aria-hidden="true"'}>${L.esc(o.textContent.trim()) || '&nbsp;'}</span>`).join('');
      if (open === inst) paint(inst);
    };
    labels(); inst.sync();
    for (const [k, d] of [['value', dVal], ['selectedIndex', dIdx]])          // programmatic sets keep the trigger in step
      Object.defineProperty(sel, k, { configurable: true, get() { return d.get.call(this); }, set(x) { d.set.call(this, x); inst.sync(); } });
    sel.addEventListener('change', inst.sync); sel.addEventListener('input', inst.sync);
    sel.addEventListener('focus', () => btn.focus());          // a click on the <label> lands on the trigger
    new MutationObserver(() => { labels(); inst.sync(); }).observe(sel, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['disabled', 'aria-describedby', 'aria-invalid', 'class'] });
    btn.addEventListener('click', () => open === inst ? close() : show(inst));
    btn.addEventListener('keydown', e => key(inst, e));
    btn.addEventListener('blur', () => { if (open === inst) setTimeout(() => { if (open === inst && !inst.lb.contains(doc.activeElement) && doc.activeElement !== btn) close(); }, 0); });
  }

  /* ---------- listbox ---------- */
  const opts = inst => [...inst.sel.options];
  const enabled = (inst, i) => { const o = inst.sel.options[i]; return o && !o.disabled && !(o.parentNode && o.parentNode.disabled); };
  function paint(inst) {
    const lb = inst.lb, cur = dIdx.get.call(inst.sel);
    let html = '', grp = null;
    opts(inst).forEach((o, i) => {
      const g = o.parentNode.tagName === 'OPTGROUP' ? o.parentNode : null;
      if (g !== grp) { grp = g; if (g) html += `<li class="ui-grp" role="presentation">${L.esc(g.label)}</li>`; }
      html += `<li class="ui-opt${i === inst.act ? ' is-act' : ''}" role="option" id="${inst.lbId}-${i}" data-i="${i}" aria-selected="${i === cur}"${enabled(inst, i) ? '' : ' aria-disabled="true"'}><span class="ui-opt-t">${L.esc(o.textContent.trim())}</span>${L.icon('check')}</li>`;
    });
    lb.innerHTML = html;
    inst.btn.setAttribute('aria-activedescendant', inst.act >= 0 ? `${inst.lbId}-${inst.act}` : '');
  }
  function setAct(inst, i, scroll = true) {
    if (i < 0 || i >= inst.sel.options.length) return;
    inst.act = i;
    inst.lb.querySelectorAll('.ui-opt').forEach(n => n.classList.toggle('is-act', +n.dataset.i === i));
    inst.btn.setAttribute('aria-activedescendant', `${inst.lbId}-${i}`);
    const n = inst.lb.querySelector(`[data-i="${i}"]`);
    if (n && scroll) { const t = n.offsetTop - 8, b = n.offsetTop + n.offsetHeight + 8; if (t < inst.lb.scrollTop) inst.lb.scrollTop = t; else if (b > inst.lb.scrollTop + inst.lb.clientHeight) inst.lb.scrollTop = b - inst.lb.clientHeight; }
  }
  function place(inst) {
    const lb = inst.lb, r = inst.btn.getBoundingClientRect(), vw = doc.documentElement.clientWidth, vh = innerHeight, m = 12;
    if (!inst.btn.isConnected || !r.width) return close(true);
    const tab = doc.querySelector('.tabbar'); const tb = tab && getComputedStyle(tab).display !== 'none' && !tab.closest('[hidden]') ? vh - tab.getBoundingClientRect().top : 0;
    lb.style.maxHeight = ''; lb.style.minWidth = Math.round(r.width) + 'px';
    const want = Math.min(lb.scrollHeight, 336), below = vh - tb - r.bottom - m - 6, above = r.top - m - 6;
    const up = below < want && above > below;
    lb.classList.toggle('is-up', up);
    lb.style.maxHeight = Math.max(120, Math.min(336, up ? above : below)) + 'px';
    const w = lb.offsetWidth, left = Math.max(m, r.left + w > vw - m ? r.right - w : r.left);   // wider than the trigger: grow leftward from its right edge
    lb.style.left = Math.round(left) + 'px';
    lb.style.top = up ? Math.round(r.top - 6 - lb.offsetHeight) + 'px' : Math.round(r.bottom + 6) + 'px';
  }
  function show(inst) {
    if (inst.btn.disabled) return;
    close(true);
    const lb = inst.lb || (inst.lb = Object.assign(doc.createElement('ul'), { className: 'ui-lb', id: inst.lbId }));
    lb.setAttribute('role', 'listbox'); lb.tabIndex = -1;
    const lab = inst.btn.getAttribute('aria-labelledby'); if (lab) lb.setAttribute('aria-labelledby', lab.split(' ')[0]); else lb.setAttribute('aria-label', inst.btn.getAttribute('aria-label') || 'Options');
    if (!lb.dataset.wired) {
      lb.dataset.wired = '1';
      lb.addEventListener('pointerdown', e => e.preventDefault());           // keep focus on the trigger
      lb.addEventListener('pointermove', e => { const o = e.target.closest('.ui-opt'); if (o && !o.hasAttribute('aria-disabled') && +o.dataset.i !== inst.act) setAct(inst, +o.dataset.i, false); });
      lb.addEventListener('click', e => { const o = e.target.closest('.ui-opt'); if (o && !o.hasAttribute('aria-disabled')) { pick(inst, +o.dataset.i); close(); } });
    }
    inst.act = dIdx.get.call(inst.sel);
    paint(inst);
    lb.classList.remove('on');
    doc.body.append(lb);
    open = inst;
    inst.wrap.classList.add('is-open'); inst.btn.setAttribute('aria-expanded', 'true');
    place(inst); setAct(inst, inst.act);
    requestAnimationFrame(() => lb.classList.add('on'));
  }
  function close(instant) {
    const inst = open; if (!inst) return; open = null;
    const lb = inst.lb;
    inst.wrap.classList.remove('is-open'); inst.btn.setAttribute('aria-expanded', 'false'); inst.btn.removeAttribute('aria-activedescendant');
    lb.classList.remove('on');
    if (instant || RMq.matches) lb.remove(); else setTimeout(() => { if (open !== inst) lb.remove(); }, 200);
  }
  function pick(inst, i) {
    if (!enabled(inst, i) || i === dIdx.get.call(inst.sel)) return;
    dIdx.set.call(inst.sel, i);
    inst.sync();
    inst.sel.dispatchEvent(new Event('input', { bubbles: true }));
    inst.sel.dispatchEvent(new Event('change', { bubbles: true }));
  }
  const step = (inst, from, d) => { const n = inst.sel.options.length; for (let i = from + d; i >= 0 && i < n; i += d) if (enabled(inst, i)) return i; return from; };
  const edge = (inst, end) => end ? step(inst, inst.sel.options.length, -1) : step(inst, -1, 1);

  let buf = '', bufT = 0;
  function typeahead(inst, ch, from) {
    clearTimeout(bufT); bufT = setTimeout(() => { buf = ''; }, 600);
    buf += ch.toLowerCase();
    const all = opts(inst), n = all.length, same = buf.split('').every(c => c === buf[0]);
    const q = same ? buf[0] : buf, start = same || buf.length === 1 ? from + 1 : from;
    for (let k = 0; k < n; k++) { const i = (start + k) % n; if (enabled(inst, i) && all[i].textContent.trim().toLowerCase().startsWith(q)) return i; }
    return -1;
  }

  function key(inst, e) {
    const isOpen = open === inst, k = e.key;
    if (!isOpen) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(k)) { e.preventDefault(); show(inst); if (k === 'ArrowUp' && !e.altKey) setAct(inst, edge(inst, false)); return; }
      if (k === 'Home' || k === 'End') { e.preventDefault(); show(inst); setAct(inst, edge(inst, k === 'End')); return; }
      if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) { const i = typeahead(inst, k, dIdx.get.call(inst.sel)); if (i >= 0) pick(inst, i); }
      return;
    }
    const a = inst.act;
    switch (k) {
      case 'ArrowDown': e.preventDefault(); if (e.altKey) return; setAct(inst, step(inst, a, 1)); break;
      case 'ArrowUp': e.preventDefault(); if (e.altKey) { pick(inst, a); close(); return; } setAct(inst, step(inst, a, -1)); break;
      case 'Home': e.preventDefault(); setAct(inst, edge(inst, false)); break;
      case 'End': e.preventDefault(); setAct(inst, edge(inst, true)); break;
      case 'PageDown': e.preventDefault(); setAct(inst, Math.min(edge(inst, true), a + 8)); break;
      case 'PageUp': e.preventDefault(); setAct(inst, Math.max(edge(inst, false), a - 8)); break;
      case 'Enter': case ' ': e.preventDefault(); if (k === ' ' && buf) { const i = typeahead(inst, k, a); if (i >= 0) setAct(inst, i); return; } pick(inst, a); close(); break;
      case 'Escape': e.preventDefault(); e.stopPropagation(); close(); break;   // stop: an open sheet must not close too
      case 'Tab': pick(inst, a); close(); break;
      default: if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) { const i = typeahead(inst, k, a); if (i >= 0) setAct(inst, i); }
    }
  }

  /* ---------- global: outside press, scroll, resize, route change ---------- */
  doc.addEventListener('pointerdown', e => { if (open && !open.lb.contains(e.target) && !open.btn.contains(e.target)) close(); }, true);
  addEventListener('scroll', e => { if (open && !(e.target instanceof Node && open.lb.contains(e.target))) close(); }, true);
  addEventListener('resize', () => open && close(true));
  addEventListener('hashchange', () => close(true));

  const scan = root => { if (root.matches && root.matches('select.select')) enhance(root); root.querySelectorAll && root.querySelectorAll('select.select').forEach(enhance); };
  let queued = false;
  new MutationObserver(recs => {
    for (const r of recs) for (const n of r.addedNodes) if (n.nodeType === 1 && !n.closest('.ui-sel-btn,.ui-lb')) { if (n.tagName === 'SELECT' || n.querySelector) { if (!queued) { queued = true; queueMicrotask(() => { queued = false; scan(doc.body); }); } break; } }
  }).observe(doc.documentElement, { childList: true, subtree: true });
  scan(doc.body);
  L.ui = Object.assign(L.ui || {}, { enhanceSelects: scan, closeSelect: () => close(true) });
})();
