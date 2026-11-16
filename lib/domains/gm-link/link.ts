/**
 * The GM link: a session played in Obsidian (a phone too) with its Game Master
 * somewhere else, a branch of a GitHub repository between them.
 *
 *   The player hands over: the session's play notes are committed to the branch,
 *   with `table.json` saying it is the GM's turn and what the player said.
 *   The GM plays on a checkout of that branch, sets `table.json` back to the
 *   player with what it tells them, and pushes.
 *   The plugin sees the turn come back and writes the notes the GM changed.
 *
 * Nothing here talks to the network or to Obsidian: see `lib/services/github-relay.ts`
 * and `lib/plugin/gm-link.ts`.
 */

export interface GmLink {
  /** `owner/name` on github.com. */
  repo: string;
  branch: string;
  /** The session's note, as a vault path. */
  session: string;
  /** A pull request of the branch: a comment there tells the GM a turn is in. */
  pr?: number;
}

/** `rpg-gm://owner/name?branch=…&session=…&pr=21`, as `rpg table link` prints it. */
export function parseGmLink(text: string): GmLink | null {
  const m = text.trim().match(/^rpg-gm:\/\/([\w.-]+\/[\w.-]+)\/?\?(.+)$/);
  if (!m) return null;
  const q = new URLSearchParams(m[2]);
  const branch = q.get("branch")?.trim();
  const session = q.get("session")?.trim();
  if (!branch || !session) return null;
  const pr = parseInt(q.get("pr") ?? "", 10);
  return { repo: m[1], branch, session, ...(Number.isInteger(pr) && pr > 0 ? { pr } : {}) };
}

export function formatGmLink(l: GmLink): string {
  const q = new URLSearchParams({ branch: l.branch, session: l.session, ...(l.pr ? { pr: String(l.pr) } : {}) });
  return `rpg-gm://${l.repo}?${q.toString()}`;
}

/** The same link as one to tap: it opens Obsidian and sets the link there. */
export const openGmLinkUrl = (l: GmLink): string => `obsidian://rpg-gm?link=${encodeURIComponent(formatGmLink(l))}`;

/**
 * GitHub's page for a new fine-grained token, filled in for the GM link: its
 * name, the repository's owner, and the two permissions it needs. The
 * repository itself is picked on the page.
 */
export function newTokenUrl(l: GmLink): string {
  const q = new URLSearchParams({
    name: `RPG GM link (${l.repo.split("/")[1]})`.slice(0, 40),
    description: "Obsidian RPG UI: hands a session's turns to its Game Master over a branch.",
    target_name: l.repo.split("/")[0],
    expires_in: "90",
    contents: "write",
    pull_requests: "write",
  });
  return `https://github.com/settings/personal-access-tokens/new?${q.toString()}`;
}

/** Whose turn it is, kept on the branch beside the session's saved lines. */
export interface TableFile {
  /** Counts the GM's turns: the GM gives the turn back at `rev + 1`. */
  rev: number;
  turn: "player" | "gm";
  /** What the player told the GM with this turn. */
  message?: string;
  /** What the GM tells the player with theirs. */
  gm?: string;
  /** The commit the player's turn was made on (the branch's head before it). */
  base?: string;
  at?: string;
}

export const sessionSlug = (path: string): string =>
  (path.split("/").pop() ?? path)
    .replace(/\.md$/, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

/** Where `table.json` sits in the repository: with the session's lines. */
export const tablePath = (session: string): string => `.rpg-sessions/${sessionSlug(session)}/table.json`;

export function parseTable(text: string | null | undefined): TableFile | null {
  if (!text) return null;
  try {
    const t = JSON.parse(text) as Partial<TableFile>;
    if (typeof t.rev !== "number" || (t.turn !== "player" && t.turn !== "gm")) return null;
    return t as TableFile;
  } catch {
    return null;
  }
}

const dirOf = (path: string) => (path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "");

/**
 * The notes play changes: the session's note, the party's sheets, and every
 * note under the party's folder (the folder above the sheets': `adventuring`
 * for `adventuring/characters/*.md`). The same rule as `rpg session manifest`.
 */
export function playNotes(session: string, pcs: string[], notes: string[]): string[] {
  const dirs = [...new Set(pcs.map(dirOf))];
  let root = dirs.length === 1 ? dirOf(dirs[0]) : "";
  // Never as wide as the folder the session's own folder sits in (that would be the whole system).
  if (!root || dirOf(session).startsWith(root)) root = dirs.length === 1 ? dirs[0] : "";
  const under = root ? notes.filter((n) => n.startsWith(`${root}/`)) : [];
  return [...new Set([session, ...pcs, ...under])].filter((p) => p.endsWith(".md")).sort();
}

/**
 * Whether a path the GM changed is written into the vault: a note, and not in
 * a dot-folder (the GM's hidden notebook, the saved lines, Obsidian's own).
 */
export function accepts(path: string): boolean {
  return (
    path.endsWith(".md") && !path.split("/").some((seg) => seg.startsWith(".") || seg === "..") && !path.startsWith("/")
  );
}

/** A short fingerprint of a note's text, to tell whether it changed since it was sent. */
export function fingerprint(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return `${text.length}:${(h >>> 0).toString(36)}`;
}

/** What the plugin remembers of a linked session between hand-overs. */
export interface LinkState {
  /** The last `rev` the vault holds (the GM's last turn written here). */
  rev: number;
  /** A turn is with the GM. */
  waiting: boolean;
  /** The commit of the turn sent, or of the GM's turn last written. */
  commit?: string;
  /** Each play note as it was when sent or written, by path. */
  sent?: Record<string, string>;
  /** What the GM last said. */
  gm?: string;
}

/** The play notes changed in the vault since they were sent (or since the GM's turn was written). */
export function changedSince(state: LinkState, now: Record<string, string>): string[] {
  const sent = state.sent ?? {};
  return Object.keys(now).filter((p) => sent[p] !== undefined && sent[p] !== fingerprint(now[p]));
}
