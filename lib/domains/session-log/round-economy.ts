/**
 * What each creature did with its round — its action, bonus action and
 * reaction, and the attacks it made — counted from the log, so the round line
 * can say it at a glance:
 *
 *   » Jacqui Ilitul's round      ◆ action  ◇ bonus  ◇ reaction  ⚔ 1
 *
 * Nothing is blocked: one of each is the rule, but features bend it
 * (Multiattack, Extra Attack, Action Surge), so a second is only flagged.
 *
 * A round (`R(Jacqui Ilitul)`) runs until the next round, turn, or the end of
 * the fight. Each of its entries is classed by the card it plays — the action
 * a call names (`@[[Kowyn]].action("Nature's Gift")` → a bonus action), or the
 * card its text begins with (`@(Talon) Dash`); an attack is any `Attack` roll.
 * Another creature's reaction in the round is its own, and named as such.
 *
 * A Multiattack is one action: the attacks after it in the round are its own,
 * up to its count — `ACTION · multiattack ⚔ 2`, flagged only past that.
 *
 * It's one of the cards that HOLD attacks — an Opportunity Attack is another
 * (a reaction holding one melee attack, made in someone else's round). Each
 * such card's line and the attacks it holds are drawn as one entry, whoever's
 * round it falls in.
 */

import { findActionCalls, leadingActionCall } from "./action-call";
import { matchActor } from "./actors";
import { combatantKey } from "./initiative";
import type { SidebarItem } from "./prose-model";
import type { ProseSegment } from "./prose-grouper";
import type { MultiattackSpec } from "./multiattack";

export type ActionKind = "action" | "bonus" | "reaction";

/** One creature's round, as the log spent it. */
export interface RoundEconomy {
  /** Whose round it is, as the marker names them. */
  owner: string;
  action: number;
  bonus: number;
  reaction: number;
  attacks: number;
  /** Others who reacted in it (`Talon`). */
  reacted: string[];
  /** What spent each of the owner's slots (`bonus: ["Wind Up"]`) — to say on hover. */
  used: Record<ActionKind, string[]>;
  /** Others' reactions in it, and what they were. */
  reactions: Array<{ actor: string; name: string }>;
  /** A Multiattack it took: its line's entry, and the attacks it held. */
  multiattack?: { opener: number; strikes: number[] };
  /** Every card in the round that held attacks (a Multiattack, an Opportunity
   *  Attack — anyone's): its line's entry, its name, the attacks it held. */
  groups: Array<{ opener: number; name: string; strikes: number[] }>;
}

/** An actor's Multiattack, when the action named is one (`multiattackOf(actor, name)`). */
export type MultiattackOf = (actor: string, name: string | undefined) => MultiattackSpec | undefined;

/**
 * How an entry's action is taken — `kindOf(actor, name, text)` answers from
 * the actor's cards; undefined when no card says (narration, a move).
 */
export type KindOf = (actor: string, name: string | undefined, text: string) => ActionKind | undefined;

const sameActor = (a: string, b: string) =>
  combatantKey(a) === combatantKey(b) || matchActor(a, [{ name: combatantKey(b) }]) >= 0;

/** Each round's tally, by the round marker's segment. */
export function roundEconomies(
  segments: ProseSegment[],
  kindOf: KindOf,
  multiattackOf: MultiattackOf = () => undefined
): Map<number, RoundEconomy> {
  const out = new Map<number, RoundEconomy>();
  let open: { id: number; actor: string; tally: RoundEconomy } | undefined;
  // Who's holding attacks still to make, by combatant: what's left, of which,
  // and the group they go to.
  const holding = new Map<string, { left: number; attacks: string[]; group: { strikes: number[] } }>();
  for (const seg of segments) {
    if (seg.type === "turn") {
      open = {
        id: seg.sourceIndex,
        actor: seg.actor,
        tally: {
          owner: seg.actor,
          action: 0,
          bonus: 0,
          reaction: 0,
          attacks: 0,
          reacted: [],
          used: { action: [], bonus: [], reaction: [] },
          reactions: [],
          groups: [],
        },
      };
      holding.clear();
      out.set(open.id, open.tally);
      continue;
    }
    if (seg.type === "round" || seg.type === "combat-end") {
      open = undefined;
      continue;
    }
    if (!open || seg.type !== "action-group" || !seg.action.actor) continue;
    const actor = seg.action.actor;
    const text = seg.action.text ?? "";
    const kind = kindOf(actor, leadingActionCall(text)?.name, text);
    const name = leadingActionCall(text)?.name;
    // What the entry is, to say what spent a slot: its call, else its first words.
    const what = name ?? text.split(/\s*(?:→|->|,|\.|\bwith\b)\s*/)[0].trim();
    const attacks = (seg.rolls ?? []).filter((r) => /\battack\b/i.test(r.label ?? "")).length;
    // A card that holds attacks (Multiattack, Opportunity Attack) opens a group;
    // an attack its holder still owes joins it.
    const spec = multiattackOf(actor, name);
    const key = combatantKey(actor);
    const held = holding.get(key);
    const allowed = (n?: string) => !n || !held!.attacks.length || held!.attacks.includes(n.toLowerCase());
    let joined = false;
    if (spec) {
      const group = { opener: seg.sourceIndex, name: name ?? "Multiattack", strikes: [] as number[] };
      open.tally.groups.push(group);
      holding.set(key, { left: spec.count, attacks: spec.attacks.map((a) => a.toLowerCase()), group });
    } else if (held && held.left > 0 && attacks > 0 && allowed(name)) {
      held.left -= 1;
      held.group.strikes.push(seg.sourceIndex);
      joined = true;
    }
    if (!sameActor(actor, open.actor)) {
      // Someone else's reaction — noted here; spent from THEIR reaction, the
      // one their own latest round gave them (it lasts until their next).
      if (kind === "reaction") {
        if (!open.tally.reacted.includes(actor)) open.tally.reacted.push(actor);
        open.tally.reactions.push({ actor, name: what });
        const theirs = [...out.values()].filter((e) => e !== open!.tally && sameActor(actor, e.owner)).pop();
        if (theirs) {
          theirs.reaction += 1;
          theirs.used.reaction.push(`${what} (in ${open.actor}'s round)`);
        }
      }
      continue;
    }
    open.tally.attacks += attacks;
    // What rides with it (`… with @[[Lilith]].action("Wind Up")`) is spent too,
    // when it's an action of its own — Wind Up's bonus action; Mystic Mark's free.
    for (const call of findActionCalls(text).filter((c) => c.start > 0 || !leadingActionCall(text))) {
      const rides = kindOf(actor, call.name, "");
      if (rides === "bonus" || rides === "reaction") {
        open.tally[rides] += 1;
        open.tally.used[rides].push(name ? `${call.name} (with ${name})` : call.name);
      }
    }
    // The card holding attacks is the slot spent (a Multiattack's action); the
    // attacks it holds spend none of their own.
    if (spec) {
      const slot = kind ?? "action";
      open.tally[slot] += 1;
      open.tally.used[slot].push(name ?? "Multiattack");
      if (slot === "action")
        open.tally.multiattack = { opener: seg.sourceIndex, strikes: holding.get(key)!.group.strikes };
      continue;
    }
    if (joined) continue;
    if (kind) {
      open.tally[kind] += 1;
      open.tally.used[kind].push(what);
    }
  }
  return out;
}

