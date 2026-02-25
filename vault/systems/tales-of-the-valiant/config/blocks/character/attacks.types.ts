/**
 * Types for the Attacks block, defining the structure of each attack's details.
 */
export type AttackEntry = {
  /** Display name of the attack */
  name?: string;
  /** Alternate display label */
  label?: string;
  /** Attack bonus (positive or negative number) */
  to_hit?: number;
  /** Range (e.g. "5 ft.", "30/120 ft.") */
  range?: string;
  /** Damage roll details */
  damage?: {
    roll: string;
    type: string;
  };
  property?: string[];
  options?: string[];
};

export type AttacksProps = {
  /** Named attack entries keyed by slug */
  attacks?: AttackEntry[];
};
