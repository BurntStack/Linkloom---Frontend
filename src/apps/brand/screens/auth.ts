// @ts-nocheck
/* auth screens (Builder A): #login, #signup, #forgot, #reset-<token>. All shell:'focus', auth:false.
   Security rules shown in the UI (the server enforces them in production):
   - one email = one account, one mobile = one account (LLD_DATA.taken)
   - email verified by link, mobile by a 6-digit OTP; both resend with a 30 s cooldown, 3 resends each
   - password: at least 8 characters with a letter, a number and a symbol
   - reset links work once and expire after 30 minutes
   - account status is checked on sign-in: verified, pending (verify email first) or blocked (contact support)
   - remember me keeps the session for 30 days on this device (JWT access + refresh tokens, server-side)
   Also exposes LLD.auth (password rules, password field, sign out), reused by the profile and setup screens. */
(() => {
  const L = window.LLD,
    { esc, icon, store } = L;
  const mo = (k, ...a) => {
    const f = L.motion && L.motion[k];
    if (typeof f === "function") {
      try {
        return f(...a);
      } catch (e) {}
    }
  };
  const now = () => Date.now();
  const COOL = 30,
    MAX_SENDS = 3,
    OTP = "246810",
    OTP_TRIES = 5,
    PW_TRIES = 5,
    PW_LOCK = 15 * 60,
    RESET_TTL = 30 * 60;
  const SUPPORT = "support@linkloom.in",
    SAMPLE_EMAIL = "meera@mirevo.in",
    SAMPLE_PW = "Mirevo@2026";
  const mmss = s => Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  const fmtPhone = d => (d.length > 5 ? d.slice(0, 5) + " " + d.slice(5) : d);
  const maskEmail = e => {
    const [u, d] = String(e).split("@");
    return d ? u.slice(0, Math.min(2, u.length)) + "••••@" + d : e;
  };
  const setLabel = (b, t) =>
    b &&
    b.querySelectorAll(".t,.t2").forEach(s => {
      s.textContent = t;
    });
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const vEmail = v => {
    v = v.trim();
    if (!v) return "Enter your work email.";
    return EMAIL_RE.test(v) ? "" : "That email looks incomplete, like name@brand.in.";
  };
  const vMobile = d => {
    if (!d) return "Enter your mobile number.";
    if (d.length !== 10) return "Enter all 10 digits.";
    return /^[6-9]/.test(d) ? "" : "Indian mobile numbers start with 6, 7, 8 or 9.";
  };

  /* ---------- accounts known to this demo (the server owns these in production) ---------- */
  const ACC = { [SAMPLE_EMAIL]: { pw: SAMPLE_PW, status: "verified", first: false } };
  const taken = () => store.s.taken || { emails: [], mobiles: [] };
  const emailTaken = e => taken().emails.includes(e.trim().toLowerCase());
  const mobileTaken = d => taken().mobiles.includes(d);

  /* ---------- password rules (shared with profile and reset) ---------- */
  const RULES = [
    ["len", "At least 8 characters", v => [...v].length >= 8],
    ["let", "A letter", v => /\p{L}/u.test(v)],
    ["num", "A number", v => /\d/.test(v)],
    ["sym", "A symbol, like @ # or !", v => /[^\p{L}\d\s]/u.test(v)],
  ];
  const pwOk = v => RULES.every(r => r[2](v));
  const rulesHTML = id =>
    `<ul class="auth-rules" id="${id}" aria-label="Your password needs">${RULES.map(
      r =>
        `<li data-r="${r[0]}"><span class="auth-rule-ic" aria-hidden="true">${icon("check")}</span><span>${esc(r[1])}</span><span class="sr-only" data-rs>, not yet</span></li>`,
    ).join("")}</ul>`;
  function updRules(ul, v) {
    if (!ul) return;
    RULES.forEach(r => {
      const li = ul.querySelector(`[data-r="${r[0]}"]`),
        ok = r[2](v),
        was = li.classList.contains("is-ok");
      li.classList.toggle("is-ok", ok);
      li.querySelector("[data-rs]").textContent = ok ? ", done" : ", not yet";
      if (ok && !was) mo("check", li.querySelector(".auth-rule-ic"), { color: "ink" });
    });
  }
  const pwField = (id, label, { auto = "new-password", help = "", desc = "" } = {}) => `
    <div class="field" data-f="${id}"><label for="au-${id}">${label}</label>
      <div class="auth-pw"><input class="input" id="au-${id}" type="password" autocomplete="${auto}" spellcheck="false" autocapitalize="off" maxlength="64" aria-describedby="${[help ? `au-${id}-h` : "", desc, `au-${id}-e`].filter(Boolean).join(" ")}">
        <button type="button" class="auth-eye" data-eye aria-label="Show password" aria-pressed="false">${icon("eye")}</button></div>
      ${help ? `<p class="help" id="au-${id}-h">${help}</p>` : ""}<p class="err" id="au-${id}-e" aria-live="polite"></p></div>`;
  function wireEyes(root) {
    root.querySelectorAll("[data-eye]").forEach(b => {
      if (b._w) return;
      b._w = 1;
      b.addEventListener("click", () => {
        const i = b.parentElement.querySelector("input"),
          show = i.type === "password";
        i.type = show ? "text" : "password";
        b.setAttribute("aria-pressed", String(show));
        b.setAttribute("aria-label", show ? "Hide password" : "Show password");
        b.classList.toggle("is-on", show);
      });
    });
  }
  const fld = (id, label, input, help = "") =>
    `<div class="field" data-f="${id}"><label for="au-${id}">${label}</label>${input}${help ? `<p class="help" id="au-${id}-h">${help}</p>` : ""}<p class="err" id="au-${id}-e" aria-live="polite"></p></div>`;
  function errAt(root, id, msg) {
    const f = root.querySelector(`[data-f="${id}"]`);
    if (!f) return;
    f.classList.add("is-err");
    const e = f.querySelector(".err");
    if (e) e.innerHTML = msg;
    const i = f.querySelector("input");
    i && i.setAttribute("aria-invalid", "true");
  }
  function clrErr(root, id) {
    const f = root.querySelector(`[data-f="${id}"]`);
    if (!f) return;
    f.classList.remove("is-err");
    const e = f.querySelector(".err");
    if (e) e.textContent = "";
    const i = f.querySelector("input");
    i && i.removeAttribute("aria-invalid");
  }
  const focusFirstErr = root => {
    const i = root.querySelector(".field.is-err input");
    i && i.focus();
  };

  function signOut(opts = {}) {
    store.set(s => {
      s.session.signedIn = false;
      s.session.expired = !!opts.expired;
    }, "signed-out");
    L.closeSheet(true);
    L.go(opts.expired ? "#login-expired" : "#login-out");
  }
  function checkCurrent(pw) {
    const a = ACC[(store.s.session.email || SAMPLE_EMAIL).toLowerCase()] || ACC[SAMPLE_EMAIL];
    return a.pw === pw;
  }
  function setPassword(pw, email) {
    const a = ACC[(email || store.s.session.email || SAMPLE_EMAIL).toLowerCase()] || ACC[SAMPLE_EMAIL];
    a.pw = pw;
  }

  /* ---------- the art panel shared by every auth screen ---------- */
  const art = (line, foot, extra = "") => `
    <section class="focus-art dark auth-art" aria-label="Linkloom for brands">
      <p class="auth-brand"><img src="assets/logo-mark.svg" width="28" height="28" alt=""><span>linkloom</span><span class="auth-for">for brands</span></p>
      <h2 class="t-display auth-line">${line}</h2>
      ${extra}
      <img class="auth-rings" src="assets/hero-rings.svg" width="610" height="660" alt="">
      <p class="auth-art-foot">${foot}</p>
    </section>`;
  const shell = (artHTML, formHTML, cls = "") =>
    `<div class="focus auth ${cls}">${artHTML}<section class="focus-form light auth-form"><div class="auth-in">${formHTML}</div><p class="sr-only" aria-live="polite" data-live></p></section></div>`;
  const note = (kind, ic, html, attrs = "") =>
    `<div class="auth-note auth-note-${kind}" ${attrs}>${icon(ic)}<div>${html}</div></div>`;

  /* ---------- 6-box OTP input ---------- */
  function otpBoxes(host, { onFull } = {}) {
    host.innerHTML = `<div class="auth-boxes" role="group" aria-label="6-digit code">${[0, 1, 2, 3, 4, 5]
      .map(
        i =>
          `<input class="auth-box" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder=" " autocomplete="${i ? "off" : "one-time-code"}" aria-label="Digit ${i + 1} of 6">`,
      )
      .join("")}</div>`;
    const boxes = [...host.querySelectorAll(".auth-box")];
    const code = () => boxes.map(b => b.value).join("");
    const changed = () => {
      host.classList.remove("is-err");
      boxes.forEach(b => b.removeAttribute("aria-invalid"));
      onFull && onFull(code().length === 6, code());
    };
    function fill(str, from) {
      String(str)
        .replace(/\D/g, "")
        .slice(0, 6 - from)
        .split("")
        .forEach((c, k) => {
          boxes[from + k].value = c;
        });
      changed();
      const nx = boxes.find(x => !x.value);
      nx ? nx.focus() : boxes[5].focus();
    }
    boxes.forEach((b, i) => {
      b.addEventListener("input", () => {
        const d = b.value.replace(/\D/g, "");
        if (d.length > 1) {
          fill(d, i);
          return;
        }
        b.value = d;
        if (d && i < 5) boxes[i + 1].focus();
        changed();
      });
      b.addEventListener("keydown", e => {
        if (e.key === "Backspace" && !b.value && i > 0) {
          boxes[i - 1].value = "";
          boxes[i - 1].focus();
          e.preventDefault();
          changed();
        } else if (e.key === "ArrowLeft" && i > 0) {
          boxes[i - 1].focus();
          e.preventDefault();
        } else if (e.key === "ArrowRight" && i < 5) {
          boxes[i + 1].focus();
          e.preventDefault();
        }
      });
      b.addEventListener("focus", () => b.select());
      b.addEventListener("paste", e => {
        e.preventDefault();
        fill((e.clipboardData || window.clipboardData).getData("text"), 0);
      });
    });
    return {
      code,
      boxes,
      clear() {
        boxes.forEach(b => {
          b.value = "";
        });
        changed();
      },
      bad() {
        host.classList.add("is-err");
        boxes.forEach(b => {
          b.setAttribute("aria-invalid", "true");
          b.value = "";
        });
        mo("shake", host.firstElementChild);
        boxes[0].focus();
      },
      disable(on) {
        boxes.forEach(b => {
          b.disabled = on;
        });
      },
      focus() {
        (boxes.find(x => !x.value) || boxes[0]).focus();
      },
    };
  }

  /* a resend row with a live cooldown; returns tick() and reset() */
  function resender(row, st, { what, onSend }) {
    function paint() {
      const left = Math.ceil((st.coolEnd - now()) / 1000);
      if (st.sends >= MAX_SENDS) {
        row.innerHTML = `<span class="muted">You've asked for ${MAX_SENDS} new ${what}s. Wait 30 min, or write to <a class="btn-q" href="mailto:${SUPPORT}">${SUPPORT}</a>.</span>`;
        return;
      }
      if (left > 0) {
        const b = row.querySelector("[data-cd]");
        if (b) b.textContent = mmss(left);
        else
          row.innerHTML = `<span class="muted">Didn't get it? Resend in <b class="num" data-cd>${mmss(left)}</b></span>`;
        return;
      }
      if (row.querySelector("[data-resend]")) return;
      row.innerHTML = `<span class="muted">Didn't get it?</span> <button type="button" class="btn-q" data-resend>Resend ${what}</button>`;
      row.querySelector("[data-resend]").addEventListener("click", () => {
        if (!navigator.onLine) {
          L.toast("You're offline. Try again when you're connected.", "alert");
          return;
        }
        st.sends++;
        st.coolEnd = now() + COOL * 1000;
        onSend && onSend();
        paint();
      });
    }
    return paint;
  }

  /* =====================================================================
     #login  (#login-expired, #login-out, #login-new, #login-reset)
     ===================================================================== */
  const LS = {
    email: "",
    acct: "returning",
    tries: 0,
    lockEnd: 0,
    remember: true,
    pendCool: 0,
    pendSends: 0,
  };
  const SAMPLES = {
    returning: ["Returning brand", "verified", false],
    first: ["First sign-in", "verified", true],
    pending: ["Email not verified", "pending", false],
    blocked: ["Blocked", "blocked", false],
  };

  function renderLogin(el, param) {
    const flash = {
      expired: [
        "info",
        "clock",
        "Your session expired, so we signed you out to keep your account safe. Sign in again to pick up where you left off.",
      ],
      out: [
        "info",
        "logout",
        "You're signed out on this device. Your jobs, campaigns and escrow are unchanged.",
      ],
      new: [
        "ok",
        "check",
        "<b>Account created.</b> Sign in with your new password to set up your brand profile.",
      ],
      reset: [
        "ok",
        "check",
        "<b>Password updated.</b> Sign in with the new one. Other devices were signed out.",
      ],
    }[param];
    LS.remember = store.s.session.remember !== false;
    el.innerHTML = shell(
      art(
        "Hire creators. Pay&nbsp;on&nbsp;approval.",
        "For brands hiring Instagram and YouTube creators across India",
      ),
      `<div class="auth-head"><h1 class="t-h1" tabindex="-1" data-h>Sign in</h1>
        <p class="muted">Find creators, post briefs, and pay from escrow only when you approve the work.</p></div>
      ${flash ? note(flash[0], flash[1], `<p>${flash[2]}</p>`, 'role="status"') : ""}
      ${note("err", "alert", "<p>You're offline. Check your connection, then try again.</p>", `data-offline role="status" ${navigator.onLine ? "hidden" : ""}`)}
      <form class="auth-stack" novalidate data-form>
        ${fld("email", "Work email", `<input class="input" id="au-email" type="email" autocomplete="username" spellcheck="false" autocapitalize="off" placeholder="name@brand.in" value="${esc(LS.email)}" aria-describedby="au-email-e">`)}
        ${pwField("pw", "Password", { auto: "current-password" })}
        <div class="auth-row">
          <label class="check auth-remember"><input type="checkbox" data-remember ${LS.remember ? "checked" : ""} aria-describedby="au-rem-h"><span><b>Remember me</b><span class="help" id="au-rem-h" data-remh></span></span></label>
          <a class="btn-q" href="#forgot" data-forgot>Forgot password?</a>
        </div>
        <div data-status></div>
        <p class="err" role="alert" data-ferr hidden></p>
        <button class="lq lq-p auth-go" type="submit" data-submit>Sign in ${icon("arrow", "ic")}</button>
      </form>
      <p class="auth-switch">New to Linkloom? <a class="btn-q" href="#signup">Create a brand account</a></p>${import.meta.env.VITE_TEST_HOOKS ? "" : `<p class="auth-switch">Are you a creator? <a class="btn-q" href="app.html#login">Creator sign-in</a></p>`}
      <div class="auth-sample" role="group" aria-labelledby="au-acc-l">
        <span id="au-acc-l" class="sample">Sample account</span>
        <div class="auth-acc">${Object.entries(SAMPLES)
          .map(
            ([k, v]) =>
              `<button type="button" data-acc="${k}" aria-pressed="${LS.acct === k}">${v[0]}</button>`,
          )
          .join("")}</div>
        <p class="auth-hint">Fills <b>${SAMPLE_EMAIL}</b> and <b class="num">${SAMPLE_PW}</b></p>
      </div>
      <p class="auth-legal">Linkloom is on a subscription. There is no per-deal platform fee.</p>`,
    );

    const $ = s => el.querySelector(s);
    const form = $("[data-form]"),
      email = $("#au-email"),
      pw = $("#au-pw"),
      go = $("[data-submit]"),
      statusBox = $("[data-status]"),
      ferr = $("[data-ferr]"),
      live = $("[data-live]");
    const offline = $("[data-offline]"),
      onNet = () => {
        offline.hidden = navigator.onLine;
      };
    addEventListener("online", onNet);
    addEventListener("offline", onNet);
    wireEyes(el);
    let timer = 0,
      alive = true,
      busy = false;

    const remH = $("[data-remh]"),
      rem = $("[data-remember]");
    const paintRem = () => {
      remH.textContent = rem.checked
        ? "Stay signed in for 30 days on this device."
        : "You'll be signed out when you close this tab.";
    };
    rem.addEventListener("change", () => {
      LS.remember = rem.checked;
      paintRem();
    });
    paintRem();
    $("[data-forgot]").addEventListener("click", () => {
      if (email.value.trim()) FS.email = email.value.trim();
    });

    el.querySelectorAll("[data-acc]").forEach(b =>
      b.addEventListener("click", () => {
        LS.acct = b.dataset.acc;
        const [, status, first] = SAMPLES[LS.acct];
        ACC[SAMPLE_EMAIL].status = status;
        ACC[SAMPLE_EMAIL].first = first;
        el.querySelectorAll("[data-acc]").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
        email.value = SAMPLE_EMAIL;
        pw.value = SAMPLE_PW;
        LS.email = SAMPLE_EMAIL;
        clrErr(el, "email");
        clrErr(el, "pw");
        ferr.hidden = true;
        statusBox.innerHTML = "";
        live.textContent = `Sample filled: ${SAMPLES[LS.acct][0]}`;
      }),
    );
    [email, pw].forEach(i =>
      i.addEventListener("input", () => {
        clrErr(el, i === email ? "email" : "pw");
        ferr.hidden = true;
        if (i === email) {
          LS.email = email.value;
          statusBox.innerHTML = "";
        }
      }),
    );

    function lockTick() {
      const left = Math.ceil((LS.lockEnd - now()) / 1000);
      if (left > 0) {
        go.disabled = true;
        statusBox.innerHTML = note(
          "warn",
          "lock",
          `<p class="t-label">Sign-in paused for ${mmss(left)}</p><p>Too many wrong passwords for this email, so we paused it to keep the account safe. <a class="btn-q" href="#forgot">Reset your password</a> instead.</p>`,
        );
      } else if (LS.lockEnd) {
        LS.lockEnd = 0;
        LS.tries = 0;
        go.disabled = false;
        statusBox.innerHTML = "";
      }
    }

    function showPending(addr) {
      const st = { coolEnd: LS.pendCool, sends: LS.pendSends };
      statusBox.innerHTML = note(
        "info",
        "brief",
        `<p class="t-label">Verify your email first</p>
        <p>This account is <b>pending</b>. Open the link we sent to <b>${esc(maskEmail(addr))}</b>, then sign in.</p>
        <p class="auth-resend" data-prow></p>
        <button type="button" class="btn-q auth-samplebtn" data-openlink><span class="sample">Sample</span> Open the verification link</button>`,
        'role="status"',
      );
      const paint = resender(statusBox.querySelector("[data-prow]"), st, {
        what: "link",
        onSend: () => {
          LS.pendCool = st.coolEnd;
          LS.pendSends = st.sends;
          L.toast("New link sent to " + maskEmail(addr), "send");
        },
      });
      if (!st.coolEnd) {
        st.coolEnd = LS.pendCool = now() + COOL * 1000;
      }
      paint();
      clearInterval(timer);
      timer = setInterval(() => {
        paint();
      }, 1000);
      statusBox.querySelector("[data-openlink]").addEventListener("click", () => {
        clearInterval(timer);
        const a = ACC[addr];
        if (a) a.status = "verified";
        if (addr === SAMPLE_EMAIL) {
          LS.acct = "returning";
          el.querySelectorAll("[data-acc]").forEach(x =>
            x.setAttribute("aria-pressed", String(x.dataset.acc === "returning")),
          );
        }
        statusBox.innerHTML = note(
          "ok",
          "check",
          '<p class="t-label">Email verified</p><p>Your account is active. Sign in to continue.</p>',
          'role="status"',
        );
        mo("check", statusBox.querySelector("svg"));
        go.focus();
      });
    }

    form.addEventListener("submit", e => {
      e.preventDefault();
      if (busy) return;
      ferr.hidden = true;
      const em = email.value.trim().toLowerCase(),
        p = pw.value;
      let bad = false;
      const ee = vEmail(em);
      if (ee) {
        errAt(el, "email", ee);
        bad = true;
      }
      if (!p) {
        errAt(el, "pw", "Enter your password.");
        bad = true;
      }
      if (bad) {
        focusFirstErr(el);
        return;
      }
      if (!navigator.onLine) {
        onNet();
        ferr.hidden = false;
        ferr.textContent = "You're offline, so we couldn't sign you in. Try again when you're connected.";
        return;
      }
      if (LS.lockEnd > now()) {
        lockTick();
        return;
      }
      busy = true;
      go.setAttribute("aria-busy", "true");
      setLabel(go, "Signing in…");
      clearInterval(timer);
      setTimeout(() => {
        busy = false;
        if (!alive) return;
        go.removeAttribute("aria-busy");
        setLabel(go, "Sign in");
        if (!emailTaken(em) && !ACC[em]) {
          errAt(
            el,
            "email",
            `There's no Linkloom account for this email. Check for a typo, or <a class="btn-q" href="#signup">create one</a>.`,
          );
          email.focus();
          return;
        }
        const a = ACC[em];
        if (!a || a.pw !== p) {
          LS.tries++;
          const left = PW_TRIES - LS.tries;
          mo("shake", form.querySelector(".auth-pw"));
          if (left <= 0) {
            LS.lockEnd = now() + PW_LOCK * 1000;
            lockTick();
            timer = setInterval(lockTick, 1000);
            live.textContent = "Sign-in paused for 15 minutes.";
            return;
          }
          errAt(
            el,
            "pw",
            `Email or password is wrong. ${left} ${left === 1 ? "try" : "tries"} left before we pause sign-in for 15 minutes.`,
          );
          pw.select();
          pw.focus();
          return;
        }
        LS.tries = 0;
        if (a.status === "pending") {
          showPending(em);
          live.textContent = "Verify your email first.";
          return;
        }
        if (a.status === "blocked") {
          statusBox.innerHTML = note(
            "err",
            "alert",
            `<p class="t-label">This account is blocked</p>
            <p>You can't sign in while it's blocked. Contact support and quote reference <b class="num">LL-B-2041</b>. We reply within one working day.</p>
            <a class="btn-q" href="mailto:${SUPPORT}?subject=Blocked%20account%20LL-B-2041">${icon("send")}${SUPPORT}</a>`,
            'role="alert"',
          );
          return;
        }
        store.set(s => {
          const ss = s.session;
          ss.signedIn = true;
          ss.status = "verified";
          ss.remember = LS.remember;
          ss.expired = false;
          ss.email = em;
          ss.firstRun = !!a.first;
          ss.since = new Date().toISOString();
        }, "signed-in");
        a.first = false;
        if (em === SAMPLE_EMAIL && LS.acct === "first") {
          LS.acct = "returning";
        }
        LS.email = em;
        pw.value = "";
        L.toast(store.s.session.firstRun ? "Signed in. Set up your brand profile." : "Signed in", "check");
        L.go(store.s.session.firstRun ? "#setup" : "#home");
      }, 650);
    });

    if (flash) el.querySelector("[data-h]").focus({ preventScroll: true });
    if (LS.lockEnd > now()) {
      lockTick();
      timer = setInterval(lockTick, 1000);
    }
    return () => {
      alive = false;
      clearInterval(timer);
      removeEventListener("online", onNet);
      removeEventListener("offline", onNet);
    };
  }

  /* =====================================================================
     #signup: email + mobile → verify email link → verify mobile OTP → password + terms → done
     ===================================================================== */
  const STEPS = [
    { t: "Email and mobile", sub: "One email and one mobile number per brand account." },
    { t: "Verify your email", sub: "We sent a link. Open it on any device to confirm the address is yours." },
    { t: "Verify your mobile", sub: "Enter the 6-digit code we texted you." },
    { t: "Create a password", sub: "You'll use it with your email to sign in." },
  ];
  let SU = null;
  const freshSU = () => ({
    step: 0,
    reached: 0,
    email: "",
    mobile: "",
    emailOk: false,
    mobileOk: false,
    eCool: 0,
    eSends: 0,
    mCool: 0,
    mSends: 0,
    tries: 0,
    terms: false,
    done: false,
  });

  function renderSignup(el) {
    if (!SU || SU.done) SU = freshSU();
    el.innerHTML = shell(
      art(
        "Start hiring in four short steps.",
        "Brands verify once. Creators see a real, checked brand.",
        `<ol class="auth-rail" data-rail></ol><div class="auth-prog" aria-hidden="true">${STEPS.map(() => "<span></span>").join("")}</div>`,
      ),
      `<div class="auth-head"><p class="t-eyebrow muted" data-count></p><h1 class="t-h1" tabindex="-1" data-h></h1><p class="muted" data-sub></p></div>
       <div class="auth-stack" data-body></div>
       <p class="auth-switch" data-switch>Already have an account? <a class="btn-q" href="#login">Sign in</a></p>`,
      "auth-signup",
    );
    const $ = s => el.querySelector(s);
    const body = $("[data-body]"),
      live = $("[data-live]");
    let timer = 0,
      alive = true,
      railAt = null,
      otp = null;

    function paintRail() {
      const done = SU.done;
      $("[data-rail]").innerHTML = STEPS.map((s, i) => {
        const state = done || i < SU.step ? "done" : i === SU.step ? "now" : "next";
        const can = !done && i < SU.step && i === 0; // only the first step can be revisited (to change email or mobile)
        const inner = `<span class="auth-rail-n">${state === "done" ? icon("check") : "0" + (i + 1)}</span><span class="auth-rail-t">${esc(s.t)}</span>`;
        return `<li class="auth-rail-i is-${state}" ${state === "now" ? 'aria-current="step"' : ""}>${can ? `<button type="button" data-goto="${i}">${inner}<span class="sr-only">, change</span></button>` : `<span class="auth-rail-b">${inner}</span>`}</li>`;
      }).join("");
      el.querySelectorAll(".auth-prog span").forEach((b, i) => {
        b.className = done || i < SU.step ? "is-done" : i === SU.step ? "is-now" : "";
      });
      el.querySelectorAll("[data-goto]").forEach(b =>
        b.addEventListener("click", () => go(+b.dataset.goto, -1)),
      );
      const ns = el.querySelectorAll(".auth-rail-n"),
        at = done ? STEPS.length - 1 : SU.step;
      if (railAt != null && at > railAt && ns[railAt] && ns[at])
        mo("pull", ns[railAt], ns[at], { color: "butter" });
      railAt = at;
    }

    function paint(focus, dir) {
      clearInterval(timer);
      const draw = () => {
        if (SU.done) {
          $("[data-count]").textContent = "Done";
          $("[data-h]").textContent = "Account created";
          $("[data-sub]").textContent = "";
          $("[data-switch]").hidden = true;
          body.innerHTML = stepDone();
        } else {
          const s = STEPS[SU.step];
          $("[data-count]").textContent = `Step ${SU.step + 1} of ${STEPS.length}`;
          $("[data-h]").textContent = s.t;
          $("[data-sub]").textContent = s.sub;
          $("[data-switch]").hidden = SU.step > 0;
          body.innerHTML = [stepContact, stepEmail, stepMobile, stepPassword][SU.step]();
        }
        L.liquid(body);
        wireEyes(body);
        (SU.done ? wireDone : [wireContact, wireEmail, wireMobile, wirePassword][SU.step])();
      };
      if (dir && L.motion && L.motion.swap) {
        try {
          L.motion.swap(body, draw, { dir });
        } catch (e) {
          draw();
        }
      } else draw();
      paintRail();
      if (focus) {
        $("[data-h]").focus({ preventScroll: true });
        window.scrollTo({ top: 0 });
      }
      live.textContent = SU.done
        ? "Account created"
        : `Step ${SU.step + 1} of ${STEPS.length}: ${STEPS[SU.step].t}`;
    }
    function go(i, dir = 1) {
      SU.step = i;
      SU.reached = Math.max(SU.reached, i);
      paint(true, dir);
    }

    /* ---- step 1: email + mobile, with live "already registered" checks ---- */
    function stepContact() {
      return `<form class="auth-stack" novalidate data-form>
        ${fld("email", "Work email", `<input class="input" id="au-email" type="email" autocomplete="email" spellcheck="false" autocapitalize="off" placeholder="name@brand.in" value="${esc(SU.email)}" aria-describedby="au-email-e au-email-ok">`)}
        <p class="auth-avail" id="au-email-ok" data-avail="email" aria-live="polite"></p>
        ${fld("mobile", "Mobile number", `<div class="auth-tel"><span aria-hidden="true">+91</span><input class="input" id="au-mobile" type="tel" inputmode="numeric" autocomplete="tel-national" maxlength="11" placeholder="98765 43210" value="${esc(fmtPhone(SU.mobile))}" aria-describedby="au-mobile-h au-mobile-e au-mobile-ok"></div>`, "For sign-in alerts and payment confirmations. Never shown to creators.")}
        <p class="auth-avail" id="au-mobile-ok" data-avail="mobile" aria-live="polite"></p>
        <button class="lq lq-p auth-go" type="submit" data-next>Send verification ${icon("arrow", "ic")}</button>
        <p class="auth-hint"><span class="sample">Sample</span> Already registered: <b>meera@mirevo.in</b> and <b class="num">98200 12345</b></p>
      </form>`;
    }
    function wireContact() {
      const f = $("[data-form]"),
        em = $("#au-email"),
        mb = $("#au-mobile");
      const av = k => el.querySelector(`[data-avail="${k}"]`);
      const timers = {};
      const ok = (k, txt) => {
        const a = av(k);
        a.className = "auth-avail is-ok";
        a.innerHTML = `${icon("check")}${txt}`;
      };
      const off = k => {
        const a = av(k);
        a.className = "auth-avail";
        a.textContent = "";
      };
      function checkEmail(final) {
        const v = em.value.trim().toLowerCase();
        off("email");
        const e = vEmail(v);
        if (e) {
          if (final) errAt(el, "email", e);
          return false;
        }
        if (emailTaken(v)) {
          errAt(
            el,
            "email",
            `This email already has a Linkloom account. <a class="btn-q" href="#login" data-signin>Sign in instead</a> or use another email.`,
          );
          return false;
        }
        clrErr(el, "email");
        ok("email", "No account uses this email yet");
        return true;
      }
      function checkMobile(final) {
        const d = mb.value.replace(/\D/g, "");
        off("mobile");
        const e = vMobile(d);
        if (e) {
          if (final) errAt(el, "mobile", e);
          return false;
        }
        if (mobileTaken(d)) {
          errAt(
            el,
            "mobile",
            'This number is linked to another account. One mobile number can hold one account. Use a different number, or <a class="btn-q" href="#login">sign in</a>.',
          );
          return false;
        }
        clrErr(el, "mobile");
        ok("mobile", "Number is free to use");
        return true;
      }
      em.addEventListener("input", () => {
        SU.email = em.value;
        clrErr(el, "email");
        off("email");
        clearTimeout(timers.e);
        timers.e = setTimeout(() => checkEmail(false), 450);
      });
      em.addEventListener("blur", () => {
        if (em.value.trim()) checkEmail(false);
      });
      mb.addEventListener("input", () => {
        const d = mb.value.replace(/\D/g, "").slice(0, 10);
        mb.value = fmtPhone(d);
        SU.mobile = d;
        clrErr(el, "mobile");
        off("mobile");
        clearTimeout(timers.m);
        if (d.length === 10) timers.m = setTimeout(() => checkMobile(false), 300);
      });
      f.addEventListener("click", e => {
        if (e.target.closest("[data-signin]")) LS.email = em.value.trim();
      });
      if (SU.email) checkEmail(false);
      if (SU.mobile.length === 10) checkMobile(false);
      f.addEventListener("submit", e => {
        e.preventDefault();
        const a = checkEmail(true),
          b = checkMobile(true);
        if (!a || !b) {
          focusFirstErr(el);
          return;
        }
        if (!navigator.onLine) {
          L.toast("You're offline. Try again when you're connected.", "alert");
          return;
        }
        const btn = $("[data-next]");
        setLabel(btn, "Sending…");
        btn.disabled = true;
        setTimeout(() => {
          if (!alive) return;
          const changedEmail = SU.verifiedEmail !== SU.email.trim().toLowerCase(),
            changedMobile = SU.verifiedMobile !== SU.mobile;
          SU.email = SU.email.trim().toLowerCase();
          if (changedEmail) {
            SU.emailOk = false;
            SU.eCool = now() + COOL * 1000;
            SU.eSends = 0;
          }
          if (changedMobile) {
            SU.mobileOk = false;
            SU.mCool = 0;
            SU.mSends = 0;
            SU.tries = 0;
          }
          go(SU.emailOk ? (SU.mobileOk ? 3 : 2) : 1);
        }, 500);
      });
    }

    /* ---- step 2: email link ---- */
    function stepEmail() {
      return `<div class="auth-mail">
          <img src="assets/step-01-envelope.svg" width="140" height="103" alt="">
          <div class="auth-mail-t">
            <p>Sent to <b>${esc(SU.email)}</b></p>
            <span class="pill ${SU.emailOk ? "pill-ok" : "pill-info"}" data-epill>${SU.emailOk ? icon("check") + "Email verified" : icon("clock") + "Waiting for you to open it"}</span>
          </div>
        </div>
        <p class="help">The link works once and expires in 24 hours. Check spam or promotions if it isn't there.</p>
        <p class="auth-resend" data-erow ${SU.emailOk ? "hidden" : ""}></p>
        <div class="auth-acts">
          <button class="lq lq-p" type="button" data-next ${SU.emailOk ? "" : "disabled"}>Continue</button>
          <button class="btn-q" type="button" data-change>Change email</button>
        </div>
        <button type="button" class="btn-q auth-samplebtn" data-openlink ${SU.emailOk ? "hidden" : ""}><span class="sample">Sample</span> Open the link from the email</button>`;
    }
    function wireEmail() {
      const st = { coolEnd: SU.eCool, sends: SU.eSends };
      const paintR = resender($("[data-erow]"), st, {
        what: "link",
        onSend: () => {
          SU.eCool = st.coolEnd;
          SU.eSends = st.sends;
          L.toast("New link sent to " + SU.email, "send");
          live.textContent = "New link sent";
        },
      });
      paintR();
      if (!SU.emailOk) timer = setInterval(paintR, 1000);
      $("[data-change]").addEventListener("click", () => go(0, -1));
      $("[data-next]").addEventListener("click", () => go(2));
      $("[data-openlink]").addEventListener("click", () => {
        SU.emailOk = true;
        SU.verifiedEmail = SU.email;
        clearInterval(timer);
        const pill = $("[data-epill]"),
          html = icon("check") + "Email verified";
        if (L.motion && L.motion.morph) mo("morph", pill, { cls: "pill pill-ok", html });
        else {
          pill.className = "pill pill-ok";
          pill.innerHTML = html;
        }
        setTimeout(() => mo("check", pill), 120);
        $("[data-erow]").hidden = true;
        $("[data-openlink]").hidden = true;
        const nx = $("[data-next]");
        nx.disabled = false;
        nx.focus();
        live.textContent = "Email verified. Continue to verify your mobile.";
      });
    }

    /* ---- step 3: mobile OTP ---- */
    function stepMobile() {
      return `<form class="auth-stack" novalidate data-form>
          <p class="muted">Sent to <b class="num">+91 ${esc(fmtPhone(SU.mobile))}</b> · <button type="button" class="btn-q" data-change>Change number</button></p>
          <div data-otp></div>
          <p class="err" aria-live="assertive" data-oerr></p>
          <button class="lq lq-p auth-go" type="submit" data-verify disabled>Verify mobile</button>
          <div class="auth-resend-wrap"><p class="auth-resend" data-mrow></p>
            <p class="auth-hint"><span class="sample">Sample</span> code: <b class="num">${OTP.slice(0, 3)} ${OTP.slice(3)}</b></p></div>
        </form>`;
    }
    function wireMobile() {
      const f = $("[data-form]"),
        v = $("[data-verify]"),
        err = $("[data-oerr]");
      if (!SU.mCool) SU.mCool = now() + COOL * 1000;
      const st = { coolEnd: SU.mCool, sends: SU.mSends };
      otp = otpBoxes($("[data-otp]"), {
        onFull: full => {
          v.disabled = !full;
          err.textContent = "";
          if (full) v.focus();
        },
      });
      const paintR = resender($("[data-mrow]"), st, {
        what: "code",
        onSend: () => {
          SU.mCool = st.coolEnd;
          SU.mSends = st.sends;
          SU.tries = 0;
          otp.clear();
          otp.disable(false);
          otp.focus();
          err.textContent = "";
          L.toast("New code sent to +91 " + fmtPhone(SU.mobile), "send");
        },
      });
      paintR();
      timer = setInterval(paintR, 1000);
      $("[data-change]").addEventListener("click", () => go(0, -1));
      mo("stagger", otp.boxes);
      if (SU.tries >= OTP_TRIES) {
        otp.disable(true);
        err.textContent = "Too many wrong codes. Ask for a new code to try again.";
      } else setTimeout(() => otp.focus(), 50);
      f.addEventListener("submit", e => {
        e.preventDefault();
        if (v.disabled) return;
        setLabel(v, "Checking…");
        v.disabled = true;
        setTimeout(() => {
          if (!alive) return;
          setLabel(v, "Verify mobile");
          if (otp.code() === OTP) {
            SU.mobileOk = true;
            SU.verifiedMobile = SU.mobile;
            L.toast("Mobile verified", "check");
            go(3);
            return;
          }
          SU.tries++;
          const left = OTP_TRIES - SU.tries;
          otp.bad();
          if (left <= 0) {
            otp.disable(true);
            err.textContent = "Too many wrong codes. Ask for a new code to try again.";
            return;
          }
          err.textContent = `That code doesn't match. ${left} ${left === 1 ? "try" : "tries"} left.`;
        }, 600);
      });
    }

    /* ---- step 4: password, confirm, terms ---- */
    function stepPassword() {
      return `<form class="auth-stack" novalidate data-form>
          <div class="auth-verified">
            <span><b>${esc(SU.email)}</b><span class="pill pill-ok">${icon("check")}Verified</span></span>
            <span><b class="num">+91 ${esc(fmtPhone(SU.mobile))}</b><span class="pill pill-ok">${icon("check")}Verified</span></span>
          </div>
          ${pwField("pw", "Password", { desc: "au-rules" })}
          ${rulesHTML("au-rules")}
          ${pwField("pw2", "Confirm password")}
          <p class="auth-avail" data-match aria-live="polite"></p>
          <div class="field" data-f="terms"><label class="check auth-terms"><input type="checkbox" id="au-terms" ${SU.terms ? "checked" : ""} aria-describedby="au-terms-e"><span>I accept Linkloom's <button type="button" class="btn-q" data-doc="terms">Terms</button> and <button type="button" class="btn-q" data-doc="privacy">Privacy Policy</button>, including escrow and refund rules.</span></label><p class="err" id="au-terms-e" aria-live="polite"></p></div>
          <button class="lq lq-p auth-go" type="submit" data-create>Create account</button>
        </form>`;
    }
    function wirePassword() {
      const f = $("[data-form]"),
        p1 = $("#au-pw"),
        p2 = $("#au-pw2"),
        rules = $("#au-rules"),
        match = $("[data-match]"),
        terms = $("#au-terms");
      const paintMatch = () => {
        if (!p2.value) {
          match.className = "auth-avail";
          match.textContent = "";
          return;
        }
        if (p1.value === p2.value) {
          match.className = "auth-avail is-ok";
          match.innerHTML = icon("check") + "Passwords match";
          clrErr(el, "pw2");
        } else if (p2.value.length >= p1.value.length) {
          match.className = "auth-avail is-no";
          match.innerHTML = icon("close") + "These don't match yet";
        } else {
          match.className = "auth-avail";
          match.textContent = "";
        }
      };
      p1.addEventListener("input", () => {
        updRules(rules, p1.value);
        clrErr(el, "pw");
        paintMatch();
      });
      p2.addEventListener("input", paintMatch);
      terms.addEventListener("change", () => {
        SU.terms = terms.checked;
        clrErr(el, "terms");
      });
      el.querySelectorAll("[data-doc]").forEach(b =>
        b.addEventListener("click", () => openDoc(b.dataset.doc)),
      );
      updRules(rules, "");
      f.addEventListener("submit", e => {
        e.preventDefault();
        let bad = false;
        if (!p1.value) {
          errAt(el, "pw", "Create a password.");
          bad = true;
        } else if (!pwOk(p1.value)) {
          errAt(el, "pw", "Your password needs everything in the list below.");
          bad = true;
        } else if (p1.value.toLowerCase().includes(SU.email.split("@")[0])) {
          errAt(el, "pw", "Don't use your email name in the password.");
          bad = true;
        }
        if (!bad && p2.value !== p1.value) {
          errAt(
            el,
            "pw2",
            p2.value ? "The two passwords don't match." : "Type the password again to confirm it.",
          );
          bad = true;
        }
        if (!terms.checked) {
          errAt(el, "terms", "Accept the terms to create your account.");
          bad = true;
        }
        if (bad) {
          const i = el.querySelector(".field.is-err input");
          i && i.focus();
          return;
        }
        const b = $("[data-create]");
        setLabel(b, "Creating account…");
        b.disabled = true;
        setTimeout(() => {
          if (!alive) return;
          ACC[SU.email] = { pw: p1.value, status: "verified", first: true };
          store.set(s => {
            s.taken.emails.push(SU.email);
            s.taken.mobiles.push(SU.mobile);
          }, "account-created");
          SU.done = true;
          LS.email = SU.email;
          LS.acct = "";
          paint(true, 1);
        }, 700);
      });
    }

    /* ---- done ---- */
    const stepDone = () => `<div class="auth-done">
        <span class="auth-done-ic" data-doneic>${icon("check")}</span>
        <p class="auth-done-t">Your brand account for <b>${esc(SU.email)}</b> is ready.</p>
        <p class="muted">Next, sign in and add your brand name, logo and billing details. It takes about two minutes.</p>
        <a class="lq lq-p auth-go" href="#login-new" data-tologin>Go to sign in ${icon("arrow", "ic")}</a>
      </div>`;
    function wireDone() {
      mo("check", $("[data-doneic]"), { color: "ink" });
      setTimeout(() => {
        const a = $("[data-tologin]");
        a && a.focus({ preventScroll: true });
      }, 400);
    }

    paint(false);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }

  function openDoc(kind) {
    L.openSheet({
      title: kind === "terms" ? "Terms, in short" : "Privacy, in short",
      body: `<div class="auth-doc">${
        kind === "terms"
          ? `<ul><li>Brands pay the agreed price into escrow after a creator accepts. Linkloom holds it.</li><li>Money is released to the creator only when you approve the work.</li><li>If a creator rejects after payment or does not deliver, the escrow is refunded to you.</li><li>Linkloom is a subscription. There is no per-deal platform fee. Taxes as per confirmed rules.</li></ul>`
          : `<ul><li>Your email and mobile are used for sign-in, verification and payment alerts.</li><li>Creators see your brand name, logo, website and industry. Never your mobile or billing details.</li><li>Chat with a creator opens only after you pay into escrow.</li></ul>`
      }
        <p class="sample">Sample summary. The full text appears here in the live product.</p></div>`,
    });
  }

  /* =====================================================================
     #forgot: email → reset link (single use, 30 min)
     ===================================================================== */
  const FS = { email: "", sent: false, coolEnd: 0, sends: 0 };
  const TOK = {}; // token -> { email, issued, used }
  const newToken = (email, ageSec = 0) => {
    const t = Math.random().toString(36).slice(2, 10);
    TOK[t] = { email, issued: now() - ageSec * 1000, used: false };
    return t;
  };

  function renderForgot(el) {
    el.innerHTML = shell(
      art("Locked out? Back in two minutes.", "Reset links work once and expire after 30 minutes"),
      `<div class="auth-head"><a class="btn-q auth-back" href="#login">${icon("back")}Back to sign in</a><h1 class="t-h1" tabindex="-1" data-h>Reset your password</h1>
        <p class="muted" data-sub></p></div>
       <div class="auth-stack" data-body></div>`,
    );
    const $ = s => el.querySelector(s),
      body = $("[data-body]"),
      live = $("[data-live]");
    let timer = 0,
      alive = true;

    function paintAsk() {
      $("[data-sub]").textContent =
        "Enter the email you sign in with. We'll send a link to choose a new password.";
      body.innerHTML = `<form class="auth-stack" novalidate data-form>
          ${fld("email", "Work email", `<input class="input" id="au-email" type="email" autocomplete="username" spellcheck="false" autocapitalize="off" placeholder="name@brand.in" value="${esc(FS.email || LS.email)}" aria-describedby="au-email-e">`)}
          <button class="lq lq-p auth-go" type="submit" data-send>Send reset link ${icon("arrow", "ic")}</button>
        </form>`;
      L.liquid(body);
      const f = $("[data-form]"),
        em = $("#au-email");
      em.addEventListener("input", () => clrErr(el, "email"));
      f.addEventListener("submit", e => {
        e.preventDefault();
        const v = em.value.trim().toLowerCase(),
          er = vEmail(v);
        if (er) {
          errAt(el, "email", er);
          em.focus();
          return;
        }
        if (!navigator.onLine) {
          errAt(el, "email", "You're offline, so we couldn't send the link.");
          return;
        }
        const b = $("[data-send]");
        setLabel(b, "Sending…");
        b.disabled = true;
        setTimeout(() => {
          if (!alive) return;
          FS.email = v;
          FS.sent = true;
          FS.coolEnd = now() + COOL * 1000;
          FS.sends = 0;
          FS.tok = emailTaken(v) || ACC[v] ? newToken(v) : null;
          paintSent(true);
        }, 600);
      });
    }
    function paintSent(fresh) {
      const known = !!FS.tok;
      $("[data-sub]").textContent = "";
      body.innerHTML = `<div class="auth-mail">
          <img src="assets/step-01-envelope.svg" width="140" height="103" alt="">
          <div class="auth-mail-t"><p class="t-h3">Check your inbox</p><p>If <b>${esc(FS.email)}</b> has a Linkloom account, a reset link is on its way.</p></div>
        </div>
        <ul class="auth-facts"><li>${icon("clock")}Expires in 30 minutes</li><li>${icon("lock")}Works once, then it's used up</li></ul>
        <p class="auth-resend" data-row></p>
        <div class="auth-acts"><a class="lq lq-s" href="#login">Back to sign in</a><button class="btn-q" type="button" data-other>Use a different email</button></div>
        <div class="auth-samples">
          <span class="sample">Sample</span>
          ${known ? `<button type="button" class="btn-q" data-open>Open the reset link</button><button type="button" class="btn-q" data-old>Open an expired link</button>` : `<span class="auth-hint">No link for this email: it has no account. Try ${SAMPLE_EMAIL}.</span>`}
        </div>`;
      L.liquid(body);
      const paintR = resender($("[data-row]"), FS, {
        what: "link",
        onSend: () => {
          if (FS.tok) {
            Object.values(TOK).forEach(t => {
              if (t.email === FS.email) t.used = true;
            });
            FS.tok = newToken(FS.email);
          }
          L.toast("New link sent. Older links no longer work.", "send");
        },
      });
      paintR();
      clearInterval(timer);
      timer = setInterval(paintR, 1000);
      $("[data-other]").addEventListener("click", () => {
        FS.sent = false;
        clearInterval(timer);
        paintAsk();
        $("#au-email").select();
        $("#au-email").focus();
      });
      const op = $("[data-open]");
      op && op.addEventListener("click", () => L.go("#reset-" + FS.tok));
      const old = $("[data-old]");
      old && old.addEventListener("click", () => L.go("#reset-" + newToken(FS.email, RESET_TTL + 600)));
      if (fresh) {
        live.textContent = "Reset link sent";
        mo("stagger", [...body.children]);
      }
    }
    FS.sent ? paintSent(false) : paintAsk();
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }

  /* =====================================================================
     #reset-<token>: new password; link single use + expiry
     ===================================================================== */
  function renderReset(el, tok) {
    const t = tok && TOK[tok];
    const age = t ? (now() - t.issued) / 1000 : Infinity;
    const state = !t || age > RESET_TTL ? "expired" : t.used ? "used" : "ok";
    el.innerHTML = shell(
      art("A fresh password, and you're in.", "Reset links work once and expire after 30 minutes"),
      `<div class="auth-head"><a class="btn-q auth-back" href="#login">${icon("back")}Back to sign in</a><h1 class="t-h1" tabindex="-1" data-h></h1><p class="muted" data-sub></p></div>
       <div class="auth-stack" data-body></div>`,
    );
    const $ = s => el.querySelector(s),
      body = $("[data-body]"),
      h = $("[data-h]"),
      sub = $("[data-sub]");
    let timer = 0,
      alive = true;
    const toForgot = () => {
      FS.sent = false;
      if (t) FS.email = t.email;
      L.go("#forgot");
    };

    if (state === "expired") {
      h.textContent = "This link has expired";
      sub.textContent =
        "Reset links work for 30 minutes after we send them. Ask for a new one; it only takes a moment.";
      body.innerHTML = `${note("warn", "clock", "<p>For your safety, old links stop working even if they were never opened.</p>")}
        <div class="auth-acts"><button class="lq lq-p" type="button" data-again>Send a new link</button><a class="btn-q" href="#login">Sign in</a></div>`;
    } else if (state === "used") {
      h.textContent = "This link was already used";
      sub.textContent =
        "Each reset link works once. If you just changed your password, sign in with the new one.";
      body.innerHTML = `${note("info", "lock", `<p>Didn't change it yourself? Reset it again now and write to <a class="btn-q" href="mailto:${SUPPORT}">${SUPPORT}</a>.</p>`)}
        <div class="auth-acts"><a class="lq lq-p" href="#login">Sign in</a><button class="btn-q" type="button" data-again>Send a new link</button></div>`;
    } else {
      h.textContent = "Choose a new password";
      sub.innerHTML = `For <b>${esc(t.email)}</b>. This link expires in <b class="num" data-left></b>.`;
      body.innerHTML = `<form class="auth-stack" novalidate data-form>
          ${pwField("pw", "New password", { desc: "au-rules" })}
          ${rulesHTML("au-rules")}
          ${pwField("pw2", "Confirm new password")}
          <p class="auth-avail" data-match aria-live="polite"></p>
          <button class="lq lq-p auth-go" type="submit" data-save>Save new password</button>
        </form>`;
      wireEyes(body);
      const left = $("[data-left]");
      const tick = () => {
        const s = Math.max(0, Math.ceil(RESET_TTL - (now() - t.issued) / 1000));
        left.textContent = mmss(s);
        if (!s) {
          clearInterval(timer);
          L.route();
        }
      };
      tick();
      timer = setInterval(tick, 1000);
      const p1 = $("#au-pw"),
        p2 = $("#au-pw2"),
        rules = $("#au-rules"),
        match = $("[data-match]");
      const paintMatch = () => {
        if (!p2.value) {
          match.className = "auth-avail";
          match.textContent = "";
          return;
        }
        if (p1.value === p2.value) {
          match.className = "auth-avail is-ok";
          match.innerHTML = icon("check") + "Passwords match";
          clrErr(el, "pw2");
        } else if (p2.value.length >= p1.value.length) {
          match.className = "auth-avail is-no";
          match.innerHTML = icon("close") + "These don't match yet";
        } else {
          match.className = "auth-avail";
          match.textContent = "";
        }
      };
      p1.addEventListener("input", () => {
        updRules(rules, p1.value);
        clrErr(el, "pw");
        paintMatch();
      });
      p2.addEventListener("input", paintMatch);
      updRules(rules, "");
      $("[data-form]").addEventListener("submit", e => {
        e.preventDefault();
        const a = ACC[t.email];
        let bad = false;
        if (!pwOk(p1.value)) {
          errAt(
            el,
            "pw",
            p1.value ? "Your password needs everything in the list below." : "Choose a new password.",
          );
          bad = true;
        } else if (a && a.pw === p1.value) {
          errAt(el, "pw", "That's your current password. Choose a new one.");
          bad = true;
        }
        if (!bad && p1.value !== p2.value) {
          errAt(el, "pw2", p2.value ? "The two passwords don't match." : "Type the new password again.");
          bad = true;
        }
        if (bad) {
          focusFirstErr(el);
          return;
        }
        if (TOK[tok].used || (now() - t.issued) / 1000 > RESET_TTL) {
          L.route();
          return;
        }
        const b = $("[data-save]");
        setLabel(b, "Saving…");
        b.disabled = true;
        setTimeout(() => {
          if (!alive) return;
          clearInterval(timer);
          if (a) a.pw = p1.value;
          else ACC[t.email] = { pw: p1.value, status: "verified", first: false };
          Object.values(TOK).forEach(x => {
            if (x.email === t.email) x.used = true;
          });
          if (t.email === SAMPLE_EMAIL)
            store.set(s => {
              s.me.passwordChanged = new Date(L.today().getTime() + 198e5).toISOString().slice(0, 10);
            }, "password-reset");
          LS.email = t.email;
          FS.sent = false;
          h.textContent = "Password updated";
          sub.textContent = "";
          body.innerHTML = `<div class="auth-done"><span class="auth-done-ic" data-doneic>${icon("check")}</span>
            <p class="auth-done-t">You can sign in with your new password now.</p>
            <p class="muted">This reset link is now used up. Other devices signed in to this account were signed out.</p>
            <a class="lq lq-p auth-go" href="#login-reset" data-tologin>Sign in ${icon("arrow", "ic")}</a></div>`;
          L.liquid(body);
          mo("check", $("[data-doneic]"), { color: "ink" });
          h.focus({ preventScroll: true });
        }, 600);
      });
    }
    const ag = $("[data-again]");
    ag && ag.addEventListener("click", toForgot);
    L.liquid(body);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }

  L.auth = {
    RULES,
    pwOk,
    rulesHTML,
    updRules,
    pwField,
    wireEyes,
    signOut,
    checkCurrent,
    setPassword,
    maskEmail,
    fmtPhone,
    vEmail,
  };
  L.register("login", { title: "Sign in", shell: "focus", auth: false, render: renderLogin });
  L.register("signup", {
    title: "Create a brand account",
    shell: "focus",
    auth: false,
    render: renderSignup,
  });
  L.register("forgot", { title: "Reset your password", shell: "focus", auth: false, render: renderForgot });
  L.register("reset", { title: "Choose a new password", shell: "focus", auth: false, render: renderReset });
})();
