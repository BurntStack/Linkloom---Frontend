#!/usr/bin/env node
/* Parity gate: drives the untouched prototype and a fresh build of src/ side by side and fails on any difference.
   Compared after every step: serialized DOM, form values, focus, hash, title, scroll, uncaught errors, failed local requests.
   Reduced-motion runs also compare full-page pixels. Full-motion runs compare the settled DOM and errors.

   node tests/parity/run.mjs [--only=substr[,substr]] [--no-pixels] [--no-full-motion] [--workers=N] [--list]
   Each process builds into its own folder, so several agents can run it at once. */
import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { readFile, mkdir, rm, writeFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { extname, join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { pageScenarios } from "./scenarios.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");
const flag = n => process.argv.includes("--" + n);
const opt = n => (process.argv.find(a => a.startsWith(`--${n}=`)) || "").split("=").slice(1).join("=");
const ONLY = opt("only").split(",").filter(Boolean);
const OUT = join(HERE, "out", String(process.pid));
const FIXED_NOW = new Date("2026-11-04T10:42:00+05:30");
const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 1024, height: 768 },
  phone: { width: 390, height: 844 },
};
const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".map": "application/json",
};

function serve(dir) {
  return new Promise(res => {
    const srv = createServer(async (req, rsp) => {
      const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
      const file = join(dir, p === "/" ? "index.html" : p);
      try {
        const b = await readFile(file);
        rsp.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
        rsp.end(b);
      } catch {
        rsp.writeHead(404);
        rsp.end();
      }
    });
    srv.listen(0, "127.0.0.1", () =>
      res({ url: `http://127.0.0.1:${srv.address().port}/`, close: () => srv.close() }),
    );
  });
}

/* Runs in the page. Serializes everything the user could perceive except pixels. */
const SNAPSHOT = () => {
  const skip = new Set(["SCRIPT", "LINK", "STYLE", "META", "TITLE"]);
  const sortStyle = s =>
    s
      .split(";")
      .map(d => d.trim())
      .filter(Boolean)
      .sort()
      .join("; ");
  const norm = s =>
    s
      .replace(/(src|href)="\.\/assets\//g, '$1="assets/')
      .replace(/href="(?:app|brand)\.html#home"/g, 'href="#start"') // intended: the creator entry links
      .replace(/ style="([^"]*)"/g, (_, v) => ` style="${sortStyle(v)}"`) // declaration order is not observable
      .replace(/(class="mo-cell"[^>]*?) style="[^"]*opacity: 0[^"]*"/g, "$1"); // invisible indicator, measured on a timer
  const body = [...document.body.children]
    .filter(e => !skip.has(e.tagName))
    .map(e => norm(e.outerHTML))
    .join("\n");
  const fields = [...document.querySelectorAll("input,textarea,select")].map(
    (f, i) =>
      `${i}:${f.tagName}:${f.name || f.id || ""}=${f.type === "file" ? "" : f.value}|${f.checked ? 1 : 0}|${f.disabled ? 1 : 0}`,
  );
  const a = document.activeElement;
  const focus = a && a !== document.body ? `${a.tagName}.${a.className}#${a.id}` : "body";
  return {
    body,
    fields,
    focus,
    hash: location.hash,
    title: document.title.replace("Linkloom Homepage Final", "Linkloom"), // intended: artifact name in the tab
    scrollY: Math.round(scrollY),
    rootClass: document.documentElement.className,
  };
};

async function settle(page) {
  await page.evaluate(() => document.fonts.ready.then(() => 0));
  await page.evaluate(
    () =>
      new Promise(res => {
        const start = performance.now();
        const check = () => {
          const running = document.getAnimations().filter(an => {
            const t = an.effect && an.effect.getComputedTiming();
            return an.playState === "running" && t && t.iterations !== Infinity;
          });
          if (!running.length || performance.now() - start > 4000)
            requestAnimationFrame(() => requestAnimationFrame(() => res()));
          else setTimeout(check, 40);
        };
        setTimeout(check, 60);
      }),
  );
}

