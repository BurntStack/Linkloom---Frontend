#!/usr/bin/env node
/* Signed-in walk-through of both dashboards against a stand-in API that returns the shapes the backend documents.
   It catches crashes in the mapping and wiring code without a real account. It does NOT prove the real backend
   matches: run it again against the real API (live-smoke.mjs plus a test login) for that.
   Usage: node tests/e2e/live-mocked.mjs [baseUrl] [outDir]   (PW_CHANNEL=chrome to use installed Chrome) */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { installMock } from "./mock-api.mjs";

const BASE = process.argv[2] || "http://localhost:4173";
const OUT = process.argv[3] || "test-results/live-mocked";
mkdirSync(OUT, { recursive: true });
const routes = {
  creator: ["home", "jobs", "job-k1", "bids", "active", "work-o1", "work-o2", "messages", "chat-cv1", "earnings", "profile", "kyc"],
  brand: ["home", "creators", "creator-c1", "saved", "cart", "jobs", "job-k1", "post", "campaigns", "campaign-o2", "campaign-offer-of2", "messages", "chat-cv1", "payments", "reports", "profile", "kyc"],
};

const browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
let problems = 0;
for (const role of ["creator", "brand"]) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 } });
  const unknown = await installMock(ctx, role);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  const file = role === "brand" ? "brand.html" : "app.html";
  await page.goto(`${BASE}/${file}#home`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  for (const r of routes[role]) {
    errors.length = 0;
    await page.evaluate(h => (location.hash = h), "#" + r);
    await page.waitForTimeout(700);
    const text = (await page.locator("#view:visible, #focusRoot:visible").first().innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 160);
    const broken = /could not load|being built|undefined|NaN|\[object Object\]/.test(text);
    await page.screenshot({ path: `${OUT}/${role}-${r}.png` });
    const at = page.url().split("#")[1];
    if (errors.length || broken) problems++;
    console.log(`[${role}] #${r} → #${at}${broken ? "  ! suspicious text" : ""}`);
    console.log(`   ${text}`);
    errors.forEach(e => console.log("   ! " + e));
  }
  if (unknown.size) console.log(`[${role}] calls with no fixture: ${[...unknown].join(", ")}`);
  await ctx.close();
}
await browser.close();
console.log(problems ? `\n${problems} screen(s) with problems` : "\nall screens clean");
process.exit(problems ? 1 : 0);
