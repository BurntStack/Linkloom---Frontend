// @ts-nocheck
/* part: cta */
/* cta (ct-): the finale. One scrubbed move: the rings slide along "Start weaving." and link; the ripple runs once, then holds. */
(() => {
  const LL = window.LL;
  if (!LL) return;
  const { G, hasG, RM, $, $$ } = LL;
  const root = $("#start");
  if (!root) return;
  const back = $(".ct-back", root),
    front = $(".ct-front", root),
    hw = $(".ct-hwrap", root),
    foot = $("[data-ct-in]", root);
  /* the front copy is the same rings, clipped below the cut line (see cta.css) */
  if (back && front) front.innerHTML = back.innerHTML;
  const anim = hasG && !RM;

  /* ripple: the hero's stripe shader in its radial mode, very faint, frozen except while the rings link */
  const cv = $(".ct-bg", root);
  const sh =
    cv && window.hxStripes
      ? window.hxStripes(cv, {
          watch: root,
          step: 0.04,
          u: { mode: 1, amp: 0.15, zoom: 8.5, sheen: 0.4, intro: anim ? 1 : 0, hold: true },
          onLost: () => cv.remove(),
        })
      : null;
  if (!sh && cv) cv.remove();
  const centre = () => {
    /* centre the ripple on the rings, in shader units */
    if (!sh || !hw) return;
    const c = cv.getBoundingClientRect(),
      a = hw.getBoundingClientRect();
    if (!c.height) return;
    const xc = (a.left + a.width / 2 - c.left) / c.width,
      yc = (a.top + a.height / 2 - c.top) / c.height;
    sh.u.cx = (xc - 0.5) * (c.width / c.height) * sh.u.zoom;
    sh.u.cy = (0.5 - yc) * sh.u.zoom;
    if (sh.u.hold) sh.draw();
  };
  centre();
  addEventListener("resize", centre, { passive: true });
  document.fonts && document.fonts.ready.then(centre);

  if (!anim) return; /* reduced motion: rings rest linked, the ripple is one still frame */
  G.set(foot, { opacity: 0, y: 24 });

  const knots = $$(".ct-knot", root);
  let linked = false;
  const setLinked = on => {
    if (on === linked) return;
    linked = on;
    if (on)
      G.fromTo(
        knots,
        { scale: 1 },
        { scale: 1.035, duration: 0.22, ease: "power2.out", yoyo: true, repeat: 1, overwrite: "auto" },
      );
    if (sh) {
      sh.u.hold = false;
      G.to(
        sh.u,
        on
          ? {
              intro: 0,
              duration: 2.4,
              ease: "power3.out",
              overwrite: true,
              onComplete: () => {
                sh.u.hold = true;
              },
            }
          : {
              intro: 1,
              duration: 0.7,
              ease: "power2.in",
              overwrite: true,
              onComplete: () => {
                sh.u.hold = true;
              },
            },
      );
    }
  };

  LL.ready.push(() => {
    const rcs = $$(".ct-rc", root),
      rvs = $$(".ct-rv", root);
    const dist = () => Math.min(innerWidth * 0.36, 520);
    /* scrubbed inside the section's own height: the rings travel in from the ends of the line and lock at the centre */
    const tl = G.timeline({
      onUpdate() {
        setLinked(this.progress() > 0.985);
      },
      scrollTrigger: {
        trigger: root,
        start: "top 85%",
        end: "center center",
        scrub: 0.8,
        invalidateOnRefresh: true,
      },
    });
    tl.fromTo(rcs, { x: () => -dist() }, { x: 0, ease: "power2.inOut" }, 0).fromTo(
      rvs,
      { x: () => dist() },
      { x: 0, ease: "power2.inOut" },
      0,
    );
    G.to(foot, {
      opacity: 1,
      y: 0,
      duration: 1.1,
      ease: "expo.out",
      scrollTrigger: { trigger: foot, start: "top 94%", once: true },
    });
  });
})();
