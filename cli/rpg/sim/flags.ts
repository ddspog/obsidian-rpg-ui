import { parseArgs } from "node:util";
import {
  DEFAULT_RECHECK_EVERY_SESSIONS,
  DEFAULT_REUSE_AFTER_SESSIONS,
  type ReviewFlag,
} from "lib/domains/encounter-catalog/catalog";
import type { Confidence } from "lib/domains/encounter-catalog/extract-row";
import type { FitStateName } from "lib/domains/encounter-catalog/fit-state";
import { parseCr } from "lib/domains/encounter-sim/difficulty";
import {
  MONSTER_ROLES,
  parseRole,
  parseSubrole,
  type MonsterRole,
  type Subrole,
} from "lib/domains/encounter-sim/monster-role";

/** A wrong flag, value or subcommand of `rpg sim` (exit 1, with the usage). */
export class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UsageError";
  }
}

export type Difficulty = "easy" | "challenging" | "deadly";

export const DIFFICULTIES: readonly Difficulty[] = ["easy", "challenging", "deadly"];

export type Rank = "cr" | "outcome";

export const RANKS: readonly Rank[] = ["cr", "outcome"];

/** Which tiers of play an encounter may be from: the party's own, it and lower ones, or any. */
export type TierScope = "same" | "lower" | "all";

export const TIER_SCOPES: readonly TierScope[] = ["same", "lower", "all"];

export const CONFIDENCES: readonly Confidence[] = ["high", "medium", "low"];

export const FIT_STATE_NAMES: readonly FitStateName[] = ["fit", "too-easy", "too-hard"];

export const REVIEW_FLAGS: readonly ReviewFlag[] = ["draft", "confirmed"];

/** The actions of `rpg sim catalog <action>`. */
export const CATALOG_ACTIONS = [
  "init",
  "draft",
  "add",
  "confirm",
  "remove",
  "tag",
  "use",
  "prepare",
  "session",
  "check",
  "suggest",
  "list",
] as const;
export type CatalogAction = (typeof CATALOG_ACTIONS)[number];

export interface SimFlag {
  name: string;
  kind: "string" | "boolean";
  multiple?: boolean;
  default: string | number | boolean | string[] | undefined;
  description: string;
  short?: string;
  /** The placeholder shown for the flag's value in the help. */
  value?: string;
}

