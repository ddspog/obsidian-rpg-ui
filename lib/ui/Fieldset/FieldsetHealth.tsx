import * as React from "react";

export interface FieldsetHealthProps {
  label: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export function FieldsetHealth({ label, children, style }: FieldsetHealthProps) {
  return <fieldset aria-details={`Health ${label}`} style={style}>{children}</fieldset>;
}
