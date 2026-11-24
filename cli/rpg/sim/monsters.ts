/**
 * Bestiary notes, read into the combatants the simulator fights: a note's
 * `rpg stat.monster` fence gives AC, HP, abilities, CR, speed, type and habitat;
 * its feature refs are resolved to prose and classified into the actions the
 * engine can model, each with a fidelity record that says what was left out.
 */

import { parse as parseYaml } from "yaml";
import { defencesOf, noDefences } from "lib/domains/encounter-sim/defences";
import { averageOf } from "lib/domains/encounter-sim/rng";
import {
  classifyMonsterFeature,
  bindMultiattack,
  parseLairActions,
  splitAttackBodies,
  type MonsterSpellcasting,
  type ParsedReaction,
} from "lib/domains/encounter-sim/monster-actions";
import {
  reactionOfSpell,
  resolveSpellOption,
  type SpellNumbers,
  type SpellOptionInput,
} from "lib/domains/encounter-sim/spell-actions";
import { applyTemplateBlock, pbOfCr } from "lib/domains/statblocks/template-block";
import {
  ABILITY_KEYS,
  isDamaging,
  type AbilityKey,
  type AbilityStat,
  type BonusMove,
  type CombatActor,
  type FidelityRecord,
  type ModelledAction,
  type Reaction,
  type SkipReason,
  type WeaponAttackAction,
} from "lib/domains/encounter-sim/types";
import { parseRole, parseSubrole, type MonsterRole, type Subrole } from "lib/domains/encounter-sim/monster-role";
import { mapCategory, mapMonster } from "lib/domains/statblocks/monster-fields";
import { resolveStatFeatures } from "lib/domains/statblocks/resolve-features";
import type { ResolvedStatFeature, StatMonsterData } from "lib/domains/statblocks/types";
import type { Ctx } from "../app";
import { fencesOf } from "../fences";
import { bestiaryNoteNamed } from "./aliases";
import { readSpell } from "./party";
import type { TFile } from "../obsidian-node";

/** Where the bestiary lives in the vault. */
export const BESTIARY_PREFIX = "tales-of-the-valiant/worldbuilding/bestiary/";

export type MonsterNoteState =
  | { kind: "non-monster" }
  | { kind: "unresolvable"; why: string }
  | { kind: "monster"; data: StatMonsterData; file: TFile; yaml: Record<string, unknown> };

export interface LoadedMonster {
  /** The note's vault path (also the owner of its fidelity records). */
  note: string;
  name: string;
  actor: CombatActor;
  /** The CR as written, e.g. "1/2". */
  cr: string;
  speed: number;
  /** Habitat link names, e.g. ["Forest", "Hills"]. */
  habitat: string[];
  /** The type line as plain text, e.g. "Medium Humanoid" (links reduced to their text). */
  monsterType: string;
  fidelity: FidelityRecord[];
  /** The features resolved to prose (for the role guess). */
  features: Array<{ name: string; type?: string; text: string }>;
  /** The speed line as written ("30 ft., fly 60 ft."). */
  speedText: string;
  /** The role written in the statblock (`role:`), when it has one. */
  role?: MonsterRole;
  /** The subrole written in the statblock (`subrole:`), when it has one. */
  subrole?: Subrole;
  /** The template note applied to it ("Mage with Void-Blessed"), when one was. */
  template?: string;
}

/** Every markdown note under the bestiary, in the vault's order. */
export function bestiaryPaths(ctx: Ctx): string[] {
  return ctx.vault
    .getMarkdownFiles()
    .map((f) => f.path)
    .filter((p) => p.startsWith(BESTIARY_PREFIX));
}

/** The fence body's YAML, without any prose after a `---` line. */
function yamlOf(body: string): string {
  const lines = body.split("\n");
  const sep = lines.findIndex((l) => l.trim() === "---");
  return sep >= 0 ? lines.slice(0, sep).join("\n") : body;
}

