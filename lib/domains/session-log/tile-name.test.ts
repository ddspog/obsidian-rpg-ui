import { describe, expect, it } from "vitest";
import { tileName } from "./tile-name";

describe("tileName", () => {
  it("drops the word its group already says", () => {
    expect(tileName("Name Generator", "Generator")).toBe("Name");
    expect(tileName("Legendary Location Generator", "GENERATOR")).toBe("Legendary Location");
    expect(tileName("Monster Generator", "Generators")).toBe("Monster");
  });

  it("drops 'Roll on', which every tile does", () => {
    expect(tileName("Roll on Threads", "List")).toBe("Threads");
    expect(tileName("Roll on the Characters", "List")).toBe("Characters");
  });

  it("keeps a name that is only the group's word, and names in other groups", () => {
    expect(tileName("Generator", "Generator")).toBe("Generator");
    expect(tileName("Fate Question", "Oracle")).toBe("Fate Question");
    expect(tileName("Name Generator")).toBe("Name Generator");
  });

  it("drops 'Generator' under a group's own name", () => {
    expect(tileName("Name Generator", "Names")).toBe("Name");
    expect(tileName("Deity Generator", "Worldbuilding")).toBe("Deity");
    expect(tileName("Generator", "Names")).toBe("Generator");
  });

  it("drops a source mark after the name", () => {
    expect(tileName("Echo Knight ᴰ", "Class")).toBe("Echo Knight");
  });
});
