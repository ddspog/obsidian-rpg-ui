#!/usr/bin/env node
/**
 * Screenshots of notes in the running cloud Obsidian (see scripts/cloud-obsidian.mjs),
 * on a desktop window and on Obsidian's phone UI, with a layout audit of each — the raw
 * material of a `/ui-review`. Run it before a change (`--label before`) and again
 * after (`--label after`) for the same notes, and the two sets line up.
 *
 *   node scripts/ui-review-capture.mjs --out tmp/ui-review --label before \
 *     --note "tales-of-the-valiant/adventuring/characters/Kowyn.md" \
 *     --note "tales-of-the-valiant/atlas/maps/Kowyn Encounter.md" \
 *     [--modes desktop,phone] [--desktop 1200x900] [--phone 390x844] \
 *     [--max 6] [--wait 3500] [--find ".rpg-caster"]
 *
 * Notes are vault paths (as `app.vault` knows them). `--find` scrolls to the first element
 * matching a CSS selector and shoots from there instead of from the top. Output:
 *   <out>/<label>/<mode>/<note-slug>_<n>.png   and   <out>/<label>/manifest.json
 * The manifest lists, per note and mode: the shots, content that runs past the window's
 * edge (horizontal overflow), tap targets under 32px, text under 9px, and console errors.
 */

/* global document, app, innerWidth, getComputedStyle -- these run inside the page, in `page.evaluate` */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const all = (name) => args.flatMap((a, i) => (a === name && args[i + 1] ? [args[i + 1]] : []));
const one = (name, d) => all(name)[0] ?? d;

const out = path.resolve(one("--out", "tmp/ui-review"));
const label = one("--label", "after");
const notes = all("--note");
const modes = one("--modes", "desktop,phone").split(",").filter(Boolean);
const size = (s) => s.split("x").map(Number);
const SIZES = { desktop: size(one("--desktop", "1200x900")), phone: size(one("--phone", "390x844")) };
const maxShots = Number(one("--max", "6"));
const wait = Number(one("--wait", "3500"));
const find = one("--find");
const port = Number(process.env.CDP_PORT ?? 9222);

if (notes.length === 0) {
  console.error('ui-review-capture: give at least one --note "<vault path>"');
  process.exit(2);
}

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

const connect = async () => {
  try {
    const browser = await chromium.connectOverCDP(`http://localhost:${port}`);
    return { browser, page: browser.contexts()[0].pages()[0] };
  } catch {
    console.error(
      `ui-review-capture: no Obsidian on port ${port}. Start one:\n` +
        "  npm run build && THEME_DIR=<theme checkout> RPG_VAULT_ROOT=<vault> node scripts/cloud-obsidian.mjs start"
    );
    process.exit(3);
  }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slug = (s) =>
  s
    .replace(/\.md$/, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

/** Switch Obsidian's phone emulation on or off; the app reloads, so reconnect after. */
async function setPhone(on) {
  let { page } = await connect();
  if ((await page.evaluate(() => document.body.classList.contains("is-mobile"))) === on) return page;
  page.evaluate((v) => app.emulateMobile(v), on).catch(() => {});
  await sleep(9000);
  ({ page } = await connect());
  return page;
}

const AUDIT = () => {
  const view = document.querySelector(".workspace-leaf.mod-active .markdown-preview-view");
  // The note's pane (the file explorer may take part of the window): content past its right edge.
  const W = view ? Math.round(view.getBoundingClientRect().right) : innerWidth;
  const name = (el) =>
    el.className && typeof el.className === "string"
      ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".")
      : el.tagName.toLowerCase();
  const inScroller = (el, root) => {
    for (let p = el.parentElement; p && p !== root; p = p.parentElement) {
      const o = getComputedStyle(p).overflowX;
      if (o === "auto" || o === "scroll" || o === "hidden" || o === "clip") return true;
    }
    return false;
  };
  const root = document.querySelector(".workspace-leaf.mod-active .markdown-preview-sizer") ?? document.body;
  const overflow = [];
  const small = [];
  const tiny = [];
  for (const el of root.querySelectorAll("*")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right > W + 2 && !inScroller(el, root) && overflow.length < 15)
      overflow.push(`${name(el)} right=${Math.round(r.right)} (pane edge ${W})`);
    const interactive = el.matches("button, a[href], input, select, [role=button], [role=tab]");
    if (interactive && (r.width < 32 || r.height < 32) && small.length < 15)
      small.push(
        `${name(el)} ${Math.round(r.width)}x${Math.round(r.height)} "${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 24)}"`
      );
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (
      el.childNodes.length &&
      [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) &&
      fs < 9 &&
      tiny.length < 10
    )
      tiny.push(`${name(el)} ${fs}px "${el.textContent.trim().slice(0, 24)}"`);
  }
  return { windowWidth: W, overflow, smallTargets: small, tinyText: tiny };
};

