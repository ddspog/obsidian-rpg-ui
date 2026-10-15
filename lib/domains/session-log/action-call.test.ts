import { describe, it, expect } from "vitest";
import { actionCall, findActionCalls, leadingActionCall } from "./action-call";

describe("action calls", () => {
  it("writes an action on its actor's page, labelled as the log knows the actor", () => {
    expect(actionCall("Kobold, Elite", "Mining Pick")).toBe('@[[Kobold, Elite]].action("Mining Pick")');
    expect(actionCall("Talon Pallton", "Dash", "Talon")).toBe('@[[Talon Pallton|Talon]].action("Dash")');
    expect(actionCall("Kobold, Elite", 'The "Big" One')).toBe(`@[[Kobold, Elite]].action('The "Big" One')`);
  });

  it("reads them back — names with parentheses too", () => {
    const [call] = findActionCalls('@[[Kobold, Elite]].action("Lantern Splash (Recharge 5-6)") → Lilith');
    expect(call).toMatchObject({
      page: "Kobold, Elite",
      label: "Kobold, Elite",
      name: "Lantern Splash (Recharge 5-6)",
      start: 0,
    });
    expect(findActionCalls("@[[Talon Pallton|Talon]].action(Dash)")[0]).toMatchObject({
      page: "Talon Pallton",
      label: "Talon",
      name: "Dash",
    });
  });

  it("knows a line that opens with one", () => {
    expect(leadingActionCall('  @[[Kobold, Elite]].action("Sling") → Talon')?.name).toBe("Sling");
    expect(leadingActionCall('Swings @[[Kobold, Elite]].action("Sling")')).toBeUndefined();
  });
});
