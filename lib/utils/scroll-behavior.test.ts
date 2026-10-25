import { afterEach, describe, expect, it, vi } from "vitest";
import { scrollBehavior } from "./scroll-behavior";

afterEach(() => vi.unstubAllGlobals());

describe("scrollBehavior", () => {
  it("is smooth by default", () => {
    vi.stubGlobal("window", { matchMedia: () => ({ matches: false }) });
    expect(scrollBehavior()).toBe("smooth");
  });

  it("is instant when the reader prefers reduced motion", () => {
    vi.stubGlobal("window", { matchMedia: () => ({ matches: true }) });
    expect(scrollBehavior()).toBe("auto");
  });

  it("is smooth where there is no window to ask", () => {
    vi.stubGlobal("window", undefined);
    expect(scrollBehavior()).toBe("smooth");
  });
});
