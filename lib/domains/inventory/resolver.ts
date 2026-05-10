/**
 * Resolve a parsed YAML inventory block into a fully-materialised model,
 * ready for rendering. Item metadata (weight, cost, damage, …) is fetched
 * through an injected `LookupFn` so the view can back it with Obsidian's
 * metadata cache and tests / Storybook can back it with a static map.
 */

import type {
  CurrencyPurse,
  EquipSlot,
  NewInventoryBlock,
  SectionId,
  YamlItemEntry,
} from "./schema";
import { wikilinkLabel, wikilinkTarget } from "./schema";
import type { ItemMetadata } from "./item-frontmatter";
import { itemEquipKind, parseItemMetadata } from "./item-frontmatter";
import { classifyItem, isContainerEntry, SECTION_ORDER } from "./routing";
import {
  classifyLoad,
  computeBands,
  type EncumbranceBands,
  type LoadState,
} from "./encumbrance";

/** Look up a compendium item's frontmatter by wikilink target or bare name. */
export type LookupFn = (
  target: string,
) => Record<string, unknown> | undefined;

export interface ResolvedItem {
  id: string;
  /** Display label (alias or basename). */
  label: string;
  /** Raw wikilink `[[…]]` string, or null for non-linked entries. */
  link: string | null;
  /** Resolved vault target (before `|` alias), or null when not a wikilink. */
  linkTarget: string | null;
  meta: ItemMetadata;
  qty: number;
  /** Total weight for this row: qty × per-item weight + contents (if container).
   *  For weight-fixed containers (Bag of Holding), contents weight is
   *  excluded from this value so the carrier's encumbrance isn't fed the
   *  extradimensional load — use `contentsWeightRaw` when displaying the
   *  actual contents sum inside the container's UI. */
  totalWeight: number;
  /** Sum of the contents' own weights without any weight-fixed override
   *  applied — useful for rendering a Bag of Holding's `(<carried>/<cap>) <self>`
   *  readout where the actual interior load matters. */
  contentsWeightRaw: number;
  /** Effective equip state. */
  equipped: boolean;
  slot?: EquipSlot;
  /** Coarse equip routing — `weapon` / `armor` / `shield` / null. Lets
   *  the UI surface a slot-aware toggle button without re-parsing the
   *  item type at the call site. */
  equipKind: "weapon" | "armor" | "shield" | null;
  /** Marked for sale — toggles the "To Sell" totals below currency. */
  forSale: boolean;
  notes?: string;
  isContainer: boolean;
  /** Ammo-tracking mode: the item declares `container.for_ammo` AND
   *  every entry in `contents:` is that same ammo. In this mode the
   *  inventory UI renders the item as a single row (not a collapsible
   *  container) and shows `<carried> / <ammoCap>` in the stat column. */
  isAmmoTracking: boolean;
  /** Sum of `qty` across all contents entries matching `forAmmo`. Only
   *  meaningful when `isAmmoTracking` is true. */
  ammoCarried: number;
  contents: ResolvedItem[];
}

export interface ResolvedSection {
  id: SectionId;
  items: ResolvedItem[];
  totalWeight: number;
}

export interface ResolvedInventory {
  stateKey?: string;
  sections: ResolvedSection[];
  currency: CurrencyPurse;
  totalWeight: number;
  bands: EncumbranceBands;
  load: LoadState;
  strength: number;
  /** Sum of `cost` fields from every item flagged `for_sale: true`,
   *  bucketed by denomination. Same shape as `currency` so the UI can
   *  render a matching "To Sell" row beneath the coin chips. An empty
   *  purse when nothing is flagged. */
  sellTotals: CurrencyPurse;
  /** Current / maximum attuned magic-item count. The cap defaults to 3
   *  (5e standard) and is raised by any `Attunement C.` trait entries
   *  (each contributes an additive `+N`). Active count is whatever the
   *  caller supplied — computed at the entity-block level since
   *  attunement state lives on the `rpg item.personal` file, not the
   *  inventory row itself. */
  attunement: {
    active: number;
    cap: number;
  };
}

export interface ResolveInventoryArgs {
  block: NewInventoryBlock;
  lookup: LookupFn;
  /** Strength score used for encumbrance auto-calc. */
  strength: number;
  /** Optional attunement summary. Defaults to `{ active: 0, cap: 3 }`
   *  — callers with access to personal-item state compute the real
   *  values and pass them in. */
  attunement?: { active: number; cap: number };
}

export function resolveInventory({
  block,
  lookup,
  strength,
  attunement,
}: ResolveInventoryArgs): ResolvedInventory {
  // Resolve items and place each in its section. Containers keep their
  // contents nested; only the container's combined weight counts toward the
  // section / grand total.
  const sectionsMap: Record<SectionId, ResolvedItem[]> = {
    weapons: [],
    armor: [],
    tools: [],
    visible: [],
    main_containers: [],
    other_containers: [],
  };

  let grandTotal = 0;
  block.items.forEach((entry, idx) => {
    const resolved = resolveEntry(entry, `${idx}`, lookup);
    // Ammo-tracking containers ride along with the wielder's weapons
    // in the Weapons section — easier to glance at "do I still have
    // arrows?" next to the Longbow row than hunting through Main
    // Containers. Non-ammo containers (or ammo containers with mixed
    // contents) keep their classifyItem verdict.
    const section = resolved.isAmmoTracking
      ? "weapons"
      : classifyItem(entry, resolved.meta);
    sectionsMap[section].push(resolved);
    grandTotal += resolved.totalWeight;
  });

  const bands = computeBands(strength, block.encumbrance);
  const load = classifyLoad(grandTotal, bands);

  const sections: ResolvedSection[] = SECTION_ORDER.map((id) => ({
    id,
    items: sectionsMap[id],
    totalWeight: sectionsMap[id].reduce((acc, it) => acc + it.totalWeight, 0),
  }));

  return {
    stateKey: block.state_key,
    sections,
    currency: block.currency ?? {},
    totalWeight: grandTotal,
    bands,
    load,
    strength,
    sellTotals: computeSellTotals(sections),
    attunement: attunement ?? { active: 0, cap: 3 },
  };
}

