/* Brand verification (#kyc). The backend asks every account, brand or creator, for the same three things before it
   can post a brief, send an offer or check out: PAN, an ID document and a bank account. Each saves on its own,
   then the brand submits for a manual review. This screen uses the setup screen's layout and classes. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the brand runtime is still untyped
const w = window as any;

type Kyc = {
  status?: string;
  rejectionReason?: string | null;
  submittedAt?: string | null;
  steps?: {
    pan?: { done?: boolean; nameOnPan?: string; panLast4?: string };
    id?: { done?: boolean; idType?: string | null };
    bank?: { done?: boolean; accountHolderName?: string; accountLast4?: string; ifsc?: string };
  };
};

const ID_TYPES: [string, string][] = [
  ["aadhaar", "Aadhaar"],
  ["passport", "Passport"],
  ["voter_id", "Voter ID"],
  ["driving_licence", "Driving licence"],
];
const STATUS: Record<string, [string, string]> = {
  not_started: ["pill-paper", "Not started"],
  in_progress: ["pill-info", "In progress"],
  pending: ["pill-info", "Under review"],
  verified: ["pill-ok", "Verified"],
  rejected: ["pill-err", "Needs a fix"],
};

function render(el: HTMLElement): () => void {
  const L = w.LLD,
    esc = L.esc,
    icon = L.icon;
  let alive = true;
  let returnTo = "";
  try {
    returnTo = sessionStorage.getItem("ll-brand-kyc-return") || "";
  } catch {
    /* no storage: back to home */
  }

  const paint = (): void => {
    const k: Kyc = w.LLD_DATA.kyc || {};
    const st = k.status || "not_started";
    const steps = k.steps || {};
    const locked = st === "pending" || st === "verified";
    const [pc, pt] = STATUS[st] || STATUS.not_started;
    const done = (x?: { done?: boolean }) => !!x?.done;
    const doneN = [steps.pan, steps.id, steps.bank].filter(done).length;
    const row = (label: string, value: string) =>
      `<div class="kv"><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`;
    const sec = (id: string, title: string, isDone: boolean, summary: string, form: string) => `
      <section class="card stack" aria-labelledby="bk-${id}-h" data-sec="${id}">
        <div class="row between wrap"><h2 class="t-h3" id="bk-${id}-h">${esc(title)}</h2>${isDone ? `<span class="pill pill-ok">${icon("check")}Saved</span>` : ""}</div>
        ${isDone && !openEdit.has(id) ? `<dl>${summary}</dl>${locked ? "" : `<button class="btn-q" type="button" data-edit="${id}">Change</button>`}` : locked ? `<p class="muted">Locked while under review.</p>` : form}
      </section>`;

    el.innerHTML = `<div class="focus auth setup">
      <section class="focus-art dark auth-art" aria-label="Verification">
        <p class="auth-brand"><img src="assets/logo-mark.svg" width="28" height="28" alt=""><span>linkloom</span><span class="auth-for">for brands</span></p>
        <h2 class="t-display auth-line">Verify once. Hire with escrow.</h2>
        <img class="auth-rings" src="assets/hero-rings.svg" width="610" height="660" alt="">
      </section>
      <section class="focus-form light auth-form">
        <div class="auth-in">
          <div class="auth-head">
            <p class="row wrap"><span class="pill ${pc}">${esc(pt)}</span><span class="t-eyebrow muted">${doneN} of 3 saved</span></p>
            <h1 class="t-h1" tabindex="-1">${st === "verified" ? "Your business is verified" : st === "pending" ? "We're checking your details" : "Verify your business"}</h1>
            <p class="muted">${
              st === "verified"
                ? "You can post briefs, send offers and hire with escrow."
                : st === "pending"
                  ? "Our team reviews it by hand, usually within a day. You'll get a notification when it's done."
                  : "Posting a brief, sending an offer and checking out need a verified account. Numbers are encrypted and never shown to creators."
            }</p>
            ${st === "rejected" && k.rejectionReason ? `<div class="profile-formerr" role="alert">${icon("alert")} ${esc(k.rejectionReason)}</div>` : ""}
          </div>
          <div class="auth-stack">
            ${sec(
              "pan",
              "PAN",
              done(steps.pan),
              row("PAN", "••••••" + (steps.pan?.panLast4 || "")) + row("Name on PAN", steps.pan?.nameOnPan || ""),
              `<div class="field"><label for="bkPan">PAN number</label><input class="input" id="bkPan" maxlength="10" autocomplete="off" spellcheck="false" placeholder="ABCDE1234F"><p class="help">Your company PAN, or your own if you're a sole proprietor.</p></div>
               <div class="field"><label for="bkPanName">Name as printed on the PAN</label><input class="input" id="bkPanName" autocomplete="organization" value="${esc(steps.pan?.nameOnPan || "")}"></div>
               <p class="err" data-err="pan" aria-live="assertive"></p>
               <button class="lq lq-p lq-sm" type="button" data-save="pan">Save PAN</button>`,
            )}
            ${sec(
              "id",
              "ID document",
              done(steps.id),
              row("Document", (ID_TYPES.find(t => t[0] === steps.id?.idType) || ["", "Uploaded"])[1]),
              `<div class="field"><label for="bkIdType">Document type</label><select class="select" id="bkIdType">${ID_TYPES.map(([v, t]) => `<option value="${v}">${esc(t)}</option>`).join("")}</select></div>
               <div class="field"><label for="bkIdFile">Photo or PDF of the front side</label><input class="input" id="bkIdFile" type="file" accept="image/jpeg,image/png,image/webp,application/pdf"><p class="help">JPG, PNG, WebP or PDF, up to 10 MB. All four corners in frame.</p></div>
               <p class="err" data-err="id" aria-live="assertive"></p>
               <button class="lq lq-p lq-sm" type="button" data-save="id">Upload and save</button>`,
            )}
            ${sec(
              "bank",
              "Bank account",
              done(steps.bank),
              row("Account", "••••" + (steps.bank?.accountLast4 || "")) + row("IFSC", steps.bank?.ifsc || "") + row("Holder", steps.bank?.accountHolderName || ""),
              `<div class="field"><label for="bkAcc">Account number</label><input class="input" id="bkAcc" inputmode="numeric" autocomplete="off"></div>
               <div class="field"><label for="bkAcc2">Re-enter account number</label><input class="input" id="bkAcc2" inputmode="numeric" autocomplete="off"></div>
               <div class="field"><label for="bkIfsc">IFSC</label><input class="input" id="bkIfsc" maxlength="11" autocomplete="off" placeholder="HDFC0001234"></div>
               <div class="field"><label for="bkHolder">Account holder name</label><input class="input" id="bkHolder" autocomplete="organization" value="${esc(steps.bank?.accountHolderName || "")}"><p class="help">Refunds from escrow go back to this account.</p></div>
               <p class="err" data-err="bank" aria-live="assertive"></p>
               <button class="lq lq-p lq-sm" type="button" data-save="bank">Save bank account</button>`,
            )}
          </div>
          <p class="profile-formerr" role="alert" data-ferr hidden></p>
          <div class="profile-setup-nav">
            ${
              st === "verified"
                ? `<button class="lq lq-p" type="button" data-done>${returnTo ? "Back to where you were" : "Go to your dashboard"}</button>`
                : locked
                  ? `<a class="lq lq-s" href="#home">Back to your dashboard</a>`
                  : `<a class="lq lq-s" href="#home">Save and exit</a><button class="lq lq-p" type="button" data-submit ${doneN === 3 ? "" : "disabled"}>Submit for review</button>`
            }
          </div>
        </div>
      </section></div>`;
    L.liquid(el);
    wire();
  };

  const openEdit = new Set<string>();
  const val = (id: string): string => (el.querySelector<HTMLInputElement>("#" + id)?.value || "").trim();
  const busy = async (btn: HTMLButtonElement, errKey: string, job: () => Promise<void>): Promise<void> => {
    const err = el.querySelector<HTMLElement>(`[data-err="${errKey}"]`) || el.querySelector<HTMLElement>("[data-ferr]");
    if (err) {
      err.textContent = "";
      err.hidden = false;
    }
    btn.disabled = true;
    btn.setAttribute("aria-busy", "true");
    try {
      await job();
      openEdit.delete(errKey);
      if (alive) paint();
    } catch (e) {
      btn.disabled = false;
      btn.removeAttribute("aria-busy");
      if (err) err.textContent = w.LLD.live.errorText(e);
    }
  };

  function wire(): void {
    el.querySelectorAll<HTMLButtonElement>("[data-edit]").forEach(b =>
      b.addEventListener("click", () => {
        openEdit.add(b.dataset.edit!);
        paint();
      }),
    );
    el.querySelectorAll<HTMLButtonElement>("[data-save]").forEach(b =>
      b.addEventListener("click", () => {
        const k = b.dataset.save!;
        const err = el.querySelector<HTMLElement>(`[data-err="${k}"]`)!;
        if (k === "pan") {
          const pan = val("bkPan").toUpperCase(),
            name = val("bkPanName");
          if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) return void (err.textContent = "A PAN is 5 letters, 4 digits, then 1 letter.");
          if (name.length < 3) return void (err.textContent = "Enter the name exactly as it's printed on the PAN.");
          void busy(b, k, () => w.LLD.live.kycPan(pan, name));
        } else if (k === "id") {
          const f = el.querySelector<HTMLInputElement>("#bkIdFile")?.files?.[0];
          if (!f) return void (err.textContent = "Choose a photo or PDF of the document.");
          void busy(b, k, () => w.LLD.live.kycId(val("bkIdType"), f));
        } else if (k === "bank") {
          const acc = val("bkAcc").replace(/\s/g, ""),
            ifsc = val("bkIfsc").toUpperCase(),
            holder = val("bkHolder");
          if (!/^\d{9,18}$/.test(acc)) return void (err.textContent = "Indian account numbers have 9 to 18 digits.");
          if (acc !== val("bkAcc2").replace(/\s/g, "")) return void (err.textContent = "The two account numbers don't match.");
          if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) return void (err.textContent = "An IFSC is 4 letters, a zero, then 6 letters or digits.");
          if (holder.length < 3) return void (err.textContent = "Enter the name on the bank account.");
          void busy(b, k, () => w.LLD.live.kycBank(holder, acc, ifsc));
        }
      }),
    );
    el.querySelector<HTMLButtonElement>("[data-submit]")?.addEventListener("click", e =>
      void busy(e.currentTarget as HTMLButtonElement, "submit", () => w.LLD.live.kycSubmit()),
    );
    el.querySelector("[data-done]")?.addEventListener("click", () => {
      try {
        sessionStorage.removeItem("ll-brand-kyc-return");
      } catch {
        /* ignore */
      }
      w.LLD.go(returnTo || "#home");
    });
  }

  paint();
  w.LLD.live.kyc().then(() => alive && paint(), () => undefined);
  const off = w.LLD.store.on((why: string) => why === "kyc-live" && alive && paint());
  return () => {
    alive = false;
    off();
  };
}

/** Sends the brand to #kyc and remembers where to come back to. */
export function brandKycGate(returnTo = location.hash): void {
  try {
    sessionStorage.setItem("ll-brand-kyc-return", returnTo);
  } catch {
    /* ignore */
  }
  w.LLD.toast("Verify your business to continue. It takes a few minutes.", "shield");
  w.LLD.go("#kyc");
}

/** True (and off to #kyc) when the brand isn't verified yet. Call it before posting, offering or hiring. */
export function needKyc(returnTo = location.hash): boolean {
  if (String(w.LLD_DATA.kyc?.status || "") === "verified") return false;
  brandKycGate(returnTo);
  return true;
}

export function registerBrandKyc(): void {
  w.LLD.register("kyc", { title: "Verify your business", shell: "focus", render });
  w.LLD.kycGate = brandKycGate;
  w.LLD.needKyc = needKyc;
}
