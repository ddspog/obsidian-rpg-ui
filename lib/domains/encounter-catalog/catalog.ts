/**
 * The encounter catalog of a party: ready-made encounters kept in a vault note,
 * one fenced `rpg encounter` block each (`yaml encounter` is still read),
 * under one `rpg encounter-catalog` block the plugin renders as the board,
 * editable by hand. This is the model
 * and its markdown form. Pure: no Obsidian and no I/O.
 */

import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

import type { Difficulty, FitState } from "./fit-state";

export interface CatalogMonster {
  /** The bestiary note, as the simulator reads it (a vault path or a link target). */
  note: string;
  count: number;
  /** The dice the source rolled the count with, as text ("1d4+1"). */
  dice?: string;
}

export interface CatalogSource {
  note: string;
  table?: string;
  row?: string;
  book?: string;
  /** The row's own words (the scene), so a Game Master can dress the encounter without opening the table. */
  text?: string;
}

export type ReviewFlag = "draft" | "confirmed";

export interface CatalogEntry {
  id: string;
  name: string;
  monsters: CatalogMonster[];
  tags: string[];
  source?: CatalogSource;
  /** `draft` was extracted by machine, `confirmed` was read by a person. */
  review: ReviewFlag;
  notes?: string;
  fit?: FitState;
  /** How many times the encounter was run (`catalog use`). */
  uses?: number;
  /** The catalog's session number when it was last run. */
  lastUsedSession?: number;
}

/** The party as `catalog check` last profiled it: what the board shows without simulating anything. */
export interface CatalogProfile {
  size: number;
  averageLevel: number;
  tier: number;
  benchmark: string;
  /** The single-monster CR range, "1/8-1/2". */
  singleCr: string;
  /** The party stamp of that check: an entry whose fit has another stamp is out of date. */
  stamp: string;
}

export interface Catalog {
  party: { name: string; pcs: string[] };
  /** Written by `catalog check`; absent until the first check. */
  profile?: CatalogProfile;
  difficulty: Difficulty;
  /** The party's current session number. */
  session: number;
  /** A fit older than this many sessions is checked again; 0 turns it off. */
  recheckEverySessions: number;
  /** An entry run at session S is offered again from session S + this; 0 offers it at once. */
  reuseAfterSessions: number;
  entries: CatalogEntry[];
}

export interface MergeResult {
  catalog: Catalog;
  added: CatalogEntry[];
  skipped: CatalogEntry[];
}

export const CATALOG_TYPE = "encounter-catalog";
export const ENTRY_INFO_STRING = "rpg encounter";
/** The block the plugin renders as the catalog's board. */
export const BOARD_INFO_STRING = "rpg encounter-catalog";
export const DEFAULT_RECHECK_EVERY_SESSIONS = 5;
export const DEFAULT_REUSE_AFTER_SESSIONS = 3;

const DIFFICULTIES: readonly Difficulty[] = ["easy", "challenging", "deadly"];
const FIT_STATES = ["fit", "too-easy", "too-hard"] as const;

// ---------------------------------------------------------------- ids

const kebab = (text: string): string =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const baseName = (note: string): string => {
  const last = note.split("/").pop() ?? note;
  return last.replace(/\.md$/i, "");
};

/**
 * A stable kebab-case id from a name; with no usable name, from the monsters
 * ("2-goblin-1-hobgoblin"). Ids in `taken` are avoided by a numeric suffix
 * ("goblin-ambush-2").
 */
export function slugId(name: string, monsters: CatalogMonster[], taken: Iterable<string> = []): string {
  let base = kebab(name);
  if (!base) {
    base = kebab(monsters.map((m) => `${m.count} ${baseName(m.note)}`).join(" "));
  }
  if (!base) base = "encounter";
  const used = new Set(taken);
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

// ---------------------------------------------------------------- entries

/** The monsters of an entry as a comparable key: notes lower-cased, counts summed, sorted. */
function monsterSignature(monsters: CatalogMonster[]): string {
  const counts = new Map<string, number>();
  for (const m of monsters) {
    const key = m.note.trim().toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + m.count);
  }
  return [...counts.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([note, count]) => `${note}|${count}`)
    .join(";");
}

