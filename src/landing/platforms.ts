// @ts-nocheck
/* part: platforms */
/* Platforms (pf-), v5: P8 flood rows, closed at rest; one drawer open at a time; format tabs morph the device frame.
   Briefs, names and prices are samples (the lede says so once). No payout maths here. */
(() => {
  const L = window.LL,
    root = document.getElementById("platforms");
  if (!L || !root) return;
  const { $, $$, RM, G, hasG, inr } = L;
  const anim = hasG && !RM;
  const DUR = 0.9;

  /* sample formats. Owner to replace the briefs and budgets with real typical asks. per = mock loop length in ms */
  const F = {
    reel: {
      name: "Reel",
      ratio: "9:16",
      per: 6000,
      price: 18000,
      line: "1 Reel · 30–⁠45 s · product in first 3 s",
      desc: "Vertical 9:16 video for the Reels tab and the feed.",
    },
    post: {
      name: "Post",
      ratio: "1:1",
      per: 9000,
      price: 12000,
      line: "1 carousel post · 3 slides · product on slide 1",
      desc: "A square 1:1 image or a swipeable carousel in the feed.",
    },
    story: {
      name: "Story",
      ratio: "9:16",
      per: 9000,
      price: 6000,
      line: "3-frame Story · link sticker on frame 3 · live for 24 h",
      desc: "Full-screen 9:16 frames that disappear after 24 hours.",
    },
    video: {
      name: "Video",
      ratio: "16:9",
      per: 10000,
      price: 45000,
      line: "4 min review · 60–⁠90 s integration at 0:42–⁠1:30",
      desc: "Long-form 16:9 video, with the brand segment as its own chapter.",
    },
    short: {
      name: "Short",
      ratio: "9:16",
      per: 8000,
      price: 15000,
      line: "1 Short · 30 s · hook in first 2 s",
      desc: "Vertical 9:16 video for the Shorts feed.",
    },
  };
  const num = r => {
    const [a, b] = r.split(":").map(Number);
    return a / b;
  };

  root.classList.add("pf-ready");
  if (!RM && "IntersectionObserver" in window) root.classList.add("pf-anim");

  /* marquee copy: two identical halves so the -50% loop is seamless; the icon is the only separator */
  const tracks = $$(".pf-track", root);
  tracks.forEach(tr => {
    const ico = `<img src="${tr.dataset.ico}" width="32" height="32" alt="">`;
    tr.innerHTML = tr.dataset.run
      .split("|")
      .map(w => `<span>${w}</span>${ico}`)
      .join("")
      .repeat(6);
  });
  const speeds = () =>
    tracks.forEach(tr => {
      const half = tr.scrollWidth / 2,
        fs = parseFloat(getComputedStyle(tr).fontSize) || 100;
      if (half) tr.style.setProperty("--pf-dur", (half / (fs * 1.35)).toFixed(2) + "s");
    });

  const items = $$(".pf-item", root).map(el => {
    const it = {
      el,
      btn: $(".pf-row", el),
      drawer: $(".pf-drawer", el),
      tabs: $$('[role="tab"]', el),
      ind: $(".pf-ind", el),
      panel: $('[role="tabpanel"]', el),
      stage: $(".pf-stage", el),
      device: $(".pf-device", el),
      guides: $$(".pf-guides i", el),
      mocks: $$(".pf-mock", el),
      notes: $$(".pf-note", el),
      fname: $(".pf-fname", el),
      desc: $(".pf-desc", el),
      bline: $(".pf-bline", el),
      pt: 0,
    };
    it.open = it.btn.getAttribute("aria-expanded") === "true";
    it.f = (it.tabs.find(t => t.getAttribute("aria-selected") === "true") || it.tabs[0]).dataset.f;
    return it;
  });

  /* a no-break space before each dot, so a wrapped line never starts with "·" */
  const fill = (it, d) => {
    it.fname.textContent = d.name;
    it.desc.textContent = d.desc;
    it.bline.textContent = `${d.line} · ${inr(d.price)}`.replace(/ · /g, " · ");
  };

  /* frame size for a ratio inside the stage */
  function dims(it, r) {
    const W = it.stage.clientWidth,
      H = it.stage.clientHeight;
    let w, h;
    if (r < 1) {
      h = Math.min(H * 0.94, (W * 0.9) / r);
      w = h * r;
    } else if (r === 1) {
      w = h = Math.min(H * 0.84, W * 0.86);
    } else {
      w = Math.min(W - 24, H * 0.86 * r);
      h = w / r;
    }
    return {
      w: Math.round(w),
      h: Math.round(h),
      rad: r < 1 ? Math.round(Math.min(44, w * 0.15)) : r === 1 ? 28 : 20,
    };
  }
  function layout(it, animate) {
    if (!it.stage.clientWidth) return;
    it.guides.forEach(g => {
      const d = dims(it, num(g.dataset.r));
      g.style.width = d.w + 22 + "px";
      g.style.height = d.h + 22 + "px";
      g.style.borderRadius = d.rad + 11 + "px";
    });
    const d = dims(it, num(F[it.f].ratio));
    if (animate && anim) {
      G.to(it.device, {
        width: d.w,
        height: d.h,
        "--pf-r": d.rad + "px",
        duration: DUR,
        ease: "expo.inOut",
        overwrite: "auto",
      });
    } else {
      if (hasG) G.killTweensOf(it.device, "width,height,--pf-r");
      it.device.style.width = d.w + "px";
      it.device.style.height = d.h + "px";
      it.device.style.setProperty("--pf-r", d.rad + "px");
    }
  }
  function moveInd(it) {
    const t = it.tabs.find(x => x.dataset.f === it.f);
    if (!t || !t.offsetWidth) return;
    it.ind.style.width = t.offsetWidth + "px";
    it.ind.style.transform = `translateX(${t.offsetLeft}px)`;
  }

  /* the shown mock plays exactly one loop, so it comes back to rest on its representative frame */
  function playOnce(it) {
    if (RM) return;
    clearTimeout(it.pt);
    it.mocks.forEach(m => m.classList.toggle("pf-play", m.dataset.f === it.f));
    it.pt = setTimeout(() => it.mocks.forEach(m => m.classList.remove("pf-play")), F[it.f].per);
    kick();
  }

  function setFormat(it, f, user) {
    const d = F[f];
    it.f = f;
    it.tabs.forEach(t => {
      const on = t.dataset.f === f;
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
    });
    it.panel.setAttribute("aria-labelledby", it.tabs.find(t => t.dataset.f === f).id);
    moveInd(it);
    it.mocks.forEach(m => m.classList.toggle("is-on", m.dataset.f === f));
    it.notes.forEach(n => n.classList.toggle("is-on", n.dataset.f === f));
    it.guides.forEach(g => g.classList.toggle("is-on", g.dataset.r === d.ratio));
    const r = num(d.ratio);
    it.device.dataset.shape = r < 1 ? "tall" : r === 1 ? "square" : "wide";
    layout(it, user);
    const parts = [it.fname, it.desc, it.bline];
    if (user && anim) {
      if (it.ttl) it.ttl.progress(1).kill();
      it.ttl = G.timeline()
        .to(parts, { autoAlpha: 0, y: -8, duration: 0.18, ease: "power2.in", stagger: 0.03 })
        .add(() => fill(it, d))
        .fromTo(
          parts,
          { y: 12 },
          { autoAlpha: 1, y: 0, duration: 0.55, ease: "expo.out", stagger: 0.05, clearProps: "transform" },
        );
    } else fill(it, d);
    if (user) playOnce(it);
  }

  /* one drawer open at a time; the clicked row stays put while the other drawer collapses */
  const scrollByPx = dy => {
    const ln = L.lenis,
      y = window.scrollY + dy;
    if (ln) ln.scrollTo(y, { immediate: true, force: true });
    if (Math.abs(window.scrollY - y) > 1) window.scrollTo(0, y);
  };
  let anchorTw = null;
  const settle = () => {
    if (L.lenis && L.lenis.resize) L.lenis.resize();
    if (hasG) L.ST.refresh();
  };

  function apply(target, anchor) {
    const top0 = anchor.getBoundingClientRect().top;
    items.forEach(x => {
      x.open = x === target;
      x.btn.setAttribute("aria-expanded", x.open ? "true" : "false");
      if (!x.open) {
        clearTimeout(x.pt);
        x.mocks.forEach(m => m.classList.remove("pf-play"));
      }
    });
    let hT = 0;
    if (target) {
      if (target.drawer.hidden) {
        target.drawer.hidden = false;
        if (anim) target.drawer.style.height = "0px";
      }
      layout(target, false);
      moveInd(target);
      hT = target.drawer.scrollHeight;
      playOnce(target);
    }
    /* where the clicked row should end up: keep it still, but bring a tall drawer into view */
    const vh = innerHeight,
      need = anchor.offsetHeight + hT;
    let tTop = top0;
    if (target && top0 + need > vh - 24) tTop = Math.min(top0, Math.max(88, vh - 24 - need));
    if (target && top0 < 72) tTop = 88;

    if (!anim) {
      items.forEach(x => {
        x.drawer.hidden = !x.open;
        x.drawer.style.height = "";
      });
      const dy = anchor.getBoundingClientRect().top - tTop;
      if (Math.abs(dy) > 1) scrollByPx(dy);
      settle();
      return;
    }
    items.forEach(x => {
      const dr = x.drawer;
      if (x.open) {
        G.to(dr, {
          height: hT,
          duration: DUR,
          ease: "expo.inOut",
          overwrite: true,
          onComplete: () => {
            dr.style.height = "";
          },
        });
      } else if (!dr.hidden) {
        G.to(dr, {
          height: 0,
          duration: DUR,
          ease: "expo.inOut",
          overwrite: true,
          onComplete: () => {
            dr.hidden = true;
            dr.style.height = "";
          },
        });
      }
    });
    if (target) {
      const inner = [...$$(".pf-side > *", target.drawer), target.device];
      G.fromTo(
        inner,
        { y: 48 },
        {
          y: 0,
          duration: 1,
          ease: "expo.out",
          stagger: 0.06,
          delay: 0.22,
          overwrite: "auto",
          clearProps: "transform",
        },
      );
    }
    /* created last, so it runs after the height tweens in the same tick */
    if (anchorTw) anchorTw.kill();
    const ez = G.parseEase("expo.inOut");
    anchorTw = G.to(
      {},
      {
        duration: DUR,
        ease: "none",
        onUpdate() {
          const want = top0 + (tTop - top0) * ez(this.progress());
          const dy = anchor.getBoundingClientRect().top - want;
          if (Math.abs(dy) > 0.5) scrollByPx(dy);
        },
        onComplete: () => {
          anchorTw = null;
          settle();
        },
      },
    );
  }

  /* the video timecode and chapter follow the playhead, only while that mock is playing */
  const ytIt = items.find(x => x.el.dataset.pf === "yt");
  const tcEl = $("[data-tc]", root),
    chEl = $("[data-chn]", root),
    ph = $(".pf-ph", root);
  const vMock = ytIt && ytIt.mocks.find(m => m.dataset.f === "video");
  const mmss = s => Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");
  let raf = 0,
    lastTc = "";
  const playing = () =>
    ytIt &&
    ytIt.open &&
    ytIt.f === "video" &&
    (vMock.classList.contains("pf-play") || ytIt.stage.matches(":hover"));
  function tick() {
    raf = 0;
    const a = ph && ph.getAnimations && ph.getAnimations()[0];
    const pr = a && a.effect && a.effect.getComputedTiming().progress;
    if (pr != null) {
      const pos = 8 + 38 * pr,
        tc = mmss((pos / 100) * 252);
      if (tc !== lastTc) {
        tcEl.textContent = tc;
        chEl.textContent =
          pos < 16.67 ? "Intro" : pos < 35.71 ? "Brand segment" : pos < 75.4 ? "Review" : "Outro";
        lastTc = tc;
      }
    }
    if (playing()) raf = requestAnimationFrame(tick);
  }
  function kick() {
    if (!RM && !raf && ytIt && ph) raf = requestAnimationFrame(tick);
  }

  /* wiring */
  items.forEach(it => {
    fill(it, F[it.f]);
    it.btn.addEventListener("click", () => apply(it.open ? null : it, it.btn));
    it.btn.addEventListener("pointermove", e => {
      if (e.pointerType === "mouse") it.btn.classList.add("pf-hov");
    });
    it.btn.addEventListener("pointerleave", () => it.btn.classList.remove("pf-hov"));
    it.stage.addEventListener("pointerenter", kick);
    it.tabs.forEach((t, i) => {
      t.addEventListener("click", () => {
        if (t.dataset.f !== it.f) setFormat(it, t.dataset.f, true);
      });
      t.addEventListener("keydown", e => {
        const n = it.tabs.length;
        const j =
          e.key === "ArrowRight"
            ? (i + 1) % n
            : e.key === "ArrowLeft"
              ? (i - 1 + n) % n
              : e.key === "Home"
                ? 0
                : e.key === "End"
                  ? n - 1
                  : -1;
        if (j < 0) return;
        e.preventDefault();
        it.tabs[j].focus();
        if (it.tabs[j].dataset.f !== it.f) setFormat(it, it.tabs[j].dataset.f, true);
      });
    });
    if (!it.drawer.hidden) {
      layout(it, false);
      moveInd(it);
    }
  });

  /* the one body entrance: rows enter together (staggered in CSS) as the first row comes in */
  if ("IntersectionObserver" in window) {
    const rows = $(".pf-rows", root);
    const io = new IntersectionObserver(
      es =>
        es.forEach(e => {
          if (!e.isIntersecting) return;
          rows.classList.add("pf-seen");
          items.forEach(it => it.el.classList.add("pf-seen"));
          io.disconnect();
        }),
      { threshold: 0.3, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(items[0].btn);
  } else items.forEach(it => it.el.classList.add("pf-seen"));

  const remeasure = () => {
    items.forEach(it => {
      if (!it.drawer.hidden) {
        layout(it, false);
        moveInd(it);
      }
    });
    speeds();
  };
  let rz = 0;
  addEventListener("resize", () => {
    clearTimeout(rz);
    rz = setTimeout(remeasure, 120);
  });
  L.ready.push(remeasure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(remeasure);
})();
