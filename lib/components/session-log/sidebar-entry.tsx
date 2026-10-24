/**
 * Sidebar entry — the shared renderer for one mechanical lonelog entry.
 *
 * Renders a `SidebarItem` as the small icon | content | dateline table used in
 * the Log sidebar. Extracted so the same markup (and therefore the same dice
 * glyphs, formula contests, datelines, and icons) renders both in the live Log
 * sidebar and in a feature's read-only "Example" showcase.
 *
 * Pass an `edit` context to make dice / thresholds / scene lines editable (the
 * live sidebar). Omit it for a static, read-only render (the example) — dice
 * render as fixed glyphs and scene lines as plain text.
 */

import * as React from "react";
import { Lucide } from "lib/ui/primitives/Lucide";
import { ActorPill } from "./action-call";
import { InlineMarkdown } from "./inline-markdown";
import { ChoiceOnlyView, ChoiceSelect, DieChip, FormulaView, type DieEditContext } from "./formula";
import {
  combineTermValue,
  editableTerms,
  parseFormulaLine,
  rollDie,
  termSlotInitial,
  termSlots,
} from "lib/domains/session-log/formula";
import { splitResultChoice } from "lib/domains/session-log/choice";
import type { ConditionChange } from "lib/domains/session-log/conditions";
import type { RoundEconomy } from "lib/domains/session-log/round-economy";
import { ListSheetModal } from "./list-sheet-modal";
import { TableRollContext } from "./table-roll-context";
import { dieEditKey, resultEditKey } from "lib/domains/session-log/prose-model";
import type { SidebarItem, SidebarRow, RowIcon, SceneRowData, SidebarPill } from "lib/domains/session-log/prose-model";
import type { ChoiceAt } from "lib/domains/session-log/choice";

export interface SceneEditValue {
  number: string;
  name: string;
}

/** Write-back wiring that makes an entry's values editable (live sidebar only). */
export interface SidebarEditContext {
  dieEdits: Record<string, string>;
  onDieChange: (source: string, raw: string, slot: number, value: string) => void;
  onResultChange: (source: string, value: string) => void;
  /** Scene-line editing — optional. When omitted, scene rows render read-only
   *  (the feature example edits dice but not scenes). */
  sceneEdits?: Record<string, SceneEditValue>;
  onSceneChange?: (original: string, next: SceneEditValue) => void;
  /** Swap one token on a source line (`[Characters@]` → `[Characters@ Bertha]`)
   *  — powers the list picker and its dice. `nth` names WHICH occurrence of a
   *  repeated line to edit. Omitted in read-only renders. */
  onTokenChange?: (source: string, from: string, to: string, nth: number) => void;
}

/** True when a detail row carries a formula with at least one editable term. */
export function hasEditableValue(rows: SidebarRow[]): boolean {
  return rows.some((row) => {
    if (!(row.detail || row.rollable) || !row.source) return false;
    // Every formula on the line, so a party roll counts as editable as any other.
    return (parseFormulaLine(row.content) ?? []).some((f) => editableTerms(f).length > 0);
  });
}

function RowIconView({ icon }: { icon: RowIcon }) {
  if (!icon) return null;
  if ("glyph" in icon) return <span className="lonelog-row-glyph">{icon.glyph}</span>;
  const Comp = (Lucide as unknown as Record<string, React.ComponentType<{ size?: number; className?: string }>>)[
    icon.lucide
  ];
  return Comp ? <Comp size={15} className="lonelog-row-lucide" /> : null;
}

/** A foe's health as of this entry — `HP 19/26 · surprised`, or its end state — shown on hover. */
function FoeHealth({ foe }: { foe: { current?: number; max?: number; state?: string; conditions?: string[] } }) {
  const hp =
    foe.current != null
      ? `HP ${foe.current}${foe.max != null ? `/${foe.max}` : ""}`
      : foe.max != null
        ? `HP ${foe.max}`
        : "";
  const text = [hp, ...(foe.conditions ?? []), foe.state].filter(Boolean).join(" · ");
  if (!text) return null;
  const down = foe.state != null || foe.current === 0;
  return <span className={`lonelog-foe-health${down ? " is-down" : ""}`}>{text}</span>;
}

