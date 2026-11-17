/**
 * The few writes the CLI makes: a session's log, its GM notebook, its saved
 * lines. Everything else in the vault stays read-only (the plugin's code runs
 * against a vault that refuses writes). A note is copied to `.rpg-backups/cli`
 * before it is changed.
 */

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const KEEP = 40;

export function backup(root: string, path: string): void {
  const from = join(root, path);
  if (!existsSync(from)) return;
  const dir = join(root, ".rpg-backups", "cli");
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  copyFileSync(from, join(dir, `${stamp} ${path.replace(/[\\/]/g, "__")}`));
  const all = readdirSync(dir).sort();
  for (const old of all.slice(0, Math.max(0, all.length - KEEP))) rmSync(join(dir, old));
}

export function writeNote(root: string, path: string, text: string): void {
  backup(root, path);
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
}

export const readNote = (root: string, path: string): string | null =>
  existsSync(join(root, path)) ? readFileSync(join(root, path), "utf8") : null;

/** A note's text with `lines` added at the end of its nth `rpg <meta>` block. */
export function appendToFence(text: string, meta: string, nth: number, lines: string[]): string {
  const all = text.split("\n");
  let seen = 0;
  for (let i = 0; i < all.length; i++) {
    const open = all[i].match(/^(`{3,})\s*rpg\s+([\w.-]+)/);
    if (!open) continue;
    let close = i + 1;
    while (close < all.length && !new RegExp(`^${open[1]}\\s*$`).test(all[close])) close++;
    if (open[2] === meta && ++seen === nth) {
      // Blank lines at the block's end stay after what is added.
      let at = close;
      while (at > i + 1 && all[at - 1].trim() === "") at--;
      all.splice(at, 0, ...lines);
      return all.join("\n");
    }
    i = close;
  }
  throw new Error(`No rpg ${meta} block number ${nth} to write to.`);
}

/** Frontmatter with one key set (added when missing). */
export function setFrontmatter(text: string, key: string, value: string): string {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return `---\n${key}: ${value}\n---\n${text}`;
  const lines = m[1].split("\n");
  const at = lines.findIndex((l) => l.startsWith(`${key}:`));
  if (at >= 0) lines[at] = `${key}: ${value}`;
  else lines.push(`${key}: ${value}`);
  return `---\n${lines.join("\n")}\n---\n${text.slice(m[0].length)}`;
}
