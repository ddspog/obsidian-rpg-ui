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
import type {
  Formula,
  FormulaCheck,
  FormulaTerm,
  DiceMod,
  DiceTerm,
  SumPart,
  ThresholdTerm,
} from "lib/domains/session-log/formula";
import {
  clampDiceList,
  clampDieValue,
  describeSelector,
  diceMax,
  formatDiceValue,
  contestWinner,
  generatesDice,
  liveTermValue,
  modifierTotal,
  readDiceValue,
  recordedGroups,
  resolvePool,
  rollDiceFaces,
  sumTotal,
  type SelectorNote,
} from "lib/domains/session-log/formula";
import {
  splitResultChoice,
  buildResultChoice,
  buildResultPicker,
  splitResultPicker,
  type ChoiceToken,
  type PickerToken,
} from "lib/domains/session-log/choice";

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
  /**
   * Swap an arbitrary token on the source line. Used for a sum's stored total,
   * which lives in the expression text rather than in one of its terms.
   */
  onTokenSwap?: (from: string, to: string) => void;
  /** Rolling this die also rolls the others that belong with it (a Start and its Ending). */
  rollTogether?: () => void;
}

export function FormulaView({
  formula,
  edit,
  onChoice,
  named,
}: {
  formula: Formula;
  edit?: DieEditContext;
  /** Overrides result write-back for a choice token: called with the picked
   *  option (used by the feature example to insert the generated line). */
  onChoice?: (selected: string) => void;
  /** The line is already named (a row caption such as an initiative entry's
   *  combatant), so a `[[Name]]` modifier does not label the die too — its
   *  name shows on hover only. A formula's own `Label |` counts the same. */
  named?: boolean;
}) {
  const quiet = named || !!formula.label;
  return (
    <span className="lonelog-formula">
      {/* The check's name, ahead of the dice — the same slot a die chip gives its own
          label, so a named check and a named die read as the same kind of thing. */}
      {formula.label && <span className="lonelog-roll-label lonelog-formula-label">{formula.label}</span>}
      <CheckView check={formula.check} edit={edit} quiet={quiet} />
      {formula.result != null && (
        <>
          <span className="lonelog-formula-yields" aria-hidden="true">
            →
          </span>
          <ResultView result={formula.result} edit={edit} onChoice={onChoice} />
        </>
      )}
    </span>
  );
}

/**
 * The text after `→`. When it carries a choice token (`[a/b/c - sel]`) the
 * leading text plus a dropdown of the options render; otherwise it's an
 * editable input (when editable) or static text. Picking calls `onChoice` when
 * provided (example: insert the generated line), else writes the selection back
 * through `onResultChange` (live sidebar).
 */
function ResultView({
  result,
  edit,
  onChoice,
}: {
  result: string;
  edit?: DieEditContext;
  onChoice?: (selected: string) => void;
}) {
  // The pending edit (if any) is the source of truth for the current selection.
  const text = edit?.resultValue ?? result;
  const { before, choice } = splitResultChoice(text);

  const words = splitResultPicker(text);
  if (words.picker) {
    const picker = words.picker;
    return (
      <>
        {words.before && <span className="lonelog-formula-result">{words.before}</span>}
        <WordPicker
          picker={picker}
          {...(edit?.onResultChange
            ? {
                onPick: (selected: string) =>
                  edit.onResultChange!(buildResultPicker(words.before, picker.options, selected, words.after)),
              }
            : {})}
        />
        {words.after && <span className="lonelog-formula-result">{words.after}</span>}
      </>
    );
  }

  if (choice) {
    const onPick = onChoice
      ? onChoice
      : edit?.onResultChange
        ? (selected: string) => edit.onResultChange!(buildResultChoice(before, choice.options, selected))
        : undefined;
    return (
      <>
        {before && <span className="lonelog-formula-result">{before}</span>}
        <ChoiceSelect choice={choice} onPick={onPick} />
      </>
    );
  }

  if (edit?.onResultChange) {
    const val = edit.resultValue ?? result;
    // A long result (a whole table row) wraps instead of being cut off.
    if (val.length > 28) {
      return (
        <textarea
          className="lonelog-formula-result lonelog-formula-result-input is-long"
          aria-label="Result"
          rows={1}
          value={val}
          spellCheck={false}
          onClick={stopEvent}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.preventDefault();
            stopEvent(e);
          }}
          onChange={(e) => edit.onResultChange!(e.target.value.replace(/\n/g, " "))}
        />
      );
    }
    return (
      <input
        type="text"
        className="lonelog-formula-result lonelog-formula-result-input"
        aria-label="Result"
        value={val}
        size={Math.max(val.length, 1)}
        spellCheck={false}
        onClick={stopEvent}
        onKeyDown={stopEvent}
        onChange={(e) => edit.onResultChange!(e.target.value)}
      />
    );
  }
  return <span className="lonelog-formula-result">{result}</span>;
}

