import * as React from "react";
import {
  resolveInventory,
  type CurrencyPurse,
  type LookupFn,
  type NewInventoryBlock,
  type ResolvedItem,
  type ResolvedSection,
  type SectionId,
  type YamlItemEntry,
} from "lib/domains/inventory";
import { CurrencyRow } from "lib/components/inventory/CurrencyRow";
import { Section } from "lib/components/inventory/Section";
import type { ContainerResolution } from "lib/domains/items/container-overlay";
import type { ItemContainerData, ItemElementData } from "lib/domains/items/schema";

/**
 * Provenance pointer the container card hands back when the reader
 * toggles a row's `$` button. The wrapping entity-block uses it to
 * write `for_sale` into the right slot of the container's own YAML —
 * either inside one of the named `sections[]` or inside the trailing
 * top-level `items[]`.
 */
export interface ContainerForSaleLocation {
  /** Authored bucket: a named `sections[]` entry or the trailing
   *  top-level `items[]` shorthand. */
  source: "section" | "items";
  /** Index into `data.sections[]` when `source === "section"`. Ignored
   *  for `"items"`. */
  sectionIndex: number;
  /** Index path into the section's `items[]` (or the trailing `items[]`
   *  for `source === "items"`), walking `contents[]` at each step to
   *  reach a nested entry. */
  path: number[];
}

interface AuthoredSectionRef {
  source: "section" | "items";
  /** Index into `data.sections[]` when `source === "section"`; -1 for
   *  the trailing items shorthand. */
  sectionIndex: number;
  name?: string;
  /** Raw YAML entries (mix of bare strings and objects). The card
   *  feeds these straight through `coerceEntry` + `resolveInventory`,
   *  so the resolved item ids' index paths line up with the indices
   *  in this array — letting the toggle handler walk back to the
   *  same authored slot for the writeback. */
  items: unknown[];
}

interface ItemContainerCardProps {
  data: ItemContainerData;
  resolution: ContainerResolution | null;
  /** Item lookup (pulled from `lookup.$items`) so the card can compute
   *  per-row weight + container metadata for nested entries — same
   *  source the character inventory block reads. */
  lookup?: LookupFn;
  renderMarkdown?: (source: string) => React.ReactNode;
  /** When provided, every leaf row renders the `$` toggle. The handler
   *  receives a location pointer back into the authored YAML so the
   *  caller can persist the new `for_sale` state on the right slot. */
  onToggleForSale?: (location: ContainerForSaleLocation) => void;
}

/**
 * `rpg item.container` card — world-attached stash page rendered with
 * the same chrome as the character inventory: stripline header,
 * description, currency chips, capacity-vs-weight indicator, named
 * sections of resolved item rows, and a final image.
 *
 * Capacity is sourced from the composed base element's
 * `container.weight_cap`; the indicator turns red when the contained
 * total exceeds it. Encumbrance bands aren't applicable here (a stash
 * has no STR), so the bottom bar is replaced by the simpler
 * weight / capacity readout near the top.
 */
