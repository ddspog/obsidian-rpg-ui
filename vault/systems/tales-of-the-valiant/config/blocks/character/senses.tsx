import * as React from "react";
import { EntityBlock } from "rpg-ui-toolkit";
import { SensesProps, SenseEntry } from "./senses.types";
import { CharacterEntity } from "../../entities/character.types";
import { SkillDetails } from "../../entities/character.common";
import type { FeaturesBlockData } from "./features.types";

/** Strip trait-value prefix (`+`, `[[…]]`, alias pipe) to the bare name. */
function bareLabel(raw: string): string {
  return raw
    .replace(/^\+/, "")
    .replace(/^\[\[/, "")
    .replace(/\]\]$/, "")
    .split("|")[0]
    .trim();
}

/** Count per-skill entries in a trait list, keeping only known skill names. */
function countProfs(traitValues: string[] | undefined, valid: Set<string>) {
  const counts = new Map<string, number>();
  for (const raw of traitValues ?? []) {
    const name = bareLabel(raw);
    if (!valid.has(name)) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return counts;
}

const SENSES_SKILLS = new Set(["Insight", "Investigation", "Perception"]);

/** Normalise a sense entry. Accepts shorthand strings (`"darkvision 60"`,
 *  `"+darkvision 60"`, `"[[Darkvision]] 60"`) and full objects. */
function normaliseSense(raw: SenseEntry | unknown): { type: string; range?: number } | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    const cleaned = bareLabel(raw);
    const m = cleaned.match(/^(.+?)\s+(\d+)\s*(?:ft\.?)?$/i);
    if (m) {
      const range = parseInt(m[2], 10);
      return { type: m[1].trim(), range: Number.isFinite(range) ? range : undefined };
    }
    return cleaned ? { type: cleaned } : null;
  }
  if (typeof raw === "object") {
    const obj = raw as { type?: unknown; range?: unknown };
    const type = typeof obj.type === "string" ? obj.type.trim() : "";
    if (!type) return null;
    const range = typeof obj.range === "number" && Number.isFinite(obj.range) ? obj.range : undefined;
    return { type, range };
  }
  return null;
}

export const senses: EntityBlock<SensesProps, CharacterEntity> = ({
  self,
  blocks,
  lookup,
  expressions,
}) => {
  const header = (blocks as any).header;
  const features = (blocks as any).features as FeaturesBlockData | undefined;
  const view = lookup.$features?.(header, features?.choices, features?.additional);
  const traits = view?.traits ?? {};

  // Passive Insight / Investigation / Perception derive proficiency the
  // same way the skills block does, so the three values stay consistent
  // when the skills YAML doesn't explicitly carry them.
  const profCounts = countProfs(traits["Skill P."], SENSES_SKILLS);
  const halfNames = new Set<string>();
  for (const raw of traits["Skill P. (½)"] ?? []) {
    const name = bareLabel(raw);
    if (SENSES_SKILLS.has(name)) halfNames.add(name);
  }

  const skillsBlock = (blocks as any).skills as Record<string, Partial<SkillDetails> | undefined> | undefined;
  const resolveSkill = (name: "Insight" | "Investigation" | "Perception"): SkillDetails => {
    const override = skillsBlock?.[name];
    if (override?.proficiency != null) {
      return {
        proficiency: override.proficiency,
        vantage: override.vantage ?? 0,
        bonus: override.bonus ?? 0,
      };
    }
    const count = profCounts.get(name) ?? 0;
    const proficiency = count >= 2 ? 2 : count >= 1 ? 1 : halfNames.has(name) ? 0.5 : 0;
    return {
      proficiency,
      vantage: override?.vantage ?? 0,
      bonus: override?.bonus ?? 0,
    };
  };

  const insight = resolveSkill("Insight");
  const investigation = resolveSkill("Investigation");
  const perception = resolveSkill("Perception");

  // Senses list: explicit YAML wins as-is; otherwise derive from a `Senses`
  // trait emitted by lineage/talent features (e.g. `Senses: ["darkvision 60"]`
  // on a Drow lineage). `additional.senses` always appends.
  const yamlSenses = (self.senses_list ?? []) as SenseEntry[];
  const traitSenses = traits["Senses"] ?? [];
  const additional = (self.additional?.senses ?? []) as SenseEntry[];
  const base = yamlSenses.length > 0 ? yamlSenses : traitSenses;
  const merged: { type: string; range?: number }[] = [];
  const seen = new Set<string>();
  for (const raw of [...base, ...additional]) {
    const norm = normaliseSense(raw);
    if (!norm) continue;
    const key = `${norm.type.toLowerCase()}:${norm.range ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(norm);
  }

  return (
    <section aria-label="Character Senses">
      <header className="rpg-tag-heading"><span>Passive</span></header>
      <output aria-label="Passive Insight">
        <data>{expressions.Passive({
          attribute: 'WIS',
          proficiency: insight.proficiency,
          vantage: insight.vantage,
          bonus: insight.bonus,
        })}</data>
        <small>Insight</small>
      </output>
      <output aria-label="Passive Investigation">
        <data>{expressions.Passive({
          attribute: 'INT',
          proficiency: investigation.proficiency,
          vantage: investigation.vantage,
          bonus: investigation.bonus,
        })}</data>
        <small>Investigation</small>
      </output>
      <output aria-label="Passive Perception">
        <data>{expressions.Passive({
          attribute: 'WIS',
          proficiency: perception.proficiency,
          vantage: perception.vantage,
          bonus: perception.bonus,
        })}</data>
        <small>Perception</small>
      </output>
      <dl aria-label="Senses List">
        <dt className="rpg-tag-heading"><span>Senses</span></dt>
        {merged.length === 0 ? (
          <dd aria-details="No Senses"><span>—</span></dd>
        ) : (
          merged.map((sense, i) => (
            <dd key={i}>
              <span>{sense.type}</span>
              {sense.range != null && <span aria-details="Sense Range">{sense.range} ft.</span>}
            </dd>
          ))
        )}
      </dl>
    </section>
  );
};

export default senses;
