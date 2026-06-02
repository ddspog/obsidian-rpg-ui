import * as React from "react";
import type { ChooseSpec, PendingChoice } from "../domains/features/types";

/** Strip `[[` / `]]` and prefer the alias after `|` when present — Obsidian
 *  rewrites bare `[[X]]` to `[[path/to/X|X]]` when X collides with another
 *  note, and the alias is the reader-facing label. */
function optionLabel(raw: string): string {
  const inner = raw.replace(/^\[\[/, "").replace(/\]\]$/, "");
  const pipe = inner.indexOf("|");
  return pipe >= 0 ? inner.slice(pipe + 1).trim() : inner;
}

export interface PendingChoiceRowProps {
  pending: PendingChoice;
  /**
   * Called when the user clicks an option button (traits-type picks).
   * Receives the option label. Caller is responsible for toggling the pick
   * in the character's `choices` map. When omitted the buttons render
   * disabled — useful for read-only displays.
   */
  onToggle?: (option: string) => void;
  /**
   * Called for ability-score-improvement picks where the user can select
   * the same option multiple times. `delta` is `+1` (click `+`) or `-1`
   * (click `−`). When omitted the counter controls render disabled.
   */
  onPick?: (option: string, delta: 1 | -1) => void;
  /**
   * Numeric budget for `buy`-mode picks. The caller evaluates
   * `pending.feature.buy` (which may be a literal or expression like
   * `"5 + PB"`) against the character's EvalContext and passes the
   * result here. Ignored when the parent feature isn't in buy mode.
   */
  buyBudget?: number;
}

export function PendingChoiceRow({ pending, onToggle, onPick, buyBudget }: PendingChoiceRowProps) {
  const featureName = pending.feature.name ?? "";
  const rawChoose = pending.feature.choose;
  const choose: ChooseSpec | undefined = Array.isArray(rawChoose) ? undefined : rawChoose;
  const category = choose?.category;
  // Recognise three synthetic name shapes and clean them up for display:
  //   - `__auto_N`        → block without an authored `name:` field
  //   - `Parent:Category` → per-spec virtual feature split out from a multi-
  //                         spec `choose:` array
  //   - `Name@<level>`    → multi-level pick feature expanded once per level
  //                         (Improvement@4, Improvement@8, …) so the user
  //                         can pick separately at each unlock
  // Strip the level suffix first so a composite name like
  // `Talented Growth:Talent@4` collapses to `Talented Growth:Talent` and
  // the composite-detection still finds the trailing `:Talent`.
  const levelMatch = featureName.match(/^(.*)@(\d+)$/);
  const baseName = levelMatch ? levelMatch[1] : featureName;
  const levelTag = levelMatch ? ` (Lv. ${levelMatch[2]})` : "";
  const isAuto = baseName.startsWith("__auto_");
  const isComposite = category != null && baseName.endsWith(`:${category}`);
  const cleanName = isAuto || isComposite ? (category ?? baseName) : baseName;
  const displayName = `${cleanName}${levelTag}`;
  const isAsi = choose?.type === "asi";
  // A feature may carry both `buy:` (for its feature.choice options) AND
  // an inline `choose:` (for a sibling traits pick). The resolver emits
  // two PendingChoices off the same detail in that case — one for each.
  // Buy-mode only applies to the emission WITHOUT a `choose:` on its
  // feature; the inline-choose pending still renders as a plain traits
  // picker even though the underlying `buy` budget is spread through.
  const isBuy = pending.feature.buy != null && pending.feature.choose == null && typeof buyBudget === "number";
  const buySpent = isBuy
    ? pending.picked.reduce((sum, name) => {
        const opt = pending.options.find((o) => (o.name ?? "") === name);
        return sum + (typeof opt?.cost === "number" ? opt.cost : 0);
      }, 0)
    : 0;
  const buyRemaining = isBuy ? Math.max(0, (buyBudget ?? 0) - buySpent) : 0;
  return (
    <aside
      className={`rpg-feature-pending${isAsi ? " rpg-feature-pending-asi" : ""}${isBuy ? " rpg-feature-pending-buy" : ""}`}
      aria-label={`Pending ${displayName ?? pending.source} choice`}
    >
      <p>
        {isBuy ? (
          <>
            spend up to <strong>{buyRemaining}</strong> more{" "}
            <small>
              ({buySpent} / {buyBudget} spent)
            </small>
          </>
        ) : (
          <>pick {pending.remaining} more</>
        )}
        {displayName && (
          <>
            {" "}
            for <em>{displayName}</em>
          </>
        )}
      </p>
      {pending.options.length > 0 &&
        (isAsi ? (
          <AsiOptions pending={pending} onPick={onPick} />
        ) : isBuy ? (
          <BuyOptions pending={pending} onToggle={onToggle} remaining={buyRemaining} />
        ) : (
          <TraitsOptions pending={pending} onToggle={onToggle} />
        ))}
    </aside>
  );
}

