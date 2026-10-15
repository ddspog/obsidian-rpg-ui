import type { AspectModifier } from "../features/types";
export const ASPECT_BUCKETS = ["action", "bonus", "reaction", "active", "passive", "resource"] as const;

export type AspectBucket = (typeof ASPECT_BUCKETS)[number];

/** A card's stack: a feature aspect bucket, or `attack` for the rolls an
 *  entity attacks with (weapons, attack spells, a creature's strikes). */
/** A card's stack — and `status`: a condition its bearer has to shake off,
 *  a stack of its own while it lasts. */
export type CardBucket = AspectBucket | "attack" | "status";

/** Stack order in the drawer — attacks first, the turn's main business. */
export const CARD_BUCKETS: CardBucket[] = ["attack", ...ASPECT_BUCKETS];

export interface SessionFeatureCard {
  id: string;
  name: string;
  bucket: CardBucket;
  logTemplate: string;
  text?: string;
  /** What the card does, in a sentence — the confirmation shown before it plays. */
  summary?: string;
  /** A Lucide icon name drawn large on the card face. */
  icon?: string;
  /** A card whose lines come from the fight, not its template: `start-combat`
   *  (its own popup), `next-turn` (`T2`), `next-round` (`R(Talon)`). */
  kind?: "start-combat" | "next-round" | "next-turn" | "end-combat" | "move" | "party";
  /** A Party card's form (`short-rest`, `loot`, `travel`…). */
  partyKind?: string;
  resourceRef?: string;
  /** What this passive/active does to other cards, and that an active toggles. */
  modifies?: AspectModifier[];
  toggle?: boolean;
  /** For a toggle: whether it's on now (read from the log). */
  on?: boolean;
  /** What other features change on this card (`Rage: +2 damage`), shown on it. */
  modifiedBy?: Array<{ from: string; text: string }>;
  /** Advantage / disadvantage other features give its rolls — why, for each. */
  grants?: {
    attack?: { advantage?: string[]; disadvantage?: string[] };
    saves?: { advantage?: Record<string, string[]>; disadvantage?: Record<string, string[]> };
  };
  maxUses?: number;
  /** Its uses as the sheet counts them, when no number (`PB`) — resolved per character. */
  maxExpr?: string;
  recovery?: string;
  recharge?: string;
  source: string;
  /** What kind of source grants it (`class`, `heritage`, `talent`, `item`,
   *  `spell`, `basic`) — the hotbar tints its tile by it. */
  sourceKind?: string;
  actor: string;
  /** What can ride on this attack (Mystic Mark) — offered when it plays. */
  riders?: CardRider[];
  /** A spell's components, and the magic it is of (`Primordial`) — what casting it takes in hand. */
  components?: import("./casting").ComponentNeeds;
  spellSources?: string[];
  /** Where it comes from — a `spell`, a `weapon`, a `feature`, or one of the
   *  `basic` actions anyone has — so a crowded stack can be split by it. */
  origin?: "spell" | "weapon" | "feature" | "basic";
  /** A spell cast with a slot: its lowest circle, and its damage at each
   *  circle it can be cast at (`{ 1: "3d8 cold", 2: "4d8 cold" }`). */
  cast?: { circle: number; damage: Record<number, string> };
  /** A condition it can leave on its target (Icicle Javelin's `pinned`). */
  /** …landing on a hit, or (`on: "fail"`) only on a failed save as well. */
  inflicts?: {
    condition: string;
    save?: string;
    when?: string;
    fail?: string;
    optional?: boolean;
    note?: string;
    on?: "fail";
  };
  /** A Multiattack: how many attacks its one action holds, and the attacks it
   *  may make — each with its card's template once the actor's cards are known. */
  multiattack?: {
    count: number;
    attacks: Array<{ name: string; logTemplate?: string; range?: string; melee?: boolean }>;
  };
  /** A move it grants (Scurry: 15 ft, without provoking) — held to its own limit. */
  grantsMove?: import("lib/domains/battlemap/movement-rules").MoveGrant;
  /** How far it reaches (`reach 10 ft.`, `80/320 ft.`), as its source says. */
  range?: string;
  /** An attack's reach: a `melee` or `ranged` weapon, or a `spell`. */
  attackForm?: "melee" | "ranged" | "spell";
  /** The note it's described in, when not its feature's (`Weapon Option`). */
  link?: string;
  /** It can go WITH an attack as well (Wind Up, Aim) — which attacks, and what
   *  it adds: damage, to-hit (a number or `PB`). Taken as its own action. */
  ridesWith?: { with?: "melee" | "ranged"; damage?: number | string; hit?: number | string };
  /** How it's taken, when its stack doesn't say — an attack cast as a bonus
   *  action or a reaction plays from the Attack stack all the same. */
  takes?: "bonus" | "reaction";
  /** Whom it's aimed at, when not the foes: `allies` — the party, its actor first
   *  (a heal: Nature's Gift). */
  targets?: "allies" | "dying";
  /** What the fight it ends was worth in XP (End Combat) — its preview's total. */
  xpWorth?: number;
  /** A line it adds only when its check succeeds (Stabilize: `=> [PC:{{target}}|+stable]`). */
  onSuccess?: string;
  /** A status card: the condition it shakes off, and the line freeing the bearer
   *  that a successful save adds (`=> [F:…|-pinned]`). */
  status?: { condition: string; onSuccess: string };
}

/** A rider an attack can carry: its extra damage, its cost, the mark it leaves. */
export interface CardRider {
  name: string;
  /** Its extra damage dice (`1d4`), or a flat amount (`2`). */
  damage?: string;
  /** What it adds to the attack roll (`2` — Aim's doubled PB). */
  hit?: string;
  /** It's an action of its own taken with the attack (Wind Up's bonus action):
   *  spent hit or miss, so a miss keeps it (and its to-hit), dropping its damage. */
  takes?: "bonus" | "reaction";
  /** The uses it spends, as the log names them (`Mystic Mark`, 1). */
  cost?: { resource: string; amount: number };
  /** The condition it leaves on what it hits (`marked`). */
  mark?: string;
}

export interface CardStack {
  actor: string;
  actorType: "pc" | "gm" | "foe";
  bucket: string;
  label: string;
  cards: SessionFeatureCard[];
}

export const DEFAULT_LOG_TEMPLATE = "@({{actor}}) uses {{name}}";

export const BUCKET_LABELS: Record<CardBucket, string> = {
  attack: "Attack",
  action: "Action",
  bonus: "Bonus Action",
  reaction: "Reaction",
  active: "Active",
  passive: "Passive",
  resource: "Resource",
  status: "Status",
};