/** Every flag of `rpg sim`: parsed from this table and the help is written from it. */
export const SIM_FLAGS: readonly SimFlag[] = [
  {
    name: "pc",
    kind: "string",
    multiple: true,
    default: [],
    value: "<note>",
    description: "a party member's note; repeat for each (default: the four stock characters)",
  },
  {
    name: "monster",
    kind: "string",
    multiple: true,
    default: [],
    value: '"<note>[:<count>]"',
    description: "a monster note and how many (count defaults to 1); repeat for each group",
  },
  {
    name: "base",
    kind: "string",
    multiple: true,
    default: [],
    value: '"<note>[:<count>]"',
    description:
      "`suggest`, `plan`: a group always in the fight (as --monster); one more kind is swept and added to it; repeat for each",
  },
  {
    name: "seed",
    kind: "string",
    default: 1,
    value: "<n>",
    description: "the random seed (an integer); the same seed gives the same result",
  },
  {
    name: "trials",
    kind: "string",
    default: 200,
    value: "<n>",
    description: "how many fights to simulate (a positive integer)",
  },
  {
    name: "rounds",
    kind: "string",
    default: 20,
    value: "<n>",
    description: "the round cap of a fight (a positive integer)",
  },
  {
    name: "difficulty",
    kind: "string",
    default: "challenging",
    value: "easy|challenging|deadly",
    description:
      "the difficulty `suggest` aims for (`catalog init`: the one the catalog's encounters are judged by; `plan`: the catalog's)",
  },
  {
    name: "tiers",
    kind: "string",
    default: "same",
    value: "same|lower|all",
    description:
      "`suggest`, `plan`, `catalog check|suggest|list`: encounters of the party's tier only (same), also lower tiers for story use (lower), or any (all); an untagged entry or a swept monster is in the tier when no monster is above the party's single-monster CR",
  },
  {
    name: "rank",
    kind: "string",
    default: "outcome",
    value: "cr|outcome",
    description:
      "`suggest`: rank by simulated outcome with a wide sweep (outcome), or by total CR near the target (cr)",
  },
  {
    name: "habitat",
    kind: "string",
    default: undefined,
    value: "<name>",
    description: "`suggest`, `plan`: only monsters of this habitat (`plan`: also catalog entries tagged with it)",
  },
  {
    name: "type",
    kind: "string",
    default: undefined,
    value: "<text>",
    description: "`suggest`, `plan`: only monsters whose type contains this text",
  },
  {
    name: "cr",
    kind: "string",
    default: undefined,
    value: "<cr>",
    description: "`suggest`, `plan`: only monsters of exactly this CR (e.g. 1/2)",
  },
  {
    name: "limit",
    kind: "string",
    default: 20,
    value: "<n>",
    description:
      "`suggest`: the most candidates to list (0 or more); `plan`: the most options (3); `catalog`: the most entries to check or list (draft: 40, suggest: 10, check and list: all)",
  },
  {
    name: "party-name",
    kind: "string",
    default: undefined,
    value: '"<name>"',
    description: "`catalog init`: the party's name (the catalog's file is named from it)",
  },
  {
    name: "catalog",
    kind: "string",
    default: undefined,
    value: "<path|party name>",
    description:
      "`catalog`, `plan`: the catalog note, a vault path or a party name (default: the one catalog under <system>/gm-tools/encounter-catalog/)",
  },
  {
    name: "name",
    kind: "string",
    default: undefined,
    value: '"<name>"',
    description: "`catalog add`: the encounter's name",
  },
  {
    name: "every",
    kind: "string",
    default: DEFAULT_RECHECK_EVERY_SESSIONS,
    value: "<n>",
    description: "`catalog init`: check an entry again after this many sessions (0 turns it off)",
  },
  {
    name: "reuse-after",
    kind: "string",
    default: DEFAULT_REUSE_AFTER_SESSIONS,
    value: "<n>",
    description: "`catalog init`: an encounter run at session S is offered again from session S + n (0: at once)",
  },
  {
    name: "session",
    kind: "string",
    default: undefined,
    value: "<n>",
    description:
      "`catalog init|check|suggest|use`, `plan`: the party's session number (default: 0 on init, else the catalog's own); `catalog session`: set it",
  },
  {
    name: "add-tag",
    kind: "string",
    multiple: true,
    default: [],
    value: "<tag>",
    description: "`catalog tag`: a tag to add to the entries; repeat for each",
  },
  {
    name: "drop-tag",
    kind: "string",
    multiple: true,
    default: [],
    value: "<tag>",
    description: "`catalog tag`: a tag to take off the entries (plural or not); repeat for each",
  },
  {
    name: "include-used",
    kind: "boolean",
    default: false,
    description: "`catalog suggest`, `plan`: also entries run too recently (see --reuse-after)",
  },
  {
    name: "fit",
    kind: "string",
    multiple: true,
    default: [],
    value: "fit|too-easy|too-hard",
    description: "`suggest`: only candidates with this fit; repeat for each (default: all)",
  },
  {
    name: "tag",
    kind: "string",
    multiple: true,
    default: [],
    value: "<tag>",
    description: "`catalog`, `plan`: a tag the entry must have; repeat for each (all must match)",
  },
  {
    name: "any-tag",
    kind: "string",
    multiple: true,
    default: [],
    value: "<tag>",
    description: "`catalog suggest|list`, `plan`: the entry must have at least one of these tags; repeat for each",
  },
  {
    name: "state",
    kind: "string",
    multiple: true,
    default: [],
    value: "fit|too-easy|too-hard",
    description: "`catalog suggest|list`: the fit states to show; repeat for each (suggest default: fit)",
  },
  {
    name: "review",
    kind: "string",
    default: undefined,
    value: "draft|confirmed",
    description: "`catalog list`: only entries with this review flag",
  },
  {
    name: "min-confidence",
    kind: "string",
    default: "high",
    value: "high|medium|low",
    description: "`catalog draft`: with --accept, the lowest confidence that is written to the catalog",
  },
  {
    name: "accept",
    kind: "boolean",
    default: false,
    description: "`catalog draft`: write the drafts (at or above --min-confidence) to the catalog; else a dry run",
  },
  {
    name: "force",
    kind: "boolean",
    default: false,
    description: "`catalog check`: simulate every entry again, not only the ones that need it",
  },
  {
    name: "refresh",
    kind: "boolean",
    default: false,
    description: "`catalog suggest`: run `check` first, then suggest",
  },
  {
    name: "include-stale",
    kind: "boolean",
    default: false,
    description: "`catalog suggest`: also entries whose fit is out of date or unchecked",
  },
  {
    name: "include-draft",
    kind: "boolean",
    default: false,
    description: "`catalog suggest`: also entries nobody has confirmed",
  },
  {
    name: "brief",
    kind: "boolean",
    default: false,
    description:
      "`run`, `suggest`, `catalog suggest`: the short answer a model needs (groups as --monster takes them, no per-trial arrays or statblocks)",
  },
  {
    name: "role",
    kind: "string",
    multiple: true,
    default: [],
    value: "<role|subrole>",
    description:
      "`roles`: only monsters of this role (controller, leader, soldier, striker) or subrole (ambusher, healer…); repeat for each; `equivalents`: look for this role or subrole instead of the monster's own",
  },
  {
    name: "write",
    kind: "boolean",
    default: false,
    description:
      "`roles`: write each guess at or above --min-confidence as `role:` in its statblock (never over a written role); else a dry run",
  },
  {
    name: "set",
    kind: "string",
    multiple: true,
    default: [],
    value: '"<note>=<role>/<subrole>"',
    description:
      "`roles`: write this role and subrole in the monster's statblock (over any written; the role alone, or the subrole alone with its role implied); repeat for each",
  },
  {
    name: "steps",
    kind: "string",
    default: 1,
    value: "<n>",
    description: "`equivalents`: how many steps of the CR ladder (… 1/4, 1/2, 1, 2 …) from the monster's CR to look",
  },
  {
    name: "vault",
    kind: "string",
    default: undefined,
    value: "<path>",
    description: "the vault (default: $RPG_VAULT, else the one this plugin is in)",
  },
  {
    name: "json",
    kind: "boolean",
    default: false,
    description: "accepted for symmetry: the output is always one JSON document",
  },
  {
    name: "help",
    kind: "boolean",
    short: "h",
    default: false,
    description: "this help",
  },
];

