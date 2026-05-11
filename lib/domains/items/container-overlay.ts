/**
 * Compose a `rpg item.container` instance into its effective shape —
 * base element merged with each authored magic template's overlay,
 * producing weight / capacity / rarity overrides plus the trait set
 * that flows to whoever carries the container.
 *
 * Sections and items pass through unchanged — the caller (character
 * inventory block, item.container card) feeds them into the shared
 * inventory resolver to compute weights / nested contents.
 *
 * Mirror of `resolvePersonalItem` minus the weapon-specific overlay
 * channels; authored so `item.personal` and `item.container` share the
 * same look-and-feel when a character sheet renders either.
 */

import type {
  ItemContainerData,
  ItemContainerSection,
  ItemElementData,
  ItemMagicData,
} from "./schema";

/** What the container pipeline produces for downstream consumers. */
export interface ContainerResolution {
  /** Base element merged with every magic overlay's cost / rarity /
   *  image fallbacks. Matches the `ItemElementData` shape so card
   *  renderers reuse the same stripline logic as elements / personals. */
  effectiveElement: ItemElementData;
  /** Sections the container's own page renders as collapsibles. When
   *  the container shows up in a character inventory, the same
   *  sections flow through — the sheet becomes the carrier's view of
   *  the same stash. */
  sections: ItemContainerSection[];
  /** Trait grants merged across every applied template. Flow to the
   *  carrier (whoever has the container equipped / in inventory) so a
   *  Handy Haversack's `Speed B.: +5` etc. reaches the character
   *  sheet's trait aggregator. */
  traits: Record<string, string[]>;
  /** File stems of the magic templates whose sibling
   *  `rpg feature.details` fences should surface as feature sources on
   *  the carrier's sheet. Same contract as `PersonalResolution`. */
  magicFeatureSources: string[];
  /** Text bodies of each applied magic template (variant text wins
   *  when the container picks one). The container card renders these
   *  inline between the stripline and the base item's description. */
  magicTexts: string[];
  /** Display name the reader sees — falls back to the container file
   *  stem when `container.name` is absent. */
  displayName: string;
}

export interface ContainerResolverLookups {
  elements: Record<string, ItemElementData>;
  magic: Record<string, ItemMagicData>;
}

/**
 * Resolve a container into its effective shape. Returns null when the
 * base element is missing — the card renderer degrades to the raw
 * container body (sections still render) so authors see the problem
 * without the page disappearing.
 */
