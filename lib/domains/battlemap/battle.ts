/**
 * A fight on a battle map, replayed from the log.
 *
 *   [Init: [[Kobold, Elite]] 17 @H2; Talon 14 @C4; Lilith 9 @D4]
 *   [COMBAT: [[Kobold Ambush]]]
 *   T1
 *   @(Talon) Dash behind the rocks [Mv: E3]
 *   @(Kobold, Elite) Mining Pick → Lilith [Mv: G4>F4>E4]
 *
 * One pure pass over the log's segments. Each entry inside a combat bound to a
 * map becomes a FRAME. Where a move sits on the action's line says when: before
 * its words, BEFORE the action (`@(Talon) [Mv: K12] Shortsword → Kobold` — he
 * steps up, then strikes); after them, AFTER it (`… → Kobold [Mv: J14]` — he
 * strikes, then moves). A move in an outcome (`=> … [Mv: Lilith G7]`) is after.
 * Everyone starts where the `[Init:]` list puts them
 * (`@C4`, in the order they were rolled) — or, later, where a `[Pos:]` sets
 * them; each frame then holds where every combatant stands after it, who acted, the
 * path they moved and the line of any attack. The map pane draws frames; the
 * timeline steps through them. Nothing is stored outside the note.
 */

import type { MoveTag, PersistentTag, PositionTag } from "lib/domains/lonelog/types";
import { actionTarget } from "lib/domains/session-log/action-call";
import { matchActor } from "lib/domains/session-log/actors";
import { combatantKey, segmentTags } from "lib/domains/session-log/initiative";
import type { ProseSegment } from "lib/domains/session-log/prose-grouper";
import { parseSquare, type Square } from "./square-map";

export interface BattlePlacement {
  /** As first written (`Talon`, `[[Kobold, Elite]]`). */
  name: string;
  at: Square;
}

export interface BattleFrame {
  /** The segment (log entry) this frame follows. */
  id: number;
  round: number;
  /** Who acted in this entry, as written. */
  actor?: string;
  /** Everyone placed so far, where they stand after this entry. */
  placements: BattlePlacement[];
  /** Routes moved in this entry, each from where it started — `after` when
   *  made after the action (a `[Mv:]` in its outcome, not on its line). */
  moves: Array<{ name: string; path: Square[]; after?: boolean }>;
  /** Attacks made in this entry: attacker → target (by name), the entry they
   *  were made in (where their hit or miss is read), and where both stood as
   *  it was made — after any move before it, before any after. */
  attacks: Array<{ from: string; to: string; id: number; fromAt?: Square; toAt?: Square }>;
  /** Conditions each combatant has after this entry, by key — PCs and foes
   *  alike (`[PC:Lilith|+prone]`, `[F:…|+surprised]`, lifted with `-`). */
  conditions: Record<string, string[]>;
  /** This entry opens a creature's round (`R(Kobold, Tinkerer)`): what follows,
   *  until the next round or turn, is theirs — shown on the map as one. */
  slot?: boolean;
}

export interface Battle {
  /** The map, as written in `[COMBAT: …]` (`[[Kobold Ambush]]`). */
  map: string;
  /** The segment that opened the fight. */
  start: number;
  /** The segment that closed it (`[/COMBAT]`); absent while it's still on. */
  end?: number;
  /** Where everyone stands as it opens (from the initiative list's squares). */
  opening: BattlePlacement[];
  /** Token emoji for this fight, by combatant key (`🐸` in the initiative list). */
  icons: Record<string, string>;
  /** Which `[COMBAT]` in the log this is, counted from the top (from 0) — so
   *  an edit to its setup finds its lines. */
  fight: number;
  /** Combatants (by key) whose initiative the list already holds. */
  rolled: string[];
  frames: BattleFrame[];
}

const isPos = (t: PersistentTag): t is PositionTag => t.kind === "position";
const isMove = (t: PersistentTag): t is MoveTag => t.kind === "move";

