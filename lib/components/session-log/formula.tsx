/**
 * Renders a parsed lonelog formula: a contest or single check, then its result.
 *
 *   d10=8  vs  CF 5  →  Expected Scene
 *   └─dice─┘   └CF─┘    └── result ──┘
 *
 * Dice render as an inline die badge: a fixed-size polyhedral silhouette (the
 * shape carries the type) with the value centered inside. A pool (2d6) renders
 * one die per die plus the modifier and total; the contest winner is emphasized.
 */

import * as React from "react";
import type { Formula, FormulaCheck, FormulaTerm, DiceTerm, ThresholdTerm } from "lib/domains/session-log/formula";
import { combineDiceSlots } from "lib/domains/session-log/formula";

/** Keep clicks/keys inside an input from triggering the row's scroll/select. */
const stopEvent = (e: React.SyntheticEvent) => e.stopPropagation();

/**
 * Wires a formula's editable terms (dice and CF/DC thresholds) up for inline
 * editing. A term exposes one or more slots (single die → 1, d100 → tens +
 * units, pool → one per die, threshold → 1); `valueFor` gives a slot's current
 * value (pending edit or original), `onChange` reports a new digit string. When
 * absent, terms render read-only.
 */
export interface DieEditContext {
  valueFor: (term: DiceTerm | ThresholdTerm, slot: number) => string;
  onChange: (term: DiceTerm | ThresholdTerm, slot: number, value: string) => void;
  /** Current result text (pending edit or original); set only when editable. */
  resultValue?: string;
  onResultChange?: (value: string) => void;
}

export function FormulaView({ formula, edit }: { formula: Formula; edit?: DieEditContext }) {
  return (
    <span className="lonelog-formula">
      <CheckView check={formula.check} edit={edit} />
      {formula.result != null && (
        <>
          <span className="lonelog-formula-yields" aria-hidden="true">
            →
          </span>
          {edit?.onResultChange ? (
            <input
              type="text"
              className="lonelog-formula-result lonelog-formula-result-input"
              aria-label="Result"
              value={edit.resultValue ?? formula.result}
              size={Math.max((edit.resultValue ?? formula.result).length, 1)}
              spellCheck={false}
              onClick={stopEvent}
              onKeyDown={stopEvent}
              onChange={(e) => edit.onResultChange!(e.target.value)}
            />
          ) : (
            <span className="lonelog-formula-result">{formula.result}</span>
          )}
        </>
      )}
    </span>
  );
}

function CheckView({ check, edit }: { check: FormulaCheck; edit?: DieEditContext }) {
  if (check.kind === "single") return <TermView term={check.term} state="neutral" edit={edit} />;
  const leftState = check.winner === "left" ? "winner" : check.winner ? "loser" : "neutral";
  const rightState = check.winner === "right" ? "winner" : check.winner ? "loser" : "neutral";
  return (
    <span className="lonelog-contest">
      <TermView term={check.left} state={leftState} edit={edit} />
      <span className="lonelog-contest-vs">vs</span>
      <TermView term={check.right} state={rightState} edit={edit} />
    </span>
  );
}

type TermState = "winner" | "loser" | "neutral";

function TermView({ term, state, edit }: { term: FormulaTerm; state: TermState; edit?: DieEditContext }) {
  const cls = `lonelog-term is-${state}`;
  if (term.kind === "dice") {
    return (
      <span className={cls}>
        <Die term={term} edit={edit} />
      </span>
    );
  }
  if (term.kind === "threshold") {
    return (
      <span className={cls}>
        <span className="lonelog-threshold">
          <span className="lonelog-threshold-label">{term.label}</span>
          {edit ? (
            <input
              type="text"
              className="lonelog-threshold-value lonelog-threshold-input"
              aria-label={`${term.label} value`}
              value={edit.valueFor(term, 0)}
              size={Math.max(edit.valueFor(term, 0).length, 1)}
              inputMode="numeric"
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              onClick={stopEvent}
              onKeyDown={stopEvent}
              onChange={(e) => edit.onChange(term, 0, e.target.value.replace(/[^0-9]/g, ""))}
            />
          ) : (
            <span className="lonelog-threshold-value">{term.value}</span>
          )}
        </span>
      </span>
    );
  }
  return <span className={cls}>{term.text}</span>;
}

