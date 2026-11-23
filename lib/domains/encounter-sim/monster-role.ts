/**
 * Monster roles (Monster Vault, "Monster Roles and Tactics"): controller,
 * leader, soldier and striker, each split into subroles (the tree below, the
 * owner's). A role and subrole are written in a statblock (`role:` and
 * `subrole:` in its `rpg stat.monster` fence) or guessed from it: its hit
 * points, AC and damage per round against the Creature Statistics by Challenge
 * Rating table, and what its features say (conditions, areas, allies helped,
 * mobility, hiding, guarding). Tags (flier, caster, legendary, swarm) sit
 * outside the tree. Equivalents are monsters of the same subrole, then the same
 * role, near the same CR, to swap one for another in a new setting.
 * Pure: no Obsidian and no I/O.
 */

import { averageOf } from "./rng";
import type { ModelledAction } from "./types";

export const MONSTER_ROLES = ["controller", "leader", "soldier", "striker"] as const;
export type MonsterRole = (typeof MONSTER_ROLES)[number];

/** Each role's subroles; the first is the one a monster gets when nothing points elsewhere. */
export const SUBROLE_TREE = {
  controller: ["hexer", "disabler", "zoner", "mover"],
  leader: ["commander", "healer", "warder", "summoner"],
  soldier: ["rank-and-file", "guardian", "brute", "pinner"],
  striker: ["bruiser", "skirmisher", "ambusher", "artillery", "solo"],
} as const;
export type Subrole = (typeof SUBROLE_TREE)[MonsterRole][number];
export const SUBROLES: readonly Subrole[] = MONSTER_ROLES.flatMap((r) => [...SUBROLE_TREE[r]]);

/** What a subrole means, in a line (for help and the review page). */
export const SUBROLE_MEANING: Record<Subrole, string> = {
  disabler: "takes one target out: paralyzed, stunned, petrified, charmed",
  zoner: "controls ground and groups: areas, webs, walls, difficult terrain",
  hexer: "weakens without removing: frightened, poisoned, disadvantage, curses",
  mover: "pushes, pulls, knocks prone or teleports foes",
  commander: "grants allies attacks, movement or advantage",
  healer: "restores allies' hit points",
  warder: "temporary HP, resistances, AC or fear immunity for allies",
  summoner: "calls, raises or creates allies",
  guardian: "draws attacks, protects allies",
  brute: "big HP, steady melee",
  pinner: "grapples or restrains",
  "rank-and-file": "weak alone, fought in numbers",
  skirmisher: "hits and moves away",
  ambusher: "strikes from hiding",
  artillery: "damage from range",
  bruiser: "melee burst: pounce, charge, extra dice",
  solo: "legendary, fights alone",
};

/** Tags outside the tree: how a monster moves or acts, used to break ties between equivalents. */
export const MONSTER_TAGS = ["flier", "caster", "legendary", "swarm"] as const;
export type MonsterTag = (typeof MONSTER_TAGS)[number];

export type RoleConfidence = "high" | "medium" | "low";

/** A role as text: one of the four, case and plural forgiven; undefined otherwise. */
export function parseRole(text: unknown): MonsterRole | undefined {
  if (typeof text !== "string") return undefined;
  const word = text.trim().toLowerCase().replace(/s$/, "");
  return (MONSTER_ROLES as readonly string[]).includes(word) ? (word as MonsterRole) : undefined;
}

/** A subrole as text ("Rank and file", "ambushers"); undefined when it is not one. */
export function parseSubrole(text: unknown): Subrole | undefined {
  if (typeof text !== "string") return undefined;
  const word = text.trim().toLowerCase().replace(/\s+/g, "-");
  const found = SUBROLES.find((s) => s === word || `${s}s` === word);
  return found;
}

/** The role a subrole belongs to. */
export function roleOfSubrole(subrole: Subrole): MonsterRole {
  return MONSTER_ROLES.find((r) => (SUBROLE_TREE[r] as readonly string[]).includes(subrole))!;
}

