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

/** Strip a Saves trait value (`"WIS"`, `"+CHA"`, `"WIS"`, etc.) down to a
 *  canonical 3-letter attribute code. */
function asAttrCode(raw: unknown): AttrCode | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw.replace(/^\+/, "").trim().toUpperCase();
  return ATTR_ALIAS[cleaned] ?? null;
}

function saveProfsFromTraits(values: string[] | undefined): Set<AttrCode> {
  const out = new Set<AttrCode>();
  for (const raw of values ?? []) {
    const code = asAttrCode(raw);
    if (code) out.add(code);
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
 * resolved features view's `Saves` trait — so a Cleric with `Saves:
 * [WIS, CHA]` automatically sees those two save dots filled. ASI picks
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
  const view = lookup.$features?.(header, features?.choices, features?.additional);
  const asi = sumAsi(view?.traits?.["Ability Scores"]);
  const saveProfsAuto = saveProfsFromTraits(view?.traits?.["Saves"]);

  return (
    <section aria-label="Character Stats">
      {ATTRS.map((attr) => {
        const cell = readAttr((self as Record<string, unknown>)[attr]);
        const finalValue = cell.baseValue + asi[attr];
        const proficiency = cell.saveProf ?? (saveProfsAuto.has(attr) ? 1 : 0);
        const saveBonus = expressions.ModifierTotal({
          attribute: attr,
          proficiency,
          bonus: cell.saveBonus ?? 0,
        });
        return (
          <Stat
            key={attr}
            value={finalValue}
            saveBonus={saveBonus}
            proficiency={proficiency}
          >
            {attr}
          </Stat>
        );
      })}
    </section>
  );
};

export default stats;
