#!/usr/bin/env node
/**
 * Opens each built simulator in headless Chromium at phone size and fails on a page error, a console
 * error, or a simulator that never reports ready.   node simulators/check.mjs [id ...]
 * (needs Playwright; builds nothing: run `npm run sim:build` first)
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
function playwright() {
  for (const p of [
    "playwright",
    "/opt/node-tools/node_modules/playwright",
    "/opt/node22/lib/node_modules/playwright",
  ]) {
    try {
      return require(p);
    } catch {
      /* next */
    }
  }
  throw new Error("Playwright is not installed.");
}

const wanted = process.argv.slice(2);
const ids = fs
  .readdirSync(path.join(here, "dist"))
  .filter((f) => f.endsWith(".html"))
  .map((f) => f.slice(0, -5))
  .filter((id) => wanted.length === 0 || wanted.includes(id));
if (ids.length === 0) {
  console.error("Nothing built to check. Run `npm run sim:build` first.");
  process.exit(1);
}

const browser = await playwright().chromium.launch();
let failed = false;
for (const id of ids) {
  const page = await (
    await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  ).newPage();
  const problems = [];
  page.on("pageerror", (e) => problems.push(`page error: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && problems.push(`console error: ${m.text()}`));
  await page.goto(`file://${path.join(here, "dist", `${id}.html`)}`);
  const ready = await page
    .waitForFunction("window.__simulatorReady === true", null, { timeout: 20000 })
    .then(
      () => true,
      () => false
    );
  if (!ready) problems.push("never reported ready");
  const wide = await page.evaluate("document.documentElement.scrollWidth - window.innerWidth");
  if (wide > 1) problems.push(`page is ${wide}px wider than the screen`);
  console.log(`${problems.length ? "FAIL" : "ok  "} ${id}${problems.length ? `\n  ${problems.join("\n  ")}` : ""}`);
  failed ||= problems.length > 0;
  await page.context().close();
}
await browser.close();
process.exit(failed ? 1 : 0);