/**
 * An entry's tags as a typographic "dateline" run: each tag is a muted
 * small-caps key (tinted by category) followed by its emphasized value.
 */
function TagStrip({ tags, edit }: { tags: SidebarPill[]; edit?: SidebarEditContext }) {
  return (
    <span className="lonelog-tag-strip">
      {tags.map((tag, i) => {
        // A consult pill (`[Characters?]`) is PICKABLE: the reader can override
        // the rolled entry, which is written back into the token as `?= entry`.
        const pickable = tag.options && tag.options.length > 0 && tag.source && tag.token && edit?.onTokenChange;
        return (
          /* Three sections: NAME | DICE | VALUES. Each is present only when it
             has something to say, so an add pill is name + values while a draw
             is all three. */
          <span key={i} className={`lonelog-tag kind-${tag.kind}`}>
            <span className="lonelog-tag-name">
              {tag.sheet ? (
                // The list name opens the printed sheet — which rolls land
                // where, and how a repeated entry occupies several slots.
                <button
                  type="button"
                  className="lonelog-tag-key lonelog-tag-key--sheet"
                  title={`Show the ${tag.name} sheet`}
                  onClick={(e) => {
                    e.stopPropagation();
                    const app = (globalThis as unknown as { app?: unknown }).app;
                    if (app) new ListSheetModal(app as never, tag.sheet!.decl, tag.sheet!.entries).open();
                  }}
                >
                  {tag.name}
                </button>
              ) : (
                <span className="lonelog-tag-key">{tag.name}</span>
              )}
            </span>

            {tag.dice && tag.dice.length > 0 && (
              <span className="lonelog-tag-dice">
                {tag.dice.map((d, j) => {
                  // Editing a roll rewrites the whole token, so every value is
                  // sent together — the others keep what they had.
                  const write = (raw: string) => {
                    const next = tag.dice!.map((o, k) => (k === j ? (raw === "" ? undefined : Number(raw)) : o.value));
                    // Positional: the log records WHAT was rolled, never which die.
                    const spec = tag.dice!.map((_o, k) => `r${k + 1}=${next[k] ?? ""}`).join(" ");
                    edit!.onTokenChange!(tag.source!, tag.token!, `[${tag.name}@ ${spec}]`, tag.sourceNth ?? 0);
                  };
                  const editable = tag.source && tag.token && edit?.onTokenChange;
                  const shown = d.value != null ? String(d.value) : "";
                  const role = d.label === "sec" ? "Section" : "Row";
                  return (
                    <DieChip
                      key={`d${j}`}
                      sides={d.sides}
                      sidesLabel={String(d.sides)}
                      label={d.label}
                      value={shown}
                      // Parenthesised, so appending "— click to reroll" does not read
                      // as a sentence with two dashes in it.
                      title={`${role} roll (d${d.sides})`}
                      edit={editable ? { onChange: write, max: d.sides } : undefined}
                      // The section and row dice reroll like any other: the draw is
                      // two rolls, so each is thrown on its own rather than as a pair.
                      onRoll={editable ? () => write(String(rollDie(d.sides))) : undefined}
                    />
                  );
                })}
              </span>
            )}

            {(tag.value || pickable) && (
              <span className="lonelog-tag-values">
                {pickable ? (
                  // Same quiet inline control a follow-up choice uses: a label
                  // that sizes to the selection, not a boxed <select>.
                  <ChoiceSelect
                    choice={{ options: tag.options!, selected: tag.value ?? "", raw: tag.token! }}
                    onPick={(picked) =>
                      edit!.onTokenChange!(tag.source!, tag.token!, `[${tag.name}@ ${picked}]`, tag.sourceNth ?? 0)
                    }
                  />
                ) : (
                  tag.value && <span className="lonelog-tag-val">{tag.value}</span>
                )}
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

function SceneEditor({
  scene,
  value,
  onChange,
}: {
  scene: SceneRowData;
  value: SceneEditValue;
  onChange: (original: string, next: SceneEditValue) => void;
}) {
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  return (
    <span className="lonelog-scene-edit">
      {"Start Scene("}
      <input
        type="text"
        className="lonelog-scene-input lonelog-scene-num"
        aria-label="Scene number"
        value={value.number}
        size={Math.max(value.number.length, 1)}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        onClick={stop}
        onKeyDown={stop}
        onChange={(e) => onChange(scene.original, { number: e.target.value, name: value.name })}
      />
      {"): “"}
      <input
        type="text"
        className="lonelog-scene-input lonelog-scene-name"
        aria-label="Scene name"
        value={value.name}
        size={Math.max(value.name.length, 1)}
        onClick={stop}
        onKeyDown={stop}
        onChange={(e) => onChange(scene.original, { number: value.number, name: e.target.value })}
      />
      {"”"}
    </span>
  );
}

function RowContent({
  row,
  sourcePath,
  edit,
  onChoice,
}: {
  row: SidebarRow;
  sourcePath: string;
  edit?: SidebarEditContext;
  onChoice?: (selected: string, at?: ChoiceAt) => void;
}) {
  const tableRoll = React.useContext(TableRollContext);
  // A pick says which line's dropdown it is, so its own generator is the one rewritten.
  const pick = onChoice
    ? (selected: string) => onChoice(selected, row.source ? { source: row.source, nth: row.sourceNth ?? 0 } : undefined)
    : undefined;
  if (row.scene) {
    // Read-only: render the scene line as plain text. Editable (live sidebar):
    // inline inputs, only when an onSceneChange handler is wired.
    if (!edit?.onSceneChange) return <InlineMarkdown source={row.content} sourcePath={sourcePath} />;
    const value = edit.sceneEdits?.[row.scene.original] ?? { number: row.scene.number, name: row.scene.name };
    return <SceneEditor scene={row.scene} value={value} onChange={edit.onSceneChange} />;
  }
  if (row.detail) {
    // A line can hold SEVERAL checks — a party roll, one per character. A single one
    // keeps the path it always had, so nothing about an ordinary row changes.
    const formulas = parseFormulaLine(row.content, { vars: row.vars, refs: row.refs });
    const formula = formulas?.length === 1 ? formulas[0] : null;
    const party = formulas && formulas.length > 1 ? formulas : null;
    const source = row.source;
    // A dieless line whose content is just a `[a/b/c - ]` token is a GM-picks
    // step (`GMGenStep.choices`) — no formula, but it still renders a dropdown
    // rather than literal text. Tested on the TOKEN, not on the element (a JSX
    // element is always truthy, so it can't be used as a `??` fallback).
    const hasChoice = !formula && !party && splitResultChoice(row.content).choice != null;
    // A table roll with no result yet reads its row as soon as the die shows a
    // value, pending or saved, so the outcome appears before the Log is saved.
    // The die a row shows, pending or saved: what its first dice term reads.
    const dieValue = (src: string, content: string): number | undefined => {
      if (!edit) return undefined;
      const f = parseFormulaLine(content, { vars: row.vars, refs: row.refs })?.[0];
      const term = f && editableTerms(f).find((t) => t.kind === "dice");
      if (!term) return undefined;
      const slots = Array.from(
        { length: termSlots(term) },
        (_, i) => edit.dieEdits[dieEditKey(src, term.raw, i)] ?? termSlotInitial(term, i)
      );
      const n = Number(combineTermValue(term, slots));
      return Number.isFinite(n) && n > 0 ? n : undefined;
    };
    const REF = /@?\[\[[^\]\n]+\]\](?:#[\w./-]+)?/;
    // A name's second roll: the rows of its parts, what their dice show, and its own die.
    const pickPreview = (): string | undefined => {
      if (!tableRoll || row.pick == null || !row.pickFrom?.length) return undefined;
      const refs = row.pickFrom.map((f) => f.source.match(REF)?.[0] ?? "");
      const rolls = row.pickFrom.map((f) => dieValue(f.source, f.content));
      if (!refs[0] || refs.some((r) => !r) || rolls.some((n) => n == null)) return undefined;
      const ref = refs[0];
      const own = row.pickOnly || !source || !formula ? undefined : dieValue(source, row.content);
      if (!row.pickOnly && own == null) return undefined;
      return tableRoll(ref, 0, { spec: row.pick, rolls: rolls as number[], refs, roll: own });
    };
    // A table roll with no result yet reads its row as soon as the die shows a
    // value, pending or saved, so the outcome appears before the Log is saved.
    const rollPreview = (): string | undefined => {
      if (!tableRoll || !edit || !source || !formula || formula.result == null || formula.result.trim() !== "")
        return undefined;
      if (row.pick != null) return pickPreview();
      // The ref is hidden from `content` on a word-pair row; `source` keeps the raw line.
      const ref = source.match(REF)?.[0];
      const n = ref ? dieValue(source, row.content) : undefined;
      if (!ref || n == null) return undefined;
      return tableRoll(ref, n, row.pickedBy ? { spec: row.pickedBy.spec, part: row.pickedBy.part } : undefined);
    };
    // Dice/thresholds + result become inputs only when an edit context can
    // locate the source line; otherwise FormulaView renders static glyphs.
    const die: DieEditContext | undefined =
      edit && source
        ? {
            valueFor: (term, slot) => edit.dieEdits[dieEditKey(source, term.raw, slot)] ?? termSlotInitial(term, slot),
            onChange: (term, slot, value) => edit.onDieChange(source, term.raw, slot, value),
            resultValue:
              formula?.result != null
                ? (edit.dieEdits[resultEditKey(source)] ?? rollPreview() ?? formula.result)
                : undefined,
            onResultChange: (value) => edit.onResultChange(source, value),
            // A sum's stored total is expression text, not a term — swap it directly.
            onTokenSwap: edit.onTokenChange
              ? (from, to) => edit.onTokenChange!(source, from, to, row.sourceNth ?? 0)
              : undefined,
          }
        : undefined;
    return (
      <span className={`lonelog-row-detail${row.child ? " is-child" : ""}`}>
        <span className="lonelog-row-bullet" aria-hidden="true">
          {row.child ? "+" : "•"}
        </span>
        {row.label && <span className="lonelog-row-label">{row.label}</span>}
        {party ? (
          <span className="lonelog-party">
            {party.map((f, i) => (
              <FormulaView key={i} formula={f} edit={die} />
            ))}
          </span>
        ) : formula ? (
          <FormulaView formula={formula} edit={die} onChoice={pick} named={!!row.combatant} />
        ) : hasChoice ? (
          <ChoiceOnlyView
            text={row.content}
            onChoice={pick}
            onResultChange={source && edit ? (value) => edit.onResultChange(source, value) : undefined}
          />
        ) : (
          <InlineMarkdown
            source={row.pickOnly && !row.content ? (pickPreview() ?? "") : row.content}
            sourcePath={sourcePath}
          />
        )}
        {row.foe && <FoeHealth foe={row.foe} />}
        {row.spawns && (
          <span className="lonelog-row-spawns" aria-label="generates the following steps">
            …
          </span>
        )}
      </span>
    );
  }
  // A top-level roll row (`d: 3d8!=19`) carries a formula too, so it renders as
  // dice rather than as text. Read-only unless it is ROLLABLE (an `o:` line, which
  // keeps its source): then its dice roll and take typed values like a working
  // line's, while its answer stays derived from the roll.
  const formulas = parseFormulaLine(row.content, { vars: row.vars, refs: row.refs });
  if (formulas) {
    const source = row.source;
    const rollEdit: DieEditContext | undefined =
      row.rollable && edit && source
        ? {
            valueFor: (term, slot) => edit.dieEdits[dieEditKey(source, term.raw, slot)] ?? termSlotInitial(term, slot),
            onChange: (term, slot, value) => edit.onDieChange(source, term.raw, slot, value),
          }
        : undefined;
    return (
      <>
        {row.label && <span className="lonelog-row-label">{row.label}</span>}
        {formulas.length > 1 ? (
          <span className="lonelog-party">
            {formulas.map((f, i) => (
              <FormulaView key={i} formula={f} edit={rollEdit} />
            ))}
          </span>
        ) : (
          <FormulaView formula={formulas[0]} edit={rollEdit} />
        )}
        {row.leaves && <TargetLeft leaves={row.leaves} sourcePath={sourcePath} />}
        {row.inflicts && <Inflicts changes={row.inflicts} />}
      </>
    );
  }
  return (
    <>
      {row.actorPill && (
        <>
          <ActorPill label={row.actorPill.label} page={row.actorPill.page} sourcePath={sourcePath} />{" "}
        </>
      )}
      {row.label && <span className="lonelog-row-label">{row.label}</span>}
      <InlineMarkdown source={row.content} sourcePath={sourcePath} />
      {row.inflicts && <Inflicts changes={row.inflicts} />}
      {row.economy && <RoundTally economy={row.economy} />}
    </>
  );
}

/**
 * A round's tally, on its line: the owner's action, bonus action and reaction
 * — each a slot, filled once used, flagged past one (a feature may allow it) —
 * the attacks made, and who else reacted in it.
 */
function RoundTally({ economy }: { economy: RoundEconomy }) {
  // Its hover says what spent it: `bonus: Wind Up (with Glaive)`.
  const slot = (label: string, n: number, used: string[]) => (
    <data
      value={n}
      className={`lonelog-economy-slot${n > 0 ? " is-used" : ""}${n > 1 ? " is-over" : ""}`}
      title={n === 0 ? `No ${label} yet` : `${label}: ${used.join(", ")}${n > 1 ? " — more than one" : ""}`}
    >
      {label}
      {n > 1 && ` ×${n}`}
    </data>
  );
  return (
    <span className="lonelog-economy">
      {slot(economy.multiattack ? "action · multiattack" : "action", economy.action, economy.used.action)}
      {slot("bonus", economy.bonus, economy.used.bonus)}
      {slot("reaction", economy.reaction, economy.used.reaction)}
      {economy.attacks > 0 && (
        <data
          value={economy.attacks}
          className="lonelog-economy-attacks"
          title={`${economy.attacks} attack${economy.attacks > 1 ? "s" : ""}`}
        >
          ⚔ {economy.attacks}
        </data>
      )}
      {economy.reacted.length > 0 && (
        <small
          className="lonelog-economy-reacted"
          title={economy.reactions.map((r) => `${r.actor}: ${r.name}`).join(", ")}
        >
          {economy.reacted.join(", ")} reacted
        </small>
      )}
    </span>
  );
}

/** The conditions an entry gave its target (`pinned`) or lifted, by what left them. */
function Inflicts({ changes }: { changes: ConditionChange[] }) {
  return (
    <span className="lonelog-row-inflicts">
      {changes.map((c) => (
        <span
          key={`${c.add ? "+" : "-"}${c.condition}`}
          className={`lonelog-row-inflict${c.add ? "" : " is-lifted"}`}
          title={`${c.add ? "Leaves it" : "Frees it from being"} ${c.condition}${c.from ? ` (${c.from})` : ""}`}
        >
          {c.condition}
        </span>
      ))}
    </span>
  );
}

/** What a damage row left its target with: `→ Fat Kobold, A KO` — the target a
 *  link (as the log wrote it), its health after it. */
function TargetLeft({ leaves, sourcePath }: { leaves: { target: string; left: string }; sourcePath: string }) {
  return (
    <span className="lonelog-row-leaves">
      <span className="lonelog-row-leaves-arrow" aria-hidden="true">
        →
      </span>{" "}
      <InlineMarkdown source={leaves.target} sourcePath={sourcePath} className="lonelog-row-leaves-target" />{" "}
      <span className={`lonelog-row-leaves-left${leaves.left === "KO" ? " is-ko" : ""}`}>{leaves.left}</span>
    </span>
  );
}

export interface SidebarEntryProps {
  item: SidebarItem;
  sourcePath: string;
  /** When present, dice / scene lines are editable (live sidebar). */
  edit?: SidebarEditContext;
  /** Highlight the entry as selected (live sidebar). */
  selected?: boolean;
  /** Anchor registration for scroll syncing (live sidebar). */
  anchorRef?: (el: HTMLElement | null) => void;
  /** Click/keyboard selection handler (live sidebar). Omit for a static entry. */
  onSelect?: (id: number) => void;
  /** Choice-token pick override (feature example: insert the generated line). */
  onChoice?: (selected: string, at?: ChoiceAt) => void;
}

/**
 * One mechanical entry as a small `icon | content | dateline` table. Shared by
 * the live Log sidebar and the read-only feature Example showcase.
 */
export function SidebarEntry({ item, sourcePath, edit, selected, anchorRef, onSelect, onChoice }: SidebarEntryProps) {
  const tags = item.rows.flatMap((row) => row.pills);
  // A "pills-only" row (icon + pills, no content — e.g. a dial change) has its
  // pills shown in the dateline strip; render its icon there and skip the empty
  // body row, so the icon sits beside the pill instead of orphaned below it.
  const joinedAfter = (ri: number) => {
    const out: SidebarRow[] = [];
    for (let j = ri + 1; item.rows[j]?.joined && item.rows[j].detail; j++) out.push(item.rows[j]);
    return out;
  };
  const isPillsOnly = (row: SidebarRow) => !row.scene && !row.detail && !row.content && row.pills.length > 0;
  const headerIcon = item.rows.find(isPillsOnly)?.icon ?? null;
  // Entries that nest inputs (scene editor or editable dice) can't be a button;
  // they stay mouse-clickable. Read-only entries are keyboard-activatable buttons.
  const editableEntry = !!edit && (item.rows.some((row) => row.scene) || hasEditableValue(item.rows));
  const interaction = onSelect
    ? editableEntry
      ? { onClick: () => onSelect(item.id) }
      : {
          role: "button" as const,
          tabIndex: 0,
          onClick: () => onSelect(item.id),
          onKeyDown: (e: React.KeyboardEvent) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelect(item.id);
            }
          },
        }
    : {};

  return (
    <div
      ref={anchorRef}
      className={`lonelog-sidebar-item kind-${item.kind}${item.group ? ` in-multiattack is-${item.group}` : ""} ${selected ? "is-selected" : ""}`}
      {...interaction}
    >
      <table className="lonelog-sidebar-table">
        <tbody>
          {tags.length > 0 && (
            <tr>
              <td className="lonelog-row-icon">{headerIcon && <RowIconView icon={headerIcon} />}</td>
              <td className="lonelog-tag-strip-cell">
                <TagStrip tags={tags} edit={edit} />
              </td>
            </tr>
          )}
          {item.rows.map((row, ri) =>
            isPillsOnly(row) || (row.joined && item.rows[ri - 1]?.detail) ? null : row.detail ? (
              <tr key={ri}>
                <td className="lonelog-row-detail-cell" colSpan={2}>
                  {joinedAfter(ri).length > 0 ? (
                    // Rows written `& label: …` ride on this one's line, each with its own die.
                    <div className="lonelog-row-joined">
                      {[row, ...joinedAfter(ri)].map((part, k) => (
                        <RowContent key={k} row={part} sourcePath={sourcePath} edit={edit} onChoice={onChoice} />
                      ))}
                    </div>
                  ) : (
                    <RowContent row={row} sourcePath={sourcePath} edit={edit} onChoice={onChoice} />
                  )}
                </td>
              </tr>
            ) : (
              <tr key={ri}>
                <td className="lonelog-row-icon">
                  <RowIconView icon={row.icon} />
                </td>
                <td className="lonelog-row-content">
                  <RowContent row={row} sourcePath={sourcePath} edit={edit} onChoice={onChoice} />
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}
