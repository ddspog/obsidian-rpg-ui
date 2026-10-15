/**
 * A creature's statblock actions as session actions — the cards a foe plays.
 *
 * Each resolved statblock feature already carries the values its text was
 * filled from (its tier's `hit`, `damage`, …), so an attack rolls those numbers;
 * a forced save is read off the text (`DC 12 Dexterity saving throw`); anything
 * else (Multiattack, Pack Tactics) is an action to record.
 */

import { parseMultiattack } from "lib/domains/session-log/multiattack";
import { parseMoveGrant } from "lib/domains/battlemap/movement-rules";
import type { SessionAction } from "lib/domains/session-log/session-actions";
import type { ResolvedStatFeature } from "./types";

const ABILITY_ABBR: Record<string, string> = {
  strength: "STR",
  dexterity: "DEX",
  constitution: "CON",
  intelligence: "INT",
  wisdom: "WIS",
  charisma: "CHA",
};

/** The card buckets statblock feature types land in. */
const BUCKET: Record<string, string> = { action: "action", bonus: "bonus", reaction: "reaction", legendary: "action" };

/** Statblock types that are something a creature DOES (not a passive trait). */
const ACTIVE_TYPES = new Set(Object.keys(BUCKET));

export function statFeatureAction(f: ResolvedStatFeature): SessionAction | null {
  if (!f.name || !ACTIVE_TYPES.has(f.type ?? "")) return null;
  const p = f.params ?? {};
  const text = f.text ?? "";
  const hit = p.hit != null && p.hit !== "" ? String(p.hit) : undefined;
  const save = text.match(
    /DC\s*(\d+)\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+saving throw/i
  );
  const rawDamage = typeof p.damage === "string" ? p.damage : undefined;
  // The damage type follows the damage value in the filled text.
  const type = rawDamage
    ? text.slice(text.indexOf(rawDamage) + rawDamage.length).match(/^\s*([a-z]+)\s+damage/i)?.[1]
    : undefined;
  // A Multiattack: one action, the attacks its text names (`two Rapier attacks`).
  const multiattack = !hit && !save && /multiattack/i.test(f.name) ? parseMultiattack(text) : undefined;
  return {
    name: f.name,
    bucket: hit || save ? "attack" : BUCKET[f.type!],
    ...(multiattack ? { multiattack } : {}),
    // A move its text grants (Scurry: "moves up to 15 feet without provoking…").
    ...(parseMoveGrant(f.name, text) ? { grantsMove: parseMoveGrant(f.name, text) } : {}),
    ...(hit ? { hit } : {}),
    ...(save ? { save: `${ABILITY_ABBR[save[2].toLowerCase()]} ${save[1]}` } : {}),
    ...(rawDamage ? { damage: `${rawDamage}${type ? ` ${type}` : ""}` } : {}),
    ...(typeof p.reach === "string"
      ? { range: `reach ${p.reach}` }
      : typeof p.range === "string"
        ? { range: p.range }
        : {}),
    ...(f.source ? { link: f.source } : {}),
  };
}

/** Every action a creature's resolved features give it, in statblock order. */
export function statActions(features: ResolvedStatFeature[]): SessionAction[] {
  return features.map(statFeatureAction).filter((a): a is SessionAction => a != null);
}
