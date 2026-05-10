import * as React from "react";
import { EntityBlock, Section, Article, HGroup, Line, Badge, Stat, DeathSaveDots, Progress, DiceTray, PortraitThumb, ConditionPill } from "rpg-ui-toolkit";
import { HealthProps } from "./health.types";
import { CharacterEntity } from "../../entities/character.types";
import type { FeaturesBlockData } from "./features.types";

/** Extract display label and linkpath from any frontmatter condition value */
function parseCondition(raw: unknown): { label: string; linkpath: string | null } {
  if (Array.isArray(raw)) raw = raw[0];
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    raw = obj.link ?? obj.path ?? obj.file ?? obj.src ?? "";
  }
  let val = typeof raw === "string" ? raw : String(raw ?? "");
  const aliasMatch = val.match(/^\[\[(.+?)\|(.+)\]\]$/);
  if (aliasMatch) return { linkpath: aliasMatch[1].trim(), label: aliasMatch[2].trim() };
  const wikiMatch = val.match(/^\[\[(.+)\]\]$/);
  if (wikiMatch) val = wikiMatch[1].trim();
  const segment = val.split(/[/\\]/).pop() ?? val;
  return { label: segment.replace(/\.[^.]+$/, "").trim(), linkpath: val || null };
}

/** Parse a trait value that may carry a leading sign (`+3`) or wikilink
 *  (`[[…]]`) and extract the underlying number. Non-numeric values return 0. */
function parseNumericTrait(raw: unknown): number {
  if (typeof raw === "number") return raw;
  if (typeof raw !== "string") return 0;
  const cleaned = raw.replace(/^\[\[/, "").replace(/\]\]$/, "").split("|")[0].trim();
  const n = parseFloat(cleaned.replace(/^[+\s]+/, ""));
  return Number.isFinite(n) ? n : 0;
}

