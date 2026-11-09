/* Shared sign-in page: pick a side, sign in, and the chosen colour carries you into that dashboard. */
import "./signin.css";
import { gsap } from "../vendor-gsap";
import { type Role } from "./handoff";
import { attachGoogle } from "../api/google";
import { authMessage, completeSignup, destinationOf, fetchMe, googleSignIn, requestOtp, verifyOtp } from "../api/auth";
import { clearAuth, isSignedIn, type ApiUser } from "../api/client";

const $ = <T extends Element = HTMLElement>(s: string): T => document.querySelector<T>(s)!;
const esc = (v: unknown): string =>
  String(v ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
const $$ = <T extends Element = HTMLElement>(s: string): T[] => [...document.querySelectorAll<T>(s)];

const G = matchMedia("(prefers-reduced-motion: reduce)").matches ? null : gsap;
const q = new URLSearchParams(location.search);

const COPY: Record<Role, { eyebrow: string; sub: string; btn: string; dash: string; forgot: string; join: string; joinT: string; hello: string }> = {
  creator: {
    eyebrow: "For creators",
    sub: "Bid on brand briefs, do the work, and get paid from escrow the day they approve.",
    btn: "Sign in as a creator",
    dash: "app.html#home",
    forgot: "app.html#login",
    join: "app.html#login",
    joinT: "Create a creator account",
    hello: "Opening your creator dashboard",
  },
  brand: {
    eyebrow: "For brands",
    sub: "Find creators, post a brief, and pay into escrow. Money moves only when you approve the work.",
    btn: "Sign in as a brand",
    dash: "brand.html#home",
    forgot: "brand.html#forgot",
    join: "brand.html#signup",
    joinT: "Create a brand account",
    hello: "Opening your brand dashboard",
  },
};
let role: Role = q.get("role") === "brand" ? "brand" : "creator";

/* IST clock, same as the dashboards */
const clk = $("#clock");
const tick = (): void => {
  try {
    clk.innerHTML =
      new Intl.DateTimeFormat("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Kolkata",
      })
        .format(new Date())
        .replace(/\s?(am|pm)/i, m => " " + m.trim().toUpperCase()) + " <b>IST</b>";
  } catch {
    /* the clock is decoration: leave it empty */
  }
};
tick();
setInterval(tick, 30000);

/* the butter thread: a running stitch that draws across the rings and pulls through */
const thread = $<SVGPathElement>("#thread");
const len = thread.getTotalLength();
const stitch = (): void => {
  if (!G) return;
  G.killTweensOf(thread);
  G.set(thread, { opacity: 1, strokeDasharray: `${len}`, strokeDashoffset: len });
  G.timeline()
    .to(thread, { strokeDashoffset: 0, duration: 0.9, ease: "power2.inOut" })
    .set(thread, { strokeDasharray: "4 7" })
    .to(thread, { strokeDashoffset: -44, opacity: 0, duration: 0.7, ease: "power2.in" });
};

/* role: copy, colours, links; the chosen ring steps forward and the butter thread re-stitches */
const setRole = (r: Role, animate: boolean): void => {
  role = r;
  document.body.dataset.role = r;
  const c = COPY[r];
  $$(".seg button").forEach(b => b.setAttribute("aria-checked", String(b.dataset.role === r)));
  $("#eyebrow").textContent = c.eyebrow;
  $("#joinA").textContent = r === "brand" ? "brand account" : "creator account";
  const sub = $("#sub");
  if (G && animate) {
    G.to(sub, {
      opacity: 0,
      y: 6,
      duration: 0.18,
      ease: "power2.in",
      onComplete: () => {
        sub.textContent = c.sub;
        G.to(sub, { opacity: 1, y: 0, duration: 0.36, ease: "power3.out" });
      },
    });
    const fwd = r === "creator" ? ["#gC", "#gCw"] : ["#gB"];
    const back = r === "creator" ? ["#gB"] : ["#gC", "#gCw"];
    G.fromTo(fwd, { scale: 0.97 }, { scale: 1.03, duration: 0.5, ease: "back.out(2.2)", yoyo: true, repeat: 1, repeatDelay: 0.05 });
    G.to(back, { scale: 0.99, duration: 0.4, ease: "power2.out", yoyo: true, repeat: 1 });
    stitch();
  } else sub.textContent = c.sub;
};
$$(".seg button").forEach(b => {
  b.addEventListener("click", () => setRole(b.dataset.role as Role, true));
  b.addEventListener("keydown", e => {
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
      e.preventDefault();
      const n: Role = role === "creator" ? "brand" : "creator";
      setRole(n, true);
      $(`.seg button[data-role="${n}"]`).focus();
    }
  });
});

