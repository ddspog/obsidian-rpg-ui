import { describe, expect, it } from "vitest";
import type { Ctx } from "../app";
import { type SimHandler, simMain } from "./dispatch";
import { parseSimArgv, SIM_FLAGS, SIM_HELP, type SimOptions, UsageError } from "./flags";

const CTX = { root: "stub" } as unknown as Ctx;

interface Harness {
  code: number;
  out: string[];
  err: string[];
  contexts: (string | undefined)[];
  calls: { which: string; options: SimOptions }[];
}

async function drive(tokens: string[], handlers: { run?: SimHandler; suggest?: SimHandler } = {}): Promise<Harness> {
  const h: Harness = { code: -1, out: [], err: [], contexts: [], calls: [] };
  const stub =
    (which: string): SimHandler =>
    async (_ctx, options) => {
      h.calls.push({ which, options });
      return { doc: { which, trials: options.trials } };
    };
  h.code = await simMain(
    tokens,
    { out: (s) => h.out.push(s), err: (s) => h.err.push(s) },
    {
      context: (vault) => {
        h.contexts.push(vault);
        return CTX;
      },
      run: handlers.run ?? stub("run"),
      suggest: handlers.suggest ?? stub("suggest"),
      plan: stub("plan"),
    }
  );
  return h;
}

