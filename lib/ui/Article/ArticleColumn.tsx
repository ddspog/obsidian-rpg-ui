import * as React from "react";

export interface ArticleColumnProps {
  label: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export function ArticleColumn({ label, children, style }: ArticleColumnProps) {
  return <article aria-details={`${label} Column`} style={style}>{children}</article>;
}
