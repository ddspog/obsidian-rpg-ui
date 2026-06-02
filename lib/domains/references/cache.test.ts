import { describe, it, expect, vi } from "vitest";
import { FileRefCache, type VaultAdapter } from "./cache";

function mockAdapter(
  files: Record<string, string>,
  fm: Record<string, Record<string, unknown>> = {}
): VaultAdapter & { reads: string[] } {
  const reads: string[] = [];
  return {
    reads,
    async readFile(path: string) {
      reads.push(path);
      return files[path] ?? null;
    },
    getFrontmatter(path: string) {
      return fm[path] ?? null;
    },
  };
}

const LONGSWORD_DOC = ["```rpg item.element", "cost: 15 gp", "```"].join("\n");

describe("FileRefCache", () => {
  it("reads a file once and reuses the cached view", async () => {
    const adapter = mockAdapter({ "Longsword.md": LONGSWORD_DOC });
    const cache = new FileRefCache(adapter);
    const a = await cache.get("Longsword.md");
    const b = await cache.get("Longsword.md");
    expect(a).toBe(b);
    expect(adapter.reads).toEqual(["Longsword.md"]);
  });

  it("coalesces concurrent reads onto one promise", async () => {
    const adapter = mockAdapter({ "Longsword.md": LONGSWORD_DOC });
    const cache = new FileRefCache(adapter);
    const [a, b] = await Promise.all([cache.get("Longsword.md"), cache.get("Longsword.md")]);
    expect(a).toBe(b);
    expect(adapter.reads).toEqual(["Longsword.md"]);
  });

  it("returns null for missing files and doesn't cache them permanently", async () => {
    const adapter = mockAdapter({});
    const cache = new FileRefCache(adapter);
    const v = await cache.get("Nope.md");
    expect(v).toBeNull();
  });

  it("invalidate drops the entry and fires listeners", async () => {
    const adapter = mockAdapter({ "Longsword.md": LONGSWORD_DOC });
    const cache = new FileRefCache(adapter);
    const listener = vi.fn();
    cache.onChange(listener);
    await cache.get("Longsword.md");
    cache.invalidate("Longsword.md");
    expect(listener).toHaveBeenCalledWith("Longsword.md");
    await cache.get("Longsword.md");
    expect(adapter.reads).toEqual(["Longsword.md", "Longsword.md"]);
  });

  it("fires listeners even when invalidating an uncached path (file newly appeared)", async () => {
    const adapter = mockAdapter({});
    const cache = new FileRefCache(adapter);
    const listener = vi.fn();
    cache.onChange(listener);
    cache.invalidate("NewFile.md");
    expect(listener).toHaveBeenCalledWith("NewFile.md");
  });

  it("survives a throwing listener without poisoning siblings", async () => {
    const adapter = mockAdapter({ "L.md": LONGSWORD_DOC });
    const cache = new FileRefCache(adapter);
    const good = vi.fn();
    cache.onChange(() => {
      throw new Error("boom");
    });
    cache.onChange(good);
    cache.invalidate("L.md");
    expect(good).toHaveBeenCalled();
  });

  it("merges frontmatter into the view", async () => {
    const adapter = mockAdapter({ "Talon.md": "" }, { "Talon.md": { cssclasses: ["note-adventurer"] } });
    const cache = new FileRefCache(adapter);
    const view = await cache.get("Talon.md");
    expect(view?.frontmatter.cssclasses).toEqual(["note-adventurer"]);
  });
});
