/* Direct offers. A brand can hire a creator without a brief: POST /v1/offers/ on their side,
   GET /v1/creators/me/offers/ and PATCH { status } on this side. The prototype had no screen for it, so the offers
   that are still open are shown at the top of My Bids, in the same card language as the bid slips. */
import { LLD, store } from "@/creator/core";
import { ApiError } from "@/shared/api/client";
import { creatorApi } from "./creator";
import { amount, day, nameOf } from "../../shared/live";

type Obj = Record<string, unknown>;

const OPEN = /^(pending|open|sent|new)$/i;

function card(o: Obj): string {
  const { esc, inr, fmtDate, initials, icon } = LLD;
  const brand = nameOf(o.brand, "A brand");
  const due = day(o.deadline);
  const sent = day(o.createdAt);
  const id = esc(String(o.id));
  return `<article class="bids-slip is-submitted" data-offer="${id}" aria-labelledby="of-${id}">
    <div class="bids-stub">
      <p class="bids-stub-l">Their offer</p>
      <p class="bids-price t-money">${inr(amount(o.budget as never))}</p>
      ${sent ? `<p class="bids-stub-d">Sent ${esc(fmtDate(sent))}</p>` : ""}
    </div>
    <div class="bids-body">
      <div class="bids-top">
        <span class="jobs-brand"><span class="jobs-bi" aria-hidden="true">${esc(initials(brand))}</span><span class="jobs-bn">${esc(brand)}</span></span>
        <span class="pill pill-info">${icon("send")}Direct offer</span>
      </div>
      <h3 class="bids-t" id="of-${id}">${esc(String(o.deliverable || "Content"))}</h3>
      <p class="bids-sub"><span>${due ? `Deliver by ${esc(fmtDate(due, { year: true }))}` : ""}${o.usageRights ? `${due ? " · " : ""}Usage: ${esc(String(o.usageRights))}` : ""}</span></p>
      ${o.message ? `<p class="bids-note">“${esc(String(o.message))}”</p>` : ""}
      <p class="err" aria-live="assertive" data-err></p>
      <div class="bids-acts">
        <button class="lq lq-p lq-sm" type="button" data-accept>Accept offer</button>
        <button class="lq lq-s lq-sm" type="button" data-decline>Decline</button>
      </div>
    </div>
  </article>`;
}

async function paintOffers(): Promise<void> {
  const host = document.querySelector<HTMLElement>("#view .bids-head");
  if (!host || host.parentElement?.querySelector("[data-offers]")) return;
  let offers: Obj[];
  try {
    offers = (await creatorApi.offers()).filter(o => OPEN.test(String(o.status || "pending")));
  } catch {
    return;
  }
  if (!offers.length || !host.isConnected) return;
  const sec = document.createElement("section");
  sec.dataset.offers = "";
  sec.setAttribute("aria-labelledby", "offersH");
  sec.className = "bids-group";
  sec.innerHTML = `<h2 class="bids-gh" id="offersH"><span class="t-h2">Direct offers</span><span class="bids-gn num">${offers.length}</span></h2>
    <p class="muted">Brands that want to hire you without a brief. Accepting starts the job once they pay into escrow.</p>
    <div class="bids-list">${offers.map(card).join("")}</div>`;
  host.after(sec);
  LLD.liquid(sec);
  sec.addEventListener("click", async e => {
    const b = (e.target as Element).closest<HTMLButtonElement>("[data-accept],[data-decline]");
    if (!b) return;
    const li = b.closest<HTMLElement>("[data-offer]")!;
    const err = li.querySelector<HTMLElement>("[data-err]")!;
    const accept = b.hasAttribute("data-accept");
    if (accept && store.s.kyc.status !== "verified") {
      store.set(s => (s.kyc.returnTo = "#bids"), "kyc-return");
      LLD.toast("Verify your ID to accept offers. It takes about 4 minutes.", "shield");
      LLD.go("#kyc");
      return;
    }
    li.querySelectorAll("button").forEach(x => (x.disabled = true));
    err.textContent = "";
    try {
      await creatorApi.answerOffer(li.dataset.offer!, accept ? "accepted" : "rejected");
      li.remove();
      LLD.toast(accept ? "Offer accepted. It's in Active jobs once the brand pays in." : "Offer declined", "check");
      if (!sec.querySelector("[data-offer]")) sec.remove();
    } catch (x) {
      li.querySelectorAll("button").forEach(y => (y.disabled = false));
      if (x instanceof ApiError && x.code === "KYC_REQUIRED") {
        store.set(s => (s.kyc.returnTo = "#bids"), "kyc-return");
        LLD.go("#kyc");
        return;
      }
      err.textContent = creatorApi.errorText(x);
    }
  });
}

/** Runs after each route change; the router renders synchronously before this listener. */
export function wireCreatorOffers(): void {
  const run = () => {
    if (location.hash.replace(/^#/, "") === "bids" && store.s.session.signedIn) void paintOffers();
  };
  addEventListener("hashchange", run);
  store.on(why => why === "signed-in" && run());
  setTimeout(run, 0);
}