export const health: EntityBlock<HealthProps, CharacterEntity> = ({ self, blocks, lookup, expressions }) => {
  const deathSaves = self.death_saves ?? { successes: 0, failures: 0 };
  const yamlHitDice = self.hit_dice ?? {};
  const conditions = (self.conditions ?? []) as unknown[];
  const exhaustion = self.exhaustion ?? 0;

  // Pull traits off the resolved features view so heritages / talents that
  // grant `Natural AC` or initiative proficiency fold automatically into
  // the defense badges next to the portrait. Mirrors how the senses block
  // consumes `Senses` / `Skill P.` from the same map.
  const header = (blocks as unknown as { header?: unknown }).header;
  const featuresBlock = (blocks as unknown as { features?: FeaturesBlockData }).features;
  const inventory = (blocks as unknown as { inventory?: unknown }).inventory;
  const view = lookup.$features?.(header, featuresBlock?.choices, featuresBlock?.additional, inventory);
  const traits = view?.traits ?? {};

  // Hit dice: each class file declares its hit-die face via a
  // `Hit Die: d8` trait on the class's root `rpg feature.details`
  // block. We sum levels per die face to build the max dice pool, and
  // merge the YAML `hit_dice.current` to preserve unspent state across
  // renders. Classes missing the trait drop out silently — DMs can still
  // author an explicit `hit_dice:` block to override.
  const hitDice = resolveHitDice(view, yamlHitDice);

  // Speed: authors can drop the YAML field entirely and let heritage /
  // class traits drive the numbers. Each `Walk` / `Fly` / `Swim` /
  // `Burrow` / `Climb` trait contributes one Stat.Diamond — the trait's
  // value is either a bare number (`"30"`) or a "<number> ft." string.
  // YAML speeds still win when declared so GMs can override on a per-
  // character basis without touching the trait taxonomy.
  const speeds = resolveSpeeds(self.speed, traits);

  // Natural AC: author may set `natural_ac:` in the YAML or a feature may
  // grant it via a `Natural AC` trait entry (Monk-style unarmored defense,
  // heritage armored skin, …). Take the highest so a trait grant never
  // regresses a player's written AC but a high feature floor still wins.
  const naturalAcFromTraits = (traits["Natural AC"] ?? [])
    .map(parseNumericTrait)
    .filter((n) => Number.isFinite(n) && n > 0);
  const naturalAc = Math.max(self.natural_ac ?? 10, ...(naturalAcFromTraits.length > 0 ? naturalAcFromTraits : [0]));

  // Initiative bonus: the DEX modifier sets the baseline (standard 5e /
  // ToV rule), then the trait taxonomy layers on top — `Initiative P.` =
  // full proficiency, `Initiative J.` (Jack) = half, `Initiative E.` =
  // expertise (double PB). Flat numeric bonuses come in via
  // `Initiative B.`. All three fold through `expressions.ModifierTotal`
  // so the DEX modifier automatically reflects ASI picks. Advantage /
  // disadvantage ride the vantage badge on the diamond (below).
  const initExpertise = (traits["Initiative E."] ?? []).length > 0;
  const initFull = (traits["Initiative P."] ?? []).length > 0;
  const initHalf = (traits["Initiative J."] ?? []).length > 0;
  const initProfLevel = initExpertise ? 2 : initFull ? 1 : initHalf ? 0.5 : 0;
  const initFlat = (traits["Initiative B."] ?? []).reduce((n, raw) => n + parseNumericTrait(raw), 0);
  const initiativeTotal = expressions.ModifierTotal({
    attribute: "DEX",
    proficiency: initProfLevel,
    bonus: initFlat,
  });
  // Advantage / disadvantage for initiative are flag-shaped — presence
  // of any value in the trait map is enough, since there's one
  // initiative track per character.
  const initAdv = (traits["Initiative A."] ?? []).length > 0;
  const initDis = (traits["Initiative D."] ?? []).length > 0;
  const initVantage: "adv" | "dis" | undefined =
    initAdv && !initDis ? "adv" : initDis && !initAdv ? "dis" : undefined;

  const handleSpendDie = (dieType: string) => {
    const current = hitDice[dieType]?.current ?? 0;
    if (current <= 0) return;
    // Persist in the shorthand number form (`hit_dice.d8: 2`) since
    // `max` always re-derives from class traits on render — YAML stays
    // compact and reads naturally.
    self.setHit_dice({
      ...yamlHitDice,
      [dieType]: current - 1,
    });
  };

  // Equipped armor + shield (read from sibling inventory + item lookup):
  // - Body armor → base AC formula (10 / 11+DEX / 12+DEX≤2 / 14 / 18 …).
  // - Shield     → flat bonus (+2 in 5e).
  // The two badges render side by side: armor-only always, armor+shield
  // when a shield is equipped — so the player can preview the trade-off
  // before swapping to a two-handed weapon.
  const equippedAc = resolveEquippedAc(blocks, lookup, naturalAc);

  return (
    <Section.Row label="Health Management" distribution="1 2">
      <PortraitThumb src={self.portrait} />
      <Article.Column label="Content">
        <HGroup.Row label="Defense Stats">
          <Line.Control>
            <DeathSaveDots
              side="failures"
              count={3}
              filled={deathSaves.failures}
              onChange={(v) => self.setDeath_saves({ ...deathSaves, failures: v })}
            />
            <Badge.Shield value={equippedAc.armor} label="Armor" />
            {equippedAc.shieldBonus > 0 && (
              <Badge.Shield
                value={equippedAc.armor + equippedAc.shieldBonus}
                label="Shield"
              />
            )}
            <DeathSaveDots
              side="successes"
              count={3}
              filled={deathSaves.successes}
              onChange={(v) => self.setDeath_saves({ ...deathSaves, successes: v })}
            />
          </Line.Control>
          <Line.Stats>
            <Stat.Diamond
              label="Initiative"
              value={initiativeTotal}
              format="bonus"
              vantage={initVantage}
            />
            {speeds.map((s, i) => (
              <Stat.Diamond key={i} label={s.type ?? "Walk"} value={s.value ?? 30} format="unit" size="lg" />
            ))}
            <Stat.Diamond label="Proficiency" value={expressions.ProficiencyBonus()} format="bonus" />
          </Line.Stats>
        </HGroup.Row>

        <p aria-details="Health Management Row" style={{ alignItems: "stretch" }}>
          <dl aria-label="Health Controller" style={{ flex: 3 }}>
            <dt>HIT POINTS</dt>
            <dd aria-label="Progress Health">
              <Progress.Health value={self.current_hp ?? 0} max={self.max_hp ?? 0} secondary={self.temp_hp ?? 0} />
            </dd>
            <dt>Hit Dice</dt>
            <dd aria-label="Dice Tray">
              <DiceTray dice={hitDice} onSpend={handleSpendDie} />
            </dd>
          </dl>

          <dl aria-label="Character Status" style={{ flex: 2 }}>
            <dt>Exhaustion</dt>
            <dd aria-label="Progress Numbered">
              <Progress.Numbered value={exhaustion} max={6} />
            </dd>
            <dt>Conditions</dt>
            <dd aria-label="Conditions List">
              {conditions.length === 0 ? (
                <span aria-details="No Conditions">—</span>
              ) : (
                conditions.map((raw, i) => {
                  const { label, linkpath } = parseCondition(raw);
                  return <ConditionPill key={i} value={raw} label={label} linkpath={linkpath} />;
                })
              )}
            </dd>
          </dl>
        </p>
      </Article.Column>
    </Section.Row>
  );
};

