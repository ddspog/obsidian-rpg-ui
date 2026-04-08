import * as React from "react";

export interface FigureColumnProps {
  label: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export function FigureColumn({ label, children, style }: FigureColumnProps) {
  return <figure aria-details={`${label} Column`} style={style}>{children}</figure>;
}
