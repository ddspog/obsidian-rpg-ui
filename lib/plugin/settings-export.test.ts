import { describe, expect, it } from "vitest";
import { exportSettings, exportSettingsEnv, importSettings } from "lib/plugin/settings-export";

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

describe("importSettings", () => {
  const here = { hexPacksFolder: "Old", geminiKey: "mine", marginPrompts: [] as unknown[] };
  const there = { hexPacksFolder: "Packs ü", geminiKey: "theirs", marginPrompts: [{ folder: "f", wordsFile: "w.md" }] };

  it("reads the line Copy writes, and keeps this device's API keys", () => {
    const out = importSettings(exportSettingsEnv(there), here);
    expect(out).toEqual({ hexPacksFolder: "Packs ü", geminiKey: "mine", marginPrompts: there.marginPrompts });
  });

  it("reads the base64 alone, or the JSON", () => {
    const line = exportSettingsEnv(there);
    expect(importSettings(line.slice("PLUGIN_SETTINGS_B64=".length), here).hexPacksFolder).toBe("Packs ü");
    expect(importSettings(exportSettings(there), here).marginPrompts).toEqual(there.marginPrompts);
  });

  it("keeps settings the copy doesn't name", () => {
    expect(importSettings('{"hexPacksFolder":"New"}', here)).toEqual({ ...here, hexPacksFolder: "New" });
  });

  it("refuses text that isn't settings", () => {
    expect(() => importSettings("hello there", here)).toThrow();
    expect(() => importSettings("[1,2]", here)).toThrow();
  });
});
