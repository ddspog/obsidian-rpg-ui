import * as React from "react";
import { EntityBlock, Pill } from "rpg-ui-toolkit";
import { ProficienciesProps } from "./proficiencies.types";
import { CharacterEntity } from "../../entities/character.types";
import type { FeaturesBlockData } from "./features.types";

type Category = { label: string; items: string[]; linkItems?: boolean };

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
 *  purpose). Accepts multiple trait keys so authors can use either the
 *  canonical form (`Weapon Proficiency`) or a shorter alias (`Weapons`)
 *  when emitting picks from inline choose specs. Falls back to `[]` when
 *  no key matches. */
function readTrait(traits: Record<string, string[]> | undefined, keys: string[]): string[] {
  const raw: string[] = [];
  for (const k of keys) {
    const v = traits?.[k];
    if (v) raw.push(...v);
  }
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
}): Category[] {
  const cats: Category[] = [];
  if (data.weapons.length) cats.push({ label: "Weapons", items: data.weapons, linkItems: true });
  if (data.armor.length) cats.push({ label: "Armor", items: data.armor, linkItems: true });
  if (data.tools.length) cats.push({ label: "Tools", items: data.tools, linkItems: true });
  if (data.languages.length) cats.push({ label: "Languages", items: data.languages, linkItems: true });
  return cats;
}

export const proficiencies: EntityBlock<ProficienciesProps, CharacterEntity> = ({
  self,
  blocks,
  lookup,
}) => {
  const header = (blocks as any).header;
  const features = (blocks as any).features as FeaturesBlockData | undefined;

  // Resolve the character's full feature view once; falls back to an empty
  // traits map when the helper is missing (e.g. a system that hasn't wired
  // it up). The auto-derived lists come from the standard trait keys; the
  // YAML's explicit values, if present, win as-is.
  const view = lookup.$features?.(header, features?.choices);
  const traits = view?.traits ?? {};

  const auto = {
    armor: readTrait(traits, ["Armor", "Armor Proficiency"]),
    weapons: readTrait(traits, ["Weapon Proficiency", "Weapons"]),
    tools: readTrait(traits, ["Tool P.", "Tool Proficiency", "Tools"]),
    languages: readTrait(traits, ["Languages", "Language"]),
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
  };

  const cats = buildCategories(data);

  return (
    <section aria-label="Character Proficiencies">
      <header className="rpg-tag-heading"><span>Proficiencies</span></header>
      <dl>
        {cats.map(({ label, items, linkItems }) => (
          <div key={label}>
            <dt>{label}</dt>
            {items.map((item, i) => (
              <dd key={i}>
                {linkItems ? <Pill.Link link={item}>{item}</Pill.Link> : item}
              </dd>
            ))}
          </div>
        ))}
      </dl>
    </section>
  );
};

export default proficiencies;
