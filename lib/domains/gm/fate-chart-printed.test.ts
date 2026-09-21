import { describe, it, expect } from "vitest";
import { fateThreshold, fateExceptional } from "./fate-chart";
import type { GMLikelihood } from "lib/domains/features/types";

/**
 * The Fate Chart exactly as printed in the vault's own note, transcribed cell by
 * cell: `[exceptional-yes, yes-threshold, exceptional-no]` for chaos factors 1..9,
 * where "x" is a cell whose exceptional result is impossible.
 *
 * This is the chart the table in `gm-tools/oracle/Fate Chart.md` shows a reader, so
 * the resolver has to agree with it everywhere and not merely near the middle. A
 * formula that scaled a base value linearly passed a spot-check at 50/50 and was
 * wrong in every other row.
 */
const PRINTED: Array<[GMLikelihood, Array<[string, number, string]>]> = [
  [
    "certain",
    [
      ["10", 50, "91"],
      ["13", 65, "94"],
      ["15", 75, "96"],
      ["17", 85, "98"],
      ["18", 90, "99"],
      ["19", 95, "100"],
      ["20", 99, "x"],
      ["20", 99, "x"],
      ["20", 99, "x"],
    ],
  ],
  [
    "near-certain",
    [
      ["7", 35, "88"],
      ["10", 50, "91"],
      ["13", 65, "94"],
      ["15", 75, "96"],
      ["17", 85, "98"],
      ["18", 90, "99"],
      ["19", 95, "100"],
      ["20", 99, "x"],
      ["20", 99, "x"],
    ],
  ],
  [
    "very-likely",
    [
      ["5", 25, "86"],
      ["7", 35, "88"],
      ["10", 50, "91"],
      ["13", 65, "94"],
      ["15", 75, "96"],
      ["17", 85, "98"],
      ["18", 90, "99"],
      ["19", 95, "100"],
      ["20", 99, "x"],
    ],
  ],
  [
    "likely",
    [
      ["3", 15, "84"],
      ["5", 25, "86"],
      ["7", 35, "88"],
      ["10", 50, "91"],
      ["13", 65, "94"],
      ["15", 75, "96"],
      ["17", 85, "98"],
      ["18", 90, "99"],
      ["19", 95, "100"],
    ],
  ],
  [
    "50/50",
    [
      ["2", 10, "83"],
      ["3", 15, "84"],
      ["5", 25, "86"],
      ["7", 35, "88"],
      ["10", 50, "91"],
      ["13", 65, "94"],
      ["15", 75, "96"],
      ["17", 85, "98"],
      ["18", 90, "99"],
    ],
  ],
  [
    "unlikely",
    [
      ["1", 5, "82"],
      ["2", 10, "83"],
      ["3", 15, "84"],
      ["5", 25, "86"],
      ["7", 35, "88"],
      ["10", 50, "91"],
      ["13", 65, "94"],
      ["15", 75, "96"],
      ["17", 85, "98"],
    ],
  ],
  [
    "very-unlikely",
    [
      ["x", 1, "81"],
      ["1", 5, "82"],
      ["2", 10, "83"],
      ["3", 15, "84"],
      ["5", 25, "86"],
      ["7", 35, "88"],
      ["10", 50, "91"],
      ["13", 65, "94"],
      ["15", 75, "96"],
    ],
  ],
  [
    "near-impossible",
    [
      ["x", 1, "81"],
      ["x", 1, "81"],
      ["1", 5, "82"],
      ["2", 10, "83"],
      ["3", 15, "84"],
      ["5", 25, "86"],
      ["7", 35, "88"],
      ["10", 50, "91"],
      ["13", 65, "94"],
    ],
  ],
  [
    "impossible",
    [
      ["x", 1, "81"],
      ["x", 1, "81"],
      ["x", 1, "81"],
      ["1", 5, "82"],
      ["2", 10, "83"],
      ["3", 15, "84"],
      ["5", 25, "86"],
      ["7", 35, "88"],
      ["10", 50, "91"],
    ],
  ],
];

describe("the Fate Chart, against the printed one", () => {
  it("gives the same Yes threshold in all 81 cells", () => {
    const wrong: string[] = [];
    for (const [odds, cells] of PRINTED) {
      cells.forEach(([, printed], i) => {
        const cf = i + 1;
        const got = fateThreshold(cf, odds);
        if (got !== printed) wrong.push(`${odds} at CF${cf}: chart ${printed}, got ${got}`);
      });
    }
    expect(wrong).toEqual([]);
  });

  it("gives the same exceptional edges, including the impossible ones", () => {
    const wrong: string[] = [];
    for (const [odds, cells] of PRINTED) {
      cells.forEach(([exYes, threshold, exNo], i) => {
        const cf = i + 1;
        const ex = fateExceptional(fateThreshold(cf, odds));
        // "x" on the chart means no roll can be exceptional: below 1, or above 100.
        const gotYes = ex.yes < 1 ? "x" : String(ex.yes);
        const gotNo = ex.no > 100 ? "x" : String(ex.no);
        if (gotYes !== exYes) wrong.push(`${odds} CF${cf} exYes: chart ${exYes}, got ${gotYes}`);
        if (gotNo !== exNo) wrong.push(`${odds} CF${cf} exNo: chart ${exNo}, got ${gotNo}`);
        void threshold;
      });
    }
    expect(wrong).toEqual([]);
  });
});
