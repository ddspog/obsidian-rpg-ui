import * as React from "react";

export interface StatULProps {
  title?: string;
  className?: string;
  children?: React.ReactNode;
}

export function StatUL({ title, className, children }: StatULProps) {
  return (
    <div className={["rpg-stat-ul", className].filter(Boolean).join(" ")}>
      {title && <div className="rpg-stat-ul__title">{title}</div>}
      <ul className="rpg-stat-ul__list">{children}</ul>
    </div>
  );
}
