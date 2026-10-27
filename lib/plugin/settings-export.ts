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