/** What the guess reads of a monster. */
export interface RoleInput {
  name: string;
  /** The type line ("Medium swarm of Tiny Beasts"), for the swarm tag. */
  type?: string;
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
  subrole: Subrole;
  confidence: RoleConfidence;
  /** The runner-up role when it was close (a monster that fills two roles). */
  alt?: MonsterRole;
  tags: MonsterTag[];
  scores: Record<MonsterRole, number>;
  /** Short reasons, strongest first ("damage 1.6x CR", "inflicts restrained"). */
  reasons: string[];
  /** Against the CR table: hit points, AC and damage per round. */
  ratios: { hp: number; ac: number; dpr: number };
  /** How much each subrole was pointed to (for a written role without a subrole). */
  subroleScores: Record<Subrole, number>;
  /** When the scores were too close and a signature feature decided instead: which rule. */
  rule?: string;
}

/** The subrole of `role` the guess leans to most (the tree's first on a tie). */
export function bestSubrole(guess: Pick<RoleGuess, "subroleScores">, role: MonsterRole): Subrole {
  const choices = SUBROLE_TREE[role] as readonly Subrole[];
  return choices.reduce((best, s) => (guess.subroleScores[s] > guess.subroleScores[best] ? s : best), choices[0]);
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

/** The conditions it deals, by the controller subrole they point to (restrained and grappled: zoner or pinner). */
const CONDITION_SUBROLE: Record<string, Subrole> = {
  paralyzed: "disabler",
  stunned: "disabler",
  petrified: "disabler",
  charmed: "disabler",
  incapacitated: "disabler",
  frightened: "hexer",
  poisoned: "hexer",
  blinded: "hexer",
  deafened: "hexer",
  slowed: "hexer",
  restrained: "zoner",
  grappled: "pinner",
  prone: "mover",
};
const STRONG_CONDITIONS = new Set(["paralyzed", "stunned", "petrified", "charmed", "incapacitated", "restrained"]);

const SPELL_SUBROLE: Array<[RegExp, Subrole]> = [
  [
    /\b(hold (?:person|monster)|sleep|hypnotic pattern|banishment|power word stun|feeblemind|dominate \w+|charm person|suggestion|mass suggestion|maze|(?:tasha'?s )?hideous laughter|flesh to stone)\b/gi,
    "disabler",
  ],
  [
    /\b(web|entangle|wall of \w+|black tentacles|plant growth|sleet storm|stinking cloud|fog cloud|grease|darkness|silence|spike growth|moonbeam|cloudkill|evard'?s black tentacles)\b/gi,
    "zoner",
  ],
  [
    /\b(fear|cause fear|bane|slow|confusion|blindness\/deafness|faerie fire|ray of enfeeblement|command|compulsion|bestow curse|hex)\b/gi,
    "hexer",
  ],
  [/\b(thunderwave|gust of wind|telekinesis|repelling blast)\b/gi, "mover"],
  [
    /\b(cure wounds|healing word|mass (?:cure wounds|healing word)|prayer of healing|mass heal|heal|revivify)\b/gi,
    "healer",
  ],
  [
    /\b(bless|aid|heroism|shield of faith|beacon of hope|warding bond|death ward|freedom of movement|protection from \w+(?: and \w+)?|sanctuary)\b/gi,
    "warder",
  ],
  [/\b(haste|greater invisibility|enhance ability|spiritual weapon|enlarge\/reduce)\b/gi, "commander"],
  [/\b(animate dead|create undead|conjure \w+(?: \w+)?|summon \w+(?: \w+)?|find familiar|planar ally)\b/gi, "summoner"],
];

/** An ally is the one who gains: "each friendly creature … has advantage", "up to two allies … Each target gains". */
const ALLY_GAINS =
  /\b(?:friendly creatures?|allies|ally|allied creatures?|each target)\b[^.]{0,80}?\b(gains?|ha(?:s|ve) advantage|regains?|can (?:use (?:its|their) reaction|make|move|add|immediately)|adds?|is resistant|are resistant|deals? (?:an )?extra|is immune|are immune|takes? (?:a|an|one) (?:bonus|additional))\b/i;
const ALLY_CHOSEN =
  /\b(?:one|two|three|up to \w+|each|any number of)\s+(?:other\s+)?(?:friendly creatures?|allies|ally|allied creatures?)\b/i;
const ALLY_BENEFIT =
  /\b(advantage|temporary (?:hit points|HP)|regains?|bonus|add (?:a |its )?d\d|\+\d+ to|resistan|immune|reaction|extra (?:\d+ )?damage|inspir|command)\b/i;
const WARD =
  /\b(temporary (?:hit points|HP)|resistan|immune|bonus to (?:AC|saving)|\+\d+ (?:bonus )?to (?:AC|saving)|charmed and frightened)\b/i;
const SUMMON =
  /\b(summons?|calls? (?:forth|up to|\d+)|conjures?|animates?|raises? (?:a|an|one|\w+) (?:corpse|dead|undead|zombie|skeleton)|creates? (?:a|an|one|\d+|\w+) [^.]{0,30}?(?:allies|servants?|minions?|undead|zombies?|skeletons?|swarms?|duplicates?|spawn))\b/i;
/** Conditions it is spared, not ones it deals: "isn't incapacitated", "immune to the charmed and frightened conditions". */
const NEGATED =
  /\b(?:immune|resistant|resistance|advantage on saving throws)\b[^.]*?\bconditions?\b|\b(?:isn't|is not|aren't|are not|can't be|not|immune to(?: the)?|resistant to(?: the)?|against being|ends? the)\s+(?:\w+\s+(?:or|and)\s+)?\w+/gi;
const HEAL_OTHER =
  /\b(?:(?:another|one|a) (?:creature|ally|friendly creature)|target)\b[^.]{0,80}\bregains?\b|\bregains?\b[^.]{0,40}\b(?:another|ally|each friendly)\b/i;
const HEAL_SELF = /\bregains?\b[^.]{0,30}\bhit points\b/i;

const MOVES_FOE =
  /\b(pushed|pulled|knocked|pushes|pulls|is pushed|teleports? (?:the|a|one) (?:target|creature)|hurls?|throws? (?:the|a) (?:target|creature)|knocks? (?:the target |it )?prone)\b/i;
const TERRAIN =
  /\b(difficult terrain|speed (?:becomes|is reduced to|drops to) 0|can't take reactions|can't (?:move|regain hit points))\b/i;
const HEX = /\bdisadvantage on (?:attack|saving|ability|its next)\b/i;
const AREA =
  /\b(each|every|all) creatures?\b[^.]{0,60}\b(within|in (?:a|the|that)|of its choice)\b|\b\d+-foot[- ](?:cone|line|cube|sphere|radius|emanation|cylinder)\b/i;

const MOBILITY =
  /\b(doesn't provoke opportunity attacks|without provoking|takes? the (?:Disengage|Dash) action|Disengage|Flyby|teleports?,? (?:along with[^.]*?)?up to \d+ feet|jumps? up to)\b/i;
const HIDING =
  /\b(Hide action|takes the Hide|is hidden|while hidden|hidden from|Sneak Attack|Ambush\w*|Surprise Attack|surprised|invisible|unseen attacker|camouflage|False Appearance)\b/i;
const BURST = /\b(Pounce|Charge|Trampling Charge|Trample|Rampage|Reckless|Brutal)\b/i;
const EXTRA_DAMAGE = /\bextra \d+ \(\d+d\d+\)|\bextra (?:\d+d\d+|die of)\b/i;
const GUARD =
  /\b(Protect\w*|guard|Parry|Shield Block|intercept|becoming the new target|new target|Sentinel|Defensive|bodyguard|Stand Firm|Phalanx|Shield Wall)\b/i;
const PACK = /\b(Pack Tactics|Gang Up|Swarm Tactics|Martial Advantage)\b/i;

/*
 * The role is scored as the owner reviewed it (2026-11-21): these keep its signals as they were.
 * The subrole signals above only choose among the role's subroles and never move the role.
 */
const ROLE_CONTROL_SPELLS =
  /\b(hold (?:person|monster)|web|entangle|sleep|fear|slow|hypnotic pattern|confusion|command|bane|blindness\/deafness|charm person|dominate \w+|suggestion|silence|darkness|fog cloud|grease|banishment|wall of \w+|black tentacles|plant growth|sleet storm|stinking cloud|tasha'?s hideous laughter|hideous laughter|faerie fire|ray of enfeeblement|compulsion|cause fear|tangle|spike growth|moonbeam|mass suggestion|feeblemind|power word stun|maze)\b/gi;
const ROLE_LEADER_SPELLS =
  /\b(cure wounds|healing word|mass (?:cure wounds|healing word)|prayer of healing|bless|aid|heroism|shield of faith|beacon of hope|haste|mass heal|heal|warding bond|death ward|guidance|spiritual weapon|revivify|freedom of movement|greater invisibility|enhance ability)\b/gi;
const ROLE_STRONG = new Set([
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
]);
const ROLE_FORCED =
  /\b(pushed|pulled|knocked|is pushed|teleports? (?:the|a|one) (?:target|creature)|difficult terrain|speed (?:becomes|is reduced to|drops to) 0|can't take reactions|disadvantage on (?:attack|saving|ability)|can't (?:regain hit points|move))\b/i;
const ROLE_ALLY = /\b(friendly creatures?|allies|ally|allied creatures?|its companions)\b/i;
const ROLE_MOBILITY =
  /\b(doesn't provoke opportunity attacks|without provoking|takes? the (?:Disengage|Dash) action|Disengage|teleports?,? (?:along with[^.]*?)?up to \d+ feet|jumps? up to)\b/i;
const ROLE_AMBUSH =
  /\b(Hide action|takes the Hide|is hidden|while hidden|Sneak Attack|Ambush\w*|Pounce|Charge|Surprise Attack|invisible|unseen attacker|camouflage)\b/i;
const ROLE_GUARD =
  /\b(Protect|guard|Parry|Shield Block|intercept|becoming the new target|new target|opportunity attacks? (?:against|when)|Sentinel|Defensive|bodyguard|Pack Tactics|Stand Firm|Phalanx)\b/i;

const RANGED_ONLY = /\b(Ranged (?:Weapon|Spell) Attack)\b/i;
const MELEE_ALSO = /\b(Melee (?:or Ranged )?(?:Weapon|Spell) Attack|reach \d+ ft)/i;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function speedOf(text: string): { walk: number; fly: number } {
  const walk = /^\s*(\d+)/.exec(text);
  const fly = /\bfly (\d+)/i.exec(text);
  return { walk: walk ? Number(walk[1]) : 0, fly: fly ? Number(fly[1]) : 0 };
}

/**
 * Signature rules: what decides an unsure guess (the scores within 0.5 of each other). They were
 * drawn from a review of the 439 unsure guesses of the testing vault (2026-11-22), where the
 * scores' pick was changed for about half: a monster's job shows in one feature it is built
 * around more than in its numbers. First match wins; none, and the scores' pick stands.
 */
type SignatureInput = {
  names: string;
  name: string;
  type: string;
  cr: number;
  hpRatio: number;
  tags: Set<MonsterTag>;
  sub: Record<Subrole, number>;
  /** The share of its attacks that are ranged only. */
  rangedShare: number;
};

const SIGNATURES: Array<{
  rule: string;
  role: MonsterRole;
  subrole: Subrole;
  test: (m: SignatureInput) => boolean;
}> = [
  {
    rule: "legendary, fights alone",
    role: "striker",
    subrole: "solo",
    test: (m) => m.tags.has("legendary") && !m.tags.has("caster"),
  },
  {
    rule: "brings allies",
    role: "leader",
    subrole: "summoner",
    test: (m) =>
      /\b(Create (?!Water\b)\w+ (?:Elemental|Specter|Undead)|Call (?:Mechadrons|Servitors|Siege Fire)|Animate (?:Trees|Mushrooms|Chains|Dead)|Summon \w+|Reanimated Servants|Quick Creation|Grave Allies|\w+ Servitors|Bound Minion)\b/.test(
        m.names
      ),
  },
  {
    rule: "heals others",
    role: "leader",
    subrole: "healer",
    test: (m) => /\b(Healing (?:Touch|Prayer|Unguent|Sap|Hiss|Fungus|Draught)|Repair)\b/.test(m.names),
  },
  {
    rule: "commands others",
    role: "leader",
    subrole: "commander",
    test: (m) =>
      /\b(Command(?:er|ing)?|Orders|Rally|Inspir\w+|Call to Arms|Empower Follower|Mighty Commander|Aura of (?:Authority|Royalty)|Unsha\w+ Command|Leader’s|Pack Leader)\b/.test(
        m.names
      ),
  },
  {
    rule: "fights from hiding",
    role: "striker",
    subrole: "ambusher",
    test: (m) =>
      /\b(\w+ Camouflage|Invisibility|Earth Glide|Shadow Stealth|Surprise Attack|Sneak Attack|Ambush\w*)\b/.test(
        m.names
      ),
  },
  {
    rule: "charges in",
    role: "striker",
    subrole: "bruiser",
    test: (m) => /\b(Pounce|Diving Pounce|Charge|Trampling Charge|Rampage|Brutal)\b/.test(m.names),
  },
  { rule: "a dragon's bite and breath", role: "striker", subrole: "bruiser", test: (m) => /\bDragon\b/.test(m.type) },
  {
    rule: "hits and slips away",
    role: "striker",
    subrole: "skirmisher",
    test: (m) =>
      /\b(Incorporeal Movement|Shadow Step|Moonlight Step|Flyby|Hit and Run|Reality Skip|Teleport|Lightning Leap)\b/.test(
        m.names
      ),
  },
  {
    rule: "holds its prey",
    role: "soldier",
    subrole: "pinner",
    test: (m) => /\b(Constrict|Swallow|Squeeze|Smother|Strangle|Grappler|Engulf|Death Roll|Tentacles)\b/.test(m.names),
  },
  { rule: "webs the ground", role: "controller", subrole: "zoner", test: (m) => /\bWeb\b/.test(m.names) },
  { rule: "small and plain: fought in numbers", role: "soldier", subrole: "rank-and-file", test: (m) => m.cr <= 1 },
  {
    rule: "big and plain",
    role: "soldier",
    subrole: "brute",
    test: (m) => /\b(Beast|Giant|Construct)\b/.test(m.type) && m.hpRatio >= 0.95,
  },
];

/** The signature rule an unsure monster matches, if any. */
function signatureOf(
  input: RoleInput,
  tags: Set<MonsterTag>,
  hpRatio: number,
  sub: Record<Subrole, number>,
  rangedShare = 0
): { rule: string; role: MonsterRole; subrole: Subrole } | undefined {
  const m: SignatureInput = {
    names: input.features.map((f) => f.name).join("; "),
    name: input.name,
    type: input.type ?? "",
    cr: input.cr,
    hpRatio,
    tags,
    sub,
    rangedShare,
  };
  const hit = SIGNATURES.find((s) => s.test(m));
  return hit ? { rule: hit.rule, role: hit.role, subrole: hit.subrole } : undefined;
}

/** The role and subrole a statblock reads as, with why and how sure. */
export function guessRole(input: RoleInput): RoleGuess {
  const bench = crBenchmark(input.cr);
  const dpr = damagePerRound(input.actions);
  const ratios = {
    hp: bench.hp > 0 ? input.hp / bench.hp : 1,
    ac: input.ac - bench.ac,
    dpr: bench.dpr > 0 ? dpr / bench.dpr : 1,
  };
  const scores: Record<MonsterRole, number> = { controller: 0, leader: 0, soldier: 0.8, striker: 0 };
  const sub = Object.fromEntries(SUBROLES.map((s) => [s, 0])) as Record<Subrole, number>;
  const reasons: Array<[weight: number, text: string]> = [];
  const add = (role: MonsterRole, weight: number, why: string): void => {
    if (weight === 0) return;
    scores[role] += weight;
    if (why && Math.abs(weight) >= 0.3) reasons.push([Math.abs(weight), `${role}: ${why}`]);
  };
  const lean = (subrole: Subrole, weight: number): void => {
    sub[subrole] += weight;
  };
  const tags = new Set<MonsterTag>();

  // The name says it outright (the role templates' examples: Goblin Controller, Worg Soldier…).
  const named = NAME_ROLE.exec(input.name);
  if (named) add(named[1].toLowerCase() as MonsterRole, 4, `named a ${named[1].toLowerCase()}`);
  const ranked = LEADER_NAME.exec(input.name);
  if (ranked) {
    add("leader", 1.5, `"${ranked[1]}" in the name`);
    // A priest or a shaman tends its own; a captain or a chief gives orders.
    lean(/priest|shaman|abbot|archdruid|hierophant/i.test(ranked[1]) ? "healer" : "commander", 0.5);
  }

  // Numbers against the CR table.
  if (ratios.dpr > 1.15) add("striker", clamp((ratios.dpr - 1) * 2, 0, 2), `damage ${ratios.dpr.toFixed(1)}x its CR's`);
  if (ratios.dpr < 0.7 && dpr > 0) add("striker", -0.3, `damage ${ratios.dpr.toFixed(1)}x its CR's`);
  if (ratios.hp > 1.1) {
    add("soldier", clamp((ratios.hp - 1) * 2, 0, 1.5), `HP ${ratios.hp.toFixed(1)}x its CR's`);
    lean("brute", clamp((ratios.hp - 1) * 2, 0, 2));
  }
  if (ratios.hp < 0.8) add("striker", 0.4, `HP ${ratios.hp.toFixed(1)}x its CR's`);
  if (ratios.ac >= 1) {
    add("soldier", clamp(ratios.ac * 0.3, 0, 1), `AC ${ratios.ac > 0 ? "+" : ""}${ratios.ac} for its CR`);
    lean("guardian", clamp(ratios.ac * 0.2, 0, 0.8));
  }
  if (ratios.ac <= -2) add("striker", 0.3, `AC ${ratios.ac} for its CR`);
  if (ratios.dpr >= 0.8 && ratios.dpr <= 1.2 && ratios.hp >= 0.9) add("soldier", 0.3, "even damage and HP");
  if (input.cr <= 1) lean("rank-and-file", 0.6);
  else lean("brute", 0.3);
  if (input.hp <= Math.max(7, bench.hp * 0.5)) lean("rank-and-file", 0.6);
  if (ratios.dpr > 1.3) lean("bruiser", 0.5);

  const { walk, fly } = speedOf(input.speed);
  if (fly >= 30) tags.add("flier");
  if (fly >= 30 || walk >= 40) {
    add("striker", 0.4, fly ? `flies ${fly} ft.` : `speed ${walk} ft.`);
    lean("skirmisher", 0.5);
  }
  if (/\bswarm\b/i.test(`${input.type ?? ""} ${input.name}`)) tags.add("swarm");

  // What the features say.
  let leader = 0;
  let control = 0;
  let strike = 0;
  let guard = 0;
  let attacks = 0;
  let rangedOnly = 0;
  const conditions = new Set<string>();
  for (const feature of input.features) {
    const text = plain(feature.text);
    const all = `${feature.name}. ${text}`;
    const type = feature.type?.toLowerCase() ?? "";
    if (type === "legendary" || /legendary (?:actions|resistance)/i.test(all)) tags.add("legendary");
    const spellcasting = /spellcasting/i.test(feature.name) || /casts one of the following spells/i.test(text);
    if (spellcasting) {
      tags.add("caster");
      for (const [re, subrole] of SPELL_SUBROLE) {
        const found = new Set([...text.matchAll(re)].map((m) => m[1].toLowerCase()));
        // A healing spell makes a healer more than a blessing makes a warder.
        if (found.size) lean(subrole, Math.min(2, found.size * (subrole === "healer" ? 1 : 0.5)));
      }
      const controls = new Set([...text.matchAll(ROLE_CONTROL_SPELLS)].map((m) => m[1].toLowerCase()));
      const supports = new Set([...text.matchAll(ROLE_LEADER_SPELLS)].map((m) => m[1].toLowerCase()));
      if (controls.size) control += Math.min(2, controls.size * 0.5);
      if (supports.size) leader += Math.min(1.5, supports.size * 0.4);
      if (controls.size)
        reasons.push([controls.size * 0.5, `controller: casts ${[...controls].slice(0, 3).join(", ")}`]);
      if (supports.size) reasons.push([supports.size * 0.4, `leader: casts ${[...supports].slice(0, 3).join(", ")}`]);
      continue;
    }
    if (/\bto hit\b/i.test(text)) {
      attacks++;
      if (RANGED_ONLY.test(text) && !MELEE_ALSO.test(text)) rangedOnly++;
    }
    // Helping allies.
    if (ALLY_GAINS.test(text) || (ALLY_CHOSEN.test(text) && ALLY_BENEFIT.test(text))) {
      leader += 1.2;
      reasons.push([1.2, `leader: ${feature.name} helps allies`]);
      // Commands that send allies at the foe make a commander, even when they also shield them.
      if (/\b(advantage|attacks?|moves?|reaction|command\w*|extra)\b/i.test(text)) lean("commander", 1.2);
      else if (WARD.test(text)) lean("warder", 1.2);
    }
    if (HEAL_OTHER.test(text)) {
      leader += 0.8;
      lean("healer", 1.5);
    } else if (HEAL_SELF.test(text) && type !== "trait") guard += 0.3;
    if (SUMMON.test(all) && !/\bsummoned by\b/i.test(text)) lean("summoner", 1.5);
    // Conditions it deals (not ones it is spared), and only from what it does, not what it is.
    if (type !== "trait" || /saving throw|DC \d+/i.test(text)) {
      const dealt = text.replace(NEGATED, " ");
      if (/\b(target|creature|DC \d+)\b/i.test(dealt)) {
        for (const [c, subrole] of Object.entries(CONDITION_SUBROLE)) {
          if (!new RegExp(`\\b${c}\\b`, "i").test(dealt)) continue;
          conditions.add(c);
          // Holding the one it hits is a soldier's grip; restraining from afar or in an area is a controller's.
          if ((c === "grappled" || c === "restrained") && /\bto hit\b/i.test(dealt) && !AREA.test(dealt)) {
            lean("pinner", 1);
          } else lean(subrole, subrole === "disabler" ? 1.5 : STRONG_CONDITIONS.has(c) ? 1 : 0.5);
        }
      }
    }
    if (ROLE_FORCED.test(text)) control += 0.6;
    if (MOVES_FOE.test(text)) lean("mover", 0.8);
    if (TERRAIN.test(text)) lean("zoner", 0.8);
    if (HEX.test(text)) lean("hexer", 0.6);
    if (AREA.test(text) && /saving throw|DC \d+/i.test(text)) {
      control += 0.4;
      lean("zoner", 0.5);
      if (/\bdamage\b/i.test(text)) lean("artillery", 0.4);
    }
    if (ROLE_MOBILITY.test(all) && !ROLE_ALLY.test(text)) strike += 0.6;
    if (ROLE_AMBUSH.test(all)) strike += 0.7;
    if (EXTRA_DAMAGE.test(text)) strike += 0.5;
    if (ROLE_GUARD.test(all)) guard += 0.6;
    const hides = HIDING.test(all);
    // Moving to hide (Shrouded Step) is an ambusher's; moving away, a skirmisher's.
    if (MOBILITY.test(all) && !ALLY_GAINS.test(text) && !hides) lean("skirmisher", 1);
    if (hides) lean("ambusher", 1.2);
    if (BURST.test(all)) lean("bruiser", 1);
    if (EXTRA_DAMAGE.test(text)) lean("bruiser", 0.4);
    if (GUARD.test(all)) lean("guardian", 1.2);
    if (PACK.test(all)) lean("rank-and-file", 0.8);
  }
  if (attacks > 0 && rangedOnly / attacks >= 0.5) {
    lean("artillery", 1.2);
    reasons.push([0.4, "attacks from range"]);
  }
  const strong = [...conditions].filter((c) => ROLE_STRONG.has(c));
  const weak = [...conditions].filter((c) => !ROLE_STRONG.has(c));
  const dealt = strong.length * 0.7 + Math.min(0.4, weak.length * 0.2);
  control += dealt;
  if (conditions.size) reasons.push([dealt, `controller: inflicts ${[...conditions].join(", ")}`]);
  add("leader", clamp(leader, 0, 3.5), "");
  add("controller", clamp(control, 0, 3.5), "");
  add("striker", clamp(strike, 0, 1.8), strike ? "mobile or strikes from hiding" : "");
  add("soldier", clamp(guard, 0, 1.5), guard ? "guards or holds the line" : "");

  // "Many legendary creatures are strikers capable of acting alone."
  if (tags.has("legendary")) {
    add("striker", 1.2, "legendary, fights alone");
    lean("solo", 2.5);
  }

  const order = [...MONSTER_ROLES].sort((a, b) => scores[b] - scores[a]);
  const [top, second] = order;
  const margin = scores[top] - scores[second];
  const confidence: RoleConfidence = named || margin >= 1.2 ? "high" : margin >= 0.5 ? "medium" : "low";
  // Ties go to the earlier subrole of the tree (its default first).
  let role: MonsterRole = top;
  let subrole = bestSubrole({ subroleScores: sub }, top);
  // Too close to call on the scores: a signature feature decides, the scores' pick becoming the runner-up.
  const signature =
    confidence === "low" ? signatureOf(input, tags, ratios.hp, sub, attacks > 0 ? rangedOnly / attacks : 0) : undefined;
  let alt: MonsterRole | undefined = margin < 0.6 && !named ? second : undefined;
  if (signature) {
    if (signature.role !== top) alt = top;
    role = signature.role;
    subrole = signature.subrole;
    reasons.unshift([99, `${role}: ${signature.rule} (decides a close call)`]);
  }
  if (alt === role) alt = undefined;
  return {
    role,
    subrole,
    confidence,
    ...(alt ? { alt } : {}),
    ...(signature ? { rule: signature.rule } : {}),
    tags: MONSTER_TAGS.filter((t) => tags.has(t)),
    scores: Object.fromEntries(MONSTER_ROLES.map((r) => [r, Math.round(scores[r] * 100) / 100])) as Record<
      MonsterRole,
      number
    >,
    reasons: reasons
      .sort((a, b) => b[0] - a[0])
      .map(([, text]) => text)
      .filter((t, i, list) => list.indexOf(t) === i)
      .slice(0, 5),
    ratios: {
      hp: Math.round(ratios.hp * 100) / 100,
      ac: Math.round(ratios.ac * 10) / 10,
      dpr: Math.round(ratios.dpr * 100) / 100,
    },
    subroleScores: sub,
  };
}

/** A monster as the equivalents search compares it. */
export interface RoleProfile {
  note: string;
  name: string;
  cr: number;
  role: MonsterRole;
  subrole: Subrole;
  tags: MonsterTag[];
  ratios: { hp: number; dpr: number };
  type?: string;
  habitat?: string[];
  /** The bestiary folder it is filed under (its family), to prefer another. */
  family?: string;
}

export interface Equivalent extends RoleProfile {
  /** Lower is closer: CR steps apart, another subrole, how unlike its HP and damage are, less for shared tags. */
  distance: number;
  /** CR steps from the one it replaces (negative: lower). */
  crSteps: number;
}

/**
 * The monsters of the same role within `maxSteps` of its CR on the ladder, closest first: the same
 * subrole before another, then the nearest CR and the most alike in HP and damage, shared tags
 * breaking ties. One of the same family is moved back (it adds no variety); the target is left out.
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
    const shared = m.tags.filter((t) => target.tags.includes(t)).length;
    const unlike =
      Math.abs(Math.log((m.ratios.hp || 0.01) / (target.ratios.hp || 0.01))) +
      Math.abs(Math.log((m.ratios.dpr || 0.01) / (target.ratios.dpr || 0.01)));
    const distance =
      (m.subrole === target.subrole ? 0 : 2) +
      Math.abs(crSteps) +
      Math.min(unlike, 2) * 0.5 -
      shared * 0.25 +
      (m.family && m.family === target.family ? 1 : 0);
    out.push({ ...m, distance: Math.round(distance * 100) / 100, crSteps });
  }
  out.sort((a, b) => a.distance - b.distance || a.name.localeCompare(b.name));
  return options.limit !== undefined ? out.slice(0, options.limit) : out;
}
