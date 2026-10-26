import * as React from "react";
import { LucideIcon } from "./lucide-icon";

/** What the log's own controls need to show in the drawer's bar on a phone. */
export interface DrawerBar {
  /** Whether the log has a Log (sidebar) and a last block to jump to. */
  hasLog: boolean;
  logOpen: boolean;
  onToggleLog: () => void;
  onLatest: () => void;
  /** Edits not saved yet: Save and Undo show above the bar. */
  dirty: boolean;
  onSave: () => void;
  onUndo: () => void;
}

interface BottomDrawerProps {
  actionsPanel: React.ReactNode;
  bar?: DrawerBar;
  /** A class of its own for the host (the draft block's compact drawer). */
  className?: string;
  /** What the folded bar reads; "Actions" if not given. */
  label?: string;
}

/** What the panel inside can ask of its drawer: open up (when someone is picked), and say who is acting. */
export const DrawerContext = React.createContext<{
  expand: () => void;
  reportActor?: (name: string | undefined) => void;
} | null>(null);

const KEY = "rpg-ui:drawer-collapsed";
/** The key that opens and folds the drawer from the keyboard. */
const HOTKEY = "a";

/** Typing somewhere: letter keys are the text's, not ours. */
function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return (
    el.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) ||
    !!el.closest?.(".cm-editor, .modal-container, .prompt")
  );
}

/**
 * The drawer of cards under the prose. It stays in view at the foot of the
 * page from the start of the log, and starts folded to a slim bar (who is
 * acting, and the key that opens it); picking someone in the roster opens it.
 * On a phone the bar is also where Log, Latest and Save live, at the thumb.
 * (What the session changed is the bookkeeping below it, apart.)
 */
export function BottomDrawer({ actionsPanel, bar, className, label = "Actions" }: BottomDrawerProps) {
  const root = React.useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = React.useState(() => {
    // No saved choice: folded, so the story has the whole window until the player reaches for the actions.
    try {
      const saved = window.localStorage.getItem(KEY);
      return saved === null ? true : saved === "1";
    } catch {
      return true;
    }
  });
  const [actor, setActor] = React.useState<string | undefined>();
  const set = React.useCallback((on: boolean) => {
    setCollapsed(on);
    try {
      window.localStorage.setItem(KEY, on ? "1" : "0");
    } catch {
      // Nowhere to keep it: folded next time.
    }
  }, []);
  const context = React.useMemo(() => ({ expand: () => set(false), reportActor: setActor }), [set]);

  // "A" opens and folds the drawer of the log you're reading.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== HOTKEY || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || e.defaultPrevented)
        return;
      if (isTyping(e.target)) return;
      const el = root.current;
      // Only the log in the note on screen answers, and in a note with several, the drawer you can see.
      if (!el || !el.closest(".workspace-leaf.mod-active") || el.offsetParent === null) return;
      const r = el.getBoundingClientRect();
      if (r.top >= window.innerHeight || r.bottom < window.innerHeight * 0.4) return;
      e.preventDefault();
      set(!collapsed);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [collapsed, set]);

  const acting = actor === "Game Master" ? "GM" : actor;

  return (
    <div
      ref={root}
      className={`lonelog-bottom-drawer${collapsed ? " is-collapsed" : ""}${className ? ` ${className}` : ""}`}
    >
      <button
        type="button"
        className="drawer-toggle-btn"
        onClick={() => set(!collapsed)}
        aria-expanded={!collapsed}
        aria-keyshortcuts={HOTKEY.toUpperCase()}
        aria-label={collapsed ? `Open the ${label.toLowerCase()}` : `Minimise the ${label.toLowerCase()}`}
        title={collapsed ? `Open the ${label.toLowerCase()}` : "Minimise"}
      >
        <LucideIcon name={collapsed ? "ChevronUp" : "ChevronDown"} size="0.9rem" strokeWidth={1.8} />
      </button>
      {collapsed && (
        <div className="drawer-collapsed-bar" onClick={() => set(false)}>
          <span className="drawer-collapsed-label">{label}</span>
          {acting && <span className="drawer-collapsed-actor">{acting} acting</span>}
          <span className="drawer-collapsed-hint">Press {HOTKEY.toUpperCase()} to open</span>
        </div>
      )}
      {/* Mounted either way: the roster lives in the page's margin, and its choices with it. */}
      <div className="drawer-content" hidden={collapsed}>
        <DrawerContext.Provider value={context}>{actionsPanel}</DrawerContext.Provider>
      </div>
      {bar && (
        <div className="lonelog-bar-wrap">
          {bar.dirty && (
            <div className="lonelog-bar-dirty" role="group" aria-label="Unsaved log edits">
              <span>Unsaved changes</span>
              <button type="button" onClick={bar.onSave}>
                Save
              </button>
              <button type="button" onClick={bar.onUndo}>
                Undo
              </button>
            </div>
          )}
          <div className="lonelog-bar" role="group" aria-label="Log controls">
            <button type="button" aria-pressed={!collapsed} onClick={() => set(!collapsed)}>
              {label}
            </button>
            {bar.hasLog && (
              <button type="button" aria-pressed={bar.logOpen} onClick={bar.onToggleLog}>
                Log
              </button>
            )}
            {bar.hasLog && (
              <button type="button" onClick={bar.onLatest}>
                ↓ Latest
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
