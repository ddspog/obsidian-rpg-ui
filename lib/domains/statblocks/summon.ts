/**
 * A summon's statblock (`rpg stat.summon`): a creature whose numbers come from
 * whoever calls it. Its stats and features hold formulas (`{{ 13 + circle }}`)
 * over parameters (a spell's circle, the summoner's PB or class level), which
 * are set by hand or worked out from a character's numbers (`from:`). Forms
 * (a beast spirit's avian, agile, aquatic or sturdy shape) change some stats
 * and add features. A thrall (`apply:`) is a creature of the bestiary with a
 * template applied, plus what its summoner adds. Pure: no Obsidian and no I/O.
 */

import { evaluate, fillFormulasMarkdown, type FormulaVars } from "./formula";
import type { StatFeatureRef } from "./types";

export interface SummonParam {
  name: string;
  label?: string;
  default?: number;
  min?: number;
  max?: number;
  /** Shown as 7th, 8th… */
  ordinal?: boolean;
  /** Worked out from the summoner's numbers (`pb`, `level_ranger`, `mod_wis`…). */
  from?: string;
}

export interface SummonFeature {
  name?: string;
  type?: string;
  text?: string;
  ref?: string;
  [param: string]: unknown;
}

export interface SummonForm {
  name: string;
  stats?: Record<string, string>;
  features?: SummonFeature[];
}

export interface SummonApply {
  /** The templates to choose from (links to template notes). */
  templates: string[];
  /** The creature types it may be applied to. */
  types?: string[];
  /** Added to its Armor Class (a formula: `pb`). */
  ac?: string;
  /** Added to its damage rolls, as a note (a formula: `pb`). */
  damage?: string;
  /** Temporary hit points when it is made (a formula: `level_wizard`). */
  tempHp?: string;
}

export interface SummonBlock {
  name: string;
  type: string;
  /** What calls it ("Summon Leviathan Avatar", "Pack Master"). */
  summoner?: string;
  params: SummonParam[];
  forms: SummonForm[];
  stats: Record<string, string>;
  abilities: Record<string, number>;
  features: SummonFeature[];
  apply?: SummonApply;
  text?: string;
}

/** The block's YAML read. */
export function parseSummonBlock(raw: Record<string, unknown>): SummonBlock {
  const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  const params = Array.isArray(raw.params)
    ? arr<SummonParam>(raw.params)
    : raw.params && typeof raw.params === "object"
      ? Object.entries(raw.params as Record<string, Omit<SummonParam, "name">>).map(([name, p]) => ({ name, ...p }))
      : [];
  const stats: Record<string, string> = {};
  for (const [k, v] of Object.entries((raw.stats as Record<string, unknown>) ?? {})) stats[k] = String(v ?? "");
  const abilities: Record<string, number> = {};
  for (const [k, v] of Object.entries((raw.abilities as Record<string, unknown>) ?? {})) abilities[k] = Number(v) || 0;
  return {
    name: String(raw.name ?? ""),
    type: String(raw.type ?? ""),
    ...(raw.summoner ? { summoner: String(raw.summoner) } : {}),
    params: params.filter((p) => p && typeof p.name === "string"),
    forms: arr<SummonForm>(raw.forms).filter((f) => f && typeof f.name === "string"),
    stats,
    abilities,
    features: arr<SummonFeature>(raw.features).filter((f) => f && typeof f === "object"),
    ...(raw.apply && typeof raw.apply === "object"
      ? {
          apply: {
            ...(raw.apply as SummonApply),
            templates: arr<unknown>((raw.apply as Record<string, unknown>).templates).map((t) =>
              Array.isArray(t) ? `[[${String((t as unknown[]).flat(3)[0])}]]` : String(t)
            ),
          },
        }
      : {}),
    ...(typeof raw.text === "string" ? { text: raw.text } : {}),
  };
}

/**
 * The values of the parameters: set by hand (`set`), worked out from a
 * summoner's numbers (`from`), or their defaults; each kept within its bounds.
 * The summoner's numbers are given too, so a formula may use `pb` directly.
 */
export function summonVars(block: SummonBlock, set: Record<string, number>, summoner: FormulaVars = {}): FormulaVars {
  const vars: FormulaVars = { ...summoner };
  for (const p of block.params) {
    let v: number | undefined = set[p.name];
    if (v === undefined && p.from) v = evaluate(p.from, summoner);
    if (v === undefined) v = p.default ?? p.min ?? 0;
    if (p.min !== undefined) v = Math.max(p.min, v);
    if (p.max !== undefined) v = Math.min(p.max, v);
    vars[p.name] = v;
  }
  return vars;
}

export interface FilledSummon {
  stats: Record<string, string>;
  /** Features written in the block, their text filled (Markdown with formula spans). */
  features: Array<{ name?: string; type?: string; text: string }>;
  /** Features that are refs into a features note, with the values to fill them. */
  refs: StatFeatureRef[];
}

/** The summon with its formulas worked out for these values and this form. */
export function fillSummon(block: SummonBlock, vars: FormulaVars, form?: string): FilledSummon {
  const chosen = block.forms.find((f) => f.name === form);
  const stats: Record<string, string> = {};
  for (const [k, v] of Object.entries({ ...block.stats, ...(chosen?.stats ?? {}) })) {
    stats[k] = fillFormulasMarkdown(v, vars);
  }
  const features: FilledSummon["features"] = [];
  const refs: StatFeatureRef[] = [];
  for (const f of [...block.features, ...(chosen?.features ?? [])]) {
    if (f.ref) {
      refs.push({ ...(f as StatFeatureRef), ...vars });
      continue;
    }
    features.push({
      ...(f.name ? { name: fillFormulasMarkdown(f.name, vars) } : {}),
      ...(f.type ? { type: f.type } : {}),
      text: fillFormulasMarkdown(String(f.text ?? ""), vars),
    });
  }
  return { stats, features, refs };
}

/** A CR as written ("1/4", "3") as a number. */
export function crValue(v: unknown): number {
  const t = String(v ?? "0").trim();
  const f = t.match(/^(\d+)\/(\d+)$/);
  if (f) return Number(f[1]) / Number(f[2]);
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : 0;
}

/** "7" → "7th". */
export function ordinal(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th");
  return `${n}${s}`;
}
