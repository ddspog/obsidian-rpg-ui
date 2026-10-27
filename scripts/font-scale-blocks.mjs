#!/usr/bin/env node
/**
 * One picture per sheet block (banner, health, stats, senses, skills, rolls, proficiencies,
 * features, spells, inventory, description) of a character note, on a desktop window and on
 * Obsidian's phone UI, for the before/after pairs of the font-size scale. Also records each
 * block's size and whether anything in it wraps oddly or clips (scrollWidth > clientWidth).
 *
 *   node scripts/font-scale-blocks.mjs --label before [--out tmp/font-scale/blocks] \
 *     [--note "<vault path>"] [--modes desktop,phone]
 *
 * Writes <out>/<label>/<mode>/<note>/<block>.png and <out>/<label>/blocks.json.
 */

/* global document, app, getComputedStyle -- these run inside the page, in `page.evaluate` */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const all = (name) => args.flatMap((a, i) => (a === name && args[i + 1] ? [args[i + 1]] : []));
const one = (name, d) => all(name)[0] ?? d;
const label = one("--label", "run");
const out = path.resolve(one("--out", "tmp/font-scale/blocks"));
const notes = all("--note").length ? all("--note") : ["tales-of-the-valiant/adventuring/characters/Kowyn.md"];
const modes = one("--modes", "desktop,phone").split(",").filter(Boolean);
const SIZES = { desktop: [1200, 900], phone: [390, 844] };
const port = Number(process.env.CDP_PORT ?? 9222);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slug = (s) =>
  s
    .replace(/\.md$/, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

const require = createRequire(import.meta.url);
let chromium;
for (const p of ["playwright", "/opt/node-tools/node_modules/playwright"]) {
  try {
    ({ chromium } = require(p));
    break;
  } catch {
    // next
  }
}
const connect = async () => {
  const browser = await chromium.connectOverCDP(`http://localhost:${port}`);
  return browser.contexts()[0].pages()[0];
};
async function setPhone(on) {
  let page = await connect();
  if ((await page.evaluate(() => document.body.classList.contains("is-mobile"))) === on) return page;
  page.evaluate((v) => app.emulateMobile(v), on).catch(() => {});
  await sleep(9000);
  return connect();
}

// The sheet's blocks: top-level elements carrying aria-details (sections and the page-title figure).
const LIST = () => {
  const view = document.querySelector(".workspace-leaf.mod-active .markdown-preview-view");
  const els = [
    ...view.querySelectorAll("section[aria-details], figure[aria-details='Page Title'], .rpg-inventory-block"),
  ].filter((e) => !e.parentElement.closest("section[aria-details], .rpg-inventory-block"));
  els.forEach((e, i) => e.setAttribute("data-fs-block", String(i)));
  return els.map((e, i) => ({ i, name: e.getAttribute("aria-details") ?? "Inventory" }));
};
// Per-block layout facts: clipped text, and lines that wrap (text boxes taller than 1.8 lines).
const FACTS = (i) => {
  const el = document.querySelector(`[data-fs-block="${i}"]`);
  const clipped = [];
  for (const e of el.querySelectorAll("*")) {
    if (e.scrollWidth > e.clientWidth + 1 && e.clientWidth > 0 && getComputedStyle(e).overflowX !== "visible") {
      clipped.push(
        `${e.tagName.toLowerCase()}.${[...e.classList].slice(0, 2).join(".")} ${e.scrollWidth}>${e.clientWidth}`
      );
    }
  }
  const r = el.getBoundingClientRect();
  return { width: Math.round(r.width), height: Math.round(r.height), clipped: clipped.slice(0, 10) };
};

const manifest = { label, blocks: [] };
for (const mode of modes) {
  const page = await setPhone(mode === "phone");
  await page.setViewportSize({ width: SIZES[mode][0], height: SIZES[mode][1] });
  for (const note of notes) {
    await page.evaluate(async (f) => {
      await app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(f), { state: { mode: "preview" } });
    }, note);
    await sleep(3500);
    const total = await page.evaluate(
      () => document.querySelector(".workspace-leaf.mod-active .markdown-preview-view").scrollHeight
    );
    const dir = path.join(out, label, mode, slug(path.basename(note)));
    fs.mkdirSync(dir, { recursive: true });
    // Obsidian only keeps the sections near the viewport in the DOM: shoot each block as it appears.
    const done = new Set();
    for (let y = 0; y <= total; y += SIZES[mode][1] / 2) {
      await page.evaluate(
        (y) => (document.querySelector(".workspace-leaf.mod-active .markdown-preview-view").scrollTop = y),
        y
      );
      await sleep(400);
      for (const b of await page.evaluate(LIST)) {
        if (done.has(b.name)) continue;
        const loc = page.locator(`[data-fs-block="${b.i}"]`);
        const file = `${String(done.size + 1).padStart(2, "0")}-${slug(b.name)}.png`;
        try {
          await page.evaluate(
            (i) => document.querySelector(`[data-fs-block="${i}"]`)?.scrollIntoView({ block: "start" }),
            b.i
          );
          await sleep(350);
          await loc.screenshot({ path: path.join(dir, file), timeout: 8000 });
        } catch {
          continue; // virtualised away while scrolling: the next stop lists it again
        }
        done.add(b.name);
        const facts = await page.evaluate(FACTS, b.i).catch(() => ({ width: 0, height: 0, clipped: [] }));
        manifest.blocks.push({ note, mode, name: b.name, file: path.relative(out, path.join(dir, file)), ...facts });
      }
    }
    const blocks = [...done];
    console.log(`${mode} ${path.basename(note)}: ${blocks.length} blocks`);
  }
}
fs.mkdirSync(path.join(out, label), { recursive: true });
fs.writeFileSync(path.join(out, label, "blocks.json"), JSON.stringify(manifest, null, 2));
console.log(`wrote ${path.join(out, label, "blocks.json")}`);
// The CDP connection keeps node alive; the work is done.
process.exit(0);
