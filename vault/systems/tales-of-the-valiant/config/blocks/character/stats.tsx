import * as React from "react";
import { EntityBlock, Stat } from "rpg-ui-toolkit";
import { CharacterEntity } from "../../entities/character.types";
import { StatsProps } from "./stats.types";
import type { FeaturesBlockData } from "./features.types";

const ATTRS = ["STR", "DEX", "CON", "INT", "WIS", "CHA"] as const;
type AttrCode = typeof ATTRS[number];

const ATTR_ALIAS: Record<string, AttrCode> = {
  STR: "STR", STRENGTH: "STR",
  DEX: "DEX", DEXTERITY: "DEX",
  CON: "CON", CONSTITUTION: "CON",
  INT: "INT", INTELLIGENCE: "INT",
  WIS: "WIS", WISDOM: "WIS",
  CHA: "CHA", CHARISMA: "CHA",
};

/** Parse an Ability Scores trait value (`"+2 Wisdom"`, `"+1 Str"`, …) into
 *  its attribute code and point total. */
function parseAsi(raw: string): { attr: AttrCode; points: number } | null {
  const match = raw.match(/^\s*\+(\d+)\s+([A-Za-z]+)\s*$/);
  if (!match) return null;
  const points = parseInt(match[1], 10);
  if (!Number.isFinite(points)) return null;
  const attr = ATTR_ALIAS[match[2].toUpperCase()];
  if (!attr) return null;
  return { attr, points };
}

function sumAsi(values: string[] | undefined): Record<AttrCode, number> {
  const totals: Record<AttrCode, number> = {
    STR: 0, DEX: 0, CON: 0, INT: 0, WIS: 0, CHA: 0,
  };
  for (const raw of values ?? []) {
    const parsed = parseAsi(raw);
    if (parsed) totals[parsed.attr] += parsed.points;
  }
  return totals;
}

/** Strip a save-trait value (`"WIS"`, `"+CHA"`, …) down to a canonical
 *  3-letter attribute code. Returns null when the string doesn't match
 *  any known attribute alias. */
function asAttrCode(raw: unknown): AttrCode | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw.replace(/^\+/, "").trim().toUpperCase();
  return ATTR_ALIAS[cleaned] ?? null;
}

function saveProfLevelsFromTraits(traits: Record<string, string[]>): Record<AttrCode, number> {
  // P. = level 1, J. (Jack) = 0.5, E. = 2. Higher wins when multiple
  // traits touch the same attribute so expertise from one source isn't
  // downgraded by a plain P. from another.
  const out: Record<AttrCode, number> = {
    STR: 0, DEX: 0, CON: 0, INT: 0, WIS: 0, CHA: 0,
  };
  const bump = (code: AttrCode, lvl: number) => {
    if (lvl > out[code]) out[code] = lvl;
  };
  for (const raw of traits["Save P."] ?? []) {
    const code = asAttrCode(raw);
    if (code) bump(code, 1);
  }
  for (const raw of traits["Save J."] ?? []) {
    const code = asAttrCode(raw);
    if (code) bump(code, 0.5);
  }
  for (const raw of traits["Save E."] ?? []) {
    const code = asAttrCode(raw);
    if (code) bump(code, 2);
  }
  return out;
}

function saveBonusFromTraits(traits: Record<string, string[]>): Record<AttrCode, number> {
  // `Save B.: "+2 WIS"` → +2 to the WIS save. Aggregates across entries.
  const out: Record<AttrCode, number> = {
    STR: 0, DEX: 0, CON: 0, INT: 0, WIS: 0, CHA: 0,
  };
  for (const raw of traits["Save B."] ?? []) {
    const match = raw.match(/^\s*([+\-]?\d+(?:\.\d+)?)\s+([A-Za-z]+)\s*$/);
    if (!match) continue;
    const bonus = parseFloat(match[1]);
    const code = asAttrCode(match[2]);
    if (!Number.isFinite(bonus) || !code) continue;
    out[code] += bonus;
  }
  return out;
}