export interface MonsterGroup {
  note: string;
  count: number;
}

export interface SimOptions {
  /** The subcommand: `run`, `suggest`, `plan` or `catalog` (others are the dispatcher's to refuse). */
  subcommand: string | undefined;
  /** `catalog` only: the action (the second bare word). */
  action?: string;
  /** `catalog`: the bare words after the action (notes and folders to draft from, entry ids); `plan`: the theme words. */
  args: string[];
  pc: string[];
  monsters: MonsterGroup[];
  /** `suggest` only: groups that are always part of the fight. */
  base: MonsterGroup[];
  seed: number;
  trials: number;
  rounds: number;
  difficulty: Difficulty;
  rank: Rank;
  tiers: TierScope;
  habitat?: string;
  type?: string;
  cr?: string;
  limit: number;
  /** The flags that were written on the command line (long names), in no order; `catalog` checks them against its action. */
  given: string[];
  /** Whether --limit was given (the catalog actions have defaults of their own). */
  limitSet: boolean;
  partyName?: string;
  catalog?: string;
  name?: string;
  every?: number;
  reuseAfter?: number;
  session?: number;
  addTags: string[];
  dropTags: string[];
  includeUsed: boolean;
  /** `suggest`: the fits to keep (empty: all). */
  fits: FitStateName[];
  tags: string[];
  anyTags: string[];
  states: FitStateName[];
  review?: ReviewFlag;
  minConfidence: Confidence;
  accept: boolean;
  force: boolean;
  refresh: boolean;
  includeStale: boolean;
  includeDraft: boolean;
  vault?: string;
  json: boolean;
  /** `run`, `suggest`, `catalog suggest`: print the short form (see brief.ts). */
  brief: boolean;
  /** `roles`: the roles or subroles to list; `equivalents`: the role or subrole to look for. */
  roles: Array<MonsterRole | Subrole>;
  /** `roles`: `<note>=<role>` to write. */
  set: string[];
  /** `roles`: write the guesses. */
  write: boolean;
  /** `equivalents`: CR ladder steps to look. */
  steps: number;
}

export interface ParsedSim {
  subcommand: string | undefined;
  help: boolean;
  options: SimOptions;
}