export function ItemContainerCard({
  data,
  resolution,
  lookup,
  renderMarkdown,
  onToggleForSale,
}: ItemContainerCardProps) {
  const element = resolution?.effectiveElement;
  const magicTexts = resolution?.magicTexts ?? [];
  const lookupFn: LookupFn = lookup ?? ((_target: string) => undefined);

  // Walk the authored YAML directly (NOT `resolution.sections`) so the
  // resolved item ids' index paths stay aligned with `data.sections[i].items`
  // and `data.items[]`. The toggle-for-sale handler relies on those indices
  // to write back to the right slot.
  const authoredSections = React.useMemo<AuthoredSectionRef[]>(() => {
    const out: AuthoredSectionRef[] = [];
    (data.sections ?? []).forEach((section, sectionIndex) => {
      out.push({
        source: "section",
        sectionIndex,
        name: section.name,
        items: (section.items ?? []) as unknown[],
      });
    });
    if (Array.isArray(data.items) && data.items.length > 0) {
      out.push({
        source: "items",
        sectionIndex: -1,
        name: undefined,
        items: data.items as unknown[],
      });
    }
    return out;
  }, [data.sections, data.items]);

  // Build a synthetic NewInventoryBlock per section to pipe through the
  // shared inventory resolver — that gives us per-row metadata (weight,
  // qty, container detection, ammo tracking) for free, with the same
  // visual rendering character sheets use.
  const resolvedSections: ResolvedSection[] = React.useMemo(() => {
    return authoredSections.map((authored, idx) => {
      const items: YamlItemEntry[] = authored.items.map(coerceEntry);
      const block: NewInventoryBlock = { items };
      const inv = resolveInventory({
        block,
        lookup: lookupFn,
        strength: 10,
      });
      // The shared resolver routes items into known SectionIds; flatten
      // them all back into one list under the author-given section name.
      const allItems = inv.sections.flatMap((s) => s.items);
      const totalWeight = inv.totalWeight;
      const id = (authored.name ?? `Contents ${idx + 1}`) as SectionId;
      return {
        id,
        items: allItems,
        totalWeight,
      };
    });
  }, [authoredSections, lookupFn]);

  const totalWeight = resolvedSections.reduce((acc, s) => acc + s.totalWeight, 0);
  const capacity = parseCapacity(element?.container?.weight_cap);
  const overCapacity = capacity != null && totalWeight > capacity;

  const currency = data.currency ?? {};
  const hasCurrency = Object.values(currency).some(
    (v) => typeof v === "number" && v > 0,
  );
  // Sum the cost of every `for_sale`-flagged row across every section so
  // the "To Sell" line under the currency chips reflects the total a
  // shopkeeper would pay if the player offloaded everything currently
  // marked. Walks nested container contents the same way the character
  // inventory resolver does.
  const sellTotals = React.useMemo<CurrencyPurse>(() => {
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
    for (const section of resolvedSections) for (const item of section.items) visit(item);
    return totals;
  }, [resolvedSections]);

  // overCapacity is kept in scope for eslint/TS even though the card
  // surfaces the state through the CapacityBar colour zones; swap the
  // marker to a pointer if we want a subtle sheet-wide overflow hint.
  void overCapacity;

  return (
    <article className="rpg-item-container-card rpg-inventory-block">
      {element && (
        <dl className="rpg-item-card__stripline">
          {element.type && (
            <div className="rpg-item-card__stripline-pair">
              <dt>Type</dt>
              <dd>{parseTypeTokens(element.type)}</dd>
            </div>
          )}
          {element.cost && (
            <div className="rpg-item-card__stripline-pair">
              <dt>Cost</dt>
              <dd>{element.cost}</dd>
            </div>
          )}
          {element.weight != null && (
            <div className="rpg-item-card__stripline-pair">
              <dt>Weight</dt>
              <dd>
                {typeof element.weight === "number" ? `${element.weight} lb.` : element.weight}
              </dd>
            </div>
          )}
          {element.rarity && (
            <div className="rpg-item-card__stripline-pair">
              <dt>Rarity</dt>
              <dd>{element.rarity}</dd>
            </div>
          )}
        </dl>
      )}

      {magicTexts.map((text, i) => (
        <React.Fragment key={i}>
          {renderMarkdown ? renderMarkdown(text) : <p>{text}</p>}
        </React.Fragment>
      ))}

      {!isHidden(data.hide, "base.desc") && element?.desc && (
        <div className="rpg-item-card__desc">
          {renderMarkdown ? renderMarkdown(element.desc) : <p>{element.desc}</p>}
        </div>
      )}

      {hasCurrency || Object.keys(sellTotals).length > 0 ? (
        <CurrencyRow currency={currency} sellTotals={sellTotals} />
      ) : null}

      {capacity != null && (
        <CapacityBar total={totalWeight} capacity={capacity} />
      )}

      {resolvedSections.map((section, idx) => {
        const authored = authoredSections[idx];
        const sectionToggle = onToggleForSale && authored
          ? (item: ResolvedItem) => onToggleForSale({
              source: authored.source,
              sectionIndex: authored.sectionIndex,
              path: item.id.split(".").map((s) => Number(s)),
            })
          : undefined;
        return (
          <Section
            key={section.id}
            section={section}
            hideWhenEmpty
            onToggleForSale={sectionToggle}
          />
        );
      })}

      {element?.image && (
        <figure className="rpg-item-card__figure">
          {renderMarkdown ? renderMarkdown(element.image) : <span>{element.image}</span>}
        </figure>
      )}
    </article>
  );
}

