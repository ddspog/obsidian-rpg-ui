import * as React from "react";
import { CircleBadge } from "./CircleBadge";

export interface BadgeShieldProps {
  /** The armor class value to display */
  value: number;
  /** Optional label shown below the value (e.g. "AC", "Shield") */
  label?: string;
}

export function BadgeShield({ value, label }: BadgeShieldProps) {
  return (
    <figure aria-details="Badge Shield" aria-label={`${label ?? "Armor Class"}: ${value}`}>
      <CircleBadge ringColor="var(--rpg-badge-ring, #2d2a27)" decorColor="var(--rpg-badge-decor, #e3dcce)" />
      <output aria-details="Armor Class">{value}</output>
      {label && <figcaption>{label}</figcaption>}
    </figure>
  );
}
