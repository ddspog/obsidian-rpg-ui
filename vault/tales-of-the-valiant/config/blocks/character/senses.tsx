import * as React from "react";
import { EntityBlock } from "rpg-ui-toolkit";
import { SensesProps, SenseEntry } from "./senses.types";
import { CharacterEntity } from "../../entities/character.types";
import { SkillDetails } from "../../entities/character.common";
import type { FeaturesBlockData } from "./features.types";

/** Strip trait-value prefix (`+`, `[[…]]`, alias pipe) to the bare name. */
function bareLabel(raw: string): string {
  return raw.replace(/^\+/, "").replace(/^\[\[/, "").replace(/\]\]$/, "").split("|")[0].trim();
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

/** Unwrap YAML's `[[Foo]]` nested-flow-array shape (`[["Foo"]]`) back to
 *  a plain string so the wikilink parser below sees a consistent input. */
function stringifyMaybeArray(v: unknown): string {
  let cur: unknown = v;
  while (Array.isArray(cur)) cur = cur[0];
  return typeof cur === "string" ? cur : "";
}

/** Parse a leading `[[target|alias]]` wikilink off `text`. Returns the
 *  visible label, the link target, and whatever text followed the link
 *  (commonly a `60 ft.` range suffix). Returns null when no wikilink is
 *  present at the start so the caller can fall back to plain-string
 *  parsing. */
function parseLeadingWikilink(text: string): { label: string; link: string; rest: string } | null {
  const m = text.match(/^\[\[([^\]]+)\]\](.*)$/);
  if (!m) return null;
  const inner = m[1];
  const pipe = inner.indexOf("|");
  const link = (pipe >= 0 ? inner.slice(0, pipe) : inner).trim();
  const label = (pipe >= 0 ? inner.slice(pipe + 1) : inner).trim();
  return { label, link, rest: m[2].trim() };
}

/** Normalise a sense entry. Accepts shorthand strings (`"darkvision 60"`,
 *  `"+darkvision 60"`, `"[[Darkvision]] 60"`, `"[[path|Darvision]] 60"`)
 *  and full objects. When the entry includes a wikilink, `link` carries
 *  the target so the renderer can surface it as an Obsidian
 *  internal-link. */
function normaliseSense(raw: SenseEntry | unknown): { type: string; range?: number; link?: string } | null {
  if (raw == null) return null;
  if (typeof raw === "string" || Array.isArray(raw)) {
    const text = (typeof raw === "string" ? raw : stringifyMaybeArray(raw)).replace(/^\+/, "").trim();
    if (!text) return null;
    const wl = parseLeadingWikilink(text);
    if (wl) {
      const rangeMatch = wl.rest.match(/^(\d+)\s*(?:ft\.?)?$/i);
      const range = rangeMatch ? parseInt(rangeMatch[1], 10) : undefined;
      return {
        type: wl.label,
        range: Number.isFinite(range) ? range : undefined,
        link: wl.link,
      };
    }
    const m = text.match(/^(.+?)\s+(\d+)\s*(?:ft\.?)?$/i);
    if (m) {
      const range = parseInt(m[2], 10);
      return { type: m[1].trim(), range: Number.isFinite(range) ? range : undefined };
    }
    return { type: text };
  }
  if (typeof raw === "object") {
    const obj = raw as { type?: unknown; range?: unknown; link?: unknown };
    const rawType = stringifyMaybeArray(obj.type).trim();
    if (!rawType) return null;
    const wl = parseLeadingWikilink(rawType);
    const explicitLink = stringifyMaybeArray(obj.link).trim() || undefined;
    const type = wl ? wl.label : rawType;
    const link = wl?.link ?? explicitLink;
    const range = typeof obj.range === "number" && Number.isFinite(obj.range) ? obj.range : undefined;
    return { type, range, link };
  }
  return null;
}

