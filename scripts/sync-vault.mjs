#!/usr/bin/env node
/**
 * sync-vault.mjs — keep the plugin's `vault/` folder and the Obsidian vault
 * root in lockstep.
 *
 * The plugin's source-of-truth content lives in:
 *   .obsidian/plugins/obsidian-rpg-ui/vault/<system>/{config,compendium,...}/
 *
 * Obsidian, however, only sees files at the vault root:
 *   <system>/{config,compendium,...}/
 *
 * These two locations have historically drifted (e.g. a Cleric.md edit on one
 * side never reaches the other). This script reconciles them with a
 * **bidirectional, newest-mtime-wins** strategy so neither side silently
 * loses authored content.
 *
 * ## Deletion tracking
 *
 * The script maintains a `.sync-manifest.json` snapshot at the plugin root
 * listing every relpath that was known-present on both sides after the
 * previous run. That snapshot is what disambiguates "new file on side A"
 * from "file was deleted on side B":
 *
 *   - relpath not in manifest, present only on A → new file, copy to B
 *   - relpath   IN manifest, present only on A → deletion on B, propagate by
 *                                                 removing from A too
 *
 * Deletions are batched into a single confirmation prompt before anything is
 * removed. `--yes` auto-confirms; `--no-deletes` forces new-file semantics
 * and rewrites the "missing" side from the other one (the old behaviour).
 * First run (no manifest yet) implicitly uses new-file semantics.
 *
 * The manifest lives at the plugin root and is gitignored — it's per-machine
 * state, not shared history.
 *
 * Scope: syncs specific subdirectories (config, worldbuilding, glossary,
 *        adventurers, compendium, concepts) within each registered system.
 *        Files outside those prefixes are ignored.
 *
 * Usage:
 *   npm run sync                # sync (apply changes, confirm deletions)
 *   npm run sync -- --dry-run   # show what would change without writing
 *   npm run sync -- --verbose   # also list unchanged files
 *   npm run sync -- --yes       # auto-confirm any proposed deletions
 *   npm run sync -- --no-deletes  # treat one-sided files as new (legacy mode)
 *
 * Direction overrides (skip the mtime comparison and the deletion logic):
 *   --push   plugin → vault root only (overwrite vault root with plugin copy)
 *   --pull   vault root → plugin only (overwrite plugin copy with vault root)
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import readline from "node:readline";
import url from "node:url";

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pluginRoot = path.resolve(__dirname, "..");
const vaultRoot = path.resolve(pluginRoot, "../../..");
const manifestPath = path.join(pluginRoot, ".sync-manifest.json");
const MANIFEST_VERSION = 1;

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");
const VERBOSE = args.has("--verbose");
const PUSH_ONLY = args.has("--push");
const PULL_ONLY = args.has("--pull");
const AUTO_YES = args.has("--yes") || args.has("-y");
const NO_DELETES = args.has("--no-deletes");

if (PUSH_ONLY && PULL_ONLY) {
  console.error("Error: --push and --pull are mutually exclusive");
  process.exit(1);
}

const SYNC_SUBDIRS = ["config", "worldbuilding", "glossary", "adventurers", "compendium", "concepts"];

// Each entry maps a system name to its plugin-mirror and vault-root directories.
// Systems at the vault root (no `systems/` prefix) list their paths directly.
const SYSTEM_ENTRIES = [
  {
    name: "tales-of-the-valiant",
    pluginDir: path.join(pluginRoot, "vault", "tales-of-the-valiant"),
    vaultDir: path.join(vaultRoot, "tales-of-the-valiant"),
  },
];

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

async function removeFile(p) {
  if (DRY_RUN) return;
  try {
    await fs.unlink(p);
  } catch (err) {
    if (err?.code !== "ENOENT") throw err;
  }
}

/**
 * Load the previous-run snapshot. Returns a Set of fully-qualified relpaths
 * (`<system>/<subdir>/<rel>`) that both sides held after the last sync, or
 * `null` when no manifest exists. A null manifest disables deletion
 * detection — every one-sided file is treated as new.
 */
async function loadManifest() {
  try {
    const text = await fs.readFile(manifestPath, "utf8");
    const parsed = JSON.parse(text);
    if (parsed && Array.isArray(parsed.files)) {
      return new Set(parsed.files);
    }
    return new Set();
  } catch (err) {
    if (err?.code === "ENOENT") return null;
    console.warn(`Warning: failed to read ${manifestPath}: ${err.message}`);
    return null;
  }
}

