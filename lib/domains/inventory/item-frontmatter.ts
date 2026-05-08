/**
 * Extract inventory-relevant data from a compendium item note's frontmatter.
 *
 * Item notes in the Tales of the Valiant vault use top-level flat keys
 * (`type`, `weight`, `cost`, `damage`, `properties`, `reference_img`, …).
 * The `.item:` / `.weapon:` / `.shop:` lines are empty-valued YAML separators,
 * so every field is a sibling at the root of the frontmatter object.
 */

export interface ItemMetadata {
  /** Raw `.item.type` string, e.g. `"[[Martial]] [[Melee]] Weapons"`. */
  type?: string;
  /** Weight in pounds, parsed from strings like `"3 lb."`. */
  weight: number;
  /** Cost as raw string, e.g. `"15 gp"`. */
  cost?: string;
  /** Weapon damage expression, e.g. `"1d8/1d10 slashing"`. */
  damage?: string;
  /** Weapon / armor properties (wikilink-wrapped tokens). */
  properties?: string[];
  /** Armor class formula, e.g. `"11 + DEX"` or `"+2"`. */
  acFormula?: string;
  /** Short descriptor displayed in the meta column, when frontmatter supplies one. */
  subtitle?: string;
  /** Container capacity in pounds. */
  containerCapacity?: number;
  /** Image reference (Obsidian `![[file.webp|size]]` embed). */
  image?: string;
}

/**
 * Parse pounds from loose weight strings. Accepts `"3 lb."`, `"0.5lb"`, `3`, `"3"`.
 * Returns 0 when no number is parseable.
 */
export function parseWeight(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw !== "string") return 0;
  const match = raw.match(/-?\d+(?:\.\d+)?/);
  if (!match) return 0;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : 0;
}

function asString(raw: unknown): string | undefined {
  return typeof raw === "string" && raw.length > 0 ? raw : undefined;
}

function asStringArray(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out = raw.filter((v): v is string => typeof v === "string" && v.length > 0);
  return out.length > 0 ? out : undefined;
}

/**
 * Derive an ItemMetadata from a resolved item record. Accepts both the
 * legacy flat-frontmatter shape (pre-fence migration — `damage`,
 * `properties`, `ac`, `container_capacity`, `reference_img` at the top
 * level) and the new `rpg item.element` fence shape (`weapon.*`,
 * `armor.*`, `container.*`, `image`). First-match-wins per field so
 * partially-migrated vaults keep rendering sensibly.
 */
export function parseItemMetadata(
  frontmatter: Record<string, unknown> | undefined | null,
): ItemMetadata {
  const fm = frontmatter ?? {};
  const weapon = (fm.weapon && typeof fm.weapon === "object" ? fm.weapon : {}) as Record<string, unknown>;
  const armor = (fm.armor && typeof fm.armor === "object" ? fm.armor : {}) as Record<string, unknown>;
  const container = (fm.container && typeof fm.container === "object" ? fm.container : {}) as Record<string, unknown>;

  return {
    type: asString(fm.type),
    weight: parseWeight(fm.weight),
    cost: asString(fm.cost),
    damage: asString(weapon.damage) ?? asString(fm.damage),
    properties: asStringArray(weapon.properties) ?? asStringArray(fm.properties),
    acFormula: asString(armor.ac) ?? asString(fm.ac),
    subtitle: asString(armor.category) ?? asString(fm.subtitle),
    containerCapacity:
      typeof container.weight_cap === "string"
        ? parseWeight(container.weight_cap)
        : typeof fm.container_capacity === "number"
          ? fm.container_capacity
          : undefined,
    image: asString(fm.image) ?? asString(fm.reference_img),
  };
}

/**
 * Classify whether a resolved type indicates a weapon, armor/shield, or neither.
 * Used by routing to place unqualified items in their canonical section.
 */
export function itemTypeBucket(type: string | undefined): "weapon" | "armor" | "tool" | null {
  if (!type) return null;
  const t = type.toLowerCase();
  if (/weapons?\b/.test(t)) return "weapon";
  if (/\barmor\b|\bshields?\b/.test(t)) return "armor";
  if (/\btools?\b|\bkits?\b|\binstruments?\b/.test(t)) return "tool";
  return null;
}

/**
 * Finer-grained equip classification: distinguishes shields from body
 * armor so the equip toggle can route them to the correct slot
 * (`shield` vs. `armor`). Returns null for non-equippable items.
 */
export function itemEquipKind(
  type: string | undefined,
): "weapon" | "armor" | "shield" | null {
  if (!type) return null;
  const t = type.toLowerCase();
  if (/\bshields?\b/.test(t)) return "shield";
  if (/weapons?\b/.test(t)) return "weapon";
  if (/\barmor\b/.test(t)) return "armor";
  return null;
}
