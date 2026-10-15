/**
 * Session actions → drawer cards.
 *
 * A system tells the log what an entity can do (`SessionActions`, see
 * `SessionAction` in the system API); this turns each into a card whose log
 * template reads the same in every system:
 *
 *   @({{actor}}) Mining Pick → {{target}}
 *   d: Attack | d20+5=
 *   d: Piercing damage | 1d6+3=
 *
 * Dice are left unrolled for the Log to roll. A save is rolled by its target
 * (`d: DEX save | d20= vs DC 13 ->`); anything else just records the action.
 */

import { actionCall } from "./action-call";
import type { CardBucket, CardRider, SessionFeatureCard } from "./card-types";

export interface SessionAction {
  name: string;
  bucket?: string;
  hit?: string;
  damage?: string;
  save?: string;
  skills?: string[];
  target?: boolean;
  freeform?: boolean;
  range?: string;
  summary?: string;
  icon?: string;
  rank?: number;
  /** The note that describes it (`Dash`, `Shortsword`, `Humanoid Traits#Mining
   *  Pick`) — where the action's hover card reads its description from. */
  link?: string;
  /**
   * A rider — rolled WITH an attack, never on its own (Mystic Mark): the extra
   * damage it adds, the uses it costs (`Mystic Mark`, 1), and the condition it
   * leaves on the target (`marked`), which later attacks find and ride free on.
   */
  rider?: { damage?: string; cost?: { resource: string; amount: number }; mark?: string };
  /** The ammunition each shot spends, and where the actor carries it
   *  (`Arrows`, in `["Quiver"]`) — `[Inv:Talon/Quiver/[[Arrows]]-1]`. */
  ammo?: { item: string; path?: string[] };
  /** Where it comes from — a `spell`, a `weapon`, a `feature`, or one of the
   *  `basic` actions anyone has — so a crowded stack can be split by it. */
  origin?: "spell" | "weapon" | "feature" | "basic";
  /** A spell cast with a slot: its lowest circle, and its damage at each
   *  circle it can be cast at (`{ 1: "3d8 cold", 2: "4d8 cold" }`). */
  cast?: { circle: number; damage: Record<number, string> };
  /** A condition it can leave on its target (Icicle Javelin's `pinned`). */
  inflicts?: {
    condition: string;
    save?: string;
    when?: string;
    fail?: string;
    optional?: boolean;
    note?: string;
    on?: "fail";
  };
  /** The hit points it restores to its target, as dice (Nature's Gift's `2d4`) —
   *  aimed at the party, the healer among them. */
  heal?: string;
  /** The uses it spends as it plays, as the log names them (`Nature's Gift`, 1). */
  spends?: { resource: string; amount: number };
  /** A Multiattack: how many attacks, and which, its one action holds. */
  multiattack?: { count: number; attacks: string[] };
  /** An attack's reach — a `melee` or `ranged` weapon, or a `spell` — what a
   *  martial action riding on it asks for (Wind Up, melee; Aim, ranged). */
  attackForm?: "melee" | "ranged" | "spell";
  /** A move it grants (Scurry: 15 ft, without provoking). */
  grantsMove?: import("lib/domains/battlemap/movement-rules").MoveGrant;
}

const BUCKETS: CardBucket[] = ["attack", "action", "bonus", "reaction", "active", "passive", "resource"];

/** `6 (1d6 + 3) piercing` / `1d6+3 piercing` → `{ dice: "1d6+3", type: "piercing" }`. */
export function parseDamage(raw: string | undefined): { dice: string; type?: string } | null {
  if (!raw) return null;
  // A statblock writes the average first and the dice in parentheses.
  const inParens = raw.match(/\(([^)]*)\)/);
  const diceSource = inParens && /\d*d\d+/i.test(inParens[1]) ? inParens[1] : raw;
  const m = diceSource.match(/\d*d\d+(?:\s*[+-]\s*\d+)*/i);
  if (!m) return null;
  const rest =
    diceSource === raw ? raw.slice(m.index! + m[0].length) : raw.slice(inParens!.index! + inParens![0].length);
  const type = rest.match(/[a-z]+/i)?.[0]?.toLowerCase();
  return { dice: m[0].replace(/\s+/g, ""), ...(type && type !== "damage" ? { type } : {}) };
}

