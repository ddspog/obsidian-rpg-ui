/**
 * The two moves of the GM link, over a relay and a vault given as plain
 * functions (so they run in tests with neither GitHub nor Obsidian).
 */

import type { Relay } from "lib/services/github-relay";
import { accepts, fingerprint, type GmLink, type LinkState, parseTable, type TableFile, tablePath } from "./link";

export interface VaultPort {
  read(path: string): Promise<string | null>;
  write(path: string, text: string): Promise<void>;
}

/** The player's turn sent: the play notes and `table.json` in one commit, and the GM told. */
export async function handOver(
  relay: Relay,
  link: GmLink,
  state: LinkState,
  notes: Record<string, string>,
  message: string,
  kind = "play"
): Promise<{ state: LinkState; told: boolean; toldError?: string }> {
  const send = async () => {
    const parent = await relay.head();
    const table: TableFile = {
      rev: state.rev,
      turn: "gm",
      ...(kind !== "play" ? { kind } : {}),
      message,
      base: parent,
      at: new Date().toISOString(),
    };
    const files = { ...notes, [tablePath(link.session)]: `${JSON.stringify(table, null, 2)}\n` };
    return relay.commit(
      files,
      `The player's turn (rev ${state.rev})${message ? `: ${message.split("\n")[0].slice(0, 60)}` : ""}`,
      parent
    );
  };
  let commit: string;
  try {
    commit = await send();
  } catch {
    // The branch moved between reading it and writing: once more, on its new head.
    commit = await send();
  }
  let told = false;
  let toldError: string | undefined;
  if (link.pr) {
    try {
      await relay.comment(
        link.pr,
        `The player's turn is in for **${link.session.split("/").pop()?.replace(/\.md$/, "")}** (rev ${state.rev}).${message ? `\n\n> ${message.replace(/\n/g, "\n> ")}` : ""}`
      );
      told = true;
    } catch (e) {
      toldError = e instanceof Error ? e.message : String(e);
    }
  }
  const sent = Object.fromEntries(Object.entries(notes).map(([p, t]) => [p, fingerprint(t)]));
  return { state: { ...state, waiting: true, commit, sent }, told, toldError };
}

export type Checked =
  | { kind: "waiting" }
  | { kind: "nothing" }
  | { kind: "turn"; table: TableFile; head: string; files: string[] };

/** Whether the GM has given the turn back, and which notes it changed. Writes nothing. */
export async function checkTurn(relay: Relay, link: GmLink, state: LinkState): Promise<Checked> {
  const table = parseTable(await relay.read(tablePath(link.session)));
  if (!table) return { kind: "nothing" };
  if (table.turn !== "player" || table.rev <= state.rev) return { kind: state.waiting ? "waiting" : "nothing" };
  const head = await relay.head();
  const files = state.commit
    ? (await relay.changed(state.commit, head)).filter((f) => !f.removed && accepts(f.path)).map((f) => f.path)
    : [link.session];
  return { kind: "turn", table, head, files };
}

/** The GM's turn written into the vault: each note it changed, as the branch has it. */
export async function applyTurn(
  relay: Relay,
  vault: VaultPort,
  state: LinkState,
  turn: { table: TableFile; head: string; files: string[] }
): Promise<{ state: LinkState; written: string[] }> {
  const written: string[] = [];
  const sent = { ...(state.sent ?? {}) };
  for (const path of turn.files) {
    const text = await relay.read(path, turn.head);
    if (text === null) continue;
    if ((await vault.read(path)) !== text) {
      await vault.write(path, text);
      written.push(path);
    }
    sent[path] = fingerprint(text);
  }
  return { state: { rev: turn.table.rev, waiting: false, commit: turn.head, sent, gm: turn.table.gm }, written };
}
