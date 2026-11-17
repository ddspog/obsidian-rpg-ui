/**
 * A session's lines of play. A line is the session's play files and state
 * entries as they stood when it was saved, kept under `.rpg-sessions/<session>/`
 * (a dot-folder: Obsidian does not show it, git carries it).
 *
 *   save     the notes as they are, into the current line
 *   fork     save, then start a line from here: play goes on in the new line
 *   switch   save, then put another line's notes back in the vault
 *   pack     a line (or the notes as they are) as one zip; unpack puts it back
 *
 * One line is in the vault at a time, so links, sheets and the log keep the
 * names they have: nothing is copied beside itself.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Ctx } from "../app";
import { backup } from "../write";
import { unzip, zip } from "../zip";
import { type Manifest, manifest, readState, statePath } from "./manifest";

interface LineInfo {
  saved: string;
  from?: string;
  note?: string;
  files: string[];
}

interface Index {
  session: string;
  current: string;
  lines: Record<string, LineInfo>;
}

const slug = (path: string) =>
  (path.split("/").pop() ?? path)
    .replace(/\.md$/, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

const lineName = (name: string) => {
  const clean = name
    .trim()
    .replace(/[^\p{L}\p{N} _-]+/gu, "")
    .replace(/\s+/g, "-")
    .toLowerCase();
  if (!clean) throw new Error("Give the line a name (letters, digits, - and _).");
  return clean;
};

const home = (ctx: Ctx, m: Manifest) => join(ctx.root, ".rpg-sessions", slug(m.session));

function readIndex(ctx: Ctx, m: Manifest): Index {
  const p = join(home(ctx, m), "session.json");
  if (existsSync(p)) return JSON.parse(readFileSync(p, "utf8")) as Index;
  return { session: m.session, current: "main", lines: {} };
}

function writeIndex(ctx: Ctx, m: Manifest, index: Index): void {
  mkdirSync(home(ctx, m), { recursive: true });
  writeFileSync(join(home(ctx, m), "session.json"), `${JSON.stringify(index, null, 2)}\n`);
}

function walk(dir: string, base = dir): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory()
      ? walk(p, base)
      : [
          p
            .slice(base.length + 1)
            .split("\\")
            .join("/"),
        ];
  });
}

/** The vault's play files and state entries written into a line's folder. */
function store(ctx: Ctx, m: Manifest, index: Index, line: string, note?: string, from?: string): void {
  const dir = join(home(ctx, m), line);
  rmSync(join(dir, "files"), { recursive: true, force: true });
  for (const path of m.play) {
    const to = join(dir, "files", path);
    mkdirSync(dirname(to), { recursive: true });
    writeFileSync(to, readFileSync(join(ctx.root, path)));
  }
  const state = readState(ctx);
  const kept = Object.fromEntries(m.stateKeys.map((k) => [k, state[k]]));
  writeFileSync(join(dir, "state.json"), `${JSON.stringify(kept, null, 2)}\n`);
  const was = index.lines[line];
  index.lines[line] = {
    saved: new Date().toISOString(),
    ...((from ?? was?.from) ? { from: from ?? was?.from } : {}),
    ...((note ?? was?.note) ? { note: note ?? was?.note } : {}),
    files: m.play,
  };
}

export function saveLine(ctx: Ctx, ref: string, note?: string): string {
  const m = manifest(ctx, ref);
  const index = readIndex(ctx, m);
  store(ctx, m, index, index.current, note);
  writeIndex(ctx, m, index);
  return `Saved "${index.current}": ${m.play.length} notes, ${m.stateKeys.length} state entries.`;
}

export function forkLine(ctx: Ctx, ref: string, name: string, note?: string): string {
  const m = manifest(ctx, ref);
  const index = readIndex(ctx, m);
  const to = lineName(name);
  if (index.lines[to])
    throw new Error(`There is a line "${to}" already. Switch to it: rpg session switch "${ref}" ${to}`);
  const from = index.current;
  store(ctx, m, index, from);
  store(ctx, m, index, to, note, from);
  index.current = to;
  writeIndex(ctx, m, index);
  return `Saved "${from}" and started "${to}" from it. Play now goes into "${to}"; "${from}" stays as it was.\nBack to it: rpg session switch "${ref}" ${from}`;
}

export function switchLine(ctx: Ctx, ref: string, name: string): string {
  const m = manifest(ctx, ref);
  const index = readIndex(ctx, m);
  const to = lineName(name);
  const target = index.lines[to];
  if (!target) throw new Error(`No line "${to}". Lines: ${Object.keys(index.lines).join(", ") || "none saved yet"}.`);
  if (to === index.current) return `"${to}" is the line in the vault already.`;
  const from = index.current;
  store(ctx, m, index, from);
  const dir = join(home(ctx, m), to);
  // What the line left has and the one coming does not (a notebook made since) goes: it is saved.
  for (const path of m.play)
    if (!target.files.includes(path)) {
      backup(ctx.root, path);
      rmSync(join(ctx.root, path), { force: true });
    }
  for (const path of walk(join(dir, "files"))) {
    backup(ctx.root, path);
    mkdirSync(dirname(join(ctx.root, path)), { recursive: true });
    writeFileSync(join(ctx.root, path), readFileSync(join(dir, "files", path)));
  }
  const stateNote = restoreState(ctx, m.stateKeys, join(dir, "state.json"));
  index.current = to;
  writeIndex(ctx, m, index);
  return `Saved "${from}", and put "${to}" back in the vault (${target.files.length} notes).${stateNote}\nIn Obsidian, run "Reload app without saving" so the plugin reads the notes and its state again.`;
}

