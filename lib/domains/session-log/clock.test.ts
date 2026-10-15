import { describe, it, expect } from "vitest";
import { parseLonelog } from "lib/domains/lonelog/parser";
import { groupIntoProse } from "./prose-grouper";
import { clockText, foldClock, hoursSinceLongRest } from "./clock";

const segments = (lines: string[]) => groupIntoProse(parseLonelog(lines.join("\n")));

describe("the day's clock", () => {
  it("moves on with each [Time: +…], and is set by [Time: Day…]", () => {
    expect(
      clockText(
        foldClock(segments(["@(Party) Short rest", "=> [Time: +1h]", "@(Party) Travels on", "=> [Time: +18h]"])).now
      )
    ).toBe("Day 2, 03:00");
    expect(clockText(foldClock(segments(["=> Dawn breaks. [Time: Day 3, 06:30]"])).now)).toBe("Day 3, 06:30");
  });

  it("says how long since the last long rest", () => {
    expect(
      hoursSinceLongRest(segments(["@(Party) Long rest", "=> [Time: +8h]", "@(Party) Travels on", "=> [Time: +6h]"]))
    ).toBe(6);
    expect(hoursSinceLongRest(segments(["@(Party) Short rest", "=> [Time: +1h]"]))).toBeUndefined();
  });
});
