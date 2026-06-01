import { describe, expect, it } from "vitest";
import {
  findFenceBody,
  resolveListLines,
  type ListFile,
  type ListSource,
} from "./resolve-entries";
import type { ListBlock } from "./types";

/** In-memory ListSource — mirrors the FakeSource pattern in value-resolver.test.ts. */
class FakeSource implements ListSource {
  files = new Map<string, string>();
  fm = new Map<string, Record<string, unknown>>();
  folders = new Map<string, ListFile[]>();

  listFolderFiles(target: string): ListFile[] {
    return this.folders.get(target) ?? [];
  }
  resolveFile(target: string): ListFile | null {
    for (const path of this.files.keys()) {
      const basename = path.replace(/\.md$/, "").split("/").pop() ?? path;
      if (path === target || path === `${target}.md` || basename === target) {
        return { path, basename };
      }
    }
    return null;
  }
  async read(path: string): Promise<string | null> {
    return this.files.get(path) ?? null;
  }
  frontmatter(path: string): Record<string, unknown> | undefined {
    return this.fm.get(path);
  }
}

/** A spell file with a dotless `rpg spell` fence (head + markdown body). */
const spellFile = (school: string, summary: string) =>
  "```rpg spell\n" + `school: ${school}\n` + `summary: ${summary}\n` + "---\nFlavour.\n```\n";

const block = (entries: ListBlock["entries"], id = "list"): ListBlock => ({
  name: "List",
  id,
  columns: "auto",
  entries,
});

describe("findFenceBody", () => {
  it("reads a dotless fence's YAML head", () => {
    expect(findFenceBody(spellFile("Evocation", "Fire harms foe."), "spell")).toEqual({
      school: "Evocation",
      summary: "Fire harms foe.",
    });
  });

  it("reads a dotted fence's head", () => {
    const c = "```rpg item.element\nname: Sword\nrarity: rare\n```\n";
    expect(findFenceBody(c, "item")).toEqual({ name: "Sword", rarity: "rare" });
  });

  it("returns null when the kind is absent", () => {
    expect(findFenceBody("# Just a note\n\nNo fences.", "spell")).toBeNull();
  });
});

