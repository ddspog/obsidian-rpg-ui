import { describe, it, expect } from "vitest";
import { groupIntoProse, summarizeRoll } from "./prose-grouper";
import type { LonelogEntry } from "lib/domains/lonelog/types";

describe("groupIntoProse", () => {
  it("groups an action with its trailing rolls and consequences", () => {
    const entries: LonelogEntry[] = [
      { type: "action", text: "Elara attacks" },
      { type: "roll", roll: "d20+7=19", result: "Hit", success: true },
      { type: "roll", roll: "1d8+4=9", result: "9 slashing", success: undefined },
      { type: "consequence", text: "Goblin falls.", tags: [] },
    ];
    const segments = groupIntoProse(entries);
    expect(segments).toHaveLength(1);
    expect(segments[0].type).toBe("action-group");
    if (segments[0].type === "action-group") {
      expect(segments[0].action.text).toBe("Elara attacks");
      expect(segments[0].rolls).toHaveLength(2);
      expect(segments[0].consequences).toHaveLength(1);
    }
  });

  it("stops grouping when a new action starts", () => {
    const entries: LonelogEntry[] = [
      { type: "action", text: "Elara attacks" },
      { type: "roll", roll: "d20+7=19", result: "Hit", success: true },
      { type: "action", text: "Goblin retaliates" },
      { type: "roll", roll: "d20+4=12", result: "Miss", success: false },
    ];
    const segments = groupIntoProse(entries);
    expect(segments).toHaveLength(2);
    expect(segments[0].type).toBe("action-group");
    expect(segments[1].type).toBe("action-group");
  });

  it("groups oracle question with answer and consequence", () => {
    const entries: LonelogEntry[] = [
      { type: "oracle_question", text: "Is the door locked?" },
      { type: "oracle_answer", text: "Yes, but...", roll: "d6=3" },
      { type: "consequence", text: "The lock is rusted.", tags: [] },
    ];
    const segments = groupIntoProse(entries);
    expect(segments).toHaveLength(1);
    expect(segments[0].type).toBe("oracle");
    if (segments[0].type === "oracle") {
      expect(segments[0].question.text).toBe("Is the door locked?");
      expect(segments[0].answer?.text).toBe("Yes, but...");
      expect(segments[0].consequences[0]?.text).toBe("The lock is rusted.");
    }
  });

  it("absorbs a generator + its working line + the resulting consequence into one oracle block", () => {
    const entries: LonelogEntry[] = [
      { type: "oracle_question", text: "Does the scene occur?", chaosFactor: 5 },
      { type: "generator", source: "Testing", result: "the Expected Scene" },
      { type: "continuation", text: "Alterations: d10=8 vs CF 5 -> Expected Scene" },
      { type: "consequence", text: "S01 After the Landslide", tags: [], conclusion: "S01 After the Landslide" },
    ];
    const segments = groupIntoProse(entries);
    expect(segments).toHaveLength(1);
    expect(segments[0].type).toBe("oracle");
    if (segments[0].type === "oracle") {
      expect(segments[0].generators).toHaveLength(1);
      expect(segments[0].consequences[0]?.text).toBe("S01 After the Landslide");
      expect(segments[0].continuations).toContain("Alterations: d10=8 vs CF 5 -> Expected Scene");
    }
  });

  it("handles oracle question without answer", () => {
    const entries: LonelogEntry[] = [
      { type: "oracle_question", text: "Is it raining?" },
      { type: "action", text: "Elara moves" },
    ];
    const segments = groupIntoProse(entries);
    expect(segments).toHaveLength(2);
    expect(segments[0].type).toBe("oracle");
    if (segments[0].type === "oracle") {
      expect(segments[0].answer).toBeUndefined();
    }
  });

  it("handles scene entries standalone", () => {
    const entries: LonelogEntry[] = [
      { type: "scene", number: "S1", context: "Dark forest" },
      { type: "action", text: "Elara scouts" },
    ];
    const segments = groupIntoProse(entries);
    expect(segments).toHaveLength(2);
    expect(segments[0].type).toBe("scene");
  });

  it("treats standalone consequences and rolls individually", () => {
    const entries: LonelogEntry[] = [
      { type: "consequence", text: "Combat ends.", tags: [] },
      { type: "roll", roll: "d20=15", result: "15", success: undefined },
    ];
    const segments = groupIntoProse(entries);
    expect(segments).toHaveLength(2);
    expect(segments[0].type).toBe("standalone-consequence");
    expect(segments[1].type).toBe("standalone-roll");
  });

  it("handles narrative, dialogue, and meta entries", () => {
    const entries: LonelogEntry[] = [
      { type: "narrative", text: "The sun sets." },
      { type: "dialogue", speaker: "Kowyn", speakerType: "pc", text: "Let's go." },
      { type: "meta_note", text: "End of session." },
    ];
    const segments = groupIntoProse(entries);
    expect(segments).toHaveLength(3);
    expect(segments[0].type).toBe("narrative");
    expect(segments[1].type).toBe("dialogue");
    expect(segments[2].type).toBe("meta");
  });

  it("handles empty entry list", () => {
    expect(groupIntoProse([])).toHaveLength(0);
  });

  it("action with no trailing rolls produces group with empty rolls", () => {
    const entries: LonelogEntry[] = [{ type: "action", text: "Elara hides" }];
    const segments = groupIntoProse(entries);
    expect(segments).toHaveLength(1);
    if (segments[0].type === "action-group") {
      expect(segments[0].rolls).toHaveLength(0);
      expect(segments[0].consequences).toHaveLength(0);
    }
  });
});

describe("summarizeRoll", () => {
  it("extracts label from roll expression", () => {
    const result = summarizeRoll({ type: "roll", roll: "Stealth d20+7=18 vs DC 14", result: "Success", success: true });
    expect(result.label).toBe("Stealth");
    expect(result.success).toBe(true);
  });

  it("handles roll without leading label", () => {
    const result = summarizeRoll({ type: "roll", roll: "d20+5=17", result: "Hit", success: true });
    expect(result.label).toBeTruthy();
  });

  it("passes through success state", () => {
    const fail = summarizeRoll({ type: "roll", roll: "d20+2=8", result: "Miss", success: false });
    expect(fail.success).toBe(false);

    const unknown = summarizeRoll({ type: "roll", roll: "1d6=4", result: "4", success: undefined });
    expect(unknown.success).toBeUndefined();
  });
});
