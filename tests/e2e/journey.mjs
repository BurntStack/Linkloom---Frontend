#!/usr/bin/env node
/* The creator's journey on the production build, with full motion:
   landing page → sign in → fill in details → dashboard, and every way of trying to skip a step.
   node tests/e2e/journey.mjs */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".map": "application/json",
};

const built = spawnSync("npx vite build --logLevel error", { cwd: ROOT, stdio: "inherit", shell: true });
if (built.status) process.exit(2);

const server = createServer(async (req, res) => {
  const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = join(ROOT, "dist", p === "/" ? "index.html" : p);
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${server.address().port}/`;

const SHELL = join(
  process.env.LOCALAPPDATA || "",
  "ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe",
);
const browser = await chromium.launch(existsSync(SHELL) ? { executablePath: SHELL } : { channel: "chrome" });

let failed = 0;
const problems = [];
const fresh = async (viewport = { width: 1440, height: 900 }) => {
  const ctx = await browser.newContext({ viewport, locale: "en-IN", timezoneId: "Asia/Kolkata" });
  const page = await ctx.newPage();
  page.on("pageerror", e => problems.push("uncaught error: " + e.message));
  page.on("response", r => {
    if (r.status() >= 400 && r.url().startsWith(BASE)) problems.push(`http ${r.status()}: ${r.url()}`);
  });
  return page;
};
const hash = p => p.evaluate(() => location.hash);
const expectHash = async (p, want, ms = 6000) => {
  await p.waitForFunction(h => location.hash === h, want, { timeout: ms }).catch(() => {});
  const got = await hash(p);
  if (got !== want) throw new Error(`expected ${want}, on ${got}`);
};
const dashboardShown = p => p.evaluate(() => !document.getElementById("app").hidden);
const test = async (name, fn) => {
  const before = problems.length;
  try {
    await fn();
    if (problems.length > before) throw new Error(problems.slice(before).join("; "));
    console.log("ok    " + name);
  } catch (e) {
    failed++;
    console.log(`FAIL  ${name}\n      ${String(e.message).split("\n")[0]}`);
  }
};

async function signIn(p, account) {
  await p.locator(`[data-acc="${account}"]`).click();
  await p.locator("#login-tel").fill("9876543210");
  await p.locator(".login-phone button[type=submit]").click();
  await p.locator(".login-box").first().waitFor({ timeout: 8000 });
  const boxes = p.locator(".login-box");
  for (let i = 0; i < 6; i++) await boxes.nth(i).fill("246810"[i]);
  const verify = p.locator("[data-verify]");
  await p.waitForTimeout(300);
  if ((await verify.count()) && (await verify.isEnabled())) await verify.click().catch(() => {});
}

const DASHBOARD = [
  "#home",
  "#jobs",
  "#job-j1",
  "#bids",
  "#active",
  "#work-a1",
  "#earnings",
  "#messages",
  "#chat-t1",
  "#profile",
  "#kyc",
  "#bid-j1",
  "#nope",
];

await test("signed out: every dashboard link goes to the shared sign-in page", async () => {
  const p = await fresh();
  for (const h of ["", ...DASHBOARD]) {
    await p.goto("about:blank");
    await p.goto(BASE + "app.html" + h);
    await p.waitForURL(/signin\.html\?role=creator$/, { timeout: 6000 });
  }
  await p.context().close();
});

await test("signed out on the account screen: moving to a dashboard link stays on sign-in", async () => {
  const p = await fresh();
  await p.goto(BASE + "app.html#login");
  for (const h of DASHBOARD) {
    await p.evaluate(x => (location.hash = x), h);
    await p.waitForTimeout(150);
    if (!(await p.locator("#login-tel").count())) throw new Error(`sign-in form not shown at ${h}`);
    if (await dashboardShown(p)) throw new Error(`dashboard visible at ${h}`);
  }
  await p.context().close();
});

const sharedSignIn = async (p, role, email = "someone@example.com") => {
  await p.locator(`.seg button[data-role="${role}"]`).click();
  await p.locator("#email").fill(email);
  await p.locator("#pw").fill("anything");
  await p.locator("#go").click();
};

await test("shared sign-in: validates, then opens the chosen dashboard, which survives a reload", async () => {
  for (const [role, page] of [["creator", "app\\.html"], ["brand", "brand\\.html"]]) {
    const p = await fresh();
    await p.goto(BASE + "signin.html");
    await p.locator(`.seg button[data-role="${role}"]`).click();
    await p.locator("#go").click();
    if ((await p.locator("#emailErr").textContent()) !== "Enter your email.") throw new Error("email not validated");
    if ((await p.locator("#pwErr").textContent()) !== "Enter your password.") throw new Error("password not validated");
    await sharedSignIn(p, role);
    await p.waitForURL(new RegExp(page + "#home$"), { timeout: 10000 });
    await expectHash(p, "#home");
    if (!(await dashboardShown(p))) throw new Error(role + " dashboard not shown");
    if (!(await p.locator(".nav-site").count())) throw new Error("no link back to the site");
    await p.reload();
    await expectHash(p, "#home");
    if (!(await dashboardShown(p))) throw new Error(role + " dashboard closed on reload");
    await p.context().close();
  }
});

await test("shared sign-in: Google opens the creator dashboard, and is not offered to brands", async () => {
  const p = await fresh();
  await p.goto(BASE + "signin.html");
  await p.locator(".seg button[data-role=brand]").click();
  if (await p.locator("#google").isVisible()) throw new Error("Google offered to a brand");
  await p.locator(".seg button[data-role=creator]").click();
  await p.locator("#google a").click();
  await p.waitForURL(/app\.html#home$/, { timeout: 10000 });
  if (!(await dashboardShown(p))) throw new Error("dashboard not shown");
  await p.context().close();
});

await test("shared sign-in: reduced motion still signs in", async () => {
  for (const act of ["form", "google"]) {
    const p = await fresh();
    await p.emulateMedia({ reducedMotion: "reduce" });
    await p.goto(BASE + "signin.html");
    if (act === "form") await sharedSignIn(p, "creator");
    else await p.locator("#google a").click();
    await p.waitForURL(/app\.html#home$/, { timeout: 8000 });
    await expectHash(p, "#home");
    if (!(await dashboardShown(p))) throw new Error(act + ": dashboard not shown");
    await p.context().close();
  }
});

await test("shared sign-in: account links lead to each side's account screens", async () => {
  const p = await fresh();
  await p.goto(BASE + "signin.html?role=brand");
  if ((await p.locator("#joinA").getAttribute("href")) !== "brand.html#signup") throw new Error("brand join link");
  if ((await p.locator("#forgot").getAttribute("href")) !== "brand.html#forgot") throw new Error("brand forgot link");
  await p.locator("#joinA").click();
  await p.waitForURL(/brand\.html#signup$/, { timeout: 8000 });
  await p.goto(BASE + "signin.html?role=creator");
  await p.locator("#joinA").click();
  await p.waitForURL(/app\.html#login$/, { timeout: 8000 });
  await p.locator("#login-tel").waitFor({ timeout: 5000 });
  await p.context().close();
});

await test("landing page: no platform fee anywhere, and the numbers agree", async () => {
  const p = await fresh();
  await p.goto(BASE);
  await p.waitForTimeout(1200);
  const text = await p.evaluate(() => document.body.textContent);
  for (const bad of ["10%", "₹16,200", "₹1,800", "example fee"]) if (text.includes(bad)) throw new Error("still says " + bad);
  if ((await p.locator("#trOutFee").textContent()) !== "None") throw new Error("payout slip fee");
  if ((await p.locator("#trOutNet").textContent()) !== "₹18,000") throw new Error("payout slip net");
  if ((await p.locator("#sdNetV").textContent()) !== "₹18,000") throw new Error("bid net");
  if ((await p.locator('[data-st-pay="net"]').textContent()) !== "₹18,000") throw new Error("steps net");
  await p.context().close();
});

await test("the landing page opens at / and Sign in leads to sign-in", async () => {
  const p = await fresh();
  await p.goto(BASE);
  if (await p.locator(".login-form").count()) throw new Error("landing page not shown");
  await p.locator(".hsign").click();
  await p.waitForURL(/signin\.html$/, { timeout: 8000 });
  await p.goBack();
  await p.waitForURL(u => u.pathname === "/", { timeout: 8000 });
  await p.context().close();
});

await test("phone: Join as a creator leads to sign-in", async () => {
  const p = await fresh({ width: 390, height: 844 });
  await p.goto(BASE);
  await p.locator(".sd-cta", { hasText: "Join as a creator" }).dispatchEvent("click");
  await p.waitForURL(/signin\.html\?role=creator$/, { timeout: 8000 });
  await p.context().close();
});

await test("new creator: no dashboard until details are saved, then it opens", async () => {
  const p = await fresh();
  await p.goto(BASE + "app.html#login");
  await signIn(p, "new");
  await expectHash(p, "#setup");

  for (const h of DASHBOARD) {
    await p.evaluate(x => (location.hash = x), h);
    await expectHash(p, "#setup");
    if (await dashboardShown(p)) throw new Error(`dashboard visible at ${h} before setup`);
  }

  await p.reload();
  await expectHash(p, "#setup");
  await p.goto(BASE + "app.html#earnings");
  await p.reload();
  await expectHash(p, "#setup");
  if (await dashboardShown(p)) throw new Error("dashboard visible after reloading a dashboard link");

  /* Saving with nothing filled in must not get through */
  await p.locator("[data-next]").click();
  await p.waitForTimeout(400);
  await expectHash(p, "#setup");
  if (await dashboardShown(p)) throw new Error("empty step let the creator through");

  /* Fill each step */
  for (let i = 0; i < 8 && (await hash(p)) === "#setup"; i++) {
    const fill = p.locator("[data-fill]");
    if ((await fill.count()) && (await fill.isVisible())) await fill.click();
    await p.locator("[data-next]").click();
    await p.waitForTimeout(800);
  }
  await expectHash(p, "#profile", 8000);
  if (!(await dashboardShown(p))) throw new Error("dashboard not shown after setup");

  for (const h of ["#home", "#jobs", "#earnings"]) {
    await p.evaluate(x => (location.hash = x), h);
    await expectHash(p, h);
  }
  await p.reload();
  await expectHash(p, "#earnings");
  if (!(await dashboardShown(p))) throw new Error("reload lost the session");
  await p.context().close();
});

await test("details entered in setup survive a reload", async () => {
  const p = await fresh();
  await p.goto(BASE + "app.html#login");
  await signIn(p, "new");
  await expectHash(p, "#setup");
  await p.locator("[data-fill]").click();
  await p.locator("#setup-name").fill("Test Creator");
  for (let i = 0; i < 8 && (await hash(p)) === "#setup"; i++) {
    await p.locator("[data-next]").click();
    await p.waitForTimeout(800);
    const fill = p.locator("[data-fill]");
    if ((await hash(p)) === "#setup" && (await fill.count()) && (await fill.isVisible())) await fill.click();
  }
  await expectHash(p, "#profile", 8000);
  await p.reload();
  const name = await p.locator("[data-me-name]").first().textContent();
  if (name !== "Test Creator") throw new Error(`name after reload is "${name}"`);
  await p.context().close();
});

await test("returning creator: goes straight to the dashboard", async () => {
  const p = await fresh();
  await p.goto(BASE + "app.html#login");
  await signIn(p, "returning");
  await expectHash(p, "#home");
  if (!(await dashboardShown(p))) throw new Error("dashboard not shown");
  await p.context().close();
});

await test("sign out closes the dashboard again, including after a reload", async () => {
  const p = await fresh();
  await p.goto(BASE + "app.html#login");
  await signIn(p, "returning");
  await expectHash(p, "#home");
  await p.evaluate(() => (location.hash = "#profile"));
  await p.locator("[data-signout]").click();
  await p.locator("[data-yes]").click();
  await p.waitForURL(/signin\.html\?role=creator&out=1$/, { timeout: 8000 });
  if (!(await p.locator("#flash").isVisible())) throw new Error("no signed-out message");
  await p.reload();
  await p.goto(BASE + "app.html#earnings");
  await p.waitForURL(/signin\.html\?role=creator$/, { timeout: 8000 });
  await p.context().close();
});

/* ---------- brands ---------- */
const BRAND_DASHBOARD = [
  "#home",
  "#creators",
  "#creator-cr1",
  "#cart",
  "#jobs",
  "#post",
  "#campaigns",
  "#campaign-c1",
  "#payments",
  "#reports",
  "#messages",
  "#chat-t1",
  "#profile",
  "#nope",
];

async function brandSignIn(p, account) {
  await p.locator(`[data-acc="${account}"]`).click();
  await p.locator("[data-submit]").click();
}

await test("signed out: every brand dashboard link goes to brand sign-in", async () => {
  const p = await fresh();
  await p.goto(BASE + "brand.html");
  await p.waitForURL(/signin\.html\?role=brand$/, { timeout: 6000 });
  await p.goto(BASE + "brand.html#home");
  await p.waitForURL(/signin\.html\?role=brand$/, { timeout: 6000 });
  await p.goto(BASE + "brand.html#login");
  for (const h of BRAND_DASHBOARD) {
    await p.evaluate(x => (location.hash = x), h);
    await p.waitForTimeout(150);
    if (!(await p.locator("#au-email").count())) throw new Error(`sign-in form not shown at ${h}`);
    if (await dashboardShown(p)) throw new Error(`dashboard visible at ${h}`);
  }
  await p.context().close();
});

await test("landing page: Start hiring leads to brand sign-in", async () => {
  const p = await fresh();
  await p.goto(BASE);
  await p.locator(".sd-cta", { hasText: "Start hiring" }).dispatchEvent("click");
  await p.waitForURL(/signin\.html\?role=brand$/, { timeout: 8000 });
  await p.context().close();
});

await test("each sign-in screen links to the other", async () => {
  const p = await fresh();
  await p.goto(BASE + "app.html#login");
  await p.locator('a[href="brand.html#login"]').click();
  await p.waitForURL(/brand\.html#login$/, { timeout: 8000 });
  await p.locator("#au-email").waitFor({ timeout: 5000 });
  await p.locator('a[href="app.html#login"]').click();
  await p.waitForURL(/app\.html#login$/, { timeout: 8000 });
  await p.locator("#login-tel").waitFor({ timeout: 5000 });
  await p.context().close();
});

await test("new brand: no dashboard until setup is saved, then it opens", async () => {
  const p = await fresh();
  await p.goto(BASE + "brand.html#login");
  await brandSignIn(p, "first");
  await expectHash(p, "#setup");
  for (const h of BRAND_DASHBOARD) {
    await p.evaluate(x => (location.hash = x), h);
    await expectHash(p, "#setup");
    if (await dashboardShown(p)) throw new Error(`dashboard visible at ${h} before setup`);
  }
  await p.reload();
  await expectHash(p, "#setup");
  await p.locator("[data-next]").click();
  await p.waitForTimeout(400);
  await expectHash(p, "#setup");
  for (let i = 0; i < 6 && (await hash(p)) === "#setup"; i++) {
    const fill = p.locator("[data-fill]");
    if ((await fill.count()) && (await fill.isVisible())) await fill.click();
    await p.locator("[data-next]").click();
    await p.waitForTimeout(900);
  }
  await expectHash(p, "#home", 8000);
  if (!(await dashboardShown(p))) throw new Error("dashboard not shown after setup");
  await p.reload();
  await expectHash(p, "#home");
  if (!(await dashboardShown(p))) throw new Error("reload lost the session");
  await p.context().close();
});

await test("returning brand: straight to the dashboard, and sign out closes it", async () => {
  const p = await fresh();
  await p.goto(BASE + "brand.html#login");
  await brandSignIn(p, "returning");
  await expectHash(p, "#home");
  if (!(await dashboardShown(p))) throw new Error("dashboard not shown");
  await p.evaluate(() => (location.hash = "#profile"));
  await p.locator("[data-signout]").click();
  await p.locator("[data-yes]").click();
  await p.waitForURL(/signin\.html\?role=brand&out=1$/, { timeout: 8000 });
  await p.goto(BASE + "brand.html#payments");
  await p.waitForURL(/signin\.html\?role=brand$/, { timeout: 8000 });
  await p.context().close();
});

await test("creator and brand sessions stay separate", async () => {
  const p = await fresh();
  await p.goto(BASE + "brand.html#login");
  await brandSignIn(p, "returning");
  await expectHash(p, "#home");
  await p.goto(BASE + "app.html#earnings");
  await p.waitForURL(/signin\.html\?role=creator$/, { timeout: 8000 });
  await p.context().close();
});

await browser.close();
server.close();
console.log(failed ? `\n${failed} journey test(s) FAILED` : "\nAll journey tests passed");
process.exit(failed ? 1 : 0);