function leadingInt(text: string | undefined): number | null {
  const m = text?.match(/^\s*(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

function findFile(ctx: Ctx, ref: string): TFile | null {
  try {
    const file = ctx.note(ref);
    // A bare name ("Zombie") may find a template note first: a creature of the bestiary of that name wins.
    if (!ref.includes("/") && file.path.startsWith(`${BESTIARY_PREFIX}templates/`)) {
      const named = bestiaryNoteNamed(ctx, ref);
      if (named && named !== file.path) return ctx.note(named);
    }
    return file;
  } catch {
    // A spoken name or an alias: "Goblin" for `Goblin, A`, "warden robot" for `Robot Warden`.
    const named = bestiaryNoteNamed(ctx, ref);
    if (!named) return null;
    try {
      return ctx.note(named);
    } catch {
      return null;
    }
  }
}

/** Classifies a note without throwing: a monster, a note with no monster fence, or one the sim cannot read. */
export function readMonsterNote(ctx: Ctx, path: string): MonsterNoteState {
  const file = findFile(ctx, path);
  if (!file) return { kind: "unresolvable", why: `no note "${path}"` };
  let text: string;
  try {
    text = ctx.vault.readSync(file);
  } catch (e) {
    return { kind: "unresolvable", why: `cannot read "${file.path}": ${(e as Error).message}` };
  }
  const fences = fencesOf(text, "stat.monster");
  if (fences.length === 0) {
    // "Goblin" may find the lineage note first: a name, not a path, is also looked up in the bestiary.
    const named = !path.includes("/") ? bestiaryNoteNamed(ctx, path) : undefined;
    if (named && named !== file.path) return readMonsterNote(ctx, named);
    return { kind: "non-monster" };
  }
  let yaml: unknown;
  try {
    yaml = parseYaml(yamlOf(fences[0]));
  } catch (e) {
    return { kind: "unresolvable", why: `the stat.monster fence is not valid YAML: ${(e as Error).message}` };
  }
  if (!yaml || typeof yaml !== "object" || Array.isArray(yaml)) {
    return { kind: "unresolvable", why: "the stat.monster fence is not a mapping" };
  }
  const raw = yaml as Record<string, unknown>;
  const data = mapMonster(raw);
  const missing: string[] = [];
  if (leadingInt(data.stats.ac) === null) missing.push("ac");
  if (leadingInt(data.stats.hp) === null) missing.push("hp");
  if (!data.cr) missing.push("cr");
  if (missing.length) return { kind: "unresolvable", why: `the stat.monster fence lacks ${missing.join(", ")}` };
  return { kind: "monster", data, file, yaml: raw };
}

/** A CR as a number: "1/2" is 0.5. */
export function crNumber(cr: string): number {
  const frac = cr.match(/^\s*(\d+)\s*\/\s*(\d+)\s*$/);
  if (frac) return parseInt(frac[2], 10) === 0 ? 0 : parseInt(frac[1], 10) / parseInt(frac[2], 10);
  const n = parseFloat(cr);
  return Number.isFinite(n) ? n : 0;
}

/** `[[Forest]], [[Hills|the hills]]` -> ["Forest", "Hills"]. */
export function linkNames(text: string | undefined): string[] {
  if (!text) return [];
  return [...text.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g)].map((m) => m[1].trim());
}

/** A type line with `[[Beast]]` / `[[Beast|beasts]]` reduced to the link text. */
export function plainType(type: string): string {
  return type
    .replace(/\[\[([^\]|]*)(?:\|([^\]]*))?\]\]/g, (_, target: string, label?: string) => label ?? target)
    .trim();
}

/** The habitat line a monster inherits from its `stat.category` note when it writes none. */
export function categoryHabitat(ctx: Ctx, category: string | undefined, from: string): string | undefined {
  const target = linkNames(category)[0];
  if (!target) return undefined;
  const file = ctx.vault.resolveLink(target, from);
  if (!file) return undefined;
  const body = fencesOf(ctx.vault.readSync(file), "stat.category")[0];
  if (body === undefined) return undefined;
  try {
    const yaml = parseYaml(yamlOf(body));
    return yaml && typeof yaml === "object" ? mapCategory(yaml as Record<string, unknown>).habitat : undefined;
  } catch {
    return undefined;
  }
}

