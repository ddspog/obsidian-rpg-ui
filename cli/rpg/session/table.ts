/**
 * The session table (the page `simulators/session-table` builds): the two ends of a turn.
 *
 *   take   the player's turn, as the page wrote it to its database (`table/turn`), put in the
 *          vault: only the session's play notes are written, each copied to .rpg-backups first
 *   state  what the Game Master left, as the document the page reads (`table/state`)
 */

import { readFileSync } from "node:fs";
import type { Ctx } from "../app";
import { writeNote } from "../write";
import { manifest } from "./manifest";

export interface Turn {
  rev: number;
  files: Record<string, string>;
  message?: string;
  at?: string;
}

export function takeTurn(ctx: Ctx, ref: string, file: string): { value: unknown; text: string } {
  const raw = JSON.parse(readFileSync(file === "-" ? 0 : file, "utf8")) as Turn | { data?: Turn };
  const turn = ("data" in raw && raw.data ? raw.data : raw) as Turn;
  const m = manifest(ctx, ref);
  const refused = Object.keys(turn.files ?? {}).filter((p) => !m.play.includes(p));
  const written: string[] = [];
  const added: string[] = [];
  for (const [path, text] of Object.entries(turn.files ?? {})) {
    if (refused.includes(path)) continue;
    const was = ctx.vault.getFileByPath(path);
    const before = was ? ctx.vault.readSync(was) : "";
    if (before === text) continue;
    if (path === m.session) {
      const old = new Set(before.split("\n"));
      added.push(...text.split("\n").filter((l) => l.trim() && !old.has(l)));
    }
    writeNote(ctx.root, path, text);
    written.push(path);
  }
  const out = [
    `# The player's turn (on top of rev ${turn.rev}${turn.at ? `, ${turn.at}` : ""})`,
    "",
    turn.message ? `The player says: ${turn.message}` : "The player left no message.",
    "",
    written.length ? `Written to the vault: ${written.join(", ")}` : "No note changed.",
    ...(refused.length ? [`Refused (not this session's play notes): ${refused.join(", ")}`] : []),
    ...(added.length ? ["", "New in the log:", "```", ...added, "```"] : []),
  ];
  return { value: { rev: turn.rev, message: turn.message ?? "", written, refused, added }, text: out.join("\n") };
}

/** The play notes as they stand, for the page: `{ rev, files, gm, at }`. Hidden notebooks stay out. */
export function tableState(ctx: Ctx, ref: string, rev: number, gm: string): Record<string, unknown> {
  const m = manifest(ctx, ref);
  const files: Record<string, string> = {};
  for (const path of m.play) {
    const f = ctx.vault.getFileByPath(path);
    // What the vault the CLI reads does not show (a dot-folder) the player does not get.
    if (!f || / \(GM\)\.md$/.test(path)) continue;
    files[path] = ctx.vault.readSync(f);
  }
  return { rev, files, gm, at: new Date().toISOString() };
}
