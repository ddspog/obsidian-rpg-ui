#!/usr/bin/env node
/**
 * sync-vault.mjs — keep the plugin's `vault/` folder and the Obsidian vault
 * root in lockstep.
 *
 * The plugin's source-of-truth content lives in:
 *   .obsidian/plugins/obsidian-rpg-ui/vault/systems/<system>/{config,compendium}/
 *
 * Obsidian, however, only sees files at the vault root:
 *   systems/<system>/{config,compendium}/
 *
 * These two locations have historically drifted (e.g. a Cleric.md edit on one
 * side never reaches the other). This script reconciles them with a
 * **bidirectional, newest-mtime-wins** strategy so neither side silently
 * loses authored content.
 *
 * Scope: every `<system>/config/` and `<system>/compendium/` directory found
 *        on either side. Files outside those two prefixes are ignored.
 *
 * Usage:
 *   npm run sync                # sync (apply changes)
 *   npm run sync -- --dry-run   # show what would change without writing
 *   npm run sync -- --verbose   # also list unchanged files
 *
 * Direction overrides (skip the mtime comparison):
 *   --push   plugin → vault root only (overwrite vault root with plugin copy)
 *   --pull   vault root → plugin only (overwrite plugin copy with vault root)
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import url from "node:url";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pluginRoot = path.resolve(__dirname, "..");
const vaultRoot = path.resolve(pluginRoot, "../../..");

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");
const VERBOSE = args.has("--verbose");
const PUSH_ONLY = args.has("--push");
const PULL_ONLY = args.has("--pull");

if (PUSH_ONLY && PULL_ONLY) {
  console.error("Error: --push and --pull are mutually exclusive");
  process.exit(1);
}

// Sync only these directories under each system folder. The legacy
// `compendium/` tree is intentionally absent — its content moved to
// `worldbuilding/traits/` and `glossary/` and the folder itself should
// stay deleted on both sides. `adventurers/` holds sample character
// files that consume the system, so they sync alongside the compendium
// they reference.
const SYNC_SUBDIRS = ["config", "worldbuilding", "glossary", "adventurers"];

function fmtCount(n, label) {
  return `${n} ${label}${n === 1 ? "" : "s"}`;
}

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function listFilesRecursive(dir) {
  const result = new Map(); // relPath → { absPath, mtimeMs }
  if (!(await exists(dir))) return result;

  async function walk(current) {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue; // skip dotfiles (.DS_Store etc)
      const abs = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(abs);
      } else if (entry.isFile()) {
        const stat = await fs.stat(abs);
        const rel = path.relative(dir, abs);
        result.set(rel, { absPath: abs, mtimeMs: stat.mtimeMs });
      }
    }
  }

  await walk(dir);
  return result;
}

async function copyFilePreservingMtime(src, dst) {
  if (DRY_RUN) return;
  await fs.mkdir(path.dirname(dst), { recursive: true });
  await fs.copyFile(src, dst);
  const stat = await fs.stat(src);
  await fs.utimes(dst, stat.atime, stat.mtime);
}

/**
 * Reconcile two parallel directory trees.
 *  - File only on side A: copy A → B
 *  - File only on side B: copy B → A
 *  - File on both: newer mtime wins (within MTIME_TOLERANCE_MS, treat as equal)
 *  - PUSH_ONLY forces A → B for every divergent file
 *  - PULL_ONLY forces B → A for every divergent file
 */
const MTIME_TOLERANCE_MS = 1500;

