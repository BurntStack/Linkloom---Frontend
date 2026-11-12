// @ts-nocheck
/* footer (frozen) */
/* FOOTER (frozen): logic copied unchanged from the Figma build. Do not edit. */
(() => {
  const { $, $$, G, ST, hasG, RM } = window.LL;
  /* newsletter field: validates, then hands the request to the visitor's mail app */
  $("#subForm").addEventListener("submit", e => {
    e.preventDefault();
    const v = $("#subEmail").value.trim(),
      m = $("#fmsg");
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    /* there is no newsletter service yet: the request goes to the team by email, from the visitor's own mail app */
    m.textContent = ok ? "Your mail app is opening with the request. Send it and we'll add you." : "Enter an email address like name@example.com.";
    if (ok)
      location.href = `mailto:support@linkloom.in?subject=${encodeURIComponent("Add me to Linkloom updates")}&body=${encodeURIComponent("Please add " + v + " to Linkloom's updates.")}`;
  });
  /* live India time */
  const clock = $("#clock");
  const fmt = new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
  const tick = () => {
    if (!clock) return;
    try {
      clock.textContent =
        fmt.format(new Date()).replace(/\s?(am|pm)/i, m => " " + m.trim().toUpperCase()) + " IST";
    } catch (e) {}
  };
  tick();
  setInterval(tick, 15000);
  if (!hasG || RM) return;
  /* footer: the wordmark rises letter by letter and the two o's link up */
  const wm = $$(".wordmark .ch");
  const tl = G.timeline({ scrollTrigger: { trigger: ".wordmark", start: "top 85%" } });
  tl.from(
    wm.filter(c => !c.classList.contains("o1") && !c.classList.contains("o2")),
    { yPercent: 105, duration: 1.1, stagger: 0.05, ease: "expo.out" },
  )
    .from(
      ".wordmark .o1",
      { xPercent: -60, yPercent: 105, rotation: -120, duration: 1.3, ease: "expo.out" },
      0.15,
    )
    .from(
      ".wordmark .o2",
      { xPercent: 60, yPercent: 105, rotation: 120, duration: 1.3, ease: "expo.out" },
      0.2,
    );
  G.from(".bento > *", {
    y: 50,
    opacity: 0.15,
    duration: 1.1,
    stagger: 0.08,
    ease: "expo.out",
    scrollTrigger: { trigger: ".bento", start: "top 90%" },
  });
})();
