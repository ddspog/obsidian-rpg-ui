import { describe, it, expect } from "vitest";
import { lucideComponent } from "./lucide-icon";
import { isEmoji } from "./action-card";

describe("isEmoji — an icon written as an emoji", () => {
  it("recognises emoji, including ones made of several code points", () => {
    for (const e of ["✅", "🎬", "🔮", "👥", "⚡", "🧵", "🇧🇷"]) expect(isEmoji(e)).toBe(true);
  });

  it("leaves Lucide names and empty icons alone", () => {
    expect(isEmoji("help-circle")).toBe(false);
    expect(isEmoji(undefined)).toBe(false);
  });
});

describe("lucideComponent — an icon by its authored name", () => {
  it("reads kebab-case, as Obsidian icon fields write it", () => {
    expect(lucideComponent("help-circle")).not.toBeNull();
    expect(lucideComponent("clipboard-check")).not.toBeNull();
  });

  it("reads PascalCase too", () => {
    expect(lucideComponent("Clapperboard")).not.toBeNull();
  });

  it("gives nothing for an unknown or missing name", () => {
    expect(lucideComponent("not-an-icon")).toBeNull();
    expect(lucideComponent(undefined)).toBeNull();
  });
});
