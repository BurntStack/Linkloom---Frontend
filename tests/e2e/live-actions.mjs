#!/usr/bin/env node
/* Clicks the main actions in both dashboards against the stand-in API and checks the request each one sends.
   Usage: node tests/e2e/live-actions.mjs [baseUrl]   (PW_CHANNEL=chrome to use installed Chrome) */
import { chromium } from "playwright";
import { installMock } from "./mock-api.mjs";

const BASE = process.argv[2] || "http://localhost:4173";
const browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
let failed = 0;

async function session(role, overrides) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 } });
  const log = [];
  await installMock(ctx, role, log, overrides);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(`${BASE}/${role === "brand" ? "brand.html" : "app.html"}#home`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  return { ctx, page, log, errors };
}

async function check(name, s, steps, expect) {
  const before = s.log.length;
  s.errors.length = 0;
  try {
    await steps(s.page);
    await s.page.waitForTimeout(900);
  } catch (e) {
    s.errors.push("step: " + e.message.split("\n")[0]);
  }
  const sent = s.log.slice(before);
  const hit = sent.find(l => expect.test(l));
  const ok = !!hit && !s.errors.length;
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}`);
  console.log(`     ${hit || "no matching request; sent: " + (sent.join(" | ") || "nothing")}`);
  s.errors.forEach(e => console.log("     ! " + e));
}

const go = (p, h) => p.evaluate(x => (location.hash = x), h).then(() => p.waitForTimeout(700));

/* ---------- creator ---------- */
const c = await session("creator");
await check("creator: place a bid", c, async p => {
  await go(p, "#bid-k2");
  await p.fill("#bidPrice", "12000");
  await p.fill("#bidWhy", "I make weekend cafe vlogs for a Hyderabad audience and can shoot this in one day.");
  const d = new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10);
  await p.fill("#bidPost", d);
  await p.click("[data-addlink]");
  await p.fill("#bidLinks input", "https://instagram.com/reel/abc");
  await p.click(".bid-review-btn");
  await p.waitForTimeout(500);
  await p.click("[data-send]");
}, /^POST \/v1\/campaigns\/k2\/bids\/ .*"price":1200000/);
await check("creator: withdraw a bid", c, async p => {
  await go(p, "#bids");
  await p.click("[data-withdraw=bid1]");
  await p.click("[data-yes]");
}, /^POST \/v1\/campaigns\/k1\/bids\/bid1\/withdraw\//);
await check("creator: accept a direct offer", c, async p => {
  await go(p, "#bids");
  await p.waitForSelector("[data-offer] [data-accept]", { timeout: 5000 });
  await p.click("[data-offer] [data-accept]");
}, /^PATCH \/v1\/creators\/me\/offers\/of1\/ .*accepted/);
await check("creator: send a chat message", c, async p => {
  await go(p, "#chat-cv1");
  await p.waitForSelector("#chatIn", { timeout: 5000 });
  await p.fill("#chatIn", "Sharing the next cut tonight.");
  await p.press("#chatIn", "Enter");
}, /^POST \/v1\/conversations\/cv1\/messages\/ .*next cut/);
await c.ctx.close();

/* ---------- creator KYC, from scratch ---------- */
const unverified = { status: "not_started", rejectionReason: null, submittedAt: null, steps: { pan: { done: false }, id: { done: false }, bank: { done: false } } };
const k = await session("creator", { "GET /v1/kyc/": unverified, "GET /v1/auth/me/": { id: "u-c", role: "creator", needsOnboarding: false, kycStatus: "not_started", fullName: "QA Person" } });
await check("creator KYC: save PAN", k, async p => {
  await go(p, "#kyc");
  await p.click("[data-begin]");
  await p.fill("#kyc-pan", "ABCPE1234F");
  await p.fill("#kyc-pname", "QA PERSON");
  await p.click("[data-next]");
}, /^PUT \/v1\/kyc\/pan\/ .*ABCPE1234F/);
await check("creator KYC: bid without KYC goes to verification", k, async p => {
  await go(p, "#job-k2");
  await p.click("[data-bidnow]");
  await p.waitForTimeout(400);
  if (!(await p.url()).includes("#kyc")) throw new Error("did not open #kyc, at " + (await p.url()));
  /* the gate is client-side; record a harmless marker so check() has a request to match */
  await p.evaluate(() => fetch("https://collab-api-ewju.onrender.com/v1/__gate_ok__", { method: "POST" }).catch(() => 0));
}, /__gate_ok__/);
await k.ctx.close();

/* ---------- brand ---------- */
const b = await session("brand");
await check("brand: approve a delivery", b, async p => {
  await go(p, "#campaign-o2");
  await p.click("[data-approve]");
}, /^POST \/v1\/orders\/o2\/approve\//);
await check("brand: ask for a revision", b, async p => {
  await go(p, "#campaign-o2");
  await p.fill("#cwVnote", "Please shorten the hook to under two seconds.");
  await p.click("[data-revise]");
}, /^POST \/v1\/orders\/o2\/revisions\/ .*hook/);
await check("brand: hire from a bid", b, async p => {
  await go(p, "#job-k1");
  await p.click("[data-hire=bid1]");
  await p.waitForTimeout(400);
  await p.click(".sheet [data-yes], .sheet .lq-p");
}, /^POST \/v1\/campaigns\/k1\/bids\/bid1\/select\//);
await check("brand: unsave a favourite", b, async p => {
  await go(p, "#creators");
  await p.click(".creators-card .creators-fav");
}, /^DELETE \/v1\/lists\/l1\/creators\/c1\//);
await check("brand: send a chat message", b, async p => {
  await go(p, "#chat-cv1");
  await p.waitForSelector("#chatIn, .chat-in", { timeout: 5000 });
  const sel = (await p.$("#chatIn")) ? "#chatIn" : ".chat-in";
  await p.fill(sel, "Looks great, approving now.");
  await p.press(sel, "Enter");
}, /^POST \/v1\/conversations\/cv1\/messages\/ .*approving/);
await check("brand: cancel a direct offer", b, async p => {
  await go(p, "#campaign-offer-of2");
  await p.click("[data-cancelinv]");
  await p.waitForTimeout(400);
  await p.click(".sheet [data-yes], .sheet .lq-p");
}, /^POST \/v1\/offers\/of2\/withdraw\//);
await b.ctx.close();

await browser.close();
console.log(failed ? `\n${failed} action(s) failed` : "\nall actions sent the right request");
process.exit(failed ? 1 : 0);
