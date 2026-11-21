/**
 * Monster roles (Monster Vault, "Monster Roles and Tactics"): controller,
 * leader, soldier and striker. A role is written in a statblock (`role:` in its
 * `rpg stat.monster` fence) or guessed from the statblock: its hit points, AC
 * and damage per round against the Creature Statistics by Challenge Rating
 * table, and what its features say (conditions, areas, allies, mobility,
 * guarding). Subroles say more about how it fights (ranged, caster, flier,
 * ambusher, healer, area, legendary, minion). Equivalents are monsters of the
 * same role near the same CR, to swap one for another in a new setting.
 * Pure: no Obsidian and no I/O.
 */

import { averageOf } from "./rng";
import type { ModelledAction } from "./types";

export const MONSTER_ROLES = ["controller", "leader", "soldier", "striker"] as const;
export type MonsterRole = (typeof MONSTER_ROLES)[number];

export const SUBROLES = ["ranged", "caster", "flier", "ambusher", "healer", "area", "legendary", "minion"] as const;
export type Subrole = (typeof SUBROLES)[number];

export type RoleConfidence = "high" | "medium" | "low";

/** A role as text: one of the four, case and plural forgiven; undefined otherwise. */
export function parseRole(text: unknown): MonsterRole | undefined {
  if (typeof text !== "string") return undefined;
  const word = text.trim().toLowerCase().replace(/s$/, "");
  return (MONSTER_ROLES as readonly string[]).includes(word) ? (word as MonsterRole) : undefined;
}

/** What the guess reads of a monster. */
export interface RoleInput {
  name: string;
  /** CR as a number (1/2 is 0.5). */
  cr: number;
  ac: number;
  hp: number;
  /** The speed line as written ("30 ft., fly 60 ft."). */
  speed: string;
  /** Its features, resolved to prose. `type` is action, bonus, reaction, trait or legendary. */
  features: Array<{ name: string; type?: string; text: string }>;
  /** The actions the simulator models (for damage per round). */
  actions: ModelledAction[];
}

export interface RoleGuess {
  role: MonsterRole;
  confidence: RoleConfidence;
  /** The runner-up when it was close (a monster that fills two roles). */
  alt?: MonsterRole;
  subroles: Subrole[];
  scores: Record<MonsterRole, number>;
  /** Short reasons, strongest first ("damage 1.6x CR", "inflicts restrained"). */
  reasons: string[];
  /** Against the CR table: hit points, AC and damage per round. */
  ratios: { hp: number; ac: number; dpr: number };
}

/** The Creature Statistics by Challenge Rating table: AC (middle of its range), HP and damage per round (middle). */
const CR_TABLE: Array<[cr: number, ac: number, hp: number, dpr: number]> = [
  [0, 9.5, 8, 1],
  [0.125, 10, 10, 3],
  [0.25, 11, 15, 6],
  [0.5, 12, 25, 9],
  [1, 14, 40, 14.5],
  [2, 14, 60, 22],
  [3, 14, 80, 28.5],
  [4, 14, 100, 34.5],
  [5, 15, 120, 40.5],
  [6, 15, 140, 46.5],
  [7, 15, 160, 52.5],
  [8, 15, 175, 58.5],
  [9, 16, 195, 64.5],
  [10, 16, 215, 70.5],
  [11, 16, 235, 76.5],
  [12, 16, 250, 82.5],
  [13, 17, 265, 88.5],
  [14, 17, 280, 94.5],
  [15, 17, 300, 100.5],
  [16, 17, 315, 106.5],
  [17, 18.5, 335, 112.5],
  [18, 18.5, 350, 118.5],
  [19, 18.5, 370, 130.5],
  [20, 18.5, 395, 148.5],
  [21, 19.5, 425, 166.5],
  [22, 19.5, 450, 184.5],
  [23, 19.5, 500, 202.5],
  [24, 19.5, 550, 220.5],
  [25, 20.5, 600, 238.5],
  [26, 20.5, 650, 256.5],
  [27, 20.5, 700, 274.5],
  [28, 20.5, 750, 292.5],
  [29, 21, 800, 310.5],
  [30, 21, 850, 338.5],
];

