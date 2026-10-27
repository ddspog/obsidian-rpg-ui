/** Settings that must never leave the vault in a copy. */
const SECRET_KEYS = ["anthropicKey", "geminiKey"];

/** The plugin's settings as JSON to copy, with keys and tokens blanked. */
export function exportSettings(settings: object): string {
  const out: Record<string, unknown> = { ...settings };
  for (const key of Object.keys(out)) {
    if (SECRET_KEYS.includes(key) || /(?:api|secret|token|password)/i.test(key)) out[key] = "";
  }
  return JSON.stringify(out, null, 2);
}

/**
 * The settings as one `PLUGIN_SETTINGS_B64=…` line for an environment's variables
 * (base64, so `#`, quotes and spaces survive any `.env` parser). The cloud Obsidian
 * (`scripts/cloud-obsidian.mjs`) lays it over the copied vault's plugin settings.
 */
export function exportSettingsEnv(settings: object): string {
  const bytes = new TextEncoder().encode(JSON.stringify(JSON.parse(exportSettings(settings))));
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return `PLUGIN_SETTINGS_B64=${btoa(binary)}`;
}
