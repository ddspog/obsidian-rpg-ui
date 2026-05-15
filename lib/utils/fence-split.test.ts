import { describe, expect, it } from "vitest";
import { splitFenceBody } from "./fence-split";

describe("splitFenceBody", () => {
  it("splits on first --- separator", () => {
    const result = splitFenceBody("name: Test\nicon: star\n---\nSome **markdown** body.");
    expect(result.yaml).toBe("name: Test\nicon: star");
    expect(result.text).toBe("Some **markdown** body.");
  });

  it("returns full source as yaml when no separator", () => {
    const result = splitFenceBody("name: Test\nvalue: 42");
    expect(result.yaml).toBe("name: Test\nvalue: 42");
    expect(result.text).toBeUndefined();
  });

  it("trims leading/trailing blank lines from text", () => {
    const result = splitFenceBody("key: val\n---\n\n\nBody here.\n\n\n");
    expect(result.text).toBe("Body here.");
  });

  it("returns undefined text for empty body after separator", () => {
    const result = splitFenceBody("key: val\n---\n");
    expect(result.text).toBeUndefined();
  });

  it("handles separator on first line (empty yaml head)", () => {
    const result = splitFenceBody("---\nJust markdown.");
    expect(result.yaml).toBe("");
    expect(result.text).toBe("Just markdown.");
  });

  it("preserves internal --- in body (only splits on first)", () => {
    const result = splitFenceBody("key: val\n---\nLine 1\n---\nLine 2");
    expect(result.yaml).toBe("key: val");
    expect(result.text).toBe("Line 1\n---\nLine 2");
  });
});
