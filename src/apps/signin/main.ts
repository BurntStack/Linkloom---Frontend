/* Shared sign-in page: pick a side, then sign in with a password, or sign up. Everything is email-only: there is no
   mobile-number sign-in or SMS code anywhere in the app.
   - Sign in: email, password.
   - Sign up: name (and brand name for brands), email with Verify beside it, the emailed one-time code underneath,
     then password and confirm password. The email is verified once, here; after that the account signs in with it.
   - Forgot password: a code emailed to them signs them in, then they choose a new password (/auth/password/change/).
     A new account found this way finishes signing up as usual.
   The chosen colour carries the person into that dashboard. */
import "./signin.css";
import "../../shared/analytics";
import { gsap } from "../../shared/vendor-gsap";
import { type Role } from "./handoff";
import { attachGoogle } from "../../shared/api/google";
import {
  authMessage,
  changePassword,
  completeSignup,
  emailDestination,
  fetchMe,
  googleSignIn,
  passwordSignIn,
  requestOtp,
  signOut,
  verifyOtp,
} from "../../shared/api/auth";
import { ApiError, clearAuth, isSignedIn, type ApiUser } from "../../shared/api/client";

const $ = <T extends Element = HTMLElement>(s: string): T => document.querySelector<T>(s)!;
const esc = (v: unknown): string =>
  String(v ?? "").replace(
    /[&<>"']/g,
    ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!,
  );
const $$ = <T extends Element = HTMLElement>(s: string): T[] => [...document.querySelectorAll<T>(s)];

const G = matchMedia("(prefers-reduced-motion: reduce)").matches ? null : gsap;
const q = new URLSearchParams(location.search);

const COPY: Record<
  Role,
  { eyebrow: string; sub: string; btn: string; create: string; dash: string; setup: string; hello: string }
> = {
  creator: {
    eyebrow: "For creators",
    sub: "Bid on brand briefs, do the work, and get paid from escrow the day they approve.",
    btn: "Sign in as a creator",
    create: "Create creator account",
    dash: "app.html#home",
    setup: "app.html#setup",
    hello: "Opening your creator dashboard",
  },
  brand: {
    eyebrow: "For brands",
    sub: "Find creators, post a brief, and pay into escrow. Money moves only when you approve the work.",
    btn: "Sign in as a brand",
    create: "Create brand account",
    dash: "brand.html#home",
    setup: "brand.html#setup",
    hello: "Opening your brand dashboard",
  },
};
let role: Role = q.get("role") === "brand" ? "brand" : "creator";

/* ---------- form state ---------- */
type Mode = "signin" | "signup" | "reset";
let mode: Mode = "signin";
/** Set once a code (or Google, or a password) has signed the person in on this page. */
let verifiedUser: ApiUser | null = null;
/** "code": verified with the emailed code here, so the email row shows as verified. "other": Google or an existing session. */
let verifiedBy: "code" | "other" | null = null;
/** The account is new and still needs its name (and brand name). Fixed when the account is verified. */
let needsProfile = false;
/** An existing account that signed in with a code ("Forgot password?") and is choosing the password to use from now on. */
let setPw = false;
let challengeId = "";
let dest: ReturnType<typeof emailDestination> = null;
let cooldownEnd = 0;
let cooldownTimer = 0;
let busy = false;

const isNew = (u: ApiUser): boolean => !!u.needsOnboarding || !u.role;
const showNames = (): boolean => (verifiedUser ? needsProfile : mode === "signup");

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
function setRole(r: Role, animate: boolean): void {
  role = r;
  document.body.dataset.role = r;
  const c = COPY[r];
  $$(".seg button").forEach(b => b.setAttribute("aria-checked", String(b.dataset.role === r)));
  $("#eyebrow").textContent = c.eyebrow;
  paint();
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
    G.fromTo(
      fwd,
      { scale: 0.97 },
      { scale: 1.03, duration: 0.5, ease: "back.out(2.2)", yoyo: true, repeat: 1, repeatDelay: 0.05 },
    );
    G.to(back, { scale: 0.99, duration: 0.4, ease: "power2.out", yoyo: true, repeat: 1 });
    stitch();
  } else sub.textContent = c.sub;
}
$$<HTMLButtonElement>(".seg button").forEach(b => {
  b.addEventListener("click", () => !b.disabled && setRole(b.dataset.role as Role, true));
  b.addEventListener("keydown", e => {
    if (b.disabled || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
    e.preventDefault();
    const n: Role = role === "creator" ? "brand" : "creator";
    setRole(n, true);
    $(`.seg button[data-role="${n}"]`).focus();
  });
});

/* idle: the rings breathe a little, never more than a few pixels */
if (G) {
  G.from("#rings", { opacity: 0, scale: 0.94, duration: 1.1, ease: "power3.out" });
  G.from(["#gC", "#gCw"], { x: -60, duration: 1.3, ease: "power3.out" });
  G.from("#gB", { x: 60, duration: 1.3, ease: "power3.out" });
  G.from([".eyebrow", ".h1", ".sub"], {
    y: 18,
    opacity: 0,
    duration: 0.8,
    stagger: 0.08,
    ease: "power3.out",
    delay: 0.2,
  });
  G.from(".card > *", { y: 12, opacity: 0, duration: 0.6, stagger: 0.04, ease: "power3.out", delay: 0.25 });
  G.to(["#gC", "#gCw"], { x: -5, duration: 3.6, ease: "sine.inOut", yoyo: true, repeat: -1, delay: 1.4 });
  G.to("#gB", { x: 5, duration: 3.6, ease: "sine.inOut", yoyo: true, repeat: -1, delay: 1.4 });
  setTimeout(stitch, 900);
}

/* ---------- shared bits ---------- */
const idInput = $<HTMLInputElement>("#email");
const pwInput = $<HTMLInputElement>("#pw");
const goBtn = $<HTMLButtonElement>("#go");
const goLabel = $("#goL");
const suName = $<HTMLInputElement>("#suName");
const suBrand = $<HTMLInputElement>("#suBrand");
const suEmail = $<HTMLInputElement>("#suEmail");
const verifyBtn = $<HTMLButtonElement>("#suVerify");
const otpField = $("#suOtpField");
const otp = $<HTMLInputElement>("#suOtp");
const codeHelp = $("#codeHelp");
const suPw = $<HTMLInputElement>("#suPw");
const suPw2 = $<HTMLInputElement>("#suPw2");
const suGo = $<HTMLButtonElement>("#suGo");
const suGoLabel = $("#suGoL");
const remember = (): boolean => $<HTMLInputElement>("#remember").checked;

const setErr = (el: HTMLInputElement, errId: string, msg: string): void => {
  $("#" + errId).textContent = msg;
  el.setAttribute("aria-invalid", String(!!msg));
};
const shake = (): void => {
  if (G)
    G.fromTo(".card form:not([hidden])", { x: -6 }, { x: 0, duration: 0.45, ease: "elastic.out(1,.35)" });
};
const setBusy = (btn: HTMLButtonElement, label: HTMLElement, on: boolean, text: string): void => {
  busy = on;
  btn.disabled = on;
  btn.setAttribute("aria-busy", String(on));
  label.textContent = text;
};
const pretty = (d: NonNullable<ReturnType<typeof emailDestination>>): string => d.destination;
const badEmail = (v: string): string =>
  !v.trim() ? "Enter your email." : "That email looks incomplete, for example you@brand.in.";

/* show / hide password */
$$<HTMLButtonElement>("[data-eye]").forEach(b =>
  b.addEventListener("click", () => {
    const i = b.parentElement!.querySelector("input")!;
    const show = i.type === "password";
    i.type = show ? "text" : "password";
    b.setAttribute("aria-pressed", String(show));
    b.setAttribute("aria-label", show ? "Hide password" : "Show password");
  }),
);

/* typing clears that field's error, and the form's */
$$<HTMLInputElement>(".card input").forEach(i =>
  i.addEventListener("input", () => {
    const err = i.getAttribute("aria-describedby")?.split(" ")[0];
    if (err && $("#" + err).classList.contains("err")) setErr(i, err, "");
    $("#formErr").textContent = "";
    $("#suErr").textContent = "";
  }),
);

/* ---------- which form shows ---------- */
function paint(): void {
  const signin = mode === "signin";
  const names = showNames();
  const brand = role === "brand";
  $("#form").hidden = !signin;
  $("#signupForm").hidden = signin;
  $("#join").hidden = !signin;
  $("#haveAcc").hidden = signin;
  $("#google").hidden = !!verifiedUser;
  $$("[data-names]").forEach(e => (e.hidden = !names || (e.hasAttribute("data-brand-only") && !brand)));
  /* the password is chosen with the new account's details; signing in with a code needs none */
  $$("[data-new-only]").forEach(e => (e.hidden = !names && !setPw));
  $("#skipPw").hidden = !setPw;
  $("#suEmailField").hidden = verifiedBy === "other";
  goLabel.textContent = COPY[role].btn;
  if (!busy) suGoLabel.textContent = setPw ? "Save password and sign in" : COPY[role].create;
  $("#formH").textContent = signin
    ? "Sign in"
    : setPw
      ? "Choose a new password"
      : names
        ? brand
          ? "Create your brand account"
          : "Create your creator account"
        : "Sign in with a code";
  $("#formHelp").textContent = signin
    ? "Welcome back. Use the email and password you signed up with."
    : setPw
      ? "You're signed in. Choose the password you'll sign in with from now on."
      : names
        ? verifiedBy === "other"
          ? "Almost there. Add your details and choose a password."
          : "Verify your email with a code once, then choose a password. You'll sign in with your email and password from now on."
        : "Forgot your password? We'll email you a one-time code to sign you in, then you can choose a new password.";
  $(".seg").setAttribute("aria-label", signin ? "I am signing in as" : "I am signing up as");
  /* an existing account keeps its side; a new one can still switch until the account is made */
  const locked = !!verifiedUser && !needsProfile;
  $$<HTMLButtonElement>(".seg button").forEach(b => (b.disabled = locked));
}

function resetVerification(): void {
  if (verifiedUser) clearAuth();
  verifiedUser = null;
  verifiedBy = null;
  needsProfile = false;
  setPw = false;
  challengeId = "";
  dest = null;
  clearInterval(cooldownTimer);
  otpField.hidden = true;
  otp.value = "";
  otp.readOnly = false;
  $("#suEmailOk").textContent = "";
  verifyState("verify");
}

function setMode(m: Mode, focus = true): void {
  if (m === "signin" || (m === "reset" && verifiedUser)) resetVerification();
  mode = m;
  $$<HTMLInputElement>(".card input[aria-invalid=true]").forEach(i =>
    i.setAttribute("aria-invalid", "false"),
  );
  $$(".card .err").forEach(e => (e.textContent = ""));
  paint();
  if (focus) (m === "signin" ? idInput : verifiedUser ? suPw : showNames() ? suName : suEmail).focus();
}
$("#toSignup").addEventListener("click", () => setMode("signup"));
$("#toSignin").addEventListener("click", () => setMode("signin"));
$("#forgot").addEventListener("click", () => setMode("reset"));

/* ---------- sign in: email, password ---------- */
$("#form").addEventListener("submit", async e => {
  e.preventDefault();
  if (busy) return;
  const d = emailDestination(idInput.value);
  let bad: HTMLInputElement | null = null;
  const flag = (el: HTMLInputElement, id: string, msg: string): void => {
    setErr(el, id, msg);
    if (msg && !bad) bad = el;
  };
  flag(idInput, "emailErr", d ? "" : badEmail(idInput.value));
  flag(pwInput, "pwErr", pwInput.value ? "" : "Enter your password.");
  if (bad) {
    (bad as HTMLInputElement).focus();
    shake();
    return;
  }
  setBusy(goBtn, goLabel, true, "Signing in…");
  try {
    const user = await passwordSignIn(d!, pwInput.value, remember());
    await afterSignIn(user);
  } catch (err) {
    $("#formErr").textContent =
      err instanceof ApiError && err.status === 401 && !err.code
        ? authMessage(new ApiError(401, "", "INVALID_CREDENTIALS"))
        : authMessage(err);
    pwInput.select();
    shake();
    setBusy(goBtn, goLabel, false, COPY[role].btn);
  }
});

/* ---------- sign up: the email and its code ---------- */
type VState = "verify" | "sending" | "change" | "done";
let vstate: VState = "verify";
function verifyState(s: VState): void {
  vstate = s;
  verifyBtn.textContent = { verify: "Verify", sending: "Sending…", change: "Change", done: "Verified" }[s];
  verifyBtn.disabled = s === "sending" || s === "done";
  verifyBtn.classList.toggle("is-ok", s === "done");
  suEmail.readOnly = s !== "verify";
}

function paintResend(): void {
  clearInterval(cooldownTimer);
  const draw = (): void => {
    const left = Math.ceil((cooldownEnd - Date.now()) / 1000);
    if (left > 0)
      codeHelp.innerHTML = `Sent to <b>${esc(pretty(dest!))}</b>. You can ask for a new code in ${left} s.`;
    else {
      clearInterval(cooldownTimer);
      codeHelp.innerHTML = `Sent to <b>${esc(pretty(dest!))}</b>. Didn't get it? <button class="link" type="button" id="resend">Send a new code</button>`;
      $("#resend").addEventListener("click", () => void sendCode(true));
    }
  };
  draw();
  cooldownTimer = window.setInterval(draw, 1000);
}

async function sendCode(resend = false): Promise<void> {
  if (busy) return;
  const d = emailDestination(suEmail.value);
  if (!d) {
    setErr(suEmail, "suEmailErr", badEmail(suEmail.value));
    suEmail.focus();
    shake();
    return;
  }
  dest = d;
  busy = true;
  verifyState("sending");
  if (resend) codeHelp.textContent = "Sending a new code…";
  try {
    const ch = await requestOtp(d.channel, d.destination);
    challengeId = ch.challengeId;
    cooldownEnd = Date.now() + 30000;
    otp.value = "";
    setErr(otp, "suOtpErr", "");
    otpField.hidden = false;
    verifyState("change");
    paintResend();
    otp.focus();
  } catch (e) {
    verifyState(otpField.hidden ? "verify" : "change");
    if (otpField.hidden) setErr(suEmail, "suEmailErr", authMessage(e));
    else setErr(otp, "suOtpErr", authMessage(e));
    shake();
  } finally {
    busy = false;
  }
}

async function checkCode(): Promise<void> {
  if (busy || !/^\d{6}$/.test(otp.value)) return;
  busy = true;
  otp.readOnly = true;
  clearInterval(cooldownTimer);
  codeHelp.textContent = "Checking the code…";
  try {
    const user = await verifyOtp(challengeId, otp.value, remember());
    busy = false;
    verified(user, "code");
  } catch (e) {
    busy = false;
    setErr(otp, "suOtpErr", authMessage(e));
    otp.readOnly = false;
    otp.select();
    paintResend();
    shake();
  }
}

/** The sign-up code matched an email that already has an account. */
async function alreadyRegistered(): Promise<void> {
  const email = suEmail.value;
  /* finish signing out first, so it can't clear a password sign-in made straight after */
  busy = true;
  codeHelp.textContent = "Checking…";
  await signOut();
  busy = false;
  resetVerification();
  suEmail.value = email;
  suEmail.setAttribute("aria-invalid", "true");
  $("#suEmailErr").innerHTML =
    'This email already has a Linkloom account. <button class="link" type="button" data-to-signin>Sign in with your password</button>, or use <button class="link" type="button" data-to-code>Forgot password?</button> to get a code by email.';
  $("[data-to-signin]").addEventListener("click", () => {
    setMode("signin");
    idInput.value = email.trim();
    pwInput.focus();
  });
  $("[data-to-code]").addEventListener("click", () => {
    setMode("reset");
    suEmail.value = email;
  });
  shake();
}

/** The person is signed in (code, Google, or an existing session). A new account adds its details and a password. */
function verified(user: ApiUser, by: "code" | "other"): void {
  if (!isNew(user)) {
    /* Creating an account with an email that already has one: never sign in silently. End the session the code
       just opened and point them to sign-in. */
    if (mode === "signup") {
      void alreadyRegistered();
      return;
    }
    /* "Forgot password?": the code signed the account in; now they choose the password to use from now on */
    verifiedUser = user;
    verifiedBy = by;
    needsProfile = false;
    setPw = true;
    otpField.hidden = true;
    otp.readOnly = false;
    clearInterval(cooldownTimer);
    verifyState("done");
    setErr(suEmail, "suEmailErr", "");
    $("#suEmailOk").textContent = by === "code" && dest ? `${pretty(dest)} is verified.` : "";
    if (user.role && user.role !== role) setRole(user.role as Role, false);
    else paint();
    suPw.focus();
    return;
  }
  verifiedUser = user;
  verifiedBy = by;
  needsProfile = isNew(user);
  otpField.hidden = true;
  otp.readOnly = false;
  clearInterval(cooldownTimer);
  verifyState("done");
  setErr(suEmail, "suEmailErr", "");
  $("#suEmailOk").textContent = by === "code" && dest ? `${pretty(dest)} is verified.` : "";
  if (mode === "signin") mode = "signup";
  if (!suName.value && user.fullName) suName.value = String(user.fullName);
  paint();
  (!suName.value ? suName : suPw).focus();
}

$("#skipPwBtn").addEventListener("click", () => verifiedUser && open((verifiedUser.role as Role) || role));

verifyBtn.addEventListener("click", () => {
  if (vstate === "change") {
    resetVerification();
    suEmail.focus();
  } else void sendCode();
});
suEmail.addEventListener("keydown", e => {
  if (e.key === "Enter" && vstate === "verify") {
    e.preventDefault();
    void sendCode();
  }
});
otp.addEventListener("input", () => {
  otp.value = otp.value.replace(/\D/g, "").slice(0, 6);
  if (otp.value.length === 6) void checkCode();
});
otp.addEventListener("keydown", e => {
  if (e.key === "Enter") {
    e.preventDefault();
    if (!/^\d{6}$/.test(otp.value)) setErr(otp, "suOtpErr", "Enter the 6-digit code we sent you.");
    else void checkCode();
  }
});

/* ---------- sign up: password rules ---------- */
const RULES: [string, string, (p: string) => boolean][] = [
  ["len", "at least 8 characters", p => p.length >= 8],
  ["letter", "a letter", p => /[a-z]/i.test(p)],
  ["num", "a number", p => /\d/.test(p)],
  ["sym", "a symbol", p => /[^a-z0-9]/i.test(p)],
];
const missing = (p: string): string[] => RULES.filter(([, , ok]) => !ok(p)).map(([, t]) => t);
const listText = (a: string[]): string =>
  a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1];