/**
 * The Log's round lines, each with its tally; a Multiattack drawn as the one
 * entry it is — its line folded into its first attack's header strip
 * (`MULTIATTACK 2 attacks · MOVE → H6`), its attacks run on below.
 */
export function withRoundEconomy(items: SidebarItem[], economies: Map<number, RoundEconomy>): SidebarItem[] {
  const group = new Map<number, "part" | "last">();
  const heads = new Map<number, number>();
  const firsts = new Map<number, { n: number; name: string }>();
  for (const e of economies.values()) {
    for (const g of e.groups) {
      if (g.strikes.length === 0) continue;
      heads.set(g.opener, g.strikes.length);
      firsts.set(g.strikes[0], { n: g.strikes.length, name: g.name });
      g.strikes.forEach((id, i, all) => group.set(id, i === all.length - 1 ? "last" : "part"));
    }
  }
  return items.flatMap((item) => {
    if (heads.has(item.id)) return [];
    const g = group.get(item.id);
    let grouped = g ? { ...item, group: g } : item;
    const first = firsts.get(item.id);
    if (first && grouped.rows[0]) {
      const pill = { name: first.name, value: `${first.n} attack${first.n > 1 ? "s" : ""}`, kind: "multiattack" };
      grouped = {
        ...grouped,
        rows: [{ ...grouped.rows[0], pills: [pill, ...grouped.rows[0].pills] }, ...grouped.rows.slice(1)],
      };
    }
    const tally = item.kind === "turn" ? economies.get(item.id) : undefined;
    if (!tally || !grouped.rows[0]) return [grouped];
    return [{ ...grouped, rows: [{ ...grouped.rows[0], economy: tally }, ...grouped.rows.slice(1)] }];
  });
}

/**
 * What a creature has spent now, to warn a card about to spend it again:
 * its action and bonus action in its own round, if that's the round under
 * way; its reaction since its own round began (a reaction comes back then).
 */
export function slotsUsed(
  segments: ProseSegment[],
  economies: Map<number, RoundEconomy>,
  actor: string
): Record<ActionKind, string[]> {
  const out: Record<ActionKind, string[]> = { action: [], bonus: [], reaction: [] };
  // The round under way: the last marker, unless the turn or the fight has ended since.
  let current: number | undefined;
  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i];
    if (seg.type === "turn") {
      current = seg.sourceIndex;
      break;
    }
    if (seg.type === "round" || seg.type === "combat-end") break;
  }
  if (current == null) return out;
  const order = [...economies.entries()];
  const now = order.findIndex(([id]) => id === current);
  // Back to the actor's own latest round — its reaction is spent from there on.
  let own = -1;
  for (let i = now; i >= 0; i--) {
    if (sameActor(actor, order[i][1].owner)) {
      own = i;
      break;
    }
  }
  // Not had its round yet this fight: its reaction is spent from the fight's start.
  let fightStart = -Infinity;
  for (const seg of segments)
    if (seg.type === "combat-start" && seg.sourceIndex <= current) fightStart = seg.sourceIndex;
  const from = own >= 0 ? own + 1 : order.findIndex(([id]) => id > fightStart);
  if (own >= 0) {
    const mine = order[own][1];
    if (own === now) {
      out.action.push(...mine.used.action);
      out.bonus.push(...mine.used.bonus);
    }
    // Its reaction window's — its own round's, and those taken in others' rounds since.
    out.reaction.push(...mine.used.reaction);
    return out;
  }
  // Not had its round yet: the reactions it took in others' rounds this fight.
  for (const [, e] of order.slice(Math.max(0, from), now + 1)) {
    for (const r of e.reactions) if (sameActor(actor, r.actor)) out.reaction.push(r.name);
  }
  return out;
}