function flagDefault<T>(name: string): T {
  const flag = SIM_FLAGS.find((f) => f.name === name);
  if (!flag) throw new Error(`No sim flag "${name}".`);
  return flag.default as T;
}

function defaultOptions(subcommand: string | undefined): SimOptions {
  return {
    subcommand,
    args: [],
    pc: [],
    monsters: [],
    base: [],
    seed: flagDefault<number>("seed"),
    trials: flagDefault<number>("trials"),
    rounds: flagDefault<number>("rounds"),
    difficulty: flagDefault<Difficulty>("difficulty"),
    rank: flagDefault<Rank>("rank"),
    tiers: flagDefault<TierScope>("tiers"),
    limit: flagDefault<number>("limit"),
    given: [],
    limitSet: false,
    tags: [],
    anyTags: [],
    states: [],
    addTags: [],
    dropTags: [],
    includeUsed: false,
    fits: [],
    minConfidence: flagDefault<Confidence>("min-confidence"),
    accept: false,
    force: false,
    refresh: false,
    includeStale: false,
    includeDraft: false,
    json: false,
    brief: false,
    roles: [],
    set: [],
    write: false,
    steps: flagDefault<number>("steps"),
  };
}

/** The values of a repeatable tag flag, trimmed; an empty one is refused. */
function tagList(flag: string, raw: string | boolean | string[] | undefined): string[] {
  const values = Array.isArray(raw) ? raw : [];
  return values.map((value) => {
    const tag = value.trim();
    if (!tag) throw new UsageError(`--${flag} needs a tag, got an empty value.`);
    return tag;
  });
}

/** Upper bounds that keep a run's memory and time sane (per-trial arrays, one combatant per monster). */
export const MAX_TRIALS = 100_000;
export const MAX_MONSTER_COUNT = 100;

const INTEGER = /^[+-]?\d+$/;

function integer(flag: string, raw: string, min: number | undefined, what: string): number {
  const text = raw.trim();
  const n = INTEGER.test(text) ? Number(text) : NaN;
  if (!Number.isSafeInteger(n) || (min !== undefined && n < min)) {
    throw new UsageError(`--${flag} must be ${what}, got "${raw}".`);
  }
  return n;
}

/** `Note:3` -> {note, count}: split at the last colon, no colon means one. `flag` names the option in errors. */
export function parseMonster(raw: string, flag = "monster"): MonsterGroup {
  const at = raw.lastIndexOf(":");
  if (at < 0) {
    if (!raw.trim()) throw new UsageError(`--${flag} must name a note, got "${raw}".`);
    return { note: raw.trim(), count: 1 };
  }
  const note = raw.slice(0, at).trim();
  const suffix = raw.slice(at + 1).trim();
  if (!/^\d+$/.test(suffix) || !Number.isSafeInteger(Number(suffix)) || Number(suffix) < 1) {
    throw new UsageError(
      `--${flag} "${raw}": the count "${suffix}" must be a positive integer (use "Name:3" or just "Name").`
    );
  }
  if (!note) throw new UsageError(`--${flag} "${raw}" has no note name.`);
  if (Number(suffix) > MAX_MONSTER_COUNT) {
    throw new UsageError(`--${flag} "${raw}": the count "${suffix}" must be at most ${MAX_MONSTER_COUNT}.`);
  }
  return { note, count: Number(suffix) };
}

/**
 * Whether the tokens ask for help: `-h`/`--help` anywhere, or `help` as the first bare token.
 * Decided before any parsing, so help wins over every other error.
 */
function asksForHelp(tokens: string[]): boolean {
  if (tokens.some((t) => t === "-h" || t === "--help")) return true;
  // Only a leading `help`: a later bare token may be a flag's value (`--monster help`), and the
  // `--vault X help` form is the parsed subcommand, which dispatch treats as help too.
  return tokens[0] === "help";
}

function parseOptionsTable(): Record<string, { type: "string" | "boolean"; multiple?: boolean; short?: string }> {
  const table: Record<string, { type: "string" | "boolean"; multiple?: boolean; short?: string }> = {};
  for (const flag of SIM_FLAGS) {
    table[flag.name] = {
      type: flag.kind,
      ...(flag.multiple ? { multiple: true } : {}),
      ...(flag.short ? { short: flag.short } : {}),
    };
  }
  return table;
}

