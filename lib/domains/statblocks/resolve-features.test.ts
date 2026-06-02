import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolveStatFeatures } from "./resolve-features";

/** Wrap a feature.details body in its fence + a host doc. */
function featureDoc(body: string): string {
  return "```rpg feature.details\n" + body + "\n```";
}

const VOLLEY = `name: Volley
type: action
auto: "abilities.dex"
tiers:
  0: { hit: 5, damage: "16 (3d10)" }
  2: { hit: 7, damage: "20 (4d10)" }
---
+{{hit}} hit, {{damage}} damage.`;

describe("resolveStatFeatures — auto tier selection", () => {
  const files: Record<string, string> = {};

  beforeEach(() => {
    (globalThis as unknown as { app: unknown }).app = {
      metadataCache: {
        getFirstLinkpathDest: (stem: string) => (files[stem] ? { path: `${stem}.md` } : null),
      },
      vault: {
        cachedRead: async (f: { path: string }) => files[f.path.replace(/\.md$/, "")] ?? "",
      },
    };
  });

  afterEach(() => {
    delete (globalThis as unknown as { app?: unknown }).app;
    for (const k of Object.keys(files)) delete files[k];
  });

  it("reads the `auto` path from the statblock to pick the tier", async () => {
    files["Volley"] = featureDoc(VOLLEY);
    const out = await resolveStatFeatures([{ ref: "[[Volley]]" }], "src.md", {
      abilities: { dex: 2 },
    });
    expect(out[0].text).toContain("+7 hit");
    expect(out[0].text).toContain("20 (4d10)");
  });

  it("an explicit ref.tier overrides `auto`", async () => {
    files["Volley"] = featureDoc(VOLLEY);
    const out = await resolveStatFeatures([{ ref: "[[Volley]]", tier: 0 }], "src.md", {
      abilities: { dex: 2 },
    });
    expect(out[0].text).toContain("+5 hit");
  });

  it("falls back to the first tier when `auto` resolves to an unknown tier", async () => {
    files["Volley"] = featureDoc(VOLLEY);
    const out = await resolveStatFeatures([{ ref: "[[Volley]]" }], "src.md", {
      abilities: { dex: 9 },
    });
    expect(out[0].text).toContain("+5 hit"); // first tier (0)
  });

  it("falls back to the first tier when there is no `auto` and no ref.tier", async () => {
    files["Bite"] = featureDoc(`name: Bite
type: action
tiers:
  0: { hit: 3 }
  1: { hit: 6 }
---
+{{hit}} hit.`);
    const out = await resolveStatFeatures([{ ref: "[[Bite]]" }], "src.md", {});
    expect(out[0].text).toContain("+3 hit");
  });
});

describe("resolveStatFeatures — expression evaluation in text", () => {
  const files: Record<string, string> = {};

  beforeEach(() => {
    (globalThis as unknown as { app: unknown }).app = {
      metadataCache: {
        getFirstLinkpathDest: (stem: string) => (files[stem] ? { path: `${stem}.md` } : null),
      },
      vault: {
        cachedRead: async (f: { path: string }) => files[f.path.replace(/\.md$/, "")] ?? "",
      },
    };
  });

  afterEach(() => {
    delete (globalThis as unknown as { app?: unknown }).app;
    for (const k of Object.keys(files)) delete files[k];
  });

  it("evaluates ternary with truthy comparison", async () => {
    files["Intro"] = featureDoc(`name: Intro
type: action
tiers:
  1: { actions: "one action" }
---
Take {{actions}}. {{ self.stats.crew > 3 ? "Reduced if fewer than half." }}`);
    const out = await resolveStatFeatures([{ ref: "[[Intro]]" }], "src.md", {
      stats: { crew: 5 },
    });
    expect(out[0].text).toContain("one action");
    expect(out[0].text).toContain("Reduced if fewer than half.");
  });

  it("evaluates ternary with falsy comparison (omits text)", async () => {
    files["Intro"] = featureDoc(`name: Intro
type: action
tiers:
  1: { actions: "one action" }
---
Take {{actions}}. {{ self.stats.crew > 3 ? "Reduced if fewer than half." }}`);
    const out = await resolveStatFeatures([{ ref: "[[Intro]]" }], "src.md", {
      stats: { crew: 2 },
    });
    expect(out[0].text).toContain("one action");
    expect(out[0].text).not.toContain("Reduced");
  });

  it("evaluates full ternary with else branch", async () => {
    files["Intro"] = featureDoc(`name: Intro
type: action
---
{{ self.stats.crew > 20 ? "Can't move if < 3 crew" : "Can't act if < 2 crew." }}`);
    const out = await resolveStatFeatures([{ ref: "[[Intro]]" }], "src.md", {
      stats: { crew: 3 },
    });
    expect(out[0].text).toContain("Can't act if < 2 crew.");
  });

  it("evaluates math (division)", async () => {
    files["Intro"] = featureDoc(`name: Intro
type: action
---
fewer than {{ self.stats.crew / 2 }} crew`);
    const out = await resolveStatFeatures([{ ref: "[[Intro]]" }], "src.md", {
      stats: { crew: 6 },
    });
    expect(out[0].text).toContain("fewer than 3 crew");
  });

  it("evaluates nested {{ }} inside ternary string", async () => {
    files["Intro"] = featureDoc(`name: Intro
type: action
---
{{ self.stats.crew > 3 ? "fewer than {{ self.stats.crew / 2 }}" }}`);
    const out = await resolveStatFeatures([{ ref: "[[Intro]]" }], "src.md", {
      stats: { crew: 8 },
    });
    expect(out[0].text).toContain("fewer than 4");
  });

  it("resolves self.name from selfProps", async () => {
    files["Intro"] = featureDoc(`name: Intro
type: action
---
the {{self.name}} acts.`);
    const out = await resolveStatFeatures([{ ref: "[[Intro]]" }], "src.md", {
      name: "keelboat",
    });
    expect(out[0].text).toContain("the keelboat acts.");
  });
});
