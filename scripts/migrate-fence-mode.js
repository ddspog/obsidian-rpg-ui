#!/usr/bin/env node
/**
 * Migrate rpg blocks from YAML `content:`/`text:` fields to fence mode.
 * Dry-run by default — pass --apply to write changes.
 */
const fs = require("fs");
const path = require("path");

const VAULT = path.resolve(__dirname, "../../../..");
const DRY_RUN = !process.argv.includes("--apply");

let totalChanges = 0;

function findMdFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.name === ".obsidian" || entry.name === "node_modules") continue;
    if (entry.isDirectory()) results.push(...findMdFiles(full));
    else if (entry.name.endsWith(".md")) results.push(full);
  }
  return results;
}

function migrateRuleSide(source) {
  const lines = source.split("\n");
  const contentLineIdx = lines.findIndex(l => /^content:\s*\|/.test(l));
  if (contentLineIdx < 0) return null;

  const nextLine = lines[contentLineIdx + 1];
  if (!nextLine) return null;
  const indent = nextLine.match(/^(\s+)/)?.[1]?.length ?? 2;

  const yamlBefore = lines.slice(0, contentLineIdx);
  const bodyLines = [];

  for (let i = contentLineIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") {
      bodyLines.push("");
    } else if (line.startsWith(" ".repeat(indent))) {
      bodyLines.push(line.slice(indent));
    } else {
      yamlBefore.push(...lines.slice(i));
      break;
    }
  }

  const body = bodyLines.join("\n").replace(/^\n+/, "").replace(/\n+$/, "");
  if (!body) return null;

  return yamlBefore.join("\n") + "\n---\n" + body;
}

function migrateTextField(source) {
  const lines = source.split("\n");
  const textLineIdx = lines.findIndex(l => /^text:\s/.test(l));
  if (textLineIdx < 0) return null;

  const textLine = lines[textLineIdx];
  const isMultiLine = /^text:\s*\|/.test(textLine);

  const yamlBefore = lines.slice(0, textLineIdx);
  let body = "";

  if (isMultiLine) {
    const nextLine = lines[textLineIdx + 1];
    if (!nextLine) return null;
    const indent = nextLine.match(/^(\s+)/)?.[1]?.length ?? 2;
    const bodyLines = [];

    for (let i = textLineIdx + 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() === "") {
        bodyLines.push("");
      } else if (line.startsWith(" ".repeat(indent))) {
        bodyLines.push(line.slice(indent));
      } else {
        yamlBefore.push(...lines.slice(i));
        break;
      }
    }

    body = bodyLines.join("\n").replace(/^\n+/, "").replace(/\n+$/, "");
  } else {
    // Single-line: text: Some value here
    body = textLine.replace(/^text:\s*/, "").trim();
    // Check if there are fields after text:
    const remaining = lines.slice(textLineIdx + 1);
    if (remaining.some(l => /^[a-zA-Z_]/.test(l))) {
      yamlBefore.push(...remaining);
    }
  }

  if (!body) return null;

  return yamlBefore.join("\n") + "\n---\n" + body;
}

function processFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const relPath = path.relative(VAULT, filePath);

  // Find all rpg fences
  // Find all rpg fences (3+ backticks)
  const fenceRe = /(`{3,})(rpg\s+\S+)\s*\n([\s\S]*?)\1/g;
  let changed = false;
  let newContent = content;

  const replacements = [];

  let match;
  while ((match = fenceRe.exec(content)) !== null) {
    const meta = match[2].trim();
    const source = match[3];
    const backticks = match[1];
    let migrated = null;

    if (meta === "rpg rule.side") {
      migrated = migrateRuleSide(source);
    } else if (meta === "rpg feature.choice" || meta === "rpg feature.details" || meta === "rpg spell") {
      migrated = migrateTextField(source);
    }

    if (migrated && migrated !== source) {
      replacements.push({
        original: match[0],
        replacement: backticks + meta + "\n" + migrated + "\n" + backticks,
        meta,
      });
    }
  }

  if (replacements.length > 0) {
    for (const r of replacements) {
      newContent = newContent.replace(r.original, r.replacement);
    }
    totalChanges += replacements.length;

    if (DRY_RUN) {
      console.log(`\n📄 ${relPath} (${replacements.length} block(s)):`);
      for (const r of replacements) {
        console.log(`   ✓ ${r.meta}`);
      }
    } else {
      fs.writeFileSync(filePath, newContent, "utf8");
      console.log(`✅ ${relPath} — ${replacements.length} block(s) migrated`);
    }
  }
}

console.log(DRY_RUN ? "🔍 DRY RUN — no files changed\n" : "⚡ APPLYING changes\n");

const files = findMdFiles(VAULT);
for (const f of files) {
  processFile(f);
}

console.log(`\n${DRY_RUN ? "Would change" : "Changed"}: ${totalChanges} block(s)`);
if (DRY_RUN) console.log("\nRun with --apply to write changes.");