/**
 * Sum the `cost` of every `forSale: true` row — walks top-level entries
 * AND their nested container contents so flagging an item inside a
 * container still counts toward the total. Values are bucketed by
 * denomination so `3 gp` and `25 cp` don't collapse into an unreadable
 * mixed total.
 */
function computeSellTotals(sections: ResolvedSection[]): CurrencyPurse {
  const totals: CurrencyPurse = {};
  const visit = (item: ResolvedItem): void => {
    if (item.forSale) {
      const parsed = parseCoin(item.meta.cost);
      if (parsed) {
        const amount = parsed.amount * item.qty;
        totals[parsed.denomination] = (totals[parsed.denomination] ?? 0) + amount;
      }
    }
    for (const child of item.contents) visit(child);
  };
  for (const section of sections) for (const item of section.items) visit(item);
  return totals;
}

/** Split a cost string like `"15 gp"` / `"5 sp"` / `"25cp"` into
 *  `{ amount, denomination }`. Returns null when the string doesn't
 *  match — shop-less items (Holy Symbol = `5 gp` but sometimes just
 *  a gift) then drop out of the sell totals silently. */
function parseCoin(raw: string | undefined): { amount: number; denomination: keyof CurrencyPurse } | null {
  if (!raw) return null;
  const m = raw.match(/(-?\d+(?:\.\d+)?)\s*(pp|gp|ep|sp|cp)/i);
  if (!m) return null;
  const amount = Number(m[1]);
  if (!Number.isFinite(amount)) return null;
  return { amount, denomination: m[2].toLowerCase() as keyof CurrencyPurse };
}

function resolveEntry(
  entry: YamlItemEntry,
  path: string,
  lookup: LookupFn,
): ResolvedItem {
  const target = wikilinkTarget(entry.name);
  const link = target ? entry.name : null;
  const label = target ? wikilinkLabel(entry.name) : entry.name;

  const lookupKey = target ?? entry.name;
  const fm = lookup(lookupKey);
  const meta = parseItemMetadata(fm);

  const qty = entry.qty && entry.qty > 0 ? entry.qty : 1;

  const contents: ResolvedItem[] = (entry.contents ?? []).map((child, i) =>
    resolveEntry(child, `${path}.${i}`, lookup),
  );

  const selfWeight = meta.weight * qty;
  const rawContentsWeight = contents.reduce((acc, c) => acc + c.totalWeight, 0);
  // Extradimensional containers (Bag of Holding, Handy Haversack) carry
  // a fixed external weight regardless of how much is stuffed inside.
  // `meta.weightFixed` marks these — we keep the raw contents sum on
  // the resolved item (for the container's own capacity readout) but
  // zero it out for the carrier's total.
  const contentsWeight = meta.weightFixed ? 0 : rawContentsWeight;

  // Ammo-tracking mode: the container declares `container.for_ammo`
  // AND every content entry carries one of those ammo names. In that
  // case the UI renders the item as a single row with
  // `<carried> / <cap>` in the stat column instead of a collapsible
  // container. Mixed contents (e.g. Pouch holding Arrows + Keys) fall
  // back to normal container rendering — the ammo declaration is
  // still authored, it just doesn't trigger the tracking mode this
  // render.
  const ammoTargets = new Set(
    (meta.forAmmo ?? []).map(wikiStem).filter(Boolean),
  );
  const isAmmoTracking = Boolean(
    ammoTargets.size > 0 &&
      contents.length > 0 &&
      contents.every((c) => ammoTargets.has(wikiStem(c.link ?? c.label))),
  );
  const ammoCarried = isAmmoTracking
    ? contents.reduce((acc, c) => acc + c.qty, 0)
    : 0;

  const equipKind = itemEquipKind(meta.type);
  // Shields are equipped-by-ownership. A character carrying a shield is
  // wielding it unless they're specifically swapping — the AC and trait
  // contributions should always kick in, matching the health block's
  // "strongest shield bonus from inventory" policy. Authors don't have
  // to toggle `equipped:` on every shield entry for their magic shield's
  // traits to reach the character sheet.
  const autoEquipped = equipKind === "shield";
  return {
    id: path,
    label,
    link,
    linkTarget: target,
    meta,
    qty,
    totalWeight: selfWeight + contentsWeight,
    contentsWeightRaw: rawContentsWeight,
    equipped: entry.equipped === true || entry.slot !== undefined || autoEquipped,
    slot: entry.slot,
    equipKind,
    forSale: entry.for_sale === true,
    notes: entry.notes,
    // Ammo-tracking rows render as single rows, not collapsibles.
    isContainer: isContainerEntry(entry) && !isAmmoTracking,
    isAmmoTracking,
    ammoCarried,
    contents,
  };
}

/** Normalise a `[[folder/Name|Alias]]` wikilink or a bare label into
 *  the bare stem for case-insensitive matching. Mirrors the helper
 *  used elsewhere in the inventory / attacks pipeline. */
function wikiStem(raw: string): string {
  if (!raw) return "";
  const m = raw.match(/^\[\[(.+?)\]\]$/);
  const inner = m ? m[1] : raw;
  return inner.split("|")[0].split("/").pop()!.trim().toLowerCase();
}