/**
 * Capacity progress bar: the bar's full width represents 200% of the
 * container's weight cap, split into four coloured zones that line up
 * with 50% / 100% / 200% threshold markers:
 *
 *     │  GREEN (0–50 %)  │ YELLOW │  RED (100–200 %)  │
 *     0%                 50%     100%               200%
 *
 * "Green occupies the first 25 % of the bar" as requested — 0–50 % of
 * cap maps onto 0–25 % of bar. Yellow then runs 25–50 % of bar (50–100 %
 * of cap) and red covers 50–100 % of bar (100–200 % of cap). A marker
 * slides along to show the current fill; over-200 % pins to the right
 * edge and flips a warning flag on the label.
 */
function CapacityBar({ total, capacity }: { total: number; capacity: number }) {
  const ratio = capacity > 0 ? total / capacity : 0;
  const percentOfCap = Math.round(ratio * 100);
  // Bar-space coordinates: 200 % of cap = 100 % of bar width.
  const markerPct = Math.min(100, (ratio / 2) * 100);
  const level =
    ratio >= 2 ? "critical" :
    ratio >= 1 ? "over" :
    ratio >= 0.5 ? "warn" :
    "ok";
  return (
    <section
      className="rpg-inventory-block__encumbrance rpg-inventory-block__capacity"
      data-level={level}
    >
      <h5 className="rpg-inventory-block__section-title">Capacity</h5>
      <div className="rpg-inventory-block__encumbrance-grid">
        <div className="rpg-inventory-block__encumbrance-cell">
          <span className="rpg-inventory-block__encumbrance-label">Total Wht.</span>
          <span className="rpg-inventory-block__encumbrance-value">
            {formatPounds(total)} lb.
          </span>
        </div>
        <div className="rpg-inventory-block__encumbrance-cell">
          <span className="rpg-inventory-block__encumbrance-label">Capacity</span>
          <span className="rpg-inventory-block__encumbrance-value">
            {formatPounds(capacity)} lb.
          </span>
        </div>
        <div className="rpg-inventory-block__encumbrance-cell">
          <span className="rpg-inventory-block__encumbrance-label">Load</span>
          <span className="rpg-inventory-block__encumbrance-value">
            {percentOfCap}%
          </span>
        </div>
      </div>
      <div
        className="rpg-inventory-block__encumbrance-bar"
        role="progressbar"
        aria-valuenow={Math.round(total)}
        aria-valuemin={0}
        aria-valuemax={Math.round(capacity * 2)}
      >
        <div
          className="rpg-inventory-block__capacity-band"
          data-band="ok"
          style={{ left: 0, width: "25%" }}
        />
        <div
          className="rpg-inventory-block__capacity-band"
          data-band="warn"
          style={{ left: "25%", width: "25%" }}
        />
        <div
          className="rpg-inventory-block__capacity-band"
          data-band="over"
          style={{ left: "50%", width: "50%" }}
        />
        {/* Threshold tick marks at 50 % / 100 % / 200 % of cap. */}
        {[25, 50, 100].map((p) => (
          <div
            key={p}
            className="rpg-inventory-block__capacity-tick"
            style={{ left: `${p}%` }}
            aria-hidden="true"
          />
        ))}
        <div
          className="rpg-inventory-block__encumbrance-marker"
          style={{ left: `${markerPct}%` }}
        />
      </div>
    </section>
  );
}