function abilitiesOf(data: StatMonsterData): Record<AbilityKey, AbilityStat> {
  const out = {} as Record<AbilityKey, AbilityStat>;
  for (const key of ABILITY_KEYS) {
    const modifier = data.abilities[key] ?? 0;
    out[key] = { modifier, saveModifier: modifier };
  }
  return out;
}

interface Classified {
  name: string;
  action?: ModelledAction;
  multiattack?: ReturnType<typeof classifyMonsterFeature>["multiattack"];
  legendary?: ReturnType<typeof classifyMonsterFeature>["legendary"];
  reaction?: ReturnType<typeof classifyMonsterFeature>["reaction"];
  legendaryResistance?: number;
  bonus?: ModelledAction;
  bonusMoves?: BonusMove[];
  otherReaction?: ParsedReaction;
  skip?: SkipReason;
}

function actionsAndFidelity(
  features: ResolvedStatFeature[],
  refs: string[],
  owner: string
): {
  actions: ModelledAction[];
  fidelity: FidelityRecord[];
  legendary: Array<{ action: ModelledAction; cost: number }>;
  reaction?: CombatActor["reaction"];
  legendaryResistance?: number;
  bonusActions: ModelledAction[];
  bonusMoves: BonusMove[];
  reactions: Reaction[];
} {
  // Pass 1: classify every feature; the attacks are collected by name for the Multiattack. A body with
  // several definitions of its own (a warlord's "Stalwart" is Multiattack + two attacks) is split first.
  const classified: Classified[] = features.flatMap((f, i) => {
    const name = f.name?.trim() || refs[i];
    const type = f.type?.trim().toLowerCase();
    const parts =
      type === "action" || type === "trait"
        ? (splitAttackBodies(name, f.text) ?? [{ name, type: f.type, text: f.text }])
        : [{ name, type: f.type, text: f.text }];
    return parts.map((p) => ({
      name: p.name,
      ...classifyMonsterFeature({ name: p.name, type: p.type, text: p.text }),
    }));
  });
  const attacks = new Map<string, WeaponAttackAction>();
  for (const c of classified) {
    if (c.action?.kind === "weapon" && !attacks.has(c.action.name)) attacks.set(c.action.name, c.action);
  }

  // Pass 2: bind each Multiattack to those attacks, and keep it all in feature-ref order.
  const actions: ModelledAction[] = [];
  const fidelity: FidelityRecord[] = [];
  const legendary: Array<{ action: ModelledAction; cost: number }> = [];
  const attackNamed = (ref: string) => {
    const want = ref.toLowerCase();
    return [...attacks.values()].find(
      (a) =>
        a.name
          .replace(/\s*\(.*\)\s*$/, "")
          .trim()
          .toLowerCase() === want
    );
  };
  let reaction: CombatActor["reaction"];
  let legendaryResistance: number | undefined;
  const bonusActions: ModelledAction[] = [];
  const bonusMoves: BonusMove[] = [];
  const reactions: Reaction[] = [];
  /** Its best weapon attack: the one a counterattack makes when its words name none of them. */
  const bestAttack = () => {
    let best: WeaponAttackAction | undefined;
    for (const a of attacks.values()) if (!best || averageOf(a.damage.expr) > averageOf(best.damage.expr)) best = a;
    return best;
  };
  for (const c of classified) {
    // A reaction besides an AC one: a counterattack bound to its own attack, damage back, and the like.
    if (c.otherReaction) {
      const { attackRef, ...reaction } = c.otherReaction;
      const attack =
        reaction.kind === "counter" ? ((attackRef ? attackNamed(attackRef) : undefined) ?? bestAttack()) : undefined;
      if (reaction.kind !== "counter" || attack) {
        reactions.push(attack ? { ...reaction, attack } : reaction);
        fidelity.push({ name: c.name, owner, status: "modelled" });
      } else fidelity.push({ name: c.name, owner, status: "skipped", reason: "unsupported-feature" });
      continue;
    }
    // A bonus action: the moves it gives (Nimble Escape), or an attack or save of its own.
    if (c.bonusMoves) {
      for (const m of c.bonusMoves) if (!bonusMoves.includes(m)) bonusMoves.push(m);
      fidelity.push({ name: c.name, owner, status: "modelled" });
      continue;
    }
    if (c.bonus) {
      bonusActions.push(c.bonus);
      fidelity.push({ name: c.name, owner, status: "modelled" });
      continue;
    }
    if (c.reaction && !reaction) {
      reaction = { name: c.name, ac: c.reaction.ac, untilTurn: c.reaction.untilTurn, circle: 0 };
      fidelity.push({ name: c.name, owner, status: "modelled" });
      continue;
    }
    if (c.legendaryResistance) {
      legendaryResistance = c.legendaryResistance;
      fidelity.push({ name: c.name, owner, status: "modelled" });
      continue;
    }
    if (c.legendary) {
      const use = c.legendary.action ?? (c.legendary.attackRef ? attackNamed(c.legendary.attackRef) : undefined);
      if (use) {
        legendary.push({ action: { ...use, name: c.name } as ModelledAction, cost: c.legendary.cost });
        fidelity.push({ name: c.name, owner, status: "modelled" });
      } else fidelity.push({ name: c.name, owner, status: "skipped", reason: "unsupported-feature" });
      continue;
    }
    let action = c.action;
    let skip = c.skip;
    if (c.multiattack) {
      const bound = bindMultiattack(c.multiattack, attacks, c.name);
      if ("skip" in bound) skip = bound.skip;
      else action = bound;
    }
    if (action) {
      actions.push(action);
      fidelity.push({ name: c.name, owner, status: "modelled" });
    } else {
      fidelity.push({ name: c.name, owner, status: "skipped", reason: skip ?? "unsupported-feature" });
    }
  }
  if (!actions.some(isDamaging)) {
    fidelity.push({ name: owner, owner, status: "skipped", reason: "no-damaging-action" });
  }
  return { actions, fidelity, legendary, reaction, legendaryResistance, bonusActions, bonusMoves, reactions };
}