/** Every map tag a segment carries, in line order (its action line first). */
function mapTags(seg: ProseSegment): PersistentTag[] {
  switch (seg.type) {
    case "action-group":
      return [...(seg.action.tags ?? []), ...seg.consequences.flatMap((c) => c.tags)];
    case "oracle":
    case "world-event":
      return seg.consequences.flatMap((c) => c.tags);
    case "standalone-consequence":
      return seg.entry.tags;
    default:
      return [];
  }
}

/** Every tag a segment carries — for the conditions given and lifted in it. */
function allTags(seg: ProseSegment): PersistentTag[] {
  switch (seg.type) {
    case "action-group":
      return [...(seg.action.tags ?? []), ...seg.consequences.flatMap((c) => c.tags)];
    case "oracle":
      return [...(seg.question.foes ?? []), ...seg.consequences.flatMap((c) => c.tags)];
    case "world-event":
      return [...seg.entry.tags, ...seg.consequences.flatMap((c) => c.tags)];
    case "standalone-consequence":
      return seg.entry.tags;
    default:
      return [];
  }
}

/** `+prone` / `-prone` in a tag's changes → a condition given or lifted. */
function conditionChanges(tag: PersistentTag): Array<{ name: string; add: boolean; condition: string }> {
  const changes = tag.kind === "pc" ? tag.changes : tag.kind === "foe" ? tag.tags : [];
  return changes.flatMap((c) => {
    const m = c.match(/^([+-])\s*([A-Za-z][\w -]*)$/);
    return m && !/^HP\b/i.test(m[2]) && (tag.kind === "pc" || tag.kind === "foe")
      ? [{ name: tag.name, add: m[1] === "+", condition: m[2].trim().toLowerCase() }]
      : [];
  });
}

/** The target a card's action line names: `Mining Pick → Lilith`. */
function attackTarget(text: string): string | undefined {
  return actionTarget(text);
}

