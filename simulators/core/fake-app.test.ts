import { describe, expect, it } from "vitest";
import { MemoryMetadataCache, MemoryVault } from "./fake-app";

const vault = new MemoryVault({
  "tales/compendium/the-nomicon/18. Nörslik.md": "---\ntab-name: Nörslik\n---\nbody",
  "tales/binder/01.md": '---\ngm: "[[00. GM Screen]]"\n---\n```rpg log\n```',
  "old/the-nomicon/18. Nörslik.md": "legacy",
  "tales/gm-tools/Name Generator.md": "x",
});
const cache = new MemoryMetadataCache(vault);

describe("the in-memory vault", () => {
  it("reads, writes and tells listeners", async () => {
    const f = vault.getAbstractFileByPath("tales/gm-tools/Name Generator")!;
    expect(f.basename).toBe("Name Generator");
    let wrote = "";
    vault.onWrite = (file) => (wrote = file.path);
    await vault.modify(f, "changed");
    expect(await vault.read(f)).toBe("changed");
    expect(wrote).toBe("tales/gm-tools/Name Generator.md");
  });
});

describe("link resolution", () => {
  it("takes a full path as it is", () => {
    expect(cache.getFirstLinkpathDest("tales/compendium/the-nomicon/18. Nörslik", "tales/binder/01.md")?.path).toBe(
      "tales/compendium/the-nomicon/18. Nörslik.md"
    );
  });

  it("finds a bare name, preferring the note nearest the source", () => {
    expect(cache.getFirstLinkpathDest("18. Nörslik", "tales/binder/01.md")?.path).toBe(
      "tales/compendium/the-nomicon/18. Nörslik.md"
    );
    expect(cache.getFirstLinkpathDest("18. Nörslik", "old/x.md")?.path).toBe("old/the-nomicon/18. Nörslik.md");
  });

  it("drops a heading or alias, and returns null for a missing note", () => {
    expect(cache.getFirstLinkpathDest("Name Generator#Rolling|the tool", "tales/binder/01.md")?.basename).toBe(
      "Name Generator"
    );
    expect(cache.getFirstLinkpathDest("Nowhere", "tales/binder/01.md")).toBeNull();
  });

  it("reads a note's frontmatter", () => {
    expect(cache.getCache("tales/binder/01.md")?.frontmatter).toEqual({ gm: "[[00. GM Screen]]" });
    expect(cache.getCache("tales/gm-tools/Name Generator.md")?.frontmatter).toBeUndefined();
  });
});
