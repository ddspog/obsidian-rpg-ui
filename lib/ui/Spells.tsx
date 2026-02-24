/**
 * Spells placeholder component
 *
 * Displays a spell list grouped by circle (spell level). Placeholder for the
 * `rpg spell` block with full slot tracking, prepared/known spell management,
 * and filtering by spell list.
 */

import type { SpellCircleDefinition, SpellSlotDistribution } from "lib/systems/types";

export interface SpellEntry {
  /** Spell name */
  name: string;
  /** Spell circle identifier (e.g. "cantrip", "1", "2") */
  circle: string;
  /** Whether the spell is currently prepared */
  prepared?: boolean;
  /** Optional description */
  description?: string;
}

export interface SpellsProps {
  /** Spells to display */
  spells: SpellEntry[];
  /** Spell circle definitions from the active system */
  circles: SpellCircleDefinition[];
  /** Available spell slots per circle (from spellcastTable row for current level) */
  slotsAvailable?: number[];
  /** Used spell slots per circle */
  slotsUsed?: number[];
}

/**
 * Spells — renders a spell list grouped by circle with optional slot counters.
 * Placeholder implementation; full stateful version lives in SpellComponentsView.
 */
export function Spells({ spells, circles, slotsAvailable = [], slotsUsed = [] }: SpellsProps) {
  const spellsByCircle = new Map<string, SpellEntry[]>();
  for (const spell of spells) {
    const group = spellsByCircle.get(spell.circle) ?? [];
    group.push(spell);
    spellsByCircle.set(spell.circle, group);
  }

  return (
    <div className="rpg-ui-spells">
      {circles.map((circle, idx) => {
        const circleSpells = spellsByCircle.get(circle.id);
        if (!circleSpells || circleSpells.length === 0) return null;

        const available = idx === 0 ? 0 : (slotsAvailable[idx - 1] ?? 0); // idx 0 = cantrip (no slots); idx 1 = 1st-level slots at index 0
        const used = idx === 0 ? 0 : (slotsUsed[idx - 1] ?? 0);

        return (
          <div key={circle.id} className="rpg-ui-spells__circle">
            <div className="rpg-ui-spells__circle-header">
              {circle.icon && <span className="rpg-ui-spells__circle-icon">{circle.icon}</span>}
              <span className="rpg-ui-spells__circle-label">{circle.label}</span>
              {available > 0 && (
                <span className="rpg-ui-spells__slots">
                  {available - used}/{available}
                </span>
              )}
            </div>
            <div className="rpg-ui-spells__spell-list">
              {circleSpells.map((spell) => (
                <div key={spell.name} className="rpg-ui-spells__spell">
                  {spell.prepared !== undefined && (
                    <span className={`rpg-ui-spells__prepared${spell.prepared ? " rpg-ui-spells__prepared--active" : ""}`} />
                  )}
                  <span className="rpg-ui-spells__spell-name">{spell.name}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Derive the spell slot row for a given caster level from a spellcast table.
 *
 * @param spellcastTable - Full spell slot progression table
 * @param casterLevel    - The character's caster level (1–20)
 * @returns The `SpellSlotDistribution` for that level, or undefined if out of range
 */
export function getSlotsForLevel(
  spellcastTable: SpellSlotDistribution[],
  casterLevel: number,
): SpellSlotDistribution | undefined {
  return spellcastTable.find((row) => row.level === casterLevel);
}