const manifest = { label, when: new Date().toISOString(), sizes: SIZES, shots: [] };

// Desktop first: the system bundle is cached by a desktop render, which the phone UI needs.
const order = ["desktop", "phone"].filter((m) => modes.includes(m));
for (const mode of order) {
  let page = await setPhone(mode === "phone");
  const [w, h] = SIZES[mode];
  const dir = path.join(out, label, mode);
  fs.mkdirSync(dir, { recursive: true });
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 200)));
  await page.setViewportSize({ width: w, height: h });
  for (const note of notes) {
    errors.length = 0;
    const exists = await page.evaluate((f) => !!app.vault.getAbstractFileByPath(f), note);
    if (!exists) {
      manifest.shots.push({ note, mode, error: "not found in the vault" });
      console.error(`  missing: ${note}`);
      continue;
    }
    await page.evaluate(async (f) => {
      await app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(f), { state: { mode: "preview" } });
    }, note);
    await sleep(wait);
    // Walk the note once so lazily rendered blocks exist before measuring. With --find the walk stops at
    // the first match, while it is rendered: Obsidian unloads sections that are far off the screen.
    const total = await page.evaluate(async (sel) => {
      const v = document.querySelector(".workspace-leaf.mod-active .markdown-preview-view");
      for (let y = 0; y < v.scrollHeight; y += 300) {
        v.scrollTop = y;
        await new Promise((r) => setTimeout(r, 120));
        const e = sel && document.querySelector(".workspace-leaf.mod-active " + sel);
        if (e) {
          v.scrollTop += e.getBoundingClientRect().top - v.getBoundingClientRect().top - 50;
          return [v.scrollHeight, v.clientHeight, true];
        }
      }
      v.scrollTop = 0;
      return [v.scrollHeight, v.clientHeight, false];
    }, find);
    if (find) {
      if (!total[2]) console.error(`  not found: ${find}`);
      await sleep(600);
    }
    const step = total[1] - 80;
    const start = await page.evaluate(
      () => document.querySelector(".workspace-leaf.mod-active .markdown-preview-view").scrollTop
    );
    const n = Math.max(1, Math.min(maxShots, Math.ceil((total[0] - start) / step)));
    const files = [];
    for (let k = 0; k < n; k++) {
      await page.evaluate(
        (y) => (document.querySelector(".workspace-leaf.mod-active .markdown-preview-view").scrollTop = y),
        start + k * step
      );
      await sleep(600);
      const file = path.join(dir, `${slug(note)}_${k}.png`);
      await page.screenshot({ path: file });
      files.push(path.relative(out, file).split(path.sep).join("/"));
    }
    const audit = await page.evaluate(AUDIT);
    manifest.shots.push({
      note,
      mode,
      files,
      pageHeight: total[0],
      ...audit,
      consoleErrors: [...new Set(errors)].slice(0, 5),
    });
    console.log(
      `${mode.padEnd(7)} ${note}: ${files.length} shot(s)${audit.overflow.length ? `, ${audit.overflow.length} overflow` : ""}${audit.smallTargets.length ? `, ${audit.smallTargets.length} small targets` : ""}`
    );
  }
}
if (order.includes("phone")) await setPhone(false);

fs.mkdirSync(path.join(out, label), { recursive: true });
fs.writeFileSync(path.join(out, label, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`manifest: ${path.join(out, label, "manifest.json")}`);
process.exit(0);