/** Per-type polyhedral silhouette (viewBox 0 0 32 32, centered on 16,16 with a
 *  wide middle so the value has room). The gross shape carries the die type. */
function dieShape(sides: number): React.ReactNode {
  switch (sides) {
    case 4:
      // Triangle, point up. Centroid sits at the box centre (base lifted off the
      // floor) so the centred digit lands in the wide middle with room around it.
      return <polygon className="lonelog-die-outline" points="16,1 30,25 2,25" />;
    case 6:
      return <rect className="lonelog-die-outline" x="3" y="4" width="26" height="24" rx="3.5" />;
    case 8:
      // Tall symmetric diamond (octahedron), full-height so it reads as large
      // as its neighbours rather than squat.
      return <polygon className="lonelog-die-outline" points="16,1 28,16 16,31 4,16" />;
    case 10:
    case 100:
      // d10 hexagonal kite: pointed top & bottom with a wide belt through the
      // middle (room for the value) + a chevron equator — the d10 tell, and
      // distinct from the flat-sided d20 hexagon.
      return (
        <>
          <polygon className="lonelog-die-outline" points="16,1 31,12 27,24 16,31 5,24 1,12" />
          <path className="lonelog-die-facet" d="M1 12 L16 18 L31 12 M16 1 V8 M16 18 V31" />
        </>
      );
    case 12:
      // Pentagon, centred and wide so its mass sits on the box centre.
      return <polygon className="lonelog-die-outline" points="16,2 30,12 24,27 8,27 2,12" />;
    case 20:
    default:
      // Hexagon (no internal facets — those read as a cube/d6).
      return <polygon className="lonelog-die-outline" points="16,2 29,9.5 29,22.5 16,30 3,22.5 3,9.5" />;
  }
}

/** Percentile dice read as the 00–99 face; a rolled 100 shows as "00". */
function dieDisplay(sides: number, value: number): string {
  if (sides === 100) return value === 100 ? "00" : String(value).padStart(2, "0");
  return String(value);
}

/** A dice modifier rendered as a spaced operation ("+ 5", "- 1"), so the sign
 *  reads as an operator on the roll rather than part of the number. */
function Modifier({ modifier }: { modifier: string }) {
  const parts = modifier.match(/[+-]\d+/g) ?? [];
  return (
    <span className="lonelog-die-op" aria-hidden="true">
      {parts.map((p, i) => (
        <span className="lonelog-die-modterm" key={i}>
          <span className="lonelog-die-sign">{p[0]}</span>
          {p.slice(1)}
        </span>
      ))}
    </span>
  );
}

/** One die silhouette with its value centered inside — static text, or an
 *  inline input when `edit` is provided. */
function DieGlyph({
  sides,
  value,
  pending,
  edit,
}: {
  sides: number;
  value?: string;
  pending?: boolean;
  edit?: { value: string; onChange: (value: string) => void };
}) {
  // Keep clicks/keys inside the input from triggering the row's scroll/select.
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  return (
    <span className={`lonelog-die-token ${pending ? "is-pending" : ""}`} data-sides={sides}>
      <svg className="lonelog-die-shape" viewBox="0 0 32 32" preserveAspectRatio="none" aria-hidden="true">
        {dieShape(sides)}
      </svg>
      {edit ? (
        <input
          type="text"
          className="lonelog-die-input"
          aria-label="Die value"
          value={edit.value}
          size={Math.max(edit.value.length, 1)}
          inputMode="numeric"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          onClick={stop}
          onKeyDown={stop}
          onChange={(e) => edit.onChange(e.target.value.replace(/[^0-9]/g, ""))}
        />
      ) : (
        // Always render a value cell (nbsp when empty) so pending and rolled dice
        // share the same baseline and line up with surrounding text.
        <span className="lonelog-die-value">{value ?? " "}</span>
      )}
    </span>
  );
}

