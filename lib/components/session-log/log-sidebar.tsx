/**
 * Log Sidebar
 *
 * The right rail for the log block. Lists every mechanical lonelog entry as a
 * small icon | content | dateline table via the shared `SidebarEntry` renderer
 * (so the example showcase in a feature card renders identically). Clicking an
 * entry scrolls the prose to the matching passage; the provenance dot in the
 * prose opens and highlights the corresponding entry here. Scene consequences
 * and dice/thresholds are editable inline (write-back wired through `edit`).
 */

import * as React from "react";
import { SidebarEntry, type SidebarEditContext, type SceneEditValue } from "./sidebar-entry";
import type { SidebarItem } from "lib/domains/session-log/prose-model";

export type { SceneEditValue };

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
  const edit: SidebarEditContext = { sceneEdits, onSceneChange, dieEdits, onDieChange, onResultChange };

  return (
    <aside className="lonelog-sidebar lonelog-entries" aria-label="Session log">
      <div className="lonelog-sidebar-header">Log</div>

      {items.length === 0 ? (
        <div className="lonelog-sidebar-empty">No log entries.</div>
      ) : (
        items.map((item) => (
          <SidebarEntry
            key={item.id}
            item={item}
            sourcePath={sourcePath}
            edit={edit}
            selected={selectedId === item.id}
            onSelect={onSelect}
            anchorRef={(el) => registerAnchor(item.id, el)}
          />
        ))
      )}
    </aside>
  );
}
