import { describe, expect, it } from "vitest";
import { exportSettings, exportSettingsEnv } from "lib/plugin/settings-export";

describe("exportSettings", () => {
  it("copies the settings as JSON and blanks keys and tokens", () => {
    const json = exportSettings({ hexPacksFolder: "Packs", geminiKey: "g-123", anthropicKey: "a-456", apiToken: "t" });
    expect(JSON.parse(json)).toEqual({ hexPacksFolder: "Packs", geminiKey: "", anthropicKey: "", apiToken: "" });
  });

  it("writes one env line that decodes back to the settings, # and quotes included", () => {
    const line = exportSettingsEnv({ folder: "Scholar's Pack ü", color: "#fff", geminiKey: "g" });
    expect(line.startsWith("PLUGIN_SETTINGS_B64=")).toBe(true);
    expect(line).not.toContain("\n");
    const json = Buffer.from(line.slice("PLUGIN_SETTINGS_B64=".length), "base64").toString("utf8");
    expect(JSON.parse(json)).toEqual({ folder: "Scholar's Pack ü", color: "#fff", geminiKey: "" });
  });
});
