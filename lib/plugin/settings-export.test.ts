import { describe, expect, it } from "vitest";
import { exportSettings } from "lib/plugin/settings-export";

describe("exportSettings", () => {
  it("copies the settings as JSON and blanks keys and tokens", () => {
    const json = exportSettings({ hexPacksFolder: "Packs", geminiKey: "g-123", anthropicKey: "a-456", apiToken: "t" });
    expect(JSON.parse(json)).toEqual({ hexPacksFolder: "Packs", geminiKey: "", anthropicKey: "", apiToken: "" });
  });
});
