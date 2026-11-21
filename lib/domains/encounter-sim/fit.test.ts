import { describe, expect, it } from "vitest";

import { classifyFit, FIT_TOLERANCE, OUTCOME_PROFILES, outcomeDistance } from "./fit";

describe("OUTCOME_PROFILES", () => {
  it("holds the three profiles", () => {
    expect(OUTCOME_PROFILES).toEqual({
      easy: { toll: 0.25, tpk: 0 },
      challenging: { toll: 0.5, tpk: 0.05 },
      deadly: { toll: 0.75, tpk: 0.2 },
    });
    expect(FIT_TOLERANCE).toBe(0.3);
  });
});

describe("outcomeDistance", () => {
  it("is zero on the profile", () => {
    expect(outcomeDistance({ avgHpLost: 0.5, tpkRate: 0.05 }, "challenging")).toBeCloseTo(0, 10);
    expect(outcomeDistance({ avgHpLost: 0.25, tpkRate: 0 }, "easy")).toBeCloseTo(0, 10);
    expect(outcomeDistance({ avgHpLost: 0.75, tpkRate: 0.2 }, "deadly")).toBeCloseTo(0, 10);
  });

  it("adds the HP gap and twice the TPK gap, on either side", () => {
    expect(outcomeDistance({ avgHpLost: 0.3, tpkRate: 0.15 }, "challenging")).toBeCloseTo(0.2 + 2 * 0.1, 10);
    expect(outcomeDistance({ avgHpLost: 0.9, tpkRate: 0 }, "challenging")).toBeCloseTo(0.4 + 2 * 0.05, 10);
    expect(outcomeDistance({ avgHpLost: 0, tpkRate: 0 }, "deadly")).toBeCloseTo(0.75 + 2 * 0.2, 10);
  });
});

describe("classifyFit", () => {
  it("is fit within 0.3 of the profile, boundary included", () => {
    expect(classifyFit({ avgHpLost: 0.5, tpkRate: 0.05 }, "challenging")).toBe("fit");
    expect(classifyFit({ avgHpLost: 0.8, tpkRate: 0.05 }, "challenging")).toBe("fit");
    expect(classifyFit({ avgHpLost: 0.2, tpkRate: 0.05 }, "challenging")).toBe("fit");
    expect(classifyFit({ avgHpLost: 0.81, tpkRate: 0.05 }, "challenging")).not.toBe("fit");
  });

  it("is too-easy when it costs less HP than aimed for and kills no more often", () => {
    expect(classifyFit({ avgHpLost: 0.05, tpkRate: 0 }, "challenging")).toBe("too-easy");
    expect(classifyFit({ avgHpLost: 0.1, tpkRate: 0.05 }, "challenging")).toBe("too-easy");
    expect(classifyFit({ avgHpLost: 0.1, tpkRate: 0 }, "easy")).toBe("fit");
    expect(classifyFit({ avgHpLost: 0.3, tpkRate: 0 }, "deadly")).toBe("too-easy");
  });

  it("is too-hard when it costs more HP or kills more often than aimed for", () => {
    expect(classifyFit({ avgHpLost: 0.95, tpkRate: 0.6 }, "challenging")).toBe("too-hard");
    expect(classifyFit({ avgHpLost: 0.4, tpkRate: 0.5 }, "challenging")).toBe("too-hard");
    expect(classifyFit({ avgHpLost: 0.6, tpkRate: 0 }, "easy")).toBe("too-hard");
    expect(classifyFit({ avgHpLost: 1, tpkRate: 1 }, "deadly")).toBe("too-hard");
  });
});
