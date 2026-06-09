/**
 * Log Sidebar
 *
 * The right rail for the log block. Lists every mechanical lonelog entry (`@`,
 * `!`, `?`, and the other special stuff) as a small table — one row per source
 * line: icon | content. An entry's tags (`CF 5`, persistent NPC/clock/location
 * tags) are collected into a "dateline" strip across the top of the entry.
 * Content is rendered as markdown so `[[wikilinks]]` resolve. Clicking an entry
 * scrolls the prose to the matching passage; the provenance dot in the prose
 * opens and highlights the corresponding entry here.
 *
 * Scene consequences (`=> S## Name`) render as an editable line —
 * `Start Scene(NN): "Name"` — with two subtle inline inputs. Editing surfaces a
 * Save button (in SessionLogRoot) that writes the change back to the code block.
 * Entries that contain inputs are plain rows (not `role="button"`) to avoid
 * nesting interactive controls inside a button.
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

export interface LogSidebarProps {
  items: SidebarItem[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  registerAnchor: (id: number, el: HTMLElement | null) => void;
  sourcePath: string;
  /** Pending scene edits keyed by the scene's original `=>` text. */
  sceneEdits: Record<string, SceneEditValue>;
  onSceneChange: (original: string, next: SceneEditValue) => void;
  /** Pending die-value edits keyed by `dieEditKey(source, raw, slot)`. */
  dieEdits: Record<string, string>;
  onDieChange: (source: string, raw: string, slot: number, value: string) => void;
  onResultChange: (source: string, value: string) => void;
}

/** True when a detail row carries a formula with at least one editable term. */
function hasEditableValue(rows: SidebarRow[]): boolean {
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
 * small-caps key (tinted by category) followed by its emphasized value, with
 * faint middot separators between tags (drawn in CSS). No chip chrome.
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
  // Keep clicks/keys inside the inputs from triggering the row's scroll/select.
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
  sceneEdits,
  onSceneChange,
  dieEdits,
  onDieChange,
  onResultChange,
}: {
  row: SidebarRow;
  sourcePath: string;
  sceneEdits: Record<string, SceneEditValue>;
  onSceneChange: (original: string, next: SceneEditValue) => void;
  dieEdits: Record<string, string>;
  onDieChange: (source: string, raw: string, slot: number, value: string) => void;
  onResultChange: (source: string, value: string) => void;
}) {
  if (row.scene) {
    const value = sceneEdits[row.scene.original] ?? { number: row.scene.number, name: row.scene.name };
    return <SceneEditor scene={row.scene} value={value} onChange={onSceneChange} />;
  }
  if (row.detail) {
    const formula = parseFormula(row.content);
    const source = row.source;
    // Dice/thresholds become inline inputs (per slot) and the result becomes an
    // input, when we can locate the source line for write-back.
    const edit: DieEditContext | undefined = source
      ? {
          valueFor: (term, slot) => dieEdits[dieEditKey(source, term.raw, slot)] ?? termSlotInitial(term, slot),
          onChange: (term, slot, value) => onDieChange(source, term.raw, slot, value),
          resultValue: formula?.result != null ? (dieEdits[resultEditKey(source)] ?? formula.result) : undefined,
          onResultChange: (value) => onResultChange(source, value),
        }
      : undefined;
    return (
      <span className="lonelog-row-detail">
        <span className="lonelog-row-bullet" aria-hidden="true">
          •
        </span>
        {row.label && <span className="lonelog-row-label">{row.label}</span>}
        {formula ? (
          <FormulaView formula={formula} edit={edit} />
        ) : (
          <InlineMarkdown source={row.content} sourcePath={sourcePath} />
        )}
      </span>
    );
  }
  return <InlineMarkdown source={row.content} sourcePath={sourcePath} />;
}

export function LogSidebar({
  items,
  selectedId,
  onSelect,
  registerAnchor,
  sourcePath,
  sceneEdits,
  onSceneChange,
  dieEdits,
  onDieChange,
  onResultChange,
}: LogSidebarProps) {
  return (
    <aside className="lonelog-sidebar" aria-label="Session log">
      <div className="lonelog-sidebar-header">Log</div>

      {items.length === 0 ? (
        <div className="lonelog-sidebar-empty">No log entries.</div>
      ) : (
        items.map((item) => {
          const tags = item.rows.flatMap((row) => row.pills);
          // Entries that nest inputs (scene editor or editable dice) can't be a
          // button; they stay mouse-clickable for scroll. Read-only entries are
          // buttons (keyboard-activatable).
          const editable = item.rows.some((row) => row.scene) || hasEditableValue(item.rows);
          const interaction = editable
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
              };

          return (
            <div
              key={item.id}
              ref={(el) => registerAnchor(item.id, el)}
              className={`lonelog-sidebar-item kind-${item.kind} ${selectedId === item.id ? "is-selected" : ""}`}
              {...interaction}
            >
              <table className="lonelog-sidebar-table">
                <tbody>
                  {tags.length > 0 && (
                    <tr>
                      {/* Empty icon cell so the strip aligns under the content column. */}
                      <td className="lonelog-row-icon" />
                      <td className="lonelog-tag-strip-cell">
                        <TagStrip tags={tags} />
                      </td>
                    </tr>
                  )}
                  {item.rows.map((row, ri) =>
                    row.detail ? (
                      // Bullet detail lines span the whole row so the text gets
                      // the full width (no icon column).
                      <tr key={ri}>
                        <td className="lonelog-row-detail-cell" colSpan={2}>
                          <RowContent
                            row={row}
                            sourcePath={sourcePath}
                            sceneEdits={sceneEdits}
                            onSceneChange={onSceneChange}
                            dieEdits={dieEdits}
                            onDieChange={onDieChange}
                            onResultChange={onResultChange}
                          />
                        </td>
                      </tr>
                    ) : (
                      <tr key={ri}>
                        <td className="lonelog-row-icon">
                          <RowIconView icon={row.icon} />
                        </td>
                        <td className="lonelog-row-content">
                          <RowContent
                            row={row}
                            sourcePath={sourcePath}
                            sceneEdits={sceneEdits}
                            onSceneChange={onSceneChange}
                            dieEdits={dieEdits}
                            onDieChange={onDieChange}
                            onResultChange={onResultChange}
                          />
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          );
        })
      )}
    </aside>
  );
}
