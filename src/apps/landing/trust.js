// @ts-nocheck
/* part: trust */
/* Trust v5 (tr-): escrow coin track (tap or arrow keys to move, refund branch) and the live payout slip */
(() => {
  const L = window.LL,
    root = document.getElementById("trust");
  if (!L || !root) return;
  const { G, ST, hasG, RM, $, $$, inr, payout } = L;
  const anim = hasG && !RM;
  const RATE = Math.round((L.FEE_RATE ?? 0) * 100);

  /* ───────── escrow track ───────── */
  const track = $("#trTrack", root),
    nodes = $$(".tr-node", track),
    sw = $("#trRefund", root),
    cap = $("#trCap", root);
  const tok = $(".tr-tok", track),
    face = tok.firstElementChild;
  const svg = $(".tr-svg", track),
    pBr = $(".tr-br", svg),
    pGhost = $(".tr-br-ghost", svg),
    pProg = $(".tr-prog", svg);
  const SAMPLE = 18000,
    NET = inr(payout(SAMPLE).net);
  const CAP = [
    /* [screen-reader step, brand title, brand line, creator title, creator line]. Sample deal copy. */
    [
      "Step 1 of 4, brand pays in.",
      `${inr(SAMPLE)} paid in`,
      "It goes into escrow, not straight to the creator.",
      "Bid accepted",
      "Work starts once Mirevo has paid in.",
    ],
    [
      "Step 2 of 4, Linkloom holds it.",
      "Held by Linkloom",
      "It stays in escrow while the Reel is made.",
      "Deal funded",
      "The money is in escrow, so you can start.",
    ],
    [
      "Step 3 of 4, work approved.",
      "You approved the Reel",
      "Until you approve, you can ask for a revision.",
      "Approved by Mirevo",
      "Your payout is released from escrow.",
    ],
    [
      "Step 4 of 4, paid to UPI or bank.",
      "Deal complete",
      "The payment shows in your spend report.",
      `${NET} − tax to you`,
      `The full agreed price, no platform fee. Brands never see your PAN or bank details.`,
    ],
    [
      "If the work never arrives, refunded to brand.",
      "Refunded to you",
      "The work never arrived, so escrow returns your payment.",
      "Deal closed",
      "No work was delivered, so nothing is paid out.",
    ],
  ];
  const capEls = [
    "#trCapStep",
    ".tr-cap-b b",
    ".tr-cap-b .tr-cap-x",
    ".tr-cap-c b",
    ".tr-cap-c .tr-cap-x",
  ].map(s => $(s, cap));
  const cols = $$(".tr-cap-col", cap);
  let P = [],
    R = { x: 0, y: 0 },
    B = [],
    at = 0,
    refund = false,
    st = { s: 0, b: 0 },
    mv = null,
    turns = { n: 1, m: 1, dir: 1 };

  const bez = t => {
    const u = 1 - t,
      a = u * u * u,
      b = 3 * u * u * t,
      c = 3 * u * t * t,
      d = t * t * t;
    return {
      x: a * B[0].x + b * B[1].x + c * B[2].x + d * B[3].x,
      y: a * B[0].y + b * B[1].y + c * B[2].y + d * B[3].y,
    };
  };
  const onMain = s => {
    const k = Math.min(2, Math.max(0, Math.floor(s))),
      f = s - k,
      a = P[k],
      z = P[k + 1];
    return { x: a.x + (z.x - a.x) * f, y: a.y + (z.y - a.y) * f };
  };
  const fill = k =>
    CAP[k].forEach((t, i) => {
      capEls[i].textContent = t;
    });

  // the caption keeps the height of its tallest state, so nothing below it moves between steps
  function fitCap() {
    cap.style.minHeight = "";
    let h = 0;
    CAP.forEach((_, k) => {
      fill(k);
      h = Math.max(h, cap.offsetHeight);
    });
    fill(at);
    cap.style.minHeight = h + "px";
  }
  function measure() {
    fitCap();
    // offsets, not rects, so a transform on a node never skews the geometry
    const c = el => {
      let x = el.offsetWidth / 2,
        y = el.offsetHeight / 2,
        n = el;
      while (n && n !== track) {
        x += n.offsetLeft;
        y += n.offsetTop;
        n = n.offsetParent;
      }
      return { x, y };
    };
    P = nodes.slice(0, 4).map(n => c($(".tr-dot", n)));
    R = c($(".tr-dot", nodes[4]));
    const a = P[1],
      z = R,
      dy = z.y - a.y;
    B = [a, { x: a.x, y: a.y + dy * 0.62 }, { x: z.x, y: z.y - dy * 0.62 }, z];
    svg.setAttribute("viewBox", `0 0 ${track.clientWidth} ${track.clientHeight}`);
    const d = `M${a.x} ${a.y}C${B[1].x} ${B[1].y} ${B[2].x} ${B[2].y} ${z.x} ${z.y}`;
    pBr.setAttribute("d", d);
    pGhost.setAttribute("d", d);
    // whole turns per hop, so the coin always comes to rest with the ₹ upright
    const circ = Math.PI * (tok.offsetWidth || 58);
    let bl = 0,
      pv = B[0];
    for (let i = 1; i <= 24; i++) {
      const q = bez(i / 24);
      bl += Math.hypot(q.x - pv.x, q.y - pv.y);
      pv = q;
    }
    turns = {
      n: Math.max(1, Math.round(Math.hypot(P[1].x - P[0].x, P[1].y - P[0].y) / circ)),
      m: Math.max(1, Math.round(bl / circ)),
      dir: Math.sign(z.x - a.x) || 1,
    };
    place();
  }
  function place() {
    if (!P.length) return;
    const p = st.b > 0 ? bez(st.b) : onMain(st.s);
    tok.style.transform = `translate(${p.x}px,${p.y}px)`;
    face.style.rotate = (360 * (st.s * turns.n + turns.dir * st.b * turns.m)).toFixed(1) + "deg";
    const m = onMain(st.b > 0 ? 1 : st.s);
    pProg.setAttribute("d", `M${P[0].x} ${P[0].y}L${m.x} ${m.y}`);
    pBr.style.strokeDashoffset = 1 - st.b;
  }
  function render(t, fx) {
    at = t;
    nodes.forEach((n, k) => {
      n.classList.toggle("is-done", refund ? k <= Math.min(t, 1) || (k === 4 && t === 4) : k <= t && k < 4);
      if (k === t) n.setAttribute("aria-current", "step");
      else n.removeAttribute("aria-current");
    });
    fill(t);
    if (fx && anim)
      G.fromTo(
        cols,
        { opacity: 0, y: 8 },
        {
          opacity: 1,
          y: 0,
          duration: 0.4,
          stagger: 0.05,
          ease: "power3.out",
          overwrite: true,
          clearProps: "opacity,transform",
        },
      );
  }
  function go(t, fx = true) {
    if (t === at && !(t === 1 && st.b > 0)) {
      render(t, false);
      return;
    }
    render(t, fx);
    mv && mv.kill();
    const segs = [];
    if (t === 4) {
      if (st.b === 0 && st.s !== 1) segs.push({ s: 1 });
      segs.push({ b: 1 });
    } else {
      if (st.b > 0) segs.push({ b: 0 });
      segs.push({ s: t });
    }
    if (!anim) {
      segs.forEach(sg => Object.assign(st, sg));
      place();
      return;
    }
    mv = G.timeline({ onUpdate: place });
    let s = st.s,
      b = st.b;
    segs.forEach(sg => {
      const dist = "s" in sg ? Math.abs(sg.s - s) : Math.abs(sg.b - b) * 1.25;
      if ("s" in sg) s = sg.s;
      else b = sg.b;
      if (dist > 0.001)
        mv.to(st, {
          ...sg,
          duration: 0.5 + 0.3 * dist,
          ease: segs.length > 1 ? "power2.inOut" : "expo.inOut",
        });
    });
  }
  function setRefund(on) {
    refund = on;
    sw.setAttribute("aria-checked", String(on));
    nodes[4].disabled = !on;
    track.classList.toggle("is-refund", on);
  }
  sw.addEventListener("click", () => {
    setRefund(sw.getAttribute("aria-checked") !== "true");
    go(refund ? 4 : 1);
  });
  nodes.forEach((n, k) => {
    n.addEventListener("click", () => {
      if (refund && (k === 2 || k === 3)) setRefund(false);
      go(k);
    });
    // arrow keys move the coin to the neighbouring step (Home and End jump to the ends)
    n.addEventListener("keydown", e => {
      const order = refund ? [0, 1, 4] : [0, 1, 2, 3],
        i = order.indexOf(k);
      let j = -1;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") j = Math.min(order.length - 1, i + 1);
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") j = Math.max(0, i - 1);
      else if (e.key === "Home") j = 0;
      else if (e.key === "End") j = order.length - 1;
      if (j < 0 || i < 0) return;
      e.preventDefault();
      nodes[order[j]].focus();
      go(order[j]);
    });
  });
  if (anim) track.classList.add("tr-pre");
  if ("ResizeObserver" in window) new ResizeObserver(() => measure()).observe(track);
  else addEventListener("resize", measure);

  /* ───────── payout calculator (updates instantly; no count-up) ───────── */
  const form = $("#trCalc", root),
    price = $("#trPrice", root),
    range = $("#trRange", root),
    chips = $$(".tr-chips button", root);
  const oP = $("#trOutP", root),
    oFee = $("#trOutFee", root),
    oNet = $("#trOutNet", root),
    say = $("#trSay", root),
    handle = $("#trHandle", root);
  const MIN = 1000,
    MAX = 200000,
    fmt = n => (n ? Math.round(n).toLocaleString("en-IN") : "");
  $("#trRate", root).textContent = RATE;
  let sayT = 0;
  function update(v, from) {
    const r = payout(Math.min(MAX, Math.max(0, v || 0)));
    if (from !== "range") range.value = Math.min(MAX, Math.max(MIN, r.price));
    range.style.setProperty("--p", ((+range.value - MIN) / (MAX - MIN)).toFixed(4));
    range.setAttribute("aria-valuetext", inr(+range.value));
    chips.forEach(c => c.setAttribute("aria-pressed", String(+c.dataset.v === r.price)));
    oP.textContent = inr(r.price);
    oFee.textContent = "None";
    oNet.textContent = inr(r.net);
    clearTimeout(sayT);
    sayT = setTimeout(() => {
      say.textContent = `Agreed price ${inr(r.price)}. No platform fee. You receive ${inr(r.net)} minus tax.`;
    }, 700);
  }
  price.addEventListener("input", () => {
    const raw = price.value,
      caret = price.selectionStart == null ? raw.length : price.selectionStart;
    const right = raw.slice(caret).replace(/\D/g, "").length;
    let n = +raw.replace(/\D/g, "").replace(/^0+/, "").slice(0, 7) || 0;
    if (n > MAX) n = MAX;
    const out = fmt(n);
    price.value = out;
    let pos = out.length,
      cnt = 0;
    while (pos > 0 && cnt < right) {
      pos--;
      if (/\d/.test(out[pos])) cnt++;
    }
    try {
      price.setSelectionRange(pos, pos);
    } catch (e) {}
    update(n, "input");
  });
  const commit = () => {
    const n = Math.min(MAX, Math.max(MIN, +price.value.replace(/\D/g, "") || 0));
    price.value = fmt(n);
    update(n);
  };
  price.addEventListener("blur", commit);
  price.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const n = Math.min(
        MAX,
        Math.max(MIN, (+price.value.replace(/\D/g, "") || 0) + (e.key === "ArrowUp" ? 500 : -500)),
      );
      price.value = fmt(n);
      update(n);
    }
  });
  range.addEventListener("input", () => {
    price.value = fmt(+range.value);
    update(+range.value, "range");
  });
  chips.forEach(c =>
    c.addEventListener("click", () => {
      const v = +c.dataset.v;
      price.value = fmt(v);
      update(v);
    }),
  );
  form.addEventListener("submit", e => {
    e.preventDefault();
    commit();
  });

  // UPI / Bank: only the destination label changes (masked sample handles)
  const radios = $$('.tr-seg [role="radio"]', root),
    HANDLE = { upi: "ananya••••@upi", bank: "Bank a/c ••••4821" };
  handle.innerHTML = `<span>${HANDLE.upi}</span>`;
  handle.classList.add("tr-hv");
  function pick(r, focus) {
    if (focus) r.focus();
    if (r.getAttribute("aria-checked") === "true") return;
    radios.forEach(x => {
      const on = x === r;
      x.setAttribute("aria-checked", String(on));
      x.tabIndex = on ? 0 : -1;
    });
    L.morphChip(handle, HANDLE[r.dataset.d]);
  }
  radios.forEach((r, i) => {
    r.addEventListener("click", () => pick(r));
    r.addEventListener("keydown", e => {
      const f = e.key === "ArrowRight" || e.key === "ArrowDown",
        b = e.key === "ArrowLeft" || e.key === "ArrowUp";
      if (!f && !b) return;
      e.preventDefault();
      pick(radios[(i + (f ? 1 : radios.length - 1)) % radios.length], true);
    });
  });

  /* ───────── one entrance for the section body: the rails draw in and the coin drops onto step 1 ───────── */
  L.ready.push(() => {
    measure();
    document.fonts && document.fonts.ready.then(measure);
    render(0, false);
    place();
    if (!anim) return;
    ST.create({
      trigger: track,
      start: "top 78%",
      once: true,
      onEnter: () => {
        track.classList.remove("tr-pre");
        G.fromTo(
          face,
          { scale: 0 },
          { scale: 1, duration: 0.6, delay: 0.35, ease: "back.out(1.8)", clearProps: "transform" },
        );
      },
    });
  });
})();