/** Parse and validate the tokens after `sim`. Throws UsageError on any bad flag or value. */
export function parseSimArgv(tokens: string[]): ParsedSim {
  if (asksForHelp(tokens)) {
    return { subcommand: tokens[0] === "help" ? "help" : undefined, help: true, options: defaultOptions(undefined) };
  }

  let parsed;
  try {
    parsed = parseArgs({
      args: tokens,
      allowPositionals: true,
      strict: true,
      options: parseOptionsTable(),
    });
  } catch (err) {
    throw new UsageError(err instanceof Error ? err.message : String(err));
  }
  const values = parsed.values as Record<string, string | boolean | string[] | undefined>;
  const [subcommand, ...extra] = parsed.positionals;
  // `catalog` takes an action and then bare words of its own, `plan` theme words; the others take none.
  const isCatalog = subcommand === "catalog";
  const takesWords = subcommand === "plan" || subcommand === "roles" || subcommand === "equivalents";
  if (!isCatalog && !takesWords && extra.length) {
    throw new UsageError(`Unexpected argument "${extra[0]}".`);
  }

  const options = defaultOptions(subcommand);
  if (isCatalog) {
    options.action = extra[0];
    options.args = extra.slice(1);
  } else if (subcommand === "plan") {
    options.args = extra.flatMap((word) => word.split(/\s+/)).filter((word) => word.length > 0);
  } else if (takesWords) {
    options.args = extra.map((word) => word.trim()).filter((word) => word.length > 0);
  }

  const pcs = (values.pc as string[] | undefined) ?? [];
  for (const pc of pcs) {
    if (!pc.trim()) throw new UsageError(`--pc needs a note, got an empty value.`);
  }
  options.pc = pcs.map((pc) => pc.trim());
  options.monsters = ((values.monster as string[] | undefined) ?? []).map((m) => parseMonster(m));
  options.base = ((values.base as string[] | undefined) ?? []).map((m) => parseMonster(m, "base"));

  if (typeof values.seed === "string") {
    options.seed = integer("seed", values.seed, undefined, "an integer");
    // The stream folds its seed to 32 bits: a larger one would silently repeat another seed's run.
    if (Math.abs(options.seed) > 0xffffffff) {
      throw new UsageError(`--seed must be an integer no larger than 4294967295, got "${values.seed}".`);
    }
  }
  if (typeof values.trials === "string") {
    options.trials = integer("trials", values.trials, 1, "a positive integer");
    if (options.trials > MAX_TRIALS) {
      throw new UsageError(`--trials must be at most ${MAX_TRIALS}, got "${values.trials}".`);
    }
  }
  if (typeof values.rounds === "string") {
    options.rounds = integer("rounds", values.rounds, 1, "a positive integer");
  }
  if (typeof values.limit === "string") {
    options.limit = integer("limit", values.limit, 0, "a non-negative integer");
    options.limitSet = true;
  }
  if (typeof values.every === "string") options.every = integer("every", values.every, 0, "a non-negative integer");
  if (typeof values.session === "string") {
    options.session = integer("session", values.session, 0, "a non-negative integer");
  }
  if (typeof values["reuse-after"] === "string") {
    options.reuseAfter = integer("reuse-after", values["reuse-after"], 0, "a non-negative integer");
  }
  options.addTags = tagList("add-tag", values["add-tag"]);
  options.dropTags = tagList("drop-tag", values["drop-tag"]);
  options.includeUsed = values["include-used"] === true;
  options.fits = ((values.fit as string[] | undefined) ?? []).map((raw) => {
    const fit = raw.trim().toLowerCase();
    if (!(FIT_STATE_NAMES as readonly string[]).includes(fit)) {
      throw new UsageError(`--fit must be one of ${FIT_STATE_NAMES.join(", ")}, got "${raw}".`);
    }
    return fit as FitStateName;
  });
  options.tags = tagList("tag", values.tag);
  options.anyTags = tagList("any-tag", values["any-tag"]);
  options.states = ((values.state as string[] | undefined) ?? []).map((raw) => {
    const state = raw.trim().toLowerCase();
    if (!(FIT_STATE_NAMES as readonly string[]).includes(state)) {
      throw new UsageError(`--state must be one of ${FIT_STATE_NAMES.join(", ")}, got "${raw}".`);
    }
    return state as FitStateName;
  });
  if (typeof values.review === "string") {
    const review = values.review.trim().toLowerCase();
    if (!(REVIEW_FLAGS as readonly string[]).includes(review)) {
      throw new UsageError(`--review must be one of ${REVIEW_FLAGS.join(", ")}, got "${values.review}".`);
    }
    options.review = review as ReviewFlag;
  }
  if (typeof values["min-confidence"] === "string") {
    const confidence = values["min-confidence"].trim().toLowerCase();
    if (!(CONFIDENCES as readonly string[]).includes(confidence)) {
      throw new UsageError(
        `--min-confidence must be one of ${CONFIDENCES.join(", ")}, got "${values["min-confidence"]}".`
      );
    }
    options.minConfidence = confidence as Confidence;
  }
  for (const flag of ["party-name", "catalog", "name"] as const) {
    const value = values[flag];
    if (typeof value === "string" && !value.trim()) throw new UsageError(`--${flag} needs a value, got an empty one.`);
  }
  if (typeof values["party-name"] === "string") options.partyName = values["party-name"].trim();
  if (typeof values.catalog === "string") options.catalog = values.catalog.trim();
  if (typeof values.name === "string") options.name = values.name.trim();
  options.given = Object.entries(values)
    .filter(([, value]) => value !== undefined)
    .map(([flag]) => flag);
  options.accept = values.accept === true;
  options.force = values.force === true;
  options.refresh = values.refresh === true;
  options.includeStale = values["include-stale"] === true;
  options.includeDraft = values["include-draft"] === true;
  if (typeof values.difficulty === "string") {
    const d = values.difficulty.trim().toLowerCase();
    if (!(DIFFICULTIES as readonly string[]).includes(d)) {
      throw new UsageError(`--difficulty must be one of ${DIFFICULTIES.join(", ")}, got "${values.difficulty}".`);
    }
    options.difficulty = d as Difficulty;
  }
  if (typeof values.rank === "string") {
    const r = values.rank.trim().toLowerCase();
    if (!(RANKS as readonly string[]).includes(r)) {
      throw new UsageError(`--rank must be one of ${RANKS.join(", ")}, got "${values.rank}".`);
    }
    options.rank = r as Rank;
  }
  if (typeof values.tiers === "string") {
    const t = values.tiers.trim().toLowerCase();
    if (!(TIER_SCOPES as readonly string[]).includes(t)) {
      throw new UsageError(`--tiers must be one of ${TIER_SCOPES.join(", ")}, got "${values.tiers}".`);
    }
    options.tiers = t as TierScope;
  }
  if (typeof values.habitat === "string") options.habitat = values.habitat;
  if (typeof values.type === "string") options.type = values.type;
  if (typeof values.cr === "string") options.cr = values.cr;
  if (typeof values.vault === "string") options.vault = values.vault;
  options.json = values.json === true;
  options.brief = values.brief === true;
  options.roles = ((values.role as string[] | undefined) ?? []).map((raw) => {
    const role = parseRole(raw) ?? parseSubrole(raw);
    if (!role) {
      throw new UsageError(`--role must be one of ${MONSTER_ROLES.join(", ")} or one of their subroles, got "${raw}".`);
    }
    return role;
  });
  options.set = ((values.set as string[] | undefined) ?? []).map((raw) => raw.trim());
  options.write = values.write === true;
  if (typeof values.steps === "string") options.steps = integer("steps", values.steps, 0, "a non-negative integer");

  return { subcommand, help: false, options };
}