/** A new catalog with the entry appended; an id already in the catalog is an error. */
export function addEntry(catalog: Catalog, entry: CatalogEntry): Catalog {
  if (catalog.entries.some((e) => e.id === entry.id)) {
    throw new Error(`Encounter catalog already has an entry with id "${entry.id}"`);
  }
  return { ...catalog, entries: [...catalog.entries, entry] };
}

/** A new catalog with the entry of that id changed by `change`; an id that is not there is an error. */
export function updateEntry(catalog: Catalog, id: string, change: (entry: CatalogEntry) => CatalogEntry): Catalog {
  if (!catalog.entries.some((e) => e.id === id)) {
    throw new Error(`Encounter catalog has no entry with id "${id}"`);
  }
  return { ...catalog, entries: catalog.entries.map((e) => (e.id === id ? change(e) : e)) };
}

/** The entry marked as read by a person. */
export const confirmed = (entry: CatalogEntry): CatalogEntry => ({ ...entry, review: "confirmed" });

/** The entry marked as run at `session`. */
export const usedAt =
  (session: number) =>
  (entry: CatalogEntry): CatalogEntry => ({ ...entry, uses: (entry.uses ?? 0) + 1, lastUsedSession: session });

/** A new catalog without the entry of that id; an id that is not there is an error. */
export function removeEntry(catalog: Catalog, id: string): Catalog {
  if (!catalog.entries.some((e) => e.id === id)) {
    throw new Error(`Encounter catalog has no entry with id "${id}"`);
  }
  return { ...catalog, entries: catalog.entries.filter((e) => e.id !== id) };
}

/**
 * Adds extracted drafts, skipping any whose monsters and counts equal an
 * existing entry's (or an earlier draft's). A draft whose id is taken gets a
 * suffixed id.
 */
export function mergeDrafts(catalog: Catalog, drafts: CatalogEntry[]): MergeResult {
  const signatures = new Set(catalog.entries.map((e) => monsterSignature(e.monsters)));
  const ids = new Set(catalog.entries.map((e) => e.id));
  const added: CatalogEntry[] = [];
  const skipped: CatalogEntry[] = [];
  for (const draft of drafts) {
    const signature = monsterSignature(draft.monsters);
    if (signatures.has(signature)) {
      skipped.push(draft);
      continue;
    }
    const entry = ids.has(draft.id) ? { ...draft, id: slugId(draft.id, draft.monsters, ids) } : draft;
    signatures.add(signature);
    ids.add(entry.id);
    added.push(entry);
  }
  return { catalog: { ...catalog, entries: [...catalog.entries, ...added] }, added, skipped };
}

// ---------------------------------------------------------------- serialize

function entryObject(entry: CatalogEntry): Record<string, unknown> {
  const out: Record<string, unknown> = {
    id: entry.id,
    name: entry.name,
    monsters: entry.monsters.map((m) => {
      const monster: Record<string, unknown> = { note: m.note, count: m.count };
      if (m.dice !== undefined) monster.dice = m.dice;
      return monster;
    }),
    tags: entry.tags,
  };
  if (entry.source) {
    const source: Record<string, unknown> = { note: entry.source.note };
    if (entry.source.table !== undefined) source.table = entry.source.table;
    if (entry.source.row !== undefined) source.row = entry.source.row;
    if (entry.source.book !== undefined) source.book = entry.source.book;
    if (entry.source.text !== undefined) source.text = entry.source.text;
    out.source = source;
  }
  out.review = entry.review;
  if (entry.notes !== undefined) out.notes = entry.notes;
  if (entry.fit) {
    const f = entry.fit;
    out.fit = {
      state: f.state,
      stamp: f.stamp,
      difficulty: f.difficulty,
      winRate: f.winRate,
      tpkRate: f.tpkRate,
      avgHpLost: f.avgHpLost,
      checkedOn: f.checkedOn,
      checkedAtSession: f.checkedAtSession,
      ...(f.atMin !== undefined ? { atMin: f.atMin } : {}),
      ...(f.atMax !== undefined ? { atMax: f.atMax } : {}),
    };
  }
  if (entry.uses !== undefined) out.uses = entry.uses;
  if (entry.lastUsedSession !== undefined) out.lastUsedSession = entry.lastUsedSession;
  return out;
}

const YAML_OPTIONS = { lineWidth: 0 } as const;

