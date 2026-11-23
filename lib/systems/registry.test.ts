import { describe, expect, it } from "vitest";
import { SystemRegistry } from "./registry";
import type { RPGSystem } from "./types";

type Internals = { systemCache: Map<string, RPGSystem> };

describe("SystemRegistry.resetForVault", () => {
  it("forgets the systems the last vault loaded, which are cached by folder path", () => {
    const registry = SystemRegistry.getInstance();
    const first = {} as never;
    const second = {} as never;
    const mappings = new Map([["fixture", "fixture/config"]]);
    registry.resetForVault(first, mappings);
    const stale = { ...registry.getDefaultSystem(), name: "First vault's system" } as RPGSystem;
    (registry as unknown as Internals).systemCache.set("fixture/config", stale);
    expect(registry.getSystemForFile("fixture/notes/a.md").name).toBe("First vault's system");

    // Another vault with a system at the same folder: the first one's must not answer for it.
    registry.resetForVault(second, mappings);
    expect((registry as unknown as Internals).systemCache.size).toBe(0);
    expect(registry.findSystemFolderForFile("fixture/notes/a.md")).toBe("fixture/config");
  });
});
