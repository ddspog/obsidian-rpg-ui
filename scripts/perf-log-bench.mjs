/* global window, document, app, requestAnimationFrame */
// Measures opening a note: open→settled time, long tasks, scroll frame times, console warnings.
// usage: node scripts/perf-log-bench.mjs "<note path>" [runs] [--profile out.cpuprofile]
// MOBILE=1 VIEWPORT=390x844 for the phone UI.
import { createRequire } from "node:module";
import fs from "node:fs";

const require = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const p of ["playwright", "/opt/node-tools/node_modules/playwright"]) {
    try {
      return require(p);
    } catch {
      // try next location
    }
  }
  throw new Error("playwright not found");
})();

const note = process.argv[2];
const runs = Number(process.argv[3] ?? 3);
const profIdx = process.argv.indexOf("--profile");
const profOut = profIdx > 0 ? process.argv[profIdx + 1] : null;
const [vw, vh] = (process.env.VIEWPORT ?? "1200x900").split("x").map(Number);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function connect() {
  const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
  const page =
    browser
      .contexts()[0]
      .pages()
      .find((p) => !p.url().startsWith("devtools")) ?? browser.contexts()[0].pages()[0];
  return { browser, page };
}
let { browser, page } = await connect();
const wantMobile = process.env.MOBILE === "1";
if (wantMobile !== (await page.evaluate(() => document.body.classList.contains("is-mobile")))) {
  page.evaluate((on) => setTimeout(() => app.emulateMobile(on), 0), wantMobile).catch(() => {});
  await sleep(1500);
  await browser.close();
  ({ browser, page } = await connect());
  await page.waitForFunction(() => globalThis.app?.plugins?.plugins?.["dnd-ui-toolkit"], null, { timeout: 30000 });
}
await page.setViewportSize({ width: vw, height: vh });
await page.evaluate(() => app.workspace.leftSplit?.collapse());
const warnings = new Set();
page.on("console", (m) => {
  if (m.type() === "warning" || m.type() === "error") warnings.add(m.text().slice(0, 160));
});
const cdp = await page.context().newCDPSession(page);

const results = [];
for (let i = -1; i < runs; i++) {
  // run -1 is a warm-up (plugin bundles load)
  // open something else so the target is a cold open
  await page.evaluate(async () => {
    const other = app.vault.getMarkdownFiles().find((f) => f.path.includes("GM Screen"));
    await app.workspace.getLeaf(false).openFile(other, { state: { mode: "preview" } });
  });
  await sleep(1500);
  await page.evaluate(() => {
    window.__lt = [];
    window.__po?.disconnect();
    window.__po = new PerformanceObserver((l) =>
      l.getEntries().forEach((e) => window.__lt.push([e.startTime, e.duration]))
    );
    window.__po.observe({ entryTypes: ["longtask"] });
  });
  if (profOut && i === 0) {
    await cdp.send("Profiler.enable");
    await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
    await cdp.send("Profiler.start");
  }
  const r = await page.evaluate(async (f) => {
    const file = app.vault.getAbstractFileByPath(f);
    const t0 = performance.now();
    const p = app.workspace.getLeaf(false).openFile(file, { state: { mode: "preview" } });
    let first = 0,
      last = 0,
      lastCount = -1,
      lastChange = t0;
    await p;
    await new Promise((res) => {
      const tick = () => {
        const root = document.querySelector(".workspace-leaf.mod-active .markdown-preview-sizer");
        const nodes = root ? root.querySelectorAll("*").length : 0;
        const now = performance.now();
        const rpg = root ? root.querySelectorAll("[class*='rpg-'],[class*='lonelog-']").length : 0;
        if (!first && root?.querySelector(".lonelog-prose-beat, .lonelog-prose-scene")) first = now - t0;
        const sig = nodes + ":" + rpg;
        if (sig !== lastCount) {
          lastCount = sig;
          lastChange = now;
          last = now - t0;
        }
        if (now - lastChange > 600 || now - t0 > 15000) return res();
        setTimeout(tick, 16);
      };
      tick();
    });
    return {
      firstContent: Math.round(first),
      settled: Math.round(last),
      nodes: document.querySelectorAll(".workspace-leaf.mod-active *").length,
      sizerNodes: document.querySelector(".workspace-leaf.mod-active .markdown-preview-sizer")?.querySelectorAll("*")
        .length,
      lt: window.__lt.filter((x) => x[0] >= t0),
      t0,
    };
  }, note);
  if (profOut && i === 0) {
    const { profile } = await cdp.send("Profiler.stop");
    fs.writeFileSync(profOut, JSON.stringify(profile));
  }
  const settledAbs = r.t0 + r.settled;
  const lt = r.lt.filter((x) => x[0] <= settledAbs + 700);
  // scroll jank
  const sc = await page.evaluate(async () => {
    const el = document.querySelector(".workspace-leaf.mod-active .markdown-preview-view");
    const frames = [];
    let prev = performance.now();
    let running = true;
    const loop = () => {
      const n = performance.now();
      frames.push(n - prev);
      prev = n;
      if (running) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    const max = el.scrollHeight - el.clientHeight;
    const steps = 120;
    for (let s = 1; s <= steps; s++) {
      el.scrollTop = (max * s) / steps;
      await new Promise((r) => requestAnimationFrame(r));
    }
    running = false;
    frames.sort((a, b) => a - b);
    return {
      p95: Math.round(frames[Math.floor(frames.length * 0.95)]),
      over50: frames.filter((f) => f > 50).length,
      scrollH: max,
    };
  });
  const row = {
    firstContent: r.firstContent,
    settled: r.settled,
    longTasks: lt.length,
    longTotal: Math.round(lt.reduce((a, x) => a + x[1], 0)),
    longMax: Math.round(Math.max(0, ...lt.map((x) => x[1]))),
    p95: sc.p95,
    over50: sc.over50,
    nodes: r.nodes,
    sizer: r.sizerNodes,
  };
  if (i >= 0) results.push(row);
  console.log(i < 0 ? "warm-up " : "", JSON.stringify(row));
}
const med = (k) => {
  const v = results.map((r) => r[k]).sort((a, b) => a - b);
  return v[Math.floor(v.length / 2)];
};
console.log("MEDIAN", JSON.stringify(Object.fromEntries(Object.keys(results[0]).map((k) => [k, med(k)]))));
console.log("warnings:", [...warnings]);
await browser.close();