describe("parseSimArgv", () => {
  it("applies the defaults", () => {
    const { subcommand, help, options } = parseSimArgv(["run"]);
    expect(subcommand).toBe("run");
    expect(help).toBe(false);
    expect(options).toMatchObject({
      pc: [],
      monsters: [],
      base: [],
      rank: "outcome",
      tiers: "same",
      seed: 1,
      trials: 200,
      rounds: 20,
      difficulty: "challenging",
      limit: 20,
      json: false,
    });
    expect(options.habitat).toBeUndefined();
    expect(options.vault).toBeUndefined();
  });

  it("accepts every flag", () => {
    const { options, help } = parseSimArgv([
      "suggest",
      "--pc",
      "Kowyn",
      "--pc=Talon",
      "--monster",
      "Hobgoblin:2",
      "--seed",
      "7",
      "--trials=50",
      "--rounds",
      "10",
      "--difficulty",
      "deadly",
      "--habitat",
      "Forest",
      "--type",
      "humanoid",
      "--cr",
      "1/2",
      "--limit",
      "5",
      "--vault",
      "/v",
      "--json",
    ]);
    expect(help).toBe(false);
    expect(options).toMatchObject({
      subcommand: "suggest",
      pc: ["Kowyn", "Talon"],
      monsters: [{ note: "Hobgoblin", count: 2 }],
      seed: 7,
      trials: 50,
      rounds: 10,
      difficulty: "deadly",
      habitat: "Forest",
      type: "humanoid",
      cr: "1/2",
      limit: 5,
      vault: "/v",
      json: true,
    });
  });

  it("takes a negative seed and a zero limit in the = form", () => {
    expect(parseSimArgv(["run", "--seed=-5"]).options.seed).toBe(-5);
    expect(parseSimArgv(["suggest", "--limit=0"]).options.limit).toBe(0);
  });

  it("asks for help with -h, --help or a first bare help", () => {
    expect(parseSimArgv(["-h"]).help).toBe(true);
    expect(parseSimArgv(["run", "--help"]).help).toBe(true);
    expect(parseSimArgv(["help"]).help).toBe(true);
    expect(parseSimArgv(["--trials", "0", "--help"]).help).toBe(true);
    expect(parseSimArgv(["--bogus", "--help"]).help).toBe(true);
  });

  it("splits --monster at the last colon", () => {
    const monsters = (...m: string[]) => parseSimArgv(["run", ...m.flatMap((x) => ["--monster", x])]).options.monsters;
    expect(monsters("Name:3")).toEqual([{ note: "Name", count: 3 }]);
    expect(monsters("Name")).toEqual([{ note: "Name", count: 1 }]);
    expect(monsters("Goblin: Boss:2")).toEqual([{ note: "Goblin: Boss", count: 2 }]);
    expect(monsters("A", "A:2")).toEqual([
      { note: "A", count: 1 },
      { note: "A", count: 2 },
    ]);
  });

  it.each([
    [["--monster", "Name:0"], "Name:0"],
    [["--monster", "Name:abc"], "Name:abc"],
    [["--monster", "Name:"], "Name:"],
    [["--monster", "Name:-2"], "Name:-2"],
    [["--monster", "Name:1.5"], "Name:1.5"],
  ])("rejects %j naming the value", (flags, value) => {
    expect(() => parseSimArgv(["run", ...flags])).toThrow(UsageError);
    expect(() => parseSimArgv(["run", ...flags])).toThrow(value);
  });

  it("rejects an empty --pc naming --pc", () => {
    expect(() => parseSimArgv(["run", "--pc", ""])).toThrow(/--pc/);
    expect(() => parseSimArgv(["run", "--pc", "  "])).toThrow(UsageError);
  });

  it("rejects bad numbers naming the flag and value", () => {
    expect(() => parseSimArgv(["run", "--trials", "0"])).toThrow(/--trials.*"0"/);
    expect(() => parseSimArgv(["run", "--trials", "abc"])).toThrow(/--trials.*"abc"/);
    expect(() => parseSimArgv(["run", "--rounds", "0"])).toThrow(/--rounds/);
    expect(() => parseSimArgv(["run", "--seed", "1.5"])).toThrow(/--seed/);
    expect(() => parseSimArgv(["run", "--limit=-1"])).toThrow(/--limit.*"-1"/);
    expect(() => parseSimArgv(["run", "--difficulty", "brutal"])).toThrow(/--difficulty.*"brutal"/);
    expect(() => parseSimArgv(["suggest", "--rank", "fancy"])).toThrow(/--rank.*"fancy"/);
  });

  it("reads --rank as cr or outcome, case-insensitively", () => {
    expect(parseSimArgv(["suggest"]).options.rank).toBe("outcome");
    expect(parseSimArgv(["suggest", "--rank", "outcome"]).options.rank).toBe("outcome");
    expect(parseSimArgv(["suggest", "--rank=CR"]).options.rank).toBe("cr");
  });

  it("reads --tiers as same, lower or all, and refuses anything else", () => {
    expect(parseSimArgv(["plan", "--tiers", "LOWER"]).options.tiers).toBe("lower");
    expect(() => parseSimArgv(["plan", "--tiers", "near"])).toThrow(/--tiers must be one of same, lower, all/);
  });

  it("reads --base like --monster, repeatable, naming --base in its errors", () => {
    const base = (...m: string[]) => parseSimArgv(["suggest", ...m.flatMap((x) => ["--base", x])]).options.base;
    expect(base("Hobgoblin")).toEqual([{ note: "Hobgoblin", count: 1 }]);
    expect(base("Hobgoblin:2", "Wolf")).toEqual([
      { note: "Hobgoblin", count: 2 },
      { note: "Wolf", count: 1 },
    ]);
    expect(base("Goblin: Boss:2")).toEqual([{ note: "Goblin: Boss", count: 2 }]);
    expect(() => base("Name:abc")).toThrow(/--base "Name:abc"/);
    expect(() => base("Name:0")).toThrow(/--base "Name:0"/);
    expect(() => base("Name:101")).toThrow(/--base.*at most 100/);
    expect(() => base(":2")).toThrow(/--base/);
    expect(() => base("  ")).toThrow(/--base/);
    expect(parseSimArgv(["suggest"]).options.base).toEqual([]);
  });

  it("maps parseArgs errors to UsageError", () => {
    expect(() => parseSimArgv(["run", "--bogus"])).toThrow(UsageError);
    expect(() => parseSimArgv(["run", "--bogus"])).toThrow(/--bogus/);
    expect(() => parseSimArgv(["run", "--trials"])).toThrow(/--trials/);
    expect(() => parseSimArgv(["run", "--limit", "-1"])).toThrow(UsageError);
    expect(() => parseSimArgv(["run", "--limit", "-1"])).toThrow(/--limit/);
    expect(() => parseSimArgv(["run", "--seed", "-5"])).toThrow(/--seed/);
  });
});

describe("parseSimArgv: plan and --brief", () => {
  it("takes plan's bare words as theme words, split on spaces", () => {
    const { subcommand, options } = parseSimArgv(["plan", "goblin ambush", "night", "--habitat", "forest"]);
    expect(subcommand).toBe("plan");
    expect(options.args).toEqual(["goblin", "ambush", "night"]);
    expect(options.habitat).toBe("forest");
    expect(options.brief).toBe(false);
  });

  it("reads --brief", () => {
    expect(parseSimArgv(["run", "--monster", "Wolf", "--brief"]).options.brief).toBe(true);
  });
});

