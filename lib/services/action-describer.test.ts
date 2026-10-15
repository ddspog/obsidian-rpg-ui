import { describe, it, expect } from "vitest";
import { atLevel } from "./action-describer";

describe("atLevel", () => {
  const text = "you deal an extra {{ leveled: { 1: 1d4, 6: 1d6, 13: 1d8, 17: 1d10 } }} damage";

  it("fills a value that grows with level, as it stands now", () => {
    expect(atLevel(text, 1)).toBe("you deal an extra 1d4 damage");
    expect(atLevel(text, 7)).toBe("you deal an extra 1d6 damage");
    expect(atLevel(text, 20)).toBe("you deal an extra 1d10 damage");
  });
});
