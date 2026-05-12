import * as React from "react";

export interface HGroupRowProps {
  label: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export function HGroupRow({ label, children, style }: HGroupRowProps) {
  return (
    <hgroup aria-details={`${label} Row`} style={style}>
      {children}
    </hgroup>
  );
}
