import { describe, expect, it } from "vitest";
import { applyRewording, passagesOf, readRewording, refusal, rewordPrompt, splitTail } from "./reword";

const BODY = [
  "? Does the scene happen?",
  "gen: Testing the Expected Scene",
  "  Alterations: d10=8 vs CF -> Expected Scene",
  "=> S01 After the Landslide",
  "",
  "We met [[Kowyn]] by the wreck.",
  "N(Kobold): Mercy! Please.",
  '@(Talon) @[[Talon Pallton|Talon]].action("Longbow") → Kobold',
  "d: Attack | d20+6=14 vs AC ->",
  "=> Talon's arrow struck the tinkerer. [F:Kobold|+marked] [Inv:Talon/Quiver/[[Arrows]]-1]",
  "=> We took a single [[Healing Draft]]",
  "[/COMBAT]",
  "! A horn sounds.",
].join("\n");

describe("a log's prose", () => {
  it("is told apart from its machinery, with the tags after it", () => {
    expect(splitTail("We took a [[Healing Draft]]")).toEqual({ words: "We took a [[Healing Draft]]", tail: "" });
    expect(splitTail("Struck. [F:Kobold|+marked] [Inv:Talon/Quiver/[[Arrows]]-1]")).toEqual({
      words: "Struck.",
      tail: " [F:Kobold|+marked] [Inv:Talon/Quiver/[[Arrows]]-1]",
    });
    const found = passagesOf(BODY);
    expect(found.map((p) => [p.kind, p.text])).toEqual([
      ["narration", "We met [[Kowyn]] by the wreck."],
      ["dialogue", "Mercy! Please."],
      ["outcome", "Talon's arrow struck the tinkerer."],
      ["outcome", "We took a single [[Healing Draft]]"],
      ["event", "A horn sounds."],
    ]);
    expect(found[1]).toMatchObject({ lead: "N(Kobold): ", speaker: "Kobold", scene: "S01 After the Landslide" });
    expect(found[2].tail).toBe(" [F:Kobold|+marked] [Inv:Talon/Quiver/[[Arrows]]-1]");
  });

  it("is put back with everything around it untouched", () => {
    const [meet, , arrow] = passagesOf(BODY);
    const out = applyRewording(BODY, [
      { passage: meet, text: "By the wreck we found [[Kowyn]]." },
      { passage: arrow, text: "Talon's arrow took the tinkerer in the chest." },
    ]);
    expect(out.applied).toBe(2);
    const lines = out.body.split("\n");
    expect(lines[5]).toBe("By the wreck we found [[Kowyn]].");
    expect(lines[9]).toBe(
      "=> Talon's arrow took the tinkerer in the chest. [F:Kobold|+marked] [Inv:Talon/Quiver/[[Arrows]]-1]"
    );
    expect(lines.filter((_, i) => i !== 5 && i !== 9)).toEqual(BODY.split("\n").filter((_, i) => i !== 5 && i !== 9));
    // A line changed since it was read is left alone.
    expect(applyRewording(BODY.replace("We met", "We saw"), [{ passage: meet, text: "x [[Kowyn]]" }]).applied).toBe(0);
  });

  it("refuses a rewording that drops a link, adds a tag, or starts like a log line", () => {
    const [meet] = passagesOf(BODY);
    expect(refusal(meet, "By the wreck we found [[Kowyn]].")).toBeNull();
    expect(refusal(meet, "By the wreck we found Kowyn.")).toBe("its links changed");
    expect(refusal(meet, "We found [[Kowyn]]. [Talon/XP+500]")).toBe("it holds a tag");
    expect(refusal(meet, "=> We found [[Kowyn]].")).toBe("it starts like a log line");
    expect(refusal(meet, "")).toBe("empty");
  });

  it("asks with the mechanics a passage tells, and reads the answer", () => {
    const chosen = passagesOf(BODY).slice(1, 3);
    const prompt = rewordPrompt(BODY, chosen, "more tense");
    expect(prompt).toContain("What the writer asks for, above all: more tense");
    expect(prompt).toContain("Spoken by: Kobold");
    expect(prompt).toContain("d: Attack | d20+6=14 vs AC ->");
    expect(prompt).toContain("> We met [[Kowyn]] by the wreck.");
    const read = readRewording('Here: [{"id":1,"text":"Mercy, please!"},{"id":2,"text":"An arrow. [XP+9]"}]', chosen);
    expect(read[0]).toMatchObject({ text: "Mercy, please!" });
    expect(read[1]).toMatchObject({ text: "Talon's arrow struck the tinkerer.", refused: "it holds a tag" });
    expect(() => readRewording("no list", chosen)).toThrow();
  });
});
