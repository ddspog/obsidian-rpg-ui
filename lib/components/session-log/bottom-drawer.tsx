import { useState } from "react";

type DrawerTab = "actions" | "changes";

interface BottomDrawerProps {
  actionsPanel: React.ReactNode;
  changesPanel: React.ReactNode;
}

export function BottomDrawer({ actionsPanel, changesPanel }: BottomDrawerProps) {
  const [activeTab, setActiveTab] = useState<DrawerTab>("actions");

  return (
    <div className="lonelog-bottom-drawer">
      <button
        className="drawer-toggle-btn"
        onClick={() => setActiveTab(activeTab === "actions" ? "changes" : "actions")}
        aria-label={activeTab === "actions" ? "Show changes" : "Show actions"}
        title={activeTab === "actions" ? "Show changes" : "Show actions"}
      >
        {activeTab === "actions" ? "Δ" : "▶"}
      </button>
      <div className="drawer-content">
        {activeTab === "actions" ? actionsPanel : changesPanel}
      </div>
    </div>
  );
}
