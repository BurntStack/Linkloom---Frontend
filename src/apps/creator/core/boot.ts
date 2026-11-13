/* boot: wires the static shell, then runs the first route. main.ts calls it once, after every screen has registered. */
import { today } from "./clock";
import { $, $$, esc } from "./dom";
import { icon, type IconName } from "./icons";
import { go, markBooted, route } from "./router";

export const boot = (): void => {
  markBooted();
  $$("[data-ic]").forEach(e => e.insertAdjacentHTML("afterbegin", icon(e.dataset.ic as IconName)));
  const clk = $("#clock");
  const tick = () => {
    if (!clk) return;
    let t = "";
    try {
      t = new Intl.DateTimeFormat("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Kolkata",
      }).format(today());
    } catch (e) {}
    clk.innerHTML = esc(t.replace(/\s?(am|pm)/i, m => " " + m.trim().toUpperCase())) + " <b>IST</b>";
  };
  tick();
  setInterval(tick, 30000);
  const sk = $("[data-skip]");
  sk &&
    sk.addEventListener("click", e => {
      e.preventDefault();
      const v = $("#view");
      v && v.focus();
    });
  document.addEventListener("click", e => {
    const a = (e.target as Element).closest<HTMLElement>("[data-go]");
    if (a) {
      e.preventDefault();
      go(a.dataset.go!);
    }
  });
  route();
};