async function saveManifest(tracked) {
  if (DRY_RUN) return;
  const data = {
    version: MANIFEST_VERSION,
    updatedAt: new Date().toISOString(),
    files: [...tracked].sort(),
  };
  await fs.writeFile(manifestPath, JSON.stringify(data, null, 2) + "\n");
}

function promptYesNo(question, defaultYes = false) {
  if (AUTO_YES) return Promise.resolve(true);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const suffix = defaultYes ? "[Y/n]" : "[y/N]";
  return new Promise((resolve) => {
    rl.question(`${question} ${suffix} `, (answer) => {
      rl.close();
      const trimmed = (answer ?? "").trim().toLowerCase();
      if (trimmed === "") resolve(defaultYes);
      else resolve(trimmed === "y" || trimmed === "yes");
    });
  });
}

/**
 * Reconcile two parallel directory trees.
 *
 * Per-file outcomes:
 *  - Both present, mtimes within tolerance → unchanged.
 *  - Both present, differing mtimes → newer mtime wins (or forced by
 *    --push / --pull).
 *  - One side only, relpath NOT in manifest → new file, copy to the other side.
 *  - One side only, relpath IS  in manifest → the other side deleted it;
 *    defer as a deletion candidate (batch-confirmed in `main`).
 *
 * `--push` / `--pull` short-circuit the deletion path entirely — those modes
 * are directional overrides, so a missing file on the receiving side is
 * always treated as "copy from the sending side".
 *
 * `trackedKeys` accumulates the manifest-key of every file that ends up
 * present on both sides after this pass. Files that became one-sided
 * because of a deletion fall out of the manifest via omission.
 */
const MTIME_TOLERANCE_MS = 1500;

