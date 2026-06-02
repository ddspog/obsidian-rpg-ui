/**
 * Map a `rpg stat.monster` fence body into structured {@link StatMonsterData}.
 *
 * Like `stat.vehicle`, the statblock data lives in the fence YAML: nested
 * `stats:` / `abilities:` objects plus top-level `name` / `type` / `cr` /
 * `habitat` / `features`. A flat-key fallback is kept so a note authored the
 * legacy (flat frontmatter) way still resolves.
 */

import type { AbilityScores, StatFeatureRef, StatGroupData, StatMonsterData } from "./types";

/** YAML parses bare `[[Name]]` as `[["Name"]]`; collapse it back to text. */
function stringifyValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    if (value.length === 1 && Array.isArray(value[0]) && value[0].length === 1 && typeof value[0][0] === "string") {
      return `[[${value[0][0]}]]`;
    }
    return value.map(stringifyValue).filter(Boolean).join(", ");
  }
  return String(value);
}

/** `__` is the vault's "fill in later" placeholder — treat as empty. */
function isBlank(s: string): boolean {
  const t = s.trim();
  return t === "" || t === "__" || t === "_";
}

function parseMod(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = parseInt(value, 10);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

/** `#CR-1` / `CR 1` / `1` → `1`. Returns undefined when blank. */
function crDisplay(value: unknown): string | undefined {
  const s = stringifyValue(value);
  if (isBlank(s)) return undefined;
  const cleaned = s.replace(/^#?\s*cr[\s-]*/i, "").trim();
  return cleaned || undefined;
}

function normalizeFeatures(raw: unknown): StatFeatureRef[] {
  if (!Array.isArray(raw)) return [];
  const out: StatFeatureRef[] = [];
  for (const entry of raw) {
    if (typeof entry === "string") {
      if (!isBlank(entry)) out.push({ ref: entry.trim() });
    } else if (entry && typeof entry === "object" && "ref" in (entry as Record<string, unknown>)) {
      out.push(entry as StatFeatureRef);
    } else if (Array.isArray(entry) && entry.length === 1 && Array.isArray(entry[0]) && typeof entry[0][0] === "string") {
      out.push({ ref: `[[${entry[0][0]}]]` });
    }
  }
  return out;
}

function normalizeAbilities(self: Record<string, unknown>): AbilityScores {
  const keys = ["str", "dex", "con", "int", "wis", "cha"] as const;
  const out = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
  for (const k of keys) {
    // Prefer the `*_mod` form creature notes use; fall back to a bare score key.
    const v = self[`${k}_mod`] ?? self[k];
    out[k] = parseMod(v);
  }
  return out;
}

/** Stat rows in display order. Keys map to labels in `StatblockMonster`. */
const STAT_FIELDS = [
  "ac",
  "hp",
  "speed",
  "immune",
  "pas_perception",
  "pas_stealth",
  "vulnerable",
  "resistant",
  "senses",
  "languages",
] as const;

export function mapMonster(self: Record<string, unknown>): StatMonsterData {
  // Statblock data lives in the fence body (like `stat.vehicle`): nested
  // `stats:` / `abilities:` objects plus top-level type/cr/habitat/features.
  // Fall back to flat top-level keys so a creature note authored the legacy
  // (flat) way still resolves.
  const statsSrc =
    self.stats && typeof self.stats === "object" && !Array.isArray(self.stats)
      ? (self.stats as Record<string, unknown>)
      : self;
  const abilSrc =
    self.abilities && typeof self.abilities === "object" && !Array.isArray(self.abilities)
      ? (self.abilities as Record<string, unknown>)
      : self;

  const stats: Record<string, string> = {};
  for (const key of STAT_FIELDS) {
    const s = stringifyValue(statsSrc[key]);
    if (!isBlank(s)) stats[key] = s;
  }

  const habitat = stringifyValue(self.habitat);
  const treasure = stringifyValue(self.treasure);
  const group = stringifyValue(self.group);

  return {
    name: typeof self.name === "string" ? self.name : "",
    type: stringifyValue(self.type),
    cr: crDisplay(self.cr),
    habitat: isBlank(habitat) ? undefined : habitat,
    treasure: isBlank(treasure) ? undefined : treasure,
    group: isBlank(group) ? undefined : group,
    stats,
    abilities: normalizeAbilities(abilSrc),
    features: normalizeFeatures(self.features),
    text: typeof self.text === "string" && self.text.trim() ? self.text : undefined,
    image: typeof self.image === "string" && self.image.trim() ? self.image : undefined,
  };
}

/** Map a `rpg stat.group` fence body into structured {@link StatGroupData}. */
export function mapGroup(self: Record<string, unknown>): StatGroupData {
  const subtitle = stringifyValue(self.subtitle);
  const habitat = stringifyValue(self.habitat);
  const treasure = stringifyValue(self.treasure);
  return {
    name: typeof self.name === "string" ? self.name : "",
    subtitle: isBlank(subtitle) ? undefined : subtitle,
    habitat: isBlank(habitat) ? undefined : habitat,
    treasure: isBlank(treasure) ? undefined : treasure,
    text: typeof self.text === "string" && self.text.trim() ? self.text : undefined,
  };
}
