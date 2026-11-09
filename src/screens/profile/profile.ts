// @ts-nocheck
/* profile screen (Builder A): the creator's own profile, laid out like a media kit.
   Header (photo, name, bio, Edit profile), audience numbers with source and last-updated date, platform rows,
   audience geography, track record, selected work, reviews, and a "Private to you" panel.
   "See what brands see" switches to the brand-safe view: no contact details, no date of birth, no KYC or payout data.
   #profile-brand opens straight in that view. Edit profile opens a sheet (reuses LLA.photo and LLA.V from setup.js). */
(() => {
  const { esc, icon, store } = LLD;
  const pct = n => (Math.round(n * 10) / 10).toFixed(1).replace(/\.0$/, "") + "%";
  const href = u => (/^https?:\/\//i.test(u) ? u : "https://" + u);
  const platOf = u =>
    /instagram\.com/i.test(u) ? "instagram" : /youtube\.com|youtu\.be/i.test(u) ? "youtube" : "web";
  const PLAT = { instagram: ["Instagram", "ig", "Followers"], youtube: ["YouTube", "yt", "Subscribers"] };
  const STATUS = {
    not_started: ["pill-paper", "Not started", "Verify before your first bid"],
    in_progress: ["pill-info", "In progress", "Pick up where you left off"],
    under_review: ["pill-info", "Under review", "Usually a few minutes"],
    verified: ["pill-ok", "Verified", "You can bid on any brief"],
    action_needed: ["pill-warn", "Action needed", "Fix one detail to keep bidding"],
    rejected: ["pill-err", "Rejected", "Try again with a different ID"],
  };
  const initial = n => (String(n || "").trim()[0] || "?").toUpperCase();

  function stats(me) {
    const ps = Object.entries(me.platforms || {}).filter(([, p]) => p && p.handle);
    const f = ps.reduce((n, [, p]) => n + (p.followers || 0), 0);
    const w = k => (f ? ps.reduce((n, [, p]) => n + (p.followers || 0) * (p[k] || 0), 0) / f : 0);
    const upd = ps
      .map(([, p]) => p.updated)
      .filter(Boolean)
      .sort()
      .pop();
    const src = [...new Set(ps.map(([, p]) => p.source || "Self-reported"))].join(", ");
    return { ps, followers: f, views: Math.round(w("avgViews")), er: w("er"), updated: upd, source: src };
  }

  function render(el, param) {
    let brand = param === "brand";
    const paint = () => {
      const s = store.s,
        me = s.me,
        k = s.kyc,
        sess = s.session,
        st = stats(me);
      const [kc, kt, kn] = STATUS[k.status] || STATUS.not_started;
      const payout =
        k.payoutMethod === "bank" && k.bank && k.bank.acc
          ? `Bank account ${k.bank.acc}`
          : k.upi
            ? `UPI ${k.upi}`
            : "";
      const age = me.dob ? LLD.ageFrom(me.dob) : null;
      const geoMax = Math.max(1, ...(me.audienceGeo || []).map(g => g[1]));
      el.innerHTML = `
      <div class="view-in profile ${brand ? "is-brand" : ""}">
        <div class="profile-bv" data-bv role="status" ${brand ? "" : "hidden"}>
          ${icon("eye")}<p><b>Brand view.</b> This is your profile as brands see it when you bid. Hidden from them: email, mobile, date of birth, PAN, ID and payout details.</p>
        </div>

        <header class="profile-mast">
          <div class="profile-photo">${me.photo ? `<img src="${esc(me.photo)}" alt="${esc(me.name)}">` : `<span aria-hidden="true">${esc(initial(me.name))}</span>`}</div>
          <div class="profile-id">
            <p class="t-eyebrow">Creator · ${esc(me.city)}${me.region ? ", " + esc(me.region) : ""}</p>
            <h1 class="t-display profile-name">${esc(me.name)}</h1>
            <ul class="profile-handles">${st.ps.map(([key, p]) => `<li><a href="${esc(href(p.url || ""))}" target="_blank" rel="noopener noreferrer">${icon(PLAT[key] ? PLAT[key][1] : "link")}<span>${esc(p.handle)}</span><span class="sr-only"> on ${esc(PLAT[key] ? PLAT[key][0] : key)}, opens in a new tab</span></a></li>`).join("")}</ul>
            <p class="profile-bio">${esc(me.bio)}</p>
            <p class="profile-meta">${(me.categories || []).map(c => `<span class="pill pill-line">${esc(c)}</span>`).join("")}<span class="profile-langs">Creates in ${esc((me.languages || []).join(", "))}</span></p>
          </div>
          <div class="profile-act">
            <button type="button" class="profile-switch" role="switch" aria-checked="${brand}" data-switch><span class="profile-knob" aria-hidden="true"></span>See what brands see</button>
            <button class="lq lq-p" type="button" data-edit ${brand ? "hidden" : ""}>Edit profile</button>
          </div>
        </header>

        <section class="profile-band" aria-labelledby="profile-aud">
          <div class="profile-band-h">
            <h2 class="t-eyebrow" id="profile-aud">Audience</h2>
            <p class="profile-src">${esc(st.source || "Self-reported")} · updated ${st.updated ? esc(LLD.fmtDate(st.updated, { year: true })) : "never"}${st.ps.length > 1 ? " · views and engagement weighted by followers" : ""} <span class="sample">Sample</span></p>
          </div>
          ${
            st.ps.length
              ? `<dl class="profile-nums">
            <div><dt>Followers</dt><dd class="t-money" data-n="${st.followers}" data-f="c">${esc(LLD.compact(st.followers))}</dd><p>${esc(st.ps.map(([key]) => (PLAT[key] ? PLAT[key][0] : key)).join(" and "))}</p></div>
            <div><dt>Avg views</dt><dd class="t-money" data-n="${st.views}" data-f="c">${st.views ? esc(LLD.compact(st.views)) : "—"}</dd><p>per post</p></div>
            <div><dt>Engagement</dt><dd class="t-money" data-n="${st.er}" data-f="p">${st.er ? esc(pct(st.er)) : "—"}</dd><p>engagement rate</p></div>
          </dl>`
              : `<p class="profile-band-empty">Add Instagram or YouTube in <button type="button" class="btn-q" data-edit2>Edit profile</button> to show your audience here.</p>`
          }
        </section>

        <div class="profile-grid">
          <div class="profile-col">
            <section class="profile-sec" aria-labelledby="profile-plat">
              <h2 class="t-h2" id="profile-plat">Platforms</h2>
              ${
                st.ps.length
                  ? `<ul class="profile-plats">${st.ps
                      .map(
                        ([key, p]) => `
                <li class="profile-plat" data-st>
                  <span class="profile-plat-ic">${icon(PLAT[key] ? PLAT[key][1] : "link")}</span>
                  <div class="profile-plat-id"><p class="t-h3">${esc(PLAT[key] ? PLAT[key][0] : key)}</p><a href="${esc(href(p.url || ""))}" target="_blank" rel="noopener noreferrer" class="profile-plat-h">${esc(p.handle)}<span class="sr-only">, opens in a new tab</span></a><p class="t-cap muted">${esc(p.source || "Self-reported")} · ${p.updated ? esc(LLD.fmtDate(p.updated)) : "—"}</p></div>
                  <dl class="profile-plat-n">
                    <div><dt>${PLAT[key] ? PLAT[key][2] : "Followers"}</dt><dd class="t-money">${p.followers ? esc(LLD.compact(p.followers)) : "—"}</dd></div>
                    <div><dt>Avg views</dt><dd class="t-money">${p.avgViews ? esc(LLD.compact(p.avgViews)) : "—"}</dd></div>
                    <div><dt>Engagement</dt><dd class="t-money">${p.er ? esc(pct(p.er)) : "—"}</dd></div>
                  </dl>
                </li>`,
                      )
                      .join("")}</ul>`
                  : `<div class="empty"><img src="assets/step-04-orbit.svg" width="300" height="220" alt=""><p class="t-h3">No platforms yet</p><p class="muted">Brands filter by platform, so add at least one.</p></div>`
              }
            </section>

            <section class="profile-sec" aria-labelledby="profile-work">
              <div class="row between wrap"><h2 class="t-h2" id="profile-work">Selected work</h2>${!brand ? '<button type="button" class="btn-q" data-edit3>' + icon("plus") + "Add link</button>" : ""}</div>
              ${
                (me.portfolio || []).length
                  ? `<ol class="profile-work">${me.portfolio
                      .map(
                        (w, i) => `
                <li data-st><a href="${esc(href(w.url))}" target="_blank" rel="noopener noreferrer">
                  <span class="profile-work-n num">${String(i + 1).padStart(2, "0")}</span>
                  <span class="profile-work-t"><b>${esc(w.title)}</b><span>${icon(PLAT[w.platform] ? PLAT[w.platform][1] : "link")}${esc([PLAT[w.platform] ? PLAT[w.platform][0] : "Link", w.format].filter(Boolean).join(" · "))}</span></span>
                  ${w.views ? `<span class="profile-work-v"><b class="t-money">${esc(LLD.compact(w.views))}</b><span>views</span></span>` : ""}
                  <span class="profile-work-go">${icon("arrow")}<span class="sr-only">Open, new tab</span></span>
                </a></li>`,
                      )
                      .join("")}</ol>`
                  : `<div class="empty"><img src="assets/step-01-envelope.svg" width="300" height="220" alt=""><p class="t-h3">No work links yet</p><p class="muted">Add two or three posts you're proud of. Brands open these before they accept a bid.</p></div>`
              }
            </section>
          </div>

          <div class="profile-col">
            <section class="profile-sec profile-card" aria-labelledby="profile-geo">
              <h2 class="t-h3" id="profile-geo">Where the audience is</h2>
              ${
                (me.audienceGeo || []).length
                  ? `<ol class="profile-geo">${me.audienceGeo
                      .map(
                        ([city, v]) => `
                <li data-st><span class="profile-geo-l">${esc(city)}</span><span class="profile-geo-b" aria-hidden="true"><i style="width:${Math.max(2, (v / geoMax) * 100).toFixed(1)}%" class="${/other/i.test(city) ? "is-other" : ""}"></i></span><span class="profile-geo-v num">${esc(v)}%</span></li>`,
                      )
                      .join("")}</ol>
                <p class="t-cap muted">Share of followers by city · ${esc(st.source || "Self-reported")}, ${st.updated ? esc(LLD.fmtDate(st.updated, { year: true })) : "—"}</p>`
                  : `<p class="muted">No audience data yet.</p>`
              }
            </section>

            <section class="profile-sec profile-card" aria-labelledby="profile-rec">
              <h2 class="t-h3" id="profile-rec">Track record</h2>
              <dl class="profile-rec">
                <div><dd class="t-money" data-n="${me.completedJobs || 0}">${esc(me.completedJobs || 0)}</dd><dt>jobs completed</dt></div>
                <div><dd class="t-money" data-n="${me.totalBids || 0}">${esc(me.totalBids || 0)}</dd><dt>bids sent</dt></div>
              </dl>
              <p class="t-cap muted">Completed means the brand approved the work. Counted by Linkloom, not self-reported.</p>
            </section>

            <section class="profile-sec" aria-labelledby="profile-rev">
              <h2 class="t-h3" id="profile-rev">What brands said</h2>
              ${
                (me.reviews || []).length
                  ? me.reviews
                      .map(
                        r => `
                <figure class="profile-rev" data-st>
                  <blockquote>${esc(r.text)}</blockquote>
                  <figcaption><b>${esc(r.brand)}</b><span class="num">${esc(r.rating)} out of 5</span></figcaption>
                </figure>`,
                      )
                      .join("")
                  : `<p class="muted">Reviews appear here after your first approved job.</p>`
              }
            </section>
          </div>
        </div>

        <section class="profile-priv" aria-labelledby="profile-priv" data-priv ${brand ? "hidden" : ""}>
          <div class="profile-priv-h"><h2 class="t-h3" id="profile-priv">${icon("lock")}Private to you</h2><p class="t-cap muted">Brands never see this section.</p></div>
          <dl class="profile-priv-g">
            <div><dt>Email</dt><dd>${esc(sess.email || "Not added")}</dd></div>
            <div><dt>Mobile</dt><dd class="num">${esc(sess.mobile || "Not added")}</dd></div>
            <div><dt>Date of birth</dt><dd class="num">${me.dob ? esc(LLD.fmtDate(me.dob, { year: true })) + " · " + esc(age) : "—"}</dd></div>
            <div><dt>Verification</dt><dd><span class="pill ${kc}">${k.status === "verified" ? icon("check") : ["action_needed", "rejected"].includes(k.status) ? icon("alert") : ""}${kt}</span><span class="t-cap muted">${esc(kn)}</span>${k.status !== "verified" ? '<a class="btn-q" href="#kyc">' + (k.status === "not_started" ? "Start" : k.status === "under_review" ? "See status" : "Fix it") + "</a>" : ""}</dd></div>
            <div><dt>Payouts go to</dt><dd class="num">${esc(payout || "Not added yet")}</dd></div>
            ${store.s.plan ? `<div><dt>Plan</dt><dd>${esc(store.s.plan.name)}${store.s.plan.status === "active" && store.s.plan.renews ? '<span class="t-cap muted">Renews ' + esc(LLD.fmtDate(store.s.plan.renews)) + "</span>" : ""}</dd></div>` : ""}
          </dl>
          <div class="profile-priv-f"><button type="button" class="lq lq-s lq-sm" data-signout>${icon("logout", "ic")}Sign out</button></div>
        </section>
      </div>`;
      LLD.liquid(el);
      wire();
      try {
        el.querySelectorAll(".profile-nums [data-n], .profile-rec [data-n]").forEach(d => {
          const n = +d.dataset.n;
          if (!n) return;
          LLD.motion.count(
            d,
            n,
            d.dataset.f === "c" ? LLD.compact : d.dataset.f === "p" ? pct : v => String(Math.round(v)),
          );
        });
        LLD.motion.stagger([...el.querySelectorAll("[data-st]")]);
      } catch (e) {}
    };

    function setBrand(on) {
      brand = on;
      const root = el.querySelector(".profile");
      root.classList.toggle("is-brand", on);
      el.querySelector("[data-switch]").setAttribute("aria-checked", String(on));
      el.querySelector("[data-bv]").hidden = !on;
      el.querySelector("[data-priv]").hidden = on;
      el.querySelectorAll("[data-edit],[data-edit3]").forEach(b => {
        b.hidden = on;
      });
      try {
        history.replaceState(null, "", on ? "#profile-brand" : "#profile");
      } catch (e) {}
    }

    function wire() {
      el.querySelector("[data-switch]").addEventListener("click", () => setBrand(!brand));
      try {
        LLD.motion.press(el.querySelector("[data-switch]"));
      } catch (e) {}
      el.querySelectorAll("[data-edit],[data-edit2],[data-edit3]").forEach(b =>
        b.addEventListener("click", () => {
          try {
            LLD.motion.press(b);
          } catch (e) {}
          openEdit(b.hasAttribute("data-edit3"));
        }),
      );
      const so = el.querySelector("[data-signout]");
      so.addEventListener("click", () =>
        LLD.openSheet({
          title: "Sign out?",
          body: `<div class="profile-sheet-q"><p class="muted">You'll need Google or an OTP to sign back in. Drafts on this device are cleared.</p>
          <div class="row wrap"><button class="lq lq-p" type="button" data-yes>Sign out</button><button class="lq lq-s" type="button" data-no>Stay signed in</button></div></div>`,
          onMount(b, close) {
            b.querySelector("[data-no]").addEventListener("click", () => close());
            b.querySelector("[data-yes]").addEventListener("click", () => {
              store.set(s => {
                s.session.signedIn = false;
              }, "signed-out");
              close(true);
              LLD.go("#login");
            });
          },
        }),
      );
    }

    /* ---------- edit profile sheet ---------- */
    function openEdit(toLinks) {
      const A = window.LLA || {},
        V = A.V;
      if (!V || !A.photo) {
        LLD.toast("Editing is unavailable right now. Reload and try again.", "alert");
        return;
      }
      const me = store.s.me;
      const d = {
        name: me.name,
        bio: me.bio || "",
        city: me.city || "",
        region: me.region || "",
        gender: me.gender || "",
        languages: [...(me.languages || [])],
        categories: [...(me.categories || [])],
        ig: {
          ...(me.platforms.instagram || {}),
          handle: ((me.platforms.instagram || {}).handle || "").replace(/^@/, ""),
        },
        yt: { ...(me.platforms.youtube || {}) },
        portfolio: (me.portfolio || []).map(w => ({ ...w })),
      };
      const opt = (type, name, val, on) =>
        `<label class="setup-opt"><input type="${type}" name="${name}" value="${esc(val)}" ${on ? "checked" : ""}><span>${esc(val)}</span></label>`;
      const fld = (id, label, input, help = "") =>
        `<div class="field" data-pf="${id}"><label for="pe-${id}">${label}</label>${input}${help ? `<p class="help">${help}</p>` : ""}<p class="err" aria-live="polite"></p></div>`;
      const platRow = (k, name) => `
        <fieldset class="profile-pe-plat"><legend class="t-label">${icon(k)}${name} <span class="pill pill-paper">Self-reported</span></legend>
          ${fld(k + "-handle", "Username or link", `<input class="input" id="pe-${k}-handle" value="${esc(d[k].handle || "")}" autocomplete="off" spellcheck="false">`)}
          <div class="setup-metrics">
            ${fld(k + "-followers", k === "yt" ? "Subscribers" : "Followers", `<input class="input num" id="pe-${k}-followers" inputmode="numeric" value="${esc(d[k].followers || "")}">`)}
            ${fld(k + "-avgViews", "Avg views", `<input class="input num" id="pe-${k}-avgViews" inputmode="numeric" value="${esc(d[k].avgViews || "")}">`)}
            ${fld(k + "-er", "Engagement %", `<input class="input num" id="pe-${k}-er" inputmode="decimal" value="${esc(d[k].er || "")}">`)}
          </div>
        </fieldset>`;
      const body = `
        <form class="profile-pe" novalidate data-pe>
          <div data-ph></div>
          ${fld("name", "Display name", `<input class="input" id="pe-name" value="${esc(d.name)}" autocomplete="name">`)}
          <div class="field" data-pf="bio"><div class="row between"><label class="lab" for="pe-bio">Short bio</label><span class="setup-count num" data-bioc></span></div>
            <textarea class="textarea" id="pe-bio" rows="3">${esc(d.bio)}</textarea><p class="err" aria-live="polite"></p></div>
          <div class="setup-two">
            ${fld("city", "City", `<input class="input" id="pe-city" list="pe-cities" value="${esc(d.city)}"><datalist id="pe-cities">${A.CITIES.map(c => `<option value="${esc(c)}">`).join("")}</datalist>`)}
            ${fld("region", "State or UT", `<select class="select" id="pe-region"><option value="">Choose</option>${A.STATES.map(x => `<option ${d.region === x ? "selected" : ""}>${esc(x)}</option>`).join("")}</select>`)}
          </div>
          <fieldset class="setup-fs" data-pf="langs"><legend>Languages you create in</legend><div class="setup-opts">${A.LANGS.map(l => opt("checkbox", "pe-lang", l, d.languages.includes(l))).join("")}</div><p class="err" aria-live="polite"></p></fieldset>
          <fieldset class="setup-fs"><legend>What you make <span class="setup-opt-l">up to ${A.CAT_MAX}</span></legend><div class="setup-opts" data-cats>${A.CATS.map(c => opt("checkbox", "pe-cat", c, d.categories.includes(c))).join("")}</div></fieldset>
          <fieldset class="setup-fs"><legend>Gender <span class="setup-opt-l">optional, never shown to brands</span></legend><div class="setup-opts">${A.GENDERS.map(g => opt("radio", "pe-gender", g, d.gender === g)).join("")}</div></fieldset>
          ${platRow("ig", "Instagram")}${platRow("yt", "YouTube")}
          <fieldset class="setup-fs" data-links><legend>Selected work</legend><ul class="profile-pe-links" data-linklist></ul>
            <div class="profile-pe-add">
              ${fld("lt", "Title", `<input class="input" id="pe-lt" placeholder="30 days with a ceramide moisturiser">`)}
              ${fld("lu", "Link", `<input class="input" id="pe-lu" inputmode="url" spellcheck="false" placeholder="instagram.com/reel/…">`)}
              <button type="button" class="lq lq-s lq-sm" data-addlink>${icon("plus", "ic")}Add link</button>
            </div>
          </fieldset>
          <p class="setup-formerr" role="alert" data-pe-err hidden></p>
          <div class="profile-pe-f"><button class="lq lq-p" type="submit" data-save>Save changes</button><button class="lq lq-s" type="button" data-cancel>Cancel</button></div>
        </form>`;
      let picker = null;
      LLD.openSheet({
        title: "Edit profile",
        wide: true,
        body,
        onMount(b, close) {
          const q = s => b.querySelector(s);
          picker = A.photo(q("[data-ph]"), {
            src: me.photo,
            initials: () => initial(q("#pe-name").value || me.name),
          });
          const sheet = b.closest(".sheet");
          const obs = new MutationObserver(() => {
            if (!sheet.isConnected) {
              picker && picker.destroy();
              obs.disconnect();
            }
          });
          obs.observe(document.body, { childList: true });
          const bio = q("#pe-bio"),
            bc = q("[data-bioc]");
          const count = () => {
            const n = [...bio.value].length;
            bc.textContent = `${n} / ${A.BIO_MAX}`;
            bc.classList.toggle("is-near", n > A.BIO_MAX - 20 && n <= A.BIO_MAX);
            bc.classList.toggle("is-over", n > A.BIO_MAX);
          };
          bio.addEventListener("input", count);
          count();
          const cap = () => {
            const on = b.querySelectorAll("input[name=pe-cat]:checked").length >= A.CAT_MAX;
            b.querySelectorAll("input[name=pe-cat]").forEach(x => {
              x.disabled = on && !x.checked;
              x.closest(".setup-opt").classList.toggle("is-off", x.disabled);
            });
          };
          b.querySelectorAll("input[name=pe-cat]").forEach(x => x.addEventListener("change", cap));
          cap();
          const clear = f => {
            f.classList.remove("is-err");
            const e = f.querySelector(".err");
            if (e) e.textContent = "";
          };
          b.querySelectorAll("[data-pf] input,[data-pf] select,[data-pf] textarea").forEach(i =>
            i.addEventListener("input", () => clear(i.closest("[data-pf]"))),
          );
          const errAt = (id, msg) => {
            const f = q(`[data-pf="${id}"]`);
            if (!f) return;
            f.classList.add("is-err");
            const e = f.querySelector(".err");
            if (e) e.textContent = msg;
          };

          const links = () => {
            q("[data-linklist]").innerHTML = d.portfolio.length
              ? d.portfolio
                  .map(
                    (w, i) =>
                      `<li><span class="profile-pe-lt"><b>${esc(w.title)}</b><span>${esc(w.url)}</span></span><button type="button" class="btn-q" data-rm="${i}">Remove<span class="sr-only"> ${esc(w.title)}</span></button></li>`,
                  )
                  .join("")
              : '<li class="muted">No links yet.</li>';
            b.querySelectorAll("[data-rm]").forEach(x =>
              x.addEventListener("click", () => {
                d.portfolio.splice(+x.dataset.rm, 1);
                links();
                q("#pe-lt").focus();
              }),
            );
          };
          links();
          q("[data-addlink]").addEventListener("click", () => {
            const t = q("#pe-lt").value.trim(),
              u = q("#pe-lu").value.trim();
            let bad = false;
            if (!t) {
              errAt("lt", "Give it a short title.");
              bad = true;
            }
            const ue = V.url(u);
            if (ue) {
              errAt("lu", ue);
              bad = true;
            }
            if (
              !bad &&
              d.portfolio.some(w => href(w.url).replace(/\/$/, "") === href(u).replace(/\/$/, ""))
            ) {
              errAt("lu", "That link is already in your list.");
              bad = true;
            }
            if (!bad && d.portfolio.length >= 8) {
              errAt("lu", "Keep it to your best 8.");
              bad = true;
            }
            if (bad) return;
            d.portfolio.push({
              title: t,
              url: u.replace(/^https?:\/\//i, ""),
              platform: platOf(u),
              format: "",
            });
            q("#pe-lt").value = "";
            q("#pe-lu").value = "";
            links();
            q("#pe-lt").focus();
          });
          q("[data-cancel]").addEventListener("click", () => close());
          if (toLinks)
            setTimeout(() => {
              q("[data-links]").scrollIntoView({ block: "start" });
              q("#pe-lt").focus({ preventScroll: true });
            }, 60);

          q("[data-pe]").addEventListener("submit", e => {
            e.preventDefault();
            b.querySelectorAll("[data-pf].is-err").forEach(clear);
            const v = id => q("#pe-" + id).value;
            const errs = [];
            const ne = V.name(v("name"));
            if (ne) errs.push(["name", ne]);
            const bn = [...v("bio").trim()].length;
            if (bn < 20) errs.push(["bio", "Add a line or two, at least 20 characters."]);
            else if (bn > A.BIO_MAX)
              errs.push(["bio", `${bn - A.BIO_MAX} characters over. Trim it to ${A.BIO_MAX}.`]);
            if (!/^[\p{L}][\p{L} .'-]{1,40}$/u.test(v("city").trim()))
              errs.push(["city", "Use the city name only, like Pune."]);
            if (!v("region")) errs.push(["region", "Choose your state or union territory."]);
            const langs = [...b.querySelectorAll("input[name=pe-lang]:checked")].map(x => x.value);
            if (!langs.length) errs.push(["langs", "Pick at least one language."]);
            const ig = V.ig(v("ig-handle")),
              yt = V.yt(v("yt-handle"));
            if (ig.e) errs.push(["ig-handle", ig.e]);
            if (yt.e) errs.push(["yt-handle", yt.e]);
            if (!ig.e && !yt.e && !ig.h && !yt.h) errs.push(["ig-handle", "Keep at least one platform."]);
            [
              ["ig", ig],
              ["yt", yt],
            ].forEach(([kk, r]) => {
              if (!r.h) return;
              const f = V.count(v(kk + "-followers"), true);
              if (f) errs.push([kk + "-followers", f]);
              const a = V.count(v(kk + "-avgViews"), false);
              if (a) errs.push([kk + "-avgViews", a]);
              const er = V.er(v(kk + "-er"));
              if (er) errs.push([kk + "-er", er]);
            });
            if (errs.length) {
              errs.forEach(x => errAt(x[0], x[1]));
              const f = q(
                `[data-pf="${errs[0][0]}"] input, [data-pf="${errs[0][0]}"] textarea, [data-pf="${errs[0][0]}"] select`,
              );
              f && f.focus();
              return;
            }
            if (!navigator.onLine) {
              const fe = q("[data-pe-err]");
              fe.hidden = false;
              fe.textContent =
                "You're offline, so nothing was saved. Your edits are still here; try again when you're connected.";
              return;
            }
            const n = x => +String(x || "").replace(/[,\s]/g, "") || 0,
              day = new Date(LLD.today().getTime() + 5.5 * 36e5).toISOString().slice(0, 10);
            const plat = (old, h, url, kk) => {
              const nv = {
                followers: n(v(kk + "-followers")),
                avgViews: n(v(kk + "-avgViews")),
                er: +String(v(kk + "-er")).replace("%", "") || 0,
              };
              const same =
                old &&
                old.handle === h &&
                old.followers === nv.followers &&
                old.avgViews === nv.avgViews &&
                old.er === nv.er;
              return h
                ? {
                    handle: h,
                    url,
                    ...nv,
                    updated: same ? old.updated : day,
                    source: (old && old.source) || "Self-reported",
                  }
                : {
                    handle: "",
                    url: "",
                    followers: 0,
                    avgViews: 0,
                    er: 0,
                    updated: day,
                    source: "Self-reported",
                  };
            };
            const photo = picker && picker.has() ? picker.exportURL() : null;
            const before = store.s.me.photo;
            store.set(s => {
              const m = s.me;
              m.name = v("name").trim().replace(/\s+/g, " ");
              m.bio = v("bio").trim();
              m.city = v("city").trim();
              m.region = v("region");
              m.languages = langs;
              m.categories = [...b.querySelectorAll("input[name=pe-cat]:checked")].map(x => x.value);
              const g = b.querySelector("input[name=pe-gender]:checked");
              m.gender = g ? g.value : "";
              m.platforms.instagram = plat(
                m.platforms.instagram,
                ig.h ? "@" + ig.h : "",
                ig.h ? "instagram.com/" + ig.h : "",
                "ig",
              );
              m.platforms.youtube = plat(
                m.platforms.youtube,
                yt.h ? (yt.h.startsWith("@") ? yt.h : yt.h.split("/").pop()) : "",
                yt.h ? "youtube.com/" + yt.h : "",
                "yt",
              );
              m.handle = ig.h ? "@" + ig.h : yt.h || m.handle;
              m.portfolio = d.portfolio;
              m.photo = photo;
            }, "profile-edited");
            if (LLD.live) {
              const m = store.s.me;
              const jobs = [
                LLD.live.saveProfile({
                  name: m.name,
                  bio: m.bio,
                  categories: m.categories,
                  city: m.city,
                  region: m.region,
                  primaryPlatform: m.platforms.instagram && m.platforms.instagram.handle ? "instagram" : m.platforms.youtube && m.platforms.youtube.handle ? "youtube" : undefined,
                  extras: { gender: m.gender, languages: m.languages, region: m.region, platforms: m.platforms, portfolio: m.portfolio },
                }),
              ];
              if (photo && photo.startsWith("data:") && photo !== before)
                jobs.push(
                  import("@/api/uploads").then(u => LLD.live.uploadAvatar(u.dataUrlToBlob(photo))).then(url => {
                    if (url) store.set(s => (s.me.photo = url), "profile-edited");
                  }),
                );
              Promise.all(jobs).catch(er => LLD.toast(LLD.live.errorText(er), "alert"));
            }
            close();
            paint();
            const eb = el.querySelector("[data-edit]");
            eb && eb.focus({ preventScroll: true });
            LLD.toast("Profile updated", "check");
          });
        },
      });
    }

    paint();
  }

  LLD.register("profile", { title: "Your profile", nav: "profile", render });
})();
