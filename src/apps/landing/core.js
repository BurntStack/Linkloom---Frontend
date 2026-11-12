// @ts-nocheck
/* v4 core: shared runtime for every section part. Parts read helpers from window.LL. */
(() => {
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const G = window.gsap,
    ST = window.ScrollTrigger,
    hasG = !!(G && ST);
  if (hasG) G.registerPlugin(ST);
  const $ = (s, c = document) => c.querySelector(s),
    $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const fine = matchMedia("(pointer:fine)").matches;
  document.documentElement.classList.add("js");

  /* money helpers. Linkloom runs on subscriptions: no per-deal platform fee. */
  const FEE_RATE = 0;
  const inr = n => "₹" + Math.round(n).toLocaleString("en-IN");
  const payout = price => {
    const p = Math.max(0, Math.round(+price || 0)),
      fee = Math.round(p * FEE_RATE);
    return { price: p, fee, net: p - fee };
  };

  /* smooth scroll (funkhaus uses lerp .07) */
  let lenis = null;
  if (!RM && window.Lenis) {
    lenis = new Lenis({ lerp: 0.07 });
    if (hasG) {
      lenis.on("scroll", ST.update);
      G.ticker.add(t => lenis.raf(t * 1000));
      G.ticker.lagSmoothing(0);
    } else {
      const r = t => {
        lenis.raf(t);
        requestAnimationFrame(r);
      };
      requestAnimationFrame(r);
    }
  }
  const scrollTo = el => {
    if (!el) return;
    lenis ? lenis.scrollTo(el, { duration: 1.3 }) : el.scrollIntoView({ behavior: RM ? "auto" : "smooth" });
  };

  /* side picking: any [data-pick-side] link tells the Two sides section which face to show */
  const pickers = [];
  const onPickSide = fn => pickers.push(fn);
  const pickSide = side =>
    pickers.forEach(fn => {
      try {
        fn(side);
      } catch (e) {}
    });

  document.addEventListener("click", e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute("href"),
      el = id === "#top" ? document.body : $(id);
    if (!el) return;
    e.preventDefault();
    if (a.dataset.pickSide) pickSide(a.dataset.pickSide);
    scrollTo(el);
  });

  /* 6 s motion loops play only while on screen (keyframes live in figma-base.css) */
  const io = new IntersectionObserver(
    es => es.forEach(e => e.target.classList.toggle("play", e.isIntersecting)),
    { threshold: 0.3 },
  );
  const watchMotion = (root = document) => $$("[data-motion]", root).forEach(el => io.observe(el));

  /* funkhaus P1 split + blur-rise reveal */
  function splitWords(el) {
    if (el._w) return el._w;
    el.setAttribute("aria-label", el.textContent.replace(/\s+/g, " ").trim());
    const words = [];
    (function walk(node) {
      [...node.childNodes].forEach(n => {
        if (n.nodeType === 3) {
          const f = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) return f.append(part);
            const s = document.createElement("span");
            s.className = "w";
            s.setAttribute("aria-hidden", "true");
            s.textContent = part;
            words.push(s);
            f.append(s);
          });
          n.replaceWith(f);
        } else if (n.nodeType === 1 && n.tagName !== "BR") walk(n);
      });
    })(el);
    el.classList.add("is-split");
    el._w = words;
    return words;
  }
  function reveal(el, opts = {}) {
    const w = splitWords(el);
    if (!hasG || RM) return;
    const many = w.length > 20;
    G.fromTo(
      w,
      { opacity: 0, yPercent: 30, filter: `blur(${many ? 6 : 12.8}px)` },
      {
        opacity: 1,
        yPercent: 0,
        filter: "blur(0px)",
        duration: 0.8,
        ease: "power2.out",
        stagger: { each: many ? 0.02 : 0.06 },
        delay: opts.delay || 0,
        scrollTrigger: opts.now ? undefined : { trigger: el, start: "top 90%", once: true },
        clearProps: "filter",
      },
    );
  }

  /* Family-style chip morph: old label slides up, new label slides in */
  function morphChip(chip, text) {
    const old = chip.lastElementChild,
      nu = document.createElement("span");
    nu.textContent = text;
    chip.appendChild(nu);
    if (!hasG || RM) {
      old && old !== nu && old.remove();
      return;
    }
    G.fromTo(nu, { yPercent: 110 }, { yPercent: 0, duration: 0.5, ease: "expo.out" });
    old && G.to(old, { yPercent: -110, duration: 0.5, ease: "expo.out", onComplete: () => old.remove() });
  }

  /* funkhaus P11 cursor */
  function cursor() {
    if (!fine || !hasG || RM) return;
    const el = $(".ll-cur");
    if (!el) return;
    document.documentElement.classList.add("has-cursor");
    const inner = el.firstElementChild,
      txt = $(".ll-cur-txt", el),
      pos = { x: -100, y: -100 },
      prev = { x: -100, y: -100 };
    addEventListener(
      "pointermove",
      e => G.to(pos, { x: e.clientX, y: e.clientY, duration: 0.55, ease: "expo.out", overwrite: true }),
      { passive: true },
    );
    G.ticker.add(() => {
      const vx = pos.x - prev.x,
        vy = pos.y - prev.y;
      prev.x = pos.x;
      prev.y = pos.y;
      const s = Math.min(Math.hypot(vx, vy) * 0.001, 0.15) * (el.classList.contains("is-text") ? 2 : 3),
        a = Math.atan2(vy, vx) * 57.2958;
      G.set(el, { x: pos.x, y: pos.y, rotation: a, scaleX: 1 + s, scaleY: 1 - s });
      G.set(inner, { rotation: -a });
    });
    document.addEventListener("pointerover", e => {
      const lab = e.target.closest("[data-cursor]"),
        link = e.target.closest('a,button,input,label,[role="tab"],[role="radio"]');
      el.classList.toggle("is-text", !!lab);
      el.classList.toggle("is-link", !lab && !!link);
      if (lab) txt.textContent = lab.dataset.cursor;
    });
    addEventListener("pointerdown", () => el.classList.add("is-down"));
    addEventListener("pointerup", () => el.classList.remove("is-down"));
    document.addEventListener("pointerleave", () => G.to(el, { opacity: 0, duration: 0.3 }));
    document.addEventListener("pointerenter", () => G.to(el, { opacity: 1, duration: 0.3 }));
  }

  /* frosted header: light mode over [data-hdr="light"] sections, hides on scroll down, IST greeting pill */
  function header() {
    const hdr = $("#hdr");
    if (!hdr) return;
    const lights = $$('[data-hdr="light"]');
    let lastY = scrollY;
    const check = () => {
      const y = scrollY,
        probe = 40;
      hdr.classList.toggle(
        "is-light",
        lights.some(s => {
          const r = s.getBoundingClientRect();
          return r.top <= probe && r.bottom > probe;
        }),
      );
      if (Math.abs(y - lastY) > 8) {
        hdr.classList.toggle("is-hidden", y > lastY && y > 400);
        lastY = y;
      }
      const wmk = document.querySelector(".wordmark");
      if (wmk) hdr.classList.toggle("at-end", wmk.getBoundingClientRect().top < innerHeight * 0.9);
    };
    addEventListener("scroll", check, { passive: true });
    lenis && lenis.on("scroll", check);
    check();
    const g = $("#greet"),
      box = $(".hgreet");
    if (g && box) {
      let h = 12;
      try {
        h = +new Intl.DateTimeFormat("en-GB", {
          hour: "numeric",
          hour12: false,
          timeZone: "Asia/Kolkata",
        }).format(new Date());
      } catch (e) {}
      const word =
        h < 5
          ? "Up late"
          : h < 12
            ? "Good morning"
            : h < 17
              ? "Good afternoon"
              : h < 21
                ? "Good evening"
                : "Up late";
      g.innerHTML = `${word} from <b>India</b>`;
      if (hasG && !RM && getComputedStyle(box).display !== "none") {
        const w = g.offsetWidth + 40;
        G.timeline({ delay: 3, repeat: 1, yoyo: true, repeatDelay: 4 })
          .fromTo(box, { width: 0 }, { width: w, duration: 1.5, ease: "power4.inOut" })
          .fromTo(g, { opacity: 0 }, { opacity: 1, duration: 1.5, ease: "power4.inOut" }, "<");
      }
    }
  }

  /* wraps .lq labels so markup can be <a class="lq lq-p">Label</a> */
  function liquid(root = document) {
    $$(".lq", root).forEach(b => {
      if (b.querySelector(".t")) return;
      const label = b.innerHTML.trim();
      b.innerHTML = `<span class="t">${label}</span><span class="t2" aria-hidden="true">${label}</span>`;
    });
  }

  const ready = [];
  window.LL = {
    RM,
    G,
    ST,
    hasG,
    fine,
    $,
    $$,
    inr,
    payout,
    FEE_RATE,
    get lenis() {
      return lenis;
    },
    scrollTo,
    onPickSide,
    pickSide,
    splitWords,
    reveal,
    morphChip,
    watchMotion,
    liquid,
    ready,
  };
  window.LL.boot = () => {
    liquid();
    watchMotion();
    header();
    cursor();
    $$("[data-reveal]").forEach(el => {
      if (!el.classList.contains("is-split"))
        reveal(el, { now: el.dataset.reveal === "now", delay: +(el.dataset.revealDelay || 0) });
    });
    ready.forEach(fn => {
      try {
        fn();
      } catch (e) {
        console.error(e);
      }
    });
    if (hasG) document.fonts && document.fonts.ready.then(() => ST.refresh());
  };
})();
