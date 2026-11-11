#!/usr/bin/env node
/**
 * An import's tables against a book already adapted by hand: how many of the vault's tables the
 * import found (by caption, `Table 2-3:` and punctuation aside), how many have the same number of
 * rows, and how many of the vault's rollable tables came out rollable.
 *
 *   node scripts/pdf-import-compare.mjs <import folder> <vault folder> [<vault folder> …] [-v]
 *
 * e.g. the Nomicon: out/nomicon  $VAULT/tales-of-the-valiant/compendium/the-nomicon
 *                                $VAULT/tales-of-the-valiant/gm-tools/tables/the-nomicon
 * `-v` lists the captions not found, the row counts that differ and the tables not rollable.
 */
import fs from "fs";
import path from "path";

const args = process.argv.slice(2);
const verbose = args.includes("-v");
const [imported, ...vault] = args.filter((a) => a !== "-v");
if (!imported || !vault.length) {
  console.error("usage: pdf-import-compare.mjs <import folder> <vault folder> [<vault folder> …] [-v]");
  process.exit(2);
}

const key = (caption) =>
  caption
    .trim()
    .replace(/^table\s+[\dA-Za-z]+(-\d+)?[a-z]?\s*[:.]?\s*/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

function* notes(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* notes(full);
    else if (entry.name.endsWith(".md")) yield full;
  }
}

/** Every `rpg table` under the folders, by caption; tables without one under `#<id>`. */
function tables(dirs) {
  const out = new Map();
  for (const dir of dirs)
    for (const file of notes(dir)) {
      const text = fs.readFileSync(file, "utf8");
      for (const m of text.matchAll(/```+rpg table\.([^\n]*)\n([\s\S]*?)\n```/g)) {
        const body = m[2].split("\n");
        const rows = body.filter((l) => l.startsWith("|") && !/^\|(\s*:?-+:?\s*\|)+$/.test(l) && !l.startsWith("|="));
        const caption = body.find((l) => /^\[.*\]$/.test(l))?.slice(1, -1);
        const table = {
          caption,
          rows: rows.length - 1,
          rollable: body.some((l) => l.startsWith("|=") && l.includes("roll")),
          // Several rows a line: the vault's row count says nothing.
          packed: body.some((l) => l.startsWith("@pack")),
        };
        const k = caption ? key(caption) : `#${m[1]}`;
        if (!out.has(k)) out.set(k, table);
        out.get(k).count = (out.get(k).count ?? 0) + 1;
      }
    }
  return out;
}

const mine = tables([imported]);
const theirs = tables(vault);
const named = [...theirs].filter(([k]) => !k.startsWith("#"));
const found = named.filter(([k]) => mine.has(k));
const plain = found.filter(([, t]) => !t.packed);
const same = plain.filter(([k, t]) => mine.get(k).rows === t.rows);
const rollable = found.filter(([, t]) => t.rollable);
const rolled = rollable.filter(([k]) => mine.get(k).rollable);
const total = (map) => [...map.values()].reduce((n, t) => n + t.count, 0);
const unnamed = [...mine].filter(([k]) => k.startsWith("#")).reduce((n, [, t]) => n + t.count, 0);

console.log(`vault: ${total(theirs)} tables, ${named.length} captions`);
console.log(`import: ${total(mine)} tables, ${unnamed} without a caption`);
console.log(`captions found: ${found.length}/${named.length}`);
console.log(
  `same row count: ${same.length}/${plain.length}` +
    (found.length > plain.length ? ` (${found.length - plain.length} packed in the vault, not counted)` : "")
);
console.log(`rollable: ${rolled.length}/${rollable.length}`);
if (verbose) {
  const list = (title, items) => console.log(`\n${title} (${items.length})\n` + items.map((i) => `  ${i}`).join("\n"));
  list(
    "Not found",
    named.filter(([k]) => !mine.has(k)).map(([, t]) => t.caption)
  );
  list(
    "Rows differ (vault, import)",
    plain
      .filter(([k, t]) => mine.get(k).rows !== t.rows)
      .map(([k, t]) => `${t.caption}: ${t.rows}, ${mine.get(k).rows}`)
  );
  list(
    "Not rollable",
    rollable.filter(([k]) => !mine.get(k).rollable).map(([, t]) => t.caption)
  );
}
