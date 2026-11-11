#!/usr/bin/env node
/* The product requirements, checked in a real browser:
   1. A signed-out visitor sees the creator and brand dashboards with real data (real API).
   2. Clicking anything that does something asks them to sign in; looking around (nav, filters) does not (real API).
   3. A signed-in user sees their details (stand-in API, until a real test login is available).
   4. Bid, hire, post, offer or accept without verified KYC → the KYC screen (stand-in API, unverified account).
   5. Google sign-in is on the sign-in page for both sides (real page; Google only works on authorised origins).
   Usage: node tests/e2e/requirements.mjs [baseUrl]   (PW_CHANNEL=chrome to use installed Chrome) */
import { chromium } from "playwright";
import { installMock } from "./mock-api.mjs";

const BASE = process.argv[2] || "http://localhost:4173";
const browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
let failed = 0;
const result = (ok, name, detail = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? "\n     " + detail : ""}`);
};
const promptOpen = p => p.locator(".sheet:visible", { hasText: "Sign in" }).count().then(n => n > 0);
const closeSheet = p => p.keyboard.press("Escape").then(() => p.waitForTimeout(400));

async function fresh(file, hash, mock) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 } });
  if (mock) await installMock(ctx, mock.role, mock.log || [], mock.overrides || {});
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(`${BASE}/${file}${hash}`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(1000);
  return { ctx, page, errors };
}

/* ---------- 1 + 2: guests, against the real API ---------- */
{
  const { ctx, page, errors } = await fresh("app.html", "#home");
  const cards = await page.locator(".jobs-card").count();
  result(cards > 0 && /Guest/.test(await page.innerText("body")), "1. creator guest sees Home with real briefs", `${cards} brief card(s) on Home`);
  await page.click("a[data-nav=jobs], a[href='#jobs'] >> nth=0");
  await page.waitForTimeout(700);
  result(page.url().endsWith("#jobs") && !(await promptOpen(page)), "2. creator guest can open Find jobs without signing in");
  await page.click("[data-plat=instagram], .jobs-seg button >> nth=1").catch(() => undefined);
  await page.waitForTimeout(400);
  result(!(await promptOpen(page)), "2. creator guest can filter briefs without a prompt");
  await page.click(".jobs-card .jobs-card-link >> nth=0");
  await page.waitForTimeout(500);
  result(await promptOpen(page), "2. creator guest opening a brief is asked to sign in");
  await closeSheet(page);
  await page.click(".jobs-card .jobs-save >> nth=0");
  await page.waitForTimeout(400);
  result(await promptOpen(page), "2. creator guest saving a brief is asked to sign in");
  await closeSheet(page);
  await page.evaluate(() => (location.hash = "#bids"));
  await page.waitForTimeout(800);
  result(page.url().endsWith("#home") && (await promptOpen(page)), "2. creator guest going to My bids is sent back with a sign-in prompt");
  const href = await page.locator(".sheet a.lq-p").first().getAttribute("href");
  result(href === "signin.html?role=creator", "2. the prompt's Sign in goes to the creator sign-in", `href=${href}`);
  result(!errors.length, "   no script errors (creator guest)", errors.join(" | "));
  await ctx.close();
}
{
  const { ctx, page, errors } = await fresh("brand.html", "#home");
  const cards = await page.locator(".creators-card").count();
  result(page.url().endsWith("#creators") && cards > 0, "1. brand guest sees the real creator directory", `${cards} creator card(s)`);
  await page.click("[data-plat=instagram]").catch(() => undefined);
  await page.waitForTimeout(400);
  result(!(await promptOpen(page)), "2. brand guest can filter creators without a prompt");
  await page.click(".creators-card button:has-text('Add to cart') >> nth=0");
  await page.waitForTimeout(400);
  result(await promptOpen(page), "2. brand guest adding to cart is asked to sign in");
  await closeSheet(page);
  await page.click(".creators-card .creators-fav >> nth=0");
  await page.waitForTimeout(400);
  result(await promptOpen(page), "2. brand guest saving a creator is asked to sign in");
  await closeSheet(page);
  await page.evaluate(() => (location.hash = "#campaigns"));
  await page.waitForTimeout(800);
  result(await promptOpen(page), "2. brand guest going to Campaigns gets a sign-in prompt");
  result(!errors.length, "   no script errors (brand guest)", errors.join(" | "));
  await ctx.close();
}

/* ---------- 5: Google on the sign-in page, both sides ---------- */
{
  const { ctx, page } = await fresh("signin.html", "");
  const creatorG = await page.locator("#googleBtn").isVisible();
  await page.click(".seg button[data-role=brand]");
  await page.waitForTimeout(500);
  const brandG = await page.locator("#googleBtn").isVisible();
  const codeHidden = !(await page.locator("#codeField").isVisible());
  result(creatorG && brandG, "5. Continue with Google is offered to creators and brands");
  result(codeHidden, "   the code box stays hidden until a code is sent");
  await ctx.close();
}

/* ---------- 3: signed in, stand-in API ---------- */
for (const role of ["creator", "brand"]) {
  const { ctx, page, errors } = await fresh(role === "brand" ? "brand.html" : "app.html", "#home", { role });
  const body = await page.innerText("body");
  result(/QA|Test/.test(body) && !/Guest/.test(body), `3. signed-in ${role} sees their own dashboard`);
  result(!errors.length, `   no script errors (${role} signed in)`, errors.join(" | "));
  await ctx.close();
}

/* ---------- 4: KYC before bid / accept / hire / post / offer, unverified account ---------- */
const unverified = { status: "not_started", rejectionReason: null, submittedAt: null, steps: { pan: { done: false }, id: { done: false }, bank: { done: false } } };
{
  const me = { id: "u-c", role: "creator", needsOnboarding: false, kycStatus: "not_started", fullName: "QA Person" };
  const { ctx, page } = await fresh("app.html", "#job-k2", { role: "creator", overrides: { "GET /v1/kyc/": unverified, "GET /v1/auth/me/": me } });
  await page.click("[data-bidnow]");
  await page.waitForTimeout(600);
  result(page.url().endsWith("#kyc"), "4. creator: Bid without KYC opens verification", page.url().split("#")[1]);
  await page.evaluate(() => (location.hash = "#bids"));
  await page.waitForSelector("[data-offer] [data-accept]", { timeout: 6000 }).catch(() => undefined);
  await page.click("[data-offer] [data-accept]").catch(() => undefined);
  await page.waitForTimeout(600);
  result(page.url().endsWith("#kyc"), "4. creator: Accept offer without KYC opens verification", page.url().split("#")[1]);
  await ctx.close();
}
{
  const me = { id: "u-b", role: "brand", needsOnboarding: false, kycStatus: "not_started", fullName: "QA Person" };
  const log = [];
  const { ctx, page } = await fresh("brand.html", "#job-k1", { role: "brand", log, overrides: { "GET /v1/kyc/": unverified, "GET /v1/auth/me/": me } });
  await page.click("[data-hire=bid1]");
  await page.waitForTimeout(600);
  result(page.url().endsWith("#kyc") && !log.some(l => /select/.test(l)), "4. brand: Hire without KYC opens verification (nothing sent)", page.url().split("#")[1]);
  await page.evaluate(() => (location.hash = "#cart"));
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const s = window.LLD_DATA;
    if (!s.cart.includes("c1")) window.LLD.store.set(x => x.cart.push("c1"), "cart-add");
    window.LLD.route();
  });
  await page.waitForTimeout(600);
  await page.fill('.cart-row [data-k="title"]', "Diwali Reel").catch(() => undefined);
  await page.click(".cart-row [data-send]").catch(() => undefined);
  await page.waitForTimeout(600);
  result(page.url().endsWith("#kyc") && !log.some(l => /\/v1\/offers\//.test(l)), "4. brand: Send offer without KYC opens verification (nothing sent)", page.url().split("#")[1]);
  await ctx.close();
}

await browser.close();
console.log(failed ? `\n${failed} check(s) failed` : "\nall requirement checks passed");
process.exit(failed ? 1 : 0);