async function reconcile(dirA, dirB, labelA, labelB, subdirKey, manifest, trackedKeys, pendingDeletions) {
  const filesA = await listFilesRecursive(dirA);
  const filesB = await listFilesRecursive(dirB);
  const allRels = new Set([...filesA.keys(), ...filesB.keys()]);

  // Case-insensitive lookup tables so a file that lives on each side under a
  // different casing (common on macOS, which folds the FS but still reports
  // per-entry casing) is treated as "present on both" rather than a
  // deletion + new-file pair. Without this, a single physical file surfaces
  // as two manifest entries that perpetually bounce each other around.
  const lowerA = new Map();
  const lowerB = new Map();
  for (const k of filesA.keys()) lowerA.set(k.toLowerCase(), k);
  for (const k of filesB.keys()) lowerB.set(k.toLowerCase(), k);

  let toB = 0;
  let toA = 0;
  let unchanged = 0;
  const actions = [];

  const deletionsEnabled = manifest != null && !NO_DELETES && !PUSH_ONLY && !PULL_ONLY;

  for (const rel of allRels) {
    const a = filesA.get(rel);
    const b = filesB.get(rel);
    const key = `${subdirKey}/${rel}`;

    if (a && !b) {
      // Case-collision guard — if a case variant exists on side B, the file
      // is really "present on both" and the reconcile will handle it via
      // the other rel's iteration. Skip silently so we don't emit noise.
      if (lowerB.has(rel.toLowerCase())) {
        continue;
      }
      if (deletionsEnabled && manifest.has(key)) {
        pendingDeletions.push({
          key,
          relDisplay: `${subdirKey}/${rel}`,
          keepSide: labelA,
          keepPath: a.absPath,
          goneSide: labelB,
        });
        continue;
      }
      if (PULL_ONLY) {
        actions.push(`  skip (--pull) ${rel}: only in ${labelA}`);
        continue;
      }
      const dst = path.join(dirB, rel);
      await copyFilePreservingMtime(a.absPath, dst);
      toB++;
      trackedKeys.add(key);
      actions.push(`  + ${labelB}/${rel}`);
    } else if (b && !a) {
      if (lowerA.has(rel.toLowerCase())) {
        continue;
      }
      if (deletionsEnabled && manifest.has(key)) {
        pendingDeletions.push({
          key,
          relDisplay: `${subdirKey}/${rel}`,
          keepSide: labelB,
          keepPath: b.absPath,
          goneSide: labelA,
        });
        continue;
      }
      if (PUSH_ONLY) {
        actions.push(`  skip (--push) ${rel}: only in ${labelB}`);
        continue;
      }
      const dst = path.join(dirA, rel);
      await copyFilePreservingMtime(b.absPath, dst);
      toA++;
      trackedKeys.add(key);
      actions.push(`  + ${labelA}/${rel}`);
    } else if (a && b) {
      trackedKeys.add(key);
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
  if (NO_DELETES) console.log("(--no-deletes — one-sided files treated as new)");

  const manifest = await loadManifest();
  if (manifest == null) {
    console.log("(no manifest yet — first run will snapshot after completing)");
  }

  let totalToVault = 0;
  let totalToPlugin = 0;
  let totalUnchanged = 0;

  // Files that will be present on both sides after this run — written back
  // to the manifest so the next run can distinguish deletions from new
  // files. Populated by reconcile().
  const trackedKeys = new Set();
  // Deferred deletions — collected across every subdir, confirmed in one
  // batch at the end of the sync pass.
  const pendingDeletions = [];

  for (const entry of SYSTEM_ENTRIES) {
    if (!(await exists(entry.pluginDir))) {
      console.warn(`Plugin dir not found for ${entry.name}: ${entry.pluginDir}`);
      continue;
    }

    for (const sub of SYNC_SUBDIRS) {
      const pluginDir = path.join(entry.pluginDir, sub);
      const vaultDir = path.join(entry.vaultDir, sub);
      if (!(await exists(pluginDir)) && !(await exists(vaultDir))) continue;

      const subdirKey = `${entry.name}/${sub}`;
      const result = await reconcile(
        pluginDir,
        vaultDir,
        "plugin",
        "vault",
        subdirKey,
        manifest,
        trackedKeys,
        pendingDeletions,
      );
      const changes = result.toA + result.toB;
      if (changes > 0 || VERBOSE) {
        console.log(`\n${entry.name}/${sub}`);
        for (const a of result.actions) console.log(a);
      }
      totalToVault += result.toB;
      totalToPlugin += result.toA;
      totalUnchanged += result.unchanged;
    }
  }

  // ─── Deletion batch ──────────────────────────────────────────────────
  let totalDeleted = 0;
  if (pendingDeletions.length > 0) {
    console.log(`\nProposed deletions (present in last snapshot, removed from one side):`);
    for (const d of pendingDeletions) {
      console.log(`  - ${d.relDisplay}  (kept on ${d.keepSide}, missing from ${d.goneSide})`);
    }

    if (DRY_RUN) {
      // Dry-run: describe what would happen but don't prompt or write. Don't
      // drop these from the manifest either — we're just reporting.
      console.log("(dry-run — would prompt to delete, not applying)");
      for (const d of pendingDeletions) {
        trackedKeys.add(d.key);
      }
    } else {
      const confirmed = await promptYesNo(
        `Delete ${fmtCount(pendingDeletions.length, "file")} from the side that still has them?`,
        false,
      );

      if (confirmed) {
        for (const d of pendingDeletions) {
          await removeFile(d.keepPath);
          totalDeleted++;
        }
        console.log(`  deleted ${fmtCount(totalDeleted, "file")}`);
      } else {
        // User declined — fall back to new-file semantics for every pending
        // one-sided file so the next run doesn't keep re-prompting. Copy
        // the surviving side across and re-add to the manifest.
        console.log("  kept; copying the surviving copy across both sides");
        for (const d of pendingDeletions) {
          const [sys, sub, ...restParts] = d.key.split("/");
          const rel = restParts.join("/");
          const entry = SYSTEM_ENTRIES.find((e) => e.name === sys);
          if (!entry) continue;
          const pluginDir = path.join(entry.pluginDir, sub);
          const vaultDir = path.join(entry.vaultDir, sub);
          const dstDir = d.keepSide === "plugin" ? vaultDir : pluginDir;
          const dst = path.join(dstDir, rel);
          await copyFilePreservingMtime(d.keepPath, dst);
          trackedKeys.add(d.key);
          if (d.keepSide === "plugin") totalToVault++;
          else totalToPlugin++;
        }
      }
    }
  }

  // Persist the post-run snapshot. Skipped on direction-only runs so
  // --push / --pull don't overwrite a richer manifest built from
  // bidirectional runs.
  if (!DRY_RUN && !PUSH_ONLY && !PULL_ONLY) {
    await saveManifest(trackedKeys);
  }

  console.log(`\nSummary`);
  console.log(`  plugin → vault: ${fmtCount(totalToVault, "file")}`);
  console.log(`  vault → plugin: ${fmtCount(totalToPlugin, "file")}`);
  if (totalDeleted > 0 || pendingDeletions.length > 0) {
    console.log(`  deleted:        ${fmtCount(totalDeleted, "file")}`);
  }
  console.log(`  unchanged:      ${fmtCount(totalUnchanged, "file")}`);
  if (DRY_RUN && (totalToVault > 0 || totalToPlugin > 0 || pendingDeletions.length > 0)) {
    console.log("\nRe-run without --dry-run to apply.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