/* idle: the rings breathe a little, never more than a few pixels */
if (G) {
  G.from("#rings", { opacity: 0, scale: 0.94, duration: 1.1, ease: "power3.out" });
  G.from(["#gC", "#gCw"], { x: -60, duration: 1.3, ease: "power3.out" });
  G.from("#gB", { x: 60, duration: 1.3, ease: "power3.out" });
  G.from([".eyebrow", ".h1", ".sub"], { y: 18, opacity: 0, duration: 0.8, stagger: 0.08, ease: "power3.out", delay: 0.2 });
  G.from(".card > *", { y: 12, opacity: 0, duration: 0.6, stagger: 0.04, ease: "power3.out", delay: 0.25 });
  G.to(["#gC", "#gCw"], { x: -5, duration: 3.6, ease: "sine.inOut", yoyo: true, repeat: -1, delay: 1.4 });
  G.to("#gB", { x: 5, duration: 3.6, ease: "sine.inOut", yoyo: true, repeat: -1, delay: 1.4 });
  setTimeout(stitch, 900);
}

/* ---------- sign in: email or mobile → one-time code, or Google ---------- */
const idInput = $<HTMLInputElement>("#email");
const codeInput = $<HTMLInputElement>("#pw");
const idField = $("#idField");
const codeField = $("#codeField");
const goBtn = $<HTMLButtonElement>("#go");
const goLabel = $("#goL");
const changeBtn = $<HTMLButtonElement>("#forgot");
const codeHelp = $("#codeHelp");
const remember = (): boolean => $<HTMLInputElement>("#remember").checked;

let step: "id" | "code" | "signup" = "id";
let challengeId = "";
let dest: ReturnType<typeof destinationOf> = null;
let cooldownEnd = 0;
let cooldownTimer = 0;
let busy = false;

const setErr = (el: HTMLInputElement, errId: string, msg: string): void => {
  $("#" + errId).textContent = msg;
  el.setAttribute("aria-invalid", String(!!msg));
};
const shake = (): void => {
  if (G) G.fromTo(".card form", { x: -6 }, { x: 0, duration: 0.45, ease: "elastic.out(1,.35)" });
};
const setBusy = (on: boolean, label?: string): void => {
  busy = on;
  goBtn.disabled = on;
  goBtn.setAttribute("aria-busy", String(on));
  if (label) goLabel.textContent = label;
};
const pretty = (d: NonNullable<ReturnType<typeof destinationOf>>): string =>
  d.channel === "sms" ? "+91 " + d.destination.slice(0, 5) + " " + d.destination.slice(5) : d.destination;

function paintResend(): void {
  clearInterval(cooldownTimer);
  const draw = (): void => {
    const left = Math.ceil((cooldownEnd - Date.now()) / 1000);
    if (left > 0) codeHelp.innerHTML = `Sent to <b>${esc(pretty(dest!))}</b>. You can ask for a new code in ${left} s.`;
    else {
      clearInterval(cooldownTimer);
      codeHelp.innerHTML = `Sent to <b>${esc(pretty(dest!))}</b>. Didn't get it? <button class="link" type="button" id="resend">Send a new code</button>`;
      $("#resend").addEventListener("click", () => void sendCode(true));
    }
  };
  draw();
  cooldownTimer = window.setInterval(draw, 1000);
}

