import { describe, expect, it } from "vitest";
import { checksHint, checksOf, fitSkill, roleRule, TRAVEL_ROLE_RULES } from "./travel-roles";

describe("travel roles (Uncharted Journeys)", () => {
  it("offers each role only the skills the rules give it, the default first", () => {
    expect(checksOf("Leader")).toEqual(["Persuasion", "Insight", "Performance"]);
    expect(checksOf("Outrider")).toEqual(["Survival", "Nature"]);
    expect(checksOf("Quartermaster")).toEqual(["Athletics"]);
    expect(checksOf("Sentry")).toEqual(["Perception", "Stealth"]);
  });

  it("finds a role however it is typed, and none the rules don't name", () => {
    expect(roleRule("  sentry ")?.role).toBe("Sentry");
    expect(checksOf("Cook")).toBeUndefined();
  });

  it("keeps an allowed skill, and puts anything else back to the role's first", () => {
    expect(fitSkill("Outrider", "Nature")).toBe("Nature");
    // Survival was the old Quartermaster default; the rules say Athletics.
    expect(fitSkill("Quartermaster", "Survival")).toBe("Athletics");
    // A stored or renamed pick that no longer fits.
    expect(fitSkill("Sentry", "Persuasion")).toBe("Perception");
    // A role the rules don't name takes any skill.
    expect(fitSkill("Cook", "Arcana")).toBe("Arcana");
  });

  it("says the other checks and the Role Ability under the row", () => {
    expect(checksHint(roleRule("Leader")!)).toBe(
      "Checks: Persuasion, Insight or Performance, or a Musical Instrument. Ability: Inspirational Resolve."
    );
    expect(checksHint(roleRule("Quartermaster")!)).toBe(
      "Checks: Athletics, or Blacksmith's Tools, Leatherworker's Tools, Cook's Utensils or Brewer's Supplies. Ability: Well Prepared."
    );
    expect(TRAVEL_ROLE_RULES.map((r) => r.ability)).toEqual([
      "Inspirational Resolve",
      "Find the Path",
      "Well Prepared",
      "Ever Vigilant",
    ]);
  });
});