describe("SIM_HELP", () => {
  it("lists every flag with its default, from the table", () => {
    for (const flag of SIM_FLAGS) expect(SIM_HELP).toContain(`--${flag.name}`);
    expect(SIM_HELP).toContain("-h, --help");
    expect(SIM_HELP).toMatch(/--seed.*\(default: 1\)/);
    expect(SIM_HELP).toMatch(/--trials.*\(default: 200\)/);
    expect(SIM_HELP).toMatch(/--rounds.*\(default: 20\)/);
    expect(SIM_HELP).toMatch(/--difficulty.*\(default: challenging\)/);
    expect(SIM_HELP).toMatch(/--limit.*\(default: 20\)/);
  });

  it("describes --rank and --base in the help", () => {
    expect(SIM_HELP).toMatch(/--rank cr\|outcome\s+`suggest`/);
    expect(SIM_HELP).toMatch(/--rank.*\(default: outcome\)/);
    expect(SIM_HELP).toMatch(/--tiers same\|lower\|all.*\(default: same\)/);
    expect(SIM_HELP).toMatch(/--base "<note>\[:<count>\]"\s+`suggest`/);
  });

  it("covers the table: pc, monster, base, rank, habitat, type, cr, the catalog flags, vault, json, help", () => {
    expect(SIM_FLAGS.map((f) => f.name)).toEqual([
      "pc",
      "monster",
      "base",
      "seed",
      "trials",
      "rounds",
      "difficulty",
      "tiers",
      "rank",
      "habitat",
      "type",
      "cr",
      "limit",
      "party-name",
      "catalog",
      "name",
      "every",
      "reuse-after",
      "session",
      "add-tag",
      "drop-tag",
      "include-used",
      "fit",
      "tag",
      "any-tag",
      "state",
      "review",
      "min-confidence",
      "accept",
      "force",
      "refresh",
      "include-stale",
      "include-draft",
      "brief",
      "role",
      "write",
      "set",
      "confidence",
      "features",
      "steps",
      "vault",
      "json",
      "help",
    ]);
  });
});

describe("simMain help", () => {
  it.each([
    [[]],
    [["help"]],
    [["--help"]],
    [["-h"]],
    [["run", "--help"]],
    [["suggest", "-h"]],
    [["--vault", "X", "--help"]],
    [["--vault", "X", "help"]],
    [["--json"]],
    [["--trials", "0", "--help"]],
    [["--bogus", "--help"]],
    [["run", "--trials", "0", "--help"]],
  ])("prints the help and returns 0 for %j without a context", async (tokens) => {
    const h = await drive(tokens);
    expect(h.code).toBe(0);
    expect(h.out).toEqual([SIM_HELP]);
    expect(h.err).toEqual([]);
    expect(h.contexts).toEqual([]);
    expect(h.calls).toEqual([]);
  });
});