/**
 * A `{a/b/c - sel}` word picker: the options as plain words, one taken at a time (tapping the taken
 * one again lets it go). It only records the pick; nothing else in the log changes with it.
 */
export function WordPicker({ picker, onPick }: { picker: PickerToken; onPick?: (selected: string) => void }) {
  const [local, setLocal] = React.useState(picker.selected);
  const value = onPick ? picker.selected : local;
  const take = (word: string) => {
    const next = word === value ? "" : word;
    if (onPick) onPick(next);
    else setLocal(next);
  };
  return (
    <span className={`lonelog-picker${value ? " has-pick" : ""}`} role="radiogroup" aria-label="Pick one">
      {picker.options.map((word) => (
        <button
          key={word}
          type="button"
          role="radio"
          aria-checked={word === value}
          className={`lonelog-picker-word${word === value ? " is-picked" : ""}`}
          onClick={(e) => {
            stopEvent(e);
            take(word);
          }}
          onKeyDown={stopEvent}
        >
          {word}
        </button>
      ))}
    </span>
  );
}

/**
 * A line whose content is JUST a choice token (`[a/b/c - sel]`) — a generator
 * step where the GM PICKS rather than rolls (`GMGenStep.choices`), so there's no
 * die and `parseFormula` yields nothing. Renders the leading text plus the same
 * dropdown a rolled result's choice uses. Null when the text carries no token,
 * so the caller can fall back to plain markdown.
 */
export function ChoiceOnlyView({
  text,
  onChoice,
  onResultChange,
}: {
  text: string;
  onChoice?: (selected: string) => void;
  onResultChange?: (value: string) => void;
}): React.ReactElement | null {
  const { before, choice } = splitResultChoice(text);
  if (!choice) return null;
  const onPick = onChoice
    ? onChoice
    : onResultChange
      ? (selected: string) => onResultChange(buildResultChoice(before, choice.options, selected))
      : undefined;
  return (
    <>
      {before && <span className="lonelog-formula-result">{before}</span>}
      <ChoiceSelect choice={choice} onPick={onPick} />
    </>
  );
}

/** A `[a/b/c - sel]` choice rendered as a quiet inline dropdown that hugs its
 *  current selection. A transparent native `<select>` overlays the visible
 *  label, so it stays a real keyboard-operable control with the native option
 *  list while the label sizes to the selection (not the longest option). With
 *  `onPick` the selection writes back to the log line; without it (read-only
 *  example) the pick is local. */
