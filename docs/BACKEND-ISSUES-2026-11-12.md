# Backend issues found from the frontend — 12 Nov 2026

Checked against `https://collab-api-ewju.onrender.com` and the **Collab Backend API Reference v1** PDF, from the
live site (`https://linkloom-frontend.vercel.app`). Everything below was reproduced today with plain HTTP requests
unless marked *reported*. Signed-in flows could not be fully tested because the QA test login is off (see #12).

Priority: **P0** blocks users · **P1** wrong behaviour or data · **P2** gaps, docs and speed.

---

## P0 — blocks users

### 1. Account data served without signing in, and the wrong data
`GET /v1/creators/me/campaigns/` with **no token** returns `200` with rows. It should be `401`.
The rows are the public campaign list (same rows as `GET /v1/campaigns/`), not the signed-in creator's bids.
The frontend uses this endpoint for **My bids**, so a creator sees every public brief as "their bid".

- Expected signed out: `401 AUTH_REQUIRED`.
- Expected signed in: only this creator's bids, each with its campaign (or tell us the right endpoint for "my bids").

### 2. Password sign-in keeps failing with `500 INTERNAL_ERROR` — this is the "Something went wrong" users see
`POST /v1/auth/login/` returns `500 INTERNAL_ERROR` for **every** identifier, on and off, for most of today.
It is not the frontend: the site sends exactly `{ "identifier": "9381946904", "password": "…" }` and shows the
server's own message ("Something went wrong."). It is not the role either: brand and creator sign-in send the
same request. It is not the number format: bare 10 digits, `+91…` and emails all fail together.

**Scope, checked at 2026-11-12 06:36 UTC (12:06 IST):** everything that reads the database fails at the same
time — `login/`, `google/`, `token/refresh/`, and even the public `GET /v1/campaigns/` and `GET /v1/creators/`
all answer `500` in ~0.12 s. Requests that are rejected *before* touching the database still work (empty bodies →
`400 VALIDATION_ERROR`, no token → `401 AUTH_REQUIRED`). That pattern points at the **database connection**
(pool exhausted, the free Postgres instance's connection limit or sleep, or a failed migration), not at the login
code itself. During the brief healthy windows everything works at once; during the bad ones everything fails at once.

Reproduced the same morning, two rounds, 12 login requests, 12 × 500. Request IDs for the server log:
`cc2f1cb732034ba5b44981a48dc9f3d0`, `a35331b0a0a64d0ba5fe31d72407be49`, `207b01ecd48b4b94a28de8facc7f5454`,
`e58ccfa2d6ec438e86cfe7d9cd9c0f1a` (email), `5bdb201f88e64c00987f12c508fc1397`, `3294b17defa44f25a28485ea21e8e54b`.

In between, for short periods, the same requests answered correctly (`401 AUTH_INVALID`), so the code path works
sometimes. Earlier today `otp/request/` and `otp/verify/` failed the same way for ~15 minutes while
`GET /v1/campaigns/` kept working.

- Please read the traceback for the request IDs above. Likely candidates: the lookup by phone/email (a
  normalisation or `.get()` that raises on 0 or 2 matches), or a missing column/migration on the user table.
- Until it is fixed, **nobody can sign in with a password**, on either side.
- Please use a zero-downtime deploy (health check before switching traffic) and tell us when auth is being deployed.

**Latency when login does work:** a wrong-password response took **2.8–2.9 s** (`+919381946904`, `93819 46904`),
against ~0.12 s for a validation error. Password hashing should cost ~0.1–0.3 s; the rest is the query.

### 3. No way to reset or change a password
The PDF has `POST /v1/auth/login/` and a password inside `/signup/complete/`, but **no password reset or change**.
Today "Forgot password?" on the site can only sign the person in with a one-time code; they can never set a new password.
Also, every account created before today (code-based sign-up) **has no password at all**, and login just says
`AUTH_INVALID`, so those people cannot tell what is wrong.

Needed:
- `POST /v1/auth/password/change/` (signed in): `{ "password", "confirmPassword" }`, no old password required when
  the session was opened by a one-time code in the last few minutes (that is how reset-by-code works).
- `hasPassword: true|false` on the user object (`/auth/me/`, login and OTP-verify responses), so the site can prompt
  older accounts to set one.
- A distinct login error for "this account has no password yet", e.g. `PASSWORD_NOT_SET`, or at least return it in
  `error.details`.

### 4. *Reported:* verifying the sign-up code signed the person in without a password
A user creating an account entered the SMS code and was logged straight in; the password step never ran.
The site skips the password only when `/v1/auth/otp/verify/` returns a user with `needsOnboarding: false`
(an existing account). Please check what `otp/verify` returns for a **brand-new number**: it must be
`needsOnboarding: true` and `role: null`. If the number already existed, this is fixed on the frontend; if it was
new, the backend is marking new numbers as finished accounts.

---

## P1 — wrong behaviour or data

### 5. Campaigns have no brand and no bid count
Every row of `GET /v1/campaigns/` has `"brand": null`, and there is no bid-count field. The site shows
"Brand on Linkloom" on every brief and "0 bids" everywhere.
- Add `brand: { id, name, logoUrl }` and `bidCount` to each campaign row (list and detail).

### 6. Campaign detail requires a token while the list is public
`GET /v1/campaigns/` is public, but `GET /v1/campaigns/<id>/` returns `401`. A visitor can see the briefs but cannot
open one. The PDF says browsing is public.
- Make detail public for `open` campaigns (hide brand contact details if needed).

### 7. List filters are ignored
`GET /v1/campaigns/?platform=youtube` returned Instagram rows. `?limit=500` is accepted silently although the PDF
says max 50 (fine, but document the real behaviour). Could not test `category`, `budgetMin__gte`, `budgetMax__lte`.
- Apply the documented filters, or return `400 VALIDATION_ERROR` for unknown ones.

### 8. Field names: please confirm the exact names the server accepts
The server rejects any unknown body field (`400 VALIDATION_ERROR: Unknown or read-only field`), so a single wrong
name breaks a feature. These differ between the PDF and what the site sends today:

| Call | Site sends | PDF says | Which is right? |
|---|---|---|---|
| `POST /conversations/<id>/messages/` | `text` (+ `attachmentUploadId`) | `content` | ? |
| `POST /orders/<id>/deliverables/` | `contentUrl` / `fileUploadId` + `note` | `contentUrl` + `note` only | is `fileUploadId` accepted? |
| `POST /offers/` | `creatorId, deliverable, budget, deadline, message, usageRights` | same | ✓ confirm |
| `POST /campaigns/<id>/bids/` | `price, message, deliveryDays, expectedViews` | no `expectedViews` | is it accepted? |
| `PATCH /creators/me/` | `displayName, bio, categories, location, primaryPlatform` | same | ✓ |
| Money in requests | integer paise | integer paise | ✓ (responses use `{amount, currency}` — fine) |

### 9. Dates come back as plain dates, not timestamps
`closesAt` and `createdAt` are `"2026-11-05"`; the PDF documents ISO datetimes (`"2026-12-01T18:30:00Z"`).
The site copes, but "closes in 3 hours" style wording is impossible. Please return full ISO-8601 timestamps.

### 10. Errors outside the envelope
Unknown routes (for example `/v1/nope/`) return an **HTML** 404 page, not the JSON envelope the PDF promises for
every response. A missing trailing slash answers `301`. Both break clients that expect JSON.
- Return `{ success:false, error:{ code:"NOT_FOUND" } }` for unknown routes under `/v1/`.

---

## P2 — gaps, documentation and speed

### 11. Documented endpoints that do not exist on the server (all `404`)
`/v1/auth/email/request/`, `/v1/auth/email/verify/`, `/v1/creators/me/avatar/`, `/v1/checkout/`,
`/v1/payments/verify/`, `/v1/creators/me/wallet/`, `/v1/creators/me/withdrawals/`, `/v1/reports/overview/`,
`/v1/reports/export/orders/` (and the other exports).
- Either deploy them or mark them "not yet live" in the reference, so we do not build on them.

**Endpoints the site uses that exist but are missing from the PDF** — please document them (shapes, statuses, errors):
`/v1/kyc/` (+ `pan/`, `id/`, `bank/`, `submit/`), `/v1/lists/` (+ `creators/`), `/v1/creators/me/earnings/`,
`/v1/creators/me/orders/`, `/v1/creators/me/campaigns/`, `/v1/brands/me/`, `/v1/realtime/ticket/` and the
WebSocket path, `/v1/offers/<id>/withdraw/`, `/v1/conversations/<id>/read/`, `/v1/notifications/<id>/read/`,
the 3-step upload (`/v1/uploads/` ticket → PUT → complete), `/v1/creators/<id>/reviews/`.

### 12. QA test login
`OTP_TEST_ACCOUNTS` / `OTP_TEST_CODE` on Render were off when we tested earlier: three attempts returned
`OTP_INVALID` and each sent a **real SMS**. With the 5-per-hour limit per number, one person can test sign-up
only five times an hour.
- Turn the test accounts on (numbers 8688815998, 9381946904, 6302624130 were agreed), tell us the code, and
  exempt them from the SMS send and the hourly limit. Turn them off before launch.

### 13. Google sign-in
The site now uses Google client ID `591280470035-mamos86blk66gpr7bufpv48ln9dntsef.apps.googleusercontent.com`.
`POST /v1/auth/google/` must accept ID tokens for this client ID (the `aud` claim), or it fails with
`GOOGLE_TOKEN_INVALID`. Please confirm the env var was updated.

### 14. Speed and sleeping
- Simple auth errors take ~0.12 s; `GET /v1/campaigns/` takes **~0.58 s for 2 rows**, every time. That points to
  slow queries (N+1 or missing indexes) rather than network. Worth a look before there are real rows.
- The Render free instance sleeps after 15 minutes; the first request after that can take up to a minute.
  Users see "The server is waking up" on every first visit. A paid instance or a keep-alive ping fixes it.

### 15. Small things
- `POST /v1/auth/otp/request/` with a bad number returns `422 INVALID_PHONE`; the PDF lists only 400 for validation.
  Fine, but add 422 to the docs.
- CORS is `Access-Control-Allow-Origin: *`. Acceptable for a bearer-token API; lock it to the site origins before launch.
- `GET /ws/?ticket=` answers `404` to a plain GET. Expected for a WebSocket, but please confirm the real path that
  `/v1/realtime/ticket/` returns.
- Deliverable status names, order status names and offer status names are not in the PDF; the site maps them by
  guesswork (`funded`, `draft_submitted`, `revision_requested`, `approved`, `completed`, `pending`, `accepted`,
  `rejected`, `withdrawn`). Please publish the full lists.

---

## What we need back

1. Fix for #1 and a confirmed "my bids" endpoint.
2. Password change endpoint + `hasPassword` (#3), and the answer to #4.
3. The right field names from the table in #8.
4. Brand and bid count on campaigns (#5), public campaign detail (#6).
5. Test login switched on (#12) and the Google client ID confirmed (#13).

With 1–3 and 5 we can run a full signed-in test of both dashboards against the real server the same day.
