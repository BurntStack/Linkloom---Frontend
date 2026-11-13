// @ts-nocheck
/* profile screens (Builder A)
   #setup   first-run brand profile, two short steps: brand (logo, name, website, industry, contact) and billing (legal name, GSTIN, address, accounts email).
            Save lands on #home.
   #profile the brand's own profile, laid out like the creator profile: masthead, an ink band of counts, brand details,
            billing details, plan ("Brand plan · renews 1 Dec", never a price), sign-in and security (change password, sign out).
            "Edit profile" opens a sheet with every brand field plus billing; "Change password" opens its own sheet.
   Shared helpers live on window.LLB (validators, logo picker) and LLD.brandStats() (also used by #home). */
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
  const SAMPLE = JSON.parse(JSON.stringify(window.LLD_DATA.me)); // the sample brand, for "Fill this step"
  const ABOUT_MAX = 160;
  const INDUSTRIES = [
    "Skincare",
    "Beauty and cosmetics",
    "Personal care",
    "Fashion",
    "Food and beverage",
    "Health and fitness",
    "Home and decor",
    "Consumer tech",
    "Travel and hospitality",
    "Finance",
    "Education",
    "Gaming",
    "Other",
  ];
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
  const LIVE = ["funded", "in_progress", "submitted", "revision", "approved"];
  const href = u => (/^https?:\/\//i.test(u) ? u : "https://" + u);
  const initial = n => (String(n || "").trim()[0] || "B").toUpperCase();
  const todayISO = () => new Date(L.today().getTime() + 198e5).toISOString().slice(0, 10);
  const setLabel = (b, t) =>
    b &&
    b.querySelectorAll(".t,.t2").forEach(s => {
      s.textContent = t;
    });
  const fmtMobile = d => (d ? "+91 " + String(d).slice(0, 5) + " " + String(d).slice(5) : "");

  /* ---------- counts shared with #home ---------- */
  L.brandStats = () => {
    const s = store.s,
      cs = s.campaigns || [];
    const hiredIds = [
      ...new Set(cs.filter(c => LIVE.includes(c.stage) || c.stage === "released").map(c => c.creator)),
    ];
    return {
      hiredIds,
      hired: hiredIds.length,
      active: cs.filter(c => LIVE.includes(c.stage)),
      funded: cs.filter(c => LIVE.includes(c.stage) || ["released", "refunded"].includes(c.stage)).length,
      jobs: (s.jobs || []).filter(j => j.status !== "draft").length,
      drafts: (s.jobs || []).filter(j => j.status === "draft").length,
    };
  };

  /* ---------- validators ---------- */
  const V = {
    brand: v => {
      v = v.trim();
      if (!v) return "Enter your brand name, as creators should see it.";
      if (v.length < 2) return "Use at least 2 characters.";
      return v.length > 60 ? "Keep it under 60 characters." : "";
    },
    person: v => {
      v = v.trim();
      if (!v) return "Enter the name of the person creators will talk to.";
      if (v.length < 2) return "Use at least 2 letters.";
      return /^[\p{L}][\p{L}\p{M} .'-]*$/u.test(v) ? "" : "Use letters, spaces, dots or hyphens only.";
    },
    website: v => {
      v = v.trim();
      if (!v) return "Add your website, like mirevo.in.";
      try {
        const u = new URL(href(v));
        return /\.[a-z]{2,}$/i.test(u.hostname) ? "" : "That website looks incomplete, like mirevo.in.";
      } catch (e) {
        return "That doesn't look like a website. Try mirevo.in.";
      }
    },
    industry: v => (v ? "" : "Choose the industry closest to yours."),
    legal: v => {
      v = v.trim();
      if (!v) return "Enter the legal name printed on invoices.";
      return v.length < 3 ? "Use the full registered name." : "";
    },
    gstin: v => {
      v = v.trim().toUpperCase();
      if (!v) return "";
      if (v.length !== 15) return `A GSTIN has 15 characters. This one has ${v.length}.`;
      return /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(v)
        ? ""
        : "Check the GSTIN. It looks like 27AABCM1234F1Z5.";
    },
    address: v => {
      v = v.trim();
      if (!v) return "Enter the billing address.";
      if (v.length < 12) return "Add the full address, with street and city.";
      return /\b\d{6}\b/.test(v) ? "" : "Add the 6-digit PIN code.";
    },
    email: v => {
      v = v.trim();
      if (!v) return "Enter the email that should receive invoices.";
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)
        ? ""
        : "That email looks incomplete, like accounts@brand.in.";
    },
    city: v => {
      v = v.trim();
      if (!v) return "Add your city.";
      return /^[\p{L}][\p{L} .'-]{1,40}$/u.test(v) ? "" : "Use the city name only, like Mumbai.";
    },
  };

  /* ---------- logo picker: choose, validate, preview (shared by setup and the edit sheet) ---------- */
  const LOGO_TYPES = { "image/png": 1, "image/jpeg": 1, "image/webp": 1, "image/svg+xml": 1 },
    LOGO_MAX = 2 * 1024 * 1024;
  let lgN = 0;
  function logoPicker(host, { src = null, initials = () => "B" } = {}) {
    const id = "lg" + ++lgN;
    let url = src;
    host.innerHTML = `<div class="profile-lg">
        <div class="profile-lg-frame" data-frame aria-hidden="true"></div>
        <div class="profile-lg-side">
          <p class="t-label" id="${id}-l">Logo</p>
          <div class="row wrap"><button class="lq lq-s lq-sm" type="button" data-pick aria-describedby="${id}-l ${id}-h">${icon("upload", "ic")}<span data-pl>Upload logo</span></button><button class="btn-q" type="button" data-rm hidden>Remove<span class="sr-only"> logo</span></button></div>
          <input class="sr-only" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" tabindex="-1" aria-label="Logo file" data-file>
          <p class="help" id="${id}-h">PNG, JPG, WebP or SVG, up to 2 MB. A square logo on a plain background looks best.</p>
          <p class="err" aria-live="polite" data-err></p>
        </div></div>`;
    L.liquid(host);
    const frame = host.querySelector("[data-frame]"),
      file = host.querySelector("[data-file]"),
      err = host.querySelector("[data-err]"),
      rm = host.querySelector("[data-rm]"),
      pick = host.querySelector("[data-pick]");
    const paint = () => {
      frame.classList.toggle("has-img", !!url);
      frame.innerHTML = url ? `<img src="${esc(url)}" alt="">` : `<span>${esc(initials())}</span>`;
      rm.hidden = !url;
      host.querySelectorAll("[data-pl]").forEach(s => {
        s.textContent = url ? "Replace logo" : "Upload logo";
      });
    };
    pick.addEventListener("click", () => file.click());
    file.addEventListener("change", () => {
      const f = file.files && file.files[0];
      file.value = "";
      if (!f) return;
      if (!LOGO_TYPES[f.type]) {
        err.textContent = `That file is ${f.type ? "a " + (f.type.split("/")[1] || "different").toUpperCase() + " file" : "not an image"}. Use PNG, JPG, WebP or SVG.`;
        return;
      }
      if (f.size > LOGO_MAX) {
        err.textContent = `That logo is ${(f.size / 1048576).toFixed(1)} MB. Use one under 2 MB.`;
        return;
      }
      if (!f.size) {
        err.textContent = "That file is empty. Try another logo.";
        return;
      }
      const rd = new FileReader();
      rd.onerror = () => {
        err.textContent = "We couldn't read that file. Try another logo.";
      };
      rd.onload = () => {
        const im = new Image();
        im.onload = () => {
          if (f.type !== "image/svg+xml" && Math.min(im.naturalWidth, im.naturalHeight) < 64) {
            err.textContent = `That logo is only ${im.naturalWidth} × ${im.naturalHeight} px. Use one at least 64 px on each side.`;
            return;
          }
          err.textContent = "";
          url = rd.result;
          paint();
          mo("bump", frame);
        };
        im.onerror = () => {
          err.textContent = "We couldn't open that image. Try another file.";
        };
        im.src = rd.result;
      };
      rd.readAsDataURL(f);
    });
    rm.addEventListener("click", () => {
      url = null;
      err.textContent = "";
      paint();
      pick.focus();
    });
    paint();
    return { get: () => url, refresh: paint };
  }
  window.LLB = { V, logo: logoPicker, INDUSTRIES, STATES };

  const fld = (p, id, label, input, help = "") =>
    `<div class="field" data-f="${id}"><label for="${p}-${id}">${label}</label>${input}${help ? `<p class="help" id="${p}-${id}-h">${help}</p>` : ""}<p class="err" id="${p}-${id}-e" aria-live="polite"></p></div>`;
  const sel = (id, list, val, ph = "Choose") =>
    `<select class="select" id="${id}"><option value="">${ph}</option>${list.map(x => `<option ${val === x ? "selected" : ""}>${esc(x)}</option>`).join("")}</select>`;
  const errAt = (root, id, msg) => {
    const f = root.querySelector(`[data-f="${id}"]`);
    if (!f) return;
    f.classList.add("is-err");
    const e = f.querySelector(".err");
    if (e) e.textContent = msg;
    const i = f.querySelector("input,select,textarea");
    i && i.setAttribute("aria-invalid", "true");
  };
  const clrErr = f => {
    if (!f) return;
    f.classList.remove("is-err");
    const e = f.querySelector(".err");
    if (e) e.textContent = "";
    const i = f.querySelector("input,select,textarea");
    i && i.removeAttribute("aria-invalid");
  };
  const wireClear = root =>
    root.querySelectorAll("[data-f] input,[data-f] select,[data-f] textarea").forEach(i => {
      i.addEventListener("input", () => clrErr(i.closest("[data-f]")));
      i.addEventListener("change", () => clrErr(i.closest("[data-f]")));
    });
  const focusErr = root => {
    const i = root.querySelector(".field.is-err input,.field.is-err select,.field.is-err textarea");
    if (i) {
      const b = i.closest(".ui-sel") && i.closest(".ui-sel").querySelector(".ui-sel-btn");
      (b || i).focus();
    }
  };
  const counter = (ta, out) => {
    const n = () => {
      const k = [...ta.value].length;
      out.textContent = `${k} / ${ABOUT_MAX}`;
      out.classList.toggle("is-near", k > ABOUT_MAX - 20 && k <= ABOUT_MAX);
      out.classList.toggle("is-over", k > ABOUT_MAX);
    };
    ta.addEventListener("input", n);
    n();
  };

  /* =====================================================================
     #setup (first run)
     ===================================================================== */
  const STEPS = [
    { t: "Your brand", sub: "Creators see this on your jobs and invitations before they accept." },
    { t: "Billing details", sub: "Printed on every invoice and credit note. Creators never see it." },
  ];
  let D = null;
  store.on(why => {
    if (why === "signed-in" || why === "signed-out") D = null;
  });
  function freshDraft() {
    const s = store.s,
      me = s.me,
      pre = !s.session.firstRun,
      b = me.billing || {};
    return {
      step: 0,
      logo: pre ? me.logo : null,
      brand: pre ? me.brand : "",
      website: pre ? me.website : "",
      industry: pre ? me.industry : "",
      name: pre ? me.name : "",
      role: pre ? me.role || "" : "",
      legal: pre ? b.legal || "" : "",
      gstin: pre ? b.gstin || "" : "",
      address: pre ? b.address || "" : "",
      bemail: pre ? b.email || "" : "",
    };
  }
  function renderSetup(el) {
    if (!D) D = freshDraft();
    el.innerHTML = `<div class="focus auth setup">
      <section class="focus-art dark auth-art" aria-label="Brand profile progress">
        <p class="auth-brand"><img src="assets/logo-mark.svg" width="28" height="28" alt=""><span>linkloom</span><span class="auth-for">for brands</span></p>
        <h2 class="t-display auth-line">Creators read this before they accept.</h2>
        <ol class="auth-rail" data-rail></ol>
        <div class="auth-prog" style="--n:2" aria-hidden="true"><span></span><span></span></div>
        <img class="auth-rings" src="assets/hero-rings.svg" width="610" height="660" alt="">
      </section>
      <section class="focus-form light auth-form">
        <form class="auth-in" novalidate data-form>
          <div class="auth-head">
            <div class="row between wrap"><p class="t-eyebrow muted" data-count></p><button type="button" class="btn-q auth-samplebtn" data-fill ${L.live ? "hidden" : ""}><span class="sample">Sample</span> Fill this step</button></div>
            <h1 class="t-h1" tabindex="-1" data-h></h1><p class="muted" data-sub></p>
          </div>
          <div class="auth-stack" data-body></div>
          <p class="profile-formerr" role="alert" data-ferr hidden></p>
          <div class="profile-setup-nav">
            <button class="lq lq-s" type="button" data-back>${icon("back", "ic")}Back</button>
            <button class="lq lq-p" type="submit" data-next>Continue</button>
          </div>
        </form>
        <p class="sr-only" aria-live="polite" data-live></p>
      </section></div>`;
    const $ = s => el.querySelector(s),
      body = $("[data-body]"),
      next = $("[data-next]"),
      back = $("[data-back]"),
      live = $("[data-live]");
    let picker = null,
      railAt = null,
      alive = true;

    function paintRail() {
      $("[data-rail]").innerHTML = STEPS.map((s, i) => {
        const st = i < D.step ? "done" : i === D.step ? "now" : "next";
        const inner = `<span class="auth-rail-n">${st === "done" ? icon("check") : "0" + (i + 1)}</span><span class="auth-rail-t">${esc(s.t)}</span>`;
        return `<li class="auth-rail-i is-${st}" ${st === "now" ? 'aria-current="step"' : ""}>${st === "done" ? `<button type="button" data-goto="${i}">${inner}<span class="sr-only">, go back to this step</span></button>` : `<span class="auth-rail-b">${inner}</span>`}</li>`;
      }).join("");
      el.querySelectorAll(".auth-prog span").forEach((b, i) => {
        b.className = i < D.step ? "is-done" : i === D.step ? "is-now" : "";
      });
      el.querySelectorAll("[data-goto]").forEach(b =>
        b.addEventListener("click", () => go(+b.dataset.goto, -1)),
      );
      const ns = el.querySelectorAll(".auth-rail-n");
      if (railAt != null && D.step > railAt) mo("pull", ns[railAt], ns[D.step], { color: "butter" });
      railAt = D.step;
    }
    function keep() {
      const v = id => {
        const i = el.querySelector("#su-" + id);
        return i ? i.value : null;
      };
      if (D.step === 0) {
        if (picker) D.logo = picker.get();
        ["brand", "website", "industry", "name", "role"].forEach(k => {
          const x = v(k);
          if (x != null) D[k] = x;
        });
      } else
        ["legal", "gstin", "address", "bemail"].forEach(k => {
          const x = v(k);
          if (x != null) D[k] = x;
        });
    }
    function paint(focus, dir) {
      const s = STEPS[D.step];
      $("[data-count]").textContent = `Step ${D.step + 1} of ${STEPS.length}`;
      $("[data-h]").textContent = s.t;
      $("[data-sub]").textContent = s.sub;
      back.hidden = D.step === 0;
      setLabel(next, D.step === STEPS.length - 1 ? "Save brand profile" : "Continue");
      $("[data-ferr]").hidden = true;
      const draw = () => {
        body.innerHTML =
          D.step === 0
            ? `
          <div data-logo></div>
          ${fld("su", "brand", "Brand name", `<input class="input" id="su-brand" autocomplete="organization" value="${esc(D.brand)}" placeholder="Mirevo Skincare">`, "Shown on your jobs, invitations and chats.")}
          <div class="profile-two">
            ${fld("su", "website", "Website", `<input class="input" id="su-website" inputmode="url" spellcheck="false" autocapitalize="off" value="${esc(D.website)}" placeholder="mirevo.in">`)}
            ${fld("su", "industry", "Industry", sel("su-industry", INDUSTRIES, D.industry))}
          </div>
          <div class="profile-two">
            ${fld("su", "name", "Contact person", `<input class="input" id="su-name" autocomplete="name" value="${esc(D.name)}" placeholder="Meera Kapoor">`)}
            ${fld("su", "role", 'Role <span class="profile-opt">optional</span>', `<input class="input" id="su-role" autocomplete="organization-title" value="${esc(D.role)}" placeholder="Brand manager">`)}
          </div>`
            : `
          ${fld("su", "legal", "Legal name", `<input class="input" id="su-legal" value="${esc(D.legal)}" placeholder="Mirevo Skincare Private Limited">`, "Exactly as registered. It appears on invoices.")}
          ${fld("su", "gstin", 'GSTIN <span class="profile-opt">optional</span>', `<input class="input num profile-gstin" id="su-gstin" maxlength="15" spellcheck="false" autocapitalize="characters" value="${esc(D.gstin)}" placeholder="27AABCM1234F1Z5">`, "Add it to claim input tax credit. Taxes as per confirmed rules.")}
          ${fld("su", "address", "Billing address", `<textarea class="textarea" id="su-address" rows="3" autocomplete="street-address" placeholder="4th floor, Lodha Supremus, Lower Parel, Mumbai 400013">${esc(D.address)}</textarea>`)}
          ${fld("su", "bemail", "Send invoices to", `<input class="input" id="su-bemail" type="email" spellcheck="false" autocapitalize="off" value="${esc(D.bemail)}" placeholder="accounts@brand.in">`, "Often your accounts team. You can change it later.")}`;
        L.liquid(body);
        wireClear(body);
        if (D.step === 0)
          picker = logoPicker(body.querySelector("[data-logo]"), {
            src: D.logo,
            initials: () => initial(($("#su-brand") || {}).value || D.brand),
          });
        const bi = $("#su-brand");
        bi && bi.addEventListener("input", () => picker && picker.refresh());
        const g = $("#su-gstin");
        g &&
          g.addEventListener("input", () => {
            const p = g.selectionStart;
            g.value = g.value.toUpperCase().replace(/\s/g, "");
            try {
              g.setSelectionRange(p, p);
            } catch (e) {}
          });
      };
      if (dir && L.motion && L.motion.swap) {
        try {
          L.motion.swap(body, draw, { dir });
        } catch (e) {
          draw();
        }
      } else {
        draw();
        mo("stagger", [...body.children]);
      }
      paintRail();
      if (focus) {
        $("[data-h]").focus({ preventScroll: true });
        window.scrollTo({ top: 0 });
      }
      live.textContent = `Step ${D.step + 1} of ${STEPS.length}: ${s.t}`;
    }
    function go(i, dir = 1) {
      keep();
      D.step = i;
      paint(true, dir);
    }
    function check(step) {
      const e = [];
      if (step === 0) {
        [
          ["brand", V.brand(D.brand)],
          ["website", V.website(D.website)],
          ["industry", V.industry(D.industry)],
          ["name", V.person(D.name)],
        ].forEach(x => x[1] && e.push(x));
      } else {
        [
          ["legal", V.legal(D.legal)],
          ["gstin", V.gstin(D.gstin)],
          ["address", V.address(D.address)],
          ["bemail", V.email(D.bemail)],
        ].forEach(x => x[1] && e.push(x));
      }
      return e;
    }
    back.addEventListener("click", () => go(D.step - 1, -1));
    $("[data-fill]").addEventListener("click", () => {
      keep();
      const m = SAMPLE,
        b = m.billing;
      if (D.step === 0)
        Object.assign(D, {
          brand: m.brand,
          website: m.website,
          industry: m.industry,
          name: m.name,
          role: m.role,
        });
      else Object.assign(D, { legal: b.legal, gstin: b.gstin, address: b.address, bemail: b.email });
      paint(false);
      live.textContent = "Filled with sample details";
    });
    $("[data-form]").addEventListener("submit", e => {
      e.preventDefault();
      keep();
      const errs = check(D.step);
      if (errs.length) {
        errs.forEach(x => errAt(body, x[0], x[1]));
        focusErr(body);
        live.textContent = "Check the highlighted fields";
        return;
      }
      if (D.step < STEPS.length - 1) {
        go(D.step + 1, 1);
        return;
      }
      if (!navigator.onLine) {
        const f = $("[data-ferr]");
        f.hidden = false;
        f.textContent =
          "You're offline, so we couldn't save. Your answers are still here; try again when you're connected.";
        return;
      }
      next.disabled = true;
      setLabel(next, "Saving…");
      setTimeout(
        () => {
          if (!alive) return;
          store.set(s => {
            const me = s.me;
            me.brand = D.brand.trim();
            me.website = D.website
              .trim()
              .replace(/^https?:\/\//i, "")
              .replace(/\/$/, "");
            me.industry = D.industry;
            me.name = D.name.trim().replace(/\s+/g, " ");
            me.role = D.role.trim();
            me.logo = D.logo || null;
            me.billing = {
              legal: D.legal.trim(),
              gstin: D.gstin.trim().toUpperCase(),
              address: D.address.trim(),
              email: D.bemail.trim(),
            };
            if (s.session.email) me.email = s.session.email;
            s.session.firstRun = false;
          }, "brand-profile-saved");
          const done = () => {
            D = null;
            L.toast("Brand profile saved", "check");
            L.go("#home");
          };
          if (!L.live) return done();
          const me = store.s.me;
          L.live
            .saveBrand(me)
            .then(() =>
              me.logo && String(me.logo).startsWith("data:")
                ? import("@/shared/api/uploads")
                    .then(u => L.live.uploadLogo(u.dataUrlToBlob(me.logo)))
                    .then(url => url && store.set(s => (s.me.logo = url), "profile-edited"))
                : null,
            )
            .then(done, e => {
              store.set(s => (s.session.firstRun = true), "brand-profile-saved");
              next.disabled = false;
              setLabel(next, "Save");
              const f = $("[data-ferr]");
              f.hidden = false;
              f.textContent = L.live.errorText(e);
            });
        },
        L.live ? 0 : 500,
      );
    });
    paint(false);
    return () => {
      alive = false;
      if (D && D.step === 0 && picker) D.logo = picker.get();
    };
  }

  /* =====================================================================
     #profile
     ===================================================================== */
  /* budget windows the brand can plan against (quarters); stored in LLD_DATA.budget as { label, total (paise), from, to } */
  const QUARTERS = [
    ["Oct–Dec 2026", "2026-10-01", "2026-12-31"],
    ["Jan–Mar 2027", "2027-01-01", "2027-03-31"],
    ["Apr–Jun 2027", "2027-04-01", "2027-06-30"],
  ];
  const budgetUsed = s => {
    const b = s.budget || {},
      q = QUARTERS.find(x => x[0] === b.label) || QUARTERS[0],
      from = b.from || q[1],
      to = b.to || q[2];
    return (s.payments || [])
      .filter(x => x.kind === "escrow" && x.status !== "refunded" && x.date >= from && x.date <= to)
      .reduce((n, x) => n + x.amount, 0);
  };

  function renderProfile(el, param) {
    const paint = () => {
      const s = store.s,
        me = s.me,
        b = me.billing || {},
        st = L.brandStats(),
        sess = s.session,
        p = s.plan;
      const bud = s.budget,
        used = budgetUsed(s);
      const hiredNames = st.hiredIds.map(id => (L.creator(id) || {}).name).filter(Boolean);
      el.innerHTML = `
      <div class="view-in profile">
        <header class="profile-mast">
          <div class="profile-logo ${me.logo ? "has-img" : ""}">${me.logo ? `<img src="${esc(me.logo)}" alt="${esc(me.brand)} logo">` : `<span aria-hidden="true">${esc(initial(me.brand))}</span>`}</div>
          <div class="profile-id">
            <p class="t-eyebrow">Brand · ${esc(me.industry || "Industry not set")} · ${esc(me.city || "")}${me.state ? ", " + esc(me.state) : ""}</p>
            <h1 class="t-display profile-name">${esc(me.brand)}</h1>
            ${me.website ? `<p class="profile-web"><a href="${esc(href(me.website))}" target="_blank" rel="noopener noreferrer">${icon("link")}<span>${esc(me.website)}</span><span class="sr-only">, opens in a new tab</span></a></p>` : ""}
            ${me.about ? `<p class="profile-bio">${esc(me.about)}</p>` : ""}
            <p class="profile-meta"><span class="pill pill-ok">${icon("verified")}Email and mobile verified</span><span class="profile-langs">Contact: ${esc(me.name)}${me.role ? ", " + esc(me.role) : ""}</span></p>
          </div>
          <div class="profile-act"><button class="lq lq-p" type="button" data-edit>${icon("edit", "ic")}Edit profile</button></div>
        </header>

        <section class="profile-band" aria-labelledby="profile-on">
          <div class="profile-band-h"><h2 class="t-eyebrow" id="profile-on">On Linkloom</h2>
            <p class="profile-src">${p ? "Since " + esc(L.fmtDate(p.since, { year: true })) + " · " : ""}counted by Linkloom, not self-reported <span class="sample">Sample</span></p></div>
          <dl class="profile-nums">
            <div><dt>Creators hired</dt><dd class="t-money" data-n="${st.hired}">${st.hired}</dd><p>${hiredNames.length ? esc(hiredNames.join(" and ")) : "Paid through escrow"}</p></div>
            <div><dt>Campaigns</dt><dd class="t-money" data-n="${st.funded}">${st.funded}</dd><p>funded through escrow</p></div>
            <div><dt>Jobs posted</dt><dd class="t-money" data-n="${st.jobs}">${st.jobs}</dd><p>${st.drafts ? `${st.drafts} draft not counted` : "open, hired or closed"}</p></div>
          </dl>
        </section>

        <div class="profile-grid">
          <div class="profile-col">
            <section class="profile-sec profile-card" aria-labelledby="profile-det">
              <div class="profile-sec-h"><h2 class="t-h2" id="profile-det">Brand details</h2><button type="button" class="btn-q" data-edit2>${icon("edit")}Edit</button></div>
              <dl class="profile-dl">
                <div><dt>Brand name</dt><dd>${esc(me.brand)}</dd></div>
                <div><dt>Industry</dt><dd>${esc(me.industry || "—")}</dd></div>
                <div><dt>Website</dt><dd>${me.website ? esc(me.website) : "—"}</dd></div>
                <div><dt>City</dt><dd>${esc([me.city, me.state].filter(Boolean).join(", ") || "—")}</dd></div>
                <div><dt>Contact person</dt><dd>${esc(me.name)}${me.role ? `<span class="t-cap muted">${esc(me.role)}</span>` : ""}</dd></div>
                ${me.email ? `<div><dt>Sign-in email</dt><dd>${esc(me.email)}<span class="profile-ok">${icon("check")}Verified by link</span></dd></div>` : ""}
                ${me.mobile ? `<div><dt>Mobile</dt><dd class="num">${esc(fmtMobile(me.mobile))}<span class="profile-ok">${icon("check")}Verified by OTP</span></dd></div>` : ""}
              </dl>
              <p class="t-cap muted">Creators see your brand name, logo, website, industry and city. Never your mobile or billing details.</p>
            </section>

            <section class="profile-sec profile-card" id="billing" aria-labelledby="profile-bill">
              <div class="profile-sec-h"><h2 class="t-h2" id="profile-bill">Billing details</h2><button type="button" class="btn-q" data-editbill>${icon("edit")}Edit billing</button></div>
              <dl class="profile-dl">
                <div><dt>Legal name</dt><dd>${esc(b.legal || "—")}</dd></div>
                <div><dt>GSTIN</dt><dd class="num">${esc(b.gstin || "Not added")}</dd></div>
                <div class="is-wide"><dt>Billing address</dt><dd>${esc(b.address || "—")}</dd></div>
                <div><dt>Invoices go to</dt><dd>${esc(b.email || "—")}</dd></div>
              </dl>
              <p class="t-cap muted">Printed on every Linkloom invoice and credit note. Taxes as per confirmed rules.</p>
            </section>
          </div>

          <div class="profile-col">
            ${
              p
                ? `<section class="profile-sec profile-plan" aria-labelledby="profile-plan">
              <p class="t-eyebrow" id="profile-plan">Plan</p>
              <p class="profile-plan-l">${esc(p.name)}${p.status === "active" && p.renews ? " · renews " + esc(L.fmtDate(p.renews)) : ""}</p>
              <span class="pill ${p.status === "active" ? "pill-ok" : "pill-warn"}">${p.status === "active" ? icon("check") + "Active" : esc(p.status)}</span>
              <p class="profile-plan-s">No per-deal platform fee. Creators receive the agreed price you pay into escrow.</p>
            </section>`
                : ""
            }

            <section class="profile-sec profile-card" id="budget" aria-labelledby="profile-bud">
              <div class="profile-sec-h"><h2 class="t-h3" id="profile-bud">${icon("chart")}Creator budget</h2><button type="button" class="btn-q" data-editbud>${icon("edit")}Change</button></div>
              ${
                bud && bud.total
                  ? `<p class="profile-bud-v"><span class="t-money">${L.inr(bud.total)}</span><span class="muted">for ${esc(bud.label)}</span></p>
              <div class="profile-bud-bar" aria-hidden="true"><i style="width:${Math.min(100, (used / bud.total) * 100).toFixed(1)}%"></i></div>
              <p class="t-cap muted">${L.inr(used)} paid into escrow so far, ${L.inr(Math.max(0, bud.total - used))} left. A planning number for Home and Reports; it never blocks a payment.</p>`
                  : `<p class="muted t-small">No budget set. Add one to see spend against it on Home and in Reports.</p>`
              }
            </section>

            <section class="profile-sec profile-card" aria-labelledby="profile-sec">
              <h2 class="t-h3" id="profile-sec">${icon("shield")}Sign-in and security</h2>
              <ul class="profile-rows">
                ${L.live ? `<li><span><b>Sign-in</b><span class="t-cap muted">Password with ${esc([me.email, me.mobile ? "+91 " + me.mobile : ""].filter(Boolean).join(" or ") || "your email or mobile")}, a one-time code, or Google</span></span><a class="lq lq-s lq-sm" href="signin.html?role=brand&forgot=1">Change password</a></li>` : `<li><span><b>Password</b><span class="t-cap muted">Last changed ${me.passwordChanged ? esc(L.fmtDate(me.passwordChanged, { year: true })) : "never"}</span></span><button type="button" class="lq lq-s lq-sm" data-pw>Change password</button></li>`}
                <li><span><b>This device</b><span class="t-cap muted">${sess.remember !== false ? "Remembered. You stay signed in for 30 days." : "Not remembered. You're signed out when the tab closes."}</span></span></li>
                <li><span><b>Sign out</b><span class="t-cap muted">Ends your session on this device.</span></span><button type="button" class="lq lq-s lq-sm" data-signout>${icon("logout", "ic")}Sign out</button></li>
              </ul>
            </section>
          </div>
        </div>
      </div>`;
      L.liquid(el);
      el.querySelector("[data-edit]").addEventListener("click", () => openEdit());
      el.querySelector("[data-edit2]").addEventListener("click", () => openEdit());
      el.querySelector("[data-editbill]").addEventListener("click", () => openEdit(true));
      el.querySelector("[data-pw]") && el.querySelector("[data-pw]").addEventListener("click", openPassword);
      el.querySelector("[data-editbud]").addEventListener("click", openBudget);
      el.querySelector("[data-signout]").addEventListener("click", openSignOut);
      el.querySelectorAll(".profile-nums [data-n]").forEach(d => {
        const n = +d.dataset.n;
        if (n) mo("count", d, n, v => String(Math.round(v)));
      });
      mo("stagger", [...el.querySelectorAll(".profile-dl>div, .profile-rows>li")]);
    };

    function openBudget() {
      const b = store.s.budget || { label: QUARTERS[0][0], total: 0 };
      L.openSheet({
        title: "Creator budget",
        body: `<form class="profile-pe" novalidate data-bf>
            <p class="muted">How much you plan to pay creators in a quarter. Home and Reports show spend against it. It never blocks a payment.</p>
            ${fld(
              "bu",
              "q",
              "Quarter",
              sel(
                "bu-q",
                QUARTERS.map(x => x[0]),
                b.label || QUARTERS[0][0],
                "Choose a quarter",
              ),
            )}
            <div class="field" data-f="amt"><label for="bu-amt">Budget</label>
              <div class="money-in profile-money"><span aria-hidden="true">₹</span><input class="input num" id="bu-amt" inputmode="numeric" autocomplete="off" value="${b.total ? Math.round(b.total / 100).toLocaleString("en-IN") : ""}" placeholder="2,00,000" aria-describedby="bu-amt-h bu-amt-e"></div>
              <p class="help" id="bu-amt-h" data-bh></p><p class="err" id="bu-amt-e" aria-live="polite"></p></div>
            <div class="profile-pe-f"><button class="lq lq-p" type="submit" data-save>Save budget</button><button class="lq lq-s" type="button" data-cancel>Cancel</button></div>
          </form>`,
        onMount(body, close) {
          const q = x => body.querySelector(x),
            amt = q("#bu-amt"),
            qs = q("#bu-q");
          const rupees = () => +String(amt.value).replace(/[^\d]/g, "") || 0;
          const hint = () => {
            const qq = QUARTERS.find(x => x[0] === qs.value);
            const u = qq ? budgetUsed({ ...store.s, budget: { label: qq[0], from: qq[1], to: qq[2] } }) : 0;
            q("[data-bh]").textContent =
              `${L.inr(u)} already paid into escrow in ${qs.value || "this quarter"}.`;
            return u;
          };
          amt.addEventListener("input", () => {
            const d = String(amt.value).replace(/[^\d]/g, "").slice(0, 9);
            amt.value = d ? (+d).toLocaleString("en-IN") : "";
            clrErr(q('[data-f="amt"]'));
          });
          qs.addEventListener("change", () => {
            hint();
            clrErr(q('[data-f="q"]'));
          });
          hint();
          q("[data-cancel]").addEventListener("click", () => close());
          q("[data-bf]").addEventListener("submit", e => {
            e.preventDefault();
            const r = rupees(),
              qq = QUARTERS.find(x => x[0] === qs.value),
              u = hint();
            let bad = false;
            if (!qq) {
              errAt(body, "q", "Choose a quarter.");
              bad = true;
            }
            if (!r) {
              errAt(body, "amt", "Enter an amount in rupees, like 2,00,000.");
              bad = true;
            } else if (r < 1000) {
              errAt(body, "amt", "Use at least ₹1,000.");
              bad = true;
            } else if (r * 100 < u) {
              errAt(
                body,
                "amt",
                `You've already paid ${L.inr(u)} into escrow this quarter. Set at least that much.`,
              );
              bad = true;
            }
            if (bad) {
              focusErr(body);
              return;
            }
            store.set(s => {
              s.budget = { ...(s.budget || {}), label: qq[0], from: qq[1], to: qq[2], total: r * 100 };
            }, "budget-changed");
            close();
            paint();
            const bb = el.querySelector("[data-editbud]");
            bb && bb.focus({ preventScroll: true });
            L.toast(`Budget set to ${L.inr(r * 100)} for ${qq[0]}`, "check");
          });
        },
      });
    }

    function openSignOut() {
      L.openSheet({
        title: "Sign out?",
        body: `<div class="profile-q"><p class="muted">${L.live ? "You'll sign back in with your password, a one-time code or Google." : "You'll need your email and password to sign back in."} Jobs, campaigns and money in escrow are not affected.</p>
          <div class="row wrap"><button class="lq lq-p" type="button" data-yes>${icon("logout", "ic")}Sign out</button><button class="lq lq-s" type="button" data-no>Stay signed in</button></div></div>`,
        onMount(b, close) {
          b.querySelector("[data-no]").addEventListener("click", () => close());
          b.querySelector("[data-yes]").addEventListener("click", () => {
            if (L.auth) L.auth.signOut();
            else {
              store.set(s => {
                s.session.signedIn = false;
              }, "signed-out");
              close(true);
              L.go("#login");
            }
          });
        },
      });
    }

    function openPassword() {
      const A = L.auth;
      if (!A) {
        L.toast("Password change is unavailable right now. Reload and try again.", "alert");
        return;
      }
      L.openSheet({
        title: "Change password",
        body: `<form class="profile-pe" novalidate data-pwf>
            <p class="muted">Changing it signs you out on other devices. This one stays signed in.</p>
            ${A.pwField("cur", "Current password", { auto: "current-password" })}
            ${A.pwField("pw", "New password", { desc: "au-rules" })}
            ${A.rulesHTML("au-rules")}
            ${A.pwField("pw2", "Confirm new password")}
            <p class="auth-avail" data-match aria-live="polite"></p>
            <p class="t-cap muted"><span class="sample">Sample</span> current password: <b class="num">Mirevo@2026</b>, unless you changed it</p>
            <div class="profile-pe-f"><button class="lq lq-p" type="submit" data-save>Update password</button><button class="lq lq-s" type="button" data-cancel>Cancel</button></div>
          </form>`,
        onMount(b, close) {
          const q = x => b.querySelector(x);
          A.wireEyes(b);
          const cur = q("#au-cur"),
            p1 = q("#au-pw"),
            p2 = q("#au-pw2"),
            rules = q("#au-rules"),
            match = q("[data-match]");
          const ff = id => q(`[data-f="${id}"]`);
          const paintMatch = () => {
            if (!p2.value) {
              match.className = "auth-avail";
              match.textContent = "";
              return;
            }
            if (p1.value === p2.value) {
              match.className = "auth-avail is-ok";
              match.innerHTML = icon("check") + "Passwords match";
              clrErr(ff("pw2"));
            } else if (p2.value.length >= p1.value.length) {
              match.className = "auth-avail is-no";
              match.innerHTML = icon("close") + "These don't match yet";
            } else {
              match.className = "auth-avail";
              match.textContent = "";
            }
          };
          cur.addEventListener("input", () => clrErr(ff("cur")));
          p1.addEventListener("input", () => {
            A.updRules(rules, p1.value);
            clrErr(ff("pw"));
            paintMatch();
          });
          p2.addEventListener("input", paintMatch);
          A.updRules(rules, "");
          q("[data-cancel]").addEventListener("click", () => close());
          q("[data-pwf]").addEventListener("submit", e => {
            e.preventDefault();
            let bad = false;
            if (!cur.value) {
              errAt(b, "cur", "Enter your current password.");
              bad = true;
            } else if (!A.checkCurrent(cur.value)) {
              errAt(
                b,
                "cur",
                'That isn\'t your current password. Forgot it? Sign out and use "Forgot password".',
              );
              bad = true;
              mo("shake", cur.parentElement);
            }
            if (!A.pwOk(p1.value)) {
              errAt(
                b,
                "pw",
                p1.value ? "Your new password needs everything in the list below." : "Choose a new password.",
              );
              bad = true;
            } else if (p1.value === cur.value) {
              errAt(b, "pw", "Use a password different from the current one.");
              bad = true;
            }
            if (!bad && p1.value !== p2.value) {
              errAt(b, "pw2", p2.value ? "The two passwords don't match." : "Type the new password again.");
              bad = true;
            }
            if (bad) {
              const i = b.querySelector(".field.is-err input");
              i && i.focus();
              return;
            }
            const sv = q("[data-save]");
            sv.disabled = true;
            setLabel(sv, "Updating…");
            setTimeout(() => {
              A.setPassword(p1.value);
              store.set(s => {
                s.me.passwordChanged = todayISO();
              }, "password-changed");
              close();
              paint();
              L.toast("Password changed. Other devices are signed out.", "check");
            }, 500);
          });
        },
      });
    }

    function openEdit(toBilling) {
      const me = store.s.me,
        bl = me.billing || {};
      const body = `<form class="profile-pe" novalidate data-pe>
          <fieldset class="profile-fs"><legend class="t-h3">Brand</legend>
            <div data-logo></div>
            ${fld("pe", "brand", "Brand name", `<input class="input" id="pe-brand" autocomplete="organization" value="${esc(me.brand)}">`)}
            <div class="profile-two">
              ${fld("pe", "website", "Website", `<input class="input" id="pe-website" inputmode="url" spellcheck="false" autocapitalize="off" value="${esc(me.website || "")}">`)}
              ${fld("pe", "industry", "Industry", sel("pe-industry", INDUSTRIES.includes(me.industry) || !me.industry ? INDUSTRIES : [me.industry, ...INDUSTRIES], me.industry))}
            </div>
            <div class="field" data-f="about"><div class="row between"><label class="lab" for="pe-about">About <span class="profile-opt">optional</span></label><span class="profile-count num" data-cnt></span></div>
              <textarea class="textarea" id="pe-about" rows="3" placeholder="What you make and who it's for, in a line or two.">${esc(me.about || "")}</textarea><p class="err" aria-live="polite"></p></div>
            <div class="profile-two">
              ${fld("pe", "city", "City", `<input class="input" id="pe-city" autocomplete="address-level2" value="${esc(me.city || "")}">`)}
              ${fld("pe", "state", "State or UT", sel("pe-state", STATES, me.state))}
            </div>
          </fieldset>
          <fieldset class="profile-fs"><legend class="t-h3">Contact person</legend>
            <div class="profile-two">
              ${fld("pe", "name", "Name", `<input class="input" id="pe-name" autocomplete="name" value="${esc(me.name)}">`)}
              ${fld("pe", "role", 'Role <span class="profile-opt">optional</span>', `<input class="input" id="pe-role" value="${esc(me.role || "")}">`)}
            </div>
            <div class="profile-locked">${icon("lock")}<p><b>${esc(me.email)}</b> and <b class="num">${esc(fmtMobile(me.mobile))}</b> are verified for sign-in. To change them, write to support@linkloom.in so we can verify the new ones. One email and one mobile per account.</p></div>
          </fieldset>
          <fieldset class="profile-fs" data-billing><legend class="t-h3">Billing</legend>
            ${fld("pe", "legal", "Legal name", `<input class="input" id="pe-legal" value="${esc(bl.legal || "")}">`)}
            ${fld("pe", "gstin", 'GSTIN <span class="profile-opt">optional</span>', `<input class="input num profile-gstin" id="pe-gstin" maxlength="15" spellcheck="false" autocapitalize="characters" value="${esc(bl.gstin || "")}">`)}
            ${fld("pe", "address", "Billing address", `<textarea class="textarea" id="pe-address" rows="3" autocomplete="street-address">${esc(bl.address || "")}</textarea>`)}
            ${fld("pe", "bemail", "Send invoices to", `<input class="input" id="pe-bemail" type="email" spellcheck="false" autocapitalize="off" value="${esc(bl.email || "")}">`)}
            <p class="t-cap muted">Changes apply to invoices from today. Past invoices keep the details they were issued with.</p>
          </fieldset>
          <p class="profile-formerr" role="alert" data-pe-err hidden></p>
          <div class="profile-pe-f"><button class="lq lq-p" type="submit" data-save>Save changes</button><button class="lq lq-s" type="button" data-cancel>Cancel</button></div>
        </form>`;
      L.openSheet({
        title: toBilling ? "Edit billing details" : "Edit profile",
        wide: true,
        body,
        onMount(b, close) {
          const q = x => b.querySelector(x);
          const pk = logoPicker(q("[data-logo]"), {
            src: me.logo,
            initials: () => initial(q("#pe-brand").value || me.brand),
          });
          q("#pe-brand").addEventListener("input", () => pk.refresh());
          counter(q("#pe-about"), q("[data-cnt]"));
          wireClear(b);
          const g = q("#pe-gstin");
          g.addEventListener("input", () => {
            g.value = g.value.toUpperCase().replace(/\s/g, "");
          });
          q("[data-cancel]").addEventListener("click", () => close());
          if (toBilling)
            setTimeout(() => {
              const fs = q("[data-billing]");
              fs.scrollIntoView({ block: "start" });
              q("#pe-legal").focus({ preventScroll: true });
            }, 80);
          q("[data-pe]").addEventListener("submit", e => {
            e.preventDefault();
            const v = id => q("#pe-" + id).value;
            const errs = [];
            [
              ["brand", V.brand(v("brand"))],
              ["website", V.website(v("website"))],
              ["industry", V.industry(v("industry"))],
              ["city", V.city(v("city"))],
              ["state", v("state") ? "" : "Choose your state or union territory."],
              ["name", V.person(v("name"))],
              ["legal", V.legal(v("legal"))],
              ["gstin", V.gstin(v("gstin"))],
              ["address", V.address(v("address"))],
              ["bemail", V.email(v("bemail"))],
            ].forEach(x => x[1] && errs.push(x));
            const an = [...v("about").trim()].length;
            if (an > ABOUT_MAX)
              errs.push(["about", `${an - ABOUT_MAX} characters over. Trim it to ${ABOUT_MAX}.`]);
            if (errs.length) {
              errs.forEach(x => errAt(b, x[0], x[1]));
              focusErr(b);
              return;
            }
            if (!navigator.onLine) {
              const fe = q("[data-pe-err]");
              fe.hidden = false;
              fe.textContent =
                "You're offline, so nothing was saved. Your edits are still here; try again when you're connected.";
              return;
            }
            store.set(s => {
              const m = s.me;
              m.brand = v("brand").trim();
              m.website = v("website")
                .trim()
                .replace(/^https?:\/\//i, "")
                .replace(/\/$/, "");
              m.industry = v("industry");
              m.about = v("about").trim();
              m.city = v("city").trim();
              m.state = v("state");
              m.name = v("name").trim().replace(/\s+/g, " ");
              m.role = v("role").trim();
              m.logo = pk.get();
              m.billing = {
                legal: v("legal").trim(),
                gstin: v("gstin").trim().toUpperCase(),
                address: v("address").trim(),
                email: v("bemail").trim(),
              };
            }, "profile-edited");
            if (L.live) {
              const me = store.s.me;
              L.live
                .saveBrand(me)
                .then(() =>
                  me.logo && String(me.logo).startsWith("data:")
                    ? import("@/shared/api/uploads")
                        .then(u => L.live.uploadLogo(u.dataUrlToBlob(me.logo)))
                        .then(url => url && store.set(s => (s.me.logo = url), "profile-edited"))
                    : null,
                )
                .catch(e => L.toast(L.live.errorText(e), "alert"));
            }
            close();
            paint();
            const eb = el.querySelector(toBilling ? "[data-editbill]" : "[data-edit]");
            eb && eb.focus({ preventScroll: true });
            L.toast(toBilling ? "Billing details updated" : "Profile updated", "check");
          });
        },
      });
    }

    paint();
    /* deep links from Payments and Reports: #profile-billing, #profile-budget */
    if (param === "billing" || param === "budget") {
      const sec = el.querySelector("#" + param);
      if (sec)
        setTimeout(() => {
          sec.scrollIntoView({ block: "start", behavior: L.RM ? "auto" : "smooth" });
          sec.classList.add("is-target");
          const b = sec.querySelector("button");
          b && b.focus({ preventScroll: true });
        }, 120);
    }
  }

  L.register("setup", { title: "Set up your brand", shell: "focus", render: renderSetup });
  L.register("profile", { title: "Brand profile", nav: "profile", render: renderProfile });
})();
