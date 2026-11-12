# Backend integration

The site talks to the Linkloom API at `https://collab-api-ewju.onrender.com` (set in `.env.production`; the code falls
back to it when `VITE_API_BASE_URL` is unset). The parity build (`--mode parity`) still runs on the prototype's sample
data and never calls the server; every other build swaps the seed files for empty states (`vite.config.ts`).

## Where things live

| Path | What it does |
|---|---|
| `src/shared/api/client.ts` | Requests, the `{success,data,error,meta}` envelope, tokens (localStorage when "Keep me signed in", else sessionStorage), automatic refresh, `ApiError` with the backend's error `code` |
| `src/shared/api/auth.ts` | One-time code (SMS or email), Google, `/auth/me`, sign-up completion, sign-out |
| `src/shared/api/google.ts` | Google Identity Services: Google's real button laid invisibly over the designed one |
| `src/shared/api/uploads.ts` | The three-step upload (ticket → PUT → complete) and 5-minute download links |
| `src/shared/api/realtime.ts` | WebSocket live updates with ticket, ping and reconnect |
| `src/apps/creator/live/creator.ts`, `src/apps/creator/live/creator-offers.ts` | Creator data: backend rows → the screens' model, plus every creator action |
| `src/apps/brand/live.ts`, `src/apps/brand/kyc.ts` | Brand data and actions, and the brand verification screen |
| `src/apps/creator/session.ts`, `src/apps/brand/session.ts` | Signed-in loading, read-only guest view, session expiry, sign-out |

## What each screen uses

**Creator:** Find jobs `GET /campaigns/` · Bid `POST /campaigns/{id}/bids/` · My bids `GET /creators/me/campaigns/`, withdraw, direct offers `GET/PATCH /creators/me/offers/` · Active jobs `GET /creators/me/orders/`, deliverables (file upload or link) · Messages `/conversations/` · Earnings `GET /creators/me/earnings/` (withdrawals hidden while `payoutsEnabled` is false) · KYC `/kyc/` (PAN, ID document, bank, submit) · Profile `PATCH /creators/me/`, avatar upload.

**Brand:** Find creators `GET /creators/` and `/creators/{id}/` · Saved `/lists/` ("Favourites") · Cart → `POST /offers/` · Jobs `GET/POST/PATCH /campaigns/`, close, bids, select · Campaigns = orders + open offers: approve, revisions, review, withdraw offer · Messages · Payments and Reports derived from orders · Profile `PATCH /brands/me/`, logo upload · Verification `/kyc/`.

**Guests** (signed out) see the creator dashboard's Home and Find jobs, and the brand's creator directory, read-only. Any other click opens a "Sign in to continue" sheet.

## Not on the backend yet (handled honestly in the UI)

- **Escrow payment** (Razorpay): "Pay into escrow" explains that online payment is being switched on and offers support by email.
- **Payouts/withdrawals:** hidden, keyed off `payoutsEnabled`.
- **Report a brief / report a chat:** opens an email to support@linkloom.in with the details filled in.
- **Newsletter:** opens an email to support@linkloom.in.
- **Fields with no backend column** (creator date of birth, gender, languages, self-reported follower numbers, portfolio links; brand budget; job drafts) are kept per account on the device.

## Tests

```
npx vite build && npx vite preview --port 4173      # in one terminal
PW_CHANNEL=chrome npm run test:live                 # signed out, against the real API
PW_CHANNEL=chrome npm run test:mocked               # signed in, against a stand-in API with the documented shapes
```

`test:mocked` proves the screens and actions are wired; it does not prove the real API returns those exact shapes.
Run a signed-in pass against the real API with the QA test logins (`OTP_TEST_ACCOUNTS` / `OTP_TEST_CODE` on Render).

## Before launch

- Google Cloud Console → the OAuth client → **Authorized JavaScript origins**: the production domain (with and without `www`), the Vercel URL, `http://localhost:5173`.
- Render: empty `OTP_TEST_ACCOUNTS` and `OTP_TEST_CODE`.
- Render free tier sleeps after 15 minutes; the first request can take up to a minute. A paid instance avoids that.
