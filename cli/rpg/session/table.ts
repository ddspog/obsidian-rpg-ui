/**
 * The GM's end of the GM link (lib/domains/gm-link/link.ts): the session is
 * played in Obsidian, a phone too, and its turns travel over a branch of the
 * vault's repository. The GM works on a checkout of that branch.
 *
 *   link   the link to paste in the plugin's settings (repository, branch, session, pull request)
 *   take   after a pull: whose turn it is, what the player said, what they added to the log
 *   give   the turn given back: `table.json` set to the player, with what the GM tells them
 *
 * Pulling, committing and pushing are git's, done by whoever runs the GM.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { formatGmLink, openGmLinkUrl, parseTable, type TableFile, tablePath } from "lib/domains/gm-link/link";
import type { Ctx } from "../app";

const git = (root: string, ...args: string[]): string =>
  execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();

export function tableLink(ctx: Ctx, ref: string, pr?: number): { value: unknown; text: string } {
  const session = ctx.note(ref).path;
  let remote: string;
  let branch: string;
  try {
    remote = git(ctx.root, "remote", "get-url", "origin");
    branch = git(ctx.root, "rev-parse", "--abbrev-ref", "HEAD");
  } catch {
    throw new Error("The vault is not a git checkout with an origin: the GM link travels over its GitHub repository.");
  }
  // https://github.com/owner/name(.git), git@github.com:owner/name.git, or a proxy's …/owner/name
  const repo = remote.replace(/\.git$/, "").match(/([\w.-]+\/[\w.-]+)$/)?.[1];
  if (!repo) throw new Error(`Cannot tell the repository from the origin (${remote}).`);
  const parts = { repo, branch, session, ...(pr ? { pr } : {}) };
  const link = formatGmLink(parts);
  const open = openGmLinkUrl(parts);
  return {
    value: { link, open, repo, branch, session, pr },
    text: [
      "For the player, either:",
      "",
      `  tap this on the device they play on (it opens Obsidian and sets the link):`,
      `  ${open}`,
      "",
      `  or paste this in the plugin's settings (General › GM link › Set up):`,
      `  ${link}`,
      "",
      "The set-up there walks through the rest (a GitHub token for the repository, a test, the first hand-over).",
      pr
        ? `A comment on pull request #${pr} tells the GM a turn is in.`
        : "No pull request named (--pr N): the player tells the GM by hand when a turn is in.",
    ].join("\n"),
  };
}

function readTable(ctx: Ctx, session: string): TableFile | null {
  const p = join(ctx.root, tablePath(session));
  return existsSync(p) ? parseTable(readFileSync(p, "utf8")) : null;
}

export function takeTurn(ctx: Ctx, ref: string): { value: unknown; text: string } {
  const session = ctx.note(ref).path;
  const table = readTable(ctx, session);
  if (!table)
    return {
      value: { turn: null },
      text: "No turn has been handed over yet (no table.json for this session). Pull the branch first.",
    };
  if (table.turn !== "gm")
    return {
      value: table,
      text: `It is the player's turn (rev ${table.rev}). Nothing to take: wait for their hand-over, then pull.`,
    };
  // What the player added: the session's note now, against the commit their turn was made on.
  let added: string[] = [];
  if (table.base) {
    try {
      const before = new Set(git(ctx.root, "show", `${table.base}:${session}`).split("\n"));
      added = ctx.vault
        .readSync(ctx.note(ref))
        .split("\n")
        .filter((l) => l.trim() && !before.has(l));
    } catch {
      added = [];
    }
  }
  const out = [
    `# The player's turn (rev ${table.rev}${table.at ? `, ${table.at}` : ""})`,
    "",
    table.message ? `The player says: ${table.message}` : "The player left no message.",
    "",
    ...(added.length
      ? ["New in the log (theirs, with their dice: leave them as they are):", "```", ...added, "```"]
      : ["Nothing new in the log."]),
    "",
    `When you have played: rpg table give "${ref}" --note "<what you tell the player>", then commit and push.`,
  ];
  return { value: { ...table, added }, text: out.join("\n") };
}

export function giveTurn(ctx: Ctx, ref: string, gm: string): { value: unknown; text: string } {
  const session = ctx.note(ref).path;
  const was = readTable(ctx, session);
  if (was && was.turn === "player") throw new Error(`The turn is the player's already (rev ${was.rev}).`);
  if (!gm.trim())
    throw new Error(
      'Say what the player reads first: --note "<what their characters perceive, and what is theirs to decide>".'
    );
  const table: TableFile = { rev: (was?.rev ?? 0) + 1, turn: "player", gm: gm.trim(), at: new Date().toISOString() };
  const p = join(ctx.root, tablePath(session));
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, `${JSON.stringify(table, null, 2)}\n`);
  return {
    value: table,
    text: `The turn is the player's (rev ${table.rev}). Commit and push so it reaches them:\n  git add -A && git commit -m "The GM's turn (rev ${table.rev})" && git push`,
  };
}
