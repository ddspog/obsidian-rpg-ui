import * as React from "react";
import { LucideIcon } from "./lucide-icon";

interface BottomDrawerProps {
  actionsPanel: React.ReactNode;
}

/** What the panel inside can ask of its drawer: open up (when someone is picked). */
export const DrawerContext = React.createContext<{ expand: () => void } | null>(null);

const KEY = "rpg-ui:drawer-collapsed";

/**
 * The drawer of cards under the prose. It stays in view at the foot of the
 * page from the start of the log, and folds down to a slim bar with the button
 * in its corner; picking someone in the roster opens it again. (What the
 * session changed is the bookkeeping below it, apart.)
 */
export function BottomDrawer({ actionsPanel }: BottomDrawerProps) {
  const [collapsed, setCollapsed] = React.useState(() => {
    // No saved choice: start folded on a phone, where the open drawer fills the screen.
    const phone = window.matchMedia?.("(max-width: 600px)").matches ?? false;
    try {
      const saved = window.localStorage.getItem(KEY);
      return saved === null ? phone : saved === "1";
    } catch {
      return phone;
    }
  });
  const set = React.useCallback((on: boolean) => {
    setCollapsed(on);
    try {
      window.localStorage.setItem(KEY, on ? "1" : "0");
    } catch {
      // Nowhere to keep it: open next time.
    }
  }, []);
  const context = React.useMemo(() => ({ expand: () => set(false) }), [set]);

  return (
    <div className={`lonelog-bottom-drawer${collapsed ? " is-collapsed" : ""}`}>
      <button
        type="button"
        className="drawer-toggle-btn"
        onClick={() => set(!collapsed)}
        aria-expanded={!collapsed}
        aria-label={collapsed ? "Open the actions" : "Minimise the actions"}
        title={collapsed ? "Open the actions" : "Minimise"}
      >
        <LucideIcon name={collapsed ? "ChevronUp" : "ChevronDown"} size="0.9rem" strokeWidth={1.8} />
      </button>
      {collapsed && <span className="drawer-collapsed-label">Actions</span>}
      {/* Mounted either way: the roster lives in the page's margin, and its choices with it. */}
      <div className="drawer-content" hidden={collapsed}>
        <DrawerContext.Provider value={context}>{actionsPanel}</DrawerContext.Provider>
      </div>
    </div>
  );
}