function showStep(next: typeof step): void {
  step = next;
  idField.hidden = next !== "id";
  codeField.hidden = next !== "code";
  changeBtn.hidden = next !== "code";
  $("#form").hidden = next === "signup";
  $("#google").hidden = next !== "id";
  $("#signup").hidden = next !== "signup";
  goLabel.textContent = next === "code" ? "Verify and sign in" : "Send code";
  if (next === "code") codeInput.focus();
  if (next === "id") {
    clearInterval(cooldownTimer);
    idInput.focus();
  }
}

async function sendCode(resend = false): Promise<void> {
  if (!dest || busy) return;
  setBusy(true, resend ? "Sending a new code…" : "Sending code…");
  try {
    const ch = await requestOtp(dest.channel, dest.destination);
    challengeId = ch.challengeId;
    cooldownEnd = Date.now() + 30000;
    codeInput.value = "";
    setErr(codeInput, "pwErr", "");
    showStep("code");
    paintResend();
  } catch (e) {
    if (step === "code") setErr(codeInput, "pwErr", authMessage(e));
    else setErr(idInput, "emailErr", authMessage(e));
    shake();
  } finally {
    setBusy(false, step === "code" ? "Verify and sign in" : "Send code");
  }
}

changeBtn.addEventListener("click", () => {
  challengeId = "";
  showStep("id");
});
idInput.addEventListener("input", () => setErr(idInput, "emailErr", ""));
codeInput.addEventListener("input", () => {
  codeInput.value = codeInput.value.replace(/\D/g, "").slice(0, 6);
  setErr(codeInput, "pwErr", "");
  if (codeInput.value.length === 6) $<HTMLFormElement>("#form").requestSubmit();
});

$("#form").addEventListener("submit", async e => {
  e.preventDefault();
  if (busy) return;
  if (step === "id") {
    const v = idInput.value;
    dest = destinationOf(v);
    if (!dest) {
      setErr(
        idInput,
        "emailErr",
        !v.trim()
          ? "Enter your email or mobile number."
          : /^\+?[\d\s()-]+$/.test(v.trim())
            ? "Enter a 10-digit Indian mobile number, like 98765 43210."
            : "That email looks incomplete, for example you@brand.in.",
      );
      idInput.focus();
      shake();
      return;
    }
    await sendCode();
    return;
  }
  if (step === "code") {
    if (!/^\d{6}$/.test(codeInput.value)) {
      setErr(codeInput, "pwErr", "Enter the 6-digit code we sent you.");
      codeInput.focus();
      shake();
      return;
    }
    setBusy(true, "Checking…");
    try {
      const user = await verifyOtp(challengeId, codeInput.value, remember());
      await afterSignIn(user);
    } catch (err) {
      setErr(codeInput, "pwErr", authMessage(err));
      codeInput.select();
      shake();
      setBusy(false, "Verify and sign in");
    }
  }
});

/* Google: Google's own button sits invisibly over the designed one */
attachGoogle(
  $("#googleBtn"),
  async token => {
    $("#googleErr").textContent = "";
    try {
      const user = await googleSignIn(token, role, remember());
      await afterSignIn(user);
    } catch (err) {
      $("#googleErr").textContent = authMessage(err);
    }
  },
  msg => ($("#googleErr").textContent = msg),
);

/* ---------- after sign-in: finish sign-up if needed, then open the right dashboard ---------- */
async function afterSignIn(user: ApiUser): Promise<void> {
  if (user.needsOnboarding || !user.role) {
    showSignup(user);
    return;
  }
  open(user.role);
}

function open(r: Role): void {
  /* An account keeps the side it signed up on, whichever tab is selected here. */
  if (r !== role) setRole(r, false);
  handoff(COPY[r].dash);
}

