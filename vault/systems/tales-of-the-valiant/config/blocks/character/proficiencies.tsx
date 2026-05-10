import * as React from "react";
import { EntityBlock, Pill } from "rpg-ui-toolkit";
import { ProficienciesProps } from "./proficiencies.types";
import { CharacterEntity } from "../../entities/character.types";
import type { FeaturesBlockData } from "./features.types";

type Category = {
  label: string;
  items: string[];
  linkItems?: boolean;
  inUse?: Set<string>;
};

/** Strip a wikilink wrapper / leading `+` so the displayed pill reads as a
 *  plain label while the underlying link target is still usable for click-
 *  through. Trait values from the resolver come in two shapes: bare names
 *  (`"Light Armor"`) or wikilinks with a `+` prefix from cleric-style trait
 *  declarations (`"+[[Light Armor]]"`). Both collapse to the bare name. */
function bareLabel(raw: unknown): string {
  // YAML parses `[[Light Armor]]` (unquoted) as a nested 1×1 array
  // `[["Light Armor"]]` — flatten before stripping. Anything else
  // non-stringish coerces via String() so we never throw.
  let s: string;
  if (typeof raw === "string") {
    s = raw;
  } else if (Array.isArray(raw)) {
    let v: unknown = raw;
    while (Array.isArray(v)) v = v[0];
    s = typeof v === "string" ? `[[${v}]]` : String(v ?? "");
  } else {
    s = String(raw ?? "");
  }
  return s
    .replace(/^\+/, "")
    .replace(/^\[\[/, "")
    .replace(/\]\]$/, "")
    .split("|")[0]
    .trim();
}

/** Pull a trait list, normalise each entry, and dedupe by display label
 *  (case-sensitive — "Common" and "common" are kept as separate entries on
 *  purpose). The categorical trait keys — `Weapons`, `Armor`, `Tools`,
 *  `Languages` — don't follow the `P./J./E.` taxonomy since "proficiency"
 *  here means "knows how to use" rather than "adds PB to a roll". */
function readTrait(traits: Record<string, string[]> | undefined, key: string): string[] {
  const raw = traits?.[key] ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of raw) {
    const label = bareLabel(v);
    if (!label || seen.has(label)) continue;
    seen.add(label);
    out.push(label);
  }
  return out;
}

function buildCategories(data: {
  armor: string[];
  weapons: string[];
  tools: string[];
  languages: string[];
  resistance: string[];
  immunity: string[];
  vulnerability: string[];
}, inUse: {
  armor: Set<string>;
  weapons: Set<string>;
  tools: Set<string>;
}): Category[] {
  const cats: Category[] = [];
  if (data.weapons.length) cats.push({ label: "Weapons", items: data.weapons, linkItems: true, inUse: inUse.weapons });
  if (data.armor.length) cats.push({ label: "Armor", items: data.armor, linkItems: true, inUse: inUse.armor });
  if (data.tools.length) cats.push({ label: "Tools", items: data.tools, linkItems: true, inUse: inUse.tools });
  if (data.languages.length) cats.push({ label: "Languages", items: data.languages, linkItems: true });
  if (data.resistance.length) cats.push({ label: "Resistance", items: data.resistance, linkItems: true });
  if (data.immunity.length) cats.push({ label: "Immunity", items: data.immunity, linkItems: true });
  if (data.vulnerability.length) cats.push({ label: "Vulnerability", items: data.vulnerability, linkItems: true });
  return cats;
}

/**
 * Derive which proficiencies the character is *actively using* from
 * their inventory. Drives the in-use dot next to the Weapons / Armor /
 * Tools pills so a player can see at a glance whether their kit is
 * legally supported by their training — e.g. a Simple Weapon pill
 * lights up when a Mace sits in main_hand; Heavy Armor does not unless
 * a Chain Mail is equipped.
 *
 * Matching is word-boundary / case-insensitive against the equipped
 * item's `type` string (for weapons) or its declared `armor.category`
 * (for armor / shield). Tool proficiencies match the item's bare
 * filename — a vault author names the tool proficiency the same as
 * the tool note itself (`Herbalist Tools`).
 */