export default health;

// ─── Equipped AC ────────────────────────────────────────────────────────────

/**
 * Combine the inventory's equipped armor + shield with the character's
 * DEX modifier into the two AC values shown on the defense badges.
 * Falls back to `naturalAc` when no body armor is equipped, so unarmored
 * Monks / Barbarians still get a sensible base.
 */
function resolveEquippedAc(
  blocks: unknown,
  lookup: { $items?: Record<string, Record<string, unknown>> } | undefined,
  naturalAc: number,
): { armor: number; shieldBonus: number } {
  const inv = (blocks as { inventory?: { items?: unknown[] } })?.inventory;
  const items = Array.isArray(inv?.items) ? inv.items : [];
  const lib = lookup?.$items ?? {};
  const dexMod = abilityModFromBlocks(blocks, "DEX");

  let armor = naturalAc;
  let shieldBonus = 0;

  for (const raw of items) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as { name?: unknown; slot?: unknown };
    if (typeof o.name !== "string") continue;
    const name = wikiStem(o.name);
    if (!name) continue;
    const fm = lib[name];
    if (!fm) continue;
    const armorBlock = fm.armor && typeof fm.armor === "object"
      ? (fm.armor as { ac?: unknown; category?: unknown })
      : undefined;
    if (!armorBlock) continue;
    const formula = typeof armorBlock.ac === "string" ? armorBlock.ac : undefined;
    const category = typeof armorBlock.category === "string"
      ? armorBlock.category.toLowerCase()
      : undefined;

    if (category === "shield") {
      // Shields are "equipped" by mere inventory presence — the player
      // doesn't toggle them. Take the strongest shield bonus so multiple
      // shields don't stack (5e rule: only one shield at a time).
      const bonus = parseAcBonus(formula);
      if (bonus > shieldBonus) shieldBonus = bonus;
    } else if (o.slot === "armor") {
      armor = computeArmorValue(formula, category, dexMod) ?? armor;
    }
  }
  return { armor, shieldBonus };
}

function abilityModFromBlocks(blocks: unknown, key: "STR" | "DEX" | "CON" | "INT" | "WIS" | "CHA"): number {
  const stats = (blocks as { stats?: Record<string, unknown> })?.stats ?? {};
  const cell = stats[key];
  let score = 10;
  if (typeof cell === "number") score = cell;
  else if (cell && typeof cell === "object" && typeof (cell as { value?: number }).value === "number") {
    score = (cell as { value: number }).value;
  }
  return Math.floor((score - 10) / 2);
}

/** Parse a bonus-style AC formula (`"+2"`, `"+1"`). Falls back to 0. */
function parseAcBonus(raw: string | undefined): number {
  if (!raw) return 0;
  const m = raw.match(/[+-]?\d+/);
  if (!m) return 0;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : 0;
}

/** Resolve a body-armor AC string into a numeric value for the wielder.
 *  Parses out the base (leading integer), the DEX component (`+ DEX`),
 *  and an optional inline cap (`(max N)`). Falls back to the 5e default
 *  per category when no explicit cap is declared — medium ≤ 2, heavy = 0,
 *  light uncapped. */
function computeArmorValue(
  formula: string | undefined,
  category: string | undefined,
  dexMod: number,
): number | null {
  if (!formula) return null;
  const baseMatch = formula.match(/-?\d+/);
  if (!baseMatch) return null;
  const base = Number(baseMatch[0]);
  if (!Number.isFinite(base)) return null;
  const wantsDex = /\bdex\b/i.test(formula);
  if (!wantsDex) return base;
  const explicitCap = formula.match(/max\s+(\d+)/i);
  const cap = explicitCap
    ? Number(explicitCap[1])
    : category === "heavy"
      ? 0
      : category === "medium"
        ? 2
        : Infinity;
  return base + Math.min(dexMod, cap);
}

function wikiStem(raw: string): string {
  const m = raw.match(/^\[\[(.+?)\]\]$/);
  const inner = m ? m[1] : raw;
  return inner.split("|")[0].split("/").pop()!.trim();
}

/**
 * Fold heritage / class-granted speed traits into the stat-diamond
 * array. Each trait key names a movement mode; values accept bare
 * numbers or `"<n> ft."` strings. Authored `self.speed` still wins —
 * GMs can pin a character's speed from YAML when overriding.
 */
const SPEED_KEYS: Array<{ trait: string; type: string }> = [
  { trait: "Walk", type: "Walk" },
  { trait: "Fly", type: "Fly" },
  { trait: "Swim", type: "Swim" },
  { trait: "Burrow", type: "Burrow" },
  { trait: "Climb", type: "Climb" },
];

