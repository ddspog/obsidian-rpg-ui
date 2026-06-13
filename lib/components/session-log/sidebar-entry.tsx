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
import { InlineMarkdown } from "./inline-markdown";
import { FormulaView, type DieEditContext } from "./formula";
import { parseFormula, editableTerms, termSlotInitial } from "lib/domains/session-log/formula";
import { dieEditKey, resultEditKey } from "lib/domains/session-log/prose-model";
import type { SidebarItem, SidebarRow, RowIcon, SceneRowData, SidebarPill } from "lib/domains/session-log/prose-model";

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
}

/** True when a detail row carries a formula with at least one editable term. */
export function hasEditableValue(rows: SidebarRow[]): boolean {
  return rows.some((row) => {
    if (!row.detail || !row.source) return false;
    const formula = parseFormula(row.content);
    return formula != null && editableTerms(formula).length > 0;
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

/**
 * An entry's tags as a typographic "dateline" run: each tag is a muted
 * small-caps key (tinted by category) followed by its emphasized value.
 */
function TagStrip({ tags }: { tags: SidebarPill[] }) {
  return (
    <span className="lonelog-tag-strip">
      {tags.map((tag, i) => (
        <span key={i} className={`lonelog-tag kind-${tag.kind}`}>
          <span className="lonelog-tag-key">{tag.name}</span>
          {tag.value && <span className="lonelog-tag-val">{tag.value}</span>}
        </span>
      ))}
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
  onChoice?: (selected: string) => void;
}) {
  if (row.scene) {
    // Read-only: render the scene line as plain text. Editable (live sidebar):
    // inline inputs, only when an onSceneChange handler is wired.
    if (!edit?.onSceneChange) return <InlineMarkdown source={row.content} sourcePath={sourcePath} />;
    const value = edit.sceneEdits?.[row.scene.original] ?? { number: row.scene.number, name: row.scene.name };
    return <SceneEditor scene={row.scene} value={value} onChange={edit.onSceneChange} />;
  }
  if (row.detail) {
    const formula = parseFormula(row.content);
    const source = row.source;
    // Dice/thresholds + result become inputs only when an edit context can
    // locate the source line; otherwise FormulaView renders static glyphs.
    const die: DieEditContext | undefined =
      edit && source
        ? {
            valueFor: (term, slot) => edit.dieEdits[dieEditKey(source, term.raw, slot)] ?? termSlotInitial(term, slot),
            onChange: (term, slot, value) => edit.onDieChange(source, term.raw, slot, value),
            resultValue: formula?.result != null ? (edit.dieEdits[resultEditKey(source)] ?? formula.result) : undefined,
            onResultChange: (value) => edit.onResultChange(source, value),
          }
        : undefined;
    return (
      <span className="lonelog-row-detail">
        <span className="lonelog-row-bullet" aria-hidden="true">
          •
        </span>
        {row.label && <span className="lonelog-row-label">{row.label}</span>}
        {formula ? (
          <FormulaView formula={formula} edit={die} onChoice={onChoice} />
        ) : (
          <InlineMarkdown source={row.content} sourcePath={sourcePath} />
        )}
      </span>
    );
  }
  return <InlineMarkdown source={row.content} sourcePath={sourcePath} />;
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
  onChoice?: (selected: string) => void;
}

/**
 * One mechanical entry as a small `icon | content | dateline` table. Shared by
 * the live Log sidebar and the read-only feature Example showcase.
 */
export function SidebarEntry({ item, sourcePath, edit, selected, anchorRef, onSelect, onChoice }: SidebarEntryProps) {
  const tags = item.rows.flatMap((row) => row.pills);
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
      className={`lonelog-sidebar-item kind-${item.kind} ${selected ? "is-selected" : ""}`}
      {...interaction}
    >
      <table className="lonelog-sidebar-table">
        <tbody>
          {tags.length > 0 && (
            <tr>
              <td className="lonelog-row-icon" />
              <td className="lonelog-tag-strip-cell">
                <TagStrip tags={tags} />
              </td>
            </tr>
          )}
          {item.rows.map((row, ri) =>
            row.detail ? (
              <tr key={ri}>
                <td className="lonelog-row-detail-cell" colSpan={2}>
                  <RowContent row={row} sourcePath={sourcePath} edit={edit} onChoice={onChoice} />
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