function resolveInUseProficiencies(
  blocks: unknown,
  lookup: CharacterEntity["lookup"] | undefined,
  profs: { armor: string[]; weapons: string[]; tools: string[] },
): { armor: Set<string>; weapons: Set<string>; tools: Set<string> } {
  const out = {
    armor: new Set<string>(),
    weapons: new Set<string>(),
    tools: new Set<string>(),
  };
  const inv = (blocks as { inventory?: { items?: unknown[] } })?.inventory;
  const rawItems = Array.isArray(inv?.items) ? inv.items : [];
  const lib = lookup?.$items ?? {};

  const equippedWeaponTypes: string[] = [];
  const equippedWeaponNames: string[] = [];
  const equippedArmorCategories: string[] = [];
  let hasShield = false;
  const invToolNames = new Set<string>();

  for (const raw of rawItems) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as { name?: unknown; slot?: unknown };
    if (typeof o.name !== "string") continue;
    const name = wikiStem(o.name);
    const fm = lib[name];
    if (!fm) continue;
    const type = typeof fm.type === "string" ? fm.type.toLowerCase() : "";
    const armorBlock = fm.armor && typeof fm.armor === "object"
      ? (fm.armor as { category?: unknown })
      : undefined;
    const armorCat = typeof armorBlock?.category === "string"
      ? armorBlock.category.toLowerCase()
      : undefined;

    if (o.slot === "main_hand" || o.slot === "off_hand") {
      equippedWeaponTypes.push(type);
      equippedWeaponNames.push(name.toLowerCase());
    }
    if (o.slot === "armor" && armorCat) {
      equippedArmorCategories.push(armorCat);
    }
    // Shields feed AC by mere inventory presence — same rule powers the
    // "Shields" proficiency dot, so a cleric doesn't need to "equip" it.
    if (armorCat === "shield") hasShield = true;
    // Tools count as "in use" whenever they're carried, matching how
    // ritual / identification checks work in play.
    if (/\btools?\b|\bkits?\b|\binstruments?\b/.test(type)) {
      invToolNames.add(name.toLowerCase());
    }
  }

  // Weapon proficiencies can match either a category ("Simple",
  // "Martial") against the equipped weapon's `type` tokens OR a specific
  // weapon name ("Warhammer", "Northlands Estoc") against the equipped
  // weapon's own bare name — so class-granted blanket profs and
  // background-granted individual weapon profs both light up correctly.
  for (const prof of profs.weapons) {
    const lower = prof.toLowerCase();
    const typeMatch = new RegExp(`\\b${escapeRegex(lower)}\\b`);
    const matchesType = equippedWeaponTypes.some((t) => typeMatch.test(t));
    const matchesName = equippedWeaponNames.some((n) => n === lower);
    if (matchesType || matchesName) out.weapons.add(prof);
  }
  for (const prof of profs.armor) {
    const lower = prof.toLowerCase();
    if (lower === "shields") {
      if (hasShield) out.armor.add(prof);
      continue;
    }
    const re = new RegExp(`\\b${escapeRegex(lower.replace(/\s*armor$/, ""))}\\b`);
    if (equippedArmorCategories.some((c) => re.test(c))) out.armor.add(prof);
  }
  for (const prof of profs.tools) {
    if (invToolNames.has(prof.toLowerCase())) out.tools.add(prof);
  }
  return out;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function wikiStem(raw: string): string {
  const m = raw.match(/^\[\[(.+?)\]\]$/);
  const inner = m ? m[1] : raw;
  return inner.split("|")[0].split("/").pop()!.trim();
}

export const proficiencies: EntityBlock<ProficienciesProps, CharacterEntity> = ({
  self,
  blocks,
  lookup,
}) => {
  const header = (blocks as any).header;
  const features = (blocks as any).features as FeaturesBlockData | undefined;
  const inventory = (blocks as any).inventory;

  // Resolve the character's full feature view once; falls back to an empty
  // traits map when the helper is missing (e.g. a system that hasn't wired
  // it up). The auto-derived lists come from the standard trait keys; the
  // YAML's explicit values, if present, win as-is.
  const view = lookup.$features?.(header, features?.choices, features?.additional, inventory);
  const traits = view?.traits ?? {};

  const auto = {
    armor: readTrait(traits, "Armor"),
    weapons: readTrait(traits, "Weapons"),
    tools: readTrait(traits, "Tools"),
    languages: readTrait(traits, "Languages"),
    resistance: readTrait(traits, "Resistance"),
    immunity: readTrait(traits, "Immunity"),
    vulnerability: readTrait(traits, "Vulnerability"),
  };

  const additional = self.additional ?? {};

  // For each list: explicit YAML > auto-derived from traits, then append the
  // additional list. dedupe so author additions that already came from
  // traits collapse into a single chip.
  const merge = (yaml: string[] | undefined, fromTraits: string[], extra: string[] | undefined) => {
    const base = yaml && yaml.length > 0 ? yaml.map(bareLabel) : fromTraits;
    const seen = new Set(base);
    const merged = [...base];
    for (const e of extra ?? []) {
      const label = bareLabel(e);
      if (!label || seen.has(label)) continue;
      seen.add(label);
      merged.push(label);
    }
    return merged;
  };

  const data = {
    armor: merge(self.armor, auto.armor, additional.armor),
    weapons: merge(self.weapons, auto.weapons, additional.weapons),
    tools: merge(self.tools, auto.tools, additional.tools),
    languages: merge(self.languages, auto.languages, additional.languages),
    resistance: merge(self.resistance, auto.resistance, additional.resistance),
    immunity: merge(self.immunity, auto.immunity, additional.immunity),
    vulnerability: merge(self.vulnerability, auto.vulnerability, additional.vulnerability),
  };

  const cats = buildCategories(data, resolveInUseProficiencies(blocks, lookup, {
    armor: data.armor,
    weapons: data.weapons,
    tools: data.tools,
  }));

  return (
    <section aria-details="Character Proficiencies">
      <header className="rpg-tag-heading"><span>Proficiencies</span></header>
      <dl>
        {cats.map(({ label, items, linkItems, inUse }) => (
          <div key={label}>
            <dt>{label}</dt>
            {items.map((item, i) => {
              const active = inUse?.has(item);
              return (
                <dd key={i} data-in-use={active ? "true" : undefined}>
                  {linkItems ? <Pill.Link link={item}>{item}</Pill.Link> : item}
                  {active && (
                    <sup className="rpg-prof-in-use" aria-label="In use">•</sup>
                  )}
                </dd>
              );
            })}
          </div>
        ))}
      </dl>
    </section>
  );
};

export default proficiencies;
