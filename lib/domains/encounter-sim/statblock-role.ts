/**
 * The role a statblock shows: the one written in it (`role:`, `subrole:`), else
 * the guess from what it reads (its CR, AC, HP, speed and resolved features).
 * Pure: the statblock view and the CLI both read it.
 */

import { bindMultiattack, classifyMonsterFeature } from "./monster-actions";
import {
  bestSubrole,
  guessRole,
  parseRole,
  parseSubrole,
  roleOfSubrole,
  type MonsterRole,
  type MonsterTag,
  type RoleConfidence,
  type Subrole,
} from "./monster-role";
import type { ModelledAction, WeaponAttackAction } from "./types";

export interface StatblockRoleInput {
  name: string;
  type?: string;
  cr?: string;
  stats: Record<string, string>;
  features: Array<{ name?: string; type?: string; text: string }>;
  /** As written in the statblock, if at all. */
  role?: string;
  subrole?: string;
}

export interface StatblockRole {
  role: MonsterRole;
  subrole: Subrole;
  tags: MonsterTag[];
  /** Written in the statblock (else a guess). */
  written: boolean;
  confidence: RoleConfidence;
}

function crValue(cr: string | undefined): number {
  const m = /^\s*(\d+)\s*\/\s*(\d+)\s*$/.exec(cr ?? "");
  if (m) return Number(m[2]) ? Number(m[1]) / Number(m[2]) : 0;
  const n = parseFloat(cr ?? "");
  return Number.isFinite(n) ? n : 0;
}

const leadingInt = (text: string | undefined): number => Number(/^\s*(\d+)/.exec(text ?? "")?.[1] ?? 0);

/** The actions the simulator would model, from resolved features (for damage per round). */
export function modelledActions(features: StatblockRoleInput["features"]): ModelledAction[] {
  const classified = features.map((f) => {
    const name = f.name?.trim() || "";
    return { name, ...classifyMonsterFeature({ name, type: f.type, text: f.text }) };
  });
  const attacks = new Map<string, WeaponAttackAction>();
  for (const c of classified) if (c.action?.kind === "weapon") attacks.set(c.action.name, c.action);
  const out: ModelledAction[] = [];
  for (const c of classified) {
    if (c.multiattack) {
      const bound = bindMultiattack(c.multiattack, attacks, c.name);
      if (!("skip" in bound)) out.push(bound);
    } else if (c.action) out.push(c.action);
  }
  return out;
}

/** The role, subrole and tags the statblock shows. */
export function statblockRole(input: StatblockRoleInput): StatblockRole {
  const guess = guessRole({
    name: input.name,
    type: input.type,
    cr: crValue(input.cr),
    ac: leadingInt(input.stats.ac),
    hp: leadingInt(input.stats.hp),
    speed: input.stats.speed ?? "",
    features: input.features.map((f) => ({ name: f.name?.trim() || "", type: f.type, text: f.text })),
    actions: modelledActions(input.features),
  });
  const writtenSub = parseSubrole(input.subrole);
  const writtenRole = parseRole(input.role) ?? (writtenSub ? roleOfSubrole(writtenSub) : undefined);
  if (!writtenRole) {
    return { role: guess.role, subrole: guess.subrole, tags: guess.tags, written: false, confidence: guess.confidence };
  }
  const subrole =
    writtenSub && roleOfSubrole(writtenSub) === writtenRole ? writtenSub : bestSubrole(guess, writtenRole);
  return { role: writtenRole, subrole, tags: guess.tags, written: true, confidence: "high" };
}
