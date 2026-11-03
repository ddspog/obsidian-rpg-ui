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

/**
 * Settings pasted from another device: the `PLUGIN_SETTINGS_B64=…` line Copy writes, the base64 alone,
 * or the JSON. Laid over `current`: a key the copy blanked (an API key) keeps this device's value.
 * Throws when the text is none of those.
 */
export function importSettings<T extends object>(text: string, current: T): T {
  const raw = text.trim().replace(/^PLUGIN_SETTINGS_B64=/, "");
  let parsed: unknown;
  if (raw.startsWith("{")) {
    parsed = JSON.parse(raw);
  } else {
    const binary = atob(raw.replace(/\s+/g, ""));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Not plugin settings");
  const out: Record<string, unknown> = { ...(current as Record<string, unknown>) };
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    const secret = SECRET_KEYS.includes(key) || /(?:api|secret|token|password)/i.test(key);
    if (secret && value === "") continue;
    out[key] = value;
  }
  return out as T;
}
