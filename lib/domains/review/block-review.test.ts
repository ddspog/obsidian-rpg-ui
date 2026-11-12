import { describe, expect, it } from "vitest";
import { parseTableBlock } from "../tables/parse-table-block";
import { offReason, parseReviewLine, reviewLine, splitMessage, takeBlockReview } from "./block-review";

describe("block review", () => {
  it("reads a review line, as a YAML comment or bare, with its kind and what it turns off", () => {
    expect(parseReviewLine("# @review fix/table-numbers roll: No row for 4 of the d6.")).toEqual({
      severity: "fix",
      kind: "table-numbers",
      off: ["roll"],
      message: "No row for 4 of the d6.",
    });
    expect(parseReviewLine("@review check: Row 5-8 widened.")).toEqual({
      severity: "check",
      off: [],
      message: "Row 5-8 widened.",
    });
    expect(parseReviewLine("# a comment")).toBeNull();
    expect(parseReviewLine("@review maybe: nothing")).toBeNull();
  });

  it("takes the review lines off the top of a block, and writes them back the same", () => {
    const source = "# @review fix/table-numbers roll: No row for 4.\n# @review note: Rows put back.\nname: Orc\nac: 13";
    const { reviews, source: rest } = takeBlockReview(source);
    expect(rest).toBe("name: Orc\nac: 13");
    expect(reviews.map(reviewLine).join("\n")).toBe(source.split("\nname")[0]);
    expect(offReason(reviews, "roll")).toBe("No row for 4.");
    expect(offReason(reviews, "edit")).toBeNull();
    // Only the lines at the top: one further down is the block's own text.
    expect(takeBlockReview("name: Orc\n# @review fix: x").reviews).toHaveLength(0);
  });

  it("splits a message into the problem and what to do", () => {
    expect(splitMessage("No row for 4 of the d6 (p. 12). What to do: look on the next page.")).toEqual({
      problem: "No row for 4 of the d6 (p. 12).",
      todo: "Look on the next page.",
    });
    expect(splitMessage("Rows put back.")).toEqual({ problem: "Rows put back." });
  });

  it("lets a table parsed straight from a note carry its review", () => {
    const def = parseTableBlock(
      "monsters",
      "# @review fix/table-numbers roll: No row for 3.\n|d4*|Monster|\n|---|---|\n|1|Orc|\n|2|Ogre|\n|4|Troll|"
    );
    expect(def.reviews?.[0]).toMatchObject({ severity: "fix", off: ["roll"] });
    expect(def.rows).toHaveLength(3);
  });
});
