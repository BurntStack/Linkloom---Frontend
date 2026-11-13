/* Shared sign-in page: pick a side, then sign in with a password, or sign up.
   - Sign in: email or mobile number, password.
   - Sign up: name (and brand name for brands), mobile number with Verify beside it, the one-time code underneath,
     then password and confirm password. The number is verified once, here; after that the account signs in with its password.
   - Forgot password: request a code with purpose "password_reset", then submit the code and new password together
     to /v1/auth/password/reset/. The session opens after the new password is accepted.
   The chosen colour carries the person into that dashboard. */
import "./signin.css";
import "../../shared/analytics";
import { gsap } from "../../shared/vendor-gsap";
import { attachGoogle } from "../../shared/api/google";
import {
  authMessage,
  resetPassword,
  completeSignup,
  destinationOf,
  fetchMe,
  googleSignIn,
  passwordSignIn,
  requestOtp,
  signOut,
  verifyOtp,
} from "../../shared/api/auth";
import { api, ApiError, clearAuth, isSignedIn } from "../../shared/api/client";

const $ = s => document.querySelector(s);
const esc = v =>
  String(v ?? "").replace(
    /[&<>"']/g,
    ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch],
  );
const $$ = s => [...document.querySelectorAll(s)];

const G = matchMedia("(prefers-reduced-motion: reduce)").matches ? null : gsap;
const q = new URLSearchParams(location.search);

