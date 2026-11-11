#!/usr/bin/env node
/* Smoke test against the real backend: open each page signed out (guest view) and report console errors,
   failed requests and what the guest sees. Usage: node tests/e2e/live-smoke.mjs [baseUrl] [outDir]
   Needs a build served at baseUrl (default http://localhost:4173), e.g. `npx vite build && npx vite preview`. */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.argv[2] || "http://localhost:4173";
const OUT = process.argv[3] || "test-results/live-smoke";
mkdirSync(OUT, { recursive: true });

const pages = [
  ["landing", "/index.html"],
  ["signin", "/signin.html"],
  ["creator-guest-home", "/app.html#home"],
  ["creator-guest-jobs", "/app.html#jobs"],
  ["creator-guest-bids", "/app.html#bids"],
  ["brand-guest-home", "/brand.html#home"],
  ["brand-guest-creators", "/brand.html#creators"],
];

const browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
let failures = 0;
for (const vp of [{ name: "desktop", width: 1366, height: 860 }, { name: "phone", width: 390, height: 844 }]) {
  for (const [name, path] of pages) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", e => errors.push("pageerror: " + e.message));
    page.on("console", m => m.type() === "error" && errors.push("console: " + m.text()));
    page.on("requestfailed", r => !/accounts\.google|fonts\./.test(r.url()) && errors.push("requestfailed: " + r.url()));
    await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 90000 }).catch(e => errors.push("goto: " + e.message));
    await page.waitForTimeout(1200);
    const text = (await page.locator("#view, main, body").first().innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 220);
    await page.screenshot({ path: `${OUT}/${vp.name}-${name}.png`, fullPage: false });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    if (errors.length || overflow) failures++;
    console.log(`[${vp.name}] ${name} url=${page.url().replace(BASE, "")}`);
    console.log(`   text: ${text}`);
    if (overflow) console.log("   ! horizontal overflow");
    errors.forEach(e => console.log("   ! " + e));
    await ctx.close();
  }
}
await browser.close();
console.log(failures ? `\n${failures} page(s) with problems` : "\nall pages clean");
process.exit(failures ? 1 : 0);
