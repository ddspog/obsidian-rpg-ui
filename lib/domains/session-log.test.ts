import { describe, it, expect } from "vitest";
import { parseSessionLogBlock } from "./session-log";

describe("parseSessionLogBlock", () => {
  it("parses the gm: screen wikilink alongside state_key and entities", () => {
    const source = [
      "state_key: test-gm-screen",
      'gm: "[[GM-Screen-Mythic]]"',
      "entities:",
      '  - file: "PCs/Lilith.md"',
      "---",
      "S1 The road north",
    ].join("\n");
    const block = parseSessionLogBlock(source);
    expect(block.state_key).toBe("test-gm-screen");
    expect(block.gm).toBe("[[GM-Screen-Mythic]]");
    expect(block.entities).toEqual([{ file: "PCs/Lilith.md" }]);
    expect(block.body).toBe("S1 The road north");
  });

  it("leaves gm undefined when no gm: field is present", () => {
    const block = parseSessionLogBlock("state_key: plain\n---\nS1 Somewhere");
    expect(block.gm).toBeUndefined();
  });
});