/** "30 ft., fly 60 ft. (hover)": the walking and flying speeds, in feet. */
export function speedsOf(text: string): { walk: number; fly?: number } {
  const walk = parseInt(text.match(/^\s*(\d+)/)?.[1] ?? "30", 10);
  const fly = text.match(/\bfly(?:ing)? (\d+)/i)?.[1];
  return { walk, ...(fly ? { fly: parseInt(fly, 10) } : {}) };
}

/** The lair actions of a monster's category note (`category: "[[Red Dragons]]"`), or none. */
function lairOf(ctx: Ctx, category: unknown): ModelledAction[] {
  const name = linkNames(typeof category === "string" ? category : undefined)[0];
  if (!name) return [];
  const file = ctx.vault.resolveLink(name);
  if (!file) return [];
  return parseLairActions(ctx.vault.readSync(file));
}

/** Legendary actions a round: the usual three. */
const LEGENDARY_POINTS = 3;

const SPELLS_FOLDER = `${BESTIARY_PREFIX.split("/")[0]}/worldbuilding/spells/`;

const spellIndexes = new WeakMap<Ctx, Map<string, string>>();
const spellKey = (name: string) =>
  name
    .toLowerCase()
    .replace(/[\u2019']/g, "'")
    .replace(/\s*ᴷ$/, "")
    .trim();

/** The spell note of a name as a monster's list writes it ("hold person" is `Hold Person`), or undefined. */
function spellNoteNamed(ctx: Ctx, name: string): string | undefined {
  let index = spellIndexes.get(ctx);
  if (!index) {
    index = new Map();
    for (const f of ctx.vault.getMarkdownFiles()) {
      if (f.path.startsWith(SPELLS_FOLDER) && !index.has(spellKey(f.basename))) index.set(spellKey(f.basename), f.path);
    }
    spellIndexes.set(ctx, index);
  }
  return index.get(spellKey(name));
}

/**
 * A monster's spells as actions: each list's spells read from their notes (the `roll:` or the prose) with the
 * numbers that give its stated DC (casting modifier = DC - 8 - PB of its CR), at will or a number of times a
 * day (as `limit.perDay`, the engine's), cast at circle 0 since a monster has no slots.
 */
function monsterSpells(
  ctx: Ctx,
  casting: MonsterSpellcasting,
  abilities: CombatActor["abilities"],
  cr: number,
  owner: string
): { actions: ModelledAction[]; fidelity: FidelityRecord[]; reaction?: CombatActor["reaction"] } {
  const pb = pbOfCr(cr);
  const castingModifier =
    casting.dc !== undefined ? casting.dc - 8 - pb : casting.ability ? abilities[casting.ability].modifier : 0;
  const numbers: SpellNumbers = { proficiencyBonus: pb, castingModifier, characterLevel: Math.max(1, Math.round(cr)) };
  const actions: ModelledAction[] = [];
  const fidelity: FidelityRecord[] = [];
  let reaction: CombatActor["reaction"];
  for (const list of casting.lists) {
    for (const spell of list.spells) {
      const note = spellNoteNamed(ctx, spell);
      if (!note) {
        fidelity.push({ name: spell, owner, status: "skipped", reason: "monster-spellcasting" });
        continue;
      }
      let input: SpellOptionInput;
      try {
        input = readSpell(ctx, note, 0, owner, "Spellcasting");
      } catch {
        fidelity.push({ name: spell, owner, status: "skipped", reason: "monster-spellcasting" });
        continue;
      }
      const asReaction = reactionOfSpell(input);
      if (asReaction) {
        reaction ??= { ...asReaction, circle: 0 };
        fidelity.push({ name: input.name, owner, status: "modelled" });
        continue;
      }
      const result = resolveSpellOption(input, numbers, owner);
      fidelity.push(result.fidelity);
      if (!result.action) continue;
      const action = { ...result.action, circle: 0 } as ModelledAction;
      if (list.perDay !== undefined && (action.kind === "save" || action.kind === "weapon" || action.kind === "heal")) {
        actions.push({ ...action, limit: { perDay: list.perDay } });
      } else if (list.perDay !== undefined && action.kind === "spell-attack") {
        // A limited spell attack is played as a weapon swing with the same numbers and a daily limit.
        actions.push({
          kind: "weapon",
          name: action.name,
          hitBonus: action.hitBonus,
          damage: action.damage,
          limit: { perDay: list.perDay },
          ...(action.inflicts ? { inflicts: action.inflicts } : {}),
        });
      } else actions.push(action);
    }
  }
  return { actions, fidelity, ...(reaction ? { reaction } : {}) };
}

/** A bestiary note as a combatant. Throws naming the note (or the note and feature ref) it cannot load. */
/** "Mage with Void-Blessed": the creature and the template note to apply to it ("Mage" alone has none). */
function splitTemplate(ref: string): { note: string; template?: string } {
  const m = ref.match(/^(.+?)\s+with\s+(?:the\s+)?(.+?)(?:\s+template)?$/i);
  return m ? { note: m[1].trim(), template: m[2].trim() } : { note: ref };
}

/** A creature and a template as the one reference the simulator loads: "Mage with Void-Blessed". */
export function withTemplate(note: string, template: string | undefined): string {
  return template ? `${note} with ${template}` : note;
}

export async function loadMonster(ctx: Ctx, ref: string): Promise<LoadedMonster> {
  const { note: baseRef, template } = splitTemplate(ref);
  const file = findFile(ctx, baseRef);
  if (!file) throw new Error(`No monster note "${baseRef}"`);
  // A name ("Goblin") reads through readMonsterNote, which looks past a note of the same name that is no monster.
  const state = readMonsterNote(ctx, baseRef.includes("/") ? file.path : baseRef);
  if (state.kind === "non-monster") throw new Error(`"${baseRef}" is not a monster note (no stat.monster block)`);
  if (state.kind === "unresolvable") throw new Error(`"${baseRef}" cannot be read as a monster: ${state.why}`);
  if (!template) return monsterOf(ctx, state.file, state.yaml);

  // A template: the base creature's features worked into it, as `rpg sim homebrew --template` does.
  // Loaded when asked for: templates.ts reads this module's constants as it loads.
  const { templateNamed, TEMPLATES_FOLDER } = await import("./templates");
  const t = templateNamed(ctx, template);
  if (!t) throw new Error(`No template "${template}" in ${TEMPLATES_FOLDER} (\`rpg sim templates\` lists them)`);
  const base = await monsterOf(ctx, state.file, state.yaml);
  const applied = applyTemplateBlock({ ...state.yaml }, t.block, {
    baseName: base.name,
    baseFeatures: base.features,
    cr: crNumber(base.cr),
  });
  const monster = await monsterOf(ctx, state.file, applied.data, { templated: true });
  const key = withTemplate(state.file.path, t.name);
  return {
    ...monster,
    note: key,
    name: `${base.name} (${t.name})`,
    actor: { ...monster.actor, key, name: `${base.name} (${t.name})` },
    template: t.name,
  };
}

/** The simulator's creature from a statblock's YAML (a note's own, or one a template changed). */
async function monsterOf(
  ctx: Ctx,
  file: TFile,
  yaml: Record<string, unknown>,
  options: { templated?: boolean } = {}
): Promise<LoadedMonster> {
  const data = mapMonster(yaml);
  const refs = data.features.map((f) => f.ref);
  // resolveStatFeatures reads the global `app`, which the last boot() set: point it at this vault.
  (globalThis as Record<string, unknown>).app = ctx.app;
  const resolved = await resolveStatFeatures(data.features, file.path, yaml);
  if (resolved.length !== refs.length) {
    throw new Error(`Monster "${file.path}": its feature refs could not be resolved (no app to resolve them with)`);
  }
  // A template's feature the vault's features note lacks is left out (and reported), not a broken creature.
  const missing: string[] = [];
  resolved.forEach((feature, i) => {
    if (!feature.text.trim() && !feature.type) {
      if (options.templated && /Monster Template Traits/.test(refs[i])) missing.push(refs[i]);
      else
        throw new Error(`Monster "${file.path}": feature ref "${refs[i]}" did not resolve (note or block not found)`);
    }
  });
  if (missing.length) {
    for (let i = resolved.length - 1; i >= 0; i--) {
      if (missing.includes(refs[i])) {
        resolved.splice(i, 1);
        refs.splice(i, 1);
      }
    }
  }

  const { actions, fidelity, legendary, reaction, legendaryResistance, bonusActions, bonusMoves, reactions } =
    actionsAndFidelity(resolved, refs, file.path);
  for (const ref of missing) {
    fidelity.push({
      name: ref.split("#").pop() ?? ref,
      owner: file.path,
      status: "skipped",
      reason: "unsupported-feature",
    });
  }
  let spellReaction: CombatActor["reaction"];
  // Spellcasting: each spell of its lists read from the vault's spell notes, at its uses a day.
  const crNum = crNumber(data.cr ?? "0");
  for (const f of resolved) {
    const spellcasting = classifyMonsterFeature({
      name: f.name?.trim() ?? "",
      type: f.type,
      text: f.text,
    }).spellcasting;
    if (!spellcasting) continue;
    const cast = monsterSpells(ctx, spellcasting, abilitiesOf(data), crNum, file.path);
    actions.push(...cast.actions);
    spellReaction ??= cast.reaction;
    // The Spellcasting feature's own skip is replaced by a record per spell.
    const at = fidelity.findIndex((r) => r.reason === "monster-spellcasting");
    if (at >= 0) fidelity.splice(at, 1);
    fidelity.push(...cast.fidelity);
    const none = fidelity.findIndex((r) => r.reason === "no-damaging-action");
    if (none >= 0 && actions.some(isDamaging)) fidelity.splice(none, 1);
  }
  const abilities = abilitiesOf(data);
  const cr = data.cr ?? "0";
  const name = data.name || file.basename;
  const actor: CombatActor = {
    key: file.path,
    name,
    side: "monsters",
    level: 0,
    proficiencyBonus: 2,
    armorClass: leadingInt(data.stats.ac) ?? 10,
    maxHp: leadingInt(data.stats.hp) ?? 1,
    initiativeModifier: abilities.dex.modifier,
    abilities,
    slots: [],
    actions,
  };
  // Resistances and the like: the lines' types and conditions, and the text of the traits they name.
  const stats = data.stats as Record<string, unknown>;
  const defences = defencesOf(
    { resistant: stats.resistant, immune: stats.immune, vulnerable: stats.vulnerable },
    (trait) => resolved.find((f) => f.name?.trim().toLowerCase() === trait.trim().toLowerCase())?.text
  );
  if (!noDefences(defences)) actor.defences = defences;
  // Legendary actions: 3 points a round, the usual number (the notes do not write another).
  if (legendary.length) actor.legendary = { points: LEGENDARY_POINTS, actions: legendary };
  if (reaction ?? spellReaction) actor.reaction = reaction ?? spellReaction;
  if (legendaryResistance) actor.legendaryResistance = legendaryResistance;
  // Where it moves and how it hides: its speeds, Flyby, its passive Stealth and Perception.
  const speeds = speedsOf(String(data.stats.speed ?? ""));
  actor.speed = speeds.walk;
  if (speeds.fly) actor.fly = speeds.fly;
  if (resolved.some((f) => /^fly-?by$/i.test(f.name?.trim() ?? ""))) actor.flyby = true;
  if (bonusActions.length) actor.bonusActions = bonusActions;
  if (bonusMoves.length) actor.bonusMoves = bonusMoves;
  if (reactions.length) actor.reactions = reactions;
  const passive = (key: string) => {
    const n = parseInt(String((data.stats as Record<string, unknown>)[key] ?? ""), 10);
    return Number.isFinite(n) ? n : undefined;
  };
  const stealth = passive("pas_stealth");
  if (stealth !== undefined) actor.stealth = stealth - 10;
  const perception = passive("pas_perception");
  if (perception !== undefined) actor.passivePerception = perception;
  // Its lair's actions, from its category note's "Lair Actions" (used when the fight is in its lair): a
  // legendary creature's only, as a wyrmling of the family keeps no lair.
  const lair = legendary.length ? lairOf(ctx, data.category) : [];
  if (lair.length) {
    actor.lair = lair;
    for (const a of lair) fidelity.push({ name: `Lair: ${a.name}`, owner: file.path, status: "modelled" });
  }
  return {
    note: file.path,
    name,
    actor,
    cr,
    speed: leadingInt(data.stats.speed) ?? 0,
    habitat: linkNames(data.habitat ?? categoryHabitat(ctx, data.category, file.path)),
    monsterType: plainType(data.type),
    fidelity,
    features: resolved.map((f, i) => ({ name: f.name?.trim() || refs[i], type: f.type, text: f.text })),
    speedText: data.stats.speed ?? "",
    ...(parseRole(yaml.role) ? { role: parseRole(yaml.role) } : {}),
    ...(parseSubrole(yaml.subrole) ? { subrole: parseSubrole(yaml.subrole) } : {}),
  };
}
