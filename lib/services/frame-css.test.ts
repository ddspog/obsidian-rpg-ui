import { describe, expect, it, vi } from "vitest";
import { DEFAULT_FRAME_CSS, frameStylesheet, scopeFrameCss } from "./frame-css";

vi.mock("obsidian", () => ({ requestUrl: vi.fn() }));

describe("scopeFrameCss", () => {
  it("rewrites the frame's selectors to the kind's frame", () => {
    const out = scopeFrameCss(".frame { padding: 1rem }\n.frame .inner, .frame .plaque::after { color: red; }", "spell");
    expect(out).toBe(
      "figure.rpg-card-frame.is-gen-spell {\n  padding: 1rem;\n}\n\n" +
        "figure.rpg-card-frame.is-gen-spell .rpg-card-frame-inner,\n" +
        "figure.rpg-card-frame.is-gen-spell figcaption.rpg-card-frame-plaque::after {\n  color: red;\n}"
    );
  });
  it("drops selectors that aren't the frame's, and at-rules", () => {
    const out = scopeFrameCss(
      "@import url(x.css);\nbody { display: none }\n@media (x) { .frame { color: red } }\n.workspace, .frame .art { border-radius: 2px }",
      "item"
    );
    expect(out).toBe("figure.rpg-card-frame.is-gen-item .rpg-card-frame-art {\n  border-radius: 2px;\n}");
  });
  it("keeps inline SVG, drops outside URLs", () => {
    const svg = `background: url("data:image/svg+xml;utf8,<svg xmlns='x'></svg>")`;
    const out = scopeFrameCss(`.frame::before { ${svg}; border-image: url(https://evil/x.png) 30; color: gold }`, "banner");
    expect(out).toContain(svg);
    expect(out).not.toContain("evil");
    expect(out).toContain("color: gold;");
  });
  it("doesn't take a class that only starts like the frame's", () => {
    expect(scopeFrameCss(".framework { color: red }", "spell")).toBe("");
  });
});

describe("the layout", () => {
  it("drops what moves the plaque or sizes the frame, keeps the look", () => {
    const out = scopeFrameCss(
      ".frame { position: relative; width: 10rem; padding: 0.2rem }\n" +
        ".frame .plaque { left: 8%; right: 8%; transform: none; bottom: 0.3rem; color: gold }\n" +
        ".frame .inner { position: relative }\n.frame .art { position: absolute; border-radius: 2px }",
      "portrait"
    );
    expect(out).not.toMatch(/width: 10rem|left: 8%|right: 8%|transform: none|position: absolute/);
    expect(out).toMatch(/padding: 0.2rem/);
    expect(out).toMatch(/bottom: 0.3rem;\n  color: gold/);
    expect(out).toMatch(/rpg-card-frame-inner {\n  position: relative;/);
    expect(out).not.toMatch(/is-gen-portrait {\n  position/);
  });
  it("leaves ornaments free to be placed", () => {
    const out = scopeFrameCss(".frame::before, .frame .plaque::after { position: absolute; left: 0; transform: scale(-1) }", "spell");
    expect(out).toContain("position: absolute;\n  left: 0;\n  transform: scale(-1);");
  });
});

describe("the plain frame", () => {
  it("carries no weight, and leaves the generated frame alone", () => {
    expect(scopeFrameCss(".frame .inner { padding: 0 }", "portrait", "plain")).toBe(
      ":where(figure.rpg-card-frame.is-portrait:not(.is-gen-portrait)) .rpg-card-frame-inner {\n  padding: 0;\n}"
    );
  });
  it("keeps every part of the default", () => {
    const out = scopeFrameCss(DEFAULT_FRAME_CSS, "spell", "plain");
    for (const part of ["is-spell", ".rpg-card-frame-inner", ".rpg-card-frame-art", "figcaption.rpg-card-frame-plaque"])
      expect(out).toContain(part);
    expect(out).toContain("--frame-gold-light: #f6dd92;");
  });
});

describe("frameStylesheet", () => {
  it("has every kind's plain look, its own edit or the default, and the generated CSS there is", () => {
    const out = frameStylesheet({ spell: { css: ".frame { color: red }" }, item: { plainCss: ".frame { color: blue }" } });
    expect(out).toContain("figure.rpg-card-frame.is-gen-spell {\n  color: red;\n}");
    expect(out).toContain(":where(figure.rpg-card-frame.is-item:not(.is-gen-item)) {\n  color: blue;\n}");
    expect(out).not.toContain("is-gen-item {");
    expect(out).toContain("is-banner:not(.is-gen-banner)) .rpg-card-frame-inner");
  });
});