/** Vantage flags per attribute save. `Save A.: STR` → advantage on STR
 *  saves; `Save A.: true` → advantage on every save. Disadvantage
 *  follows the same shape on `Save D.`. When both are present for the
 *  same attribute they net to "none" (the rules cancel). */
function saveVantageFromTraits(
  traits: Record<string, string[]>,
): Record<AttrCode, "adv" | "dis" | undefined> {
  const adv = new Set<AttrCode>();
  const dis = new Set<AttrCode>();
  const apply = (set: Set<AttrCode>, raw: string) => {
    if (raw === "") {
      // Bare-flag `Save A.: true` → applies to every save.
      for (const code of ATTRS) set.add(code);
      return;
    }
    const code = asAttrCode(raw);
    if (code) set.add(code);
  };
  for (const raw of traits["Save A."] ?? []) apply(adv, raw);
  for (const raw of traits["Save D."] ?? []) apply(dis, raw);
  const out: Record<AttrCode, "adv" | "dis" | undefined> = {
    STR: undefined, DEX: undefined, CON: undefined,
    INT: undefined, WIS: undefined, CHA: undefined,
  };
  for (const code of ATTRS) {
    const a = adv.has(code);
    const d = dis.has(code);
    if (a && !d) out[code] = "adv";
    else if (d && !a) out[code] = "dis";
  }
  return out;
}

interface AttrEntry {
  baseValue: number;
  saveProf?: number;
  saveBonus?: number;
}

/** Read the YAML cell for one attribute. Accepts the number shorthand
 *  (`STR: 14`) or the full object form (`STR: { value: 14, save: {…} }`). */
function readAttr(raw: unknown): AttrEntry {
  if (typeof raw === "number") return { baseValue: raw };
  if (raw && typeof raw === "object") {
    const obj = raw as { value?: number; save?: { proficiency?: number; bonus?: number } };
    return {
      baseValue: typeof obj.value === "number" ? obj.value : 10,
      saveProf: obj.save?.proficiency,
      saveBonus: obj.save?.bonus,
    };
  }
  return { baseValue: 10 };
}

/**
 * Stats block. The YAML carries each attribute's starting score (number
 * shorthand or object form). Save proficiencies are derived from the
 * resolved features view's `Save P.` / `Save J.` / `Save E.` traits —
 * so a Cleric with `Save P.: [WIS, CHA]` automatically sees those two
 * save dots filled. `Save B.` adds a flat per-attribute bonus. ASI picks
 * fold into the displayed score on top of the base.
 */
export const stats: EntityBlock<StatsProps, CharacterEntity> = ({
  self,
  blocks,
  lookup,
  expressions,
}) => {
  const header = (blocks as any).header;
  const features = (blocks as any).features as FeaturesBlockData | undefined;
  const inventory = (blocks as any).inventory;
  const view = lookup.$features?.(header, features?.choices, features?.additional, inventory);
  const asi = sumAsi(view?.traits?.["Ability Scores"]);
  const saveProfsAuto = saveProfLevelsFromTraits(view?.traits ?? {});
  const saveBonusAuto = saveBonusFromTraits(view?.traits ?? {});
  const saveVantageAuto = saveVantageFromTraits(view?.traits ?? {});

  return (
    <section aria-details="Character Stats">
      {ATTRS.map((attr) => {
        const cell = readAttr((self as Record<string, unknown>)[attr]);
        const finalValue = cell.baseValue + asi[attr];
        const proficiency = cell.saveProf ?? saveProfsAuto[attr];
        const saveBonus = expressions.ModifierTotal({
          attribute: attr,
          proficiency,
          bonus: (cell.saveBonus ?? 0) + saveBonusAuto[attr],
        });
        return (
          <Stat
            key={attr}
            value={finalValue}
            saveBonus={saveBonus}
            proficiency={proficiency}
            saveVantage={saveVantageAuto[attr]}
          >
            {attr}
          </Stat>
        );
      })}
    </section>
  );
};

export default stats;