describe("simMain usage errors", () => {
  it.each([
    [["run", "--bogus"], "--bogus"],
    [["run", "--trials"], "--trials"],
    [["run", "--trials", "0"], "--trials"],
    [["run", "--trials", "abc"], "abc"],
    [["run", "--rounds", "0"], "--rounds"],
    [["run", "--difficulty", "brutal"], "brutal"],
    [["suggest", "--rank", "fancy"], "--rank"],
    [["suggest", "--base", "Name:abc"], "--base"],
    [["run", "--monster", "Wolf", "--base", "Orc"], "--monster"],
    [["suggest", "--limit=-1"], "--limit"],
    [["suggest", "--limit", "-1"], "--limit"],
    [["run", "--seed", "-5"], "--seed"],
    [["run", "--pc", ""], "--pc"],
    [["run", "--monster", "Name:abc"], "Name:abc"],
    [["run", "--monster", "Name:0"], "Name:0"],
    [["run", "--monster", "Name:"], "Name:"],
    [["frobnicate"], "frobnicate"],
    [["run", "extra"], "extra"],
    [["suggest", "extra"], "extra"],
    [["plan", "--rank", "outcome"], "--rank is not a flag of `plan`"],
    [["plan", "--pc", "A", "--catalog", "B"], "--pc and --catalog"],
    [["plan", "--cr", "big"], "--cr"],
  ])("returns 1 for %j with a message naming %s on stderr", async (tokens, named) => {
    const h = await drive(tokens);
    expect(h.code).toBe(1);
    expect(h.out).toEqual([]);
    expect(h.err).toHaveLength(1);
    expect(h.err[0]).toContain(named);
    expect(h.err[0]).toContain(SIM_HELP);
    expect(h.contexts).toEqual([]);
    expect(h.calls).toEqual([]);
  });

  it("returns 1 when a handler throws a UsageError", async () => {
    const h = await drive(["run", "--monster", "Wolf"], {
      run: async () => {
        throw new UsageError("Give --monster.");
      },
    });
    expect(h.code).toBe(1);
    expect(h.err[0]).toContain("Give --monster.");
    expect(h.err[0]).toContain(SIM_HELP);
    expect(h.out).toEqual([]);
  });

  it("lets any other handler error propagate unchanged", async () => {
    const boom = new Error("note not found");
    await expect(
      drive(["run", "--monster", "Wolf"], {
        run: async () => {
          throw boom;
        },
      })
    ).rejects.toBe(boom);
  });

  it("lets a context failure propagate", async () => {
    const boom = new Error("no vault");
    await expect(
      simMain(
        ["run", "--monster", "Wolf"],
        { out: () => undefined, err: () => undefined },
        {
          context: () => {
            throw boom;
          },
          run: async () => ({ doc: {} }),
          suggest: async () => ({ doc: {} }),
        }
      )
    ).rejects.toBe(boom);
  });

  it("returns 1 before booting the vault when run has no --monster or suggest has a bad --cr", async () => {
    for (const [tokens, named] of [
      [["run"], "--monster"],
      [["suggest", "--cr", "half"], "--cr"],
      [["suggest", "--cr", "1/0"], "--cr"],
    ] as const) {
      const h = await drive([...tokens]);
      expect(h.code).toBe(1);
      expect(h.err[0]).toContain(named);
      expect(h.contexts).toEqual([]);
      expect(h.calls).toEqual([]);
    }
  });

  it("does not take a flag's value named help for the help subcommand", async () => {
    const h = await drive(["run", "--monster", "help"]);
    expect(h.code).toBe(0);
    expect(h.calls).toHaveLength(1);
  });

  it("rejects a seed the stream could not tell from another", () => {
    expect(() => parseSimArgv(["run", "--seed", "4294967297"])).toThrow(/--seed/);
    expect(parseSimArgv(["run", "--seed", "4294967295"]).options.seed).toBe(4294967295);
  });
});

describe("upper bounds", () => {
  it("refuses a trial count or a monster count that would exhaust memory", () => {
    expect(() => parseSimArgv(["run", "--trials", "100001"])).toThrow(/--trials/);
    expect(parseSimArgv(["run", "--trials", "100000"]).options.trials).toBe(100000);
    expect(() => parseSimArgv(["run", "--monster", "Goblin:101"])).toThrow(/Goblin:101/);
    expect(parseSimArgv(["run", "--monster", "Goblin:100"]).options.monsters).toEqual([{ note: "Goblin", count: 100 }]);
  });
});

describe("simMain handlers", () => {
  it("runs the handler once with the vault and prints its document once", async () => {
    const h = await drive(["run", "--vault", "/v", "--trials", "5", "--monster", "Orc:2"]);
    expect(h.code).toBe(0);
    expect(h.contexts).toEqual(["/v"]);
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0].which).toBe("run");
    expect(h.calls[0].options.monsters).toEqual([{ note: "Orc", count: 2 }]);
    expect(h.out).toEqual([JSON.stringify({ which: "run", trials: 5 }, null, 2)]);
    expect(h.err).toEqual([]);
  });

  it("routes suggest, with the context given no vault when none is set", async () => {
    const h = await drive(["suggest"]);
    expect(h.code).toBe(0);
    expect(h.contexts).toEqual([undefined]);
    expect(h.calls.map((c) => c.which)).toEqual(["suggest"]);
  });

  it("prints the same bytes with and without --json", async () => {
    const a = await drive(["run", "--monster", "Orc"]);
    const b = await drive(["run", "--monster", "Orc", "--json"]);
    expect(a.code).toBe(0);
    expect(b.code).toBe(0);
    expect(a.out).toEqual(b.out);
  });
});
