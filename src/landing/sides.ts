// @ts-nocheck
/* part: sides */
/* sides: "One deal. Two sides." Entrance colour flip (funkhaus P13 via a scrubbed clip-path on a duplicate
   headline), then an audience switch that floods the stage and flips one deal card between its two faces. */
(() => {
  const LL = window.LL,
    { $, $$, G, hasG, RM, inr, payout, morphChip } = LL;
  const root = $("#sides");
  if (!root) return;
  const motion = hasG && !RM;
  const pin = $(".sd-pin", root),
    flip = $(".sd-flip", root),
    deal = $("#sdDeal"),
    stage = $("#sdStage");
  const tabs = $$(".sd-tab", root),
    copies = $$(".sd-side", root),
    card = $(".sd-card", root);
  const front = $(".sd-front", root),
    back = $(".sd-back", root),
    liveEl = $("#sdLive");
  const fld = { creator: $(".sd-fld-c", root), brand: $(".sd-fld-b", root) };
  const say = t => {
    liveEl.textContent = "";
    setTimeout(() => {
      liveEl.textContent = t;
    }, 60);
  };

  if (motion) root.classList.add("sd-live");
  const hls = $$(".sd-hl", root);
  if (motion) {
    hls.forEach(h => LL.splitWords(h));
    G.set($$(".w", pin), { opacity: 0 });
    G.set($$(".sd-eb0", pin), { opacity: 0 });
  }

  /* bubbles and notes pop when the stage comes into view (and again after a header or hero link picks a side) */
  let io = null;
  const armSeen = () => {
    if (!motion) {
      root.classList.add("sd-seen");
      return;
    }
    root.classList.remove("sd-seen");
    io && io.disconnect();
    io = new IntersectionObserver(
      es => {
        if (es.some(e => e.isIntersecting)) {
          root.classList.add("sd-seen");
          io.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    io.observe(stage);
  };

  /* ───────── side switching ───────── */
  let side = null;
  const kids = el => [...el.children].flatMap(c => (c.tagName === "UL" ? [...c.children] : [c]));
  function setSide(s, opt = {}) {
    s = s === "brand" ? "brand" : "creator";
    if (s === side) return;
    const first = side === null;
    side = s;
    const r = stage.getBoundingClientRect(),
      onScreen = r.bottom > 0 && r.top < innerHeight;
    const anim = motion && !first && !opt.instant && onScreen;
    if (!anim) root.classList.add("sd-snap");
    root.dataset.side = s;
    tabs.forEach(t => {
      const on = t.dataset.s === s;
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
    });
    stage.setAttribute("aria-labelledby", s === "brand" ? "sdTabB" : "sdTabC");
    front.inert = s === "brand";
    back.inert = s !== "brand";
    const inEl = copies.find(c => c.dataset.for === s),
      outEl = copies.find(c => c.dataset.for !== s);
    inEl.inert = false;
    inEl.removeAttribute("aria-hidden");
    outEl.inert = true;
    outEl.setAttribute("aria-hidden", "true");

    if (anim) {
      const ins = kids(inEl),
        outs = kids(outEl);
      G.killTweensOf([...ins, ...outs, fld.creator, fld.brand, card]);
      inEl.classList.remove("sd-off");
      G.to(outs, {
        opacity: 0,
        y: -16,
        duration: 0.32,
        stagger: 0.025,
        ease: "power2.in",
        overwrite: true,
        onComplete: () => {
          if (outEl.dataset.for !== side) {
            outEl.classList.add("sd-off");
            G.set(outs, { clearProps: "opacity,transform" });
          }
        },
      });
      G.fromTo(
        ins,
        { opacity: 0, y: 28 },
        {
          opacity: 1,
          y: 0,
          duration: 0.85,
          stagger: 0.055,
          ease: "expo.out",
          delay: 0.3,
          overwrite: true,
          clearProps: "opacity,transform",
        },
      );
      /* flood: the incoming colour grows as a circle from the selected tab */
      const tab = tabs.find(t => t.dataset.s === s).getBoundingClientRect();
      const x = tab.left + tab.width / 2 - r.left,
        y = tab.top + tab.height / 2 - r.top;
      const R =
        Math.max(
          ...[
            [0, 0],
            [r.width, 0],
            [0, r.height],
            [r.width, r.height],
          ].map(([a, b]) => Math.hypot(a - x, b - y)),
        ) + 24;
      G.set([fld.creator, fld.brand], { clearProps: "clipPath" });
      G.fromTo(
        fld[s],
        { clipPath: `circle(0px at ${x}px ${y}px)` },
        {
          clipPath: `circle(${R}px at ${x}px ${y}px)`,
          duration: 1.15,
          ease: "power3.inOut",
          clearProps: "clipPath",
        },
      );
      /* the card dips while it turns over */
      G.timeline()
        .to(card, { "--sd-sc": 0.92, duration: 0.45, ease: "power2.in" })
        .to(card, { "--sd-sc": 1, duration: 0.8, ease: "expo.out" });
    } else {
      copies.forEach(c => c.classList.toggle("sd-off", c.dataset.for !== s));
      void root.offsetWidth;
      requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove("sd-snap")));
    }
    try {
      sessionStorage.setItem("ll-side", s);
    } catch (e) {}
  }

  tabs.forEach((t, i) => {
    t.addEventListener("click", () => setSide(t.dataset.s));
    t.addEventListener("keydown", e => {
      const k = e.key;
      let j = null;
      if (k === "ArrowRight" || k === "ArrowDown") j = (i + 1) % tabs.length;
      else if (k === "ArrowLeft" || k === "ArrowUp") j = (i - 1 + tabs.length) % tabs.length;
      else if (k === "Home") j = 0;
      else if (k === "End") j = tabs.length - 1;
      if (j === null) return;
      e.preventDefault();
      tabs[j].focus();
      setSide(tabs[j].dataset.s);
    });
  });

  /* header and hero links pick a face; remember it for the session */
  LL.onPickSide(s => {
    setSide(s, { instant: true });
    armSeen();
  });
  let s0 = "creator";
  try {
    s0 = sessionStorage.getItem("ll-side") || "creator";
  } catch (e) {}
  setSide(s0, { instant: true });
  armSeen();

  /* core scrolls #sides links to the section top (the ink headline). Land on the deal stage instead. */
  document.addEventListener("click", e => {
    const a = e.target.closest('a[href="#sides"]');
    if (!a) return;
    const L = LL.lenis;
    if (L) L.scrollTo(deal, { offset: -72, duration: 1.4 });
    else scrollTo({ top: deal.getBoundingClientRect().top + scrollY - 72, behavior: RM ? "auto" : "smooth" });
  });

  /* ───────── creator face: bid, payout, send ───────── */
  const bid = $("#sdBid"),
    netV = $("#sdNetV"),
    feeV = $("#sdFeeV"),
    send = $("#sdSend"),
    chip = $("#sdChip");
  const bubBid = $("#sdBubBid"),
    bubEsc = $("#sdBubEsc"),
    nextEl = $("#sdNext");
  const MAX = 9999999,
    digits = v => String(v).replace(/\D/g, "").slice(0, 7),
    num = () => +digits(bid.value) || 0;
  const shown = { net: 18000, fee: 0 };
  let sent = null,
    chipState = "draft";
  const paint = () => {
    netV.textContent = inr(shown.net);
    feeV.textContent = inr(shown.fee);
  };
  const label = (b, text) => {
    const t = $(".t", b),
      t2 = $(".t2", b);
    if (t && t2) {
      t.textContent = text;
      t2.textContent = text;
    } else b.textContent = text;
  };
  const setChip = st => {
    if (st === chipState) return;
    chipState = st;
    chip.dataset.tone = st;
    morphChip(chip, st === "sent" ? "Bid sent" : "Draft");
  };
  const pop = (b, text) => {
    $("span", b).textContent = text;
    b.classList.remove("sd-on");
    void b.offsetWidth;
    b.classList.add("sd-on");
  };
  function sync(animate) {
    const p = payout(num());
    if (motion && animate)
      G.to(shown, {
        net: p.net,
        fee: p.fee,
        duration: 0.55,
        ease: "power3.out",
        overwrite: true,
        onUpdate: paint,
      });
    else {
      shown.net = p.net;
      shown.fee = p.fee;
      paint();
    }
    const isSent = sent !== null && p.price === sent;
    setChip(isSent ? "sent" : "draft");
    if (!isSent && sent !== null) bubBid.classList.remove("sd-on");
    send.setAttribute("aria-disabled", isSent || !p.price ? "true" : "false");
    label(send, isSent ? "Bid sent" : sent !== null ? "Update bid" : "Send bid");
    nextEl.textContent = isSent
      ? `Sent. If Mirevo accepts, ${inr(p.price)} is held in escrow before you start.`
      : "Next: Mirevo compares bids and pays the one it accepts into escrow.";
  }
  bid.addEventListener("input", () => {
    const pos = bid.selectionStart ?? bid.value.length,
      before = bid.value.slice(0, pos).replace(/\D/g, "").length;
    const n = num(),
      s = n ? n.toLocaleString("en-IN") : "";
    bid.value = s;
    let i = 0,
      d = 0;
    while (i < s.length && d < before) {
      if (/\d/.test(s[i])) d++;
      i++;
    }
    try {
      bid.setSelectionRange(i, i);
    } catch (e) {}
    sync(true);
  });
  const step = by => {
    bid.value = Math.min(MAX, Math.max(0, num() + by)).toLocaleString("en-IN");
    sync(true);
  };
  bid.addEventListener("keydown", e => {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      step(e.key === "ArrowUp" ? 500 : -500);
    }
    if (e.key === "Enter") {
      e.preventDefault();
      send.click();
    }
  });
  bid.addEventListener("blur", () => {
    if (!bid.value) {
      bid.value = "0";
      sync(false);
    }
  });
  $$(".sd-step", root).forEach(b => b.addEventListener("click", () => step(+b.dataset.step)));
  send.addEventListener("click", () => {
    if (send.getAttribute("aria-disabled") === "true") return;
    const p = payout(num());
    if (!p.price) return;
    sent = p.price;
    sync(false);
    pop(bubBid, `Bid sent · ${inr(p.price)}`);
    say(
      `Sample bid of ${inr(p.price)} sent. You'd receive ${inr(p.net)} minus tax. No platform fee.`,
    );
  });

  /* ───────── brand face: sort with a manual FLIP, accept into escrow ───────── */
  const list = $("#sdBids"),
    sortBtns = $$(".sd-sb", root);
  const SORTS = {
    price: ["price", 1, "price, lowest first"],
    eng: ["eng", -1, "engagement, highest first"],
    fol: ["fol", -1, "followers, most first"],
  };
  sortBtns.forEach(b =>
    b.addEventListener("click", () => {
      const [key, dir, words] = SORTS[b.dataset.key];
      sortBtns.forEach(o => o.setAttribute("aria-pressed", o === b ? "true" : "false"));
      const rows = $$(".sd-row", list),
        first = new Map(rows.map(r => [r, r.getBoundingClientRect().top]));
      rows
        .slice()
        .sort((a, c) => dir * (+a.dataset[key] - +c.dataset[key]))
        .forEach(r => list.appendChild(r));
      if (motion) {
        G.killTweensOf(rows);
        rows.forEach(r => {
          const dy = first.get(r) - r.getBoundingClientRect().top;
          if (Math.abs(dy) < 1) return G.set(r, { clearProps: "transform,zIndex" });
          G.fromTo(
            r,
            { y: dy, scale: dy > 0 ? 1.035 : 0.985, zIndex: dy > 0 ? 3 : 1 },
            { y: 0, scale: 1, duration: 0.8, ease: "expo.out", clearProps: "transform,zIndex" },
          );
        });
      }
      say(`Sample bids sorted by ${words}. ${$(".sd-who b", list).textContent} is first.`);
    }),
  );

  function setAcc(b, on) {
    b.setAttribute("aria-pressed", on ? "true" : "false");
    b.closest(".sd-row").classList.toggle("sd-accd", on);
    const box = $(".sd-acc-t", b),
      old = box.lastElementChild,
      nu = document.createElement("span");
    nu.textContent = on ? `${inr(+b.dataset.price)} into escrow` : "Accept";
    if (!motion) {
      box.replaceChildren(nu);
      return;
    }
    const w0 = b.offsetWidth;
    box.appendChild(nu);
    if (old) Object.assign(old.style, { position: "absolute", left: 0, top: 0 });
    const w1 = b.offsetWidth;
    G.fromTo(b, { width: w0 }, { width: w1, duration: 0.55, ease: "expo.out", clearProps: "width" });
    G.fromTo(nu, { yPercent: 110 }, { yPercent: 0, duration: 0.55, ease: "expo.out" });
    old && G.to(old, { yPercent: -110, duration: 0.55, ease: "expo.out", onComplete: () => old.remove() });
  }
  $$(".sd-acc", root).forEach(b =>
    b.addEventListener("click", () => {
      const on = b.getAttribute("aria-pressed") !== "true";
      $$('.sd-acc[aria-pressed="true"]', root).forEach(o => {
        if (o !== b) setAcc(o, false);
      });
      setAcc(b, on);
      const price = inr(+b.dataset.price);
      if (on) {
        pop(bubEsc, `Escrow funded · ${price}`);
        say(
          `Sample: ${price} into escrow for ${b.dataset.name}. It is released only when you approve the work.`,
        );
      } else {
        bubEsc.classList.remove("sd-on");
        say(`Sample: bid from ${b.dataset.name} no longer accepted.`);
      }
    }),
  );

  /* ───────── scroll choreography (after core boot, so ScrollTrigger can measure) ───────── */
  if (!motion) return;
  LL.ready.push(() => {
    const ST = LL.ST,
      n = hls[0]._w.length,
      words = [...hls[0]._w, ...hls[1]._w];
    /* headline: P1 blur-rise, both copies in lockstep so the repaint edge always lines up */
    G.fromTo(
      words,
      { opacity: 0, yPercent: 30, filter: "blur(12.8px)" },
      {
        opacity: 1,
        yPercent: 0,
        filter: "blur(0px)",
        duration: 0.9,
        ease: "power2.out",
        stagger: i => (i % n) * 0.065,
        clearProps: "filter",
        scrollTrigger: { trigger: pin, start: "top 72%", once: true },
      },
    );
    G.fromTo(
      $$(".sd-eb0", pin),
      { opacity: 0, y: 10 },
      {
        opacity: 1,
        y: 0,
        duration: 0.8,
        ease: "power2.out",
        scrollTrigger: { trigger: pin, start: "top 72%", once: true },
      },
    );

    const mm = G.matchMedia(),
      hw = $$(".sd-hw", pin),
      fc = $(".sd-float-c", pin),
      fb = $(".sd-float-b", pin),
      vh = () => innerHeight;
    mm.add("(min-width:1001px)", () => {
      /* 170 timeline units = 170vh of pinned scroll: hold 30, the paper edge climbs for 100 (1:1 with the scroll), hold 40 */
      G.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: flip,
          start: "top top",
          end: "bottom bottom",
          scrub: true,
          invalidateOnRefresh: true,
        },
      })
        .fromTo(pin, { "--sd-e": 1 }, { "--sd-e": 0, duration: 100 }, 30)
        .fromTo(pin, { "--sd-m": 0 }, { "--sd-m": 1, duration: 60, ease: "power2.inOut" }, 50)
        .fromTo(hw, { scale: 1 }, { scale: 0.92, duration: 140 }, 30)
        .fromTo(
          fc,
          { y: () => vh() * 1.04, rotation: -12, xPercent: -16 },
          { y: () => -vh() * 0.9, rotation: 7, xPercent: 8, duration: 104 },
          16,
        )
        .fromTo(
          fb,
          { y: () => vh() * 1.1, rotation: 12, xPercent: 16 },
          { y: () => -vh() * 0.8, rotation: -7, xPercent: -8, duration: 104 },
          38,
        )
        .set({}, {}, 170);
    });
    mm.add("(max-width:1000px)", () => {
      G.timeline({
        defaults: { ease: "none" },
        scrollTrigger: { trigger: pin, start: "top 40%", end: "bottom 28%", scrub: true },
      })
        .fromTo(pin, { "--sd-e": 1 }, { "--sd-e": 0 })
        .fromTo(pin, { "--sd-m": 0 }, { "--sd-m": 1, ease: "power2.inOut" }, 0);
    });

    /* the stage rises in and the card drops onto it at a tilt */
    G.from(stage, {
      y: 90,
      duration: 1.3,
      ease: "expo.out",
      scrollTrigger: { trigger: stage, start: "top 94%", once: true },
    });
    G.from($(".sd-right", root), {
      y: -46,
      rotation: 7,
      opacity: 0,
      duration: 1.2,
      ease: "back.out(1.5)",
      delay: 0.25,
      scrollTrigger: { trigger: stage, start: "top 78%", once: true },
    });
    G.from($$(".sd-feats li", root), {
      x: -20,
      opacity: 0,
      duration: 0.8,
      stagger: 0.07,
      ease: "expo.out",
      delay: 0.2,
      scrollTrigger: { trigger: stage, start: "top 72%", once: true },
    });
    if (ST) ST.refresh();
  });
})();