function BuyOptions({
  pending,
  onToggle,
  remaining,
}: {
  pending: PendingChoice;
  onToggle?: (option: string) => void;
  remaining: number;
}) {
  return (
    <menu aria-label="Choice Options">
      {pending.options.map((o, i) => {
        const raw = o.name ?? "(unnamed)";
        const label = optionLabel(raw);
        const cost = typeof o.cost === "number" ? o.cost : 0;
        const alreadyPicked = pending.picked.includes(raw);
        // Already-picked items are always clickable (to refund). Unpicked
        // items disable when their cost exceeds the remaining budget.
        const disabled = !onToggle || (!alreadyPicked && cost > remaining);
        return (
          <li key={i}>
            <button type="button" aria-pressed={alreadyPicked} disabled={disabled} onClick={() => onToggle?.(raw)}>
              {label}
              <small className="rpg-feature-pending-buy-cost"> · {cost} pts</small>
            </button>
          </li>
        );
      })}
    </menu>
  );
}

function TraitsOptions({ pending, onToggle }: { pending: PendingChoice; onToggle?: (option: string) => void }) {
  return (
    <menu aria-label="Choice Options">
      {pending.options.map((o, i) => {
        const raw = o.name ?? "(unnamed)";
        const label = optionLabel(raw);
        const alreadyPicked = pending.picked.includes(raw);
        const slotsFull = pending.remaining === 0;
        return (
          <li key={i}>
            <button
              type="button"
              aria-pressed={alreadyPicked}
              disabled={!onToggle || (slotsFull && !alreadyPicked)}
              onClick={() => onToggle?.(raw)}
            >
              {label}
            </button>
          </li>
        );
      })}
    </menu>
  );
}

/** ASI picks: click `+` to add a point to an option, click `−` to take one
 *  back. By default each option can be picked at most once (spec-level
 *  `unique: false` opts into duplicate picks). Options that haven't been
 *  picked yet still render their `−` disabled so the control layout stays
 *  stable across states. */
function AsiOptions({ pending, onPick }: { pending: PendingChoice; onPick?: (option: string, delta: 1 | -1) => void }) {
  const choose = pending.feature.choose;
  const spec = Array.isArray(choose) ? undefined : choose;
  const unique = spec?.unique !== false;
  const slotsFull = pending.remaining === 0;
  const counts = new Map<string, number>();
  for (const p of pending.picked) counts.set(p, (counts.get(p) ?? 0) + 1);
  return (
    <menu aria-label="Choice Options">
      {pending.options.map((o, i) => {
        const raw = o.name ?? "(unnamed)";
        const label = optionLabel(raw);
        const count = counts.get(raw) ?? 0;
        const incDisabled = !onPick || slotsFull || (unique && count >= 1);
        return (
          <li key={i} className="rpg-feature-pending-asi-row">
            <button
              type="button"
              className="rpg-feature-pending-asi-dec"
              aria-label={`Remove one ${label}`}
              disabled={!onPick || count === 0}
              onClick={() => onPick?.(raw, -1)}
            >
              −
            </button>
            <span className="rpg-feature-pending-asi-label">
              {label}
              {count > 0 && <span className="rpg-feature-pending-asi-count"> ×{count}</span>}
            </span>
            <button
              type="button"
              className="rpg-feature-pending-asi-inc"
              aria-label={`Add one ${label}`}
              disabled={incDisabled}
              onClick={() => onPick?.(raw, 1)}
            >
              +
            </button>
          </li>
        );
      })}
    </menu>
  );
}

export default PendingChoiceRow;
