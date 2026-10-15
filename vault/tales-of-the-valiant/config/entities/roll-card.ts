/**
 * How a sheet's roll plays as a session card: the stack it plays from, and the
 * condition it leaves. Kept apart from the Rolls block so it can be read (and
 * tested) without the block's UI.
 */

import type { RollAspect, RollInflict } from "rpg-ui-toolkit";

/**
 * A card goes to the Attack stack whenever it strikes — it rolls to hit (a
 * weapon, a spell attack), or deals damage (a save's too); else it's an action,
 * which its feature's own stack (a bonus action, a reaction) may take over.
 * Sanctuary's save hurts no one, so it isn't an attack.
 */
export function rollBucket(roll: Pick<RollAspect, "form">, hurts: boolean): "attack" | "action" {
  const attacks = roll.form === "melee" || roll.form === "ranged" || roll.form === "spell";
  return attacks || hurts ? "attack" : "action";
}

/**
 * The condition a roll leaves: as it says (`inflicts:`), or — a save that
 * brings on a condition the system knows (Luminous Bolt's `effects: [blinded]`)
 * — on a failed save. An effect that's no condition (`pin`) leaves none.
 */
export function rollInflicts(
  roll: Pick<RollAspect, "inflicts" | "save" | "effects" | "notes">,
  conditions?: Record<string, unknown>
): RollInflict | undefined {
  if (roll.inflicts) return roll.inflicts;
  if (!roll.save) return undefined;
  const effect = (roll.effects ?? [])
    .map((e) => (typeof e === "string" ? e : (e.label ?? "")).trim().toLowerCase())
    .find((e) => !!e && !!conditions?.[e]);
  return effect ? { condition: effect, on: "fail", ...(roll.notes ? { note: roll.notes } : {}) } : undefined;
}
