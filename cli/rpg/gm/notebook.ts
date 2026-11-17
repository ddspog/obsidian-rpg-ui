/**
 * The GM's notebook for a session: standing notes, and prep as `rpg draft`
 * blocks, each under a heading with its status and what brings it into play.
 *
 * Its place follows the session's `gm-mode`:
 *   open    `<session> (GM).md` beside the session, read in Obsidian as play goes;
 *   secret  `.gm/<session>.md` beside it — a dot-folder, which Obsidian does not
 *           show — until `rpg gm reveal` moves prep into the open notebook.
 */

import { formatDraftBlock, parseDraftBlock } from "lib/domains/draft/draft";
import type { Ctx } from "../app";
import type { TFile } from "../obsidian-node";
import { readNote, writeNote } from "../write";

export type GmMode = "secret" | "open";

export interface Prep {
  title: string;
  status: string;
  when?: string;
  made?: string;
  /** The draft block's text (head, `---`, ideas). */
  block: string;
}

export interface Notebook {
  path: string;
  mode: GmMode;
  exists: boolean;
  standing: string;
  prep: Prep[];
}

export function modeOf(ctx: Ctx, session: TFile): GmMode {
  const fm = ctx.metadataCache.frontmatterOf(session) ?? {};
  return String(fm["gm-mode"] ?? "").toLowerCase() === "open" ? "open" : "secret";
}

export function notebookPath(session: TFile, mode: GmMode): string {
  const dir = session.parent?.path ?? "";
  const at = (name: string) => (dir ? `${dir}/${name}` : name);
  return mode === "open" ? at(`${session.basename} (GM).md`) : at(`.gm/${session.basename}.md`);
}

const FENCE = /^(`{3,})\s*rpg\s+draft[^\n]*\n([\s\S]*?)\n\1\s*$/m;

function parse(text: string): { standing: string; prep: Prep[] } {
  const body = text.replace(/^---\n[\s\S]*?\n---\n?/, "");
  const prepAt = body.search(/^## Prep\s*$/m);
  const head = prepAt >= 0 ? body.slice(0, prepAt) : body;
  const standing = (head.split(/^## Standing notes\s*$/m)[1] ?? "").trim();
  const prep: Prep[] = [];
  if (prepAt >= 0) {
    const sections = body
      .slice(prepAt)
      .replace(/^## Prep\s*$/m, "")
      .split(/^### /m)
      .slice(1);
    for (const s of sections) {
      const title = s.split("\n")[0].trim();
      const field = (k: string) => s.match(new RegExp(`^${k}::\\s*(.+)$`, "m"))?.[1].trim();
      const block = s.match(FENCE)?.[2] ?? "";
      prep.push({ title, status: field("status") ?? "idea", when: field("when"), made: field("made"), block });
    }
  }
  return { standing, prep };
}

function format(session: TFile, mode: GmMode, standing: string, prep: Prep[]): string {
  const out = [
    "---",
    `session: "[[${session.basename}]]"`,
    "gm-notebook: true",
    "---",
    `# GM notebook: ${session.basename}`,
    "",
    mode === "secret"
      ? "> Kept out of sight (a dot-folder). `rpg gm reveal` moves prep into the open notebook."
      : "> The Game Master's prep and reasoning. Spoilers for the player.",
    "",
    "## Standing notes",
    "",
    standing.trim(),
    "",
    "## Prep",
    "",
  ];
  for (const p of prep) {
    out.push(`### ${p.title}`, `status:: ${p.status}`);
    if (p.when) out.push(`when:: ${p.when}`);
    if (p.made) out.push(`made:: ${p.made}`);
    out.push("", "```rpg draft", p.block.replace(/\s+$/, ""), "```", "");
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n");
}

export function readNotebook(ctx: Ctx, session: TFile, mode = modeOf(ctx, session)): Notebook {
  const path = notebookPath(session, mode);
  const text = readNote(ctx.root, path);
  return { path, mode, exists: text !== null, ...parse(text ?? "") };
}

export function writeNotebook(ctx: Ctx, session: TFile, nb: Notebook): void {
  writeNote(ctx.root, nb.path, format(session, nb.mode, nb.standing, nb.prep));
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export interface PrepChange {
  status?: string;
  when?: string;
  made?: string;
  attach?: string[];
  ask?: string;
  map?: string;
  level?: number;
  hexes?: Array<[number, number]>;
  /** Lines added at the end of the draft's ideas. */
  lines?: string[];
}

/** A prep draft made, or changed: found by title. */
export function upsertPrep(nb: Notebook, gmScreen: string | undefined, title: string, change: PrepChange): Prep {
  let prep = nb.prep.find((p) => same(p.title, title));
  if (!prep) {
    prep = { title: title.trim(), status: "idea", block: "" };
    nb.prep.push(prep);
  }
  const draft = parseDraftBlock(prep.block);
  draft.title = prep.title;
  if (!draft.gm && gmScreen) draft.gm = gmScreen;
  for (const a of change.attach ?? []) {
    const link = a.startsWith("[[") ? a : `[[${a}]]`;
    if (!draft.attach.includes(link)) draft.attach.push(link);
  }
  if (change.ask) draft.ask = change.ask as never;
  if (change.map) draft.map = change.map.startsWith("[[") ? change.map : `[[${change.map}]]`;
  if (change.level !== undefined) draft.level = change.level;
  if (change.hexes?.length) draft.hexes = change.hexes;
  if (change.lines?.length)
    draft.body = [draft.body.replace(/\s+$/, ""), ...change.lines].filter((l) => l !== "").join("\n");
  prep.block = formatDraftBlock(draft);
  if (change.status) prep.status = change.status;
  if (change.when) prep.when = change.when;
  if (change.made && !prep.made) prep.made = change.made;
  return prep;
}

/** The ideas of a prep draft (its lines below `---`). */
export const prepBody = (p: Prep): string => parseDraftBlock(p.block).body;