function Die({ term, edit }: { term: DiceTerm; edit?: DieEditContext }) {
  const spec = `${term.count > 1 ? term.count : ""}d${term.sides}${term.modifier}`;
  const rolled = term.value != null;
  const label = rolled ? `${spec}, rolled ${term.value}` : `${spec}, not yet rolled`;
  const mod = term.modifier ? <Modifier modifier={term.modifier} /> : null;
  const slotEdit = (slot: number) =>
    edit ? { value: edit.valueFor(term, slot), onChange: (v: string) => edit.onChange(term, slot, v) } : undefined;

  // Percentile (d100) is two d10s rolled together: a tens and a units die.
  // Read-only they tumble/overlap; editable they sit apart so each digit input
  // is its own clear field (a rolled 100 reads as 00 — tens 0, units 0).
  if (term.sides === 100 && term.count === 1) {
    if (edit) {
      const tens = slotEdit(0)!;
      const units = slotEdit(1)!;
      return (
        <span className="lonelog-die lonelog-die--percentile is-editing">
          <DieGlyph sides={10} pending={tens.value === ""} edit={tens} />
          <DieGlyph sides={10} pending={units.value === ""} edit={units} />
          {mod}
        </span>
      );
    }
    const tens = rolled ? (term.value === 100 ? 0 : Math.floor(term.value! / 10)) : undefined;
    const units = rolled ? (term.value === 100 ? 0 : term.value! % 10) : undefined;
    return (
      <span className="lonelog-die lonelog-die--percentile" role="img" aria-label={label}>
        <DieGlyph sides={10} value={tens != null ? String(tens) : undefined} pending={!rolled} />
        <DieGlyph sides={10} value={units != null ? String(units) : undefined} pending={!rolled} />
        {mod}
      </span>
    );
  }

  // A pool (2d6) shows one die per die. Editable, each die is its own input and
  // the total is the running sum + modifier; read-only it's empty dice + total.
  if (term.count > 1) {
    if (edit) {
      const slots = Array.from({ length: term.count }, (_, i) => slotEdit(i)!);
      const combined = combineDiceSlots(
        term,
        slots.map((s) => s.value)
      );
      const total = combined !== "" ? combined : rolled ? String(term.value) : "";
      return (
        <span className="lonelog-die">
          {slots.map((s, i) => (
            <DieGlyph key={i} sides={term.sides} pending={s.value === ""} edit={s} />
          ))}
          {mod}
          {total !== "" && (
            <span className="lonelog-die-total" aria-hidden="true">
              <span className="lonelog-die-eq">=</span>
              {total}
            </span>
          )}
        </span>
      );
    }
    return (
      <span className="lonelog-die" role="img" aria-label={label}>
        {Array.from({ length: term.count }, (_, i) => (
          <DieGlyph key={i} sides={term.sides} pending={!rolled} />
        ))}
        {mod}
        {rolled && (
          <span className="lonelog-die-total" aria-hidden="true">
            <span className="lonelog-die-eq">=</span>
            {term.value}
          </span>
        )}
      </span>
    );
  }

  // A single die holds its value — editable when an edit context is provided.
  const single = slotEdit(0);
  const showPending = single ? single.value === "" : !rolled;
  // An input is interactive, so it can't sit inside a role="img" element.
  const imgProps = edit ? {} : ({ role: "img", "aria-label": label } as const);
  return (
    <span className="lonelog-die" {...imgProps}>
      <DieGlyph
        sides={term.sides}
        value={rolled ? dieDisplay(term.sides, term.value!) : undefined}
        pending={showPending}
        edit={single}
      />
      {mod}
    </span>
  );
}