/* CDN and font responses are cached on disk: faster runs, and both sides get identical bytes. */
const CACHE = join(ROOT, ".parity-dist", ".http-cache");
async function cachedExternal(route) {
  const url = route.request().url();
  const f = join(CACHE, createHash("sha1").update(url).digest("hex"));
  try {
    const hit = JSON.parse(await readFile(f + ".json", "utf8"));
    return await route.fulfill({ status: 200, headers: hit, body: await readFile(f) });
  } catch {}
  try {
    const r = await route.fetch({ timeout: 30000 });
    const body = await r.body();
    const headers = { "content-type": r.headers()["content-type"] || "", "access-control-allow-origin": "*" };
    if (r.ok()) {
      await mkdir(CACHE, { recursive: true });
      await writeFile(f, body);
      await writeFile(f + ".json", JSON.stringify(headers));
    }
    await route.fulfill({ status: r.status(), headers, body });
  } catch {
    await route.abort().catch(() => {});
  }
}

async function openSide(browser, base, sc, motion, logs) {
  const vp = sc.viewport || "desktop";
  const ctx = await browser.newContext({
    viewport: VIEWPORTS[vp],
    reducedMotion: motion,
    hasTouch: vp === "phone",
    deviceScaleFactor: 1,
    locale: "en-IN",
    timezoneId: "Asia/Kolkata",
  });
  await ctx.route(u => u.protocol.startsWith("http") && u.hostname !== "127.0.0.1", cachedExternal);
  const page = await ctx.newPage();
  await page.clock.setFixedTime(FIXED_NOW);
  await page.addInitScript(() => {
    let seed = 1234567;
    Math.random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  });
  page.on("pageerror", e => logs.push("pageerror: " + e.message));
  page.on("console", m => {
    if (m.type() === "error" && !/Failed to load resource/.test(m.text()))
      logs.push("console.error: " + m.text());
  });
  page.on("response", r => {
    if (r.status() >= 400 && r.url().startsWith(new URL(base).origin))
      logs.push(`http ${r.status()}: ${new URL(r.url()).pathname}`);
  });
  const hash = "#" + (sc.route || sc.start || "");
  await page.goto(base + (sc.preset ? "" : hash), { waitUntil: "load" });
  if (sc.preset) {
    await page.evaluate(sc.preset);
    await page.evaluate(h => {
      if (location.hash === h) window.LLD.route();
      else location.hash = h;
    }, hash);
  }
  await settle(page);
  return { ctx, page };
}

const STEP = {
  async click(p, v) {
    await p.locator(v).first().click({ timeout: 5000 });
  },
  async dispatch(p, v) {
    await p.locator(v).first().dispatchEvent("click");
  },
  async fill(p, [s, val]) {
    await p.locator(s).first().fill(val, { timeout: 5000 });
  },
  async type(p, [s, val]) {
    await p.locator(s).first().pressSequentially(val, { timeout: 5000 });
  },
  async select(p, [s, val]) {
    await p.locator(s).first().selectOption(val, { timeout: 5000 });
  },
  async check(p, v) {
    await p.locator(v).first().check({ timeout: 5000, force: true });
  },
  async press(p, v) {
    await p.keyboard.press(v);
  },
  async hover(p, v) {
    await p.locator(v).first().hover({ timeout: 5000 });
  },
  async goto(p, v) {
    await p.evaluate(h => {
      location.hash = h;
    }, v);
  },
  async eval(p, v) {
    await p.evaluate(v);
  },
  async wait(p, v) {
    await p.waitForTimeout(v);
  },
  async file(p, [s, name]) {
    await p
      .locator(s)
      .first()
      .setInputFiles(join(HERE, "fixtures", name));
  },
  async scroll(p, v) {
    await p.evaluate(y => scrollTo(0, y), v);
  },
  async swipe(p, [s, dx]) {
    const b = await p.locator(s).first().boundingBox();
    const x = b.x + b.width / 2;
    const y = b.y + b.height / 2;
    await p.mouse.move(x, y);
    await p.mouse.down();
    for (let i = 1; i <= 8; i++) await p.mouse.move(x + (dx * i) / 8, y, { steps: 2 });
    await p.mouse.up();
  },
};

function firstDiff(a, b) {
  let i = 0;
  const n = Math.min(a.length, b.length);
  while (i < n && a[i] === b[i]) i++;
  const from = Math.max(0, i - 120);
  return `at char ${i}\n    prototype: …${a.slice(from, i + 200)}\n    build:     …${b.slice(from, i + 200)}`;
}