/** The flags each `catalog` action takes (besides the common ones); any other flag is a usage error. */
const CATALOG_FLAGS: Record<CatalogAction, readonly string[]> = {
  init: ["party-name", "pc", "difficulty", "every", "reuse-after", "session"],
  draft: ["min-confidence", "accept", "limit"],
  add: ["name", "monster", "tag"],
  confirm: [],
  remove: [],
  tag: ["add-tag", "drop-tag"],
  use: ["session"],
  prepare: [],
  session: ["session"],
  check: ["session", "seed", "trials", "rounds", "force", "limit", "tiers"],
  suggest: [
    "tag",
    "any-tag",
    "state",
    "include-stale",
    "include-draft",
    "limit",
    "refresh",
    "session",
    "seed",
    "trials",
    "rounds",
    "brief",
    "include-used",
    "tiers",
  ],
  list: ["tag", "any-tag", "state", "review", "limit", "tiers"],
};

const CATALOG_COMMON_FLAGS = ["catalog", "vault", "json", "help"];

function validateCatalog(options: SimOptions): void {
  const action = options.action;
  if (action === undefined) {
    throw new UsageError(`\`catalog\` needs an action: ${CATALOG_ACTIONS.join(", ")}.`);
  }
  if (!(CATALOG_ACTIONS as readonly string[]).includes(action)) {
    throw new UsageError(`Unknown catalog action "${action}" (use ${CATALOG_ACTIONS.join(", ")}).`);
  }
  const known = action as CatalogAction;
  const allowed = new Set([...CATALOG_COMMON_FLAGS, ...CATALOG_FLAGS[known]]);
  for (const flag of options.given) {
    if (!allowed.has(flag)) throw new UsageError(`--${flag} is not a flag of \`catalog ${known}\`.`);
  }
  const takesWords = ["draft", "confirm", "remove", "tag", "use", "prepare"].includes(known);
  if (!takesWords && options.args.length > 0) {
    throw new UsageError(`Unexpected argument "${options.args[0]}" for \`catalog ${known}\`.`);
  }
  if (known === "init" && options.partyName === undefined) {
    throw new UsageError('--party-name is required: name the party ("The Ashen Four").');
  }
  if (known === "draft" && options.args.length === 0) {
    throw new UsageError("`catalog draft` needs at least one note or folder of the vault to draft from.");
  }
  if (known === "add") {
    if (options.name === undefined) throw new UsageError('--name is required: name the encounter ("Goblin ambush").');
    if (options.monsters.length === 0) {
      throw new UsageError('--monster is required: name at least one monster note ("Note" or "Note:3").');
    }
  }
  if (known === "tag" && options.addTags.length + options.dropTags.length === 0) {
    throw new UsageError("`catalog tag` needs --add-tag or --drop-tag (or both).");
  }
  if (["confirm", "remove", "tag", "use", "prepare"].includes(known) && options.args.length === 0) {
    throw new UsageError(`\`catalog ${known}\` needs at least one entry id.`);
  }
}

