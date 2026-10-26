/**
 * `rpg character <note>` — the sheet as the plugin calculates it: the
 * system's own expressions (Modifier, ArmorClass, HitPoints, SessionActions…)
 * bound to the note's blocks, and its resolved features (classes, lineage,
 * heritage, background, talents, items).
 */

import { buildEntityContext, entityTypeOf } from "lib/services/entity-context";
import type { Ctx } from "../app";
import { codeBlocksOf } from "../fences";

const ATTRS = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];
const LONG: Record<string, string> = {
  STR: "Strength",
  DEX: "Dexterity",
  CON: "Constitution",
  INT: "Intelligence",
  WIS: "Wisdom",
  CHA: "Charisma",
};

export interface CharacterSheet {
  name: string;
  note: string;
  entity: string;
  identity: Record<string, unknown>;
  level?: number;
  proficiencyBonus?: number;
  armorClass?: number;
  hitPoints?: { current: number; max: number; temp?: number };
  speed?: unknown;
  initiative?: number;
  abilities: Array<{ ability: string; score?: number; modifier?: number; save?: number; saveProficient: boolean }>;
  skills: Array<{ skill: string; modifier?: number; passive?: number }>;
  traits: Record<string, string[]>;
  features: Array<{ source: string; kind: string; level?: number; features: Array<{ name: string; text?: string }> }>;
  pendingChoices: Array<{ source: string; feature: string; remaining: number; options: string[] }>;
  casters: Array<{ source: string; ability: string; level: number; slots: number[] }>;
  actions: unknown[];
  conditions?: unknown;
  inventory?: unknown;
  errors: string[];
}

const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

export async function characterSheet(ctx: Ctx, ref: string): Promise<CharacterSheet> {
  const file = ctx.note(ref);
  const system = await ctx.systemFor(file.path);
  if (!system) throw new Error(`No system is mapped for ${file.path} (Settings → system mappings).`);
  const text = ctx.vault.readSync(file);
  const codeBlocks = codeBlocksOf(text);
  const entity = entityTypeOf(system, codeBlocks) ?? "character";
  const fm = ctx.metadataCache.frontmatterOf(file) ?? {};
  const { blocks, lookup, expressions: x } = buildEntityContext(system, entity, codeBlocks, fm);
  const errors: string[] = [];
  const call = <T>(name: string, ...args: unknown[]): T | undefined => {
    if (!x[name]) return undefined;
    try {
      return x[name](...args) as T;
    } catch (err) {
      errors.push(`${name}: ${err instanceof Error ? err.message : String(err)}`);
      return undefined;
    }
  };

  const header = (blocks.header ?? {}) as Record<string, unknown>;
  const featuresBlock = (blocks.features ?? {}) as { choices?: unknown; additional?: unknown };
  let view:
    | {
        sources?: Array<{
          source: string;
          kind: string;
          level?: number;
          features: Array<{ name: string; text?: string }>;
        }>;
        traits?: Record<string, string[]>;
        pendingChoices?: Array<{
          source: string;
          feature: { name: string };
          remaining: number;
          options: Array<{ name?: string; value?: string } | string>;
        }>;
        casters?: Array<{ source: string; ability: string; level: number }>;
      }
    | undefined;
  try {
    const $features = (lookup as { $features?: (...a: unknown[]) => typeof view }).$features;
    view = $features?.(header, featuresBlock.choices, featuresBlock.additional, blocks.inventory);
  } catch (err) {
    errors.push(`features: ${err instanceof Error ? err.message : String(err)}`);
  }
  const traits = view?.traits ?? {};
  const saveTraits = Object.entries(traits)
    .filter(([k]) => /sav/i.test(k))
    .flatMap(([, v]) => v.map((s) => s.toLowerCase()));

  const stats = (blocks.stats ?? {}) as Record<string, unknown>;
  const abilities = ATTRS.map((a) => {
    const cell = stats[a];
    const score = num(cell) ?? num((cell as { value?: unknown } | undefined)?.value);
    const saveProficient = saveTraits.some((s) => s.includes(LONG[a].toLowerCase()) || s === a.toLowerCase());
    return {
      ability: LONG[a],
      score,
      modifier: call<number>("Modifier", a),
      save: call<number>("ModifierTotal", { attribute: a, proficiency: saveProficient ? 1 : 0, bonus: 0 }),
      saveProficient,
    };
  });

  const skillNames = (system.skills ?? []).map((s) => s.$name);
  const skills = skillNames.map((skill) => {
    const modifier = call<number>("Modifier", skill);
    return { skill, modifier, ...(modifier !== undefined ? { passive: 10 + modifier } : {}) };
  });

  const health = (blocks.health ?? {}) as Record<string, unknown>;
  const hp = call<{ current: number; max: number }>("HitPoints");
  const casters = (view?.casters ?? []).map((c) => ({
    source: c.source,
    ability: c.ability,
    level: c.level,
    slots: call<number[]>("SpellSlots", c.source) ?? [],
  }));

  return {
    name: String(header.name ?? file.basename),
    note: file.path,
    entity,
    identity: Object.fromEntries(
      ["classes", "lineage", "heritage", "background", "xp", "luck"]
        .filter((k) => header[k] !== undefined)
        .map((k) => [k, header[k]])
    ),
    level: call<number>("CharacterLevel"),
    proficiencyBonus: call<number>("ProficiencyBonus"),
    armorClass: call<number>("ArmorClass"),
    ...(hp ? { hitPoints: { ...hp, ...(num(health.temp_hp) ? { temp: num(health.temp_hp) } : {}) } } : {}),
    speed: health.speed,
    initiative: call<number>("Modifier", "Initiative"),
    abilities,
    skills,
    traits,
    features: (view?.sources ?? []).map((s) => ({
      source: s.source,
      kind: s.kind,
      level: s.level,
      features: s.features.map((f) => ({ name: f.name, ...(f.text ? { text: f.text.trim() } : {}) })),
    })),
    pendingChoices: (view?.pendingChoices ?? []).map((p) => ({
      source: p.source,
      feature: p.feature.name,
      remaining: p.remaining,
      options: p.options.map((o) => (typeof o === "string" ? o : (o.name ?? o.value ?? JSON.stringify(o)))),
    })),
    casters,
    actions: call<unknown[]>("SessionActions") ?? [],
    conditions: health.conditions ?? undefined,
    inventory: blocks.inventory,
    errors,
  };
}