/** `+5`, `5`, `+6 (DEX)` → `+5` / `+6`; anything already signed notation kept. */
function hitBonus(hit: string): string {
  const t = hit.trim();
  const n = t.match(/^[+-]?\s*\d+/)?.[0].replace(/\s+/g, "");
  if (n) return /^[+-]/.test(n) ? n : `+${n}`;
  return t.startsWith("+") || t.startsWith("-") ? t : `+${t}`;
}

/** Whose page an action is called on: the page, and what the log calls the actor. */
export interface ActorPage {
  page: string;
  label?: string;
}

/** The lonelog lines one action appends — its name a call on the actor's page
 *  (`@[[Kobold, Elite]].action("Mining Pick")`) when the page is known. */
export function actionTemplate(action: SessionAction, actorPage?: ActorPage): string {
  // Free-form: whatever the actor does, and how it turns out (dropped when left
  // blank).
  //   @(Talon) Received [[Kowyn's Bag]] from Kobold.
  //   => And I began to think of what we might gain by keeping him close.
  if (action.freeform) {
    return ["@({{actor}}) {{what_happens}}", "=> {{outcome?}}"].join("\n");
  }
  // A skill check reads like a hand-written one: what you do, the roll with
  // its skill and DC, and what came of it —
  //   @(Talon) Checking if the Kobold is lying
  //   d: d20+[[Insight]]= vs DC 10 ->
  //   => I watched him. Scared, yes. But honest.
  // The skill is picked as the card plays and resolved for the actor; the
  // outcome line is optional, dropped when left blank.
  if (action.skills && action.skills.length > 0) {
    // The action is named (a call, so its hover says what it does), then what's done.
    const named = actorPage ? `${actionCall(actorPage.page, action.name, actorPage.label)}: ` : "";
    return [
      `@({{actor}}) ${named}{{what_you_do}}`,
      `d: d20+[[{{skill:${action.skills.join("|")}}}]]= vs DC {{dc}} ->`,
      "=> {{outcome?}}",
    ].join("\n");
  }
  const target = action.hit || action.save || action.target || action.heal ? " → {{target}}" : "";
  const named = actorPage ? actionCall(actorPage.page, action.name, actorPage.label) : action.name;
  const lines = [`@({{actor}}) ${named}${target}`];
  // An attack is rolled against its target's AC — filled from the target as it's
  // picked — so the Log can say whether it hit.
  if (action.hit) lines.push(`d: Attack | d20${hitBonus(action.hit)}= vs AC {{target_ac}} ->`);
  const saveLine = (() => {
    if (!action.save) return undefined;
    const m = action.save.match(/^\s*([A-Za-z]+)\s*(?:DC\s*)?(\d+)/i);
    return m ? `d: ${m[1].toUpperCase()} save | d20= vs DC ${m[2]} ->` : `d: Save | d20= -> ${action.save}`;
  })();
  const damage = parseDamage(action.damage);
  const damageLine = damage
    ? `d: ${damage.type ? `${damage.type[0].toUpperCase()}${damage.type.slice(1)} damage` : "Damage"} | ${damage.dice}=`
    : undefined;
  // An attack that also forces a save (Magnetobolt: on a hit, damage — and a
  // STR save against being knocked prone): the hit's damage, then the save for
  // what more it does. A save with no attack decides its damage: save first.
  const rolls = action.hit ? [damageLine, saveLine] : [saveLine, damageLine];
  for (const line of rolls) if (line) lines.push(line);
  // Healing is rolled for its target, and the Log adds it to their hit points.
  const heal = parseDamage(action.heal);
  if (heal) lines.push(`d: Healing | ${heal.dice}=`);
  // What it spends — a feature's uses, a shot's ammunition — on one line of tags.
  const spent = [
    ...(action.spends ? [`[{{actor}}/${action.spends.resource}-${action.spends.amount}]`] : []),
    ...(action.ammo ? [`[Inv:{{actor}}/${[...(action.ammo.path ?? []), `[[${action.ammo.item}]]`].join("/")}-1]`] : []),
  ];
  if (spent.length > 0) lines.push(`=> ${spent.join(" ")}`);
  // A Multiattack's attacks are written under it as it plays; their outcome, here.
  if (action.multiattack) lines.push("=> {{outcome?}}");
  return lines.join("\n");
}