/** Read every map-bound fight out of the log. */
export function foldBattles(segments: ProseSegment[]): Battle[] {
  const battles: Battle[] = [];
  let battle: Battle | null = null;
  let round = 0;
  // Where each combatant stands now, by its key.
  const placed = new Map<string, BattlePlacement>();
  // The conditions each combatant has now, by its key.
  const conditions = new Map<string, Set<string>>();
  // Starting squares from the initiative list (`Talon 14 @C4`), by key — kept
  // from an `[Init:]` written before the fight, to place it when it opens.
  const initAt = new Map<string, BattlePlacement>();
  // And their emoji for the fight (`… @F7 🐸`), the same way — and whether
  // they've rolled.
  const initIcons = new Map<string, string>();
  const initRolled = new Set<string>();
  let fights = 0;

  /** The placed combatant a name refers to — exact, or as an actor matches. */
  const find = (name: string): string | undefined => {
    const key = combatantKey(name);
    if (placed.has(key)) return key;
    const keys = [...placed.keys()];
    const i = matchActor(
      name,
      keys.map((k) => ({ name: k }))
    );
    return i >= 0 ? keys[i] : undefined;
  };

  for (const seg of segments) {
    // The initiative list's squares: a new list replaces them, `+`/`-` amend.
    for (const tag of segmentTags(seg)) {
      if (tag.kind !== "initiative") continue;
      if (tag.op === "set") {
        initAt.clear();
        initIcons.clear();
        initRolled.clear();
      }
      for (const e of tag.entries) {
        const key = combatantKey(e.name);
        const at = e.at ? parseSquare(e.at) : null;
        if (tag.op === "remove") {
          initAt.delete(key);
          initIcons.delete(key);
          initRolled.delete(key);
          continue;
        }
        if (e.value != null) {
          initRolled.add(key);
          if (battle && !battle.rolled.includes(key)) battle.rolled.push(key);
        }
        if (e.icon) {
          initIcons.set(key, e.icon);
          if (battle) battle.icons[key] = e.icon;
        }
        if (at) {
          initAt.set(key, { name: e.name, at });
          // Squares listed mid-fight place them there and then.
          if (battle) placed.set(find(e.name) ?? key, { name: placed.get(find(e.name) ?? key)?.name ?? e.name, at });
        }
      }
    }

    if (seg.type === "combat-start") {
      round = 0;
      placed.clear();
      conditions.clear();
      // The fight opens with everyone where the initiative list put them.
      for (const [key, p] of initAt) placed.set(key, { ...p });
      battle = seg.entry.map
        ? {
            map: seg.entry.map,
            start: seg.sourceIndex,
            frames: [],
            opening: [...placed.values()].map((p) => ({ ...p })),
            icons: Object.fromEntries(initIcons),
            fight: fights,
            rolled: [...initRolled],
          }
        : null;
      fights++;
      if (battle) battles.push(battle);
      continue;
    }
    if (seg.type === "combat-end") {
      if (battle) battle.end = seg.sourceIndex;
      battle = null;
      continue;
    }
    if (!battle) continue;
    if (seg.type === "round") round = seg.round;

    // Who's acting: an action's actor, or whose turn a marker (`T(Talon)`) opens.
    const actor = seg.type === "action-group" ? seg.action.actor : seg.type === "turn" ? seg.actor : undefined;
    const moves: BattleFrame["moves"] = [];
    const place = (tags: PersistentTag[], after: boolean) => {
      for (const tag of tags) {
        if (isPos(tag)) {
          for (const e of tag.entries) {
            const at = parseSquare(e.at);
            if (!at) continue;
            const key = find(e.name) ?? combatantKey(e.name);
            placed.set(key, { name: placed.get(key)?.name ?? e.name, at });
          }
        } else if (isMove(tag)) {
          const who = tag.who ?? actor;
          if (!who) continue;
          const key = find(who);
          const squares = tag.path.map(parseSquare).filter((s): s is Square => s != null);
          if (squares.length === 0) continue;
          const from = key ? placed.get(key) : undefined;
          const name = from?.name ?? who;
          moves.push({ name, path: from ? [from.at, ...squares] : squares, ...(after ? { after: true } : {}) });
          placed.set(key ?? combatantKey(who), { name, at: squares[squares.length - 1] });
        }
      }
    };
    // The moves before the action, then the strike, then the moves after it.
    const own = seg.type === "action-group" ? (seg.action.tags ?? []) : mapTags(seg);
    const isAfter = (t: PersistentTag) => t.kind === "move" && !!t.after;
    place(
      own.filter((t) => !isAfter(t)),
      false
    );
    const target = seg.type === "action-group" ? attackTarget(seg.action.text) : undefined;
    const squareOf = (name: string) => {
      const key = find(name);
      return key ? placed.get(key)?.at : undefined;
    };
    const attacks: BattleFrame["attacks"] =
      actor && target
        ? [
            {
              from: actor,
              to: target,
              id: seg.sourceIndex,
              ...(squareOf(actor) ? { fromAt: squareOf(actor) } : {}),
              ...(squareOf(target) ? { toAt: squareOf(target) } : {}),
            },
          ]
        : [];
    if (seg.type === "action-group") place([...own.filter(isAfter), ...seg.consequences.flatMap((c) => c.tags)], true);

    for (const tag of allTags(seg)) {
      for (const ch of conditionChanges(tag)) {
        const key = find(ch.name) ?? combatantKey(ch.name);
        const now = conditions.get(key) ?? new Set<string>();
        if (ch.add) now.add(ch.condition);
        else now.delete(ch.condition);
        conditions.set(key, now);
      }
    }

    battle.frames.push({
      id: seg.sourceIndex,
      ...(seg.type === "turn" ? { slot: true } : {}),
      round,
      ...(actor ? { actor } : {}),
      placements: [...placed.values()].map((p) => ({ ...p })),
      moves,
      attacks,
      conditions: Object.fromEntries(
        [...conditions].filter(([, set]) => set.size > 0).map(([k, set]) => [k, [...set]])
      ),
    });
  }
  return battles;
}

/** The frame a log entry falls in: the last frame at or before it. */
export function frameAt(battle: Battle, id: number): BattleFrame | undefined {
  let found: BattleFrame | undefined;
  for (const f of battle.frames) {
    if (f.id > id) break;
    found = f;
  }
  return found;
}