function formatPounds(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}

/** Whether the author has opted out of rendering a particular sub-block
 *  via `hide: [...]` on the YAML body. Currently understood keys are
 *  documented on `ItemContainerData.hide`. */
function isHidden(hide: string[] | undefined, key: string): boolean {
  return Array.isArray(hide) && hide.includes(key);
}

/** Split a cost string like `"15 gp"` / `"5 sp"` / `"25cp"` into
 *  `{ amount, denomination }`. Mirror of the inventory resolver's
 *  internal helper so the card can sum sell totals without exposing
 *  it as a public utility. */
function parseCoin(
  raw: string | undefined,
): { amount: number; denomination: keyof CurrencyPurse } | null {
  if (!raw) return null;
  const m = raw.match(/(-?\d+(?:\.\d+)?)\s*(pp|gp|ep|sp|cp)/i);
  if (!m) return null;
  const amount = Number(m[1]);
  if (!Number.isFinite(amount)) return null;
  return { amount, denomination: m[2].toLowerCase() as keyof CurrencyPurse };
}

/** Coerce a container content entry (string shorthand or object form)
 *  into the YAML inventory entry shape. The container overlay's
 *  `normaliseEntries` already runs upstream when a `resolution` is
 *  passed, but the card may receive a `data` body directly (no
 *  resolution) — so we keep the same string-tolerance here too. */
function coerceEntry(raw: unknown): YamlItemEntry {
  if (typeof raw === "string") return { name: raw };
  if (raw && typeof raw === "object") {
    const o = raw as {
      name?: unknown;
      qty?: unknown;
      notes?: unknown;
      contents?: unknown;
      for_sale?: unknown;
    };
    const name = typeof o.name === "string" ? o.name : "";
    const out: YamlItemEntry = { name };
    if (typeof o.qty === "number") out.qty = o.qty;
    if (typeof o.notes === "string") out.notes = o.notes;
    if (o.for_sale === true) out.for_sale = true;
    if (Array.isArray(o.contents)) out.contents = o.contents.map(coerceEntry);
    return out;
  }
  return { name: "" };
}

/** Pull the numeric weight cap out of a `weight_cap:` string like
 *  `"300 lb."`. Returns null when the string can't be parsed so the
 *  capacity indicator simply hides. */
function parseCapacity(raw: string | undefined): number | null {
  if (!raw || typeof raw !== "string") return null;
  const m = raw.match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

/** Split `"Adventuring Gear ([[Container]])"` into a mix of plain and
 *  internal-link spans. Mirrors the helper in `ItemElementCard`. */
function parseTypeTokens(raw: string): React.ReactNode {
  return renderMixed(raw, "type");
}

function renderMixed(value: string, keyBase: string | number): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const re = /\[\[[^\]]+\]\]/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(value)) !== null) {
    if (match.index > cursor) {
      parts.push(
        <React.Fragment key={`${keyBase}-t-${cursor}`}>
          {value.slice(cursor, match.index)}
        </React.Fragment>,
      );
    }
    parts.push(renderWikilink(match[0], `${keyBase}-l-${match.index}`));
    cursor = match.index + match[0].length;
  }
  if (cursor < value.length) {
    parts.push(
      <React.Fragment key={`${keyBase}-t-${cursor}-tail`}>
        {value.slice(cursor)}
      </React.Fragment>,
    );
  }
  return <>{parts}</>;
}

function renderWikilink(raw: string, key: number | string): React.ReactNode {
  const match = raw.match(/^\[\[(.+?)\]\]$/);
  if (!match) return <React.Fragment key={key}>{raw}</React.Fragment>;
  const target = match[1].split("|")[0];
  const inner = match[1];
  const pipe = inner.indexOf("|");
  const label = (pipe >= 0 ? inner.slice(pipe + 1) : inner).split("/").pop()!.trim();
  return (
    <a
      key={key}
      className="internal-link"
      href={target}
      data-href={target}
    >
      {label}
    </a>
  );
}
