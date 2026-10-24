import { describe, expect, it } from "vitest";
import { BadgesView } from "lib/views/BadgesView";
import { renderBlock } from "./render-block";
import { screenshotHtml } from "./screenshot";

describe("badges block (rendered)", () => {
  it("renders each badge label", async () => {
    const { el, html } = await renderBlock(
      BadgesView,
      "items:\n  - label: Class\n    value: Fighter\n  - label: Level\n    value: 3\n"
    );
    expect(html).toContain("Fighter");
    expect(el.textContent).toContain("Level");
  });

  it.runIf(process.env.RENDER_SCREENSHOTS)(
    "writes a screenshot",
    async () => {
      const { html } = await renderBlock(BadgesView, "items:\n  - label: Class\n    value: Fighter\n");
      const png = await screenshotHtml(html, "tmp/render-tests/badges.png");
      expect(png).toContain("badges.png");
    },
    30000
  );
});