function resolveSpeeds(
  yamlSpeed: unknown,
  traits: Record<string, string[]>,
): Array<{ value: number; type: string }> {
  const yamlList = Array.isArray(yamlSpeed)
    ? yamlSpeed
    : yamlSpeed
      ? [yamlSpeed]
      : [];
  if (yamlList.length > 0) {
    return yamlList.map((entry) => ({
      value: (entry as { value?: number }).value ?? 30,
      type: (entry as { type?: string }).type ?? "Walk",
    }));
  }
  const out: Array<{ value: number; type: string }> = [];
  for (const { trait, type } of SPEED_KEYS) {
    const values = traits[trait] ?? [];
    if (values.length === 0) continue;
    const best = Math.max(...values.map(parseNumericTrait).filter((n) => n > 0));
    if (Number.isFinite(best) && best > 0) out.push({ value: best, type });
  }
  // Default to the 5e baseline when no trait gave us anything — keeps
  // the stat diamond populated for freshly authored characters.
  if (out.length === 0) out.push({ value: 30, type: "Walk" });
  return out;
}

/** Sum class-granted hit dice into a `{ d8: { max, current } }` map.
 *
 *  Each class file declares its die face via a `Hit Die` trait on its
 *  root `rpg feature.details` block (typical layout):
 *
 *      ```rpg feature.details
 *      name: Hit Points
 *      traits:
 *        Hit Die: d8
 *      ```
 *
 *  The resolver aggregates every active source's baseTraits, so the
 *  per-source walk below is just about keeping the level tied to the
 *  die face (multiclass Cleric-2 / Fighter-1 → `{ d8: 2, d10: 1 }`).
 *
 *  YAML `hit_dice` accepts two shapes — the resolver normalises both:
 *  - Shorthand `hit_dice: { d8: 2, d10: 1 }` — each value is the current
 *    (unspent) count; max re-derives from class traits.
 *  - Long form `hit_dice: { d8: { current: 2, max: 2 }, … }` — same
 *    semantics, used for DM overrides of custom hit dice pools.
 *
 *  Any YAML-only die face (DM-granted custom hit dice) is preserved on
 *  top of the class-derived pool. */
function resolveHitDice(
  view: { sources?: Array<{ kind: string; level?: number; baseTraits?: Record<string, string[]> }> } | undefined,
  yamlHitDice: Record<string, unknown>,
): Record<string, { current: number; max: number }> {
  const out: Record<string, { current: number; max: number }> = {};
  const byDie = new Map<string, number>();
  for (const source of view?.sources ?? []) {
    if (source.kind !== "class") continue;
    const die = pickDieFace(source.baseTraits?.["Hit Die"]);
    if (!die || !source.level) continue;
    byDie.set(die, (byDie.get(die) ?? 0) + source.level);
  }
  for (const [die, max] of byDie) {
    const current = readHitDieCurrent(yamlHitDice[die], max);
    out[die] = { max, current };
  }
  // Preserve YAML-only die faces (e.g., DM override for a custom race /
  // NPC). Max falls back to the shorthand number when no long-form max
  // is given — matches the shorthand contract.
  for (const [die, entry] of Object.entries(yamlHitDice)) {
    if (out[die]) continue;
    const { current, max } = normaliseYamlHitDieEntry(entry);
    if (max <= 0 && current <= 0) continue;
    out[die] = { max: max || current, current };
  }
  return out;
}

/** Extract just the `current` count from a YAML hit-dice entry,
 *  supporting both the shorthand number form and the long-form object.
 *  Falls back to `defaultMax` when the value is missing or unparseable
 *  (fresh character → full pool). */
function readHitDieCurrent(raw: unknown, defaultMax: number): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (raw && typeof raw === "object") {
    const v = (raw as { current?: unknown }).current;
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return defaultMax;
}

function normaliseYamlHitDieEntry(raw: unknown): { current: number; max: number } {
  if (typeof raw === "number") return { current: raw, max: raw };
  if (raw && typeof raw === "object") {
    const o = raw as { current?: unknown; max?: unknown };
    const current = typeof o.current === "number" ? o.current : 0;
    const max = typeof o.max === "number" ? o.max : current;
    return { current, max };
  }
  return { current: 0, max: 0 };
}

/** Accept `"d8"`, `"1d8"`, `"[[d8]]"` etc. and return the canonical
 *  die face `"d8"`. Falls back to null on unparseable input. */
function pickDieFace(values: string[] | undefined): string | null {
  if (!values || values.length === 0) return null;
  for (const raw of values) {
    const m = String(raw).match(/d(\d+)/i);
    if (m) return `d${m[1]}`;
  }
  return null;
}