async function reconcile(dirA, dirB, labelA, labelB) {
  const filesA = await listFilesRecursive(dirA);
  const filesB = await listFilesRecursive(dirB);
  const allRels = new Set([...filesA.keys(), ...filesB.keys()]);

  let toB = 0;
  let toA = 0;
  let unchanged = 0;
  const actions = [];

  for (const rel of allRels) {
    const a = filesA.get(rel);
    const b = filesB.get(rel);

    if (a && !b) {
      if (PULL_ONLY) {
        actions.push(`  skip (--pull) ${rel}: only in ${labelA}`);
        continue;
      }
      const dst = path.join(dirB, rel);
      await copyFilePreservingMtime(a.absPath, dst);
      toB++;
      actions.push(`  + ${labelB}/${rel}`);
    } else if (b && !a) {
      if (PUSH_ONLY) {
        actions.push(`  skip (--push) ${rel}: only in ${labelB}`);
        continue;
      }
      const dst = path.join(dirA, rel);
      await copyFilePreservingMtime(b.absPath, dst);
      toA++;
      actions.push(`  + ${labelA}/${rel}`);
    } else if (a && b) {
      const diff = a.mtimeMs - b.mtimeMs;
      if (Math.abs(diff) <= MTIME_TOLERANCE_MS) {
        unchanged++;
        if (VERBOSE) actions.push(`  = ${rel}`);
        continue;
      }
      const aWins = PUSH_ONLY || (!PULL_ONLY && diff > 0);
      const bWins = PULL_ONLY || (!PUSH_ONLY && diff < 0);
      if (aWins) {
        await copyFilePreservingMtime(a.absPath, b.absPath);
        toB++;
        actions.push(
          `  ↑ ${labelB}/${rel} (${labelA} newer by ${formatDuration(diff)})`,
        );
      } else if (bWins) {
        await copyFilePreservingMtime(b.absPath, a.absPath);
        toA++;
        actions.push(
          `  ↑ ${labelA}/${rel} (${labelB} newer by ${formatDuration(-diff)})`,
        );
      }
    }
  }

  return { toA, toB, unchanged, actions };
}

function formatDuration(ms) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

async function main() {
  console.log(`Plugin root: ${pluginRoot}`);
  console.log(`Vault root:  ${vaultRoot}`);
  if (DRY_RUN) console.log("(dry-run — no files will be written)");
  if (PUSH_ONLY) console.log("(push only — plugin → vault root)");
  if (PULL_ONLY) console.log("(pull only — vault root → plugin)");

  const pluginSystems = path.join(pluginRoot, "vault", "systems");
  const vaultSystems = path.join(vaultRoot, "systems");

  if (!(await exists(pluginSystems))) {
    console.error(`Plugin systems dir not found: ${pluginSystems}`);
    process.exit(1);
  }

  // Discover system folders on both sides.
  const systemNames = new Set();
  for (const dir of [pluginSystems, vaultSystems]) {
    if (!(await exists(dir))) continue;
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.isDirectory() && !e.name.startsWith(".")) systemNames.add(e.name);
    }
  }

  let totalToVault = 0;
  let totalToPlugin = 0;
  let totalUnchanged = 0;

  for (const sys of [...systemNames].sort()) {
    for (const sub of SYNC_SUBDIRS) {
      const pluginDir = path.join(pluginSystems, sys, sub);
      const vaultDir = path.join(vaultSystems, sys, sub);
      if (!(await exists(pluginDir)) && !(await exists(vaultDir))) continue;

      const result = await reconcile(pluginDir, vaultDir, "plugin", "vault");
      const changes = result.toA + result.toB;
      if (changes > 0 || VERBOSE) {
        console.log(`\n${sys}/${sub}`);
        for (const a of result.actions) console.log(a);
      }
      totalToVault += result.toB;
      totalToPlugin += result.toA;
      totalUnchanged += result.unchanged;
    }
  }

  console.log(`\nSummary`);
  console.log(`  plugin → vault: ${fmtCount(totalToVault, "file")}`);
  console.log(`  vault → plugin: ${fmtCount(totalToPlugin, "file")}`);
  console.log(`  unchanged:      ${fmtCount(totalUnchanged, "file")}`);
  if (DRY_RUN && (totalToVault > 0 || totalToPlugin > 0)) {
    console.log("\nRe-run without --dry-run to apply.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
