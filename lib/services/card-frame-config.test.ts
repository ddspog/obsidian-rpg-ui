import { describe, expect, it } from "vitest";
import { frameSpec } from "./card-frame-config";

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
