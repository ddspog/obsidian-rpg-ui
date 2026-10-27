#!/usr/bin/env node
/**
 * Lists every text node's computed font size on the character sheets, with a selector and an
 * element count, on a desktop window and on Obsidian's phone UI — the measurement behind the
 * sheet's font-size scale (`--rpg-fs-*` in lib/styles/sheet-surface.css). Run it before and
 * after a change to a sheet's styles and compare the counts of distinct sizes.
 *
 *   node scripts/measure-font-sizes.mjs --label before [--out tmp/font-scale] \
 *     [--note "<vault path>"]... [--modes desktop,phone] [--desktop 1200x900] [--phone 390x844]
 *
 * Needs the cloud Obsidian running (scripts/cloud-obsidian.mjs start). Default notes: the four
 * character sheets of the testing vault. Writes <out>/<label>.json and prints a table.
 * Headings that come from the user's theme (h1 to h6 outside a sheet block, the inline title)
 * are listed but not counted: they are not ours to change. Compare two runs with
 *   node scripts/measure-font-sizes.mjs --compare before after
 */

/* global document, app, getComputedStyle -- these run inside the page, in `page.evaluate` */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const all = (name) => args.flatMap((a, i) => (a === name && args[i + 1] ? [args[i + 1]] : []));
const one = (name, d) => all(name)[0] ?? d;
const out = path.resolve(one("--out", "tmp/font-scale"));

const cmp = args.indexOf("--compare");
if (cmp >= 0) {
  const [a, b] = [args[cmp + 1], args[cmp + 2]].map((l) =>
    JSON.parse(fs.readFileSync(path.join(out, `${l}.json`), "utf8"))
  );
  console.log("note".padEnd(22), "mode".padEnd(8), "distinct before -> after (ours / with theme headings)");
  for (const r of a.results) {
    const s = b.results.find((x) => x.note === r.note && x.mode === r.mode);
    if (!s) continue;
    console.log(
      path.basename(r.note, ".md").padEnd(22),
      r.mode.padEnd(8),
      `${r.distinctOurs} -> ${s.distinctOurs}   (${r.distinctAll} -> ${s.distinctAll})`
    );
  }
  process.exit(0);
}

const label = one("--label", "run");
const DEFAULT_NOTES = ["Kowyn", "Lilith", "Jacqui Ilitul", "Talon Pallton"].map(
  (n) => `tales-of-the-valiant/adventuring/characters/${n}.md`
);
const notes = all("--note").length ? all("--note") : DEFAULT_NOTES;
const modes = one("--modes", "desktop,phone").split(",").filter(Boolean);
const size = (s) => s.split("x").map(Number);
const SIZES = { desktop: size(one("--desktop", "1200x900")), phone: size(one("--phone", "390x844")) };
const wait = Number(one("--wait", "3500"));
const port = Number(process.env.CDP_PORT ?? 9222);

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  for (const p of ["playwright", "/opt/node-tools/node_modules/playwright"]) {
    try {
      return require(p);
    } catch {
      // next
    }
  }
  throw new Error("playwright not found (expected in the cloud image)");
}
const { chromium } = loadPlaywright();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const connect = async () => {
  try {
    const browser = await chromium.connectOverCDP(`http://localhost:${port}`);
    return { browser, page: browser.contexts()[0].pages()[0] };
  } catch {
    console.error("measure-font-sizes: no Obsidian on port " + port + ". Run scripts/cloud-obsidian.mjs start first.");
    process.exit(3);
  }
};

/** Switch Obsidian's phone emulation on or off; the app reloads, so reconnect after. */
async function setPhone(on) {
  let { page } = await connect();
  if ((await page.evaluate(() => document.body.classList.contains("is-mobile"))) === on) return page;
  page.evaluate((v) => app.emulateMobile(v), on).catch(() => {});
  await sleep(9000);
  ({ page } = await connect());
  return page;
}

