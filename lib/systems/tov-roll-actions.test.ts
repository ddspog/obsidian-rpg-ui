import { describe, it, expect } from "vitest";
import { rollBucket, rollInflicts } from "../../vault/tales-of-the-valiant/config/entities/roll-card";

const conditions = { blinded: { name: "Blinded", rules: [] }, restrained: { name: "Restrained", rules: [] } };

describe("a rolled spell's card — its stack and what it leaves", () => {
  it("leaves a condition the system knows on a failed save", () => {
    const bolt = {
      save: { ability: "CON", on_success: "negates blinded" },
      effects: ["blinded"],
      notes: "blinded until end of its next turn on failed save",
    } as Parameters<typeof rollInflicts>[0];
    expect(rollInflicts(bolt, conditions)).toEqual({
      condition: "blinded",
      on: "fail",
      note: "blinded until end of its next turn on failed save",
    });
  });

  it("leaves none for an effect that's no condition, and keeps what the roll says itself", () => {
    expect(
      rollInflicts({ save: { ability: "STR" }, effects: ["pin"] } as Parameters<typeof rollInflicts>[0], conditions)
    ).toBeUndefined();
    const pinned = { condition: "pinned", save: "STR" };
    expect(rollInflicts({ inflicts: pinned, effects: ["pin"] } as Parameters<typeof rollInflicts>[0], conditions)).toBe(
      pinned
    );
  });

  it("strikes from the Attack stack — an attack, or a save that hurts; else it's an action", () => {
    expect(rollBucket({ form: "spell" }, true)).toBe("attack");
    expect(rollBucket({ form: "save" }, true)).toBe("attack");
    expect(rollBucket({ form: "save" }, false)).toBe("action");
  });
});