const sign = (n?: number) => (n === undefined ? "?" : n >= 0 ? `+${n}` : String(n));
const linkText = (v: unknown): string =>
  typeof v === "string"
    ? v.replace(/^\[\[|\]\]$/g, "")
    : Array.isArray(v)
      ? v.map(linkText).join(", ")
      : v && typeof v === "object"
        ? Object.entries(v as Record<string, unknown>)
            .filter(([k]) => ["name", "file", "level"].includes(k))
            .map(([k, val]) => (k === "level" ? `${val}` : linkText(val)))
            .join(" ")
        : String(v);

export function renderCharacter(s: CharacterSheet): string {
  const lines: string[] = [`# ${s.name}`, `(${s.note})`, ""];
  for (const [k, v] of Object.entries(s.identity)) lines.push(`- **${k}**: ${linkText(v)}`);
  lines.push(
    "",
    `Level ${s.level ?? "?"} · PB ${sign(s.proficiencyBonus)} · AC ${s.armorClass ?? "?"} · HP ${s.hitPoints ? `${s.hitPoints.current}/${s.hitPoints.max}${s.hitPoints.temp ? ` (+${s.hitPoints.temp} temp)` : ""}` : "?"} · Initiative ${sign(s.initiative)}${s.speed ? ` · Speed ${linkText((s.speed as { value?: unknown }).value ?? s.speed)} ft` : ""}`,
    "",
    "## Abilities",
    "| Ability | Score | Mod | Save |",
    "|---|---|---|---|",
    ...s.abilities.map(
      (a) =>
        `| ${a.ability} | ${a.score ?? "?"} | ${sign(a.modifier)} | ${sign(a.save)}${a.saveProficient ? " ●" : ""} |`
    ),
    "",
    "## Skills",
    s.skills.map((k) => `${k.skill} ${sign(k.modifier)}`).join(" · "),
    ""
  );
  if (Object.keys(s.traits).length) {
    lines.push("## Traits");
    for (const [k, v] of Object.entries(s.traits)) lines.push(`- **${k}**: ${v.join(", ")}`);
    lines.push("");
  }
  if (s.casters.length) {
    lines.push("## Spellcasting");
    for (const c of s.casters)
      lines.push(
        `- ${c.source} (level ${c.level}, ${c.ability || "ability not picked"}): slots ${c.slots.join(" / ") || "none"}`
      );
    lines.push("");
  }
  if (s.actions.length) {
    lines.push("## Actions");
    for (const a of s.actions as Array<Record<string, unknown>>) {
      const bits = [a.name, a.roll ?? a.attack ?? a.toHit, a.damage, a.range].filter(
        (b) => b !== undefined && b !== ""
      );
      lines.push(`- ${bits.map((b) => (typeof b === "object" ? JSON.stringify(b) : String(b))).join(" · ")}`);
    }
    lines.push("");
  }
  if (s.features.length) {
    lines.push("## Features");
    for (const src of s.features) {
      lines.push(`### ${src.source} (${src.kind}${src.level ? ` ${src.level}` : ""})`);
      for (const f of src.features)
        lines.push(`- **${f.name}**${f.text ? `: ${f.text.replace(/\s+/g, " ").slice(0, 400)}` : ""}`);
    }
    lines.push("");
  }
  if (s.pendingChoices.length) {
    lines.push("## Choices still to make");
    for (const p of s.pendingChoices)
      lines.push(`- ${p.source} — ${p.feature}: pick ${p.remaining} of ${p.options.join(", ")}`);
    lines.push("");
  }
  if (s.inventory) lines.push("## Inventory", "```yaml", JSON.stringify(s.inventory, null, 1), "```", "");
  if (s.errors.length) lines.push("## Problems", ...s.errors.map((e) => `- ${e}`));
  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