const MEASURE = () => {
  const view = document.querySelector(".workspace-leaf.mod-active .markdown-preview-view");
  const sizes = new Map(); // px -> { count, themed, groups: Map<selector, n>, blocks: Map<block, n>, sample }
  const blockOf = (el) => {
    const s = el.closest("section[aria-details]");
    if (s) return s.getAttribute("aria-details");
    const c = el.closest("[class*='rpg-']");
    return c ? "." + [...c.classList].find((x) => x.startsWith("rpg-")) : "(note)";
  };
  const sel = (el) => {
    let s = el.tagName.toLowerCase();
    const ad = el.getAttribute("aria-details");
    if (ad) s += `[aria-details="${ad}"]`;
    const cls = [...el.classList].filter((c) => !/^(is-|mod-|cm-|HyperMD)/.test(c)).slice(0, 2);
    if (cls.length) s += "." + cls.join(".");
    return s;
  };
  for (const el of view.querySelectorAll("*")) {
    if (el.hasAttribute("data-fsm") || !el.checkVisibility?.()) continue;
    const text = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).length;
    if (!text) continue;
    el.setAttribute("data-fsm", "");
    const px = Math.round(parseFloat(getComputedStyle(el).fontSize) * 1000) / 1000;
    const themed = /^H[1-6]$/.test(el.tagName) && !el.closest("section[aria-details], [class*='rpg-']");
    const e = sizes.get(px) ?? { count: 0, themed: 0, selectors: new Map(), blocks: new Map(), sample: "" };
    e.count++;
    if (themed) e.themed++;
    e.selectors.set(sel(el), (e.selectors.get(sel(el)) ?? 0) + 1);
    const b = themed ? "(theme heading)" : blockOf(el);
    e.blocks.set(b, (e.blocks.get(b) ?? 0) + 1);
    if (!e.sample) e.sample = el.textContent.trim().slice(0, 30);
    sizes.set(px, e);
  }
  const top = (m, n) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n);
  return [...sizes]
    .sort((a, b) => a[0] - b[0])
    .map(([px, e]) => ({
      px,
      count: e.count,
      themed: e.themed,
      blocks: Object.fromEntries(top(e.blocks, 6)),
      selectors: top(e.selectors, 5).map(([s, n]) => ({ selector: s, count: n })),
      sample: e.sample,
    }));
};

const results = [];
for (const mode of ["desktop", "phone"].filter((m) => modes.includes(m))) {
  const page = await setPhone(mode === "phone");
  await page.setViewportSize({ width: SIZES[mode][0], height: SIZES[mode][1] });
  for (const note of notes) {
    await page.evaluate(async (f) => {
      await app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(f), { state: { mode: "preview" } });
    }, note);
    await sleep(wait);
    // Obsidian only keeps the sections near the viewport in the DOM: measure at every stop of a
    // walk down the note, marking what was counted so a section seen twice counts once.
    const merged = new Map();
    const total = await page.evaluate(
      () => document.querySelector(".workspace-leaf.mod-active .markdown-preview-view").scrollHeight
    );
    const step = Math.max(200, SIZES[mode][1] / 2);
    for (let y = 0; y <= total; y += step) {
      await page.evaluate(
        (y) => (document.querySelector(".workspace-leaf.mod-active .markdown-preview-view").scrollTop = y),
        y
      );
      await sleep(350);
      for (const r of await page.evaluate(MEASURE)) {
        const m = merged.get(r.px);
        if (!m) merged.set(r.px, r);
        else {
          m.count += r.count;
          m.themed += r.themed;
          for (const [b, n] of Object.entries(r.blocks)) m.blocks[b] = (m.blocks[b] ?? 0) + n;
          for (const q of r.selectors) {
            const e = m.selectors.find((x) => x.selector === q.selector);
            if (e) e.count += q.count;
            else m.selectors.push(q);
          }
        }
      }
    }
    await page.evaluate(() => {
      document.querySelectorAll("[data-fsm]").forEach((e) => e.removeAttribute("data-fsm"));
      document.querySelector(".workspace-leaf.mod-active .markdown-preview-view").scrollTop = 0;
    });
    const list = [...merged.values()].sort((a, b) => a.px - b.px);
    const ours = list.filter((r) => r.count > r.themed);
    results.push({
      note,
      mode,
      distinctAll: list.length,
      distinctOurs: ours.length,
      sizes: list,
    });
    console.log(
      `${mode.padEnd(7)} ${path.basename(note, ".md").padEnd(15)} ${String(ours.length).padStart(2)} distinct sizes (${list.length} with theme headings): ${ours.map((r) => `${r.px}(${r.count})`).join(" ")}`
    );
  }
}
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(
  path.join(out, `${label}.json`),
  JSON.stringify({ label, when: new Date().toISOString(), results }, null, 2)
);
console.log(`wrote ${path.join(out, label + ".json")}`);
// The CDP connection keeps node alive; the work is done.
process.exit(0);
