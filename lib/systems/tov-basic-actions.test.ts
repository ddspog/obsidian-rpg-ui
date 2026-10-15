import { describe, it, expect } from "vitest";
import {
  basicSessionActions,
  loadBasicActions,
  noteIcon,
} from "../../vault/tales-of-the-valiant/config/entities/basic-actions";

describe("basic actions — what any creature can do", () => {
  it("reads each concepts/ folder as its action type", async () => {
    const folders: Record<string, unknown[]> = {
      "concepts/actions": [{ $name: "Attack" }, { $name: "Dash" }, { $name: "Cast a Spell" }],
      "concepts/bonus-actions": [{ $name: "Two-Weapon Fighting" }],
      "concepts/reactions": [{ $name: "Opportunity Attack" }],
    };
    const basics = await loadBasicActions({ folder: async (path) => folders[path] ?? [] });
    expect(basics.map((b) => [b.$name, (b as { type?: string }).type])).toEqual([
      ["Attack", "action"],
      ["Dash", "action"],
      ["Cast a Spell", "action"],
      ["Two-Weapon Fighting", "bonus"],
      ["Opportunity Attack", "reaction"],
    ]);
  });

  it("offers them as cards, leaving out Attack and Cast a Spell", () => {
    const actions = basicSessionActions([
      { $name: "Attack", type: "action" },
      { $name: "Dash", type: "action" },
      { $name: "Opportunity Attack", type: "reaction" },
    ] as never);
    expect(actions).toEqual([
      { name: "Dash", link: "Dash", origin: "basic", bucket: "action" },
      { name: "Opportunity Attack", link: "Opportunity Attack", origin: "basic", bucket: "reaction" },
    ]);
  });
});

describe("basic action icons", () => {
  const note = (header: string) =>
    `# Dash\n\`\`\`rpg feature.details\n${header}\n---\nWhen you take the Dash action…\n\`\`\`\n`;

  it("reads the icon from the note's feature.details fence", () => {
    expect(noteIcon(note('type: action\nicon: "🏃"'))).toBe("🏃");
    expect(noteIcon(note("type: action\nicon: footprints"))).toBe("footprints");
  });

  it("gives none when the fence declares none", () => {
    expect(noteIcon(note("type: action"))).toBeUndefined();
    expect(noteIcon(undefined)).toBeUndefined();
  });

  it("carries the icon onto the card", () => {
    const [dash] = basicSessionActions([
      { $name: "Dash", type: "action", $contents: note('type: action\nicon: "🏃"') },
    ] as never);
    expect(dash).toEqual({ name: "Dash", link: "Dash", origin: "basic", bucket: "action", icon: "🏃" });
  });
});

describe("basic actions that check with a picked skill", () => {
  it("reads `skills`, `summary` and `target` from the note's fence", () => {
    const contents =
      '```rpg feature.details\ntype: action\nicon: "🗣️"\nsummary: Sway a creature.\nskills: [Persuasion, Deception, Animal Handling]\ntarget: true\n---\nBody.\n```\n';
    const [influence] = basicSessionActions([{ $name: "Influence", type: "action", $contents: contents }] as never);
    expect(influence).toEqual({
      name: "Influence",
      link: "Influence",
      origin: "basic",
      bucket: "action",
      icon: "🗣️",
      summary: "Sway a creature.",
      skills: ["Persuasion", "Deception", "Animal Handling"],
      target: true,
    });
  });
});

describe("free-form basic actions", () => {
  it("reads `freeform` and `rank` from the note's fence", () => {
    const contents = '```rpg feature.details\ntype: action\nicon: "🪶"\nfreeform: true\nrank: 1\n---\nBody.\n```\n';
    const [improvise] = basicSessionActions([{ $name: "Improvise", type: "action", $contents: contents }] as never);
    expect(improvise).toEqual({
      name: "Improvise",
      link: "Improvise",
      origin: "basic",
      bucket: "action",
      icon: "🪶",
      freeform: true,
      rank: 1,
    });
  });
});