/** The catalog as a markdown note: frontmatter, a title, an intro line, the board block, one `rpg encounter` block per entry. */
export function serializeCatalog(catalog: Catalog): string {
  const frontmatter = stringifyYaml(
    {
      type: CATALOG_TYPE,
      party: catalog.party.name,
      pcs: catalog.party.pcs,
      difficulty: catalog.difficulty,
      session: catalog.session,
      recheckEverySessions: catalog.recheckEverySessions,
      reuseAfterSessions: catalog.reuseAfterSessions,
      ...(catalog.profile ? { profile: { ...catalog.profile } } : {}),
    },
    YAML_OPTIONS
  );
  const lines = [
    "---",
    frontmatter.trimEnd(),
    "---",
    "",
    `# Encounter catalog: ${catalog.party.name}`,
    "",
    `\`\`\`${BOARD_INFO_STRING}`,
    // The body names the block, for Obsidian's reading view (which may lose the info string).
    "view: encounter-catalog",
    "```",
    "",
  ];
  if (catalog.entries.length > 0) {
    // The entries as written, folded away under the board (which shows them): open the callout to edit one.
    const n = catalog.entries.length;
    lines.push(
      `> [!abstract]- ${n === 1 ? "1 entry" : `${n} entries`} as written`,
      "> Edit a block by hand; `rpg sim catalog check` measures it again."
    );
    for (const entry of catalog.entries) {
      const block = [`\`\`\`${ENTRY_INFO_STRING}`, stringifyYaml(entryObject(entry), YAML_OPTIONS).trimEnd(), "```"];
      lines.push(">", ...block.flatMap((l) => l.split("\n")).map((l) => (l ? `> ${l}` : ">")));
    }
    lines.push("");
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------- parse

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

/** A string; numbers are accepted (a hand-typed row) and written back as strings. */
function str(v: unknown): string | undefined {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return undefined;
}

function splitFrontmatter(text: string): { front: string; body: string } {
  const match = /^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)/.exec(text);
  if (!match) throw new Error("Encounter catalog has no frontmatter (a --- block at the top)");
  return { front: match[1], body: text.slice(match[0].length) };
}

function parseFrontmatter(front: string): Omit<Catalog, "entries"> {
  let data: unknown;
  try {
    data = parseYaml(front);
  } catch (error) {
    throw new Error(`Encounter catalog frontmatter is not valid YAML: ${(error as Error).message}`);
  }
  if (!isObj(data)) throw new Error("Encounter catalog frontmatter must be a YAML mapping");
  if (data.type !== undefined && data.type !== CATALOG_TYPE) {
    throw new Error(`Encounter catalog frontmatter has type "${String(data.type)}", expected "${CATALOG_TYPE}"`);
  }
  const name = str(data.party);
  if (!name) throw new Error("Encounter catalog frontmatter needs a `party` name");
  const pcsRaw = data.pcs ?? [];
  if (!Array.isArray(pcsRaw) || pcsRaw.some((p) => typeof p !== "string")) {
    throw new Error("Encounter catalog frontmatter `pcs` must be a list of notes");
  }
  const difficulty = data.difficulty;
  if (typeof difficulty !== "string" || !DIFFICULTIES.includes(difficulty as Difficulty)) {
    throw new Error(
      `Encounter catalog frontmatter \`difficulty\` must be one of ${DIFFICULTIES.join(", ")}, got ${JSON.stringify(difficulty)}`
    );
  }
  const session = data.session ?? 0;
  if (typeof session !== "number" || !Number.isInteger(session) || session < 0) {
    throw new Error("Encounter catalog frontmatter `session` must be a whole number, 0 or more");
  }
  const every = data.recheckEverySessions ?? DEFAULT_RECHECK_EVERY_SESSIONS;
  if (typeof every !== "number" || !Number.isInteger(every) || every < 0) {
    throw new Error("Encounter catalog frontmatter `recheckEverySessions` must be a whole number, 0 or more");
  }
  const reuse = data.reuseAfterSessions ?? DEFAULT_REUSE_AFTER_SESSIONS;
  if (typeof reuse !== "number" || !Number.isInteger(reuse) || reuse < 0) {
    throw new Error("Encounter catalog frontmatter `reuseAfterSessions` must be a whole number, 0 or more");
  }
  return {
    party: { name, pcs: pcsRaw as string[] },
    ...(data.profile !== undefined && data.profile !== null ? { profile: parseProfile(data.profile) } : {}),
    difficulty: difficulty as Difficulty,
    session,
    recheckEverySessions: every,
    reuseAfterSessions: reuse,
  };
}

/** The frontmatter `profile` `catalog check` writes; a malformed one throws naming the key. */
function parseProfile(raw: unknown): CatalogProfile {
  if (!isObj(raw)) throw new Error("Encounter catalog frontmatter `profile` must be a mapping");
  const whole = (key: string): number => {
    const v = raw[key];
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0) {
      throw new Error(`Encounter catalog frontmatter \`profile.${key}\` must be a whole number`);
    }
    return v;
  };
  const text = (key: string): string => {
    const v = str(raw[key]);
    if (v === undefined) throw new Error(`Encounter catalog frontmatter \`profile.${key}\` must be text`);
    return v;
  };
  return {
    size: whole("size"),
    averageLevel: whole("averageLevel"),
    tier: whole("tier"),
    benchmark: text("benchmark"),
    singleCr: text("singleCr"),
    stamp: text("stamp"),
  };
}