/** The table's row for a CR (the nearest at or below it). */
export function crBenchmark(cr: number): { ac: number; hp: number; dpr: number } {
  let row = CR_TABLE[0];
  for (const r of CR_TABLE) if (r[0] <= cr + 1e-9) row = r;
  return { ac: row[1], hp: row[2], dpr: row[3] };
}

/** The steps of the CR ladder (0, 1/8, 1/4, 1/2, 1, 2 … 30): how far apart two CRs are. */
export function crStep(cr: number): number {
  let step = 0;
  CR_TABLE.forEach((r, i) => {
    if (r[0] <= cr + 1e-9) step = i;
  });
  return step;
}

function actionDamage(action: ModelledAction): number {
  switch (action.kind) {
    case "weapon":
    case "spell-attack":
      return averageOf(action.damage.expr);
    case "multiattack":
      return action.swings.reduce((sum, s) => sum + averageOf(s.damage.expr), 0);
    case "save":
      return averageOf(action.damage.expr) * (action.area ? 1.5 : 1);
    default:
      return 0;
  }
}

/** The best damage one of its modelled actions deals in a round (an area counted for one and a half targets). */
export function damagePerRound(actions: ModelledAction[]): number {
  return actions.reduce((best, a) => Math.max(best, actionDamage(a)), 0);
}

function plain(text: string): string {
  return text.replace(/[*_]+/g, "").replace(/\s+/g, " ").trim();
}

const NAME_ROLE = /\b(controller|leader|soldier|striker)\b/i;
const LEADER_NAME =
  /\b(captain|chief|chieftain|warchief|warlord|commander|leader|king|queen|priest|priestess|shaman|sergeant|lieutenant|general|boss|matriarch|patriarch|marshal|abbot|archdruid|hierophant)\b/i;

const STRONG_CONDITIONS = [
  "restrained",
  "frightened",
  "charmed",
  "paralyzed",
  "stunned",
  "blinded",
  "incapacitated",
  "petrified",
  "deafened",
  "slowed",
];
const WEAK_CONDITIONS = ["grappled", "prone", "poisoned"];

