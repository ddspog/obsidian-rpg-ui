import * as React from "react";

export interface StatusPanelProps {
  label: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export function StatusPanel({ label, children, style }: StatusPanelProps) {
  return (
    <div aria-details={`${label} Status`} style={style}>
      {children}
    </div>
  );
}