export function resolveContainer(
  container: ItemContainerData,
  lookups: ContainerResolverLookups,
  containerStem?: string,
): ContainerResolution | null {
  const baseKey = wikiStem(container.base ?? "");
  const base = baseKey ? lookups.elements[baseKey] : undefined;
  if (!base) return null;

  const traits: Record<string, string[]> = {};
  const magicFeatureSources: string[] = [];
  const magicTexts: string[] = [];
  let latestRarity: string | undefined;
  let latestCost: string | undefined;
  let fallbackImage: string | undefined;
  // Physical overrides from applied magic templates. Applied after the
  // base element is cloned so the last magic to declare an override
  // wins — matches the `latestRarity` / `latestCost` pattern.
  let overrideWeight: string | number | undefined;
  let overrideWeightCap: string | undefined;
  let overrideWeightFixed: boolean | undefined;

  for (const magicLink of container.magic ?? []) {
    const stem = wikiStem(magicLink);
    if (!stem) continue;
    const magic = lookups.magic[stem];
    if (!magic) continue;
    magicFeatureSources.push(stem);

    const variantKey = container.variants?.[stem]
      ?? container.variants?.[magic.name ?? ""]
      ?? undefined;
    const variant = variantKey ? magic.variants?.[variantKey] : undefined;

    // Traits: variant overrides template; both merge into the trait map.
    // Values flow through `normalizeTraitMapValue` so `Weight Reduction.: true`
    // and `Skill A.: [[Perception]]` share the same normalisation path
    // the feature resolver + personal overlay already use.
    const templateTraits = magic.traits ?? {};
    const variantTraits = variant?.traits ?? {};
    for (const source of [templateTraits, variantTraits]) {
      for (const [key, rawValue] of Object.entries(source)) {
        const values = normalizeTraitMapValue(rawValue);
        if (values.length === 0) continue;
        (traits[key] ??= []).push(...values);
      }
    }

    if (variant?.rarity) latestRarity = variant.rarity;
    else if (magic.rarity) latestRarity = magic.rarity;
    if (variant?.cost) latestCost = variant.cost;
    else if (magic.cost) latestCost = magic.cost;

    // Physical overrides (weight, capacity, weight-fixed flag). Magic
    // templates set these to model extradimensional containers like
    // Bag of Holding which weigh 15 lb regardless of contents and
    // carry 500 lb despite a base sack's 30-lb cap.
    if (magic.weight !== undefined) overrideWeight = magic.weight;
    if (magic.weight_cap !== undefined) overrideWeightCap = magic.weight_cap;
    if (magic.weight_fixed !== undefined) overrideWeightFixed = magic.weight_fixed;

    const textForThis = variant?.text ?? magic.text;
    if (textForThis && textForThis.trim()) magicTexts.push(textForThis);

    if (!fallbackImage && magic.image) fallbackImage = magic.image;
  }

  const effectiveElement: ItemElementData = { ...base };
  if (latestRarity) effectiveElement.rarity = latestRarity;
  if (latestCost) effectiveElement.cost = latestCost;
  if (overrideWeight !== undefined) effectiveElement.weight = overrideWeight;
  if (overrideWeightCap !== undefined || overrideWeightFixed !== undefined) {
    effectiveElement.container = {
      ...(base.container ?? {}),
      ...(overrideWeightCap !== undefined ? { weight_cap: overrideWeightCap } : {}),
      ...(overrideWeightFixed !== undefined ? { weight_fixed: overrideWeightFixed } : {}),
    };
  }
  if (container.image) effectiveElement.image = container.image;
  else if (fallbackImage && !effectiveElement.image) effectiveElement.image = fallbackImage;
  effectiveElement.name = container.name ?? effectiveElement.name;

  // Flatten sections-or-items authored shapes into the normalised
  // `sections[]`. A flat `items:` body renders as a single unnamed
  // section; mixed authored shapes keep `sections:` first and append
  // `items:` as a trailing unnamed section. Bare-string items (the
  // shorthand `- "[[Foo]]"` YAML form) are coerced into `{ name }`
  // objects so every downstream consumer (inventory resolver, card
  // renderer) sees the same shape.
  const sections: ItemContainerSection[] = [];
  for (const section of container.sections ?? []) {
    sections.push({
      name: section.name,
      items: normaliseEntries(section.items),
    });
  }
  if (Array.isArray(container.items) && container.items.length > 0) {
    sections.push({ name: undefined, items: normaliseEntries(container.items) });
  }

  return {
    effectiveElement,
    sections,
    traits,
    magicFeatureSources,
    magicTexts,
    displayName: container.name ?? containerStem ?? "",
  };
}

/** Strip a wikilink wrapper down to its bare file stem. */
function wikiStem(raw: string): string {
  if (!raw) return "";
  const m = raw.match(/^\[\[(.+?)\]\]$/);
  const inner = m ? m[1] : raw;
  return inner.split("|")[0].split("/").pop()!.trim();
}

/** Coerce a content list authored as a mix of strings (shorthand) and
 *  objects into pure `{ name, qty?, notes?, contents? }` entries.
 *  Recurses into `contents:` so nested shorthand survives the same
 *  way. Items that don't carry a usable `name` drop out so downstream
 *  consumers can trust `entry.name` is always a string. */
function normaliseEntries(items: unknown): import("./schema").ItemContainerEntry[] {
  if (!Array.isArray(items)) return [];
  const out: import("./schema").ItemContainerEntry[] = [];
  for (const raw of items) {
    if (typeof raw === "string") {
      out.push({ name: raw });
      continue;
    }
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    if (typeof o.name !== "string") continue;
    const entry: import("./schema").ItemContainerEntry = { name: o.name };
    if (typeof o.qty === "number") entry.qty = o.qty;
    if (typeof o.notes === "string") entry.notes = o.notes;
    if (o.for_sale === true) entry.for_sale = true;
    if (Array.isArray(o.contents)) entry.contents = normaliseEntries(o.contents);
    out.push(entry);
  }
  return out;
}

/** Same normaliser as `magic-overlay.ts` — kept in sync so the two
 *  composers behave identically when authors use `true` flags or
 *  wikilink values. */
function normalizeTraitMapValue(val: unknown): string[] {
  if (val == null) return [];
  if (typeof val === "string") return [val];
  if (typeof val === "number") return [String(val)];
  if (typeof val === "boolean") return val ? [""] : [];
  if (Array.isArray(val)) {
    if (
      val.length === 1 &&
      Array.isArray(val[0]) &&
      val[0].length === 1 &&
      typeof val[0][0] === "string"
    ) {
      return [`[[${val[0][0]}]]`];
    }
    return val.flatMap(normalizeTraitMapValue);
  }
  return [];
}
