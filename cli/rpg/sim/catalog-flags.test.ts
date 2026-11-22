import { describe, expect, it } from "vitest";
import type { Ctx } from "../app";
import { type SimHandler, simMain } from "./dispatch";
import { parseSimArgv, SIM_FLAGS, SIM_HELP, type SimOptions, UsageError, validateForSubcommand } from "./flags";

const parse = (...tokens: string[]) => parseSimArgv(["catalog", ...tokens]);

/** Parses and validates, as the dispatcher does before a handler runs. */
function valid(...tokens: string[]): SimOptions {
  const { options } = parse(...tokens);
  validateForSubcommand("catalog", options);
  return options;
}

const refuses = (tokens: string[], message: RegExp) => {
  expect(() => valid(...tokens)).toThrow(UsageError);
  expect(() => valid(...tokens)).toThrow(message);
};

describe("parseSimArgv: catalog", () => {
  it("reads the action and the bare words after it, and defaults the catalog flags", () => {
    const { subcommand, options } = parse("draft", "a/b.md", "folder");
    expect(subcommand).toBe("catalog");
    expect(options).toMatchObject({
      action: "draft",
      args: ["a/b.md", "folder"],
      tags: [],
      anyTags: [],
      states: [],
      minConfidence: "high",
      accept: false,
      force: false,
      refresh: false,
      includeStale: false,
      includeDraft: false,
      limitSet: false,
      limit: 20,
    });
    expect(options.catalog).toBeUndefined();
    expect(options.partyName).toBeUndefined();
    expect(options.every).toBeUndefined();
    expect(options.session).toBeUndefined();
  });

  it("accepts every catalog flag", () => {
    const { options } = parse(
      "suggest",
      "--catalog",
      "Ashen",
      "--tag",
      "forest",
      "--tag=cold",
      "--any-tag",
      "hills",
      "--state",
      "fit",
      "--state",
      "Too-Easy",
      "--include-stale",
      "--include-draft",
      "--refresh",
      "--session",
      "4",
      "--limit",
      "3"
    );
    expect(options).toMatchObject({
      action: "suggest",
      catalog: "Ashen",
      tags: ["forest", "cold"],
      anyTags: ["hills"],
      states: ["fit", "too-easy"],
      includeStale: true,
      includeDraft: true,
      refresh: true,
      session: 4,
      limit: 3,
      limitSet: true,
    });
    const init = parse(
      "init",
      "--party-name",
      " The Ashen Four ",
      "--every",
      "0",
      "--difficulty",
      "deadly",
      "--review",
      "draft"
    ).options;
    expect(init).toMatchObject({ partyName: "The Ashen Four", every: 0, difficulty: "deadly", review: "draft" });
    expect(
      parse("draft", "n.md", "--accept", "--min-confidence", "LOW", "--force", "--name", "X").options
    ).toMatchObject({
      accept: true,
      minConfidence: "low",
      force: true,
      name: "X",
    });
  });

  it("names the flag and the value of a bad one", () => {
    expect(() => parse("list", "--state", "easy")).toThrow(
      /--state must be one of fit, too-easy, too-hard, got "easy"/
    );
    expect(() => parse("list", "--review", "done")).toThrow(/--review must be one of draft, confirmed, got "done"/);
    expect(() => parse("draft", "x", "--min-confidence", "sure")).toThrow(
      /--min-confidence must be one of high, medium, low, got "sure"/
    );
    expect(() => parse("init", "--every=-1")).toThrow(/--every must be a non-negative integer, got "-1"/);
    expect(() => parse("check", "--session", "two")).toThrow(/--session must be a non-negative integer, got "two"/);
    expect(() => parse("list", "--tag", " ")).toThrow(/--tag needs a tag/);
    expect(() => parse("list", "--any-tag", "")).toThrow(/--any-tag needs a tag/);
    expect(() => parse("init", "--party-name", " ")).toThrow(/--party-name needs a value/);
    expect(() => parse("list", "--catalog", "")).toThrow(/--catalog needs a value/);
  });

  it("still refuses a bare word after any other subcommand", () => {
    expect(() => parseSimArgv(["run", "extra"])).toThrow(/Unexpected argument "extra"/);
    expect(() => parseSimArgv(["suggest", "extra"])).toThrow(/Unexpected argument "extra"/);
  });
});

