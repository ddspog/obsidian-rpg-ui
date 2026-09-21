import { describe, it, expect } from "vitest";
import { inlineContentFences, isProcessedFence } from "./import-fences";

describe("isProcessedFence", () => {
  it("keeps fences whose RENDERING is the point", () => {
    expect(isProcessedFence("table")).toBe(true);
    expect(isProcessedFence("table.random-event-focus-table")).toBe(true);
    expect(isProcessedFence("feature.gm")).toBe(true);
    expect(isProcessedFence("log")).toBe(true);
    expect(isProcessedFence("figure.mermaid")).toBe(true);
  });

  it("flattens prose-bearing fences to their body", () => {
    expect(isProcessedFence("rule.content")).toBe(false);
    expect(isProcessedFence("rule.side")).toBe(false);
    // `feature.details` is NOT the gm block — don't over-match on the prefix.
    expect(isProcessedFence("feature.details")).toBe(false);
    expect(isProcessedFence("feature.choice")).toBe(false);
  });
});

describe("inlineContentFences", () => {
  it("unwraps a rule.content fence to the body after the `---`", () => {
    const src = ["```rpg rule.content", "id: summary", "---", "The prose body.", "```"].join("\n");
    expect(inlineContentFences(src).trim()).toBe("The prose body.");
  });

  it("PRESERVES a feature.gm fence so its log stays interactive when imported", () => {
    // Regression: a whole-file / heading-slice import used to flatten the gm
    // fence, printing `? …` and `gen: …` as literal prose in the host note.
    const fence = [
      "```rpg feature.gm",
      "id: random-event",
      "heading: none",
      "---",
      "Prose about the generator.",
      "",
      "? A Random Event fires — what is it?",
      "gen: Random Event",
      "```",
    ].join("\n");
    const out = inlineContentFences(`Intro.\n\n${fence}\n`);
    expect(out).toContain("```rpg feature.gm"); // fence intact, processor still runs
    expect(out).toContain("gen: Random Event");
  });

  it("preserves a table fence but unwraps prose around it", () => {
    const src = [
      "```rpg rule.content",
      "id: x",
      "---",
      "Lead-in.",
      "```",
      "```rpg table.focus",
      "|1d100|RESULT|",
      "```",
    ].join("\n");
    const out = inlineContentFences(src);
    expect(out).toContain("Lead-in.");
    expect(out).not.toContain("```rpg rule.content");
    expect(out).toContain("```rpg table.focus");
  });
});

describe("inlineContentFences — a flattened fence must not swallow the next one", () => {
  it("keeps a figure fence so a following feature.gm still opens as a fence", () => {
    // Regression: unwrapping `figure.mermaid` dumped its `flowchart TD …` body
    // as loose text; the very next fence's opening backticks were then absorbed
    // into that same markdown paragraph, so the gm block never became a code
    // block and its lonelog rendered as literal prose in the importing note.
    const src = [
      "## Generating Random Events",
      "```rpg figure.mermaid",
      "align: right",
      "---",
      "flowchart TD",
      "  A --> B",
      "```",
      "```rpg feature.gm",
      "id: random-event",
      "---",
      "? A Random Event fires — what is it?",
      "gen: Random Event",
      "```",
    ].join("\n");
    const out = inlineContentFences(src);
    expect(out).toContain("```rpg figure.mermaid");
    expect(out).toContain("```rpg feature.gm");
    // The mermaid body stays INSIDE its fence — the line before the gm fence
    // opens must be the figure's closing ``` , not loose diagram text.
    const lines = out.split("\n");
    expect(lines[lines.indexOf("```rpg feature.gm") - 1]).toBe("```");
  });
});
