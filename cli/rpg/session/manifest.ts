/**
 * What a session is made of.
 *
 *   play        the notes play changes: the session note, the GM's notebooks,
 *               the party's sheets and what they carry (every note under the
 *               party's folder, and any note named in `session-files:`);
 *   references  what those link and play only reads: the GM Screen and its
 *               tools, maps, pictures, compendium notes;
 *   state       the plugin's state file entries that belong to the session
 *               (the log's bookkeeping baseline, a map's fog): they are in no
 *               note, and the state file is usually not in git.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Ctx } from "../app";
import type { TFile } from "../obsidian-node";
import { notebookPath } from "../gm/notebook";

export interface Manifest {
  session: string;
  play: string[];
  references: string[];
  /** Links that lead to no file. */
  missing: string[];
  stateFile: string;
  stateKeys: string[];
  /** Play files and the state file that git does not carry. */
  untracked: string[];
  bytes: { play: number; references: number };
}

const LINK = /!?\[\[([^\]|#\n]+)(?:#[^\]|\n]*)?(?:\|[^\]\n]*)?\]\]/g;

function linksOf(ctx: Ctx, file: TFile): { found: TFile[]; missing: string[] } {
  const found = new Map<string, TFile>();
  const missing = new Set<string>();
  if (file.extension !== "md") return { found: [], missing: [] };
  for (const m of ctx.vault.readSync(file).matchAll(LINK)) {
    const target = m[1].trim();
    const to = ctx.vault.resolveLink(target, file.path);
    if (to) found.set(to.path, to);
    else if (!/[{}<>]/.test(target)) missing.add(target);
  }
  return { found: [...found.values()], missing: [...missing] };
}

const dirOf = (path: string) => (path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "");

/** The party's folder: the folder above the sheets' own (`adventuring` over `adventuring/characters`). */
export function partyRoot(session: TFile, pcs: TFile[]): string | null {
  if (pcs.length === 0) return null;
  const dirs = [...new Set(pcs.map((p) => dirOf(p.path)))];
  let root = dirs.length === 1 ? dirOf(dirs[0]) : dirs.reduce((a, b) => common(a, b));
  // Never as wide as the folder the session's own folder sits in (that would be the whole system).
  if (!root || dirOf(session.path).startsWith(root)) root = dirs.length === 1 ? dirs[0] : "";
  return root || null;
}

function common(a: string, b: string): string {
  const x = a.split("/");
  const y = b.split("/");
  const out: string[] = [];
  for (let i = 0; i < Math.min(x.length, y.length) && x[i] === y[i]; i++) out.push(x[i]);
  return out.join("/");
}

export function statePath(ctx: Ctx): string {
  return typeof ctx.settings.statePath === "string" ? ctx.settings.statePath : ".dnd-ui-toolkit-state.json";
}

export function readState(ctx: Ctx): Record<string, unknown> {
  const p = join(ctx.root, statePath(ctx));
  if (!existsSync(p)) return {};
  try {
    const parsed = JSON.parse(readFileSync(p, "utf8"));
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** State entries that name one of the session's notes (in the key, or as a key inside). */
export function stateKeysFor(state: Record<string, unknown>, play: string[], maps: string[]): string[] {
  const names = [...play, ...maps];
  return Object.keys(state).filter((key) => names.some((n) => key.includes(n) || key.includes(n.replace(/\.md$/, ""))));
}

function ignoredByGit(root: string, paths: string[]): string[] {
  if (!existsSync(join(root, ".git")) || paths.length === 0) return [];
  try {
    const out = execFileSync("git", ["-C", root, "check-ignore", "--", ...paths], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return out.split("\n").filter(Boolean);
  } catch {
    return []; // none is ignored (git exits 1), or no git
  }
}

export function manifest(ctx: Ctx, ref: string): Manifest {
  const session = ctx.note(ref);
  const fm = ctx.metadataCache.frontmatterOf(session) ?? {};
  const pcs = ((Array.isArray(fm.pcs) ? fm.pcs : []) as unknown[])
    .map((p) => ctx.vault.resolveLink(String(p), session.path))
    .filter((f): f is TFile => !!f);
  const root = partyRoot(session, pcs);
  const extra = ((Array.isArray(fm["session-files"]) ? fm["session-files"] : []) as unknown[])
    .map((p) => ctx.vault.resolveLink(String(p), session.path))
    .filter((f): f is TFile => !!f);

  // Everything under the party's folder is the party's: sheets, and what they carry, linked or not.
  const party = root ? ctx.vault.getFiles().filter((f) => f.path.startsWith(`${root}/`)) : [];
  const play = new Map<string, TFile>([session, ...pcs, ...extra, ...party].map((f) => [f.path, f]));
  const references = new Map<string, TFile>();
  const missing = new Set<string>();
  const queue = [...play.values()];
  while (queue.length) {
    const file = queue.shift()!;
    const links = linksOf(ctx, file);
    for (const m of links.missing) missing.add(m);
    for (const to of links.found) {
      if (play.has(to.path)) continue;
      if (root && to.path.startsWith(`${root}/`)) {
        play.set(to.path, to);
        queue.push(to);
      } else references.set(to.path, to);
    }
  }
  // The GM Screen's tools are read at every card played.
  for (const ref of [...references.values()]) {
    const tools = ctx.metadataCache.frontmatterOf(ref)?.["gm-tools"];
    for (const t of Array.isArray(tools) ? tools : []) {
      const to = ctx.vault.resolveLink(String(t), ref.path);
      if (to && !play.has(to.path)) references.set(to.path, to);
    }
  }
  const playPaths = [...play.keys()];
  for (const mode of ["open", "secret"] as const) {
    const nb = notebookPath(session, mode);
    if (existsSync(join(ctx.root, nb))) playPaths.push(nb);
  }
  const state = readState(ctx);
  const stateKeys = stateKeysFor(state, playPaths, [...references.keys()]);
  const size = (paths: string[]) =>
    paths.reduce(
      (n, p) =>
        n +
        (ctx.vault.getFileByPath(p)?.stat.size ??
          (existsSync(join(ctx.root, p)) ? readFileSync(join(ctx.root, p)).length : 0)),
      0
    );
  const stateExists = existsSync(join(ctx.root, statePath(ctx)));
  return {
    session: session.path,
    play: playPaths.sort(),
    references: [...references.keys()].sort(),
    missing: [...missing].sort(),
    stateFile: statePath(ctx),
    stateKeys,
    untracked: ignoredByGit(ctx.root, [...playPaths, ...(stateExists ? [statePath(ctx)] : [])]),
    bytes: { play: size(playPaths), references: size([...references.keys()]) },
  };
}

const kb = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export function renderManifest(m: Manifest, full = false): string {
  const groups = new Map<string, string[]>();
  for (const r of m.references) {
    const top = r.split("/").slice(0, 2).join("/");
    groups.set(top, [...(groups.get(top) ?? []), r]);
  }
  const out = [
    `# Session: ${m.session}`,
    "",
    `## Play: ${m.play.length} notes (${kb(m.bytes.play)})`,
    "What play changes. A saved line and a pack hold these.",
    ...m.play.map((p) => `- ${p}`),
    "",
    `## State file: ${m.stateFile}`,
    m.stateKeys.length
      ? `${m.stateKeys.length} entries belong to this session (kept with a saved line and a pack):`
      : "No entry of it names this session's notes (or the file is not here).",
    ...m.stateKeys.map((k) => `- ${k}`),
    "",
    `## References: ${m.references.length} files (${kb(m.bytes.references)})`,
    "What play reads and does not change. In a pack only with --full.",
    ...(full
      ? m.references.map((r) => `- ${r}`)
      : [...groups.entries()].map(([top, list]) => `- ${top}/ (${list.length})`)),
  ];
  if (m.untracked.length)
    out.push(
      "",
      "## Not in git",
      "Ignored by the vault's .gitignore, so a clone or a sync by git does not carry them:",
      ...m.untracked.map((u) => `- ${u}`)
    );
  if (m.missing.length)
    out.push("", `## Links to nothing (${m.missing.length})`, ...m.missing.slice(0, 30).map((u) => `- ${u}`));
  return out.join("\n");
}
