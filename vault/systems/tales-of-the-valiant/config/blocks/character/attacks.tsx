import * as React from "react";
import {
  EntityBlock,
  deriveWeaponAttacks,
  signed,
  type AttackAspect,
  type DamageSpec,
  type FeatureDetails,
  type ItemElementData,
  type WielderStats,
} from "rpg-ui-toolkit";
import type { AttacksProps, AttackEntry } from "./attacks.types";
import type { CharacterEntity } from "../../entities/character.types";
import type { FeaturesBlockData } from "./features.types";
import type { HeaderProps } from "./header.types";

interface AttackRow {
  id: string;
  kind: "weapon" | "spell" | "feature" | "manual";
  attack: AttackAspect;
  sourceNote: string;
  available: boolean;
}

interface EquipState {
  mainHand: string | null;
  offHand: string | null;
}

/**
 * `rpg character.attacks` — derives every attack the character has
 * available from inventory weapons (auto-fanned by Versatile / Thrown /
 * Two-Handed properties), spells with an `attack:` aspect, and features
 * with one. Each row shows Hit *or* DC depending on the attack's form,
 * with effects (save outcomes, conditions, free-text notes) collapsed
 * into a compact icon-and-text cell.
 *
 * No favouriting; the table is the action economy.
 */
export const attacks: EntityBlock<AttacksProps, CharacterEntity> = ({
  self,
  blocks,
  lookup,
}) => {
  const stats = resolveWielderStats(blocks);
  const equip = resolveEquipState(blocks, lookup);
  const resolvedCasters = resolveCasters(blocks, lookup);
  const rawRows: Array<Omit<AttackRow, "available">> = [
    ...deriveWeaponRows(blocks, lookup, stats, equip),
    ...deriveSpellRows(blocks, lookup, stats, resolvedCasters),
    ...deriveFeatureRows(blocks, lookup),
    ...deriveManualRows(self.attacks),
  ];
  const rows: AttackRow[] = rawRows.map((row) => ({
    ...row,
    available: isAttackAvailable(row.kind, row.attack, row.sourceNote, equip),
  }));

  return (
    <section aria-details="Favorite Attacks" className="rpg-attacks">
      {rows.length === 0 ? (
        <>
          <header className="rpg-tag-heading"><span>Attacks</span></header>
          <p className="rpg-attacks__empty"><em>No attacks available.</em></p>
        </>
      ) : (
        <div className="rpg-attacks__scroll">
          <table className="rpg-attacks__table">
            <thead className="rpg-attacks__head-band">
              <tr>
                <th className="rpg-attacks__head-label">Attacks</th>
                <th>Hit</th>
                <th>DC</th>
                <th>Range</th>
                <th>Damage</th>
                <th>Effects</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <AttackRowUI key={row.id} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

// ─── Row component ──────────────────────────────────────────────────────────

function AttackRowUI({ row }: { row: AttackRow }) {
  const { attack, sourceNote } = row;
  const name = attack.name || sourceNote;
  // DC renders whenever the attack declares a save — regardless of form.
  // A spell-attack (form: spell) with a rider save shows BOTH a Hit and
  // a DC; the user can read the rules: damage on hit, save dictates the
  // additional condition. A pure save-form attack only shows DC. This
  // keeps the Effects column free for outcome/condition glyphs.
  const dcText = attack.save
    ? `${attack.save.ability} ${attack.save.dc ?? "—"}`
    : "";
  const hitText = attack.form !== "save" ? attack.to_hit ?? "" : "";

  return (
    <tr
      data-form={attack.form}
      data-available={row.available ? "true" : "false"}
      title={row.available ? undefined : `Unavailable: needs ${attack.requires ?? "equip"}`}
    >
      <td className="rpg-attacks__name">
        <span className="rpg-attacks__form-icon" aria-label={`Form: ${attack.form}`}>
          <FormIcon form={attack.form} />
        </span>
        <a className="internal-link" href={sourceNote} data-href={sourceNote}>
          {name}
        </a>
      </td>
      <td className="rpg-attacks__hit">{hitText}</td>
      <td className="rpg-attacks__dc">{dcText}</td>
      <td className="rpg-attacks__range">{attack.range ?? ""}</td>
      <td className="rpg-attacks__damage">
        <DamageCell damage={attack.damage} />
      </td>
      <td className="rpg-attacks__effects">
        <EffectsCell attack={attack} />
      </td>
    </tr>
  );
}

function DamageCell({ damage }: { damage: AttackAspect["damage"] }) {
  if (!damage) return null;
  const list: DamageSpec[] = Array.isArray(damage) ? damage : [damage];
  return (
    <>
      {list.map((d, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="rpg-attacks__damage-sep"> + </span>}
          <span className="rpg-attacks__damage-roll">{compactDie(d.roll, d.bonus)}</span>
          <span className="rpg-attacks__damage-type"> {d.type}</span>
        </React.Fragment>
      ))}
    </>
  );
}

/** Render the damage as a polynomial-style expression: `1d6+2`, `2d8`,
 *  `1d8/1d10+1` for versatile. The bonus stays adjacent to the dice
 *  with no extra spaces so the cell stays narrow on a single row. */
function compactDie(roll: string, bonus?: string): string {
  if (!bonus || bonus === "+0") return roll;
  return `${roll}${bonus.startsWith("-") ? bonus : `+${bonus.replace(/^\+/, "")}`}`;
}

/** Save outcome (½ / ∅) + each parsed condition gets its own glyph
 *  with a `title` for tooltip. Trailing free-text notes still render
 *  as italic text after the icons so authors can include details the
 *  icon vocabulary doesn't cover. */
function EffectsCell({ attack }: { attack: AttackAspect }) {
  const icons: Array<{ glyph: string; title: string; cls?: string }> = [];
  const onSuccess = attack.save?.on_success?.toLowerCase() ?? "";
  if (onSuccess.includes("half")) {
    icons.push({ glyph: "½", title: "Half damage on successful save", cls: "rpg-attacks__icon--save-half" });
  } else if (onSuccess.includes("no")) {
    icons.push({ glyph: "∅", title: "No damage on successful save", cls: "rpg-attacks__icon--save-none" });
  } else if (attack.save) {
    icons.push({ glyph: "↺", title: `On save: ${attack.save.on_success ?? "negates effect"}`, cls: "rpg-attacks__icon--save-other" });
  }

  const conditions = parseConditionsFromNotes(attack.notes);
  for (const c of conditions) {
    icons.push({ glyph: c.glyph, title: c.title, cls: "rpg-attacks__icon--condition" });
  }

  const trailingNote = stripConditionTokens(attack.notes ?? "", conditions);
  return (
    <>
      {icons.map((i, idx) => (
        <span
          key={idx}
          className={`rpg-attacks__icon ${i.cls ?? ""}`}
          data-tip={i.title}
          aria-label={i.title}
        >
          {i.glyph}
        </span>
      ))}
      {trailingNote && <small className="rpg-attacks__notes-text">{trailingNote}</small>}
    </>
  );
}

interface ConditionHit { keyword: string; glyph: string; title: string; }

const CONDITION_GLYPHS: Array<{ keyword: RegExp; glyph: string; title: string }> = [
  { keyword: /\bblinded\b/i,    glyph: "👁", title: "Blinded" },
  { keyword: /\bprone\b/i,       glyph: "⤵", title: "Knocked prone" },
  { keyword: /\bpoisoned\b/i,    glyph: "☠", title: "Poisoned" },
  { keyword: /\bcharmed\b/i,     glyph: "♥", title: "Charmed" },
  { keyword: /\brestrained\b/i,  glyph: "🪢", title: "Restrained" },
  { keyword: /\bgrappled\b/i,    glyph: "✊", title: "Grappled" },
  { keyword: /\bfrightened\b/i,  glyph: "😱", title: "Frightened" },
  { keyword: /\bstunned\b/i,     glyph: "💫", title: "Stunned" },
  { keyword: /\bdeafened\b/i,    glyph: "👂", title: "Deafened" },
  { keyword: /\bunconscious\b/i, glyph: "💤", title: "Unconscious" },
  { keyword: /\bpush(?:es|ed)?\b/i, glyph: "→", title: "Pushes the target" },
  { keyword: /\bpins?\b/i,       glyph: "📌", title: "Pinned" },
];

function parseConditionsFromNotes(notes: string | undefined): ConditionHit[] {
  if (!notes) return [];
  const hits: ConditionHit[] = [];
  for (const c of CONDITION_GLYPHS) {
    if (c.keyword.test(notes)) {
      hits.push({ keyword: c.keyword.source, glyph: c.glyph, title: c.title });
    }
  }
  return hits;
}

/** Drop matched condition keywords from the trailing note so the icon
 *  isn't duplicated by leftover prose. Leaves uncovered words intact. */
function stripConditionTokens(notes: string, conditions: ConditionHit[]): string {
  if (!notes) return "";
  let out = notes;
  for (const c of conditions) {
    out = out.replace(new RegExp(c.keyword, "i"), "");
  }
  return out
    .replace(/\s+,/g, ",")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,;.-]+|[\s,;.-]+$/g, "")
    .trim();
}

function FormIcon({ form }: { form: AttackAspect["form"] }) {
  const map: Record<AttackAspect["form"], { glyph: string; title: string }> = {
    melee:  { glyph: "⚔", title: "Melee attack" },
    ranged: { glyph: "🏹", title: "Ranged attack" },
    spell:  { glyph: "✨", title: "Spell attack" },
    save:   { glyph: "🛡", title: "Save-based" },
  };
  const i = map[form];
  return <span aria-hidden="true" title={i.title}>{i.glyph}</span>;
}

// ─── Derivation passes ──────────────────────────────────────────────────────

function resolveWielderStats(blocks: unknown): WielderStats {
  const stats = (blocks as { stats?: Record<string, unknown> })?.stats ?? {};
  const pick = (key: string): number => {
    const cell = stats[key];
    if (typeof cell === "number") return cell;
    if (cell && typeof cell === "object" && typeof (cell as { value?: number }).value === "number") {
      return (cell as { value: number }).value;
    }
    return 10;
  };
  const mod = (score: number): number => Math.floor((score - 10) / 2);
  // PB derived from summed class levels — stays in lockstep with
  // `expressions.ProficiencyBonus()` without needing the expressions hookup.
  const header = (blocks as { header?: Partial<HeaderProps> })?.header;
  const classLevels = Array.isArray(header?.classes)
    ? header!.classes.reduce(
        (acc: number, c) => acc + (typeof (c as { level?: number }).level === "number" ? (c as { level: number }).level : 0),
        0,
      )
    : 0;
  const pb = Math.floor(Math.max(0, classLevels - 1) / 4) + 2;
  return {
    str: mod(pick("STR")),
    dex: mod(pick("DEX")),
    con: mod(pick("CON")),
    int: mod(pick("INT")),
    wis: mod(pick("WIS")),
    cha: mod(pick("CHA")),
    pb,
  };
}

function deriveWeaponRows(
  blocks: unknown,
  lookup: CharacterEntity["lookup"] | undefined,
  stats: WielderStats,
  equip: EquipState,
): Array<Omit<AttackRow, "available">> {
  const inv = (blocks as { inventory?: { items?: unknown[] } })?.inventory;
  const rawItems = Array.isArray(inv?.items) ? inv.items : [];
  const items = rawItems.flatMap(flattenItemEntries);
  const library = lookup?.$items ?? {};
  const rows: Array<Omit<AttackRow, "available">> = [];
  const handItems = new Set<string>();
  if (equip.mainHand) handItems.add(equip.mainHand);
  if (equip.offHand) handItems.add(equip.offHand);

  // Sum quantities per item name — a dual-wielder with two stacked
  // Shortswords (`qty: 2`) picks up a bonus-action off-hand strike, per
  // 5e two-weapon-fighting rules.
  const qtyByName = new Map<string, number>();
  for (const entry of items) {
    const name = stripWikilink(entry.name);
    if (!name) continue;
    const prev = qtyByName.get(name) ?? 0;
    qtyByName.set(name, prev + (typeof entry.qty === "number" ? entry.qty : 1));
  }
  const emitted = new Set<string>();

  for (const entry of items) {
    const target = stripWikilink(entry.name);
    if (!target) continue;
    if (!handItems.has(target)) continue;
    if (emitted.has(target)) continue;
    emitted.add(target);
    const itemData = library[target];
    if (!itemData) continue;
    const element = itemData as ItemElementData;
    const derived = deriveWeaponAttacks(element, stats, undefined, target);
    if (derived.length === 0) continue;
    derived.forEach((attack, i) => {
      rows.push({
        id: derived.length > 1 ? `weapon:${target}:${i}` : `weapon:${target}`,
        kind: "weapon",
        attack,
        sourceNote: target,
      });
    });

    // Two-weapon fighting bonus action: when the main-hand weapon is
    // Light and the character carries at least two of them (one per
    // hand), fan out a companion off-hand strike that drops the
    // ability mod from damage.
    const qty = qtyByName.get(target) ?? 0;
    if (
      target === equip.mainHand &&
      qty >= 2 &&
      hasWeaponProperty(element, "light")
    ) {
      const offHand = deriveWeaponAttacks(
        element,
        stats,
        { offHand: true },
        `${target} (Off-hand)`,
      );
      // Only the primary-mode off-hand strike — versatile / thrown
      // fan-outs on the off-hand would misrepresent the bonus-action
      // economy (it's one extra attack, not a fresh set of modes).
      const primary = offHand[0];
      if (primary) {
        rows.push({
          id: `weapon:${target}:offhand`,
          kind: "weapon",
          attack: primary,
          sourceNote: target,
        });
      }
    }
  }
  return rows;
}

function flattenItemEntries(raw: unknown): Array<{ name: string; qty?: number; equipped?: boolean; slot?: string }> {
  if (typeof raw === "string") return [{ name: raw }];
  if (!raw || typeof raw !== "object") return [];
  const o = raw as { name?: string; qty?: number; quantity?: number; equipped?: boolean; slot?: string; contents?: unknown[] };
  const out: Array<{ name: string; qty?: number; equipped?: boolean; slot?: string }> = [];
  if (typeof o.name === "string") {
    const qty = typeof o.qty === "number" ? o.qty : typeof o.quantity === "number" ? o.quantity : undefined;
    out.push({ name: o.name, qty, equipped: o.equipped, slot: o.slot });
  }
  if (Array.isArray(o.contents)) {
    for (const c of o.contents) out.push(...flattenItemEntries(c));
  }
  return out;
}

function stripWikilink(raw: string): string {
  const m = raw.match(/^\[\[(.+?)\]\]$/);
  if (!m) return raw.trim();
  return m[1].split("|")[0].split("/").pop()!.trim();
}

function resolveCasters(
  blocks: unknown,
  lookup: CharacterEntity["lookup"] | undefined,
): Map<string, { source: string; ability: string }> {
  const out = new Map<string, { source: string; ability: string }>();
  const header = (blocks as { header?: unknown })?.header;
  const features = (blocks as { features?: FeaturesBlockData })?.features;
  if (!header || !lookup?.$features) return out;
  try {
    const view = lookup.$features(header, features?.choices, features?.additional);
    for (const caster of view.casters ?? []) {
      out.set(caster.source, { source: caster.source, ability: caster.ability });
    }
  } catch {
    // partial state — empty map is safe.
  }
  return out;
}

function deriveSpellRows(
  blocks: unknown,
  lookup: CharacterEntity["lookup"] | undefined,
  stats: WielderStats,
  casters: Map<string, { source: string; ability: string }>,
): Array<Omit<AttackRow, "available">> {
  const spellsBlock = (blocks as { spells?: { casters?: Record<string, unknown> } })?.spells;
  const castersState = (spellsBlock?.casters ?? {}) as Record<string, {
    cantrips?: string[];
    prepared?: Record<string, string[]>;
    known?: Record<string, string[]>;
  }>;
  const library = lookup?.$spells ?? {};
  const seen = new Set<string>();
  const rows: Array<Omit<AttackRow, "available">> = [];
  for (const [source, state] of Object.entries(castersState)) {
    const resolved = casters.get(source);
    if (!resolved) continue;
    const abilityMod = abilityModFromStats(stats, resolved.ability);
    const toHit = `${signed(stats.pb + abilityMod)} (${resolved.ability})`;
    const dc = `${8 + stats.pb + abilityMod}`;
    const pool = [
      ...(state.cantrips ?? []),
      ...flattenSpellLevels(state.prepared),
      ...flattenSpellLevels(state.known),
    ];
    for (const raw of pool) {
      const name = stripWikilink(raw);
      if (!name || seen.has(name)) continue;
      seen.add(name);
      const body = library[name] as { attack?: AttackAspect } | undefined;
      const attack = body?.attack;
      if (!attack) continue;
      const filled: AttackAspect = {
        ...attack,
        name: attack.name ?? name,
        to_hit: attack.form === "spell" ? (attack.to_hit ?? toHit) : attack.to_hit,
        save: attack.save
          ? { ...attack.save, dc: attack.save.dc ?? dc }
          : attack.save,
      };
      rows.push({
        id: `spell:${source}:${name}`,
        kind: "spell",
        attack: filled,
        sourceNote: name,
      });
    }
  }
  return rows;
}

function abilityModFromStats(stats: WielderStats, ability: string): number {
  const key = ability.trim().toUpperCase();
  switch (key) {
    case "STR": return stats.str;
    case "DEX": return stats.dex;
    case "CON": return stats.con;
    case "INT": return stats.int;
    case "WIS": return stats.wis;
    case "CHA": return stats.cha;
    default: return 0;
  }
}

function flattenSpellLevels(map: Record<string, string[]> | undefined): string[] {
  if (!map) return [];
  return Object.values(map).flatMap((v) => (Array.isArray(v) ? v : []));
}

function deriveFeatureRows(
  blocks: unknown,
  lookup: CharacterEntity["lookup"] | undefined,
): Array<Omit<AttackRow, "available">> {
  const header = (blocks as { header?: unknown })?.header;
  const features = (blocks as { features?: FeaturesBlockData })?.features;
  if (!header || !lookup?.$features) return [];
  const view = lookup.$features(header, features?.choices, features?.additional);
  const rows: Array<Omit<AttackRow, "available">> = [];
  for (const src of view.sources ?? []) {
    for (const f of src.features as FeatureDetails[]) {
      if (!f.attack) continue;
      const rowName = f.attack.name ?? f.name;
      rows.push({
        id: `feature:${src.source}:${f.name}:${rowName}`,
        kind: "feature",
        attack: { ...f.attack, name: rowName },
        sourceNote: src.source,
      });
    }
  }
  return rows;
}

function deriveManualRows(manual: AttackEntry[] | undefined): Array<Omit<AttackRow, "available">> {
  if (!Array.isArray(manual)) return [];
  const rows: Array<Omit<AttackRow, "available">> = [];
  manual.forEach((atk, i) => {
    const name = atk.name || atk.label || `Attack ${i + 1}`;
    const aspect: AttackAspect = {
      name,
      form: "melee",
      to_hit:
        typeof atk.to_hit === "number"
          ? signed(atk.to_hit)
          : typeof atk.to_hit === "string"
            ? atk.to_hit
            : undefined,
      range: atk.range,
      damage: atk.damage
        ? { roll: atk.damage.roll, type: atk.damage.type, bonus: atk.damage.bonus }
        : undefined,
      notes: atk.notes,
    };
    rows.push({
      id: `manual:${i}`,
      kind: "manual",
      attack: aspect,
      sourceNote: name,
    });
  });
  return rows;
}

// ─── Equip-state + availability ─────────────────────────────────────────────

function resolveEquipState(
  blocks: unknown,
  lookup: CharacterEntity["lookup"] | undefined,
): EquipState {
  const state: EquipState = { mainHand: null, offHand: null };
  const inv = (blocks as { inventory?: { items?: unknown[] } })?.inventory;
  const rawItems = Array.isArray(inv?.items) ? inv.items : [];
  const items = rawItems.flatMap(flattenItemEntries);
  const library = lookup?.$items ?? {};

  for (const entry of items) {
    if (!entry.equipped && !entry.slot) continue;
    const target = stripWikilink(entry.name);
    if (!target) continue;
    const itemData = library[target] as ItemElementData | undefined;
    const isTwoHanded = itemData?.weapon
      ? hasProperty(itemData.weapon.properties, "two-handed")
      : false;

    if (entry.slot === "main_hand") {
      state.mainHand = target;
      if (isTwoHanded) state.offHand = target;
    } else if (entry.slot === "off_hand" || entry.slot === "shield") {
      state.offHand = target;
    } else if (entry.equipped && itemData?.weapon) {
      if (!state.mainHand) state.mainHand = target;
      if (isTwoHanded && !state.offHand) state.offHand = target;
    }
  }

  return state;
}

function hasProperty(properties: string[] | undefined, name: string): boolean {
  if (!properties) return false;
  const target = name.toLowerCase();
  return properties.some((p) => {
    const bare = p.replace(/^\[\[/, "").replace(/\]\]$/, "").split("|")[0].toLowerCase();
    return bare === target;
  });
}

/** Check whether the weapon block of an item element declares a named
 *  property. Used for two-weapon-fighting detection ("Light"). */
function hasWeaponProperty(element: ItemElementData, name: string): boolean {
  return hasProperty(element.weapon?.properties, name);
}

function isAttackAvailable(
  kind: AttackRow["kind"],
  attack: AttackAspect,
  sourceNote: string,
  equip: EquipState,
): boolean {
  const requires = attack.requires ?? (attack.form === "melee" || attack.form === "ranged" ? "one_hand" : "none");

  if (kind === "weapon") {
    const inMain = equip.mainHand === sourceNote;
    const inOff = equip.offHand === sourceNote;
    if (!inMain && !inOff) return false;
    if (requires === "two_hands") {
      return inMain && (equip.offHand === null || equip.offHand === sourceNote);
    }
    return true;
  }

  switch (requires) {
    case "none": return true;
    case "one_hand": return equip.mainHand !== null || equip.offHand !== null;
    case "two_hands":
      return equip.mainHand !== null && (equip.offHand === null || equip.offHand === equip.mainHand);
    case "free_hand": return equip.mainHand === null || equip.offHand === null;
    default: return true;
  }
}

export default attacks;