function parseMonsters(raw: unknown, fail: (m: string) => never): CatalogMonster[] {
  if (!Array.isArray(raw) || raw.length === 0) fail("`monsters` must be a non-empty list");
  return raw.map((item, i) => {
    if (!isObj(item)) return fail(`monster #${i + 1} must be a mapping with a \`note\``);
    const note = str(item.note);
    if (!note) return fail(`monster #${i + 1} needs a \`note\` (the bestiary note)`);
    const count = item.count ?? 1;
    if (typeof count !== "number" || !Number.isInteger(count) || count < 1) {
      return fail(`monster "${note}" needs a \`count\` that is a whole number, 1 or more`);
    }
    const monster: CatalogMonster = { note, count };
    const dice = str(item.dice);
    if (item.dice !== undefined && item.dice !== null && dice === undefined) {
      return fail(`monster "${note}" has a \`dice\` that is not text`);
    }
    if (dice !== undefined) monster.dice = dice;
    return monster;
  });
}

function parseFit(raw: unknown, fail: (m: string) => never): FitState {
  if (!isObj(raw)) return fail("`fit` must be a mapping");
  const state = raw.state;
  if (typeof state !== "string" || !(FIT_STATES as readonly string[]).includes(state)) {
    return fail(`\`fit.state\` must be one of ${FIT_STATES.join(", ")}`);
  }
  const difficulty = raw.difficulty;
  if (typeof difficulty !== "string" || !DIFFICULTIES.includes(difficulty as Difficulty)) {
    return fail(`\`fit.difficulty\` must be one of ${DIFFICULTIES.join(", ")}`);
  }
  const stamp = str(raw.stamp);
  if (!stamp) return fail("`fit.stamp` is missing");
  const checkedOn = str(raw.checkedOn);
  if (!checkedOn) return fail("`fit.checkedOn` is missing");
  const num = (key: string): number => {
    const v = raw[key];
    if (typeof v !== "number" || !Number.isFinite(v)) return fail(`\`fit.${key}\` must be a number`);
    return v;
  };
  const bound = (key: "atMin" | "atMax"): FitState["state"] | undefined => {
    const v = raw[key];
    if (v === undefined || v === null) return undefined;
    if (typeof v !== "string" || !(FIT_STATES as readonly string[]).includes(v)) {
      return fail(`\`fit.${key}\` must be one of ${FIT_STATES.join(", ")}`);
    }
    return v as FitState["state"];
  };
  const atMin = bound("atMin");
  const atMax = bound("atMax");
  return {
    ...(atMin !== undefined ? { atMin } : {}),
    ...(atMax !== undefined ? { atMax } : {}),
    state: state as FitState["state"],
    stamp,
    difficulty: difficulty as Difficulty,
    winRate: num("winRate"),
    tpkRate: num("tpkRate"),
    avgHpLost: num("avgHpLost"),
    checkedOn,
    checkedAtSession: num("checkedAtSession"),
  };
}

