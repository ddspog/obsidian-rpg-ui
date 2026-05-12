import { describe, it, expect } from "vitest";
import { slugifyFolderPath } from "./slug";

describe("slugifyFolderPath", () => {
  it("returns 'root' for empty or slash-only input", () => {
    expect(slugifyFolderPath("")).toBe("root");
    expect(slugifyFolderPath("/")).toBe("root");
    expect(slugifyFolderPath("//")).toBe("root");
  });

  it("lowercases and joins path segments with dashes", () => {
    expect(slugifyFolderPath("People")).toBe("people");
    expect(slugifyFolderPath("People/Villains")).toBe("people-villains");
    expect(slugifyFolderPath("D&D/NPCs")).toBe("d-d-npcs");
  });

  it("strips leading and trailing slashes", () => {
    expect(slugifyFolderPath("/People/")).toBe("people");
  });

  it("normalizes non-alphanumeric runs to a single dash", () => {
    expect(slugifyFolderPath("My Notes!!/Items")).toBe("my-notes-items");
  });

  it("is stable across equivalent inputs", () => {
    expect(slugifyFolderPath("People/NPCs")).toBe(slugifyFolderPath("/People/NPCs/"));
    expect(slugifyFolderPath("People\\NPCs")).toBe(slugifyFolderPath("People/NPCs"));
  });
});