export const senses: EntityBlock<SensesProps, CharacterEntity> = ({ self, blocks, lookup, expressions }) => {
  const header = (blocks as any).header;
  const features = (blocks as any).features as FeaturesBlockData | undefined;
  const inventory = (blocks as any).inventory;
  const view = lookup.$features?.(header, features?.choices, features?.additional, inventory);
  const traits = view?.traits ?? {};

  // Passive Insight / Investigation / Perception derive proficiency the
  // same way the skills block does, so the three values stay consistent
  // when the skills YAML doesn't explicitly carry them. Mirrors the full
  // trait taxonomy: `Skill P.` (single → prof, double → expertise),
  // `Skill E.` (expertise outright), `Skill J.` (half), `Skill A./D.`
  // (vantage), `Skill B.` (flat bonus on top of the passive 10+mod).
  const profCounts = countProfs(traits["Skill P."], SENSES_SKILLS);
  for (const raw of traits["Skill E."] ?? []) {
    const name = bareLabel(raw);
    if (SENSES_SKILLS.has(name)) profCounts.set(name, Math.max(profCounts.get(name) ?? 0, 2));
  }
  const halfNames = new Set<string>();
  for (const raw of traits["Skill J."] ?? []) {
    const name = bareLabel(raw);
    if (SENSES_SKILLS.has(name)) halfNames.add(name);
  }
  const vantageByName = new Map<string, number>();
  const bonusByName = new Map<string, number>();
  for (const raw of traits["Skill A."] ?? []) {
    const name = bareLabel(raw);
    if (SENSES_SKILLS.has(name)) vantageByName.set(name, (vantageByName.get(name) ?? 0) + 1);
  }
  for (const raw of traits["Skill D."] ?? []) {
    const name = bareLabel(raw);
    if (SENSES_SKILLS.has(name)) vantageByName.set(name, (vantageByName.get(name) ?? 0) - 1);
  }
  for (const raw of traits["Skill B."] ?? []) {
    const match = raw.match(/^\s*([+\-]?\d+(?:\.\d+)?)\s+(.+?)\s*$/);
    if (!match) continue;
    const bonus = parseFloat(match[1]);
    const name = bareLabel(match[2]);
    if (!Number.isFinite(bonus) || !SENSES_SKILLS.has(name)) continue;
    bonusByName.set(name, (bonusByName.get(name) ?? 0) + bonus);
  }

  const skillsBlock = (blocks as any).skills as Record<string, Partial<SkillDetails> | undefined> | undefined;
  const resolveSkill = (name: "Insight" | "Investigation" | "Perception"): SkillDetails => {
    const override = skillsBlock?.[name];
    if (override?.proficiency != null) {
      return {
        proficiency: override.proficiency,
        vantage: override.vantage ?? vantageByName.get(name) ?? 0,
        bonus: override.bonus ?? bonusByName.get(name) ?? 0,
      };
    }
    const count = profCounts.get(name) ?? 0;
    const proficiency = count >= 2 ? 2 : count >= 1 ? 1 : halfNames.has(name) ? 0.5 : 0;
    return {
      proficiency,
      vantage: override?.vantage ?? vantageByName.get(name) ?? 0,
      bonus: override?.bonus ?? bonusByName.get(name) ?? 0,
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
  const merged: { type: string; range?: number; link?: string }[] = [];
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
    <section aria-details="Character Senses">
      <header className="rpg-tag-heading">
        <span>Passive</span>
      </header>
      <output aria-label="Passive Insight">
        <data>
          {expressions.Passive({
            attribute: "WIS",
            proficiency: insight.proficiency,
            vantage: insight.vantage,
            bonus: insight.bonus,
          })}
        </data>
        <small>Insight</small>
      </output>
      <output aria-label="Passive Investigation">
        <data>
          {expressions.Passive({
            attribute: "INT",
            proficiency: investigation.proficiency,
            vantage: investigation.vantage,
            bonus: investigation.bonus,
          })}
        </data>
        <small>Investigation</small>
      </output>
      <output aria-label="Passive Perception">
        <data>
          {expressions.Passive({
            attribute: "WIS",
            proficiency: perception.proficiency,
            vantage: perception.vantage,
            bonus: perception.bonus,
          })}
        </data>
        <small>Perception</small>
      </output>
      <dl aria-label="Senses List">
        <dt className="rpg-tag-heading">
          <span>Senses</span>
        </dt>
        {merged.length === 0 ? (
          <dd aria-details="No Senses">
            <span>—</span>
          </dd>
        ) : (
          merged.map((sense, i) => (
            <dd key={i}>
              {sense.link ? (
                <a className="internal-link" href={sense.link} data-href={sense.link}>
                  {sense.type}
                </a>
              ) : (
                <span>{sense.type}</span>
              )}
              {sense.range != null && <span aria-details="Sense Range">{sense.range} ft.</span>}
            </dd>
          ))
        )}
      </dl>
    </section>
  );
};

export default senses;