suPw.addEventListener("input", () =>
  RULES.forEach(([k, , ok]) => $(`#suRules [data-rule="${k}"]`).classList.toggle("is-met", ok(suPw.value))),
);

/* ---------- sign up: create the account and save the password ---------- */
$("#signupForm").addEventListener("submit", async e => {
  e.preventDefault();
  if (busy) return;
  $("#suErr").textContent = "";
  const names = showNames();
  const brand = role === "brand";
  const n = suName.value.trim(),
    b = suBrand.value.trim(),
    pw = suPw.value;
  let bad: HTMLInputElement | null = null;
  const flag = (el: HTMLInputElement, id: string, msg: string): void => {
    setErr(el, id, msg);
    if (msg && !bad) bad = el;
  };
  if (names) {
    flag(suName, "suNameErr", n.length < 2 ? "Enter your name." : "");
    if (brand) flag(suBrand, "suBrandErr", b.length < 2 ? "Enter your brand name." : "");
  }
  if (!verifiedUser) {
    if (otpField.hidden) flag(suEmail, "suEmailErr", "Verify your email first.");
    else flag(otp, "suOtpErr", "Enter the 6-digit code we sent you.");
  }
  if (names || setPw) {
    const miss = missing(pw);
    flag(
      suPw,
      "suPwErr",
      !pw ? "Choose a password." : miss.length ? `Your password needs ${listText(miss)}.` : "",
    );
    flag(
      suPw2,
      "suPw2Err",
      !suPw2.value
        ? "Type the password again to confirm it."
        : suPw2.value !== pw
          ? "The two passwords don't match."
          : "",
    );
  }
  if (bad) {
    (bad as HTMLInputElement).focus();
    shake();
    return;
  }
  if (setPw) {
    setBusy(suGo, suGoLabel, true, "Saving…");
    try {
      await changePassword(pw);
      open((verifiedUser!.role as Role) || role);
    } catch (err) {
      const pwMsg = err instanceof ApiError ? err.field("password") || err.field("confirmPassword") : null;
      if (pwMsg) setErr(suPw, "suPwErr", pwMsg);
      else $("#suErr").textContent = authMessage(err);
      shake();
      setBusy(suGo, suGoLabel, false, "Save password and sign in");
    }
    return;
  }
  setBusy(suGo, suGoLabel, true, "Creating your account…");
  try {
    /* one call: the account's details and its password (API reference v1, 2.6) */
    const u = await completeSignup({
      role,
      fullName: n,
      ...(brand ? { brandName: b } : { displayName: n }),
      password: pw,
    });
    const r = (u.role as Role) || role;
    if (r !== role) setRole(r, false);
    /* new creators fill in their profile next; new brands finish their brand profile */
    handoff(COPY[r].setup);
  } catch (err) {
    /* a field the server refused goes under that field */
    const e = err instanceof ApiError ? err : null;
    const pwMsg = e?.field("password") || e?.field("confirmPassword");
    const nameMsg = e?.field("fullName") || e?.field("displayName");
    const brandMsg = e?.field("brandName");
    if (pwMsg) setErr(suPw, "suPwErr", pwMsg);
    if (nameMsg) setErr(suName, "suNameErr", nameMsg);
    if (brandMsg) setErr(suBrand, "suBrandErr", brandMsg);
    if (!pwMsg && !nameMsg && !brandMsg) $("#suErr").textContent = authMessage(err);
    shake();
    setBusy(suGo, suGoLabel, false, COPY[role].create);
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
  if (isNew(user)) {
    mode = "signup";
    verified(user, "other");
    return;
  }
  open(user.role as Role);
}

function open(r: Role): void {
  /* An account keeps the side it signed up on, whichever tab is selected here. */
  if (r !== role) setRole(r, false);
  handoff(COPY[r].dash);
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
  flash.textContent =
    "Your session expired, so we signed you out to keep your account safe. Sign in again to continue.";
}
if (q.get("join")) mode = "signup";
else if (q.get("forgot")) mode = "reset";
setRole(role, false);

/* Already signed in on this device: go straight to the dashboard, or finish signing up. */
/* (Not when they came to change their password: that starts with a fresh code.) */
if (isSignedIn() && !q.get("out") && !q.get("forgot")) {
  fetchMe()
    .then(u => (isNew(u) ? ((mode = "signup"), verified(u, "other")) : open(u.role as Role)))
    .catch(() => clearAuth());
}
