// @ts-nocheck
/* kyc screen (Builder A): verification and payout setup, opened by LLD.kycGate(jobId) on the first Bid.
   State machine (kyc.status): not_started → in_progress → under_review → verified | action_needed | rejected.
   action_needed and rejected lead back into in_progress for the flagged step only, then to review again.
   Steps: PAN, identity proof, selfie (only for document uploads), payout (UPI or bank), GST (optional), review.
   The selected job (kyc.returnTo) is kept throughout; once verified the creator goes straight back to it.
   Privacy: raw numbers live only in this module's draft while typing. The store keeps masked values only. */
(() => {
  const { esc, icon, store } = LLD;
  const LIVE = !import.meta.env.VITE_TEST_HOOKS;
  const STEPS = [
    {
      id: "pan",
      t: "PAN",
      h: "Your PAN",
      why: "Payments to you are recorded against your PAN for tax. We check it once.",
      art: "trust-id-card",
    },
    {
      id: "id",
      t: "Identity proof",
      h: "Confirm it's you",
      why: "An ID shows the PAN really belongs to you. Brands never see it.",
      art: "trust-id-card",
    },
    { id: "selfie", t: "Selfie", h: "A quick selfie", why: "", art: "trust-id-card" },
    {
      id: "payout",
      t: "Payout",
      h: "Where should we pay you?",
      why: "Approved work is paid out here from escrow. You can change it later.",
      art: "trust-lock-coin",
    },
    {
      id: "gst",
      t: "GST",
      h: "GST, if you have it",
      why: "Only if you're registered for GST. Most individual creators aren't, and you can add it later.",
      art: "step-05-stamp",
    },
  ].filter(s => !LIVE || (s.id !== "selfie" && s.id !== "gst"));
  const REVIEW = STEPS.length;
  const IDS = {
    Aadhaar: {
      re: /^[2-9]\d{11}$/,
      clean: v => v.replace(/\D/g, ""),
      ph: "1234 5678 9012",
      fmt: v =>
        v
          .replace(/\D/g, "")
          .slice(0, 12)
          .replace(/(\d{4})(?=\d)/g, "$1 "),
      err: "Aadhaar numbers have 12 digits and don't start with 0 or 1.",
      mask: v => "•••• •••• " + v.slice(-4),
    },
    Passport: {
      re: /^[A-Z][0-9]{7}$/,
      clean: v => v.toUpperCase().replace(/[^A-Z0-9]/g, ""),
      ph: "K1234567",
      err: "A passport number is 1 letter and 7 digits, like K1234567.",
      mask: v => "••••" + v.slice(-4),
    },
    "Voter ID": {
      re: /^[A-Z]{3}[0-9]{7}$/,
      clean: v => v.toUpperCase().replace(/[^A-Z0-9]/g, ""),
      ph: "ABC1234567",
      err: "A Voter ID (EPIC) number is 3 letters and 7 digits.",
      mask: v => "••••" + v.slice(-4),
    },
    "Driving licence": {
      re: /^[A-Z]{2}[0-9]{2}[0-9A-Z]{9,12}$/,
      clean: v => v.toUpperCase().replace(/[^A-Z0-9]/g, ""),
      ph: "MH0120190012345",
      err: "Use the number printed on your licence, like MH0120190012345.",
      mask: v => "••••" + v.slice(-4),
    },
  };
  const BANKS = {
    HDFC: "HDFC Bank",
    ICIC: "ICICI Bank",
    SBIN: "State Bank of India",
    UTIB: "Axis Bank",
    KKBK: "Kotak Mahindra Bank",
    PUNB: "Punjab National Bank",
    BARB: "Bank of Baroda",
    YESB: "Yes Bank",
    IDIB: "Indian Bank",
    CNRB: "Canara Bank",
    UBIN: "Union Bank of India",
    IDFB: "IDFC First Bank",
    INDB: "IndusInd Bank",
    FDRL: "Federal Bank",
  };
  const STATUS = {
    not_started: ["pill-paper", "Not started"],
    in_progress: ["pill-info", "In progress"],
    under_review: ["pill-info", "Under review"],
    verified: ["pill-ok", "Verified"],
    action_needed: ["pill-warn", "Action needed"],
    rejected: ["pill-err", "Rejected"],
  };
  const FILE_MAX = (LIVE ? 10 : 5) * 1024 * 1024;

  /* masks: what the store and screen keep after entry */
  const M = {
    pan: p => p.slice(0, 5) + "••••" + p.slice(9),
    upi: u => {
      const [l, d] = u.split("@");
      return l.slice(0, Math.min(6, Math.max(1, l.length - 3))) + "••••@" + d;
    },
    acc: a => "••••" + a.slice(-4),
    ifsc: f => f.slice(0, 5) + "••••" + f.slice(-2),
    gst: g => g.slice(0, 2) + "••••••••••" + g.slice(-3),
  };
  const norm = s =>
    String(s || "")
      .toUpperCase()
      .replace(/[^A-Z ]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const press = el => {
    try {
      LLD.motion.press(el);
    } catch (e) {}
  };
  const K = () => store.s.kyc;
  const set = (fn, why = "kyc") => store.set(s => fn(s.kyc), why);
  const needsSelfie = k => !LIVE && k.idType !== "Aadhaar";
  const fixes = k => k.fix || (/bank|upi|payout/i.test(k.note || "") ? ["payout", "pan"] : ["pan"]);
  const jobOf = k => {
    const m = /^#bid-(.+)$/.exec(k.returnTo || "");
    return m ? store.s.jobs.find(j => j.id === m[1]) : null;
  };
  const setLabel = (b, t) =>
    b.querySelectorAll(".t,.t2").forEach(s => {
      s.textContent = t;
    });

  // draft: raw values while typing (never stored), edit toggles for saved values
  let D = { edit: {}, panRaw: "" };
  store.on(why => {
    if (why === "signed-in" || why === "signed-out") D = { edit: {}, panRaw: "" };
  });

  function normalise(k) {
    k.bank = k.bank || { acc: "", ifsc: "", holder: "" };
    if (["under_review", "verified", "action_needed"].includes(k.status)) {
      // records that exist from an earlier submission
      if (k.idDone == null) k.idDone = !!k.idType;
      if (k.gstDone == null) k.gstDone = true;
      if (k.selfie == null) k.selfie = needsSelfie(k);
    }
    if (typeof k.step !== "number" || k.step < 0 || k.step > REVIEW) k.step = 0;
  }
  function done(k, id) {
    if (id === "pan") return !!(k.pan && k.panName);
    if (id === "id") return !!k.idDone;
    if (id === "selfie") return !needsSelfie(k) || !!k.selfie;
    if (id === "payout")
      return k.payoutMethod === "bank" ? !!(k.bank.acc && k.bank.ifsc && k.bank.holder) : !!k.upi;
    if (id === "gst") return !!k.gstDone;
    return false;
  }
  function summary(k, id) {
    if (id === "pan") return k.pan;
    if (id === "id") return k.idMasked ? `${k.idType} ${k.idMasked}` : k.idType;
    if (id === "selfie") return "Added";
    if (id === "payout") return k.payoutMethod === "bank" ? `Bank ${k.bank.acc}` : `UPI ${k.upi}`;
    if (id === "gst") return k.gst || "Not registered";
    return "";
  }
  function railState(k, i) {
    const id = STEPS[i].id;
    if (id === "selfie" && !needsSelfie(k)) return ["skip", "Not needed with Aadhaar"];
    if (k.status === "action_needed" && fixes(k).includes(id)) return ["fix", "Needs a fix"];
    if (k.status === "rejected" && (id === "id" || (id === "selfie" && needsSelfie(k))))
      return ["fix", "Try again"];
    if (k.status === "in_progress" && k.step === i) return ["now", "Now"];
    if (done(k, id)) return ["done", summary(k, id)];
    return ["next", id === "gst" ? "Optional" : ""];
  }
  const pending = k => {
    const i = STEPS.findIndex(s => s.id !== "gst" && !done(k, s.id));
    return i < 0 ? REVIEW : i;
  };
  const nextStep = (k, i) => {
    let n = i + 1;
    if (STEPS[n] && STEPS[n].id === "selfie" && !needsSelfie(k)) n++;
    return n;
  };
  const prevStep = (k, i) => {
    let n = i - 1;
    if (STEPS[n] && STEPS[n].id === "selfie" && !needsSelfie(k)) n--;
    return Math.max(0, n);
  };

  /* simulated upload with progress, offline failure and retry */
  function upload(box, file, onDone) {
    box.innerHTML = `<div class="kyc-up"><div class="row between"><span class="kyc-up-n">${esc(file.name)}</span><span class="num muted" data-pct>0%</span></div>
      <progress max="100" value="0" aria-label="Upload progress for ${esc(file.name)}"></progress></div>`;
    const bar = box.querySelector("progress"),
      pct = box.querySelector("[data-pct]");
    let v = 0;
    const t = setInterval(() => {
      if (!box.isConnected) {
        clearInterval(t);
        return;
      }
      if (!navigator.onLine) {
        clearInterval(t);
        box.innerHTML = `<div class="kyc-up is-err" role="alert">${icon("alert")}<div><p class="t-label">Upload failed</p><p>You're offline. Check your connection, then try again.</p></div><button type="button" class="btn-q" data-retry>Retry</button></div>`;
        box.querySelector("[data-retry]").addEventListener("click", () => upload(box, file, onDone));
        return;
      }
      v = Math.min(100, v + 12 + Math.random() * 14);
      bar.value = v;
      pct.textContent = Math.round(v) + "%";
      if (v >= 100) {
        clearInterval(t);
        onDone();
      }
    }, 90);
  }
  function checkFile(f, types, label) {
    if (!f) return "Choose a file.";
    if (!types.includes(f.type))
      return `That file is ${f.type ? "a " + esc((f.type.split("/")[1] || "").toUpperCase()) + " file" : "not a supported type"}. Use ${label}.`;
    if (f.size > FILE_MAX) return `That file is ${(f.size / 1048576).toFixed(1)} MB. Use one under ${FILE_MAX >> 20} MB.`;
    if (!f.size) return "That file is empty. Try another.";
    return "";
  }

  function render(el) {
    const k0 = K();
    normalise(k0);
    el.innerHTML = `
    <div class="focus kyc">
      <section class="focus-art dark kyc-art" aria-label="Verification progress">
        <p class="kyc-brand"><img src="assets/logo-mark.svg" width="28" height="28" alt=""><span>linkloom</span></p>
        <h2 class="t-display kyc-line">Verify once. Bid on every brief.</h2>
        <ol class="kyc-rail" data-rail></ol>
        <img class="kyc-ill" data-ill src="assets/trust-id-card.svg" width="260" height="180" alt="">
      </section>
      <section class="focus-form light kyc-form">
        <div class="kyc-in">
          <div data-job></div>
          <div class="kyc-main" data-main></div>
          <p class="kyc-safe">${icon("lock")}Encrypted, used only to verify you and pay you. Never shown to brands.</p>
          <div class="kyc-sample" data-sample></div>
        </div>
        <p class="sr-only" aria-live="polite" data-live></p>
      </section>
    </div>`;
    const $ = s => el.querySelector(s);
    const main = $("[data-main]"),
      live = $("[data-live]");
    let alive = true,
      celebrateNext = false;

    function paintArt() {
      const k = K();
      $("[data-rail]").innerHTML =
        STEPS.map((s, i) => {
          const [st, sub] = railState(k, i);
          const n =
            st === "done"
              ? icon("check")
              : st === "fix"
                ? icon("alert")
                : st === "skip"
                  ? icon("minus")
                  : "0" + (i + 1);
          return `<li class="kyc-rail-i is-${st}" ${st === "now" ? 'aria-current="step"' : ""}><span class="kyc-rail-n">${n}</span><span class="kyc-rail-t"><b>${esc(s.t)}</b>${sub && st !== "now" ? `<span class="num">${esc(sub)}</span>` : ""}</span></li>`;
        }).join("") +
        `<li class="kyc-rail-i kyc-rail-end is-${k.status === "verified" ? "done" : k.status === "under_review" ? "now" : "next"}"><span class="kyc-rail-n">${k.status === "verified" ? icon("check") : icon("shield")}</span><span class="kyc-rail-t"><b>${k.status === "verified" ? "Verified" : "Review"}</b><span>${k.status === "under_review" ? "Checking now" : k.status === "verified" ? "You can bid" : "Up to 24 hours"}</span></span></li>`;
      const step = k.status === "in_progress" && STEPS[k.step];
      const ill = step
        ? step.art
        : k.status === "verified"
          ? "step-05-stamp"
          : k.status === "under_review"
            ? "trust-lock-coin"
            : "trust-id-card";
      const img = $("[data-ill]");
      const src = `assets/${ill}.svg`;
      if (img.getAttribute("src") !== src) {
        img.src = src;
        img.width = ill.startsWith("step") ? 300 : 260;
        img.height = ill.startsWith("step") ? 220 : 180;
      }
    }
    function paintJob() {
      const k = K(),
        j = jobOf(k),
        box = $("[data-job]");
      if (!j) {
        box.innerHTML = "";
        return;
      }
      box.innerHTML = `<div class="kyc-job">
        <span class="kyc-job-ic">${icon("brief")}</span>
        <div class="kyc-job-t"><p class="t-cap muted">${k.status === "verified" ? "Ready to bid on" : "Your bid is saved for"}</p><p class="t-label">${esc(j.title)}</p><p class="t-cap muted">${esc(j.brand)} · Budget ${esc(LLD.inr(j.budget))}</p></div>
        <span class="pill pill-paper">${icon("bookmark")}Saved</span>
      </div>`;
    }
    function paintSample() {
      const k = K(),
        box = $("[data-sample]");
      const btn = (a, t) => `<button type="button" class="kyc-sbtn" data-s="${a}">${t}</button>`;
      const opts =
        k.status === "under_review"
          ? btn("approve", "Approve verification") + btn("fix", "Ask for a fix") + btn("reject", "Reject")
          : k.status === "not_started"
            ? ""
            : btn("reset", "Start over as a new creator");
      box.innerHTML = opts ? `<span class="sample">Sample</span>${opts}` : "";
      box.querySelectorAll("[data-s]").forEach(b => b.addEventListener("click", () => sample(b.dataset.s)));
      try {
        LLD.motion.press([...box.querySelectorAll("[data-s]")]);
      } catch (e) {}
    }
    function sample(a) {
      if (a === "approve") {
        celebrateNext = true;
        set(k => {
          k.status = "verified";
          k.note = "";
          k.verifiedAt = new Date().toISOString();
        }, "kyc-verified");
        LLD.toast("Verified. You can bid now.", "check");
      }
      if (a === "fix")
        set(k => {
          k.status = "action_needed";
          k.fix = ["pan"];
          k.note =
            "The name on your PAN doesn't match the name on your ID. Check the spelling, letter by letter.";
        }, "kyc-action");
      if (a === "reject")
        set(k => {
          k.status = "rejected";
          k.fix = null;
          k.idDone = false;
          k.selfie = false;
          k.note =
            "The ID photo was blurred, so the number couldn't be read. Nothing is wrong with your account; try again with a sharper photo or a different ID.";
        }, "kyc-rejected");
      if (a === "reset") {
        D = { edit: {}, panRaw: "" };
        set(k => {
          Object.assign(k, {
            status: "not_started",
            step: 0,
            pan: "",
            panName: "",
            idType: "Aadhaar",
            idMasked: "",
            idDone: false,
            selfie: false,
            payoutMethod: "upi",
            upi: "",
            bank: { acc: "", ifsc: "", holder: "" },
            gst: "",
            gstDone: false,
            note: "",
            fix: null,
          });
        }, "kyc-reset");
      }
      paint(true);
    }

    function paint(focus) {
      if (!alive) return;
      const k = K();
      paintArt();
      paintJob();
      paintSample();
      const view =
        {
          not_started: vStart,
          in_progress: vStep,
          under_review: vReview,
          verified: vVerified,
          action_needed: vAction,
          rejected: vRejected,
        }[k.status] || vStart;
      view();
      LLD.liquid(main);
      try {
        LLD.motion.stagger([...main.querySelectorAll("[data-st]")]);
      } catch (e) {}
      if (focus) {
        const h = main.querySelector("h1");
        h && h.focus({ preventScroll: true });
        window.scrollTo({ top: 0 });
      }
    }
    const statusPill = k => {
      const [c, t] = STATUS[k.status];
      return `<span class="pill ${c}">${k.status === "rejected" ? icon("alert") : k.status === "verified" ? icon("check") : k.status === "action_needed" ? icon("alert") : ""}${t}</span>`;
    };
    const leave = () => {
      const j = jobOf(K());
      LLD.go(j ? "#job-" + j.id : "#home");
    };

    /* ---------- not started ---------- */
    function vStart() {
      const need = [
        ["PAN card", "For payouts and tax records"],
        ["Aadhaar or another ID", "Shows the PAN is yours"],
        ["A selfie, only for document uploads", "Matches you to your ID photo"],
        ["UPI ID or bank account", "Where your money lands"],
        ["GST number, if you have one", "Optional"],
      ];
      if (LIVE) need.splice(1, 4, ["A photo or PDF of your ID", "Aadhaar, passport, voter ID or driving licence"], ["Your bank account", "Where your money lands"]);
      main.innerHTML = `
        <div class="kyc-head">${statusPill(K())}<h1 class="t-h1" tabindex="-1">Verify once, then bid</h1>
          <p class="muted">Brands only accept bids from verified creators. It takes about 4 minutes, and you can stop and pick up where you left off.</p></div>
        <ol class="kyc-need">${need.map((n, i) => `<li data-st><span class="kyc-need-n num">0${i + 1}</span><span><b>${n[0]}</b><span>${n[1]}</span></span></li>`).join("")}</ol>
        <div class="kyc-actions"><button class="lq lq-p lq-xl" type="button" data-begin>Start verification ${icon("arrow", "ic")}</button><button class="btn-q" type="button" data-leave>Not now</button></div>`;
      main.querySelector("[data-begin]").addEventListener("click", e => {
        press(e.currentTarget);
        set(k => {
          k.status = "in_progress";
          k.step = 0;
        }, "kyc-start");
        paint(true);
      });
      main.querySelector("[data-leave]").addEventListener("click", leave);
    }

    /* ---------- in progress: one step at a time ---------- */
    function vStep() {
      const k = K(),
        i = k.step;
      if (i === REVIEW) return vSummary();
      const s = STEPS[i];
      const shown = STEPS.filter(x => x.id !== "selfie" || needsSelfie(k));
      const pos = shown.findIndex(x => x.id === s.id) + 1;
      const why =
        s.id === "selfie"
          ? `Only because you chose a ${esc(k.idType.toLowerCase())}. We compare it with your ID photo, then delete it after the check.`
          : s.why;
      main.innerHTML = `
        <form class="kyc-step" novalidate data-form>
          <div class="kyc-head">
            <p class="t-eyebrow">${D.fixing ? "Fixing one detail" : `Step ${pos} of ${shown.length}`}</p>
            <h1 class="t-h1" tabindex="-1">${esc(s.h)}</h1>
            <p class="kyc-why">${icon("info")}<span>${why}</span></p>
          </div>
          <div class="kyc-fields" data-fields></div>
          <p class="kyc-formerr" role="alert" data-formerr hidden></p>
          <div class="kyc-actions">
            <button class="lq lq-p" type="submit" data-next>${D.fixing ? "Save and review" : "Continue"}</button>
            ${i > 0 && !D.fixing ? `<button class="lq lq-s" type="button" data-back>${icon("back", "ic")}Back</button>` : ""}
            <button class="btn-q kyc-exit" type="button" data-leave>Save and exit</button>
          </div>
        </form>`;
      const box = main.querySelector("[data-fields]");
      const api = { pan: fPan, id: fId, selfie: fSelfie, payout: fPayout, gst: fGst }[s.id](box);
      const form = main.querySelector("[data-form]");
      form.addEventListener("submit", e => {
        e.preventDefault();
        const errs = api.check();
        if (errs.length) {
          showErrs(box, errs);
          live.textContent = "Check the highlighted fields";
          return;
        }
        const nextBtn = main.querySelector("[data-next]");
        press(nextBtn);
        const r = api.commit();
        if (r && typeof r.then === "function") {
          const fe = main.querySelector("[data-formerr]");
          fe.hidden = true;
          nextBtn.disabled = true;
          nextBtn.setAttribute("aria-busy", "true");
          r.then(
            () => alive && advance(),
            er => {
              if (!alive) return;
              nextBtn.disabled = false;
              nextBtn.removeAttribute("aria-busy");
              const fieldErr = er && er.details && typeof er.details === "object" ? Object.keys(er.details) : [];
              fe.hidden = false;
              fe.textContent = (er && er.message) || "We couldn't save that. Please try again.";
              if (fieldErr.length) live.textContent = "Check the highlighted fields";
            },
          );
          return;
        }
        advance();
      });
      function advance() {
        const n = D.fixing ? pending(K()) : nextStep(K(), i);
        set(kk => {
          kk.step = n;
        }, "kyc-step");
        live.textContent = n === REVIEW ? "Review your details" : `${STEPS[n].t} next`;
        paint(true);
        try {
          const ns = el.querySelectorAll("[data-rail] .kyc-rail-n"),
            to = ns[Math.min(n, STEPS.length)];
          if (LLD.motion.pull && ns[i] && to && n > i) LLD.motion.pull(ns[i], to);
        } catch (e) {}
      }
      const bk = main.querySelector("[data-back]");
      if (bk)
        bk.addEventListener("click", () => {
          set(kk => {
            kk.step = prevStep(kk, i);
          }, "kyc-step");
          paint(true);
        });
      main.querySelector("[data-leave]").addEventListener("click", () => {
        LLD.toast("Saved. Pick up where you left off any time.", "check");
        leave();
      });
    }
    function showErrs(box, errs) {
      box.querySelectorAll(".field.is-err").forEach(f => {
        f.classList.remove("is-err");
        const e = f.querySelector(".err");
        if (e) e.textContent = "";
      });
      errs.forEach(([id, msg]) => {
        const f = box.querySelector(`[data-f="${id}"]`);
        if (!f) return;
        f.classList.add("is-err");
        const e = f.querySelector(".err");
        if (e) e.textContent = msg;
        const inp = f.querySelector("input,select");
        inp && inp.setAttribute("aria-invalid", "true");
      });
      const first = box.querySelector(
        `[data-f="${errs[0][0]}"] input:not([type=hidden]), [data-f="${errs[0][0]}"] button`,
      );
      first && first.focus();
    }
    const field = (id, label, input, help = "") =>
      `<div class="field" data-f="${id}"><label for="kyc-${id}">${label}</label>${input}${help ? `<p class="help" id="kyc-${id}-h">${help}</p>` : ""}<p class="err" id="kyc-${id}-e" aria-live="polite"></p></div>`;
    const savedRow = (label, value, key) =>
      `<div class="kyc-saved" data-st><span class="kyc-saved-l">${label}</span><span class="kyc-saved-v num">${esc(value)}</span><button type="button" class="btn-q" data-change="${key}">Change</button></div>`;
    const wireChange = (box, rerender) =>
      box.querySelectorAll("[data-change]").forEach(b =>
        b.addEventListener("click", () => {
          D.edit[b.dataset.change] = true;
          rerender();
          const i = box.querySelector("input");
          i && i.focus();
        }),
      );
    const clearOnInput = box =>
      box.querySelectorAll("input,select").forEach(i =>
        i.addEventListener("input", () => {
          const f = i.closest(".field");
          if (f && f.classList.contains("is-err")) {
            f.classList.remove("is-err");
            f.querySelector(".err").textContent = "";
            i.removeAttribute("aria-invalid");
          }
        }),
      );

    /* PAN */
    function fPan(box) {
      const k = K();
      const paint = () => {
        const editing = !k.pan || D.edit.pan;
        box.innerHTML = `
          ${editing ? field("pan", "PAN number", `<input class="input kyc-mono" id="kyc-pan" maxlength="10" autocomplete="off" spellcheck="false" autocapitalize="characters" value="${esc(D.panRaw)}" placeholder="ABCDE1234F" aria-describedby="kyc-pan-h kyc-pan-e">`, "10 characters: 5 letters, 4 digits, 1 letter.") : savedRow("PAN", k.pan, "pan")}
          ${field("pname", "Name as printed on your PAN", `<input class="input" id="kyc-pname" autocomplete="name" value="${esc(D.panName ?? k.panName)}" placeholder="ANANYA IYER" aria-describedby="kyc-pname-e">`)}`;
        wireChange(box, paint);
        clearOnInput(box);
        const p = box.querySelector("#kyc-pan");
        if (p)
          p.addEventListener("input", () => {
            p.value = p.value
              .toUpperCase()
              .replace(/[^A-Z0-9]/g, "")
              .slice(0, 10);
            D.panRaw = p.value;
            const h = box.querySelector("#kyc-pan-h");
            h.textContent =
              p.value.length >= 4 && p.value[3] !== "P"
                ? "Personal PANs usually have P as the 4th letter. Double-check yours."
                : "10 characters: 5 letters, 4 digits, 1 letter.";
          });
        box.querySelector("#kyc-pname").addEventListener("input", e => {
          D.panName = e.target.value;
        });
      };
      paint();
      return {
        check() {
          const errs = [];
          if (!k.pan || D.edit.pan) {
            const v = D.panRaw;
            if (!v) errs.push(["pan", "Enter your PAN."]);
            else if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(v))
              errs.push(["pan", "That doesn't look like a PAN. It's 5 letters, 4 digits, then 1 letter."]);
          }
          const n = norm(D.panName ?? k.panName);
          if (!n) errs.push(["pname", "Enter the name exactly as it's printed on your PAN."]);
          else if (n.length < 3) errs.push(["pname", "Use your full name as printed."]);
          return errs;
        },
        commit() {
          if (LIVE) {
            const name = norm(D.panName ?? k.panName);
            const raw = !k.pan || D.edit.pan ? D.panRaw : null;
            /* the server keeps the full PAN; a saved one only needs its name re-sent when it changes */
            if (!raw && name === norm(k.panName)) return;
            if (!raw) return Promise.reject(new Error("Re-enter your PAN number to change the name on it."));
            return LLD.live.kycPan(raw, name).then(() => {
              D.edit.pan = false;
              D.panRaw = "";
              delete D.panName;
            });
          }
          const masked = !k.pan || D.edit.pan ? M.pan(D.panRaw) : k.pan;
          set(kk => {
            kk.pan = masked;
            kk.panName = norm(D.panName ?? kk.panName);
          }, "kyc-pan");
          D.edit.pan = false;
          delete D.panName;
        },
      };
    }

    /* identity proof */
    function fId(box) {
      const k = K();
      if (!D.idType) D.idType = k.idType || "Aadhaar";
      const paint = () => {
        const t = IDS[D.idType],
          saved = k.idDone && !D.edit.id && k.idType === D.idType;
        box.innerHTML = `
          <fieldset class="kyc-fs" data-f="idtype"><legend>ID type</legend>
            <div class="kyc-opts">${Object.keys(IDS)
              .map(
                n =>
                  `<label class="kyc-opt"><input type="radio" name="kyc-idt" value="${esc(n)}" ${D.idType === n ? "checked" : ""}><span>${esc(n)}</span></label>`,
              )
              .join("")}</div>
          </fieldset>
          ${saved ? savedRow(D.idType, k.idMasked || "Checked", "id") : LIVE ? "" : field("idn", `${esc(D.idType)} number`, `<input class="input kyc-mono" id="kyc-idn" autocomplete="off" spellcheck="false" inputmode="${D.idType === "Aadhaar" ? "numeric" : "text"}" value="${esc(D.idNum || "")}" placeholder="${t.ph}" aria-describedby="kyc-idn-e">`)}
          ${!saved && !LIVE && D.idType === "Aadhaar" ? `<label class="check" data-f="consent"><input type="checkbox" id="kyc-consent" ${D.consent ? "checked" : ""}><span>I agree to share my Aadhaar number for this check only. No photo of the card is needed.</span></label><p class="err" data-consent-e aria-live="polite"></p>` : ""}
          ${
            !saved && (LIVE || D.idType !== "Aadhaar")
              ? `<div class="field" data-f="doc"><span class="lab">Photo of the ID, front side</span>
            <div class="kyc-file" data-docbox>${D.docName ? `<div class="kyc-up is-ok">${icon("check")}<span class="kyc-up-n">${esc(D.docName)}</span><button type="button" class="btn-q" data-redo>Replace</button></div>` : `<button type="button" class="lq lq-s lq-sm" data-pick>${icon("upload", "ic")}Upload photo or PDF</button>`}</div>
            <input class="sr-only" type="file" accept="image/jpeg,image/png,application/pdf" tabindex="-1" aria-label="ID document file" data-file>
            <p class="help">JPG, PNG${LIVE ? ", WebP" : ""} or PDF, up to ${FILE_MAX >> 20} MB. All four corners in frame, no glare.</p><p class="err" aria-live="polite"></p></div>
            ${LIVE ? "" : `<p class="kyc-note">${icon("camera")}We'll also ask for a selfie, to match your face to this ID.</p>`}`
              : ""
          }`;
        LLD.liquid(box);
        wireChange(box, paint);
        clearOnInput(box);
        box.querySelectorAll("input[name=kyc-idt]").forEach(r =>
          r.addEventListener("change", () => {
            D.idType = r.value;
            D.idNum = "";
            D.docName = "";
            D.edit.id = true;
            paint();
            paintArtFor(r.value);
          }),
        );
        const n = box.querySelector("#kyc-idn");
        if (n)
          n.addEventListener("input", () => {
            const c = IDS[D.idType].clean(n.value);
            n.value = IDS[D.idType].fmt ? IDS[D.idType].fmt(n.value) : c.slice(0, 16);
            D.idNum = n.value;
          });
        const c = box.querySelector("#kyc-consent");
        if (c)
          c.addEventListener("change", () => {
            D.consent = c.checked;
            box.querySelector("[data-consent-e]").textContent = "";
          });
        const file = box.querySelector("[data-file]"),
          dbox = box.querySelector("[data-docbox]");
        const pick = () => file.click();
        box.querySelectorAll("[data-pick],[data-redo]").forEach(b => b.addEventListener("click", pick));
        if (file)
          file.addEventListener("change", () => {
            const f = file.files[0];
            file.value = "";
            const fe = box.querySelector("[data-f=doc] .err"),
              fd = box.querySelector("[data-f=doc]");
            const e = checkFile(f, ["image/jpeg", "image/png", "application/pdf", ...(LIVE ? ["image/webp"] : [])], "a JPG, PNG or PDF");
            if (e) {
              fe.textContent = e;
              fd.classList.add("is-err");
              return;
            }
            fe.textContent = "";
            fd.classList.remove("is-err");
            live.textContent = "Uploading " + f.name;
            if (LIVE) {
              /* kept until Continue, which uploads it and saves the step in one go */
              D.docFile = f;
              D.docName = f.name;
              live.textContent = f.name + " ready";
              paint();
              return;
            }
            upload(dbox, f, () => {
              D.docName = f.name;
              live.textContent = "Upload complete";
              paint();
            });
          });
      };
      const paintArtFor = () => paintArt();
      paint();
      return {
        check() {
          const errs = [],
            t = IDS[D.idType];
          if (k.idDone && !D.edit.id && k.idType === D.idType) return errs;
          if (LIVE) {
            if (!D.docFile) errs.push(["doc", "Upload a photo or PDF of the front of your ID."]);
            return errs;
          }
          const v = t.clean(D.idNum || "");
          if (!v) errs.push(["idn", `Enter your ${D.idType} number.`]);
          else if (!t.re.test(v)) errs.push(["idn", t.err]);
          if (D.idType === "Aadhaar" && !D.consent) {
            errs.push(["consent", ""]);
            const ce = box.querySelector("[data-consent-e]");
            if (ce) ce.textContent = "Tick the box to agree, so we can run the check.";
          }
          if (D.idType !== "Aadhaar" && !D.docName)
            errs.push(["doc", "Upload a photo of the front of your ID."]);
          return errs;
        },
        commit() {
          const t = IDS[D.idType];
          if (k.idDone && !D.edit.id && k.idType === D.idType) return;
          if (LIVE)
            return LLD.live.kycId(D.idType, D.docFile).then(() => {
              D.edit.id = false;
              D.docFile = null;
              D.docName = "";
            });
          const masked = t.mask(t.clean(D.idNum));
          const changedType = k.idType !== D.idType;
          set(kk => {
            kk.idType = D.idType;
            kk.idMasked = masked;
            kk.idDone = true;
            if (changedType || D.idType !== "Aadhaar") kk.selfie = false;
          }, "kyc-id");
          D.edit.id = false;
          D.idNum = "";
          D.docName = "";
          D.consent = false;
        },
      };
    }

    /* selfie (only for document uploads) */
    function fSelfie(box) {
      const paint = () => {
        const k = K();
        box.innerHTML = `
          <ul class="kyc-tips" data-st><li>Face a window or light</li><li>No cap or sunglasses</li><li>Plain background</li></ul>
          <div class="field" data-f="selfie"><span class="lab">Your selfie</span>
            <div class="kyc-file" data-sbox>${k.selfie || D.selfieName ? `<div class="kyc-up is-ok">${icon("check")}<span class="kyc-up-n">Selfie added</span><button type="button" class="btn-q" data-redo>Retake</button></div>` : `<button type="button" class="lq lq-s" data-pick>${icon("camera", "ic")}Take or upload a selfie</button>`}</div>
            <input class="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/heic" capture="user" tabindex="-1" aria-label="Selfie photo" data-file>
            <p class="help">We don't show the photo here, and it's deleted after the check.</p><p class="err" aria-live="polite"></p></div>`;
        LLD.liquid(box);
        const file = box.querySelector("[data-file]"),
          sb = box.querySelector("[data-sbox]");
        box
          .querySelectorAll("[data-pick],[data-redo]")
          .forEach(b => b.addEventListener("click", () => file.click()));
        file.addEventListener("change", () => {
          const f = file.files[0];
          file.value = "";
          const fd = box.querySelector("[data-f=selfie]"),
            fe = fd.querySelector(".err");
          const e = checkFile(
            f,
            ["image/jpeg", "image/png", "image/webp", "image/heic"],
            "a JPG, PNG or HEIC photo",
          );
          if (e) {
            fe.textContent = e;
            fd.classList.add("is-err");
            return;
          }
          fe.textContent = "";
          fd.classList.remove("is-err");
          upload(sb, f, () => {
            D.selfieName = "selfie";
            live.textContent = "Selfie added";
            set(kk => {
              kk.selfie = false;
            }, "kyc-selfie-draft");
            paint();
          });
        });
      };
      paint();
      return {
        check: () => (K().selfie || D.selfieName ? [] : [["selfie", "Add a selfie to continue."]]),
        commit() {
          set(kk => {
            kk.selfie = true;
          }, "kyc-selfie");
          D.selfieName = "";
        },
      };
    }

    /* payout: UPI or bank, masked once saved */
    function fPayout(box) {
      const k = K();
      if (!D.method)
        D.method = LIVE ? "bank" : D.fixing && fixes(k).includes("payout") && k.bank.acc ? "bank" : k.payoutMethod || "upi";
      if (D.holder == null) D.holder = k.bank.holder || "";
      const paint = () => {
        const upiSaved = k.upi && !D.edit.upi,
          accSaved = k.bank.acc && !D.edit.bank;
        box.innerHTML = `
          ${LIVE ? "" : `<div class="seg kyc-seg" role="group" aria-label="Payout method">
            <button type="button" data-m="upi" aria-pressed="${D.method === "upi"}">UPI ID</button>
            <button type="button" data-m="bank" aria-pressed="${D.method === "bank"}">Bank account</button>
          </div>`}
          ${
            D.method === "upi"
              ? upiSaved
                ? savedRow("UPI ID", k.upi, "upi")
                : field(
                    "upi",
                    "UPI ID",
                    `<input class="input" id="kyc-upi" autocomplete="off" spellcheck="false" autocapitalize="none" value="${esc(D.upi || "")}" placeholder="yourname@okbank" aria-describedby="kyc-upi-h kyc-upi-e">`,
                    "Find it in your UPI app, under your profile.",
                  )
              : `${
                  accSaved
                    ? savedRow("Account", `${k.bank.acc} · ${k.bank.ifsc}`, "bank")
                    : `
              ${field("acc", "Account number", `<input class="input kyc-mono" id="kyc-acc" inputmode="numeric" autocomplete="off" value="${esc(D.acc || "")}" aria-describedby="kyc-acc-e">`)}
              ${field("acc2", "Re-enter account number", `<input class="input kyc-mono" id="kyc-acc2" inputmode="numeric" autocomplete="off" value="${esc(D.acc2 || "")}" aria-describedby="kyc-acc2-e">`)}
              ${field("ifsc", "IFSC", `<input class="input kyc-mono" id="kyc-ifsc" maxlength="11" autocomplete="off" spellcheck="false" value="${esc(D.ifsc || "")}" placeholder="HDFC0001234" aria-describedby="kyc-ifsc-h kyc-ifsc-e">`, "On your cheque book or passbook. 11 characters.")}`
                }
              ${field("holder", "Account holder name", `<input class="input" id="kyc-holder" autocomplete="name" value="${esc(D.holder)}" aria-describedby="kyc-holder-h kyc-holder-e">`, `Must match the name on your PAN: <b>${esc(k.panName || "add your PAN first")}</b>`)}`
          }`;
        LLD.liquid(box);
        wireChange(box, paint);
        clearOnInput(box);
        box.querySelectorAll("[data-m]").forEach(b =>
          b.addEventListener("click", () => {
            D.method = b.dataset.m;
            paint();
          }),
        );
        const on = (id, key, fmt) => {
          const i = box.querySelector("#kyc-" + id);
          if (i)
            i.addEventListener("input", () => {
              if (fmt) i.value = fmt(i.value);
              D[key] = i.value;
              if (id === "ifsc") bankHint();
            });
        };
        on("upi", "upi", v => v.replace(/\s/g, ""));
        on("acc", "acc", v => v.replace(/\D/g, "").slice(0, 18));
        on("acc2", "acc2", v => v.replace(/\D/g, "").slice(0, 18));
        on("ifsc", "ifsc", v =>
          v
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, "")
            .slice(0, 11),
        );
        on("holder", "holder");
        const bankHint = () => {
          const h = box.querySelector("#kyc-ifsc-h");
          if (!h) return;
          const b = /^[A-Z]{4}0[A-Z0-9]{6}$/.test(D.ifsc || "") && BANKS[(D.ifsc || "").slice(0, 4)];
          h.textContent = b
            ? b + " · branch code " + D.ifsc.slice(5)
            : "On your cheque book or passbook. 11 characters.";
        };
        bankHint();
      };
      paint();
      return {
        check() {
          const errs = [];
          if (D.method === "upi") {
            if (!k.upi || D.edit.upi) {
              const v = (D.upi || "").trim();
              if (!v) errs.push(["upi", "Enter your UPI ID."]);
              else if (!/^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,63}$/.test(v))
                errs.push(["upi", "A UPI ID looks like name@okhdfcbank, with one @."]);
            }
          } else {
            if (!k.bank.acc || D.edit.bank) {
              const a = D.acc || "";
              if (!a) errs.push(["acc", "Enter your account number."]);
              else if (a.length < 9 || a.length > 18)
                errs.push(["acc", "Indian account numbers have 9 to 18 digits."]);
              if (a && D.acc2 !== a) errs.push(["acc2", "The two account numbers don't match."]);
              const f = D.ifsc || "";
              if (!f) errs.push(["ifsc", "Enter the IFSC."]);
              else if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(f))
                errs.push(["ifsc", "An IFSC is 4 letters, a zero, then 6 letters or digits."]);
            }
            const h = norm(D.holder);
            if (!h) errs.push(["holder", "Enter the name on the bank account."]);
            else if (k.panName && h !== norm(k.panName))
              errs.push([
                "holder",
                `This doesn't match your PAN name (${k.panName}). Payouts fail when names differ. Use the PAN name, or correct your PAN.`,
              ]);
          }
          return errs;
        },
        commit() {
          if (LIVE) {
            const holder = D.holder.trim().replace(/\s+/g, " ");
            if (k.bank.acc && !D.edit.bank && holder === k.bank.holder) return;
            if (k.bank.acc && !D.edit.bank)
              return Promise.reject(new Error("Re-enter the account number and IFSC to change the holder name."));
            return LLD.live.kycBank(holder, D.acc, D.ifsc).then(() => {
              D.edit.bank = false;
              D.acc = D.acc2 = D.ifsc = "";
              D.method = null;
              D.holder = null;
            });
          }
          set(kk => {
            if (!D.fixing || !kk.payoutMethod) kk.payoutMethod = D.method;
            if (D.method === "upi" && (!kk.upi || D.edit.upi)) kk.upi = M.upi(D.upi.trim());
            if (D.method === "bank") {
              if (!kk.bank.acc || D.edit.bank) {
                kk.bank.acc = M.acc(D.acc);
                kk.bank.ifsc = M.ifsc(D.ifsc);
              }
              kk.bank.holder = D.holder.trim().replace(/\s+/g, " ");
            }
          }, "kyc-payout");
          D.edit.upi = D.edit.bank = false;
          D.upi = D.acc = D.acc2 = D.ifsc = "";
          D.method = null;
          D.holder = null;
        },
      };
    }

    /* GST (optional) */
    function fGst(box) {
      const k = K();
      if (D.hasGst == null) D.hasGst = !!k.gst;
      const paint = () => {
        box.innerHTML = `
          <div class="seg kyc-seg" role="group" aria-label="Do you have a GST number?">
            <button type="button" data-g="no" aria-pressed="${!D.hasGst}">I don't have GST</button>
            <button type="button" data-g="yes" aria-pressed="${D.hasGst}">I have a GSTIN</button>
          </div>
          ${
            D.hasGst
              ? k.gst && !D.edit.gst
                ? savedRow("GSTIN", k.gst, "gst")
                : field(
                    "gst",
                    "GSTIN",
                    `<input class="input kyc-mono" id="kyc-gst" maxlength="15" autocomplete="off" spellcheck="false" value="${esc(D.gst || "")}" placeholder="27ABCDE1234F1Z5" aria-describedby="kyc-gst-h kyc-gst-e">`,
                    "15 characters. It contains your PAN, so we check they match.",
                  )
              : `<p class="kyc-note" data-st>${icon("check")}That's fine. You can add a GSTIN from your profile later.</p>`
          }`;
        wireChange(box, paint);
        clearOnInput(box);
        box.querySelectorAll("[data-g]").forEach(b =>
          b.addEventListener("click", () => {
            D.hasGst = b.dataset.g === "yes";
            paint();
          }),
        );
        const g = box.querySelector("#kyc-gst");
        if (g)
          g.addEventListener("input", () => {
            g.value = g.value
              .toUpperCase()
              .replace(/[^A-Z0-9]/g, "")
              .slice(0, 15);
            D.gst = g.value;
          });
      };
      paint();
      return {
        check() {
          if (!D.hasGst || (k.gst && !D.edit.gst)) return [];
          const v = D.gst || "";
          if (!v) return [["gst", 'Enter your GSTIN, or choose "I don\'t have GST".']];
          if (
            !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(v) ||
            +v.slice(0, 2) < 1 ||
            +v.slice(0, 2) > 38
          )
            return [["gst", "That doesn't look like a GSTIN. It's 15 characters, like 27ABCDE1234F1Z5."]];
          const p = D.panRaw || "",
            pm = K().pan || "";
          const mismatch = p
            ? v.slice(2, 12) !== p
            : pm && (v.slice(2, 7) !== pm.slice(0, 5) || v[11] !== pm.slice(-1));
          if (mismatch)
            return [
              ["gst", "This GSTIN belongs to a different PAN. Use the GSTIN registered to your own PAN."],
            ];
          return [];
        },
        commit() {
          set(kk => {
            kk.gst = D.hasGst ? (kk.gst && !D.edit.gst ? kk.gst : M.gst(D.gst)) : "";
            kk.gstDone = true;
          }, "kyc-gst");
          D.edit.gst = false;
          D.gst = "";
        },
      };
    }

    /* review and submit */
    function vSummary() {
      const k = K();
      const mismatch = k.bank.acc && k.panName && norm(k.bank.holder) !== norm(k.panName);
      const rows = [
        ["pan", "PAN", `${k.pan} · ${k.panName}`],
        ["id", "Identity proof", summary(k, "id")],
        ...(needsSelfie(k) ? [["selfie", "Selfie", k.selfie ? "Added" : "Missing"]] : []),
        [
          "payout",
          "Payout",
          k.payoutMethod === "bank" ? `Bank ${k.bank.acc} · ${k.bank.ifsc}` : `UPI ${k.upi}`,
        ],
        ...(k.payoutMethod === "upi" && k.bank.acc
          ? [["payout", "Backup bank", `${k.bank.acc} · ${k.bank.holder}`]]
          : []),
        ...(LIVE ? [] : [["gst", "GST", k.gst || "Not registered"]]),
      ];
      const missing = STEPS.filter(s => !done(k, s.id) && s.id !== "gst");
      main.innerHTML = `
        <form class="kyc-step" novalidate data-form>
          <div class="kyc-head"><p class="t-eyebrow">Last step</p><h1 class="t-h1" tabindex="-1">Check and submit</h1><p class="muted">Numbers are masked from here on. Only the verification team sees them in full.</p></div>
          <dl class="kyc-sum">${rows.map(r => `<div class="kyc-sum-r" data-st><dt>${r[1]}</dt><dd class="num">${esc(r[2])}</dd><dd><button type="button" class="btn-q" data-edit="${r[0]}">Edit<span class="sr-only"> ${r[1]}</span></button></dd></div>`).join("")}</dl>
          ${mismatch ? `<div class="kyc-alert" role="alert">${icon("alert")}<div><p class="t-label">Bank name still doesn't match your PAN</p><p>${esc(k.bank.holder)} vs ${esc(k.panName)}. Fix one of them before you submit.</p></div></div>` : ""}
          ${missing.length ? `<div class="kyc-alert" role="alert">${icon("alert")}<div><p class="t-label">Missing: ${missing.map(s => esc(s.t)).join(", ")}</p><p>Add ${missing.length === 1 ? "it" : "them"} to submit.</p></div></div>` : ""}
          <label class="check"><input type="checkbox" id="kyc-agree"><span>These details are mine and correct. I understand they're used only to verify me and pay me.</span></label>
          <p class="err" data-agree-e aria-live="polite"></p>
          <p class="kyc-formerr" role="alert" data-formerr hidden></p>
          <div class="kyc-actions"><button class="lq lq-p lq-xl" type="submit" data-submit ${mismatch || missing.length ? "disabled" : ""}>Submit for review</button><button class="btn-q kyc-exit" type="button" data-leave>Save and exit</button></div>
        </form>`;
      main.querySelectorAll("[data-edit]").forEach(b =>
        b.addEventListener("click", () => {
          const i = STEPS.findIndex(s => s.id === b.dataset.edit);
          D.fixing = true;
          set(kk => {
            kk.step = i;
          }, "kyc-step");
          paint(true);
        }),
      );
      main.querySelector("[data-leave]").addEventListener("click", () => {
        LLD.toast("Saved. Submit whenever you're ready.", "check");
        leave();
      });
      main.querySelector("[data-form]").addEventListener("submit", e => {
        e.preventDefault();
        const btn = main.querySelector("[data-submit]"),
          fe = main.querySelector("[data-formerr]");
        if (!main.querySelector("#kyc-agree").checked) {
          main.querySelector("[data-agree-e]").textContent = "Tick the box to confirm.";
          main.querySelector("#kyc-agree").focus();
          return;
        }
        if (!navigator.onLine) {
          fe.hidden = false;
          fe.textContent =
            "You're offline, so nothing was sent. Your details are still here; submit again when you're connected.";
          return;
        }
        press(btn);
        btn.disabled = true;
        setLabel(btn, "Submitting…");
        if (LIVE) {
          LLD.live.kycSubmit().then(
            () => {
              if (!alive) return;
              D.fixing = false;
              D.panRaw = "";
              set(kk => {
                kk.step = REVIEW;
                kk.fix = null;
              }, "kyc-submitted");
              live.textContent = "Submitted for review";
              paint(true);
            },
            er => {
              if (!alive) return;
              btn.disabled = false;
              setLabel(btn, "Submit for review");
              fe.hidden = false;
              fe.textContent = (er && er.message) || "We couldn't submit. Please try again.";
            },
          );
          return;
        }
        setTimeout(() => {
          if (!alive) return;
          D.fixing = false;
          D.panRaw = "";
          set(kk => {
            kk.status = "under_review";
            kk.step = REVIEW;
            kk.note = "";
            kk.fix = null;
            kk.submittedAt = LLD.today().toISOString();
          }, "kyc-submitted");
          live.textContent = "Submitted for review";
          paint(true);
        }, 800);
      });
    }

    /* ---------- under review ---------- */
    function vReview() {
      const k = K(),
        j = jobOf(k);
      main.innerHTML = `
        <div class="kyc-head">${statusPill(k)}<h1 class="t-h1" tabindex="-1">We're checking your details</h1>
          <p class="muted">Usually a few minutes, at most 24 hours. We'll send a notification when it's done${j ? ", and bring you straight back to your bid" : ""}.</p></div>
        <ol class="kyc-track" aria-label="Review progress">
          <li class="is-done" data-st><span></span><b>Submitted</b><span class="t-cap muted num">${k.submittedAt ? esc(new Date(k.submittedAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })) + " IST" : "Today"}</span></li>
          <li class="is-now" data-st><span></span><b>Checking</b><span class="t-cap muted">PAN, ID and payout</span></li>
          <li data-st><span></span><b>Verified</b><span class="t-cap muted">Bids unlock</span></li>
        </ol>
        <div class="kyc-actions"><button class="lq lq-s" type="button" data-go="#jobs">Browse jobs meanwhile</button></div>`;
    }

    /* ---------- verified ---------- */
    function vVerified() {
      const k = K(),
        j = jobOf(k);
      main.innerHTML = `
        <div class="kyc-done" data-celebrate>
          <div class="kyc-seal" aria-hidden="true">${icon("check")}</div>
          <div class="kyc-head">${statusPill(k)}<h1 class="t-h1" tabindex="-1">You're verified</h1>
            <p class="muted">You can bid on any brief now. Payouts go to ${k.payoutMethod === "bank" ? 'bank account <b class="num">' + esc(k.bank.acc) + "</b>" : 'UPI <b class="num">' + esc(k.upi) + "</b>"}.</p></div>
        </div>
        <div class="kyc-actions">
          ${j ? `<button class="lq lq-p lq-xl" type="button" data-return>Back to your bid ${icon("arrow", "ic")}</button>` : `<button class="lq lq-p lq-xl" type="button" data-go="#jobs">Find jobs ${icon("arrow", "ic")}</button>`}
          <button class="btn-q" type="button" data-go="#profile">View your profile</button>
        </div>`;
      const r = main.querySelector("[data-return]");
      if (r)
        r.addEventListener("click", () => {
          press(r);
          const to = K().returnTo;
          set(kk => {
            kk.returnTo = null;
          }, "kyc-return-done");
          LLD.go(to);
        });
      if (celebrateNext) {
        // fresh verification: the tick stitches itself on the seal, then on the pill (one quiet moment)
        celebrateNext = false;
        try {
          if (LLD.motion.check) {
            LLD.motion.check(main.querySelector(".kyc-seal"));
            LLD.motion.check(main.querySelector(".kyc-head .pill"), { delay: 160 });
          } else LLD.motion.celebrate(main.querySelector("[data-celebrate]"));
        } catch (e) {}
      }
    }

    /* ---------- action needed ---------- */
    // wrap the words that the other name doesn't have, so the mismatch is visible at a glance
    const diff = (a, b) => {
      const other = new Set(norm(b).split(" "));
      return String(a)
        .split(/\s+/)
        .map(w => (other.has(norm(w)) ? esc(w) : `<mark class="kyc-diff">${esc(w)}</mark>`))
        .join(" ");
    };
    function vAction() {
      const k = K(),
        fx = fixes(k),
        both = fx.includes("payout") && fx.includes("pan") && k.bank.acc;
      main.innerHTML = `
        <div class="kyc-head">${statusPill(k)}<h1 class="t-h1" tabindex="-1">${both ? "Two names don't match" : "One detail needs a fix"}</h1>
          <p class="muted">${esc(k.note || "Something in your details needs a correction before you can bid.")}</p></div>
        ${
          both
            ? `<dl class="kyc-compare" data-st>
            <div><dt>Name on PAN</dt><dd>${diff(k.panName, k.bank.holder)}</dd></div>
            <div><dt>Name on bank account <span class="num">${esc(k.bank.acc)}</span></dt><dd>${diff(k.bank.holder, k.panName)}</dd></div>
          </dl>
          <p class="muted kyc-small">The payout account has to belong to the PAN holder. Correct whichever one is wrong.</p>`
            : ""
        }
        <div class="kyc-actions">
          ${fx.map((f, i) => `<button class="lq ${i ? "lq-s" : "lq-p"}" type="button" data-fix="${f}">${f === "payout" ? "Update bank name" : f === "pan" ? "Correct PAN name" : "Fix " + esc(f)}</button>`).join("")}
        </div>`;
      main.querySelectorAll("[data-fix]").forEach(b =>
        b.addEventListener("click", () => {
          press(b);
          D.fixing = true;
          D.method = null;
          D.holder = null;
          const i = STEPS.findIndex(s => s.id === b.dataset.fix);
          set(kk => {
            kk.status = "in_progress";
            kk.step = i;
          }, "kyc-fix");
          paint(true);
        }),
      );
    }

    /* ---------- rejected ---------- */
    function vRejected() {
      const k = K();
      main.innerHTML = `
        <div class="kyc-head">${statusPill(k)}<h1 class="t-h1" tabindex="-1">We couldn't verify your ID</h1>
          <p class="muted">${esc(k.note || "The check didn't pass. Try again with a clearer photo or a different ID.")}</p></div>
        <div class="kyc-alert kyc-alert-soft" data-st>${icon("info")}<div><p class="t-label">Bids stay paused until this passes</p><p>Your PAN and payout details are kept. Only the ID step needs redoing.</p></div></div>
        <div class="kyc-actions"><button class="lq lq-p" type="button" data-retry>Try again</button><button class="btn-q" type="button" data-leave>Not now</button></div>`;
      main.querySelector("[data-retry]").addEventListener("click", e => {
        press(e.currentTarget);
        D.fixing = true;
        D.edit.id = true;
        D.idNum = "";
        D.docName = "";
        set(kk => {
          kk.status = "in_progress";
          kk.step = 1;
        }, "kyc-retry");
        paint(true);
      });
      main.querySelector("[data-leave]").addEventListener("click", leave);
    }

    paint(false);
    const offLive = store.on(why => {
      if (why === "kyc-live" && alive && ["under_review", "verified", "action_needed"].includes(K().status)) {
        celebrateNext = K().status === "verified";
        paint(false);
      }
    });
    return () => {
      alive = false;
      offLive();
    };
  }

  LLD.register("kyc", { title: "Verification", shell: "focus", render });
})();
