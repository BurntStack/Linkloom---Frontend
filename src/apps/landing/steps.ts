// @ts-nocheck
/* part: steps */
/* Steps v5: a scroll-snap rail (drag on desktop, native swipe on touch, prev/next, "1 / 6"),
   illustration loops only on hover or focus (once on entry for touch), one entrance for the rail. */
(() => {
  const L = window.LL;
  if (!L) return;
  const { $, $$, RM, hasG } = L;
  const root = $("#how");
  if (!root) return;
  const inEl = $(".st-in", root),
    rail = $(".st-rail", root),
    cards = $$(".st-card", root),
    N = cards.length;
  const navs = $$(".st-nav", root),
    posN = $(".st-pos-n", root);

  /* payout slip numbers come from the shared helper (no per-deal platform fee) */
  const pay = L.payout(18000);
  $$("[data-st-pay]", root).forEach(el => {
    const k = el.dataset.stPay;
    el.textContent = (k === "fee" ? "−" : "") + L.inr(pay[k]);
  });
  const feeNote = $(".st-slip em", root);
  if (feeNote && L.FEE_RATE) feeNote.textContent = Math.round(L.FEE_RATE * 100) + "% in this example";

  /* the rail bleeds to the viewport edges; --g is the content gutter it snaps to */
  const gutter = () => {
    const g = inEl.getBoundingClientRect().left + parseFloat(getComputedStyle(inEl).paddingLeft);
    root.style.setProperty("--g", Math.max(16, g).toFixed(2) + "px");
  };
  const step = () => (N > 1 ? cards[1].offsetLeft - cards[0].offsetLeft : rail.clientWidth);
  const maxS = () => Math.max(0, rail.scrollWidth - rail.clientWidth);
  const index = () => Math.round(rail.scrollLeft / step());

  /* position "1 / 6" (or the visible range on wide screens) and the prev/next states */
  let raf = 0;
  const update = () => {
    raf = 0;
    const sl = rail.scrollLeft,
      m = maxS(),
      rr = rail.getBoundingClientRect();
    let vis = 0;
    cards.forEach(c => {
      const r = c.getBoundingClientRect();
      if (r.left >= rr.left - 2 && r.right <= rr.right + 2) vis++;
    });
    vis = Math.max(1, vis);
    let a = Math.min(N, index() + 1),
      b = Math.min(N, a + vis - 1);
    if (m && sl >= m - 2) {
      b = N;
      a = Math.max(1, N - vis + 1);
    }
    posN.textContent = a === b ? a : a + "–" + b;
    const atStart = sl <= 2,
      atEnd = sl >= m - 2;
    [atStart, atEnd].forEach((off, k) => {
      if (off && document.activeElement === navs[k]) navs[1 - k].focus();
      navs[k].disabled = off;
    });
  };
  const queue = () => {
    if (!raf) raf = requestAnimationFrame(update);
  };
  rail.addEventListener("scroll", queue, { passive: true });
  const relayout = () => {
    gutter();
    queue();
  };
  relayout();
  addEventListener("resize", relayout, { passive: true });

  const go = i => {
    i = Math.max(0, Math.min(N - 1, i));
    rail.scrollTo({
      left: Math.min(maxS(), cards[i].offsetLeft - cards[0].offsetLeft),
      behavior: RM ? "auto" : "smooth",
    });
  };
  navs.forEach(b => b.addEventListener("click", () => go(index() + +b.dataset.dir)));

  /* arrow keys move between cards; focusing a card scrolls it into the rail's view */
  cards.forEach((c, i) =>
    c.addEventListener("keydown", e => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const j = i + (e.key === "ArrowRight" ? 1 : -1);
      if (!cards[j]) return;
      e.preventDefault();
      cards[j].focus();
    }),
  );

  /* mouse drag (touch scrolls natively). Snap is off while dragging, then the rail glides to the nearest card. */
  let drag = null,
    endT = 0;
  rail.addEventListener("pointerdown", e => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    drag = {
      id: e.pointerId,
      x: e.clientX,
      sl: rail.scrollLeft,
      lx: e.clientX,
      lt: performance.now(),
      v: 0,
      moved: false,
    };
  });
  rail.addEventListener("pointermove", e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved) {
      if (Math.abs(dx) < 5) return;
      drag.moved = true;
      clearTimeout(endT);
      rail.setPointerCapture(drag.id);
      rail.classList.add("is-drag");
    }
    const now = performance.now();
    drag.v = (e.clientX - drag.lx) / Math.max(1, now - drag.lt);
    drag.lx = e.clientX;
    drag.lt = now;
    rail.scrollLeft = drag.sl - dx;
  });
  const release = e => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    if (!d.moved) return;
    const st = step(),
      i = Math.round((rail.scrollLeft - d.v * 160) / st);
    rail.scrollTo({ left: Math.max(0, Math.min(maxS(), i * st)), behavior: RM ? "auto" : "smooth" });
    const done = () => {
      clearTimeout(endT);
      rail.classList.remove("is-drag");
      rail.removeEventListener("scrollend", done);
    };
    rail.addEventListener("scrollend", done);
    endT = setTimeout(done, 800);
  };
  rail.addEventListener("pointerup", release);
  rail.addEventListener("pointercancel", release);
  rail.addEventListener("dragstart", e => e.preventDefault());

  /* illustration loops: play while hovered or focused (desktop) or once on entry (touch),
     and stop only at a moment where the loop matches the still pose, so nothing snaps. */
  const REST = [
    [
      [0, 0.02],
      [0.43, 0.45],
      [0.985, 1],
    ],
    [[0.45, 0.81]],
    [
      [0, 0.27],
      [0.55, 1],
    ],
    [
      [0.23, 0.27],
      [0.73, 0.77],
    ],
    [
      [0, 0.13],
      [0.38, 1],
    ],
    [
      [0, 0.02],
      [0.985, 1],
    ],
  ];
  const ONCE = [5900, 4800, 5900, 4500, 5900, 5900];
  const stageOf = c => $(".st-stage", c);
  const play = c => {
    if (RM) return;
    clearTimeout(c._stop);
    stageOf(c).classList.add("play");
  };
  const stop = c => {
    const s = stageOf(c);
    clearTimeout(c._stop);
    if (!s.classList.contains("play")) return;
    const a = s.getAnimations ? s.getAnimations({ subtree: true })[0] : null;
    if (!a || a.currentTime == null) {
      s.classList.remove("play");
      return;
    }
    const t = (a.currentTime % 6000) / 6000,
      w = REST[cards.indexOf(c)];
    if (w.some(([x, y]) => t >= x && t <= y)) {
      s.classList.remove("play");
      return;
    }
    const wait = Math.min(...w.map(([x]) => (x - t + 1) % 1));
    c._stop = setTimeout(() => s.classList.remove("play"), wait * 6000 + 30);
  };
  if (!RM) {
    if (L.fine) {
      cards.forEach(c => {
        c.addEventListener("pointerenter", e => {
          if (e.pointerType !== "touch") play(c);
        });
        c.addEventListener("pointerleave", e => {
          if (e.pointerType !== "touch") stop(c);
        });
        c.addEventListener("focus", () => play(c));
        c.addEventListener("blur", () => stop(c));
      });
    } else if (window.IntersectionObserver) {
      const io = new IntersectionObserver(
        es =>
          es.forEach(e => {
            if (!e.isIntersecting) return;
            const c = e.target;
            io.unobserve(c);
            play(c);
            c._stop = setTimeout(() => stop(c), ONCE[cards.indexOf(c)]);
          }),
        { threshold: 0.65 },
      );
      cards.forEach(c => io.observe(c));
    }
  }

  /* one entrance for the section body: the cards slide in along the rail's direction */
  L.ready.push(() => {
    if (document.fonts) document.fonts.ready.then(relayout);
    if (!hasG || RM) return;
    L.G.from(cards, {
      x: 56,
      opacity: 0,
      duration: 1.1,
      ease: "expo.out",
      stagger: 0.07,
      clearProps: "transform,opacity",
      scrollTrigger: { trigger: rail, start: "top 88%", once: true },
    });
  });
})();