function diffSnap(x, y) {
  const out = [];
  if (x.body !== y.body) out.push("DOM " + firstDiff(x.body, y.body));
  for (const k of ["hash", "title", "scrollY", "focus", "rootClass"])
    if (x[k] !== y[k]) out.push(`${k}: prototype=${x[k]} build=${y[k]}`);
  const fa = x.fields.join("\n");
  const fb = y.fields.join("\n");
  if (fa !== fb) out.push("fields " + firstDiff(fa, fb));
  return out;
}

async function diffPixels(p1, p2, label) {
  const shot = p => p.screenshot({ fullPage: true, animations: "disabled", caret: "hide", timeout: 60000 });
  const [a, b] = await Promise.all([shot(p1), shot(p2)]);
  const A = PNG.sync.read(a);
  const B = PNG.sync.read(b);
  if (A.width !== B.width || A.height !== B.height)
    return [`pixels: size prototype=${A.width}x${A.height} build=${B.width}x${B.height}`];
  const D = new PNG({ width: A.width, height: A.height });
  const n = pixelmatch(A.data, B.data, D.data, A.width, A.height, { threshold: 0.05 });
  if (!n) return [];
  await mkdir(OUT, { recursive: true });
  const f = join(OUT, label.replace(/[^a-z0-9-]+/gi, "_") + ".png");
  await writeFile(f, PNG.sync.write(D));
  return [`pixels: ${n} differ, see ${f}`];
}

async function runScenario(browser, sides, sc, motion, pixels) {
  const problems = [];
  const logsA = [];
  const logsB = [];
  const label = `${sc.name} [${sc.viewport || "desktop"}${motion === "reduce" ? "" : ", motion"}]`;
  let A, B;
  try {
    [A, B] = await Promise.all([
      openSide(browser, sc.page ? sides[sc.page + "Proto"] : sides.proto, sc, motion, logsA),
      openSide(browser, sc.page ? sides[sc.page + "Build"] : sides.build, sc, motion, logsB),
    ]);
    /* A difference only counts if it survives re-settling: a real regression persists, an in-flight animation does not. */
    const compare = async tag => {
      let found = [];
      for (let attempt = 0; attempt < 4; attempt++) {
        if (attempt)
          await Promise.all([A.page.waitForTimeout(400 * attempt), B.page.waitForTimeout(400 * attempt)]);
        const [x, y] = await Promise.all([A.page.evaluate(SNAPSHOT), B.page.evaluate(SNAPSHOT)]);
        found = diffSnap(x, y);
        if (!found.length && pixels) found = await diffPixels(A.page, B.page, `${label}-${tag}`);
        if (!found.length) return;
      }
      found.forEach(d => problems.push(`${tag}: ${d}`));
    };
    await compare("start");
    let i = 0;
    for (const st of sc.steps || []) {
      i++;
      const [kind] = Object.keys(st);
      const tag = `step ${i} ${kind} ${JSON.stringify(st[kind]).slice(0, 60)}`;
      const [ra, rb] = await Promise.allSettled([STEP[kind](A.page, st[kind]), STEP[kind](B.page, st[kind])]);
      if (ra.status === "rejected")
        problems.push(
          `${tag}: step failed on the PROTOTYPE, fix the flow: ${String(ra.reason).split("\n")[0]}`,
        );
      if (rb.status === "rejected")
        problems.push(`${tag}: step failed on the BUILD: ${String(rb.reason).split("\n")[0]}`);
      if (ra.status === "rejected" || rb.status === "rejected") break;
      await Promise.all([settle(A.page), settle(B.page)]);
      await compare(tag);
      if (problems.length > 6) break;
    }
    logsB.filter(l => !logsA.includes(l)).forEach(l => problems.push("build only " + l));
    logsA.filter(l => !logsB.includes(l)).forEach(l => problems.push("prototype only " + l));
  } catch (e) {
    problems.push("crashed: " + String(e).split("\n")[0]);
  } finally {
    await A?.ctx.close();
    await B?.ctx.close();
  }
  return { label, problems };
}

async function loadFlows() {
  const dir = join(HERE, "flows");
  const out = [];
  for (const f of (await readdir(dir)).filter(f => f.endsWith(".mjs")).sort()) {
    const mod = await import(pathToFileURL(join(dir, f)).href);
    out.push(...mod.default.map(s => ({ ...s, name: `flow/${f.replace(".mjs", "")}/${s.name}` })));
  }
  return out;
}