/** The flags `plan` takes; any other is a usage error (it always ranks by outcome, and is always brief). */
const PLAN_FLAGS = [
  "pc",
  "base",
  "difficulty",
  "habitat",
  "type",
  "cr",
  "tag",
  "any-tag",
  "limit",
  "catalog",
  "session",
  "include-used",
  "tiers",
  "seed",
  "trials",
  "rounds",
  "vault",
  "json",
  "help",
];

/** The flags `roles` and `equivalents` take. */
const ROLES_FLAGS = [
  "role",
  "write",
  "set",
  "min-confidence",
  "habitat",
  "type",
  "cr",
  "limit",
  "vault",
  "json",
  "help",
];
const EQUIVALENTS_FLAGS = ["role", "steps", "habitat", "type", "limit", "vault", "json", "help"];

function validateRoles(subcommand: "roles" | "equivalents", options: SimOptions): void {
  const allowed = subcommand === "roles" ? ROLES_FLAGS : EQUIVALENTS_FLAGS;
  for (const flag of options.given) {
    if (!allowed.includes(flag)) throw new UsageError(`--${flag} is not a flag of \`${subcommand}\`.`);
  }
  if (subcommand === "equivalents") {
    if (options.args.length !== 1)
      throw new UsageError("`equivalents` needs one monster note (quote a name with spaces).");
    if (options.roles.length > 1) throw new UsageError("`equivalents` takes one --role.");
  }
  if (subcommand === "roles" && options.set.length && (options.write || options.args.length)) {
    throw new UsageError("--set writes the roles it names: pass it without --write or notes.");
  }
}

function validatePlan(options: SimOptions): void {
  for (const flag of options.given) {
    if (!PLAN_FLAGS.includes(flag)) throw new UsageError(`--${flag} is not a flag of \`plan\`.`);
  }
  if (options.pc.length > 0 && options.catalog !== undefined) {
    throw new UsageError("--pc and --catalog: a catalog has its own party; pass one or the other.");
  }
}

/**
 * What a subcommand needs before it may run, checked before the vault boots (a usage error exits 1,
 * ahead of any runtime error).
 */
