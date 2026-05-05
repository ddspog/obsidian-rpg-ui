import * as React from "react";
import type { ChooseSpec, PendingChoice } from "../domains/features/types";

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
}

export function PendingChoiceRow({ pending, onToggle, onPick }: PendingChoiceRowProps) {
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
  const cleanName = isAuto || isComposite ? category ?? baseName : baseName;
  const displayName = `${cleanName}${levelTag}`;
  const isAsi = choose?.type === "asi";
  return (
    <aside
      className={`rpg-feature-pending${isAsi ? " rpg-feature-pending-asi" : ""}`}
      aria-label={`Pending ${displayName ?? pending.source} choice`}
    >
      <p>
        pick {pending.remaining} more
        {displayName && (
          <>
            {" "}for <em>{displayName}</em>
          </>
        )}
      </p>
      {pending.options.length > 0 && (
        isAsi
          ? <AsiOptions pending={pending} onPick={onPick} />
          : <TraitsOptions pending={pending} onToggle={onToggle} />
      )}
    </aside>
  );
}

function TraitsOptions({
  pending,
  onToggle,
}: {
  pending: PendingChoice;
  onToggle?: (option: string) => void;
}) {
  return (
    <menu aria-label="Choice Options">
      {pending.options.map((o, i) => {
        const raw = o.name ?? "(unnamed)";
        const label = raw.replace(/^\[\[/, "").replace(/\]\]$/, "");
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
function AsiOptions({
  pending,
  onPick,
}: {
  pending: PendingChoice;
  onPick?: (option: string, delta: 1 | -1) => void;
}) {
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
        const label = raw.replace(/^\[\[/, "").replace(/\]\]$/, "");
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
