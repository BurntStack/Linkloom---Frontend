#!/usr/bin/env node
/* The setup form against a stand-in that follows the backend's onboarding spec. It proves what the frontend sends and how it
   reacts. It does not prove the real server behaves the same way. node tests/e2e/onboarding-api.mjs */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = ".parity-dist/onboarding-api";
const built = spawnSync(`npx vite build --logLevel error --outDir ${OUT} --emptyOutDir`, {
  cwd: ROOT,
  stdio: "inherit",
  shell: true,
  env: { ...process.env, VITE_API_BASE_URL: "/backend" },
});
if (built.status) process.exit(2);

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" };
const server = createServer(async (req, res) => {
  const p = new URL(req.url, "http://x").pathname;
  const file = join(ROOT, OUT, p === "/" ? "index.html" : p);
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
const test = async (name, fn) => {
  try {
    await fn();
    console.log("ok    " + name);
  } catch (e) {
    failed++;
    console.log(`FAIL  ${name}\n      ${String(e.message).split("\n")[0]}`);
  }
};
const same = (got, want, what) => {
  if (JSON.stringify(got) !== JSON.stringify(want))
    throw new Error(`${what}: got ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`);
};
const hash = p => p.evaluate(() => location.hash);

/* Signs in as a new creator with a token present, and answers the API with `reply` */
async function atSetup(reply) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const calls = [];
  await page.addInitScript(() => sessionStorage.setItem("ll-access-token", "test-token"));
  await page.route("**/backend/api/v1/creator/onboarding", route => {
    calls.push({
      method: route.request().method(),
      auth: route.request().headers().authorization,
      body: route.request().postDataJSON(),
    });
    return reply(route);
  });
  await page.goto(BASE + "app.html#login");
  await page.locator('[data-acc="new"]').click();
  await page.locator("#login-tel").fill("9876543210");
  await page.locator(".login-phone button[type=submit]").click();
  await page.locator(".login-box").first().waitFor({ timeout: 8000 });
  for (let i = 0; i < 6; i++) await page.locator(".login-box").nth(i).fill("246810"[i]);
  await page.waitForTimeout(300);
  const verify = page.locator("[data-verify]");
  if ((await verify.count()) && (await verify.isEnabled())) await verify.click().catch(() => {});
  await page.waitForFunction(() => location.hash === "#setup", null, { timeout: 8000 });
  return { page, calls, ctx };
}

/* Fills every step, choosing "Woman" so the gender translation is exercised, and stops on the last one */
async function answerAll(page) {
  for (let i = 0; i < 3; i++) {
    await page.locator("[data-fill]").click();
    if (i === 0) await page.locator('input[name="gender"][value="Woman"]').check({ force: true });
    await page.locator("[data-next]").click();
    await page.waitForTimeout(700);
  }
}
const finish = page => page.locator("[data-next]").click();
const json = (status, body) => route =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
const OK = {
  ok: true,
  message: "Onboarding completed successfully.",
  user: { isProfileCompleted: true, approvalStatus: "pending" },
  creatorProfile: {},
};

await test("sends the spec's fields with the access token, then opens the dashboard", async () => {
  const { page, calls, ctx } = await atSetup(json(200, OK));
  await answerAll(page);
  await finish(page);
  await page.waitForFunction(() => location.hash === "#profile", null, { timeout: 8000 });
  same(calls.length, 1, "number of calls");
  same(calls[0].method, "POST", "method");
  same(calls[0].auth, "Bearer test-token", "authorization");
  const b = calls[0].body;
  same([b.firstName, b.lastName], ["Ananya", "Iyer"], "name");
  same(b.dateOfBirth, "2001-03-14", "dateOfBirth");
  same(b.gender, "Female", "gender");
  same(b.category, "Skincare, Beauty, Lifestyle", "category");
  same(b.languages, ["Hindi", "English", "Marathi"], "languages");
  same([b.city, b.regionState, b.country], ["Mumbai", "Maharashtra", "India"], "location");
  same(b.instagramHandle, "ananyamakes", "instagramHandle");
  same(b.youtubeHandle, "AnanyaMakes", "youtubeHandle");
  const toast = await page.locator(".toast").textContent();
  if (!toast.includes("submitted for verification")) throw new Error(`toast was "${toast}"`);
  if (await page.evaluate(() => document.getElementById("app").hidden))
    throw new Error("dashboard still closed");
  await ctx.close();
});

await test("a rejection keeps the creator on setup with the server's message, and they can retry", async () => {
  let reply = json(422, { message: "You must be at least 18 years old." });
  const { page, calls, ctx } = await atSetup(route => reply(route));
  await answerAll(page);
  await finish(page);
  await page.locator("[data-formerr]").waitFor({ state: "visible", timeout: 5000 });
  same(
    await page.locator("[data-formerr]").textContent(),
    "You must be at least 18 years old.",
    "error text",
  );
  same(await hash(page), "#setup", "route");
  await page.evaluate(() => (location.hash = "#home"));
  await page.waitForTimeout(300);
  same(await hash(page), "#setup", "dashboard link while rejected");
  await page.evaluate(() => (location.hash = "#setup"));
  await page.waitForTimeout(500);
  reply = json(200, OK);
  await finish(page);
  await page.waitForFunction(() => location.hash === "#profile", null, { timeout: 8000 });
  same(calls.length, 2, "number of calls");
  await ctx.close();
});

await test("a server failure with no message shows a plain error and keeps the answers", async () => {
  const { page, ctx } = await atSetup(route => route.fulfill({ status: 500, body: "boom" }));
  await answerAll(page);
  await finish(page);
  await page.locator("[data-formerr]").waitFor({ state: "visible", timeout: 5000 });
  same(
    await page.locator("[data-formerr]").textContent(),
    "We couldn't save that. Please try again.",
    "error text",
  );
  if (!(await page.locator("[data-next]").isEnabled())) throw new Error("save button stayed disabled");
  await ctx.close();
});

await test("no connection shows a plain error", async () => {
  const { page, ctx } = await atSetup(route => route.abort());
  await answerAll(page);
  await finish(page);
  await page.locator("[data-formerr]").waitFor({ state: "visible", timeout: 5000 });
  same(await hash(page), "#setup", "route");
  await ctx.close();
});

await test("an expired session goes to the session-expired sign-in", async () => {
  const { page, ctx } = await atSetup(json(401, { message: "Unauthorized" }));
  await answerAll(page);
  await finish(page);
  await page.waitForFunction(() => location.hash === "#login-expired", null, { timeout: 5000 });
  await page.locator("[data-expired]").waitFor({ state: "visible", timeout: 3000 });
  await ctx.close();
});

await browser.close();
server.close();
await rm(join(ROOT, OUT), { recursive: true, force: true });
console.log(failed ? `\n${failed} test(s) FAILED` : "\nAll onboarding API tests passed");
process.exit(failed ? 1 : 0);
