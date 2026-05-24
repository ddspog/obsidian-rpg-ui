#!/usr/bin/env node
/**
 * migrate-items-v2.mjs
 *
 * Post-migration cleanup for files already converted by `migrate-items.mjs`:
 *   1. Remove `source:` from the `rpg item.element` fence body.
 *   2. Append the source string as a trailing markdown line
 *      (`**Source**: *…*`) after the fence.
 *
 * The user treats `source` as note-body prose, not fence data.
 *
 * Dry-run by default; pass `--write` to mutate.
 */

import { readFile, writeFile } from "node:fs/promises";
import { globSync } from "node:fs";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const ITEM_DIR = resolve(
  ROOT,
  "vault/tales-of-the-valiant/worldbuilding/items",
);
const WRITE = process.argv.includes("--write");

const FENCE_RE = /```rpg item\.element\n([\s\S]*?)```/;

function formatBody(body) {
  return stringifyYaml(body, {
    lineWidth: 0,
    defaultStringType: "PLAIN",
    defaultKeyType: "PLAIN",
  }).trimEnd();
}

async function migrate(path) {
  const raw = await readFile(path, "utf8");
  const match = raw.match(FENCE_RE);
  if (!match) return { changed: false };
  let body;
  try {
    body = parseYaml(match[1]) ?? {};
  } catch {
    return { changed: false };
  }
  if (body.source == null) return { changed: false };

  const source = body.source;
  delete body.source;
  const newFenceBody = formatBody(body);
  const newFence = `\`\`\`rpg item.element\n${newFenceBody}\n\`\`\``;
  const replaced = raw.replace(FENCE_RE, newFence);

  // Drop any pre-existing **Source** line so we don't double-append.
  const withoutOldFooter = replaced.replace(
    /^\s*\*\*Source\*\*:\s*\*[^\n]*\*\s*$/m,
    "",
  );
  const footer = `**Source**: *${source}*`;
  const trimmed = withoutOldFooter.trimEnd();
  const newContent = `${trimmed}\n\n${footer}\n`;

  if (newContent === raw) return { changed: false };
  if (WRITE) await writeFile(path, newContent, "utf8");
  return { changed: true };
}

async function main() {
  const files = globSync(`${ITEM_DIR}/**/*.md`);
  let changed = 0;
  for (const f of files) {
    const res = await migrate(f);
    if (res.changed) {
      changed++;
      console.log(`${WRITE ? "WROTE" : "dry"}  ${f}`);
    }
  }
  console.log(`\n${WRITE ? "Migrated" : "Would migrate"} ${changed} / ${files.length} files.`);
  if (!WRITE) console.log("(pass --write to mutate)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
