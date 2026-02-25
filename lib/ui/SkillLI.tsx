import * as React from "react";

export interface SkillLIProps {
  value?: unknown;
  className?: string;
  children?: React.ReactNode;
}

function displaySkillValue(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "number") return (v >= 0 ? `+${v}` : `${v}`);
  if (typeof v === "string") return v;
  if (typeof v === "object") {
    // common shapes: { bonus: number } or { value: number }
    const asAny = v as any;
    if (typeof asAny.value === "number") return asAny.value >= 0 ? `+${asAny.value}` : String(asAny.value);
    if (typeof asAny.bonus === "number") return asAny.bonus >= 0 ? `+${asAny.bonus}` : String(asAny.bonus);
    if (typeof asAny.total === "number") return asAny.total >= 0 ? `+${asAny.total}` : String(asAny.total);
  }
  return null;
}

export function SkillLI({ value, children, className }: SkillLIProps) {
  const display = displaySkillValue(value);
  return (
    <li className={["rpg-skill-li", className].filter(Boolean).join(" ")}> 
      <span className="rpg-skill-li__label">{children}</span>
      {display !== null && <span className="rpg-skill-li__value">{display}</span>}
    </li>
  );
}