function showSignup(user: ApiUser): void {
  const r = (user.role as Role | null) || role;
  const box = $("#signup");
  const brand = r === "brand";
  box.innerHTML = `<form id="signupForm" novalidate>
      <p class="help">Welcome to Linkloom. Two details and you're in.</p>
      <div class="field"><label for="suName">Your full name</label>
        <div class="in"><input id="suName" autocomplete="name" value="${esc(String(user.fullName || ""))}" placeholder="${brand ? "Meera Kapoor" : "Your name"}" aria-describedby="suNameErr"></div>
        <p class="err" id="suNameErr"></p></div>
      <div class="field"><label for="suOther">${brand ? "Brand name" : "Name brands will see"}</label>
        <div class="in"><input id="suOther" autocomplete="${brand ? "organization" : "nickname"}" placeholder="${brand ? "Your brand" : "Your creator name"}" aria-describedby="suOtherErr"></div>
        <p class="err" id="suOtherErr"></p></div>
      <p class="err" id="suErr" aria-live="assertive"></p>
      <button class="lq" type="submit" id="suGo"><span>${brand ? "Create brand account" : "Create creator account"}</span></button>
    </form>`;
  showStep("signup");
  $("#formH").textContent = brand ? "Set up your brand" : "Set up your account";
  const name = $<HTMLInputElement>("#suName"),
    other = $<HTMLInputElement>("#suOther");
  name.focus();
  $("#signupForm").addEventListener("submit", async e => {
    e.preventDefault();
    const n = name.value.trim(),
      o = other.value.trim();
    setErr(name, "suNameErr", n.length < 2 ? "Enter your full name." : "");
    setErr(other, "suOtherErr", o.length < 2 ? (brand ? "Enter your brand name." : "Enter the name brands will see.") : "");
    if (n.length < 2 || o.length < 2) return;
    const b = $<HTMLButtonElement>("#suGo");
    b.disabled = true;
    $("#suErr").textContent = "";
    try {
      const u = await completeSignup({ role: r, fullName: n, ...(brand ? { brandName: o } : { displayName: o }) });
      setRole((u.role as Role) || r, false);
      /* new creators fill in their profile next; new brands finish their brand profile */
      handoff(r === "brand" ? "brand.html#setup" : "app.html#setup");
    } catch (err) {
      b.disabled = false;
      $("#suErr").textContent = authMessage(err);
    }
  });
}

/* hand-off: the rings slide together and lock, the chosen colour weaves up, then the dashboard opens */
const handoff = (href: string): void => {
  const c = COPY[role];
  $("#curtainT").textContent = c.hello + "…";
  if (!G) {
    location.href = href;
    return;
  }
  goBtn.setAttribute("aria-busy", "true");
  G.killTweensOf(["#gC", "#gCw", "#gB"]);
  G.timeline({
    onComplete: () => {
      location.href = href;
    },
  })
    .to(["#gC", "#gCw"], { x: 26, duration: 0.45, ease: "power3.inOut" }, 0)
    .to("#gB", { x: -26, duration: 0.45, ease: "power3.inOut" }, 0)
    .to(["#gC", "#gCw", "#gB"], { opacity: 1, duration: 0.2 }, 0)
    .to("#curtain", { clipPath: "inset(0% 0 0 0)", duration: 0.6, ease: "power3.inOut" }, 0.32)
    .to("#curtainT", { opacity: 1, y: 0, duration: 0.3, ease: "power2.out" }, 0.7)
    .to({}, { duration: 0.25 });
};

/* arrivals: from "Get started" (?join=1), after signing out (?out=1), or with a session that ended (?expired=1) */
const flash = $("#flash");
if (q.get("out")) {
  flash.hidden = false;
  flash.textContent = "You are signed out. Sign in again whenever you are ready.";
} else if (q.get("expired")) {
  flash.hidden = false;
  flash.textContent = "Your session expired, so we signed you out to keep your account safe. Sign in again to continue.";
}
if (q.get("join")) {
  $("#formH").textContent = "Join Linkloom";
  $("#formHelp").textContent = "Pick your side first. Already have an account? It's the same form: we'll sign you in.";
}
setRole(role, false);

/* Already signed in on this device: go straight to the dashboard. */
if (isSignedIn() && !q.get("out")) {
  fetchMe()
    .then(u => (u.needsOnboarding || !u.role ? showSignup(u) : open(u.role)))
    .catch(() => clearAuth());
}