/** A line's state entries put back in the state file: the session's own are replaced, the rest left. */
function restoreState(ctx: Ctx, currentKeys: string[], file: string): string {
  if (!existsSync(file)) return "";
  const kept = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
  if (Object.keys(kept).length === 0 && currentKeys.length === 0) return "";
  const state = readState(ctx);
  for (const k of currentKeys) delete state[k];
  Object.assign(state, kept);
  backup(ctx.root, statePath(ctx));
  writeFileSync(join(ctx.root, statePath(ctx)), JSON.stringify(state, null, 2));
  return ` ${Object.keys(kept).length} state entries put back.`;
}

export function listLines(ctx: Ctx, ref: string): string {
  const m = manifest(ctx, ref);
  const index = readIndex(ctx, m);
  const names = Object.keys(index.lines);
  if (names.length === 0)
    return `No line saved yet for ${m.session}. The notes in the vault are the line "main".\nSave it: rpg session save "${ref}"   Fork it: rpg session fork "${ref}" <name>`;
  return [
    `# Lines of ${m.session}`,
    ...names.map((n) => {
      const l = index.lines[n];
      return `- ${n === index.current ? "**" : ""}${n}${n === index.current ? "** (in the vault)" : ""}: saved ${l.saved.slice(0, 16).replace("T", " ")}${l.from ? `, from ${l.from}` : ""}, ${l.files.length} notes${l.note ? ` — ${l.note}` : ""}`;
    }),
  ].join("\n");
}

export function packSession(ctx: Ctx, ref: string, opts: { line?: string; full?: boolean; out?: string }): string {
  const m = manifest(ctx, ref);
  const index = readIndex(ctx, m);
  const files: Array<{ path: string; data: Buffer }> = [];
  let state: Record<string, unknown>;
  let line = "the notes as they are";
  if (opts.line && lineName(opts.line) !== index.current) {
    const name = lineName(opts.line);
    if (!index.lines[name]) throw new Error(`No line "${name}".`);
    const dir = join(home(ctx, m), name);
    for (const p of walk(join(dir, "files")))
      files.push({ path: `vault/${p}`, data: readFileSync(join(dir, "files", p)) });
    state = JSON.parse(readFileSync(join(dir, "state.json"), "utf8")) as Record<string, unknown>;
    line = `line "${name}"`;
  } else {
    for (const p of m.play) files.push({ path: `vault/${p}`, data: readFileSync(join(ctx.root, p)) });
    const all = readState(ctx);
    state = Object.fromEntries(m.stateKeys.map((k) => [k, all[k]]));
  }
  if (opts.full)
    for (const p of m.references) files.push({ path: `vault/${p}`, data: readFileSync(join(ctx.root, p)) });
  files.push({ path: "state.json", data: Buffer.from(JSON.stringify(state, null, 2)) });
  files.push({
    path: "session.json",
    data: Buffer.from(
      JSON.stringify(
        {
          session: m.session,
          packed: new Date().toISOString(),
          line,
          full: !!opts.full,
          play: m.play,
          references: m.references,
          stateFile: m.stateFile,
        },
        null,
        2
      )
    ),
  });
  const stamp = new Date().toISOString().slice(0, 10);
  const out = opts.out ?? join(ctx.root, ".rpg-sessions", `${slug(m.session)} ${stamp}.zip`);
  mkdirSync(dirname(out), { recursive: true });
  const data = zip(files);
  writeFileSync(out, data);
  return `Packed ${line}: ${files.length - 2} files${opts.full ? " (references too)" : ""}, ${m.stateKeys.length} state entries, ${Math.max(1, Math.round(data.length / 1024))} KB\n${out}`;
}

export function unpackSession(ctx: Ctx, file: string, force: boolean): string {
  const entries = unzip(readFileSync(file));
  const notes = entries.filter((e) => e.path.startsWith("vault/")).map((e) => ({ ...e, path: e.path.slice(6) }));
  if (notes.some((n) => n.path.split("/").includes("..") || n.path.startsWith("/")))
    throw new Error("The pack holds a path that leaves the vault.");
  const there = notes.filter(
    (n) => existsSync(join(ctx.root, n.path)) && !readFileSync(join(ctx.root, n.path)).equals(n.data)
  );
  if (there.length && !force)
    throw new Error(
      `${there.length} notes of the pack differ from the vault's:\n${there
        .slice(0, 20)
        .map((n) => `  ${n.path}`)
        .join(
          "\n"
        )}\nWrite over them with --force (each is copied to .rpg-backups/cli first), or save a line first: rpg session save`
    );
  for (const n of notes) {
    if (existsSync(join(ctx.root, n.path))) backup(ctx.root, n.path);
    mkdirSync(dirname(join(ctx.root, n.path)), { recursive: true });
    writeFileSync(join(ctx.root, n.path), n.data);
  }
  const state = entries.find((e) => e.path === "state.json");
  let stateNote = "";
  if (state) {
    const kept = JSON.parse(state.data.toString("utf8")) as Record<string, unknown>;
    if (Object.keys(kept).length) {
      const all = { ...readState(ctx), ...kept };
      backup(ctx.root, statePath(ctx));
      writeFileSync(join(ctx.root, statePath(ctx)), JSON.stringify(all, null, 2));
      stateNote = `, ${Object.keys(kept).length} state entries`;
    }
  }
  return `Unpacked ${notes.length} files${stateNote} into ${ctx.root}.`;
}

/** Sessions in the vault: notes with an `rpg log` block and a party. */
export function listSessions(ctx: Ctx): string[] {
  return ctx.vault
    .getMarkdownFiles()
    .filter((f) => {
      const fm = ctx.metadataCache.frontmatterOf(f);
      return fm && Array.isArray(fm.pcs) && /^`{3,}\s*rpg\s+log\b/m.test(ctx.vault.readSync(f));
    })
    .map((f) => f.path);
}