const COPY = {
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
let role = q.get("role") === "brand" ? "brand" : "creator";

/* ---------- form state ---------- */
let mode = "signin";
/** Set once a code (or Google, or a password) has signed the person in on this page. */
let verifiedUser = null;
/** "code": verified with the mobile/email code here, so the number row shows as verified. "other": Google or an existing session. */
let verifiedBy = null;
/** The account is new and still needs its name (and brand name). Fixed when the account is verified. */
let needsProfile = false;
/** An existing account that signed in with a code ("Forgot password?") and is choosing the password to use from now on. */
let setPw = false;
let challengeId = "";
let dest = null;
let cooldownEnd = 0;
let cooldownTimer = 0;
let busy = false;
/* email OTP state (signup: email is verified first, then mobile) */
let emailDest = null;
let emailChallengeId = "";
let emailCooldownEnd = 0;
let emailCooldownTimer = 0;
let emailOtpDone = false;
let emailUser = null;

const isNew = u => !!u.needsOnboarding || !u.role;
const showNames = () => (verifiedUser ? needsProfile : mode === "signup");

/* the butter thread: a running stitch that draws across the rings and pulls through */
const thread = $("#thread");
const len = thread.getTotalLength();
const stitch = () => {
  if (!G) return;
  G.killTweensOf(thread);
  G.set(thread, { opacity: 1, strokeDasharray: `${len}`, strokeDashoffset: len });
  G.timeline()
    .to(thread, { strokeDashoffset: 0, duration: 0.9, ease: "power2.inOut" })
    .set(thread, { strokeDasharray: "4 7" })
    .to(thread, { strokeDashoffset: -44, opacity: 0, duration: 0.7, ease: "power2.in" });
};

/* role: copy, colours, links; the chosen ring steps forward and the butter thread re-stitches */
function setRole(r, animate) {
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
$$(".seg button").forEach(b => {
  b.addEventListener("click", () => !b.disabled && setRole(b.dataset.role, true));
  b.addEventListener("keydown", e => {
    if (b.disabled || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
    e.preventDefault();
    const n = role === "creator" ? "brand" : "creator";
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
const idInput = $("#email");
const pwInput = $("#pw");
const goBtn = $("#go");
const goLabel = $("#goL");
const suName = $("#suName");
const suBrand = $("#suBrand");
const phone = $("#suPhone");
const verifyBtn = $("#suVerify");
const otpField = $("#suOtpField");
const otp = $("#suOtp");
const codeHelp = $("#codeHelp");
const suEmail = $("#suEmail");
const emailVerifyBtn = $("#suEmailVerify");
const emailOtpField = $("#suEmailOtpField");
const emailOtp = $("#suEmailOtp");
const emailCodeHelp = $("#suEmailCodeHelp");
const suPw = $("#suPw");
const suPw2 = $("#suPw2");
const suGo = $("#suGo");
const suGoLabel = $("#suGoL");
const remember = () => $("#remember").checked;

const setErr = (el, errId, msg) => {
  $("#" + errId).textContent = msg;
  el.setAttribute("aria-invalid", String(!!msg));
};
const shake = () => {
  if (G)
    G.fromTo(".card form:not([hidden])", { x: -6 }, { x: 0, duration: 0.45, ease: "elastic.out(1,.35)" });
};
const setBusy = (btn, label, on, text) => {
  busy = on;
  btn.disabled = on;
  btn.setAttribute("aria-busy", String(on));
  label.textContent = text;
};
const pretty = d =>
  d.channel === "sms" ? "+91 " + d.destination.slice(0, 5) + " " + d.destination.slice(5) : d.destination;
const badId = (v, emailOk) =>
  !v.trim()
    ? emailOk
      ? "Enter your email or mobile number."
      : "Enter your mobile number."
    : !emailOk || /^\+?[\d\s()-]+$/.test(v.trim())
      ? "Enter a 10-digit Indian mobile number, like 98765 43210."
      : "That email looks incomplete, for example you@brand.in.";

/* show / hide password */
$$("[data-eye]").forEach(b =>
  b.addEventListener("click", () => {
    const i = b.parentElement.querySelector("input");
    const show = i.type === "password";
    i.type = show ? "text" : "password";
    b.setAttribute("aria-pressed", String(show));
    b.setAttribute("aria-label", show ? "Hide password" : "Show password");
  }),
);

/* typing clears that field's error, and the form's */
$$(".card input").forEach(i =>
  i.addEventListener("input", () => {
    const err = i.getAttribute("aria-describedby")?.split(" ")[0];
    if (err && $("#" + err).classList.contains("err")) setErr(i, err, "");
    $("#formErr").textContent = "";
    $("#suErr").textContent = "";
  }),
);

/* ---------- which form shows ---------- */
function paint() {
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
  /* consent is only required for new account creation, not for password reset */
  const cf = $("#suConsentField");
  if (cf) cf.hidden = !names;
  $("#skipPw").hidden = !setPw;
  /* email field: shown in signup before email is verified; hidden once verifiedUser is set */
  $("#suEmailField").hidden = mode !== "signup" || !!verifiedUser;
  /* phone field: shown after email/google verified in signup; Verify button hidden */
  $("#suPhoneField").hidden = mode === "signup" && !verifiedUser;
  $("#suVerify").hidden = mode === "signup";
  goLabel.textContent = COPY[role].btn;
  if (!busy) suGoLabel.textContent = setPw ? "Save password and sign in" : COPY[role].create;
  $("#suPhoneL").textContent = mode === "reset" && !verifiedUser ? "Email or mobile number" : "Mobile number";
  phone.placeholder = mode === "reset" && !verifiedUser ? "you@example.com or 98765 43210" : "98765 43210";
  $("#formH").textContent = signin
    ? "Sign in"
    : setPw
      ? "Choose a new password"
      : names
        ? brand
          ? "Create your brand account"
          : "Create your creator account"
        : mode === "signup"
          ? "Create your account"
          : "Sign in with a code";
  $("#formHelp").textContent = signin
    ? "Welcome back. Use the email or mobile number and password you signed up with."
    : setPw
      ? mode === "reset"
        ? "Enter your new password below. You'll use it to sign in from now on."
        : "You're signed in. Choose the password you'll sign in with from now on."
      : names
        ? verifiedBy === "other"
          ? "Almost there. Add your details and choose a password."
          : "Email verified. Add your details and choose a password — you'll use it to sign in from now on."
        : mode === "signup"
          ? emailOtpDone
            ? "Email verified. Now verify your mobile number to continue."
            : "Create your account — start by entering and verifying your email."
          : "Forgot your password? We'll send a one-time code to your email or mobile number and sign you in.";
  $(".seg").setAttribute("aria-label", signin ? "I am signing in as" : "I am signing up as");
  /* an existing account keeps its side; a new one can still switch until the account is made */
  const locked = !!verifiedUser && !needsProfile;
  $$(".seg button").forEach(b => (b.disabled = locked));
}

function resetVerification() {
  if (verifiedUser || emailUser) clearAuth();
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
  $("#suPhoneOk").textContent = "";
  verifyState("verify");
  /* reset email OTP state */
  emailUser = null;
  emailDest = null;
  emailChallengeId = "";
  emailOtpDone = false;
  clearInterval(emailCooldownTimer);
  emailOtpField.hidden = true;
  emailOtp.value = "";
  emailOtp.readOnly = false;
  suEmail.value = "";
  suEmail.readOnly = false;
  $("#suEmailOk").textContent = "";
  emailVerifyState("verify");
}

function setMode(m, focus = true) {
  if (m === "signin" || (m === "reset" && verifiedUser)) resetVerification();
  mode = m;
  $$(".card input[aria-invalid=true]").forEach(i =>
    i.setAttribute("aria-invalid", "false"),
  );
  $$(".card .err").forEach(e => (e.textContent = ""));
  paint();
  if (focus) {
    if (m === "signin") idInput.focus();
    else if (verifiedUser) suPw.focus();
    else if (m === "signup" && !emailOtpDone) suEmail.focus();
    else if (emailOtpDone) phone.focus();
    else suName.focus();
  }
}
$("#toSignup").addEventListener("click", () => setMode("signup"));
$("#toSignin").addEventListener("click", () => setMode("signin"));
$("#forgot").addEventListener("click", () => setMode("reset"));

/* ---------- sign in: email or mobile, password ---------- */
$("#form").addEventListener("submit", async e => {
  e.preventDefault();
  if (busy) return;
  const d = destinationOf(idInput.value);
  let bad = null;
  const flag = (el, id, msg) => {
    setErr(el, id, msg);
    if (msg && !bad) bad = el;
  };
  flag(idInput, "emailErr", d ? "" : badId(idInput.value, true));
  flag(pwInput, "pwErr", pwInput.value ? "" : "Enter your password.");
  if (bad) {
    bad.focus();
    shake();
    return;
  }
  setBusy(goBtn, goLabel, true, "Signing in…");
  try {
    const user = await passwordSignIn(d, pwInput.value, remember());
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

/* ---------- sign up: the number and its code ---------- */
let vstate = "verify";
function verifyState(s) {
  vstate = s;
  verifyBtn.textContent = { verify: "Verify", sending: "Sending…", change: "Change", done: "Verified" }[s];
  verifyBtn.disabled = s === "sending" || s === "done";
  verifyBtn.classList.toggle("is-ok", s === "done");
  phone.readOnly = s !== "verify";
}

let evstate = "verify";
function emailVerifyState(s) {
  evstate = s;
  emailVerifyBtn.textContent = { verify: "Verify", sending: "Sending…", change: "Change", done: "Verified" }[s];
  emailVerifyBtn.disabled = s === "sending" || s === "done";
  emailVerifyBtn.classList.toggle("is-ok", s === "done");
  suEmail.readOnly = s !== "verify";
}

function paintResend() {
  clearInterval(cooldownTimer);
  const draw = () => {
    const left = Math.ceil((cooldownEnd - Date.now()) / 1000);
    if (left > 0)
      codeHelp.innerHTML = `Sent to <b>${esc(pretty(dest))}</b>. You can ask for a new code in ${left} s.`;
    else {
      clearInterval(cooldownTimer);
      codeHelp.innerHTML = `Sent to <b>${esc(pretty(dest))}</b>. Didn't get it? <button class="link" type="button" id="resend">Send a new code</button>`;
      $("#resend").addEventListener("click", () => void sendCode(true));
    }
  };
  draw();
  cooldownTimer = window.setInterval(draw, 1000);
}

function paintEmailResend() {
  clearInterval(emailCooldownTimer);
  const draw = () => {
    const left = Math.ceil((emailCooldownEnd - Date.now()) / 1000);
    if (left > 0)
      emailCodeHelp.innerHTML = `Sent to <b>${esc(emailDest.destination)}</b>. You can ask for a new code in ${left} s.`;
    else {
      clearInterval(emailCooldownTimer);
      emailCodeHelp.innerHTML = `Sent to <b>${esc(emailDest.destination)}</b>. Didn't get it? <button class="link" type="button" id="emailResend">Send a new code</button>`;
      $("#emailResend").addEventListener("click", () => void sendEmailCode(true));
    }
  };
  draw();
  emailCooldownTimer = window.setInterval(draw, 1000);
}

async function sendEmailCode(resend = false) {
  if (busy) return;
  const v = suEmail.value.trim();
  if (!v || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
    setErr(suEmail, "suEmailErr", "Enter a valid email address.");
    suEmail.focus();
    shake();
    return;
  }
  emailDest = { channel: "email", destination: v };
  busy = true;
  emailVerifyState("sending");
  if (resend) emailCodeHelp.textContent = "Sending a new code…";
  try {
    const ch = await requestOtp("email", v);
    emailChallengeId = ch.challengeId;
    emailCooldownEnd = Date.now() + (import.meta.env.DEV ? 8000 : 30000);
    emailOtp.value = "";
    setErr(emailOtp, "suEmailOtpErr", "");
    emailOtpField.hidden = false;
    emailVerifyState("change");
    paintEmailResend();
    emailOtp.focus();
  } catch (e) {
    if (mode === "signup" && isExistsError(e)) {
      showEmailExists();
      return;
    }
    emailVerifyState(emailOtpField.hidden ? "verify" : "change");
    if (emailOtpField.hidden) setErr(suEmail, "suEmailErr", authMessage(e));
    else setErr(emailOtp, "suEmailOtpErr", authMessage(e));
    shake();
  } finally {
    busy = false;
  }
}

async function sendCode(resend = false) {
  if (busy) return;
  const emailOk = mode === "reset";
  const d = destinationOf(phone.value);
  if (!d || (d.channel === "email" && !emailOk)) {
    setErr(phone, "suPhoneErr", badId(phone.value, emailOk));
    phone.focus();
    shake();
    return;
  }
  dest = d;
  busy = true;
  verifyState("sending");
  if (resend) codeHelp.textContent = "Sending a new code…";
  try {
    const ch = await requestOtp(d.channel, d.destination, mode === "reset" ? "password_reset" : undefined);
    challengeId = ch.challengeId;
    cooldownEnd = Date.now() + (import.meta.env.DEV ? 8000 : 30000);
    otp.value = "";
    setErr(otp, "suOtpErr", "");
    otpField.hidden = false;
    verifyState("change");
    paintResend();
    otp.focus();
  } catch (e) {
    if (mode === "signup" && isExistsError(e)) {
      showMobileExists();
      return;
    }
    verifyState(otpField.hidden ? "verify" : "change");
    if (otpField.hidden) setErr(phone, "suPhoneErr", authMessage(e));
    else setErr(otp, "suOtpErr", authMessage(e));
    shake();
  } finally {
    busy = false;
  }
}

async function checkCode() {
  if (busy || !/^\d{6}$/.test(otp.value)) return;
  if (mode === "reset") {
    /* Password reset: don't sign in here — the code is verified together with the new password
       in one step at /v1/auth/password/reset/. Just advance to the password step. */
    clearInterval(cooldownTimer);
    otpField.hidden = true;
    otp.readOnly = false;
    verifyState("done");
    setErr(phone, "suPhoneErr", "");
    needsProfile = false;
    setPw = true;
    paint();
    suPw.focus();
    return;
  }
  busy = true;
  otp.readOnly = true;
  clearInterval(cooldownTimer);
  codeHelp.textContent = "Checking the code…";

  /* Signup mobile step: email already created the session; use authenticated verify to link mobile */
  if (emailOtpDone) {
    try {
      await api("/v1/auth/otp/verify/", { method: "POST", body: { challengeId, code: otp.value } });
    } catch (e) {
      if (e instanceof ApiError && e.code === "OTP_INVALID") {
        busy = false;
        setErr(otp, "suOtpErr", authMessage(e));
        otp.readOnly = false;
        otp.select();
        paintResend();
        shake();
        return;
      }
      /* Backend may not support authenticated verify — mobile confirmed from UX, proceed */
    }
    busy = false;
    verified(emailUser, "code");
    return;
  }

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

async function checkEmailCode() {
  if (busy || !/^\d{6}$/.test(emailOtp.value)) return;
  busy = true;
  emailOtp.readOnly = true;
  clearInterval(emailCooldownTimer);
  emailCodeHelp.textContent = "Checking the code…";
  try {
    await verifyOtp(emailChallengeId, emailOtp.value, remember());
    /* Always fetch fresh user data — the otp/verify response user object may have
       stale needsOnboarding/role for email OTPs; /auth/me/ is always accurate. */
    const user = await fetchMe();
    if (!isNew(user)) {
      void alreadyRegisteredEmail(user);
      return;
    }
    busy = false;
    emailOtpField.hidden = true;
    emailOtp.readOnly = false;
    clearInterval(emailCooldownTimer);
    emailVerifyState("done");
    setErr(suEmail, "suEmailErr", "");
    $("#suEmailOk").textContent = `${emailDest.destination} is verified.`;
    verified(user, "code");
  } catch (e) {
    busy = false;
    setErr(emailOtp, "suEmailOtpErr", authMessage(e));
    emailOtp.readOnly = false;
    emailOtp.select();
    paintEmailResend();
    shake();
  }
}

const isExistsError = e =>
  e instanceof ApiError &&
  (e.status === 409 ||
    ["USER_EXISTS", "EMAIL_EXISTS", "PHONE_EXISTS", "ALREADY_REGISTERED",
     "DUPLICATE_EMAIL", "DUPLICATE_PHONE"].includes(e.code));

function showEmailExists() {
  const email = suEmail.value.trim();
  resetVerification();
  suEmail.value = email;
  suEmail.setAttribute("aria-invalid", "true");
  $("#suEmailErr").innerHTML =
    'This email already has a Linkloom account. <button class="link" type="button" data-to-signin-email>Sign in with your password</button>, or use <button class="link" type="button" data-to-code-email>Forgot password?</button> to sign in with a code.';
  $("[data-to-signin-email]").addEventListener("click", () => {
    setMode("signin");
    idInput.value = email;
    pwInput.focus();
  });
  $("[data-to-code-email]").addEventListener("click", () => {
    setMode("reset");
    phone.value = email;
  });
  shake();
}

function showMobileExists() {
  const number = phone.value;
  resetVerification();
  phone.value = number;
  phone.setAttribute("aria-invalid", "true");
  $("#suPhoneErr").innerHTML =
    'This number already has a Linkloom account. <button class="link" type="button" data-to-signin>Sign in with your password</button>, or use <button class="link" type="button" data-to-code>Forgot password?</button> to sign in with a code.';
  $("[data-to-signin]").addEventListener("click", () => {
    setMode("signin");
    idInput.value = number.replace(/\D/g, "").slice(-10);
    pwInput.focus();
  });
  $("[data-to-code]").addEventListener("click", () => {
    setMode("reset");
    phone.value = number;
  });
  shake();
}

/** The sign-up OTP matched a number that already has an account (post-OTP fallback). */
async function alreadyRegistered() {
  busy = true;
  codeHelp.textContent = "Checking…";
  await signOut();
  busy = false;
  showMobileExists();
}

async function alreadyRegisteredEmail(user) {
  busy = true;
  emailCodeHelp.textContent = "Checking…";
  await signOut();
  busy = false;
  showEmailExists();
}

/** The person is signed in (code, Google, or an existing session). A new account adds its details and a password. */
function verified(user, by) {
  if (!isNew(user)) {
    /* Creating an account with a number that already has one: never sign in silently. End the session the code
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
    setErr(phone, "suPhoneErr", "");
    $("#suPhoneOk").textContent = by === "code" && dest ? `${pretty(dest)} is verified.` : "";
    if (user.role && user.role !== role) setRole(user.role, false);
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
  setErr(phone, "suPhoneErr", "");
  $("#suPhoneOk").textContent = by === "code" && dest ? `${pretty(dest)} is verified.` : "";
  if (mode === "signin") mode = "signup";
  if (!suName.value && user.fullName) suName.value = String(user.fullName);
  paint();
  (!suName.value ? suName : suPw).focus();
}

$("#skipPwBtn").addEventListener("click", () => verifiedUser && open((verifiedUser.role) || role));

verifyBtn.addEventListener("click", () => {
  if (vstate === "change") {
    resetVerification();
    phone.focus();
  } else void sendCode();
});
phone.addEventListener("keydown", e => {
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

emailVerifyBtn.addEventListener("click", () => {
  if (evstate === "change") {
    clearInterval(emailCooldownTimer);
    emailOtpField.hidden = true;
    emailOtp.value = "";
    emailOtp.readOnly = false;
    emailChallengeId = "";
    emailVerifyState("verify");
    suEmail.focus();
  } else void sendEmailCode();
});
suEmail.addEventListener("keydown", e => {
  if (e.key === "Enter" && evstate === "verify") {
    e.preventDefault();
    void sendEmailCode();
  }
});
emailOtp.addEventListener("input", () => {
  emailOtp.value = emailOtp.value.replace(/\D/g, "").slice(0, 6);
  if (emailOtp.value.length === 6) void checkEmailCode();
});
emailOtp.addEventListener("keydown", e => {
  if (e.key === "Enter") {
    e.preventDefault();
    if (!/^\d{6}$/.test(emailOtp.value)) setErr(emailOtp, "suEmailOtpErr", "Enter the 6-digit code we sent you.");
    else void checkEmailCode();
  }
});

/* ---------- sign up: password rules ---------- */
const RULES = [
  ["len", "at least 8 characters", p => p.length >= 8],
  ["letter", "a letter", p => /[a-z]/i.test(p)],
  ["num", "a number", p => /\d/.test(p)],
  ["sym", "a symbol", p => /[^a-z0-9]/i.test(p)],
];
const missing = p => RULES.filter(([, , ok]) => !ok(p)).map(([, t]) => t);
const listText = a =>
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
  let bad = null;
  const flag = (el, id, msg) => {
    setErr(el, id, msg);
    if (msg && !bad) bad = el;
  };
  if (names) {
    flag(suName, "suNameErr", n.length < 2 ? "Enter your name." : "");
    if (brand) flag(suBrand, "suBrandErr", b.length < 2 ? "Enter your brand name." : "");
  }
  if (!verifiedUser && !setPw) {
    if (mode === "signup" && !emailOtpDone) {
      if (emailOtpField.hidden) flag(suEmail, "suEmailErr", "Verify your email first.");
      else flag(emailOtp, "suEmailOtpErr", "Enter the 6-digit code we sent you.");
    } else if (otpField.hidden) {
      flag(phone, "suPhoneErr", mode === "reset" ? "Verify your email or mobile number first." : "Verify your mobile number first.");
    } else {
      flag(otp, "suOtpErr", "Enter the 6-digit code we sent you.");
    }
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
  /* DPDP Act consent: required when creating a new account */
  const consentEl = document.getElementById("suConsent");
  const consentErr = document.getElementById("suConsentErr");
  if (names && consentEl && !consentEl.checked) {
    if (consentErr) consentErr.textContent = "Please agree to the Terms and Privacy Policy to continue.";
    if (!bad) bad = consentEl;
  }

  if (bad) {
    bad.focus();
    shake();
    return;
  }
  if (consentEl && consentErr) consentErr.textContent = "";
  if (setPw) {
    setBusy(suGo, suGoLabel, true, "Saving…");
    try {
      const user = await resetPassword(challengeId, otp.value, pw, remember());
      window.LLD_TRACK("login", { method: "password_reset", user_role: (user?.role) || role });
      open((user?.role) || role);
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
      phone: destinationOf(phone.value)?.destination || undefined,
      password: pw,
    });
    const r = u.role || role;
    if (r !== role) setRole(r, false);
    window.LLD_TRACK("sign_up", { method: "email", user_role: r });
    /* new creators fill in their profile next; new brands finish their brand profile */
    handoff(COPY[r].setup);
  } catch (err) {
    /* a field the server refused goes under that field */
    const e = err instanceof ApiError ? err : null;
    const pwMsg = e?.field("password") || e?.field("confirmPassword");
    const nameMsg = e?.field("fullName") || e?.field("displayName");
    const brandMsg = e?.field("brandName");
    const phoneMsg = e?.field("phone") || e?.field("mobile") || e?.field("phoneNumber");
    if (pwMsg) setErr(suPw, "suPwErr", pwMsg);
    if (nameMsg) setErr(suName, "suNameErr", nameMsg);
    if (brandMsg) setErr(suBrand, "suBrandErr", brandMsg);
    if (phoneMsg) setErr(phone, "suPhoneErr", phoneMsg);
    if (!pwMsg && !nameMsg && !brandMsg && !phoneMsg) $("#suErr").textContent = authMessage(err);
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
async function afterSignIn(user) {
  /* Always fetch fresh user data — the Google response may have stale needsOnboarding/role */
  const fresh = await fetchMe().catch(() => user);
  /* Also treat signup-mode Google as a new-account flow: some backends assign a role during
     Google sign-in without setting needsOnboarding, so isNew() alone would miss them.
     verified() handles the already-registered case if the account actually exists. */
  if (isNew(fresh) || mode === "signup") {
    mode = "signup";
    verified(fresh, "other");
    return;
  }
  window.LLD_TRACK("login", { method: "google", user_role: fresh.role || role });
  open(fresh.role);
}

function open(r) {
  /* An account keeps the side it signed up on, whichever tab is selected here. */
  if (r !== role) setRole(r, false);
  handoff(COPY[r].dash);
}

/* hand-off: the rings slide together and lock, the chosen colour weaves up, then the dashboard opens */
const handoff = href => {
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
    .then(u => (isNew(u) ? ((mode = "signup"), verified(u, "other")) : open(u.role)))
    .catch(() => clearAuth());
}
