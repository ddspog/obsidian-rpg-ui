import { parseArgs } from "node:util";
import { parseCr } from "lib/domains/encounter-sim/difficulty";

/** A wrong flag, value or subcommand of `rpg sim` (exit 1, with the usage). */
export class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UsageError";
  }
}

export type Difficulty = "easy" | "challenging" | "deadly";

export const DIFFICULTIES: readonly Difficulty[] = ["easy", "challenging", "deadly"];

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
    description: "the difficulty `suggest` aims for",
  },
  {
    name: "habitat",
    kind: "string",
    default: undefined,
    value: "<name>",
    description: "`suggest`: only monsters of this habitat",
  },
  {
    name: "type",
    kind: "string",
    default: undefined,
    value: "<text>",
    description: "`suggest`: only monsters whose type contains this text",
  },
  {
    name: "cr",
    kind: "string",
    default: undefined,
    value: "<cr>",
    description: "`suggest`: only monsters of exactly this CR (e.g. 1/2)",
  },
  {
    name: "limit",
    kind: "string",
    default: 20,
    value: "<n>",
    description: "`suggest`: the most candidates to list (0 or more)",
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
  /** The subcommand: `run` or `suggest` (others are the dispatcher's to refuse). */
  subcommand: string | undefined;
  pc: string[];
  monsters: MonsterGroup[];
  seed: number;
  trials: number;
  rounds: number;
  difficulty: Difficulty;
  habitat?: string;
  type?: string;
  cr?: string;
  limit: number;
  vault?: string;
  json: boolean;
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
    pc: [],
    monsters: [],
    seed: flagDefault<number>("seed"),
    trials: flagDefault<number>("trials"),
    rounds: flagDefault<number>("rounds"),
    difficulty: flagDefault<Difficulty>("difficulty"),
    limit: flagDefault<number>("limit"),
    json: false,
  };
}

const INTEGER = /^[+-]?\d+$/;

function integer(flag: string, raw: string, min: number | undefined, what: string): number {
  const text = raw.trim();
  const n = INTEGER.test(text) ? Number(text) : NaN;
  if (!Number.isSafeInteger(n) || (min !== undefined && n < min)) {
    throw new UsageError(`--${flag} must be ${what}, got "${raw}".`);
  }
  return n;
}

/** `Note:3` -> {note, count}: split at the last colon, no colon means one. */
export function parseMonster(raw: string): MonsterGroup {
  const at = raw.lastIndexOf(":");
  if (at < 0) {
    if (!raw.trim()) throw new UsageError(`--monster must name a note, got "${raw}".`);
    return { note: raw.trim(), count: 1 };
  }
  const note = raw.slice(0, at).trim();
  const suffix = raw.slice(at + 1).trim();
  if (!/^\d+$/.test(suffix) || !Number.isSafeInteger(Number(suffix)) || Number(suffix) < 1) {
    throw new UsageError(
      `--monster "${raw}": the count "${suffix}" must be a positive integer (use "Name:3" or just "Name").`
    );
  }
  if (!note) throw new UsageError(`--monster "${raw}" has no note name.`);
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
  if (extra.length) {
    throw new UsageError(`Unexpected argument "${extra[0]}".`);
  }

  const options = defaultOptions(subcommand);

  const pcs = (values.pc as string[] | undefined) ?? [];
  for (const pc of pcs) {
    if (!pc.trim()) throw new UsageError(`--pc needs a note, got an empty value.`);
  }
  options.pc = pcs.map((pc) => pc.trim());
  options.monsters = ((values.monster as string[] | undefined) ?? []).map(parseMonster);

  if (typeof values.seed === "string") {
    options.seed = integer("seed", values.seed, undefined, "an integer");
    // The stream folds its seed to 32 bits: a larger one would silently repeat another seed's run.
    if (Math.abs(options.seed) > 0xffffffff) {
      throw new UsageError(`--seed must be an integer no larger than 4294967295, got "${values.seed}".`);
    }
  }
  if (typeof values.trials === "string") {
    options.trials = integer("trials", values.trials, 1, "a positive integer");
  }
  if (typeof values.rounds === "string") {
    options.rounds = integer("rounds", values.rounds, 1, "a positive integer");
  }
  if (typeof values.limit === "string") {
    options.limit = integer("limit", values.limit, 0, "a non-negative integer");
  }
  if (typeof values.difficulty === "string") {
    const d = values.difficulty.trim().toLowerCase();
    if (!(DIFFICULTIES as readonly string[]).includes(d)) {
      throw new UsageError(`--difficulty must be one of ${DIFFICULTIES.join(", ")}, got "${values.difficulty}".`);
    }
    options.difficulty = d as Difficulty;
  }
  if (typeof values.habitat === "string") options.habitat = values.habitat;
  if (typeof values.type === "string") options.type = values.type;
  if (typeof values.cr === "string") options.cr = values.cr;
  if (typeof values.vault === "string") options.vault = values.vault;
  options.json = values.json === true;

  return { subcommand, help: false, options };
}

/**
 * What a subcommand needs before it may run, checked before the vault boots (a usage error exits 1,
 * ahead of any runtime error).
 */
export function validateForSubcommand(subcommand: string, options: SimOptions): void {
  if (subcommand === "run" && options.monsters.length === 0) {
    throw new UsageError('--monster is required: name at least one monster note ("Note" or "Note:3").');
  }
  if (subcommand === "suggest" && options.cr !== undefined) {
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
export const SIM_HELP = `rpg sim: run an encounter simulation, or suggest encounters

Usage:
  rpg sim run --monster "<note>[:<count>]" [--pc <note>]... [flags]
  rpg sim suggest [--pc <note>]... [flags]
  rpg sim help

Flags:
${helpLines()}
`;
