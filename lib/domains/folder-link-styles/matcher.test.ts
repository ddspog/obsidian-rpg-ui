import { describe, it, expect } from "vitest";
import { findMatchingStyle, normalizeFolderPath } from "./matcher";
import type { FolderLinkStyle } from "settings";

const style = (id: string, folderPaths: string[]): FolderLinkStyle => ({ id, folderPaths });

describe("normalizeFolderPath", () => {
  it("strips leading and trailing slashes and normalizes separators", () => {
    expect(normalizeFolderPath("/People/")).toBe("People");
    expect(normalizeFolderPath("People\\NPCs")).toBe("People/NPCs");
    expect(normalizeFolderPath("")).toBe("");
  });
});

describe("findMatchingStyle", () => {
  it("returns null when no style matches", () => {
    const styles = [style("people", ["People"])];
    expect(findMatchingStyle("Items/Longsword.md", styles)).toBeNull();
  });

  it("matches exact folder paths", () => {
    const styles = [style("people", ["People"])];
    expect(findMatchingStyle("People", styles)?.id).toBe("people");
  });

  it("matches recursive prefixes", () => {
    const styles = [style("people", ["People"])];
    expect(findMatchingStyle("People/Gandalf.md", styles)?.id).toBe("people");
    expect(findMatchingStyle("People/NPCs/Villagers/Frodo.md", styles)?.id).toBe("people");
  });

  it("does not match siblings with the same prefix string", () => {
    const styles = [style("people", ["People"])];
    expect(findMatchingStyle("PeopleNotes/x.md", styles)).toBeNull();
  });

  it("picks the longest matching prefix across entries", () => {
    const styles = [
      style("people", ["People"]),
      style("villains", ["People/Villains"]),
    ];
    expect(findMatchingStyle("People/Villains/Sauron.md", styles)?.id).toBe("villains");
    expect(findMatchingStyle("People/Heroes/Frodo.md", styles)?.id).toBe("people");
  });

  it("matches any of an entry's folderPaths", () => {
    const styles = [style("spells", ["Spells", "Homebrew/Spells"])];
    expect(findMatchingStyle("Spells/Fireball.md", styles)?.id).toBe("spells");
    expect(findMatchingStyle("Homebrew/Spells/Arcane Mark.md", styles)?.id).toBe("spells");
    expect(findMatchingStyle("Items/Longsword.md", styles)).toBeNull();
  });

  it("picks the longest prefix even when it lives inside one entry", () => {
    const styles = [
      style("spells", ["Spells", "Compendium/Spells", "Compendium/Spells/Cantrips"]),
    ];
    // longest is `Compendium/Spells/Cantrips`; still resolves to `spells`
    expect(findMatchingStyle("Compendium/Spells/Cantrips/Guidance.md", styles)?.id).toBe("spells");
  });

  it("ignores entries with only empty folder paths (no root catch-all)", () => {
    const styles = [style("root", [""])];
    expect(findMatchingStyle("Anything.md", styles)).toBeNull();
  });

  it("normalizes trailing slashes in the configured folder paths", () => {
    const styles = [style("people", ["/People/"])];
    expect(findMatchingStyle("People/Gandalf.md", styles)?.id).toBe("people");
  });
});
