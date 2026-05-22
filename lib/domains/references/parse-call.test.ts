import { describe, expect, it } from "vitest";
import { CALL_PATTERN, matchAllCalls, parseArgs, parseCall } from "./parse-call";

describe("parseArgs", () => {
  it("returns empty array for empty input", () => {
    expect(parseArgs("")).toEqual([]);
    expect(parseArgs("   ")).toEqual([]);
  });

  it("parses bare identifiers as strings", () => {
    expect(parseArgs("name")).toEqual(["name"]);
    expect(parseArgs("name, action, content")).toEqual(["name", "action", "content"]);
  });

  it("parses double-quoted strings", () => {
    expect(parseArgs('"hello"')).toEqual(["hello"]);
    expect(parseArgs('"hello world"')).toEqual(["hello world"]);
  });

  it("parses single-quoted strings", () => {
    expect(parseArgs("'hello'")).toEqual(["hello"]);
  });

  it("preserves commas inside quoted strings", () => {
    expect(parseArgs('"a, b", c')).toEqual(["a, b", "c"]);
  });

  it("parses integers and floats as numbers", () => {
    expect(parseArgs("42")).toEqual([42]);
    expect(parseArgs("3.14")).toEqual([3.14]);
    expect(parseArgs("-5")).toEqual([-5]);
    expect(parseArgs("-0.5")).toEqual([-0.5]);
  });

  it("parses booleans and null", () => {
    expect(parseArgs("true, false, null")).toEqual([true, false, null]);
  });

  it("tolerates whitespace around commas", () => {
    expect(parseArgs("a , b ,  c")).toEqual(["a", "b", "c"]);
  });

  it("handles mixed types", () => {
    expect(parseArgs('grapple, "size 1", 5, true')).toEqual([
      "grapple",
      "size 1",
      5,
      true,
    ]);
  });

  it("treats unterminated quotes by taking the rest of the input", () => {
    expect(parseArgs('"unterminated')).toEqual(["unterminated"]);
  });
});

describe("parseCall", () => {
  it("parses a zero-arg call", () => {
    expect(parseCall("@[[rules/luck]].view()")).toEqual({
      target: "rules/luck",
      fn: "view",
      args: [],
      chain: [],
      source: "@[[rules/luck]].view()",
    });
  });

  it("parses a single-arg call", () => {
    expect(parseCall("@[[rules/combat]].view(grapple)")).toEqual({
      target: "rules/combat",
      fn: "view",
      args: ["grapple"],
      chain: [],
      source: "@[[rules/combat]].view(grapple)",
    });
  });

  it("parses a multi-arg call with mixed types", () => {
    expect(parseCall('@[[rules/grappling]].row(name, "1 action", 5)')).toEqual({
      target: "rules/grappling",
      fn: "row",
      args: ["name", "1 action", 5],
      chain: [],
      source: '@[[rules/grappling]].row(name, "1 action", 5)',
    });
  });

  it("trims whitespace inside the wikilink target", () => {
    expect(parseCall("@[[ rules/luck ]].view()")?.target).toBe("rules/luck");
  });

  it("returns null for property-path form (no parens)", () => {
    expect(parseCall("@[[rules/luck]].max")).toBeNull();
    expect(parseCall("@[[character]].stats.dex")).toBeNull();
  });

  it("returns null for malformed input", () => {
    expect(parseCall("not a call")).toBeNull();
    expect(parseCall("@[[file]]")).toBeNull();
    expect(parseCall("@[[file]].fn")).toBeNull();
    expect(parseCall("@[[file]].fn(")).toBeNull();
    expect(parseCall("@[[file]].fn)")).toBeNull();
  });

  it("supports function names with hyphens and underscores", () => {
    expect(parseCall("@[[file]].my_view()")?.fn).toBe("my_view");
    expect(parseCall("@[[file]].with-dash()")?.fn).toBe("with-dash");
  });
});

describe("matchAllCalls", () => {
  it("returns empty array when text has no calls", () => {
    expect(matchAllCalls("just some prose")).toEqual([]);
  });

  it("yields calls in document order with offsets", () => {
    const text = "Before @[[a]].view() between @[[b]].row(x, 2) end.";
    const calls = matchAllCalls(text);
    expect(calls).toHaveLength(2);
    expect(calls[0].target).toBe("a");
    expect(calls[0].fn).toBe("view");
    expect(calls[0].args).toEqual([]);
    expect(text.slice(calls[0].start, calls[0].end)).toBe("@[[a]].view()");
    expect(calls[1].target).toBe("b");
    expect(calls[1].fn).toBe("row");
    expect(calls[1].args).toEqual(["x", 2]);
    expect(text.slice(calls[1].start, calls[1].end)).toBe("@[[b]].row(x, 2)");
  });

  it("ignores property-path references mixed in with calls", () => {
    const text = "Path: @[[a]].path  Call: @[[b]].view(x)";
    const calls = matchAllCalls(text);
    expect(calls).toHaveLength(1);
    expect(calls[0].fn).toBe("view");
  });

  it("CALL_PATTERN is a global-flag regex (caller-resettable)", () => {
    // Sanity: matching twice without resetting lastIndex would skip
    // the second occurrence — matchAllCalls handles this, but the
    // exported pattern must have the `g` flag.
    expect(CALL_PATTERN.flags).toContain("g");
  });
});