export function ChoiceSelect({ choice, onPick }: { choice: ChoiceToken; onPick?: (selected: string) => void }) {
  const [local, setLocal] = React.useState(choice.selected);
  const value = onPick ? choice.selected : local;
  return (
    <span className={`lonelog-choice${value ? "" : " is-empty"}`}>
      <span className="lonelog-choice-label" aria-hidden="true">
        {value || "pick"}
      </span>
      <svg className="lonelog-choice-caret" viewBox="0 0 10 6" aria-hidden="true">
        <path d="M1 1 L5 5 L9 1" />
      </svg>
      <select
        className="lonelog-choice-native"
        aria-label="Follow-up strategy"
        value={value}
        onClick={stopEvent}
        onKeyDown={stopEvent}
        onChange={(e) => {
          const v = e.target.value;
          if (onPick) onPick(v);
          else setLocal(v);
        }}
      >
        <option value="">pick</option>
        {choice.options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </span>
  );
}

/**
 * Several dice summed (`d8+d6+2=13`). Each die renders as its own badge joined by
 * its operator; only the TOTAL was recorded, so it carries the value and the
 * dice stay unrolled. Editing the total writes back through the result path.
 */
function SumView({ check, edit }: { check: Extract<FormulaCheck, { kind: "sum" }>; edit?: DieEditContext }) {
  const dice = check.parts.filter((p): p is SumPart & { term: DiceTerm } => p.term.kind === "dice");
  // Read each die as the interface HAS IT, not as the file holds it: a roll is a
  // pending edit until it is saved, so summing the parsed terms showed a total for
  // the dice as they were before the roll — the chips updated and the total did not.
  const valueOf = (term: DiceTerm) => liveTermValue(term, edit?.valueFor);
  const allRolled = dice.length > 0 && dice.every((p) => valueOf(p.term) != null);
  // Derive the total once every die is in — a STORED total can drift after a
  // reroll, a derived one cannot.
  const computed = allRolled ? sumTotal(check.parts, valueOf) : check.total;
  const rollAll = edit
    ? () => {
        const rolled = dice.map((p) => {
          const roll = rollDiceFaces(p.term);
          const pool = resolvePool(roll.first, roll.extra, p.term.selector);
          return { part: p, roll, value: pool.reduce((a: number, b: number) => a + b, 0) };
        });
        // A pool records every face (`[4,3]`); dice a special generated go in a
        // second list; a single die records its face.
        for (const r of rolled) edit.onChange(r.part.term, 0, formatDiceValue(r.part.term, r.roll));
        // Keep the stored total in step with the dice that just changed.
        if (edit.onTokenSwap && check.total != null) {
          const next = sumTotal(
            check.parts.map((p) => {
              const hit = rolled.find((r) => r.part === p);
              return hit && p.term.kind === "dice" ? { ...p, term: { ...p.term, value: hit.value } } : p;
            })
          );
          edit.onTokenSwap(`=${check.total}`, `=${next}`);
        }
      }
    : undefined;
  return (
    <span className="lonelog-sum">
      {check.parts.map((part, i) => (
        <React.Fragment key={i}>
          {part.op && <span className="lonelog-sum-op">{part.op}</span>}
          {part.term.kind === "dice" ? (
            <Die term={part.term} edit={edit} label={part.label} />
          ) : (
            <span className="lonelog-sum-const">{part.term.kind === "text" ? part.term.text : part.term.raw}</span>
          )}
        </React.Fragment>
      ))}
      {/* The EXPRESSION pill joins the dice into one formula and registers its
          result. Its button rerolls EVERY die: that is the expression's action,
          distinct from rolling one die. */}
      <span className={`lonelog-expr${computed == null ? " is-unrolled" : ""}`}>
        {rollAll ? (
          <button
            type="button"
            className="lonelog-expr-roll"
            title="Roll every die in this expression"
            onClick={(e) => {
              e.stopPropagation();
              rollAll();
            }}
            onKeyDown={stopEvent}
          >
            =
          </button>
        ) : (
          <span className="lonelog-expr-eq" aria-hidden="true">
            =
          </span>
        )}
        <span className="lonelog-expr-total">{computed ?? <span className="lonelog-roll-empty">roll</span>}</span>
      </span>
    </span>
  );
}

function CheckView({ check, edit, quiet }: { check: FormulaCheck; edit?: DieEditContext; quiet?: boolean }) {
  if (check.kind === "single") return <TermView term={check.term} state="neutral" edit={edit} quiet={quiet} />;
  if (check.kind === "sum") return <SumView check={check} edit={edit} />;
  // Recomputed from the values the interface has, so rolling a contest moves the
  // emphasis to the side that now leads instead of the side that led on disk.
  const winner = contestWinner(check.left, check.right, edit?.valueFor) ?? check.winner;
  const leftState = winner === "left" ? "winner" : winner ? "loser" : "neutral";
  const rightState = winner === "right" ? "winner" : winner ? "loser" : "neutral";
  return (
    <span className="lonelog-contest">
      <TermView term={check.left} state={leftState} edit={edit} quiet={quiet} />
      <span className="lonelog-contest-vs">vs</span>
      <TermView term={check.right} state={rightState} edit={edit} quiet={quiet} />
    </span>
  );
}

type TermState = "winner" | "loser" | "neutral";

function TermView({
  term,
  state,
  edit,
  quiet,
}: {
  term: FormulaTerm;
  state: TermState;
  edit?: DieEditContext;
  quiet?: boolean;
}) {
  const cls = `lonelog-term is-${state}`;
  if (term.kind === "dice") {
    return (
      <span className={cls}>
        <Die term={term} edit={edit} quiet={quiet} />
      </span>
    );
  }
  if (term.kind === "threshold") {
    return (
      <span className={cls}>
        <span
          className={`lonelog-threshold${term.inferred ? " is-inferred" : ""}`}
          title={term.inferred ? `Current ${term.label}, from the log` : undefined}
        >
          <span className="lonelog-threshold-label">{term.label}</span>
          {edit && !term.inferred ? (
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
export function dieShape(sides: number): React.ReactNode {
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

/**
 * Opens a chip's expanded layer while it is pointed at or holds focus, and reports
 * where to put that layer.
 *
 * The layer is `position: fixed` so no ancestor's `overflow` can clip it, and it is
 * placed from the measured rect of the collapsed view it replaces — a fixed box
 * with auto offsets takes its static position in DOCUMENT coordinates, which on a
 * scrolled page lands it a screenful away.
 *
 * Those offsets are NOT necessarily viewport-relative though: any ancestor with
 * containment or a transform becomes the containing block for a fixed child, and
 * Obsidian's workspace leaf uses `contain: strict`. Rather than guess which
 * ancestor wins, a zero-size fixed PROBE pinned at 0,0 reports where this layer's
 * origin actually is, and that origin is subtracted. Correct under any ancestor.
 */
function useExpandOnPoint() {
  const anchorRef = React.useRef<HTMLSpanElement | null>(null);
  const originRef = React.useRef<HTMLSpanElement | null>(null);
  const [pointed, setPointed] = React.useState(false);
  const [held, setHeld] = React.useState(false);
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null);
  const open = pointed || held;

  const measure = React.useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    // The probe shares the layer's containing block, so its rect IS that block's
    // origin — whether that is the viewport or a contained ancestor.
    const o = originRef.current?.getBoundingClientRect();
    // Anchored to the WHOLE collapsed chip's left edge and vertical centre. Anchoring
    // to the number instead left the label outside the opaque layer, so an expanded
    // pill appeared to have lost the very thing that says which roll it is.
    setPos({ top: (r.top + r.bottom) / 2 - (o?.top ?? 0), left: r.left - (o?.left ?? 0) });
  }, []);

  // Layout effect, not a plain one: measuring after paint would show one frame of
  // the layer at a stale position.
  React.useLayoutEffect(() => {
    if (!open) return;
    measure();
    const track = () => measure();
    // `capture` so scrolling ANY ancestor (the Log sidebar included) is caught —
    // scroll events on elements do not bubble.
    window.addEventListener("scroll", track, true);
    window.addEventListener("resize", track);
    return () => {
      window.removeEventListener("scroll", track, true);
      window.removeEventListener("resize", track);
    };
  }, [open, measure]);

  const handlers = {
    onMouseEnter: () => setPointed(true),
    onMouseLeave: () => setPointed(false),
    onFocus: () => setHeld(true),
    // Focus moving between the roll button and the result input must not close the
    // layer, so only focus leaving the chip entirely counts.
    onBlur: (e: React.FocusEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHeld(false);
    },
  };

  return { open, anchorRef, originRef, layerPos: pos ?? undefined, handlers };
}

/**
 * The shared roll chip, in two views of the same roll.
 *
 *   idle, rolled     LABEL │ 7ᐟ            ← the number, with a small die raised
 *   hovered          LABEL │ ²d₆ ┆ 7       ← the expression, and the roll button
 *   idle, unrolled   LABEL │ ²d₆
 *
 * A result is the FACT; the notation is reference. So a rolled chip shows only
 * its number, and pointing at it lifts the full expression over the neighbouring
 * pills. Clicking the expression rerolls; the result itself stays typeable.
 *
 * The collapsed view is the one in flow, so revealing the expression never
 * changes the line's width or height — the expanded layer floats.
 */
export function DieChip({
  sides,
  sidesLabel,
  value,
  recorded,
  label,
  count,
  specials,
  generates,
  modifier,
  mods,
  title,
  edit,
  onRoll,
  result,
}: {
  /** Side count used for the SHAPE (a `d%` uses the d100 kite). */
  sides: number;
  /** Sides as authored (`20`, `%`, `F.2`) — the subscript. */
  sidesLabel: string;
  /** What the COLLAPSED view shows: one number, the roll's outcome. */
  value?: string;
  /** With a named modifier shown, the result it comes to (`7 +4 = 11`). */
  result?: string;
  /**
   * What the EXPANDED view shows and edits: exactly what the log records, which for
   * a pool is every die (`[6,2,2]`). Defaults to `value` for dice that record a
   * single number. Collapsed reads the outcome; expanded reads the dice.
   */
  recorded?: string;
  label?: string;
  count?: number;
  /** The `<special>`, already named — shown as marks collapsed and as words
   *  expanded, because a selector that only appears on hover is a rule the reader
   *  cannot see when it matters. */
  specials?: SelectorNote[];
  /** Whether this roll's `<special>` can produce dice of its own, which get their
   *  own list to be recorded in. */
  generates?: boolean;
  modifier?: string;
  /** The modifier term by term, when it names something (`+[[Insight]]`) —
   *  rendered with each name's resolved value instead of the raw text. */
  mods?: Array<DiceMod & { caption?: boolean }>;
  title?: string;
  /** Makes the recorded value typeable, so every die of a pool can be entered. */
  edit?: { onChange: (value: string) => void; max?: number };
  /** When set, the die becomes a button that rolls and records a result. */
  onRoll?: () => void;
}) {
  const shown = value ?? "";
  // The expanded view shows what is RECORDED, down to each die; only the collapsed
  // view summarises.
  const detail = recorded ?? shown;
  // A recorded list keeps its brackets OUT of the editable text: they are notation
  // the chip draws, so they cannot be deleted by mistake, and what is typed is only
  // ever the dice inside them.
  const asList = detail.startsWith("[");
  const groups = recordedGroups(detail);
  // The dice thrown, then the dice those generated. The second field appears for any
  // roll that CAN generate, so an exploding roll made on the table can be entered in
  // full rather than crammed into one list.
  const fields = asList ? [groups[0] ?? "", ...(generates || groups.length > 1 ? [groups[1] ?? ""] : [])] : [detail];
  const writeField = (i: number, text: string) => {
    if (!edit) return;
    const next = [fields[0] ?? "", fields[1] ?? ""];
    next[i] = clampDiceList(text, sides);
    edit.onChange(next[1] ? `[${next[0]}][${next[1]}]` : `[${next[0]}]`);
  };
  // Unrolled is its own STATE, not an empty one: there is no number to show, so
  // the chip rests on its notation instead.
  const unrolled = shown === "";
  const { open, anchorRef, originRef, layerPos, handlers } = useExpandOnPoint();
  // `2d6` is ONE notation: the count, the silhouette and the side count belong to
  // the same die, so they live in the same element. That makes the whole notation
  // the hit target, and hover / focus reaches all three at once — a highlight that
  // covered only part of it would suggest only that part was clickable.
  const expr = (
    <>
      <span className="lonelog-roll-die">
        {count != null && count > 1 && <span className="lonelog-roll-count">{count}</span>}
        <svg className="lonelog-roll-mark" viewBox="0 0 32 32" preserveAspectRatio="xMidYMid meet" focusable="false">
          {dieShape(sides)}
        </svg>
        <span className="lonelog-roll-sides">{sidesLabel}</span>
      </span>
      {specials?.map((sp) => (
        <span className="lonelog-roll-special" key={sp.label} title={sp.description}>
          <span className="lonelog-roll-special-mark" aria-hidden="true">
            {sp.symbol}
          </span>
          <span className="lonelog-roll-special-name">{sp.label}</span>
        </span>
      ))}
      {mods ? <ModList mods={mods} /> : modifier && <span className="lonelog-roll-mod">{modifier}</span>}
    </>
  );
  return (
    <span
      className={`lonelog-roll-chip${unrolled ? " is-unrolled" : " is-rolled"}${onRoll ? " is-rollable" : ""}${
        open ? " is-open" : ""
      }`}
      {...handlers}
      ref={anchorRef}
    >
      {label && <span className="lonelog-roll-label">{label}</span>}
      <span className="lonelog-roll-body">
        {/* Zero-size, pinned at 0,0: reports where a fixed child's coordinates
            actually start in this document. See `useExpandOnPoint`. */}
        <span className="lonelog-roll-origin" aria-hidden="true" ref={originRef} />
        {/* The collapsed view. It SIZES the chip and is never a click target, so
            the expanded layer above it takes every interaction. Hidden from
            assistive tech, which reads the expanded layer's real controls. */}
        <span className="lonelog-roll-brief" aria-hidden="true" title={title}>
          {unrolled ? (
            expr
          ) : (
            <>
              <span className="lonelog-roll-value">{shown}</span>
              {/* The die and its `<special>` share ONE column after the number: the
                  die raised like a superscript, the marks dropped like a subscript.
                  Both are notes ON the number, so they read as one annotation rather
                  than a row of glyphs trailing off to the right.
                  The marks stay with the number because a 19 taken with advantage is
                  a different fact from a 19, and this is the view the log is read in. */}
              <span className="lonelog-roll-affix">
                <svg
                  className="lonelog-roll-brief-die"
                  viewBox="0 0 32 32"
                  preserveAspectRatio="xMidYMid meet"
                  focusable="false"
                >
                  {dieShape(sides)}
                </svg>
                {specials && specials.length > 0 && (
                  <span className="lonelog-roll-flags">
                    {specials.map((sp) => (
                      <span className="lonelog-roll-flag" key={sp.label}>
                        {sp.mark}
                      </span>
                    ))}
                  </span>
                )}
              </span>
              {/* A named modifier's value stays in view (`11 +3` for an Insight
                  check), so the collapsed roll still shows what it added. */}
              {mods?.some((m) => m.name != null && m.value != null) && (
                <span className="lonelog-roll-brief-mods">
                  {mods
                    .filter((m) => m.value != null)
                    .map((m) => signed(m.sign === "-" ? -m.value! : m.value!))
                    .join(" ")}
                </span>
              )}
              {result != null && <span className="lonelog-roll-brief-total">= {result}</span>}
            </>
          )}
        </span>
        {/* The expanded layer: the expression, then what it rolled. Out of flow, so
            it costs the row nothing and can overlap its neighbours. */}
        <span className="lonelog-roll-full" style={layerPos}>
          {/* The label again: expanded, the pill has to say which roll it is on its
              own, since it covers the collapsed one it grew out of. */}
          {label && <span className="lonelog-roll-label">{label}</span>}
          {onRoll ? (
            <button
              type="button"
              className="lonelog-roll-expr lonelog-roll-expr--btn"
              title={`${title ? `${title} — ` : ""}click to reroll`}
              onClick={(e) => {
                e.stopPropagation();
                onRoll();
              }}
              onKeyDown={stopEvent}
            >
              {expr}
            </button>
          ) : (
            <span className="lonelog-roll-expr" title={title}>
              {expr}
            </span>
          )}
          {/* The result: typeable even while the expression is rollable, so a die
              rolled on the table can be entered by hand. */}
          {(edit || !unrolled) && (
            <>
              <span className="lonelog-roll-sep" aria-hidden="true" />
              {edit ? (
                <span className="lonelog-roll-field">
                  {fields.map((text, i) => (
                    <span className={`lonelog-roll-group${i > 0 ? " is-generated" : ""}`} key={i}>
                      {asList && (
                        <span className="lonelog-roll-bracket" aria-hidden="true">
                          [
                        </span>
                      )}
                      <input
                        type="text"
                        className="lonelog-roll-value lonelog-roll-value--input"
                        aria-label={
                          !asList ? (title ?? "Roll value") : i === 0 ? "Dice rolled" : "Dice these generated"
                        }
                        value={text}
                        // Room for what is actually in the field — a pool's dice are
                        // wider than any single number.
                        size={Math.max(text.length, String(Number.isFinite(edit.max) ? edit.max : sides).length, 1)}
                        placeholder="·"
                        inputMode="numeric"
                        spellCheck={false}
                        onClick={stopEvent}
                        onKeyDown={stopEvent}
                        // In a list every entry is one die, so each is clamped to a
                        // real face; a lone value is the whole roll and clamps to its
                        // ceiling (`max` covers slots whose range is not the faces).
                        onChange={(e) =>
                          asList
                            ? writeField(i, e.target.value)
                            : edit.onChange(clampDieValue(e.target.value, edit.max ?? sides))
                        }
                      />
                      {asList && (
                        <span className="lonelog-roll-bracket" aria-hidden="true">
                          ]
                        </span>
                      )}
                    </span>
                  ))}
                </span>
              ) : (
                <span className="lonelog-roll-value">{detail}</span>
              )}
            </>
          )}
        </span>
      </span>
    </span>
  );
}

/** The sides as authored, taken from the die spec (`4dF.2` → `F.2`). */
function sidesLabelOf(term: DiceTerm): string {
  const m = term.spec.match(/d(.+)$/i);
  return m ? m[1] : String(term.sides);
}

/**
 * A die's modifier read term by term: a number stays a number, and a named term
 * (`+[[Insight]]`) shows the actor's value with the name as its caption —
 * `+3 INSIGHT`, the way `DC 10` pairs a label with its number. A name the
 * actor has no value for shows on its own, so the gap is visible.
 */
const signed = (n: number) => (n < 0 ? `\u2212${-n}` : `+${n}`);

function ModList({ mods }: { mods: Array<DiceMod & { caption?: boolean }> }) {
  return (
    <span className="lonelog-roll-mod">
      {mods.map((m, i) =>
        m.name == null ? (
          <span key={i}>{`${m.sign}${m.value}`}</span>
        ) : (
          <span
            key={i}
            className={`lonelog-roll-mod-ref${m.value == null ? " is-unresolved" : ""}`}
            title={m.value == null ? `${m.name}: no value for this actor` : `${m.name} modifier`}
          >
            {m.value == null ? (
              // Unknown value: the name says what is missing — unless the chip's
              // label already says it, where a `?` marks the gap instead.
              m.caption === false ? (
                `${m.sign}?`
              ) : (
                m.sign
              )
            ) : (
              <span className="lonelog-roll-mod-value">{signed(m.sign === "-" ? -m.value : m.value)}</span>
            )}
            {m.caption !== false && <span className="lonelog-roll-mod-name">{m.name}</span>}
          </span>
        )
      )}
    </span>
  );
}

/**
 * A formula's die, rendered as the shared chip.
 *
 * A POOL records every die it rolled (`2d6=[4,3]`) so the log stays auditable,
 * but shows their SUM: one number for one roll. That sum is derived, so it is
 * displayed rather than typed — rolling is how a pool changes. A single die keeps
 * its editable value, since there the recorded number IS the face.
 */
function Die({
  term,
  edit,
  label,
  quiet,
}: {
  term: DiceTerm;
  edit?: DieEditContext;
  label?: string;
  /** The line is named elsewhere: keep `[[Name]]` modifiers off the label. */
  quiet?: boolean;
}) {
  const spec = `${term.spec}${term.selector}${term.modifier}`;
  // A named modifier says what the roll IS (`d20+[[Insight]]` is an Insight
  // check), and the collapsed chip shows only the number — so the name becomes
  // the chip's label, the one part that is always visible. An authored label
  // still wins. With a single name, the expanded view drops it from the
  // modifier (the label already says it); several keep theirs, so each value
  // stays matched to its name.
  const named = (term.mods ?? []).filter((m) => m.name != null);
  const derived = label == null && !quiet && named.length > 0;
  const shownLabel = label ?? (derived ? named.map((m) => m.name).join(" + ") : undefined);
  const mods =
    term.mods && derived && named.length === 1
      ? term.mods.map((m) => (m.name != null ? { ...m, caption: false } : m))
      : term.mods;
  // The pending edit wins over the parsed term, so a chip shows the roll that
  // was just made rather than the one still saved on disk.
  const recorded = edit ? edit.valueFor(term, 0) : term.value != null ? String(term.value) : "";
  // Read through the TERM, so its `<special>` decides which dice count. Summing the
  // text on its own made `2d20kh1=[19,4]` read 23 instead of 19.
  const { value, values, extra } = readDiceValue(term, recorded);
  // The roll's RESULT — its dice and its modifier — is what the collapsed chip
  // shows; a named modifier keeps its arithmetic in view (`7 +4 = 11`).
  const shift = modifierTotal(term.modifier, term.mods);
  const result = value == null ? null : shift != null ? value + shift : value;
  const showsArithmetic = (term.mods ?? []).some((m) => m.name != null && m.value != null);
  const specials = describeSelector(term);
  const how = specials.length ? ` (${specials.map((sp) => sp.description).join("; ")})` : "";
  const thrown = values.join(", ") + (extra.length ? `, then ${extra.join(", ")}` : "");
  const title =
    value == null
      ? `${spec}, not yet rolled${how}`
      : values.length > 1 || extra.length
        ? `${spec}, rolled ${thrown} → ${result}${how}`
        : `${spec}${term.modifier}, rolled ${value}${result !== value ? ` → ${result}` : ""}${how}`;
  // Typing a result is always available, pools included: a total entered by hand
  // replaces the recorded list (`2d6=11`), because a sum somebody typed is not a
  // set of dice. Rolling puts the list back. The chip shows the SUM either way —
  // `recorded` is the write-back text, never the display.
  const slotEdit = edit ? { onChange: (v: string) => edit.onChange(term, 0, v), max: diceMax(term) } : undefined;
  // Rollable only where an edit can be written back: a `gen:` working line has a
  // source line; a read-only showcase row does not.
  const onRoll = edit
    ? () => {
        edit.onChange(term, 0, formatDiceValue(term, rollDiceFaces(term)));
        edit.rollTogether?.();
      }
    : undefined;
  return (
    <span className="lonelog-die">
      <DieChip
        label={shownLabel}
        sides={term.sides}
        sidesLabel={sidesLabelOf(term)}
        value={value == null ? "" : String(showsArithmetic ? value : result)}
        {...(showsArithmetic && result != null && result !== value ? { result: String(result) } : {})}
        recorded={recorded}
        count={term.count}
        specials={specials}
        generates={generatesDice(term.selector)}
        modifier={term.modifier}
        mods={mods}
        title={title}
        edit={slotEdit}
        onRoll={onRoll}
      />
    </span>
  );
}
