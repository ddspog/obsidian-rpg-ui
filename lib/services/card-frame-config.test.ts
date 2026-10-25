import { describe, expect, it } from "vitest";
import { activeFrameImage, activeFrameSource, frameSpec, framedUses, relinkFrames, retargetFrames } from "./card-frame-config";

describe("frameSpec", () => {
  it("is not framed unless asked", () => {
    expect(frameSpec(undefined, undefined, "spell")).toBeUndefined();
    expect(frameSpec(false, undefined, "spell")).toBeUndefined();
    expect(frameSpec("nonsense", undefined, "spell")).toBeUndefined();
  });
  it("takes the block's own kind for true, or the one named", () => {
    expect(frameSpec(true, undefined, "spell")).toEqual({ kind: "spell" });
    expect(frameSpec("Item", undefined, "spell")).toEqual({ kind: "item" });
  });
  it("hides or places the name", () => {
    expect(frameSpec(true, false, "portrait")).toEqual({ kind: "portrait", name: "none" });
    expect(frameSpec(true, "plaque", "portrait")).toEqual({ kind: "portrait", name: "plaque" });
    expect(frameSpec(true, "weird", "portrait")).toEqual({ kind: "portrait" });
  });
});

describe("framedUses", () => {
  it("finds framed rpg blocks and the frame each draws", () => {
    const src = [
      "```rpg character.sheet",
      "portrait: \"[[Talon.webp]]\"",
      "framed: true",
      "```",
      "````rpg spell",
      "framed: item",
      "````",
      "```rpg spell",
      "image: x",
      "```",
    ].join("\n");
    expect(framedUses(src)).toEqual([
      { kind: "portrait", block: "character.sheet" },
      { kind: "item", block: "spell" },
    ]);
  });
  it("skips framed: true on a block with no frame of its own", () => {
    expect(framedUses("```rpg stats\nframed: true\n```")).toEqual([]);
    expect(framedUses("```rpg stats\nframed: banner\n```")).toEqual([{ kind: "banner", block: "stats" }]);
  });
});

describe("activeFrameImage", () => {
  const image = { path: "F/x.webp", window: { top: 1, right: 1, bottom: 1, left: 1 }, aspect: 0.75 };
  it("draws the image unless the CSS frame is chosen", () => {
    expect(activeFrameImage({ image })).toBe(image);
    expect(activeFrameImage({ image, use: "image" })).toBe(image);
    expect(activeFrameImage({ image, use: "css" })).toBeUndefined();
    expect(activeFrameImage(undefined)).toBeUndefined();
  });
  it("draws the chosen one when it's there, falling back otherwise", () => {
    expect(activeFrameSource({ css: ".frame{}", use: "generated" })).toBe("generated");
    expect(activeFrameSource({ use: "generated", image })).toBe("image");
    expect(activeFrameSource({ use: "generated" })).toBe("css");
    expect(activeFrameSource({ css: ".frame{}" })).toBe("generated");
    expect(activeFrameSource({ css: ".frame{}", image })).toBe("image");
    expect(activeFrameSource({ image, use: "image" })).toBe("image");
    expect(activeFrameSource({ use: "image" })).toBe("css");
  });
});

describe("moving frame files", () => {
  const at = (path: string) => ({ image: { path, window: { top: 0, right: 0, bottom: 0, left: 0 }, aspect: 1 } });
  it("follows a renamed file or folder", () => {
    const frames = { spell: at("Frames/Spell card frame.webp"), portrait: at("Other/P.webp") };
    expect(retargetFrames(frames, "Frames", "UI/Frames")).toBe(true);
    expect(frames.spell.image.path).toBe("UI/Frames/Spell card frame.webp");
    expect(frames.portrait.image.path).toBe("Other/P.webp");
    expect(retargetFrames(frames, "Other/P.webp", "Other/Q.webp")).toBe(true);
    expect(frames.portrait.image.path).toBe("Other/Q.webp");
    expect(retargetFrames(frames, "Nowhere", "Else")).toBe(false);
  });
  it("finds a missing file by name in the frames folder", () => {
    const frames = { spell: at("Frames/Spell card frame.webp"), item: at("Gone/Item.webp") };
    const there = new Set(["UI/Frames/Spell card frame.webp"]);
    expect(relinkFrames(frames, "UI/Frames", (p) => there.has(p))).toBe(true);
    expect(frames.spell.image.path).toBe("UI/Frames/Spell card frame.webp");
    expect(frames.item.image.path).toBe("Gone/Item.webp");
  });
});