const CONTROL_SPELLS =
  /\b(hold (?:person|monster)|web|entangle|sleep|fear|slow|hypnotic pattern|confusion|command|bane|blindness\/deafness|charm person|dominate \w+|suggestion|silence|darkness|fog cloud|grease|banishment|wall of \w+|black tentacles|plant growth|sleet storm|stinking cloud|tasha'?s hideous laughter|hideous laughter|faerie fire|ray of enfeeblement|compulsion|cause fear|tangle|spike growth|moonbeam|mass suggestion|feeblemind|power word stun|maze)\b/gi;
const LEADER_SPELLS =
  /\b(cure wounds|healing word|mass (?:cure wounds|healing word)|prayer of healing|bless|aid|heroism|shield of faith|beacon of hope|haste|mass heal|heal|warding bond|death ward|guidance|spiritual weapon|revivify|freedom of movement|greater invisibility|enhance ability)\b/gi;

const ALLY = /\b(friendly creatures?|allies|ally|allied creatures?|its companions)\b/i;
/** An ally is the one who gains: "each friendly creature … has advantage", "up to two allies … Each target gains". */
const ALLY_GAINS =
  /\b(?:friendly creatures?|allies|ally|allied creatures?|each target)\b[^.]{0,80}?\b(gains?|ha(?:s|ve) advantage|regains?|can (?:use (?:its|their) reaction|make|move|add|immediately)|adds?|is resistant|are resistant|deals? (?:an )?extra|is immune|are immune|takes? (?:a|an|one) (?:bonus|additional))\b/i;
const ALLY_CHOSEN =
  /\b(?:one|two|three|up to \w+|each|any number of)\s+(?:other\s+)?(?:friendly creatures?|allies|ally|allied creatures?)\b/i;
const ALLY_BENEFIT =
  /\b(advantage|temporary (?:hit points|HP)|regains?|bonus|add (?:a |its )?d\d|\+\d+ to|resistan|immune|reaction|extra (?:\d+ )?damage|inspir|command)\b/i;
/** Conditions it is spared, not ones it deals: "isn't incapacitated", "immune to the charmed and frightened conditions". */
const NEGATED =
  /\b(?:immune|resistant|resistance|advantage on saving throws)\b[^.]*?\bconditions?\b|\b(?:isn't|is not|aren't|are not|can't be|not|immune to(?: the)?|resistant to(?: the)?|against being|ends? the)\s+(?:\w+\s+(?:or|and)\s+)?\w+/gi;
const HEAL_OTHER =
  /\b(?:(?:another|one|a) (?:creature|ally|friendly creature)|target)\b[^.]{0,80}\bregains?\b|\bregains?\b[^.]{0,40}\b(?:another|ally|each friendly)\b/i;

const FORCED =
  /\b(pushed|pulled|knocked|is pushed|teleports? (?:the|a|one) (?:target|creature)|difficult terrain|speed (?:becomes|is reduced to|drops to) 0|can't take reactions|disadvantage on (?:attack|saving|ability)|can't (?:regain hit points|move))\b/i;
const AREA =
  /\b(each|every|all) creatures?\b[^.]{0,60}\b(within|in (?:a|the|that)|of its choice)\b|\b\d+-foot[- ](?:cone|line|cube|sphere|radius|emanation|cylinder)\b/i;

const MOBILITY =
  /\b(doesn't provoke opportunity attacks|without provoking|takes? the (?:Disengage|Dash) action|Disengage|teleports?,? (?:along with[^.]*?)?up to \d+ feet|jumps? up to)\b/i;
const AMBUSH =
  /\b(Hide action|takes the Hide|is hidden|while hidden|Sneak Attack|Ambush\w*|Pounce|Charge|Surprise Attack|invisible|unseen attacker|camouflage)\b/i;
const EXTRA_DAMAGE = /\bextra \d+ \(\d+d\d+\)|\bextra (?:\d+d\d+|die of)\b/i;
const GUARD =
  /\b(Protect|guard|Parry|Shield Block|intercept|becoming the new target|new target|opportunity attacks? (?:against|when)|Sentinel|Defensive|bodyguard|Pack Tactics|Stand Firm|Phalanx)\b/i;
const HEAL_SELF = /\bregains?\b[^.]{0,30}\bhit points\b/i;

const RANGED = /\b(Ranged (?:Weapon|Spell) Attack|range \d+\s*\/?\s*\d*\s*ft|ranged attack)\b/i;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function speedOf(text: string): { walk: number; fly: number } {
  const walk = /^\s*(\d+)/.exec(text);
  const fly = /\bfly (\d+)/i.exec(text);
  return { walk: walk ? Number(walk[1]) : 0, fly: fly ? Number(fly[1]) : 0 };
}

/** The role a statblock reads as, with why and how sure. */
export function guessRole(input: RoleInput): RoleGuess {
  const bench = crBenchmark(input.cr);
  const dpr = damagePerRound(input.actions);
  const ratios = {
    hp: bench.hp > 0 ? input.hp / bench.hp : 1,
    ac: input.ac - bench.ac,
    dpr: bench.dpr > 0 ? dpr / bench.dpr : 1,
  };
  const scores: Record<MonsterRole, number> = { controller: 0, leader: 0, soldier: 0.8, striker: 0 };
  const reasons: Array<[weight: number, text: string]> = [];
  const add = (role: MonsterRole, weight: number, why: string): void => {
    if (weight === 0) return;
    scores[role] += weight;
    if (Math.abs(weight) >= 0.3) reasons.push([Math.abs(weight), `${role}: ${why}`]);
  };

  // The name says it outright (the role templates' examples: Goblin Controller, Worg Soldier…).
  const named = NAME_ROLE.exec(input.name);
  if (named) add(named[1].toLowerCase() as MonsterRole, 4, `named a ${named[1].toLowerCase()}`);
  if (LEADER_NAME.test(input.name)) add("leader", 1.5, `"${LEADER_NAME.exec(input.name)![1]}" in the name`);

  // Numbers against the CR table.
  if (ratios.dpr > 1.15) add("striker", clamp((ratios.dpr - 1) * 2, 0, 2), `damage ${ratios.dpr.toFixed(1)}x its CR's`);
  if (ratios.dpr < 0.7 && dpr > 0) add("striker", -0.3, `damage ${ratios.dpr.toFixed(1)}x its CR's`);
  if (ratios.hp > 1.1) add("soldier", clamp((ratios.hp - 1) * 2, 0, 1.5), `HP ${ratios.hp.toFixed(1)}x its CR's`);
  if (ratios.hp < 0.8) add("striker", 0.4, `HP ${ratios.hp.toFixed(1)}x its CR's`);
  if (ratios.ac >= 1)
    add("soldier", clamp(ratios.ac * 0.3, 0, 1), `AC ${ratios.ac > 0 ? "+" : ""}${ratios.ac} for its CR`);
  if (ratios.ac <= -2) add("striker", 0.3, `AC ${ratios.ac} for its CR`);
  if (ratios.dpr >= 0.8 && ratios.dpr <= 1.2 && ratios.hp >= 0.9) add("soldier", 0.3, "even damage and HP");

  const { walk, fly } = speedOf(input.speed);
  if (fly >= 30 || walk >= 40) add("striker", 0.4, fly ? `flies ${fly} ft.` : `speed ${walk} ft.`);

  // What the features say.
  let leader = 0;
  let control = 0;
  let strike = 0;
  let guard = 0;
  const conditions = new Set<string>();
  const subroles = new Set<Subrole>();
  for (const feature of input.features) {
    const text = plain(feature.text);
    const all = `${feature.name}. ${text}`;
    const type = feature.type?.toLowerCase() ?? "";
    if (type === "legendary" || /legendary (?:actions|resistance)/i.test(all)) subroles.add("legendary");
    const spellcasting = /spellcasting/i.test(feature.name) || /casts one of the following spells/i.test(text);
    if (spellcasting) {
      subroles.add("caster");
      const controls = new Set([...text.matchAll(CONTROL_SPELLS)].map((m) => m[1].toLowerCase()));
      const supports = new Set([...text.matchAll(LEADER_SPELLS)].map((m) => m[1].toLowerCase()));
      if (controls.size) control += Math.min(2, controls.size * 0.5);
      if (supports.size) leader += Math.min(1.5, supports.size * 0.4);
      if ([...supports].some((s) => /cure|heal|prayer/.test(s))) subroles.add("healer");
      if (controls.size)
        reasons.push([controls.size * 0.5, `controller: casts ${[...controls].slice(0, 3).join(", ")}`]);
      if (supports.size) reasons.push([supports.size * 0.4, `leader: casts ${[...supports].slice(0, 3).join(", ")}`]);
      continue;
    }
    if (ALLY_GAINS.test(text) || (ALLY_CHOSEN.test(text) && ALLY_BENEFIT.test(text))) {
      leader += 1.2;
      reasons.push([1.2, `leader: ${feature.name} helps allies`]);
    }
    if (HEAL_OTHER.test(text)) {
      leader += 0.8;
      subroles.add("healer");
    } else if (HEAL_SELF.test(text) && type !== "trait") guard += 0.3;
    // Conditions it inflicts (not ones it is spared), and only from what it does, not what it is.
    if (type !== "trait" || /saving throw|DC \d+/i.test(text)) {
      const dealt = text.replace(NEGATED, " ");
      for (const c of [...STRONG_CONDITIONS, ...WEAK_CONDITIONS]) {
        if (new RegExp(`\\b${c}\\b`, "i").test(dealt) && /\b(target|creature|DC \d+)\b/i.test(dealt)) {
          conditions.add(c);
        }
      }
    }
    if (FORCED.test(text)) control += 0.6;
    if (AREA.test(text) && /saving throw|DC \d+/i.test(text)) {
      control += 0.4;
      subroles.add("area");
    }
    if (MOBILITY.test(all) && !ALLY.test(text)) strike += 0.6;
    if (AMBUSH.test(all)) {
      strike += 0.7;
      subroles.add("ambusher");
    }
    if (EXTRA_DAMAGE.test(text)) strike += 0.5;
    if (GUARD.test(all)) guard += 0.6;
    if (RANGED.test(text) || (/\brange\b/i.test(text) && /to hit/i.test(text))) subroles.add("ranged");
  }
  const strong = [...conditions].filter((c) => STRONG_CONDITIONS.includes(c));
  const weak = [...conditions].filter((c) => WEAK_CONDITIONS.includes(c));
  control += strong.length * 0.7 + Math.min(0.4, weak.length * 0.2);
  if (conditions.size)
    reasons.push([
      strong.length * 0.7 + Math.min(0.4, weak.length * 0.2),
      `controller: inflicts ${[...conditions].join(", ")}`,
    ]);
  add("leader", clamp(leader, 0, 3.5), "");
  add("controller", clamp(control, 0, 3.5), "");
  add("striker", clamp(strike, 0, 1.8), strike ? "mobile or strikes from hiding" : "");
  add("soldier", clamp(guard, 0, 1.5), guard ? "guards or holds the line" : "");

  // "Many legendary creatures are strikers capable of acting alone."
  if (subroles.has("legendary")) add("striker", 1.2, "legendary, fights alone");
  if (fly >= 30) subroles.add("flier");
  if (input.hp <= Math.max(7, bench.hp * 0.35)) subroles.add("minion");
  if (scores.striker > 0 && strike >= 0.7 && /hidden|Hide|Sneak/i.test(input.features.map((f) => f.text).join(" "))) {
    subroles.add("ambusher");
  }

  const ranked = [...MONSTER_ROLES].sort((a, b) => scores[b] - scores[a]);
  const [top, second] = ranked;
  const margin = scores[top] - scores[second];
  const confidence: RoleConfidence = named || margin >= 1.2 ? "high" : margin >= 0.5 ? "medium" : "low";
  return {
    role: top,
    confidence,
    ...(margin < 0.6 && !named ? { alt: second } : {}),
    subroles: SUBROLES.filter((s) => subroles.has(s)),
    scores: Object.fromEntries(MONSTER_ROLES.map((r) => [r, Math.round(scores[r] * 100) / 100])) as Record<
      MonsterRole,
      number
    >,
    reasons: reasons
      .filter(([, text]) => !/: $/.test(text))
      .sort((a, b) => b[0] - a[0])
      .map(([, text]) => text)
      .filter((t, i, list) => list.indexOf(t) === i)
      .slice(0, 5),
    ratios: {
      hp: Math.round(ratios.hp * 100) / 100,
      ac: Math.round(ratios.ac * 10) / 10,
      dpr: Math.round(ratios.dpr * 100) / 100,
    },
  };
}

/** A monster as the equivalents search compares it. */
export interface RoleProfile {
  note: string;
  name: string;
  cr: number;
  role: MonsterRole;
  subroles: Subrole[];
  ratios: { hp: number; dpr: number };
  type?: string;
  habitat?: string[];
  /** The bestiary folder it is filed under (its family), to prefer another. */
  family?: string;
}

export interface Equivalent extends RoleProfile {
  /** Lower is closer: CR steps apart, then how unlike its HP and damage are, less for shared subroles. */
  distance: number;
  /** CR steps from the one it replaces (negative: lower). */
  crSteps: number;
}

/**
 * The monsters of the same role within `maxSteps` of its CR on the ladder, closest first.
 * A monster of the same family is moved back (it adds no variety), the target itself left out.
 */
export function equivalentsOf(
  target: RoleProfile,
  pool: RoleProfile[],
  options: { maxSteps?: number; limit?: number } = {}
): Equivalent[] {
  const maxSteps = options.maxSteps ?? 1;
  const at = crStep(target.cr);
  const out: Equivalent[] = [];
  for (const m of pool) {
    if (m.note === target.note || m.role !== target.role) continue;
    const crSteps = crStep(m.cr) - at;
    if (Math.abs(crSteps) > maxSteps) continue;
    const shared = m.subroles.filter((s) => target.subroles.includes(s)).length;
    const unlike =
      Math.abs(Math.log((m.ratios.hp || 0.01) / (target.ratios.hp || 0.01))) +
      Math.abs(Math.log((m.ratios.dpr || 0.01) / (target.ratios.dpr || 0.01)));
    const distance =
      Math.abs(crSteps) + Math.min(unlike, 2) * 0.5 - shared * 0.25 + (m.family && m.family === target.family ? 1 : 0);
    out.push({ ...m, distance: Math.round(distance * 100) / 100, crSteps });
  }
  out.sort((a, b) => a.distance - b.distance || a.name.localeCompare(b.name));
  return options.limit !== undefined ? out.slice(0, options.limit) : out;
}