describe("resolveListLines", () => {
  it("enumerates a folder, one formatted line per file (sorted)", async () => {
    const src = new FakeSource();
    src.files.set("spells/cantrips/Fire Bolt.md", spellFile("Evocation", "Fire harms foe."));
    src.files.set("spells/cantrips/Acid Splash.md", spellFile("Conjuration", "Acid bursts."));
    src.folders.set("/spells/cantrips/", [
      { path: "spells/cantrips/Acid Splash.md", basename: "Acid Splash" },
      { path: "spells/cantrips/Fire Bolt.md", basename: "Fire Bolt" },
    ]);

    const lines = await resolveListLines(
      block([
        {
          call: "@[[/spells/cantrips/]].block(0)",
          format: "[[${name}]] (${school}) ${summary}",
        },
      ]),
      "host.md",
      src
    );

    expect(lines.map((l) => l.markdown)).toEqual([
      "[[Acid Splash]] (Conjuration) Acid bursts.",
      "[[Fire Bolt]] (Evocation) Fire harms foe.",
    ]);
    expect(lines[0].listId).toBe("list");
    expect(lines[0].file).toBe("spells/cantrips/Acid Splash.md");
  });

  it("applies a .filter() chain against harvested fields", async () => {
    const src = new FakeSource();
    src.files.set("spells/cantrips/Fire Bolt.md", spellFile("Evocation", "Fire harms foe."));
    src.files.set("spells/cantrips/Acid Splash.md", spellFile("Conjuration", "Acid bursts."));
    src.folders.set("/spells/cantrips/", [
      { path: "spells/cantrips/Acid Splash.md", basename: "Acid Splash" },
      { path: "spells/cantrips/Fire Bolt.md", basename: "Fire Bolt" },
    ]);

    const lines = await resolveListLines(
      block([
        {
          call: "@[[/spells/cantrips/]].filter(school == Evocation).spell()",
          format: "${name}",
        },
      ]),
      "host.md",
      src
    );
    expect(lines.map((l) => l.markdown)).toEqual(["Fire Bolt"]);
  });

  it("falls back to file frontmatter when no matching fence exists", async () => {
    const src = new FakeSource();
    src.files.set("spells/cantrips/Light.md", "# Light\n\nNo fence here.\n");
    src.fm.set("spells/cantrips/Light.md", { school: "Evocation", summary: "Glow." });
    src.folders.set("/spells/cantrips/", [
      { path: "spells/cantrips/Light.md", basename: "Light" },
    ]);

    const lines = await resolveListLines(
      block([{ call: "@[[/spells/cantrips/]].block(0)", format: "${name}: ${school}, ${summary}" }]),
      "host.md",
      src
    );
    expect(lines.map((l) => l.markdown)).toEqual(["Light: Evocation, Glow."]);
  });

  it("resolves a single-file target into one line", async () => {
    const src = new FakeSource();
    src.files.set("spells/Fire Bolt.md", spellFile("Evocation", "Fire harms foe."));

    const lines = await resolveListLines(
      block([{ call: "@[[spells/Fire Bolt]].block(0)", format: "${name} (${school})" }]),
      "host.md",
      src
    );
    expect(lines.map((l) => l.markdown)).toEqual(["Fire Bolt (Evocation)"]);
  });

  it("`.block()` uses the file's own frontmatter, ignoring fences", async () => {
    const src = new FakeSource();
    src.files.set("spells/X.md", spellFile("FenceSchool", "From the fence."));
    src.fm.set("spells/X.md", { school: "FileSchool", summary: "From frontmatter." });

    const lines = await resolveListLines(
      block([{ call: "@[[spells/X]].block()", format: "${name}: ${school}, ${summary}" }]),
      "host.md",
      src
    );
    expect(lines.map((l) => l.markdown)).toEqual(["X: FileSchool, From frontmatter."]);
  });

  it("`.block(N)` selects the Nth fence by document order", async () => {
    const src = new FakeSource();
    src.files.set("things/T.md", "```rpg item.a\nval: first\n```\n```rpg item.b\nval: second\n```\n");

    const lines = await resolveListLines(
      block([{ call: "@[[things/T]].block(1)", format: "${val}" }]),
      "host.md",
      src
    );
    expect(lines.map((l) => l.markdown)).toEqual(["second"]);
  });

  it("`.block(id)` selects the fence whose id / name matches", async () => {
    const src = new FakeSource();
    src.files.set("things/T.md", "```rpg item.a\nid: alpha\nval: 1\n```\n```rpg item.b\nid: beta\nval: 2\n```\n");

    const lines = await resolveListLines(
      block([{ call: "@[[things/T]].block(beta)", format: "${val}" }]),
      "host.md",
      src
    );
    expect(lines.map((l) => l.markdown)).toEqual(["2"]);
  });

  it("composes another list block via .list(id), re-formatting its records", async () => {
    const src = new FakeSource();
    src.files.set("spells/cantrips/Fire Bolt.md", spellFile("Evocation", "Fire harms foe."));
    src.folders.set("/spells/cantrips/", [
      { path: "spells/cantrips/Fire Bolt.md", basename: "Fire Bolt" },
    ]);
    src.files.set(
      "lists/arcane.md",
      "```rpg list.extra\n" +
        "name: Extra\n" +
        "entries:\n" +
        '  - call: "@[[/spells/cantrips/]].block(0)"\n' +
        '    format: "ignored ${name}"\n' +
        "```\n"
    );

    const lines = await resolveListLines(
      block([{ call: "@[[lists/arcane]].list(extra)", format: "★ ${name}" }]),
      "host.md",
      src
    );
    // The importing entry's format wins (records imported, not rendered lines).
    expect(lines.map((l) => l.markdown)).toEqual(["★ Fire Bolt"]);
  });

  it("guards against a list importing itself (cycle)", async () => {
    const src = new FakeSource();
    src.files.set(
      "lists/loop.md",
      "```rpg list.loop\n" +
        "name: Loop\n" +
        "entries:\n" +
        '  - call: "@[[lists/loop]].list(loop)"\n' +
        '    format: "${name}"\n' +
        "```\n"
    );

    const lines = await resolveListLines(
      block([{ call: "@[[lists/loop]].list(loop)", format: "${name}" }], "loop"),
      "lists/loop.md",
      src
    );
    expect(lines).toEqual([]);
  });

  it("skips entries whose call doesn't parse", async () => {
    const src = new FakeSource();
    const lines = await resolveListLines(
      block([{ call: "not a call", format: "${name}" }]),
      "host.md",
      src
    );
    expect(lines).toEqual([]);
  });

  it("emits literal text entries as-is, mixed with resolved call entries", async () => {
    const src = new FakeSource();
    src.files.set("spells/cantrips/Fire Bolt.md", spellFile("Evocation", "Fire harms foe."));
    src.folders.set("/spells/cantrips/", [
      { path: "spells/cantrips/Fire Bolt.md", basename: "Fire Bolt" },
    ]);

    const lines = await resolveListLines(
      block([
        { text: "*Homebrew Bolt* (Evocation) A fixed line." },
        { call: "@[[/spells/cantrips/]].block(0)", format: "[[${name}]] (${school})" },
      ]),
      "host.md",
      src
    );
    expect(lines.map((l) => l.markdown)).toEqual([
      "*Homebrew Bolt* (Evocation) A fixed line.",
      "[[Fire Bolt]] (Evocation)",
    ]);
  });

  it("`.highlight()` (no condition) flags homebrew records by source, with label/color", async () => {
    const src = new FakeSource();
    src.files.set("spells/cantrips/Hex.md", spellFile("Necromancy", "A curse."));
    src.fm.set("spells/cantrips/Hex.md", { source: "From D&D 5e Homebrew" }); // not official
    src.files.set("spells/cantrips/Mage Hand.md", spellFile("Conjuration", "A hand."));
    src.fm.set("spells/cantrips/Mage Hand.md", { source: "From Tales of the Valiant" }); // official
    src.folders.set("/spells/cantrips/", [
      { path: "spells/cantrips/Hex.md", basename: "Hex" },
      { path: "spells/cantrips/Mage Hand.md", basename: "Mage Hand" },
    ]);

    const lines = await resolveListLines(
      block([
        {
          call: "@[[/spells/cantrips/]].highlight(label: hb, color: purple).block(0)",
          format: "[[${name}]]",
        },
      ]),
      "host.md",
      src,
      ["Tales of the Valiant"] // official sources for this system
    );
    const hl = Object.fromEntries(lines.map((l) => [l.markdown, l.highlight]));
    expect(hl["[[Hex]]"]).toEqual({ label: "hb", color: "purple" }); // homebrew → flagged
    expect(hl["[[Mage Hand]]"]).toBeUndefined(); // official → not flagged

    // No `.highlight()` → no flag, even for homebrew.
    const plain = await resolveListLines(
      block([{ call: "@[[/spells/cantrips/]].block(0)", format: "[[${name}]]" }]),
      "host.md",
      src,
      ["Tales of the Valiant"]
    );
    expect(plain.every((l) => l.highlight === undefined)).toBe(true);
  });

  it("exposes a `homebrew` field usable in formats and filters", async () => {
    const src = new FakeSource();
    src.files.set("spells/cantrips/Hex.md", spellFile("Necromancy", "A curse."));
    src.fm.set("spells/cantrips/Hex.md", { source: "Homebrew" });
    src.files.set("spells/cantrips/Bless.md", spellFile("Enchantment", "A boon."));
    src.fm.set("spells/cantrips/Bless.md", { source: "From Tales of the Valiant" });
    src.folders.set("/spells/cantrips/", [
      { path: "spells/cantrips/Bless.md", basename: "Bless" },
      { path: "spells/cantrips/Hex.md", basename: "Hex" },
    ]);

    const lines = await resolveListLines(
      block([{ call: "@[[/spells/cantrips/]].filter(homebrew == true).block(0)", format: "${name}" }]),
      "host.md",
      src,
      ["Tales of the Valiant"]
    );
    expect(lines.map((l) => l.markdown)).toEqual(["Hex"]); // only the homebrew one
  });

  it("highlights only records matching a `.highlight(when: …)` condition", async () => {
    const src = new FakeSource();
    src.files.set("spells/cantrips/Mage Hand.md", spellFile("Conjuration", "Magic hand.")); // official
    src.files.set("spells/cantrips/Hex º.md", spellFile("Necromancy", "A curse.")); // marked
    src.folders.set("/spells/cantrips/", [
      { path: "spells/cantrips/Hex º.md", basename: "Hex º" },
      { path: "spells/cantrips/Mage Hand.md", basename: "Mage Hand" },
    ]);

    const lines = await resolveListLines(
      block([
        {
          call: "@[[/spells/cantrips/]].highlight(when: 'name like /[º]/').block(0)",
          format: "[[${name}]]",
        },
      ]),
      "host.md",
      src
    );
    const byName = Object.fromEntries(lines.map((l) => [l.markdown, !!l.highlight]));
    expect(byName["[[Hex º]]"]).toBe(true); // marked → highlighted
    expect(byName["[[Mage Hand]]"]).toBe(false); // official → not highlighted
  });
});