/** A sentence for the confirmation, when the system gave none. */
function defaultSummary(action: SessionAction): string {
  const parts: string[] = [];
  if (action.hit) parts.push(`attack at ${hitBonus(action.hit)}`);
  if (action.save) parts.push(`force a ${action.save} save`);
  if (action.skills?.length) parts.push(`check with ${action.skills.join(", ")}`);
  const damage = parseDamage(action.damage);
  if (damage) parts.push(`${damage.dice}${damage.type ? ` ${damage.type}` : ""} damage`);
  const heal = parseDamage(action.heal);
  if (heal) parts.push(`heal ${heal.dice} hit points`);
  if (action.range) parts.push(action.range);
  if (action.freeform) return "Do something no other card covers, and say how it turns out.";
  if (parts.length === 0) return `Take the ${action.name} action.`;
  const sentence = `${action.name}: ${parts.join(", ")}`;
  return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
}

/** Cards for an entity's actions, under its actor name. */
export function sessionActionCards(
  actions: SessionAction[],
  actor: string,
  idPrefix: string,
  actorPage?: ActorPage
): SessionFeatureCard[] {
  // Riders aren't cards of their own: each attack that rolls to hit offers them.
  const riders: CardRider[] = actions
    .filter((a) => a.rider)
    .map((a) => {
      const dice = parseDamage(a.rider!.damage)?.dice;
      return {
        name: a.name,
        ...(dice ? { damage: dice } : {}),
        ...(a.rider!.cost ? { cost: a.rider!.cost } : {}),
        ...(a.rider!.mark ? { mark: a.rider!.mark } : {}),
      };
    });
  return actions
    .filter((a) => !a.rider)
    .map((a, i) => ({ a, i }))
    .sort((x, y) => (x.a.rank ?? Infinity) - (y.a.rank ?? Infinity) || x.i - y.i)
    .map(({ a }) => {
      const bucket = (BUCKETS as string[]).includes(a.bucket ?? "")
        ? (a.bucket as CardBucket)
        : a.hit
          ? "attack"
          : "action";
      return {
        id: `${idPrefix}:${bucket}:${a.name}`,
        name: a.name,
        bucket,
        logTemplate: actionTemplate(a, actorPage),
        summary: a.summary ?? defaultSummary(a),
        icon: a.icon,
        source: idPrefix,
        actor,
        ...(a.origin ? { origin: a.origin } : {}),
        ...(a.cast ? { cast: a.cast } : {}),
        ...(a.inflicts ? { inflicts: a.inflicts } : {}),
        ...(a.heal ? { targets: "allies" as const } : {}),
        ...(a.attackForm ? { attackForm: a.attackForm } : {}),
        ...(a.range ? { range: a.range } : {}),
        ...(a.grantsMove ? { grantsMove: a.grantsMove } : {}),
        ...(a.multiattack
          ? { multiattack: { count: a.multiattack.count, attacks: a.multiattack.attacks.map((name) => ({ name })) } }
          : {}),
        ...(a.hit && riders.length > 0 ? { riders } : {}),
      };
    });
}

/** The names of an entity's riders — features that only ride on attacks. */
export function riderNames(actions: SessionAction[]): Set<string> {
  return new Set(actions.filter((a) => a.rider).map((a) => a.name.toLowerCase()));
}
