#!/usr/bin/env node
/**
 * Builds the review board of a `/ui-review`: one self-contained HTML page with a card per
 * finding — before and after pictures side by side, a verdict (Do it / Maybe / Skip), a star
 * rating and a note — and a "Copy feedback" button that the owner pastes back.
 *
 *   node scripts/ui-review-board.mjs findings.json out.html
 *
 * findings.json:
 *   { "title": "Phone review: character sheet",
 *     "intro": "Goal: mobile fit. …",
 *     "groups": [ { "name": "Character sheet",
 *       "items": [ { "id": "skills", "title": "Skills take two screens",
 *                    "lens": "adapt", "severity": "P1",
 *                    "description": "What is wrong, where, and for whom.",
 *                    "suggestion": "The change proposed.",
 *                    "before": [ { "image": "before/phone/kowyn_1.png", "caption": "Phone, before" } ],
 *                    "after":  [ { "image": "after/phone/kowyn_1.png",  "caption": "Phone, after" } ] } ] } ] }
 *
 * Image paths are relative to the findings file. Pictures are shrunk to 900px wide JPEGs and
 * inlined (in a headless browser: no image library needed), so the page is one file to publish.
 * An item with no `after` is a suggestion not yet made; with no `before`, something new.
 */

/* global document, Image -- these run inside the page, in `page.evaluate` */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const [findingsPath, outPath] = process.argv.slice(2);
if (!findingsPath || !outPath) {
  console.error("usage: node scripts/ui-review-board.mjs findings.json out.html");
  process.exit(2);
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const template = fs.readFileSync(path.join(root, ".claude/commands/ui-review/board-template.html"), "utf8");
const findings = JSON.parse(fs.readFileSync(findingsPath, "utf8"));
const baseDir = path.dirname(path.resolve(findingsPath));

const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

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

const browser = await loadPlaywright().chromium.launch();
const page = await browser.newPage();
const cache = new Map();
/** A picture as a small JPEG data URL. */
async function inline(file) {
  const full = path.resolve(baseDir, file);
  if (cache.has(full)) return cache.get(full);
  if (!fs.existsSync(full)) {
    console.error(`  missing picture: ${file}`);
    cache.set(full, "");
    return "";
  }
  const ext = path.extname(full).slice(1).toLowerCase().replace("jpg", "jpeg");
  const src = `data:image/${ext};base64,${fs.readFileSync(full).toString("base64")}`;
  const url = await page.evaluate(
    async ([data, max]) => {
      const img = new Image();
      img.src = data;
      await img.decode();
      const k = Math.min(1, max / img.naturalWidth);
      const c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * k);
      c.height = Math.round(img.naturalHeight * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL("image/jpeg", 0.8);
    },
    [src, 900]
  );
  cache.set(full, url);
  return url;
}

const side = async (label, list) => {
  if (!list?.length) {
    const why =
      label === "Before"
        ? "Nothing to compare: this is new, or no picture was taken."
        : "Not made yet: a suggestion to decide on.";
    return `<div class="side none"><span class="lab">${label}</span><p>${why}</p></div>`;
  }
  const figs = [];
  let wide = false;
  for (const f of list) {
    const url = await inline(f.image);
    if (!url) continue;
    const isWide =
      (await page.evaluate(
        (u) =>
          new Promise((r) => {
            const i = new Image();
            i.onload = () => r(i.naturalWidth > 600);
            i.src = u;
          }),
        url
      )) === true;
    wide ||= isWide;
    figs.push(
      `<figure class="${isWide ? "wide" : ""}"><img src="${url}" alt="${esc(f.caption)}" loading="lazy"><figcaption>${esc(f.caption)}</figcaption></figure>`
    );
  }
  return `<div class="side${wide ? " wide" : ""}"><span class="lab">${label}</span><div class="figs">${figs.join("")}</div></div>`;
};

let count = 0;
const groups = [];
for (const g of findings.groups ?? []) {
  const cards = [];
  for (const it of g.items ?? []) {
    count++;
    const id = esc(it.id ?? `i${count}`);
    const sev = it.severity ? `<span class="sev ${esc(it.severity.toLowerCase())}">${esc(it.severity)}</span>` : "";
    const lens = it.lens ? `<span class="lens">${esc(it.lens)}</span>` : "";
    const pr = it.pr ? `<span class="pr">${esc(it.pr)}</span>` : "";
    const stars = [1, 2, 3, 4, 5]
      .map(
        (i) =>
          `<label><input type="radio" name="r-${id}" value="${i}"><span aria-hidden="true">★</span><span class="sr">${i} of 5</span></label>`
      )
      .join("");
    const verdict = ["Do it", "Maybe", "Skip"]
      .map((v) => `<label><input type="radio" name="v-${id}" value="${v}"><span>${v}</span></label>`)
      .join("");
    cards.push(`<article class="item" data-id="${id}" data-title="${esc(it.title)}">
<header><span class="meta">${sev}${lens}${pr}</span><h3>${esc(it.title)}</h3></header>
<p class="desc">${esc(it.description)}</p>
${it.suggestion ? `<p class="fix"><b>Suggestion.</b> ${esc(it.suggestion)}</p>` : ""}
<div class="pair">${await side("Before", it.before)}${await side("After", it.after)}</div>
<div class="fb"><fieldset class="verdict"><legend>Verdict</legend>${verdict}</fieldset>
<fieldset class="stars" aria-label="Rating for ${esc(it.title)}"><legend>Rating</legend>${stars}<button type="button" class="clear" data-clear="${id}">Clear</button></fieldset>
<label class="cm"><span>Comment</span><textarea id="c-${id}" rows="2" placeholder="Anything to change, keep, or drop?"></textarea></label></div>
</article>`);
  }
  groups.push(`<section><h2>${esc(g.name)}</h2><div class="list">${cards.join("\n")}</div></section>`);
}
await browser.close();

const html = template
  .replaceAll("{{TITLE}}", esc(findings.title ?? "UI review"))
  .replace("{{INTRO}}", esc(findings.intro ?? ""))
  .replace("{{GROUPS}}", groups.join("\n"))
  .replaceAll("{{COUNT}}", String(count));
fs.writeFileSync(outPath, html);
console.log(`${outPath}: ${count} finding(s), ${Math.round(html.length / 1024)} KB`);
