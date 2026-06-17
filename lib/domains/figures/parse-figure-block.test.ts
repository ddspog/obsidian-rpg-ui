import { describe, expect, it } from "vitest";
import { parseFigureBlock } from "./parse-figure-block";

describe("parseFigureBlock", () => {
  it("parses a config head + mermaid body split on `---`", () => {
    const src = [
      "align: left",
      "width: 50%",
      "caption: First Scene — 4W Strategy",
      "---",
      "flowchart TD",
      "  A --> B",
    ].join("\n");
    const block = parseFigureBlock(src);
    expect(block).toEqual({
      engine: "mermaid",
      align: "left",
      width: "50%",
      caption: "First Scene — 4W Strategy",
      source: "flowchart TD\n  A --> B",
    });
  });

  it("treats the whole body as the diagram when there is no `---`", () => {
    const src = "flowchart TD\n  A --> B";
    const block = parseFigureBlock(src);
    expect(block.align).toBe("right");
    expect(block.width).toBeUndefined();
    expect(block.caption).toBeUndefined();
    expect(block.source).toBe("flowchart TD\n  A --> B");
  });

  it("defaults align to right and ignores unknown values", () => {
    expect(parseFigureBlock("align: sideways\n---\ngraph LR").align).toBe("right");
    expect(parseFigureBlock("---\ngraph LR").align).toBe("right");
  });

  it("accepts the four alignments and the British `centre` spelling", () => {
    expect(parseFigureBlock("align: left\n---\ngraph LR").align).toBe("left");
    expect(parseFigureBlock("align: Right\n---\ngraph LR").align).toBe("right");
    expect(parseFigureBlock("align: center\n---\ngraph LR").align).toBe("center");
    expect(parseFigureBlock("align: centre\n---\ngraph LR").align).toBe("center");
    expect(parseFigureBlock("align: full\n---\ngraph LR").align).toBe("full");
  });

  it("reads a bare-number width as a percentage and passes CSS lengths through", () => {
    expect(parseFigureBlock("width: 40\n---\ngraph LR").width).toBe("40%");
    expect(parseFigureBlock("width: 40%\n---\ngraph LR").width).toBe("40%");
    expect(parseFigureBlock("width: 320px\n---\ngraph LR").width).toBe("320px");
    expect(parseFigureBlock("width: 20rem\n---\ngraph LR").width).toBe("20rem");
    expect(parseFigureBlock("width:   \n---\ngraph LR").width).toBeUndefined();
  });

  it("strips matching surrounding quotes from values", () => {
    expect(parseFigureBlock('caption: "Quoted caption"\n---\ngraph LR').caption).toBe("Quoted caption");
    expect(parseFigureBlock("caption: 'Single quoted'\n---\ngraph LR").caption).toBe("Single quoted");
  });

  it("treats an empty caption as absent", () => {
    expect(parseFigureBlock("caption:   \n---\ngraph LR").caption).toBeUndefined();
  });

  it("trims surrounding blank lines from the diagram source", () => {
    const block = parseFigureBlock("align: right\n---\n\n\nflowchart TD\n  A --> B\n\n");
    expect(block.source).toBe("flowchart TD\n  A --> B");
  });
});