const all = [...pageScenarios(), ...(await loadFlows())];
const picked = ONLY.length ? all.filter(s => ONLY.some(o => s.name.includes(o))) : all;
if (flag("list")) {
  picked.forEach(s => console.log(s.name, s.viewport || "desktop"));
  process.exit(0);
}

const dist = join(ROOT, ".parity-dist", String(process.pid));
const built = spawnSync(
  "npx",
  [
    "vite",
    "build",
    "--mode",
    "parity",
    "--outDir",
    `.parity-dist/${process.pid}`,
    "--emptyOutDir",
    "--logLevel",
    "error",
  ],
  { cwd: ROOT, stdio: "inherit", shell: true },
);
if (built.status) {
  console.error("BUILD FAILED");
  process.exit(2);
}
/* Machine-wide lock: this box has little free memory, so only one browser run at a time. Waiters queue; a dead holder is evicted. */
const LOCK = join(ROOT, ".parity-dist", ".lock");
async function acquireLock() {
  await mkdir(join(ROOT, ".parity-dist"), { recursive: true });
  let told = false;
  for (;;) {
    try {
      writeFileSync(LOCK, String(process.pid), { flag: "wx" });
      process.on("exit", () => {
        try {
          rmSync(LOCK);
        } catch {}
      });
      process.on("SIGINT", () => process.exit(130));
      process.on("SIGTERM", () => process.exit(143));
      return;
    } catch {
      let holder = 0;
      try {
        holder = Number(readFileSync(LOCK, "utf8"));
        process.kill(holder, 0);
      } catch {
        try {
          rmSync(LOCK);
        } catch {}
        continue;
      }
      if (!told) console.log(`waiting for parity lock held by pid ${holder}…`);
      told = true;
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

const protoSrv = await serve(join(ROOT, "prototype"));
const buildSrv = await serve(flag("aa") ? join(ROOT, "prototype") : dist); // --aa: prototype vs itself, measures gate noise
await acquireLock();
const SHELL = join(
  process.env.LOCALAPPDATA || "",
  "ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe",
);
const browser = await chromium.launch(existsSync(SHELL) ? { executablePath: SHELL } : { channel: "chrome" });
const landingSrv = await serve(join(ROOT, "prototype-landing"));
const brandSrv = await serve(join(ROOT, "prototype-brand"));
const sides = {
  proto: protoSrv.url,
  build: flag("aa") ? buildSrv.url : buildSrv.url + "app.html",
  landingProto: landingSrv.url,
  landingBuild: flag("aa") ? landingSrv.url : buildSrv.url,
  brandProto: brandSrv.url,
  brandBuild: flag("aa") ? brandSrv.url : buildSrv.url + "brand.html",
};

const jobs = [];
for (const s of picked) {
  jobs.push([s, "reduce", !flag("no-pixels") && s.pixels !== false]);
  if (!flag("no-full-motion") && s.fullMotion !== false) jobs.push([s, "no-preference", false]);
}
let cursor = 0;
let bad = 0;
const results = [];
await Promise.all(
  Array.from({ length: Number(opt("workers")) || 2 }, async () => {
    while (cursor < jobs.length) {
      const [s, m, px] = jobs[cursor++];
      let r = await runScenario(browser, sides, s, m, px);
      /* A difference must reproduce on fresh pages. Measured with --aa (prototype vs itself): about 5% of loads differ,
         in the top-bar badge raster (61 px) or the nav indicator's position, with identical code on both sides.
         A real regression repeats every time, so it still fails. --aa skips this to keep the measurement honest. */
      for (let retry = 0; !flag("aa") && r.problems.length && retry < 2; retry++)
        r = await runScenario(browser, sides, s, m, px);
      results.push(r);
      if (r.problems.length) {
        bad++;
        console.log(`FAIL ${r.label}\n  ${r.problems.join("\n  ")}`);
      }
    }
  }),
);
await browser.close();
protoSrv.close();
landingSrv.close();
brandSrv.close();
buildSrv.close();
await rm(dist, { recursive: true, force: true });
console.log(
  `\n${results.length - bad}/${results.length} parity runs identical${bad ? `, ${bad} FAILED` : ""}`,
);
process.exit(bad ? 1 : 0);