export function validateForSubcommand(subcommand: string, options: SimOptions): void {
  if (subcommand === "run" && options.base.length > 0) {
    throw new UsageError("--base is for `suggest`; use --monster to name the groups of a run.");
  }
  if (subcommand === "run" && options.monsters.length === 0) {
    throw new UsageError('--monster is required: name at least one monster note ("Note" or "Note:3").');
  }
  if (subcommand === "catalog") {
    validateCatalog(options);
    return;
  }
  if (subcommand === "plan") validatePlan(options);
  if (subcommand === "roles" || subcommand === "equivalents") validateRoles(subcommand, options);
  if ((subcommand === "suggest" || subcommand === "plan") && options.cr !== undefined) {
    try {
      parseCr(options.cr);
    } catch {
      throw new UsageError(`--cr must be a whole number or a fraction such as 1/2, got "${options.cr}".`);
    }
  }
}

function show(value: SimFlag["default"]): string {
  if (Array.isArray(value)) return "none";
  if (value === undefined) return "none";
  return String(value);
}

function helpLines(): string {
  const left = SIM_FLAGS.map((f) => {
    const short = f.short ? `-${f.short}, ` : "";
    const value = f.kind === "string" ? ` ${f.value ?? "<value>"}` : "";
    return `${short}--${f.name}${value}`;
  });
  const width = Math.max(...left.map((l) => l.length));
  return SIM_FLAGS.map((f, i) => {
    // A description that spells out its own default (the stock party, the vault lookup) is not repeated.
    const note = f.name === "help" || f.description.includes("(default") ? "" : ` (default: ${show(f.default)})`;
    return `  ${left[i].padEnd(width)}  ${f.description}${note}`;
  }).join("\n");
}

/** The help of `rpg sim`, written from SIM_FLAGS. */
export const SIM_HELP = `rpg sim: run an encounter simulation, suggest or plan encounters, keep a catalog of them, or read monster roles

Usage:
  rpg sim run --monster "<note>[:<count>]" [--pc <note>]... [--brief] [flags]
  rpg sim suggest [--pc <note>]... [--base "<note>[:<count>]"]... [--rank outcome|cr] [--tiers T] [--fit F]... [--brief] [flags]
  rpg sim plan [<theme words>] [--habitat H] [--tag <tag>]... [--tiers same|lower|all] [--difficulty D] [--limit N] [flags]
    (the catalog's fit entries first, then the bestiary swept by outcome: N short options, default 3)
  rpg sim catalog init --party-name "<name>" [--pc <note>]... [--difficulty D] [--every N] [--reuse-after N] [--session N]
  rpg sim catalog draft <note-or-folder>... [--min-confidence high|medium|low] [--accept] [--limit N]
  rpg sim catalog add --name "<name>" --monster "<note>[:<count>]"... [--tag <tag>]...
  rpg sim catalog confirm <id>...        (flip drafts to confirmed)
  rpg sim catalog remove <id>...
  rpg sim catalog tag <id>... [--add-tag <tag>]... [--drop-tag <tag>]...
  rpg sim catalog use <id>... [--session N]   (the encounter was run: not offered again for --reuse-after sessions)
  rpg sim catalog prepare <id>...       (an [Enc:] line in the party's latest session log; Start Combat offers it)
  rpg sim catalog session [--session N]  (the party's session: counted from the vault's session notes, or set)
  rpg sim catalog check [--session N] [--force] [--limit N] [--seed N] [--trials N] [--rounds N]
  rpg sim catalog suggest [--tag <tag>]... [--any-tag <tag>]... [--state <state>]... [--refresh] [--include-used] [--limit N] [--brief]
  rpg sim catalog list [--tag <tag>]... [--review draft|confirmed] [--state <state>]... [--limit N]
    (every catalog action takes --catalog <path|party name>; the catalog is a vault note, see docs/encounter-catalog.md)
  rpg sim roles [<note>...] [--role R]... [--habitat H] [--type T] [--cr C] [--limit N] [--write [--min-confidence C]]
    (each monster's role, controller|leader|soldier|striker: written in its statblock or guessed, least sure first)
  rpg sim roles --set "<note>=<role>/<subrole>"...   (write roles in statblocks)
    (subroles: controller hexer|disabler|zoner|mover; leader commander|healer|warder|summoner;
     soldier rank-and-file|guardian|brute|pinner; striker bruiser|skirmisher|ambusher|artillery|solo)
  rpg sim equivalents "<note>" [--role R] [--steps N] [--habitat H] [--type T] [--limit N]
    (monsters of the same role near its CR, another family first: to swap it for another setting)
  rpg sim help

Flags:
${helpLines()}
`;
