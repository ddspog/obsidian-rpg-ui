import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { boot } from "../app";
import { simMain } from "./dispatch";
import { parseSimArgv, validateForSubcommand } from "./flags";
import { simEquivalents, simRoles, withRole } from "./roles";

const BESTIARY = "tales-of-the-valiant/worldbuilding/bestiary";

const TRAITS = [
  "# Traits",
  "```rpg feature.details",
  'name: "Bite"',
  "type: action",
  "---",
  "*Melee Weapon Attack:* +4 to hit, reach 5 ft., one target. *Hit:* 7 (2d4 + 2) piercing damage.",
  "```",
  "```rpg feature.details",
  'name: "Rend"',
  "type: action",
  "---",
  "*Melee Weapon Attack:* +6 to hit, reach 5 ft., one target. *Hit:* 30 (6d8 + 3) slashing damage.",
  "```",
  "```rpg feature.details",
  'name: "Web"',
  "type: action",
  "---",
  "Each creature in a 20-foot cube must succeed on a DC 12 DEX saving throw or be restrained.",
  "```",
  "",
].join("\n");

function monster(name: string, cr: string, hp: number, ac: number, refs: string[], family = "beasts"): string {
  return [
    `# ${name}`,
    "```rpg stat.monster",
    `name: "${name}"`,
    'type: "Medium [[Beast]]"',
    `cr: "${cr}"`,
    "stats:",
    `  ac: "${ac}"`,
    `  hp: "${hp}"`,
    '  speed: "30 ft."',
    "abilities:",
    "  str: 2",
    "  dex: 2",
    "  con: 2",
    "  int: -4",
    "  wis: 1",
    "  cha: -3",
    "features:",
    ...refs.map((r) => `  - ref: "@[[Traits]]#${r}"`),
    "```",
    `<!-- ${family} -->`,
    "",
  ].join("\n");
}

function vault() {
  const root = mkdtempSync(join(tmpdir(), "rpg-sim-roles-"));
  const put = (path: string, text: string) => {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  put("Traits.md", TRAITS);
  put(`${BESTIARY}/beasts/Hound.md`, monster("Hound", "1", 70, 17, ["Bite"]));
  put(`${BESTIARY}/beasts/Mastiff.md`, monster("Mastiff", "1", 60, 16, ["Bite"]));
  put(`${BESTIARY}/humanoids/Guard.md`, monster("Guard", "1", 65, 17, ["Bite"]));
  put(`${BESTIARY}/beasts/Ripper.md`, monster("Ripper", "1", 25, 12, ["Rend"]));
  put(`${BESTIARY}/beasts/Weaver.md`, monster("Weaver", "1", 40, 14, ["Bite", "Web"]));
  return { root, ctx: boot(root) };
}

function options(...tokens: string[]) {
  const { subcommand, options: o } = parseSimArgv(tokens);
  validateForSubcommand(subcommand!, o);
  return o;
}

describe("withRole", () => {
  const note = ["# X", "```rpg stat.monster", 'name: "X"', 'cr: "1"', "stats:", '  ac: "12"', "```", ""].join("\n");

  it("writes role: after cr:, and replaces one already written", () => {
    const once = withRole(note, "striker")!;
    expect(once).toContain('cr: "1"\nrole: "striker"\nstats:');
    const both = withRole(once, "leader", "healer")!;
    expect(both).toContain('cr: "1"\nrole: "leader"\nsubrole: "healer"\nstats:');
    expect(both).not.toContain("striker");
    expect(withRole(both, "soldier")).not.toContain("subrole");
    expect(withRole("no statblock", "leader")).toBeNull();
  });
});

describe("rpg sim roles", () => {
  it("guesses each monster's role, least sure first, and writes only with --write", async () => {
    const { root, ctx } = vault();
    const { doc } = (await simRoles(ctx, options("roles"))) as {
      doc: { monsters: number; byRole: Record<string, number>; list: Array<{ monster: string; role: string }> };
    };
    expect(doc.monsters).toBe(5);
    const role = (name: string) => doc.list.find((m) => m.monster === name)?.role;
    expect(role("Hound")).toBe("soldier");
    expect(role("Ripper")).toBe("striker");
    expect(role("Weaver")).toBe("controller");
    expect(readFileSync(join(root, BESTIARY, "beasts/Hound.md"), "utf8")).not.toContain("role:");

    const only = (await simRoles(ctx, options("roles", "--role", "striker"))).doc as { list: unknown[] };
    expect(only.list).toHaveLength(1);

    const written = (await simRoles(boot(root), options("roles", "--write", "--min-confidence", "low"))).doc as {
      written: number;
    };
    expect(written.written).toBe(5);
    expect(readFileSync(join(root, BESTIARY, "beasts/Ripper.md"), "utf8")).toContain('role: "striker"');
  });

  it("writes a role it is told with --set, and reads it back as written", async () => {
    const { root, ctx } = vault();
    await simRoles(ctx, options("roles", "--set", "Hound=healer", "--set", "Mastiff=soldier/guardian"));
    expect(readFileSync(join(root, BESTIARY, "beasts/Hound.md"), "utf8")).toContain(
      'role: "leader"\nsubrole: "healer"'
    );
    const { doc } = (await simRoles(boot(root), options("roles", "Hound", "Mastiff"))) as {
      doc: { list: Array<{ monster: string; role: string; subrole: string; written?: boolean; guessed?: string }> };
    };
    expect(doc.list.find((m) => m.monster === "Hound")).toMatchObject({
      role: "leader",
      subrole: "healer",
      written: true,
      guessed: "soldier/brute",
    });
    expect(doc.list.find((m) => m.monster === "Mastiff")).toMatchObject({ subrole: "guardian", written: true });
    await expect(simRoles(ctx, options("roles", "--set", "Hound=leader/ambusher"))).rejects.toThrow(
      /each under its own role/
    );
  });
});

describe("rpg sim equivalents", () => {
  it("lists monsters of the same role near its CR, another family first", async () => {
    const { ctx } = vault();
    const { doc } = (await simEquivalents(ctx, options("equivalents", "Hound"))) as {
      doc: { role: string; equivalents: Array<{ monster: string }> };
    };
    expect(doc.role).toBe("soldier");
    expect(doc.equivalents.map((e) => e.monster)).toEqual(["Guard", "Mastiff"]);
  });

  it("refuses a missing note and flags of other subcommands", async () => {
    const out: string[] = [];
    const io = { out: (s: string) => out.push(s), err: (s: string) => out.push(s) };
    const deps = {
      context: () => boot(mkdtempSync(join(tmpdir(), "rpg-sim-roles-"))),
      run: async () => ({ doc: {} }),
      suggest: async () => ({ doc: {} }),
    };
    expect(await simMain(["equivalents"], io, deps)).toBe(1);
    expect(await simMain(["roles", "--trials", "3"], io, deps)).toBe(1);
    expect(await simMain(["roles", "--role", "tank"], io, deps)).toBe(1);
    expect(out.join("\n")).toMatch(
      /--role must be one of controller, leader, soldier, striker or one of their subroles/
    );
  });
});