describe("validateForSubcommand: catalog", () => {
  it("needs a known action", () => {
    refuses([], /needs an action: init, draft, add, confirm, remove, tag, use, prepare, adjust, session, check, suggest, list/);
    refuses(["frobnicate"], /Unknown catalog action "frobnicate"/);
  });

  it("checks what each action needs", () => {
    refuses(["init"], /--party-name is required/);
    refuses(["draft"], /needs at least one note or folder/);
    refuses(["add", "--monster", "Wolf"], /--name is required/);
    refuses(["add", "--name", "Pack"], /--monster is required/);
    refuses(["confirm"], /catalog confirm.*at least one entry id/);
    refuses(["remove"], /catalog remove.*at least one entry id/);
    expect(valid("init", "--party-name", "Four").action).toBe("init");
    expect(valid("draft", "notes").args).toEqual(["notes"]);
    expect(valid("add", "--name", "Pack", "--monster", "Wolf:3").monsters).toEqual([{ note: "Wolf", count: 3 }]);
    expect(valid("confirm", "a", "b").args).toEqual(["a", "b"]);
    for (const action of ["check", "suggest", "list"]) expect(valid(action).action).toBe(action);
  });

  it("refuses a flag that is not the action's, naming both, and a bare word where none belongs", () => {
    refuses(["check", "--tag", "forest"], /--tag is not a flag of `catalog check`/);
    refuses(["list", "--accept"], /--accept is not a flag of `catalog list`/);
    refuses(["suggest", "--min-confidence", "low"], /--min-confidence is not a flag of `catalog suggest`/);
    refuses(["init", "--party-name", "A", "--monster", "Wolf"], /--monster is not a flag of `catalog init`/);
    refuses(["list", "--habitat", "Forest"], /--habitat is not a flag of `catalog list`/);
    refuses(["check", "--difficulty", "deadly"], /--difficulty is not a flag of `catalog check`/);
    refuses(["check", "stray"], /Unexpected argument "stray" for `catalog check`/);
    // The common flags belong to every action.
    expect(valid("list", "--catalog", "x", "--vault", "/v", "--json").vault).toBe("/v");
  });
});

describe("rpg sim catalog: dispatch", () => {
  const CTX = { root: "stub" } as unknown as Ctx;

  async function drive(tokens: string[], catalog?: SimHandler) {
    const out: string[] = [];
    const err: string[] = [];
    const calls: SimOptions[] = [];
    const code = await simMain(
      tokens,
      { out: (s) => out.push(s), err: (s) => err.push(s) },
      {
        context: () => CTX,
        run: async () => ({ doc: {} }),
        suggest: async () => ({ doc: {} }),
        ...(catalog ? { catalog } : {}),
      }
    ).catch((error) => {
      err.push(String(error));
      return 2;
    });
    return { code, out: out.join(""), err: err.join(""), calls };
  }

  it("hands the options to the catalog handler and prints its document", async () => {
    const seen: SimOptions[] = [];
    const result = await drive(["catalog", "list", "--tag", "forest"], async (_ctx, options) => {
      seen.push(options);
      return { doc: { listed: true } };
    });
    expect(result.code).toBe(0);
    expect(JSON.parse(result.out)).toEqual({ listed: true });
    expect(seen[0]).toMatchObject({ action: "list", tags: ["forest"] });
  });

  it("exits 1 with the usage for a wrong action or flag, before the handler runs", async () => {
    let ran = false;
    const handler: SimHandler = async () => {
      ran = true;
      return { doc: {} };
    };
    const wrong = await drive(["catalog", "nope"], handler);
    expect(wrong.code).toBe(1);
    expect(wrong.err).toContain('Unknown catalog action "nope"');
    expect(wrong.err).toContain("rpg sim catalog init");
    const flag = await drive(["catalog", "check", "--accept"], handler);
    expect(flag.code).toBe(1);
    expect(flag.err).toContain("--accept");
    expect(ran).toBe(false);
  });

  it("lets a runtime error of the handler propagate (the caller exits 2)", async () => {
    const result = await drive(["catalog", "check"], async () => {
      throw new Error("boom");
    });
    expect(result.code).toBe(2);
    expect(result.err).toContain("boom");
  });

  it("prints the help for `catalog help` and `catalog --help`", async () => {
    expect((await drive(["catalog", "help"])).out).toBe(SIM_HELP);
    expect((await drive(["catalog", "--help"])).out).toBe(SIM_HELP);
  });
});

describe("SIM_HELP: catalog", () => {
  it("lists every catalog action and the new flags with their defaults", () => {
    for (const action of ["init", "draft", "add", "confirm", "remove", "check", "suggest", "list"]) {
      expect(SIM_HELP).toContain(`rpg sim catalog ${action}`);
    }
    for (const name of [
      "party-name",
      "catalog",
      "every",
      "session",
      "tag",
      "any-tag",
      "state",
      "review",
      "min-confidence",
    ]) {
      expect(SIM_FLAGS.some((f) => f.name === name)).toBe(true);
      expect(SIM_HELP).toContain(`--${name}`);
    }
    expect(SIM_HELP).toMatch(/--min-confidence.*\(default: high\)/);
    expect(SIM_HELP).toMatch(/--every.*\(default: 5\)/);
    expect(SIM_HELP).toMatch(/--accept.*\(default: false\)/);
  });
});
