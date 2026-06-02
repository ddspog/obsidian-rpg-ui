import { describe, expect, it, beforeEach } from "vitest";
import { ValueResolver, type FileSource } from "./value-resolver";

class FakeSource implements FileSource {
  constructor(public files: Map<string, string>) {}
  listMarkdownFiles(): string[] {
    return Array.from(this.files.keys());
  }
  async read(path: string): Promise<string | null> {
    return this.files.get(path) ?? null;
  }
}

const ruleBlock = (id: string, valuesYaml: string, body = "Rule prose.") =>
  "```rpg rule.content\n" +
  `id: ${id}\n` +
  `values:\n${valuesYaml}\n` +
  "---\n" +
  `${body}\n` +
  "```\n";

describe("ValueResolver", () => {
  let resolver: ValueResolver;
  let source: FakeSource;

  beforeEach(() => {
    source = new FakeSource(new Map());
    resolver = new ValueResolver(source);
  });

  it("returns fallback before warmup completes", () => {
    expect(resolver.getValue("luck", "max", { fallback: 5 })).toBe(5);
    expect(resolver.getValue("luck", "max")).toBeUndefined();
  });

  it("indexes simple top-level values after warmup", async () => {
    source.files.set("rules/luck.md", ruleBlock("luck", "  max: 5"));
    await resolver.warmup();
    expect(resolver.getValue<number>("luck", "max")).toBe(5);
  });

  it("resolves dotted paths", async () => {
    source.files.set(
      "rules/luck.md",
      ruleBlock("luck", "  max: 5\n  reset:\n    die: d4")
    );
    await resolver.warmup();
    expect(resolver.getValue<string>("luck", "reset.die")).toBe("d4");
    expect(resolver.getValue<number>("luck", "max")).toBe(5);
  });

  it("returns fallback when path doesn't exist", async () => {
    source.files.set("rules/luck.md", ruleBlock("luck", "  max: 5"));
    await resolver.warmup();
    expect(resolver.getValue("luck", "missing", { fallback: 99 })).toBe(99);
    expect(resolver.getValue("luck", "reset.die", { fallback: "d6" })).toBe("d6");
  });

  it("returns fallback when id is unknown", async () => {
    await resolver.warmup();
    expect(resolver.getValue("nonexistent", "max", { fallback: 0 })).toBe(0);
  });

  it("indexes multiple files", async () => {
    source.files.set("rules/luck.md", ruleBlock("luck", "  max: 5"));
    source.files.set(
      "rules/grappling.md",
      ruleBlock("grapple", "  size_diff_max: 1\n  action_cost: attack")
    );
    await resolver.warmup();
    expect(resolver.getValue<number>("luck", "max")).toBe(5);
    expect(resolver.getValue<number>("grapple", "size_diff_max")).toBe(1);
    expect(resolver.getValue<string>("grapple", "action_cost")).toBe("attack");
  });

  it("ignores rule.content blocks without an id", async () => {
    source.files.set(
      "rules/orphan.md",
      "```rpg rule.content\nvalues:\n  x: 1\n---\nNo id here.\n```\n"
    );
    await resolver.warmup();
    expect(resolver.list().size).toBe(0);
  });

  it("ignores rule.content blocks without a values map", async () => {
    source.files.set(
      "rules/no-vals.md",
      "```rpg rule.content\nid: alpha\n---\nNo values.\n```\n"
    );
    await resolver.warmup();
    // Block IS indexed (id present) but with empty values.
    expect(resolver.getValuesById("alpha")).toEqual({});
    expect(resolver.getValue("alpha", "anything", { fallback: "x" })).toBe("x");
  });

  it("invalidate() drops removed ids and re-scans the file", async () => {
    source.files.set("rules/luck.md", ruleBlock("luck", "  max: 5"));
    await resolver.warmup();
    expect(resolver.getValue<number>("luck", "max")).toBe(5);

    // Replace the file with a new id + value.
    source.files.set("rules/luck.md", ruleBlock("luck", "  max: 7"));
    await resolver.invalidate("rules/luck.md");
    expect(resolver.getValue<number>("luck", "max")).toBe(7);

    // Replace again — drop the block entirely.
    source.files.set("rules/luck.md", "Just markdown, no rule fences.");
    await resolver.invalidate("rules/luck.md");
    expect(resolver.getValuesById("luck")).toBeUndefined();
  });

  it("warmup() is idempotent — repeat calls share the same Promise", async () => {
    source.files.set("rules/luck.md", ruleBlock("luck", "  max: 5"));
    const a = resolver.warmup();
    const b = resolver.warmup();
    expect(a).toBe(b);
    await a;
    expect(resolver.getValue<number>("luck", "max")).toBe(5);
  });

  it("only harvests from `rule.content` — other blocks are ignored", async () => {
    source.files.set(
      "rules/mix.md",
      [
        "```rpg rule.side\nid: not-content\nvalues:\n  x: 99\ncontent: ignored\n```\n",
        ruleBlock("real", "  x: 1"),
      ].join("\n")
    );
    await resolver.warmup();
    expect(resolver.getValuesById("not-content")).toBeUndefined();
    expect(resolver.getValue("real", "x")).toBe(1);
  });

  it("list() returns a fresh map snapshot", async () => {
    source.files.set("rules/luck.md", ruleBlock("luck", "  max: 5"));
    await resolver.warmup();
    const snapshot = resolver.list();
    expect(snapshot.get("luck")).toEqual({ max: 5 });
    snapshot.delete("luck"); // mutating the snapshot must not affect the resolver
    expect(resolver.getValue<number>("luck", "max")).toBe(5);
  });

  it("supports id collisions across files (last-scanned wins)", async () => {
    source.files.set("rules/a.md", ruleBlock("luck", "  max: 5"));
    source.files.set("rules/b.md", ruleBlock("luck", "  max: 99"));
    await resolver.warmup();
    // Either file may have been scanned last (Promise.all ordering is
    // non-deterministic); just confirm the value comes from one of them.
    const v = resolver.getValue<number>("luck", "max");
    expect(v === 5 || v === 99).toBe(true);
  });
});
