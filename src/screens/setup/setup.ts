// @ts-nocheck
/* setup screen (Builder A): first-login profile setup in four short steps.
   Rules: skip contact fields already verified by sign-in; age is computed from date of birth and under-18s cannot
   continue; gender optional with prefer-not-to-say; platform metrics are labelled self-reported; bio has a limit and
   counter; one or more languages; city and state only (never an address); photo upload with crop, type and size checks.
   Save lands on the creator's own profile (#profile).
   Also defines window.LLA.photo (shared photo picker + crop), reused by the profile edit sheet. */
import { ApiError, apiEnabled } from "@/api/client";
import { submitCreatorOnboarding } from "@/api/onboarding";

(() => {
  const { esc, icon, store } = LLD;
  const SAMPLE = JSON.parse(JSON.stringify(window.LLD_DATA.me)); // copy of the sample creator, for "Fill with sample"
  const BIO_MAX = 160,
    CAT_MAX = 3;
  const LANGS = [
    "Hindi",
    "English",
    "Marathi",
    "Tamil",
    "Telugu",
    "Bengali",
    "Kannada",
    "Malayalam",
    "Gujarati",
    "Punjabi",
    "Odia",
    "Urdu",
  ];
  const CATS = [
    "Skincare",
    "Beauty",
    "Fashion",
    "Lifestyle",
    "Food & drink",
    "Travel",
    "Fitness",
    "Home",
    "Tech",
    "Finance",
    "Gaming",
    "Education",
  ];
  const GENDERS = ["Woman", "Man", "Non-binary", "Another identity", "Prefer not to say"];
  const STATES = [
    "Andhra Pradesh",
    "Arunachal Pradesh",
    "Assam",
    "Bihar",
    "Chhattisgarh",
    "Goa",
    "Gujarat",
    "Haryana",
    "Himachal Pradesh",
    "Jharkhand",
    "Karnataka",
    "Kerala",
    "Madhya Pradesh",
    "Maharashtra",
    "Manipur",
    "Meghalaya",
    "Mizoram",
    "Nagaland",
    "Odisha",
    "Punjab",
    "Rajasthan",
    "Sikkim",
    "Tamil Nadu",
    "Telangana",
    "Tripura",
    "Uttar Pradesh",
    "Uttarakhand",
    "West Bengal",
    "Andaman and Nicobar Islands",
    "Chandigarh",
    "Dadra and Nagar Haveli and Daman and Diu",
    "Delhi",
    "Jammu and Kashmir",
    "Ladakh",
    "Lakshadweep",
    "Puducherry",
  ];
  const CITIES = [
    "Mumbai",
    "Pune",
    "Delhi",
    "Bengaluru",
    "Hyderabad",
    "Chennai",
    "Kolkata",
    "Ahmedabad",
    "Jaipur",
    "Lucknow",
    "Kochi",
    "Indore",
    "Chandigarh",
    "Surat",
    "Nagpur",
    "Bhopal",
    "Guwahati",
    "Coimbatore",
    "Visakhapatnam",
    "Thane",
    "Navi Mumbai",
    "Noida",
    "Gurugram",
    "Mysuru",
    "Nashik",
  ];
  const STEPS = [
    {
      id: "you",
      t: "About you",
      sub: "Brands see your name. Your date of birth and contact details stay private.",
    },
    {
      id: "platforms",
      t: "Your platforms",
      sub: "Add at least one. Numbers you type are marked self-reported until the account is connected.",
    },
    { id: "work", t: "Your work", sub: "A short line about what you make, and where your audience is." },
    {
      id: "photo",
      t: "Profile photo",
      sub: "Optional. A clear face photo works best. You can change it later.",
    },
  ];
  const todayISO = () => {
    const t = LLD.today();
    return new Date(t.getTime() + 5.5 * 36e5).toISOString().slice(0, 10);
  }; // IST date
  const press = el => {
    try {
      LLD.motion.press(el);
    } catch (e) {}
  };
  const maskPhone = d => "+91 " + d.slice(0, 2) + "•••••" + d.slice(7);
  const digits = v => String(v || "").replace(/[,\s]/g, "");

  /* ---------- validators shared with the profile edit sheet ---------- */
  const V = {
    name: v => {
      v = v.trim();
      if (!v) return "Enter the name brands will see.";
      if (v.length < 2) return "Use at least 2 letters.";
      if (v.length > 60) return "Keep it under 60 characters.";
      if (!/^[\p{L}][\p{L}\p{M} .'-]*$/u.test(v)) return "Use letters, spaces, dots or hyphens only.";
      return "";
    },
    email: v => {
      v = v.trim();
      if (!v) return "Enter your email.";
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)
        ? ""
        : "That email looks incomplete, like name@example.com.";
    },
    mobile: v => {
      const d = v.replace(/\D/g, "");
      if (!d) return "Enter your mobile number.";
      if (d.length !== 10) return "Enter all 10 digits.";
      return /^[6-9]/.test(d) ? "" : "Indian mobile numbers start with 6, 7, 8 or 9.";
    },
    ig: v => {
      v = v.trim();
      if (!v) return { h: "" };
      const m =
        v.match(/^(?:https?:\/\/)?(?:www\.)?instagram\.com\/([A-Za-z0-9._]{1,30})\/?(?:\?.*)?$/i) ||
        v.match(/^@?([A-Za-z0-9._]{1,30})$/);
      return m ? { h: m[1] } : { e: "Use your Instagram username, like @ananyamakes, or your profile link." };
    },
    yt: v => {
      v = v.trim();
      if (!v) return { h: "" };
      let m = v.match(
        /^(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/(@[A-Za-z0-9._-]{3,30}|channel\/UC[\w-]{10,30}|c\/[\w.-]{1,100})\/?(?:\?.*)?$/i,
      );
      if (m) return { h: m[1] };
      m = v.match(/^@?([A-Za-z0-9._-]{3,30})$/);
      return m
        ? { h: "@" + m[1] }
        : { e: "Use your YouTube handle, like @AnanyaMakes, or your channel link." };
    },
    count: (v, req) => {
      const d = digits(v);
      if (!d) return req ? "Add your follower count." : "";
      return /^\d{1,10}$/.test(d) ? "" : "Use whole numbers, like 182000.";
    },
    er: v => {
      const d = String(v || "")
        .trim()
        .replace("%", "");
      if (!d) return "";
      const n = Number(d);
      return isFinite(n) && n >= 0 && n <= 100 ? "" : "Use a percentage between 0 and 100.";
    },
    url: v => {
      v = v.trim();
      if (!v) return "Paste a link.";
      try {
        const u = new URL(/^https?:\/\//i.test(v) ? v : "https://" + v);
        return /\./.test(u.hostname) ? "" : "That link looks incomplete.";
      } catch (e) {
        return "That doesn't look like a link. Try instagram.com/reel/…";
      }
    },
  };

  /* ---------- LLA.photo: choose, validate, crop (drag + zoom), export a square JPEG ---------- */
  window.LLA = window.LLA || {};
  const PH_TYPES = { "image/jpeg": 1, "image/png": 1, "image/webp": 1 },
    PH_MAX = 5 * 1024 * 1024,
    PH_MIN = 200;
  let phN = 0;
  LLA.photo = function (host, { src = null, crop = null, initials = () => "", onChange } = {}) {
    const id = "ph" + ++phN;
    host.innerHTML = `
      <div class="setup-ph">
        <div class="setup-ph-frame" tabindex="0" role="group" aria-roledescription="photo crop" aria-label="Photo crop. Drag or use arrow keys to move, plus or minus to zoom." aria-describedby="${id}-h">
          <img class="setup-ph-img" alt="" draggable="false" hidden>
          <span class="setup-ph-ph" aria-hidden="true"><b></b>${icon("camera")}</span>
        </div>
        <div class="setup-ph-side">
          <div class="row wrap">
            <button class="lq lq-s lq-sm" type="button" data-pick>${icon("upload", "ic")}<span data-pick-l>Choose a photo</span></button>
            <button class="btn-q" type="button" data-remove hidden>Remove</button>
          </div>
          <input class="sr-only" type="file" id="${id}-f" accept="image/jpeg,image/png,image/webp" tabindex="-1" aria-label="Profile photo file">
          <p class="help" id="${id}-h">JPG, PNG or WebP, up to 5 MB and at least 200 px wide.</p>
          <div class="setup-zoom" data-zoomrow hidden>
            <label for="${id}-z">Zoom</label>
            <input type="range" id="${id}-z" min="1" max="3" step="0.01" value="1">
          </div>
          <p class="err" aria-live="polite" data-perr></p>
        </div>
      </div>`;
    LLD.liquid(host);
    const frame = host.querySelector(".setup-ph-frame"),
      img = host.querySelector(".setup-ph-img"),
      ph = host.querySelector(".setup-ph-ph b");
    const file = host.querySelector("input[type=file]"),
      zoom = host.querySelector("input[type=range]"),
      zoomRow = host.querySelector("[data-zoomrow]");
    const err = host.querySelector("[data-perr]"),
      rm = host.querySelector("[data-remove]"),
      pick = host.querySelector("[data-pick]");
    const st = { img: null, zoom: 1, cx: 0.5, cy: 0.5 };
    const fit = (F, o) => {
      const w = o.img.naturalWidth,
        h = o.img.naturalHeight,
        sc = (F / Math.min(w, h)) * o.zoom,
        W = w * sc,
        H = h * sc;
      let ox = F / 2 - o.cx * W,
        oy = F / 2 - o.cy * H;
      ox = Math.min(0, Math.max(F - W, ox));
      oy = Math.min(0, Math.max(F - H, oy));
      return { W, H, ox, oy };
    };
    function layout() {
      const has = !!st.img;
      img.hidden = !has;
      host.querySelector(".setup-ph-ph").hidden = has;
      zoomRow.hidden = !has;
      rm.hidden = !has;
      host.querySelector("[data-pick-l]").textContent = has ? "Replace photo" : "Choose a photo";
      host.querySelectorAll(".t2 [data-pick-l]").forEach(s => {
        s.textContent = has ? "Replace photo" : "Choose a photo";
      });
      ph.textContent = initials() || "";
      if (!has) return;
      const F = frame.clientWidth || 200,
        r = fit(F, st);
      st.cx = (F / 2 - r.ox) / r.W;
      st.cy = (F / 2 - r.oy) / r.H;
      img.style.width = r.W + "px";
      img.style.height = r.H + "px";
      img.style.transform = `translate(${r.ox}px,${r.oy}px)`;
    }
    const changed = () => {
      layout();
      onChange && onChange();
    };
    function load(url, keep) {
      const im = new Image();
      im.onload = () => {
        if (Math.min(im.naturalWidth, im.naturalHeight) < PH_MIN) {
          err.textContent = `That photo is only ${im.naturalWidth} × ${im.naturalHeight} px. Use one at least ${PH_MIN} px wide.`;
          return;
        }
        err.textContent = "";
        st.img = im;
        img.src = url;
        if (keep && crop) {
          st.zoom = crop.zoom || 1;
          st.cx = crop.cx ?? 0.5;
          st.cy = crop.cy ?? 0.5;
        } else {
          st.zoom = 1;
          st.cx = 0.5;
          st.cy = 0.5;
        }
        zoom.value = st.zoom;
        changed();
      };
      im.onerror = () => {
        err.textContent = "We couldn't open that photo. Try another JPG or PNG.";
      };
      im.src = url;
    }
    pick.addEventListener("click", () => file.click());
    file.addEventListener("change", () => {
      const f = file.files && file.files[0];
      file.value = "";
      if (!f) return;
      const kind = (f.type.split("/")[1] || f.name.split(".").pop() || "unknown").toUpperCase();
      if (!PH_TYPES[f.type]) {
        err.textContent = `That file is ${kind === "UNKNOWN" ? "not a photo" : "a " + esc(kind) + " file"}. Use a JPG, PNG or WebP photo.`;
        return;
      }
      if (f.size > PH_MAX) {
        err.textContent = `That photo is ${(f.size / 1048576).toFixed(1)} MB. Use one under 5 MB.`;
        return;
      }
      if (!f.size) {
        err.textContent = "That file is empty. Try another photo.";
        return;
      }
      const rd = new FileReader();
      rd.onerror = () => {
        err.textContent = "We couldn't read that file. Try another photo.";
      };
      rd.onload = () => load(rd.result);
      rd.readAsDataURL(f);
    });
    rm.addEventListener("click", () => {
      st.img = null;
      img.removeAttribute("src");
      err.textContent = "";
      changed();
      pick.focus();
    });
    zoom.addEventListener("input", () => {
      st.zoom = +zoom.value;
      changed();
    });
    // drag to reposition
    let drag = null;
    frame.addEventListener("pointerdown", e => {
      if (!st.img) return;
      drag = { x: e.clientX, y: e.clientY };
      frame.setPointerCapture(e.pointerId);
      frame.classList.add("is-drag");
    });
    frame.addEventListener("pointermove", e => {
      if (!drag) return;
      const F = frame.clientWidth,
        r = fit(F, st);
      st.cx -= (e.clientX - drag.x) / r.W;
      st.cy -= (e.clientY - drag.y) / r.H;
      drag = { x: e.clientX, y: e.clientY };
      changed();
    });
    const end = () => {
      drag = null;
      frame.classList.remove("is-drag");
    };
    frame.addEventListener("pointerup", end);
    frame.addEventListener("pointercancel", end);
    frame.addEventListener("keydown", e => {
      if (!st.img) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          file.click();
        }
        return;
      }
      const F = frame.clientWidth,
        r = fit(F, st),
        step = 8;
      const k = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[
        e.key
      ];
      if (k) {
        e.preventDefault();
        st.cx -= k[0] / r.W;
        st.cy -= k[1] / r.H;
        changed();
      } else if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        st.zoom = Math.min(3, st.zoom + 0.1);
        zoom.value = st.zoom;
        changed();
      } else if (e.key === "-") {
        e.preventDefault();
        st.zoom = Math.max(1, st.zoom - 0.1);
        zoom.value = st.zoom;
        changed();
      }
    });
    const ro = new ResizeObserver(() => layout());
    ro.observe(frame);
    if (src) load(src, true);
    else layout();
    return {
      has: () => !!st.img,
      state: () => (st.img ? { src: img.src, zoom: st.zoom, cx: st.cx, cy: st.cy } : null),
      refresh: layout,
      exportURL() {
        if (!st.img) return null;
        const F = 400,
          c = document.createElement("canvas");
        c.width = c.height = F;
        const r = fit(F, st);
        const ctx = c.getContext("2d");
        ctx.drawImage(st.img, r.ox, r.oy, r.W, r.H);
        try {
          return c.toDataURL("image/jpeg", 0.88);
        } catch (e) {
          return null;
        }
      },
      destroy() {
        ro.disconnect();
      },
    };
  };
  LLA.V = V;
  LLA.LANGS = LANGS;
  LLA.CATS = CATS;
  LLA.STATES = STATES;
  LLA.CITIES = CITIES;
  LLA.GENDERS = GENDERS;
  LLA.BIO_MAX = BIO_MAX;
  LLA.CAT_MAX = CAT_MAX;

  /* ---------- draft: survives step changes and leaving the screen; reset on a new sign-in ---------- */
  let D = null;
  store.on(why => {
    if (why === "signed-in") D = null;
  });
  function fresh() {
    const s = store.s,
      me = s.me,
      sess = s.session,
      pre = !sess.firstLogin;
    const p = k => (pre && me.platforms[k]) || {};
    return {
      step: 0,
      reached: 0,
      name: pre ? me.name : sess.method === "google" ? sess.googleName || "" : "",
      email: "",
      mobile: "",
      dob: pre ? me.dob : "",
      gender: pre ? me.gender || "" : "",
      ig: {
        handle: (p("instagram").handle || "").replace(/^@/, ""),
        followers: p("instagram").followers || "",
        avgViews: p("instagram").avgViews || "",
        er: p("instagram").er || "",
      },
      yt: {
        handle: p("youtube").handle || "",
        followers: p("youtube").followers || "",
        avgViews: p("youtube").avgViews || "",
        er: p("youtube").er || "",
      },
      bio: pre ? me.bio : "",
      categories: pre ? [...(me.categories || [])] : [],
      languages: pre ? [...(me.languages || [])] : [],
      city: pre ? me.city : "",
      region: pre ? me.region : "",
      photo: pre ? me.photo : null,
    };
  }
  function fillSample(step) {
    const m = SAMPLE,
      ig = m.platforms.instagram,
      yt = m.platforms.youtube;
    if (step === 0) {
      D.name = m.name;
      D.dob = m.dob;
      D.gender = m.gender;
      D.email = store.s.session.method === "mobile" ? "ananya.iyer@example.com" : D.email;
      D.mobile = store.s.session.method === "google" ? "98765 43210" : D.mobile;
    }
    if (step === 1) {
      D.ig = {
        handle: ig.handle.replace(/^@/, ""),
        followers: ig.followers,
        avgViews: ig.avgViews,
        er: ig.er,
      };
      D.yt = { handle: yt.handle, followers: yt.followers, avgViews: yt.avgViews, er: yt.er };
    }
    if (step === 2) {
      D.bio = m.bio;
      D.categories = [...m.categories];
      D.languages = [...m.languages];
      D.city = m.city;
      D.region = m.region;
    }
  }

  const opt = (type, name, val, on, extra = "") =>
    `<label class="setup-opt"><input type="${type}" name="${name}" value="${esc(val)}" ${on ? "checked" : ""} ${extra}><span>${esc(val)}</span></label>`;
  const fld = (id, label, input, help = "") =>
    `<div class="field" data-field="${id}"><label for="setup-${id}">${label}</label>${input}${help ? `<p class="help" id="setup-${id}-h">${help}</p>` : ""}<p class="err" id="setup-${id}-e" aria-live="polite"></p></div>`;

  function render(el) {
    const sess = store.s.session;
    if (!D) D = fresh();
    el.innerHTML = `
    <div class="focus setup">
      <section class="focus-art dark setup-art" aria-label="Profile setup progress">
        <p class="setup-brand"><img src="assets/logo-mark.svg" width="28" height="28" alt=""><span>linkloom</span></p>
        <h2 class="t-display setup-line">Brands read this before your bid.</h2>
        <ol class="setup-rail" data-rail></ol>
        <img class="setup-orbit" src="assets/step-04-orbit.svg" width="300" height="220" alt="">
        <div class="setup-prog" aria-hidden="true">${STEPS.map(() => "<span></span>").join("")}</div>
      </section>
      <section class="focus-form light setup-form">
        <form class="setup-in" novalidate data-form>
          <div class="setup-top">
            <div class="row between wrap">
              <p class="t-eyebrow muted" data-count></p>
              <button type="button" class="btn-q setup-fill" data-fill><span class="sample">Sample</span> Fill this step</button>
            </div>
            <h1 class="t-h1" tabindex="-1" data-h></h1>
            <p class="muted" data-sub></p>
          </div>
          <div class="setup-body" data-body></div>
          <p class="setup-formerr" role="alert" data-formerr hidden></p>
          <div class="setup-nav">
            <button class="lq lq-s" type="button" data-back>${icon("back", "ic")}Back</button>
            <button class="lq lq-p" type="submit" data-next>Continue</button>
          </div>
        </form>
        <p class="sr-only" aria-live="polite" data-live></p>
      </section>
    </div>`;

    const $ = s => el.querySelector(s);
    const body = $("[data-body]"),
      form = $("[data-form]"),
      next = $("[data-next]"),
      back = $("[data-back]"),
      live = $("[data-live]"),
      formErr = $("[data-formerr]");
    let picker = null,
      alive = true;
    const setLabel = (b, t) =>
      b.querySelectorAll(".t,.t2").forEach(s => {
        s.textContent = t;
      });

    let railAt = null; // last painted step, so a forward move can pull the rail thread
    function paintRail() {
      $("[data-rail]").innerHTML = STEPS.map((s, i) => {
        const state = i < D.step ? "done" : i === D.step ? "now" : "next";
        const can = i <= D.reached && i !== D.step;
        const inner = `<span class="setup-rail-n">${state === "done" ? icon("check") : "0" + (i + 1)}</span><span class="setup-rail-t">${esc(s.t)}</span>`;
        return `<li class="setup-rail-i is-${state}" ${state === "now" ? 'aria-current="step"' : ""}>${can ? `<button type="button" data-goto="${i}">${inner}<span class="sr-only">, go back to this step</span></button>` : `<span class="setup-rail-b">${inner}</span>`}</li>`;
      }).join("");
      el.querySelectorAll(".setup-prog span").forEach((b, i) => {
        b.className = i < D.step ? "is-done" : i === D.step ? "is-now" : "";
      });
      el.querySelectorAll("[data-goto]").forEach(b => b.addEventListener("click", () => go(+b.dataset.goto)));
      const ns = el.querySelectorAll(".setup-rail-n");
      if (railAt != null && D.step > railAt && ns[railAt] && ns[D.step]) {
        try {
          LLD.motion.pull && LLD.motion.pull(ns[railAt], ns[D.step]);
        } catch (e) {}
      }
      railAt = D.step;
    }

    function paint(focusHead) {
      const s = STEPS[D.step];
      $("[data-count]").textContent = `Step ${D.step + 1} of ${STEPS.length}`;
      $("[data-h]").textContent = s.t;
      $("[data-sub]").textContent = s.sub;
      $("[data-fill]").hidden = !import.meta.env.VITE_TEST_HOOKS || D.step === 3; // sample filler exists only in the parity build
      back.hidden = D.step === 0;
      setLabel(next, D.step === 3 ? "Save profile" : "Continue");
      formErr.hidden = true;
      if (picker) {
        D.photoState = picker.state();
        D.photo = D.photoState ? D.photo : null;
        picker.destroy();
        picker = null;
      }
      next.disabled = false;
      body.innerHTML = [stepYou, stepPlatforms, stepWork, stepPhoto][D.step]();
      LLD.liquid(body);
      [wireYou, wirePlatforms, wireWork, wirePhoto][D.step]();
      paintRail();
      try {
        LLD.motion.stagger([...body.children]);
      } catch (e) {}
      if (focusHead) {
        $("[data-h]").focus({ preventScroll: true });
        window.scrollTo({ top: 0 });
      }
      live.textContent = `Step ${D.step + 1} of ${STEPS.length}: ${s.t}`;
    }

    /* ---- step 1: about you ---- */
    function stepYou() {
      const verified = [];
      if (sess.method === "google" && sess.email) verified.push(["Email", sess.email, "Verified by Google"]);
      if (sess.method === "mobile" && sess.mobile) verified.push(["Mobile", sess.mobile, "Verified by OTP"]);
      return `
        ${fld("name", "Display name", `<input class="input" id="setup-name" autocomplete="name" value="${esc(D.name)}" aria-describedby="setup-name-h setup-name-e">`, "Shown on your profile and bids.")}
        ${verified.map(v => `<div class="setup-verified"><span class="setup-v-l">${esc(v[0])}</span><span class="setup-v-v num">${esc(v[1])}</span><span class="pill pill-ok" data-motion="check">${icon("check")}${esc(v[2])}</span></div>`).join("")}
        ${sess.method !== "mobile" ? fld("mobile", "Mobile number", `<div class="setup-tel"><span aria-hidden="true">+91</span><input class="input" id="setup-mobile" type="tel" inputmode="numeric" autocomplete="tel-national" maxlength="11" value="${esc(D.mobile)}" placeholder="98765 43210" aria-describedby="setup-mobile-h setup-mobile-e"></div>`, "Private. Used for payout alerts, never shown to brands.") : ""}
        ${sess.method === "mobile" ? fld("email", "Email", `<input class="input" id="setup-email" type="email" autocomplete="email" value="${esc(D.email)}" placeholder="name@example.com" aria-describedby="setup-email-h setup-email-e">`, "Private. For receipts and payout slips.") : ""}
        ${fld("dob", "Date of birth", `<input class="input setup-dob" id="setup-dob" type="date" min="1920-01-01" max="${todayISO()}" value="${esc(D.dob)}" aria-describedby="setup-dob-h setup-dob-e">`, "")}
        <div class="setup-age" data-age role="status" hidden></div>
        <fieldset class="setup-fs">
          <legend class="lab">Gender <span class="setup-opt-l">optional</span></legend>
          <div class="setup-opts">${GENDERS.map(g => opt("radio", "gender", g, D.gender === g)).join("")}</div>
        </fieldset>`;
    }
    function ageState() {
      const v = D.dob;
      if (!v) return { ok: false, msg: "" };
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return { ok: false, msg: "Enter a full date." };
      if (v > todayISO()) return { ok: false, msg: "That date is in the future." };
      const a = LLD.ageFrom(v);
      if (a > 110) return { ok: false, msg: "Check the year." };
      if (a < 18) return { ok: false, minor: true, age: a };
      return { ok: true, age: a };
    }
    function paintAge() {
      const box = $("[data-age]"),
        st = ageState(),
        f = el.querySelector("[data-field=dob]");
      f.classList.toggle("is-err", !!st.msg || !!st.minor);
      f.querySelector(".err").textContent = st.msg || "";
      if (st.minor) {
        box.hidden = false;
        box.className = "setup-age is-minor";
        box.innerHTML = `${icon("alert")}<div><p class="t-label">You need to be 18 or older to join as a creator</p><p>Based on this date you're ${st.age}. Brand deals on Linkloom are only open to adults, so you can't continue yet.</p><button type="button" class="btn-q" data-signout>Sign out</button></div>`;
        box.querySelector("[data-signout]").addEventListener("click", signOut);
      } else if (st.ok) {
        box.hidden = false;
        box.className = "setup-age is-ok";
        box.innerHTML = `<span class="setup-age-n t-money">${st.age}</span><p>years old. Brands never see your date of birth.</p>`;
      } else box.hidden = true;
      next.disabled = !!st.minor;
    }
    function wireYou() {
      const on = (id, k, fmt) => {
        const i = el.querySelector("#setup-" + id);
        if (!i) return;
        i.addEventListener("input", () => {
          if (fmt) i.value = fmt(i.value);
          D[k] = i.value;
          clearErr(id);
        });
      };
      on("name", "name");
      on("email", "email");
      on("mobile", "mobile", v => {
        const d = v.replace(/\D/g, "").slice(0, 10);
        return d.length > 5 ? d.slice(0, 5) + " " + d.slice(5) : d;
      });
      const dob = el.querySelector("#setup-dob");
      dob.addEventListener("input", () => {
        D.dob = dob.value;
        paintAge();
      });
      dob.addEventListener("change", () => {
        D.dob = dob.value;
        paintAge();
      });
      el.querySelectorAll("input[name=gender]").forEach(r =>
        r.addEventListener("change", () => {
          D.gender = r.value;
        }),
      );
      paintAge();
    }
    function checkYou() {
      const errs = [];
      const e1 = V.name(D.name);
      if (e1) errs.push(["name", e1]);
      if (sess.method !== "mobile") {
        const e = V.mobile(D.mobile);
        if (e) errs.push(["mobile", e]);
      }
      if (sess.method === "mobile") {
        const e = V.email(D.email);
        if (e) errs.push(["email", e]);
      }
      const a = ageState();
      if (!D.dob)
        errs.push(["dob", "Enter your date of birth. We use it only to confirm you're 18 or older."]);
      else if (a.msg) errs.push(["dob", a.msg]);
      else if (a.minor) errs.push(["dob", ""]);
      return errs;
    }

    /* ---- step 2: platforms ---- */
    function plat(k, name, ic, ph) {
      const p = D[k];
      return `
        <fieldset class="setup-plat" data-plat="${k}">
          <legend class="setup-plat-h"><span class="setup-plat-ic">${icon(ic)}</span><span class="t-h3">${name}</span><span class="pill pill-paper">Self-reported</span></legend>
          ${fld(k + "-handle", "Username or profile link", `<input class="input" id="setup-${k}-handle" autocomplete="off" spellcheck="false" value="${esc(p.handle)}" placeholder="${ph}" aria-describedby="setup-${k}-handle-e">`)}
          <div class="setup-metrics">
            ${fld(k + "-followers", k === "yt" ? "Subscribers" : "Followers", `<input class="input num" id="setup-${k}-followers" inputmode="numeric" value="${esc(p.followers)}" placeholder="0" aria-describedby="setup-${k}-followers-e">`)}
            ${fld(k + "-avgViews", "Avg views", `<input class="input num" id="setup-${k}-avgViews" inputmode="numeric" value="${esc(p.avgViews)}" placeholder="optional" aria-describedby="setup-${k}-avgViews-e">`)}
            ${fld(k + "-er", "Engagement %", `<input class="input num" id="setup-${k}-er" inputmode="decimal" value="${esc(p.er)}" placeholder="optional" aria-describedby="setup-${k}-er-e">`)}
          </div>
        </fieldset>`;
    }
    const stepPlatforms = () =>
      plat("ig", "Instagram", "ig", "@yourname") +
      plat("yt", "YouTube", "yt", "@YourChannel") +
      `<p class="help setup-note">${icon("info")}Linkloom works with Instagram and YouTube for now.</p>`;
    function wirePlatforms() {
      ["ig", "yt"].forEach(k =>
        ["handle", "followers", "avgViews", "er"].forEach(f => {
          const i = el.querySelector(`#setup-${k}-${f}`);
          i.addEventListener("input", () => {
            D[k][f] = i.value;
            clearErr(`${k}-${f}`);
          });
        }),
      );
    }
    function checkPlatforms() {
      const errs = [];
      let any = false;
      ["ig", "yt"].forEach(k => {
        const p = D[k],
          r = V[k](String(p.handle));
        if (r.e) errs.push([k + "-handle", r.e]);
        const has = r.h || (!r.e && String(p.handle).trim());
        if (has) {
          any = true;
          const ef = V.count(p.followers, true);
          if (ef) errs.push([k + "-followers", ef]);
          const ev = V.count(p.avgViews, false);
          if (ev) errs.push([k + "-avgViews", ev]);
          const ee = V.er(p.er);
          if (ee) errs.push([k + "-er", ee]);
        } else if (!r.e && (digits(p.followers) || digits(p.avgViews)))
          errs.push([k + "-handle", "Add the username these numbers belong to."]);
      });
      if (!any && !errs.length) errs.push(["ig-handle", "Add at least one platform: Instagram or YouTube."]);
      return errs;
    }

    /* ---- step 3: your work ---- */
    function stepWork() {
      return `
        <div class="field" data-field="bio">
          <div class="row between"><label class="lab" for="setup-bio">Short bio</label><span class="setup-count num" id="setup-bio-c" data-bioc></span></div>
          <textarea class="textarea" id="setup-bio" rows="3" aria-describedby="setup-bio-c setup-bio-e" placeholder="Honest skincare for humid weather. Routines and 30-day tests.">${esc(D.bio)}</textarea>
          <p class="err" id="setup-bio-e" aria-live="polite"></p>
        </div>
        <fieldset class="setup-fs" data-field="cats">
          <legend class="lab">What you make <span class="setup-opt-l">up to ${CAT_MAX}</span></legend>
          <div class="setup-opts" data-cats>${CATS.map(c => opt("checkbox", "cat", c, D.categories.includes(c))).join("")}</div>
        </fieldset>
        <fieldset class="setup-fs" data-field="langs">
          <legend class="lab">Languages you create in</legend>
          <div class="setup-opts">${LANGS.map(l => opt("checkbox", "lang", l, D.languages.includes(l))).join("")}</div>
          <p class="err" id="setup-langs-e" aria-live="polite"></p>
        </fieldset>
        <div class="setup-two">
          ${fld("city", "City", `<input class="input" id="setup-city" list="setup-cities" autocomplete="address-level2" value="${esc(D.city)}" placeholder="Mumbai" aria-describedby="setup-city-e"><datalist id="setup-cities">${CITIES.map(c => `<option value="${esc(c)}">`).join("")}</datalist>`)}
          ${fld("region", "State or UT", `<select class="select" id="setup-region" autocomplete="address-level1" aria-describedby="setup-region-e"><option value="">Choose</option>${STATES.map(s => `<option ${D.region === s ? "selected" : ""}>${esc(s)}</option>`).join("")}</select>`)}
        </div>
        <p class="help setup-note">${icon("pin")}Only your city and state appear on your profile. We never ask for your address.</p>`;
    }
    function bioCount() {
      const n = [...D.bio].length,
        c = $("[data-bioc]"),
        f = el.querySelector("[data-field=bio]");
      c.textContent = `${n} / ${BIO_MAX}`;
      c.classList.toggle("is-near", n > BIO_MAX - 20 && n <= BIO_MAX);
      c.classList.toggle("is-over", n > BIO_MAX);
      if (n > BIO_MAX) {
        f.classList.add("is-err");
        f.querySelector(".err").textContent = `${n - BIO_MAX} characters over. Trim it to ${BIO_MAX}.`;
      } else if (f.querySelector(".err").textContent.includes("over")) {
        f.classList.remove("is-err");
        f.querySelector(".err").textContent = "";
      }
    }
    function capCats() {
      const boxes = [...el.querySelectorAll("input[name=cat]")],
        full = D.categories.length >= CAT_MAX;
      boxes.forEach(b => {
        b.disabled = full && !b.checked;
        b.closest(".setup-opt").classList.toggle("is-off", b.disabled);
      });
    }
    function wireWork() {
      const bio = el.querySelector("#setup-bio");
      bio.addEventListener("input", () => {
        D.bio = bio.value;
        bioCount();
      });
      bioCount();
      el.querySelectorAll("input[name=cat]").forEach(b =>
        b.addEventListener("change", () => {
          D.categories = [...el.querySelectorAll("input[name=cat]:checked")].map(x => x.value);
          capCats();
        }),
      );
      capCats();
      el.querySelectorAll("input[name=lang]").forEach(b =>
        b.addEventListener("change", () => {
          D.languages = [...el.querySelectorAll("input[name=lang]:checked")].map(x => x.value);
          clearErr("langs");
        }),
      );
      const city = el.querySelector("#setup-city"),
        reg = el.querySelector("#setup-region");
      city.addEventListener("input", () => {
        D.city = city.value;
        clearErr("city");
      });
      reg.addEventListener("change", () => {
        D.region = reg.value;
        clearErr("region");
      });
    }
    function checkWork() {
      const errs = [],
        n = [...D.bio.trim()].length;
      if (!n) errs.push(["bio", "Add a line or two about what you make."]);
      else if (n < 20) errs.push(["bio", "Add a little more, at least 20 characters."]);
      else if (n > BIO_MAX) errs.push(["bio", `${n - BIO_MAX} characters over. Trim it to ${BIO_MAX}.`]);
      if (!D.languages.length) errs.push(["langs", "Pick at least one language."]);
      const c = D.city.trim();
      if (!c) errs.push(["city", "Add your city."]);
      else if (!/^[\p{L}][\p{L} .'-]{1,40}$/u.test(c))
        errs.push(["city", "Use the city name only, like Pune. No street or pin code."]);
      if (!D.region) errs.push(["region", "Choose your state or union territory."]);
      return errs;
    }

    /* ---- step 4: photo ---- */
    const stepPhoto = () => `<div data-photo></div>
      <div class="setup-sum" data-sum></div>`;
    function wirePhoto() {
      const ps = D.photoState;
      picker = LLA.photo(el.querySelector("[data-photo]"), {
        src: ps ? ps.src : D.photo,
        crop: ps,
        initials: () => (D.name.trim()[0] || "Y").toUpperCase(),
      });
      const ig = V.ig(String(D.ig.handle)).h,
        yt = V.yt(String(D.yt.handle)).h;
      $("[data-sum]").innerHTML = `
        <p class="t-eyebrow muted">You're about to save</p>
        <dl>
          <div class="kv"><dt>Name</dt><dd>${esc(D.name)}</dd></div>
          <div class="kv"><dt>Platforms</dt><dd>${[ig && "Instagram @" + ig, yt && "YouTube " + yt].filter(Boolean).map(esc).join(" · ")}</dd></div>
          <div class="kv"><dt>City</dt><dd>${esc(D.city)}, ${esc(D.region)}</dd></div>
          <div class="kv"><dt>Languages</dt><dd>${esc(D.languages.join(", "))}</dd></div>
        </dl>`;
    }

    /* ---- errors and navigation ---- */
    function clearErr(id) {
      const f = el.querySelector(`[data-field="${id}"]`);
      if (!f) return;
      f.classList.remove("is-err");
      const e = f.querySelector(".err");
      if (e) e.textContent = "";
      const i = f.querySelector("input,textarea,select");
      i && i.removeAttribute("aria-invalid");
    }
    function showErrs(errs) {
      errs.forEach(([id, msg]) => {
        const f = el.querySelector(`[data-field="${id}"]`);
        if (!f) return;
        f.classList.add("is-err");
        const e = f.querySelector(".err");
        if (e && msg) e.textContent = msg;
        const i = f.querySelector("input,textarea,select");
        i && i.setAttribute("aria-invalid", "true");
      });
      const first =
        errs.length &&
        el.querySelector(
          `[data-field="${errs[0][0]}"] input, [data-field="${errs[0][0]}"] textarea, [data-field="${errs[0][0]}"] select`,
        );
      if (first) first.focus();
    }
    const checks = [checkYou, checkPlatforms, checkWork, () => []];
    function go(i) {
      D.step = i;
      paint(true);
    }

    back.addEventListener("click", () => {
      if (D.step > 0) go(D.step - 1);
    });
    $("[data-fill]").addEventListener("click", () => {
      fillSample(D.step);
      paint(false);
      live.textContent = "Filled with sample details";
    });

    form.addEventListener("submit", e => {
      e.preventDefault();
      const errs = checks[D.step]();
      if (errs.length) {
        showErrs(errs);
        live.textContent = "Check the highlighted fields";
        return;
      }
      press(next);
      if (D.step < STEPS.length - 1) {
        D.step++;
        D.reached = Math.max(D.reached, D.step);
        paint(true);
        return;
      }
      save();
    });

    function save() {
      for (let i = 0; i < 3; i++) {
        const errs = checks[i]();
        if (errs.length) {
          go(i);
          showErrs(errs);
          return;
        }
      }
      if (!navigator.onLine) {
        formErr.hidden = false;
        formErr.textContent =
          "You're offline, so we couldn't save. Your answers are still here; save again when you're connected.";
        return;
      }
      const label = next.querySelector(".t")?.textContent || next.textContent;
      next.disabled = true;
      setLabel(next, "Saving…");
      const photo = picker && picker.has() ? picker.exportURL() : null;
      const commit = (message = "Profile saved. This is your profile.") => {
        if (!alive) return;
        const ig = V.ig(String(D.ig.handle)).h,
          yt = V.yt(String(D.yt.handle)).h,
          day = todayISO();
        const n = v => +digits(v) || 0;
        const platform = (h, url, p) => ({
          handle: h,
          url,
          followers: h ? n(p.followers) : 0,
          avgViews: h ? n(p.avgViews) : 0,
          er: h ? +String(p.er).replace("%", "") || 0 : 0,
          updated: day,
          source: "Self-reported",
        });
        store.set(s => {
          const me = s.me;
          me.name = D.name.trim().replace(/\s+/g, " ");
          me.dob = D.dob;
          me.gender = D.gender || "";
          me.bio = D.bio.trim();
          me.categories = [...D.categories];
          me.languages = [...D.languages];
          me.city = D.city.trim();
          me.region = D.region;
          me.photo = photo;
          me.platforms = me.platforms || {};
          me.platforms.instagram = platform(ig ? "@" + ig : "", ig ? "instagram.com/" + ig : "", D.ig);
          me.platforms.youtube = platform(
            yt ? (yt.startsWith("@") ? yt : yt.split("/").pop()) : "",
            yt ? "youtube.com/" + yt : "",
            D.yt,
          );
          me.handle = ig ? "@" + ig : yt || me.handle;
          if (D.email) s.session.email = D.email.trim();
          if (D.mobile) s.session.mobile = maskPhone(D.mobile.replace(/\D/g, ""));
          s.session.firstLogin = false;
          s.session.profileDone = true;
        }, "profile-saved");
        if (LLD.live) {
          const me = store.s.me;
          LLD.live.saveProfile({
            extras: {
              dob: me.dob,
              gender: me.gender,
              languages: me.languages,
              region: me.region,
              platforms: me.platforms,
            },
          });
          void LLD.live.reload().catch(() => undefined);
        }
        D = null;
        LLD.toast(message, "check");
        LLD.go("#profile");
      };
      if (!apiEnabled()) {
        setTimeout(commit, 500);
        return;
      }
      submitCreatorOnboarding({
        name: D.name,
        dob: D.dob,
        gender: D.gender,
        categories: D.categories,
        bio: D.bio,
        languages: D.languages,
        city: D.city,
        region: D.region,
        instagram: V.ig(String(D.ig.handle)).h,
        youtube: V.yt(String(D.yt.handle)).h,
        photo,
      }).then(
        res =>
          commit(
            res?.user?.approvalStatus === "pending"
              ? "Profile submitted for verification! Our team will review your account shortly."
              : undefined,
          ),
        err => {
          if (!alive) return;
          if (err instanceof ApiError && err.status === 401) {
            store.set(s => {
              s.session.signedIn = false;
              s.session.expired = true;
            }, "session-expired");
            LLD.go("#login-expired");
            return;
          }
          next.disabled = false;
          setLabel(next, label);
          formErr.hidden = false;
          formErr.textContent =
            err instanceof ApiError ? err.message : "We couldn't save that. Please try again.";
        },
      );
    }

    function signOut() {
      store.set(s => {
        s.session.signedIn = false;
      }, "signed-out");
      D = null;
      LLD.go("#login");
    }

    paint(false);
    return () => {
      alive = false;
      if (picker) {
        if (D) D.photoState = picker.state();
        picker.destroy();
      }
    };
  }

  LLD.register("setup", { title: "Set up your profile", shell: "focus", render });
})();
