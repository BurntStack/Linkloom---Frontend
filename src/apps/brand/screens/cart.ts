// @ts-nocheck
/* Hiring cart (#cart): direct hiring steps 3–6. One row per creator in LLD_DATA.cart:
   deliverables (platform, format, count, notes) → timeline (due date) → revisions → agreed price (prefilled from the rate card) → Send invitation.
   Sending pushes a campaign {stage:'invited', source:'direct'} with a log entry, removes the creator from the cart, adds a notification,
   and a thread runs from the row to Campaigns in the nav. Payment into escrow happens only after the creator accepts (Builder C).
   Drafts live in LLD_DATA.ui.cart.drafts. Owner: Builder B. Classes .cart-*; styles in cart.css. */
(() => {
  const L = window.LLD,
    esc = L.esc,
    S = () => window.LLD_DATA;
  const mo = (fn, ...a) => {
    try {
      const m = L.motion;
      return m && m[fn] ? m[fn](...a) : null;
    } catch (e) {
      return null;
    }
  };
  const flip = (mutate, nodes) => {
    let done = false;
    const m = () => {
      done = true;
      mutate();
    };
    try {
      L.motion && L.motion.flip && L.motion.flip(m, nodes);
    } catch (e) {}
    if (!done) mutate();
  };

  const MIN_DAYS = 3,
    MAX_DAYS = 180,
    MIN_PRICE = 500,
    MAX_ITEMS = 6;
  const first = n => String(n || "").split(/\s+/)[0];
  const iso = d => d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const addDays = n => {
    const t = new Date(L.today());
    t.setDate(t.getDate() + n);
    return iso(t);
  };
  const todayISO = () => iso(L.today());
  const daysTo = v =>
    Math.round((new Date(v + "T12:00:00+05:30") - new Date(todayISO() + "T12:00:00+05:30")) / 864e5);
  const digits = v => String(v ?? "").replace(/[^\d]/g, "");
  const group = v => {
    const d = digits(v);
    return d ? Number(d).toLocaleString("en-IN") : "";
  };
  const plural = (n, w) => (n === 1 ? w : w === "Story" ? "Stories" : w + "s");

  function ui() {
    const s = S();
    s.ui = s.ui || {};
    const u = s.ui.cart || (s.ui.cart = {});
    u.drafts = u.drafts || {};
    return u;
  }
  const K = () => L.ck;
  const formatsFor = (c, p) => {
    const f = K().FORMATS[p] || [];
    const have = f.filter(x => c.content.includes(x));
    return have.length ? have : f;
  };
  const rateOf = (c, f) => (c.rates || {})[String(f).toLowerCase()] || 0;
  const listed = (c, d) => d.items.reduce((n, it) => n + rateOf(c, it.f) * it.n, 0);
  function draft(c) {
    const u = ui();
    if (!u.drafts[c.id]) {
      const p = c.platforms[0].p,
        f = formatsFor(c, p)[0];
      const start = Math.max(0, K().availDays(c));
      u.drafts[c.id] = {
        title: "",
        items: [{ p, f, n: 1, notes: "" }],
        due: addDays(Math.max(21, start + 14)),
        rev: 1,
        price: "",
        touched: false,
      };
    }
    const d = u.drafts[c.id];
    if (!d.touched) d.price = String(listed(c, d) / 100);
    return d;
  }
  const itemTxt = it => `${it.n} ${plural(it.n, it.f)}${it.notes.trim() ? ", " + it.notes.trim() : ""}`;
  const priceP = d => (parseInt(digits(d.price), 10) || 0) * 100;

  function validate(c, d) {
    const e = {};
    if (d.title.trim().length < 3) e.title = `Add a short title so ${first(c.name)} knows what this is for.`;
    if (!d.items.length) e.items = "Add at least one deliverable.";
    if (!d.due) e.due = "Pick a due date.";
    else {
      const n = daysTo(d.due);
      if (n < MIN_DAYS) e.due = `Give at least ${MIN_DAYS} days. Creators need time to shoot and edit.`;
      else if (n > MAX_DAYS) e.due = "Pick a date within the next 6 months.";
    }
    const p = priceP(d);
    if (!p) e.price = "Enter the agreed price.";
    else if (p < MIN_PRICE * 100) e.price = `The agreed price must be at least ${L.inr(MIN_PRICE * 100)}.`;
    return e;
  }

  /* ---------- one cart row ---------- */
  function itemRow(c, it, i, rid, only) {
    const P = K().PLAT,
      many = c.platforms.length > 1,
      fmts = formatsFor(c, it.p);
    return `<li class="cart-item" data-i="${i}">
      <div class="field cart-f-p"><${many ? "label" : "span"} class="lab" ${many ? `for="${rid}-p${i}"` : ""}>Platform</${many ? "label" : "span"}>
        ${
          many
            ? `<select class="select" id="${rid}-p${i}" data-k="p">${c.platforms.map(p => `<option value="${p.p}" ${p.p === it.p ? "selected" : ""}>${P[p.p].name}</option>`).join("")}</select>`
            : `<span class="cart-fixed">${K().glyph(it.p)}${P[it.p].name}</span>`
        }</div>
      <div class="field cart-f-f"><label for="${rid}-f${i}">Format</label>
        <select class="select" id="${rid}-f${i}" data-k="f">${fmts.map(f => `<option value="${f}" ${f === it.f ? "selected" : ""}>${f}</option>`).join("")}</select></div>
      <div class="field cart-f-n"><label for="${rid}-n${i}">Count</label>
        <select class="select num" id="${rid}-n${i}" data-k="n">${[1, 2, 3, 4, 5, 6, 8, 10].map(n => `<option value="${n}" ${n === it.n ? "selected" : ""}>${n}</option>`).join("")}</select></div>
      <div class="field cart-f-notes"><label for="${rid}-x${i}">Notes <span class="cart-opt">Optional</span></label>
        <input class="input" id="${rid}-x${i}" data-k="notes" maxlength="120" autocomplete="off" placeholder="e.g. 30–45 s, product in the first 3 s" value="${esc(it.notes)}"></div>
      ${only ? '<span class="cart-item-x" aria-hidden="true"></span>' : `<button class="ibtn cart-item-x" type="button" data-delitem="${i}" aria-label="Remove deliverable ${i + 1}, ${esc(it.n + " " + plural(it.n, it.f))}">${L.icon("close")}</button>`}
    </li>`;
  }
  function listedLine(c, d) {
    const parts = d.items
      .filter(it => rateOf(c, it.f))
      .map(it => `${it.n} ${plural(it.n, it.f)} × ${L.inr(rateOf(c, it.f))}`);
    const total = listed(c, d),
      p = priceP(d),
      fn = first(c.name);
    if (!parts.length)
      return `${esc(fn)} has no listed rate for this format. Agree a price you think is fair.`;
    let t = `Listed rate: ${parts.join(" + ")}${parts.length > 1 ? " = " + L.inr(total) : ""}.`;
    if (d.touched && p !== total)
      t += ` <button class="btn-q" type="button" data-relist>Use ${L.inr(total)}</button>`;
    if (d.touched && p && p < total)
      t += `<span class="cart-below">Below ${esc(fn)}’s listed rate. ${esc(fn)} can still accept, or decline.</span>`;
    return t;
  }
  const dueHelp = d => {
    if (!d.due) return "They submit the content for your review by this date.";
    const n = daysTo(d.due);
    return `${esc(L.fmtDate(d.due))}, ${n < 0 ? "in the past" : n === 0 ? "today" : n === 1 ? "tomorrow" : n + " days from today"} · they submit the content for your review by this date.`;
  };
  const sumLine = (c, d) => {
    const p = priceP(d),
      fn = first(c.name);
    return p
      ? `${esc(fn)} receives <b class="num">${L.inr(p)}</b>, the agreed price. You pay it into escrow only after ${esc(fn)} accepts. No fee, tax as per confirmed rules.`
      : `Set the agreed price to send this invitation.`;
  };

  function rowHTML(c) {
    const d = draft(c),
      rid = "cart-" + c.id,
      K_ = K(),
      fn = first(c.name);
    const live = S().campaigns.filter(
      x =>
        x.creator === c.id &&
        ["invited", "accepted", "funded", "in_progress", "submitted", "revision"].includes(x.stage),
    );
    const ad = K_.availDays(c);
    return `<article class="cart-row" data-id="${esc(c.id)}" aria-labelledby="${rid}-n">
      <header class="cart-row-h">
        ${K_.avatar(c, "cart-av")}
        <div class="cart-who">
          <h2 class="t-h3" id="${rid}-n"><a href="#creator-${esc(c.id)}">${esc(c.name)}</a>${K_.verBadge(c)}</h2>
          <p class="muted">${esc(c.handle)} · ${esc(c.city)}</p>
        </div>
        ${K_.availPill(c)}
        <button class="ibtn cart-remove" type="button" data-remove aria-label="Remove ${esc(c.name)} from the cart" title="Remove from cart">${L.icon("trash")}</button>
      </header>
      ${live.length ? `<p class="cart-note">${L.icon("info")}<span>You already have <b>${esc(live[0].title)}</b> with ${esc(fn)}. This sends a separate invitation.</span></p>` : ""}

      <div class="field cart-title" data-err="title"><label for="${rid}-t">Brief title</label>
        <input class="input" id="${rid}-t" data-k="title" maxlength="80" autocomplete="off" placeholder="e.g. Barrier Repair Serum, winter launch" value="${esc(d.title)}">
        <p class="err" aria-live="polite"></p></div>

      <section class="cart-sec" aria-labelledby="${rid}-dl" data-err="items">
        <div class="cart-sec-h"><h3 class="t-label" id="${rid}-dl"><span class="cart-step num">1</span>Deliverables</h3><p class="help">What ${esc(fn)} posts for you</p></div>
        <ol class="cart-items">${d.items.map((it, i) => itemRow(c, it, i, rid, d.items.length === 1)).join("")}</ol>
        <p class="err" aria-live="polite"></p>
        ${d.items.length < MAX_ITEMS ? `<button class="btn-q cart-add" type="button" data-additem>${L.icon("plus")}Add deliverable</button>` : ""}
      </section>

      <div class="cart-two">
        <section class="cart-sec field" data-err="due">
          <div class="cart-sec-h"><h3 class="t-label"><span class="cart-step num">2</span><label for="${rid}-d">Due date</label></h3></div>
          <input class="input num cart-date" id="${rid}-d" type="date" data-k="due" min="${addDays(MIN_DAYS)}" max="${addDays(MAX_DAYS)}" value="${esc(d.due)}">
          <p class="help" data-duehelp>${dueHelp(d)}</p>
          ${ad > 0 ? `<p class="help">${esc(K_.availLabel(c))}. Leave room after that.</p>` : ""}
          <p class="err" aria-live="polite"></p>
        </section>
        <section class="cart-sec">
          <div class="cart-sec-h"><h3 class="t-label" id="${rid}-rl"><span class="cart-step num">3</span>Revisions included</h3></div>
          <div class="seg cart-seg" role="group" aria-labelledby="${rid}-rl">${[0, 1, 2, 3].map(n => `<button type="button" data-rev="${n}" aria-pressed="${n === d.rev}">${n}</button>`).join("")}</div>
          <p class="help" data-revhelp>${d.rev ? `${d.rev} more ${d.rev === 1 ? "round" : "rounds"} of changes after the first delivery.` : "You approve or decline the first delivery as it is."}</p>
        </section>
      </div>

      <section class="cart-sec field cart-price" data-err="price">
        <div class="cart-sec-h"><h3 class="t-label"><span class="cart-step num">4</span><label for="${rid}-pr">Agreed price</label></h3></div>
        <div class="money-in"><span aria-hidden="true">₹</span><input id="${rid}-pr" class="num" data-k="price" inputmode="numeric" autocomplete="off" value="${esc(group(d.price))}" aria-describedby="${rid}-lr"></div>
        <p class="help" id="${rid}-lr" data-listed>${listedLine(c, d)}</p>
        <p class="err" aria-live="polite"></p>
      </section>

      <footer class="cart-row-f">
        <p class="cart-sum" data-sum>${sumLine(c, d)}</p>
        <button class="lq lq-p cart-send" type="button" data-send>${L.icon("send", "ic")}Send invitation</button>
      </footer>
    </article>`;
  }
  const slipHTML = (camp, c) => `<div class="cart-slip" data-id="slip-${esc(camp.id)}" role="status">
      <span class="cart-slip-ic">${L.icon("check")}</span>
      <div class="cart-slip-t"><p><b>Invitation sent to ${esc(c.name)}</b></p>
        <p class="muted">${esc(camp.title)} · ${esc(camp.items.length === 1 ? camp.items[0].count + " " + plural(camp.items[0].count, camp.items[0].format) : camp.items.length + " deliverables")} · due ${esc(L.fmtDate(camp.due))}. You pay <span class="num">${L.inr(camp.price)}</span> into escrow if ${esc(first(c.name))} accepts.</p></div>
      <a class="btn-q" href="#campaign-${esc(camp.id)}">View in Campaigns${L.icon("arrow")}</a>
    </div>`;

  L.register("cart", {
    title: "Hiring cart",
    nav: "creators",
    crumb: '<a href="#creators">Find creators</a> / Hiring cart',
    render(el) {
      if (!K()) {
        el.innerHTML =
          '<div class="empty"><p class="t-h2">The cart could not load.</p><p class="muted">Reload the page to try again.</p></div>';
        return;
      }
      K().ensure();
      const u = ui(),
        sent = []; // slips for invitations sent on this visit
      let removed = null;
      const people = () => S().cart.map(L.creator).filter(Boolean);
      el.innerHTML = `<div class="view-in cart">
        <header class="cart-head">
          <div class="cart-head-t">
            <h1 class="t-h1">Hiring cart</h1>
            <p class="cart-lede">Set what you need from each creator, then send the invitation. <b>Nothing is charged now.</b> You pay the agreed price into escrow only after a creator accepts. <span class="sample">Sample data</span></p>
          </div>
          <a class="btn-q" href="#creators">${L.icon("plus")}Add more creators</a>
        </header>
        <div class="cart-layout">
          <div class="cart-main">
            <div class="cart-list" id="cartList"></div>
            <p class="cart-undo" aria-live="polite"></p>
            <div class="empty cart-empty" hidden></div>
          </div>
          <aside class="cart-aside" aria-label="Payment">
            <div class="cart-total">
              <p class="t-eyebrow">If everyone accepts</p>
              <p class="t-money t-money-l num" data-total></p>
              <p class="cart-total-s" data-totals></p>
            </div>
            <div class="cart-how">
              <h2 class="t-h3">When you pay</h2>
              <ol class="cart-steps">
                <li><span class="cart-dot" aria-hidden="true"></span><p><b>You send the invitation.</b> Nothing is charged.</p></li>
                <li><span class="cart-dot" aria-hidden="true"></span><p><b>The creator accepts or declines.</b> We notify you either way.</p></li>
                <li class="is-escrow"><span class="cart-dot" aria-hidden="true">${L.icon("lock")}</span><p><b>You pay the agreed price into escrow.</b> Linkloom holds it and chat opens.</p></li>
                <li><span class="cart-dot" aria-hidden="true"></span><p><b>You approve the work.</b> The money is released to the creator.</p></li>
              </ol>
              <p class="help">No platform fee on any deal. If the creator does not deliver, the escrow comes back to you in full.</p>
            </div>
          </aside>
        </div>
      </div>`;
      const $ = q => el.querySelector(q),
        list = $("#cartList");

      function totals() {
        const ps = people(),
          sum = ps.reduce((n, c) => n + priceP(draft(c)), 0);
        $("[data-total]").textContent = L.inr(sum);
        $("[data-totals]").innerHTML = ps.length
          ? `${ps.length} ${ps.length === 1 ? "creator" : "creators"} · agreed prices only, no platform fee. Tax as per confirmed rules.`
          : "Your cart is empty.";
        $(".cart-aside").hidden = !ps.length && !sent.length;
      }
      function emptyState() {
        const none = !people().length,
          e = $(".cart-empty");
        e.hidden = !none;
        if (!none) return;
        e.innerHTML = sent.length
          ? `<img src="assets/step-02-plane.svg" width="72" height="72" alt=""><p class="t-h2">Everyone is invited.</p><p class="muted">You will get a notification when they reply. Pay into escrow from Campaigns once they accept.</p><div class="row wrap cart-empty-a"><button class="lq lq-p" type="button" data-go="#campaigns">Go to Campaigns</button><button class="lq lq-s" type="button" data-go="#creators">Find more creators</button></div>`
          : `<img src="assets/step-01-envelope.svg" width="160" height="117" alt=""><p class="t-h2">Your cart is empty.</p><p class="muted">Add creators from Find creators or their profile, then set deliverables and a due date here.</p><div class="row wrap cart-empty-a"><button class="lq lq-p" type="button" data-go="#creators">Find creators</button>${S().favorites.length ? '<button class="lq lq-s" type="button" data-go="#saved">Open saved creators</button>' : ""}</div>`;
        L.liquid(e);
      }
      function paintAll() {
        list.innerHTML = sent.map(x => slipHTML(x.camp, x.c)).join("") + people().map(rowHTML).join("");
        L.liquid(list);
        totals();
        emptyState();
      }
      const rowEl = id => list.querySelector(`.cart-row[data-id="${id}"]`);
      /* re-render one row in place (structure changed: items, platform), keeping focus on the same control */
      function refreshRow(id, focusSel) {
        const c = L.creator(id),
          old = rowEl(id);
        if (!old) return;
        const tmp = document.createElement("div");
        tmp.innerHTML = rowHTML(c);
        const nw = tmp.firstElementChild;
        old.replaceWith(nw);
        L.liquid(nw);
        if (focusSel) {
          const f = nw.querySelector(focusSel);
          f && f.focus({ preventScroll: true });
        }
        totals();
      }
      function lightSync(id) {
        // text-only updates while typing
        const c = L.creator(id),
          d = draft(c),
          r = rowEl(id);
        if (!r) return;
        r.querySelector("[data-listed]").innerHTML = listedLine(c, d);
        r.querySelector("[data-sum]").innerHTML = sumLine(c, d);
        r.querySelector("[data-duehelp]").textContent = dueHelp(d);
        const pin = r.querySelector('[data-k="price"]');
        if (document.activeElement !== pin) pin.value = group(d.price);
        totals();
      }
      function clearErr(r, k) {
        const f = r.querySelector(`[data-err="${k}"]`);
        if (f && f.classList.contains("is-err")) {
          f.classList.remove("is-err");
          f.querySelector(".err").textContent = "";
        }
      }

      list.addEventListener("input", e => {
        const r = e.target.closest(".cart-row");
        if (!r) return;
        const id = r.dataset.id,
          c = L.creator(id),
          d = draft(c),
          k = e.target.dataset.k;
        if (!k) return;
        const li = e.target.closest(".cart-item");
        if (li && k === "notes") {
          d.items[+li.dataset.i].notes = e.target.value;
          return;
        }
        if (k === "title") {
          d.title = e.target.value;
          clearErr(r, "title");
        }
        if (k === "price") {
          const v = digits(e.target.value).slice(0, 8);
          d.price = v;
          d.touched = true;
          clearErr(r, "price");
          lightSync(id);
        }
        if (k === "due") {
          d.due = e.target.value;
          clearErr(r, "due");
          lightSync(id);
        }
      });
      list.addEventListener("change", e => {
        const r = e.target.closest(".cart-row");
        if (!r) return;
        const id = r.dataset.id,
          c = L.creator(id),
          d = draft(c),
          k = e.target.dataset.k,
          li = e.target.closest(".cart-item");
        if (!li || !k || k === "notes") return;
        const i = +li.dataset.i,
          it = d.items[i];
        if (k === "p") {
          it.p = e.target.value;
          const f = formatsFor(c, it.p);
          if (!f.includes(it.f)) it.f = f[0];
          draft(c);
          refreshRow(id, `.cart-item[data-i="${i}"] [data-k="p"]`);
          return;
        }
        if (k === "f") it.f = e.target.value;
        if (k === "n") it.n = +e.target.value;
        draft(c);
        lightSync(id);
      });
      list.addEventListener("focusout", e => {
        if (e.target.dataset && e.target.dataset.k === "price") e.target.value = group(e.target.value);
      });
      list.addEventListener("click", e => {
        const b = e.target.closest("button");
        if (!b) return;
        const r = b.closest(".cart-row");
        if (!r) return;
        const id = r.dataset.id,
          c = L.creator(id),
          d = draft(c);
        if (b.hasAttribute("data-additem")) {
          const last = d.items[d.items.length - 1] || { p: c.platforms[0].p };
          const order = [last.p, ...c.platforms.map(x => x.p).filter(p => p !== last.p)];
          const pairs = order.flatMap(p => formatsFor(c, p).map(f => ({ p, f })));
          const next = pairs.find(x => !d.items.some(it => it.p === x.p && it.f === x.f)) || pairs[0];
          d.items.push({ p: next.p, f: next.f, n: 1, notes: "" });
          clearErr(r, "items");
          draft(c);
          refreshRow(id, `.cart-item[data-i="${d.items.length - 1}"] [data-k="f"]`);
          const li = rowEl(id).querySelector(`.cart-item[data-i="${d.items.length - 1}"]`);
          mo("stagger", [li]);
        } else if (b.dataset.delitem !== undefined) {
          d.items.splice(+b.dataset.delitem, 1);
          draft(c);
          refreshRow(id, ".cart-add");
        } else if (b.dataset.rev !== undefined) {
          d.rev = +b.dataset.rev;
          L.$$("[data-rev]", r).forEach(x =>
            x.setAttribute("aria-pressed", String(+x.dataset.rev === d.rev)),
          );
          r.querySelector("[data-revhelp]").textContent = d.rev
            ? `${d.rev} more ${d.rev === 1 ? "round" : "rounds"} of changes after the first delivery.`
            : "You approve or decline the first delivery as it is.";
        } else if (b.hasAttribute("data-relist")) {
          d.touched = false;
          draft(c);
          lightSync(id);
          clearErr(r, "price");
          r.querySelector('[data-k="price"]').focus({ preventScroll: true });
        } else if (b.hasAttribute("data-remove")) {
          const idx = S().cart.indexOf(id);
          removed = { id, idx };
          flip(
            () => {
              K().removeFromCart(id);
              r.remove();
            },
            () => [...list.children],
          );
          $(".cart-undo").innerHTML =
            `Removed ${esc(c.name)} from the cart. <button class="btn-q" type="button" data-undo>Undo</button>`;
          totals();
          emptyState();
          const nx = list.querySelector('.cart-row [data-k="title"]');
          (nx || $(".cart-undo button")).focus({ preventScroll: true });
        } else if (b.hasAttribute("data-send")) send(id, r, b);
      });
      $(".cart-undo").addEventListener("click", e => {
        if (!e.target.closest("[data-undo]") || !removed) return;
        const { id, idx } = removed;
        removed = null;
        L.store.set(s => {
          if (!s.cart.includes(id)) s.cart.splice(Math.min(idx, s.cart.length), 0, id);
        }, "cart-add");
        flip(paintAll, () => [...list.children]);
        $(".cart-undo").textContent = "Back in your cart.";
        const r = rowEl(id);
        if (r) {
          mo("fresh", r);
          r.querySelector('[data-k="title"]').focus({ preventScroll: true });
        }
      });

      let busy = false;
      async function send(id, r, btn) {
        if (busy) return;
        if (L.live && L.needKyc("#cart")) return; // the draft stays in the cart for after verification
        const c = L.creator(id),
          d = draft(c),
          errs = validate(c, d);
        L.$$("[data-err]", r).forEach(f => {
          const m = errs[f.dataset.err];
          f.classList.toggle("is-err", !!m);
          const p = f.querySelector(":scope > .err");
          if (p) p.textContent = m || "";
        });
        const keys = Object.keys(errs);
        if (keys.length) {
          mo("shake", btn);
          const f = r.querySelector(`[data-err="${keys[0]}"]`),
            inp = f && f.querySelector("input,select,button");
          inp && inp.focus({ preventScroll: false });
          return;
        }
        busy = true;
        btn.setAttribute("aria-disabled", "true");
        btn.setAttribute("aria-busy", "true");
        if (L.live) {
          try {
            await L.live.sendOffer({
              creatorId: c.id,
              deliverable: d.items.map(itemTxt).join(" + "),
              budget: priceP(d),
              deadline: d.due,
              message: d.title.trim() + (d.rev ? `\n\n${d.rev} revision${d.rev === 1 ? "" : "s"} included.` : ""),
              usageRights: S().ui.cart && S().ui.cart.usage ? S().ui.cart.usage : "As agreed in chat",
            });
          } catch (er) {
            busy = false;
            btn.removeAttribute("aria-disabled");
            btn.removeAttribute("aria-busy");
            if (L.live.isKycRequired(er)) return L.kycGate("#cart");
            const p = r.querySelector(".cart-send-err") || r.querySelector(":scope .err");
            L.toast(L.live.errorText(er), "alert");
            p && (p.textContent = L.live.errorText(er));
            return;
          }
        }
        const now = L.today().toISOString();
        const camp = {
          id: "c" + Date.now().toString(36),
          creator: c.id,
          source: "direct",
          job: null,
          title: d.title.trim(),
          platform: d.items[0].p,
          format: d.items[0].f,
          price: priceP(d),
          stage: "invited",
          revisionsIncluded: d.rev,
          revisionsUsed: 0,
          due: d.due,
          thread: null,
          invited: now,
          deliverables: d.items.map(itemTxt),
          items: d.items.map(it => ({ platform: it.p, format: it.f, count: it.n, notes: it.notes.trim() })),
          log: [[now, "invited"]],
        };
        /* the thread runs from the row to Campaigns while the row is still on screen, then the row becomes its receipt */
        try {
          await (mo("thread", r, mo("navItem", "campaigns")) || Promise.resolve());
        } catch (e) {}
        L.store.set(s => {
          s.campaigns.push(camp);
          s.cart = s.cart.filter(x => x !== c.id);
          if (s.ui && s.ui.cart && s.ui.cart.drafts) delete s.ui.cart.drafts[c.id];
          s.notifications.unshift({
            id: "n" + Date.now(),
            kind: "invited",
            text: `Invitation sent to ${c.name} for ${camp.title}. You pay into escrow after ${first(c.name)} accepts.`,
            at: now,
            go: "#campaign-" + camp.id,
            read: false,
          });
        }, "invite");
        sent.unshift({ camp, c });
        const tmp = document.createElement("div");
        tmp.innerHTML = slipHTML(camp, c);
        const slip = tmp.firstElementChild;
        flip(
          () => {
            r.remove();
            list.prepend(slip);
          },
          () => [...list.children],
        );
        L.liquid(slip);
        totals();
        emptyState();
        busy = false;
        const a = slip.querySelector("a");
        a && a.focus({ preventScroll: true });
        slip.scrollIntoView &&
          slip.getBoundingClientRect().top < 72 &&
          slip.scrollIntoView({ block: "center", behavior: L.RM ? "auto" : "smooth" });
      }

      paintAll();
      mo("stagger", L.$$(".cart-row", list));
      if (u.focus) {
        const id = u.focus;
        u.focus = null;
        requestAnimationFrame(() =>
          setTimeout(() => {
            const r = rowEl(id);
            if (!r) return;
            r.scrollIntoView({ block: "start", behavior: "auto" });
            window.scrollBy(0, -88);
            const t = r.querySelector('[data-k="title"]');
            t && t.focus({ preventScroll: true });
            mo("fresh", r);
          }, 40),
        );
      }
    },
  });
})();