function parseEntry(yamlText: string, index: number, taken: Set<string>): CatalogEntry {
  const label = `Encounter entry #${index}`;
  let data: unknown;
  try {
    data = parseYaml(yamlText);
  } catch (error) {
    throw new Error(`${label} is not valid YAML: ${(error as Error).message}`);
  }
  if (!isObj(data)) throw new Error(`${label} must be a YAML mapping`);
  const name = str(data.name);
  const where = name ? `${label} ("${name}")` : label;
  const fail: (message: string) => never = (message) => {
    throw new Error(`${where}: ${message}`);
  };
  if (!name || !name.trim()) fail("`name` is missing");
  const monsters = parseMonsters(data.monsters, fail);

  let tags: string[] = [];
  if (data.tags !== undefined && data.tags !== null) {
    if (!Array.isArray(data.tags)) fail("`tags` must be a list");
    tags = data.tags.map((t) => {
      const tag = str(t);
      if (tag === undefined) return fail("`tags` must hold only text");
      return tag;
    });
  }

  let source: CatalogSource | undefined;
  if (data.source !== undefined && data.source !== null) {
    if (!isObj(data.source)) fail("`source` must be a mapping");
    const raw: Obj = data.source;
    const note = str(raw.note);
    if (!note) fail("`source.note` is missing");
    source = { note };
    for (const key of ["table", "row", "book", "text"] as const) {
      const v = str(raw[key]);
      if (raw[key] !== undefined && raw[key] !== null && v === undefined) fail(`\`source.${key}\` must be text`);
      if (v !== undefined) source[key] = v;
    }
  }

  const review = data.review ?? "draft";
  if (review !== "draft" && review !== "confirmed") fail("`review` must be draft or confirmed");

  const id = data.id === undefined || data.id === null ? slugId(name, monsters, taken) : str(data.id);
  if (!id) return fail("`id` must be text");
  if (taken.has(id)) fail(`id "${id}" is already used by an earlier entry`);

  const entry: CatalogEntry = {
    id,
    name,
    monsters,
    tags,
    review: review as ReviewFlag,
  };
  if (source) entry.source = source;
  if (data.notes !== undefined && data.notes !== null) {
    const notes = str(data.notes);
    if (notes === undefined) fail("`notes` must be text");
    entry.notes = notes;
  }
  if (data.fit !== undefined && data.fit !== null) entry.fit = parseFit(data.fit, fail);
  for (const key of ["uses", "lastUsedSession"] as const) {
    const v = data[key];
    if (v === undefined || v === null) continue;
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0) fail(`\`${key}\` must be a whole number, 0 or more`);
    entry[key] = v;
  }
  return entry;
}

/** One entry block's YAML read as an entry (the plugin renders each block on its own). */
export function parseEntryBlock(yamlText: string): CatalogEntry {
  return parseEntry(yamlText, 1, new Set());
}

/**
 * Reads a catalog note. Prose between the blocks is ignored, comments and key
 * order inside a block do not matter, and a missing optional key takes its
 * default (no tags, no source, review `draft`, an id made from the name). A
 * malformed entry throws an Error that names it.
 */
export function parseCatalog(text: string): Catalog {
  const { front, body } = splitFrontmatter(text.replace(/\r\n?/g, "\n"));
  const header = parseFrontmatter(front);
  const entries: CatalogEntry[] = [];
  const taken = new Set<string>();

  // Entries may sit in a callout (`> ` before each line, as the note is written): read them without it.
  const lines = body.split("\n").map((line) => line.replace(/^>[ \t]?/, ""));
  const open = /^(`{3,})\s*(?:yaml|rpg)\s+encounter\s*$/;
  for (let i = 0; i < lines.length; i += 1) {
    const match = open.exec(lines[i]);
    if (!match) continue;
    const fence = match[1];
    const block: string[] = [];
    let closed = false;
    for (i += 1; i < lines.length; i += 1) {
      if (new RegExp(`^${fence}\`*\\s*$`).test(lines[i])) {
        closed = true;
        break;
      }
      block.push(lines[i]);
    }
    const index = entries.length + 1;
    if (!closed) throw new Error(`Encounter entry #${index}: the \`${ENTRY_INFO_STRING}\` block is never closed`);
    const entry = parseEntry(block.join("\n"), index, taken);
    taken.add(entry.id);
    entries.push(entry);
  }
  return { ...header, entries };
}
