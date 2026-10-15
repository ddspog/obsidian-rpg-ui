/**
 * Starting a combat — the block a "Start Combat" card appends:
 *
 *   ? Combat begins with no one surprised. [F:[[Kobold, Elite]]|HP 26] [F:Fat [[Kobold, A]]|HP 9]
 *   => Movement rustled through the brush, and suddenly, we were surrounded.
 *   [Init: [[Kobold, Elite]] d20+[[Initiative]]=20; Talon d20+[[Initiative]]=14; Fat [[Kobold, A]] d20+[[Initiative]]=9]
 *   [COMBAT]
 *   T1
 *
 * Every participant — the PCs in the fight and the foes it adds — makes an
 * initiative roll (a DEX check, d20 + its Initiative modifier); the order is the
 * totals, highest first. Each foe enters with its statblock HP.
 *
 * Surprise is decided before initiative: the party, the foes, or no one. A
 * surprised creature has the Surprised condition — it can't move or take an
 * action on its first turn, nor a reaction until that turn ends — so each one is
 * given it the lonelog way, `+surprised` on its state tag (`[PC:Talon|+surprised]`,
 * `[F:[[Kobold, Elite]]|+surprised]`), on a line of its own after the narration.
 * `-surprised` lifts it once their first turn is over.
 */

/** Who is caught off guard as the fight begins. */
export type Surprise = "none" | "party" | "foes";

/** The opening line each kind of surprise suggests. */
export const SURPRISE_OPENINGS: Record<Surprise, string> = {
  none: "Combat begins with no one surprised.",
  party: "Combat begins — the party is caught off guard.",
  foes: "Combat begins — the foes are caught off guard.",
};

export interface Combatant {
  /** As written in the log: a PC's name (`Talon`) or a foe's tag text
   *  (`Fat [[Kobold, A]]`). */
  name: string;
  /** A foe the combat adds (it gets an `[F:]` tag); a PC otherwise. */
  foe?: boolean;
  /** Its Initiative modifier, when known. */
  modifier?: number;
  /** A foe's starting HP, from its statblock. */
  hp?: number;
  /** The d20 it rolled. */
  face?: number;
  /** Where it starts on the battle map (`C4`). */
  at?: string;
}

/** A combatant's initiative total: the die plus its modifier. */
export function initiativeTotal(c: Combatant): number | undefined {
  return c.face == null ? undefined : c.face + (c.modifier ?? 0);
}

/** One `[Init:]` entry: the roll with its modifier term, its total — and,
 *  on a battle map, where it starts (`@J14`). */
function initEntry(c: Combatant, onMap: boolean): string {
  const total = initiativeTotal(c);
  // A known modifier rides as `[[Initiative]]`, so the Log shows the roll it came
  // from; without one the die is the whole total.
  const roll = c.modifier != null ? "d20+[[Initiative]]=" : "d20=";
  const at = onMap && c.at?.trim() ? ` @${c.at.trim().toUpperCase()}` : "";
  return `${total == null ? c.name : `${c.name} ${roll}${total}`}${at}`;
}

export function startCombatText(opts: {
  question: string;
  narration?: string;
  combatants: Combatant[];
  surprise?: Surprise;
  /** The battle map the fight is on, as the marker names it: a note's link
   *  (`[[Kobold Ambush]]`) or a map in the log's header (`Clearing`). */
  map?: string;
}): string {
  const foes = opts.combatants.filter((c) => c.foe);
  const foeTags = foes.map((f) => ` [F:${f.name}${f.hp != null ? `|HP ${f.hp}` : ""}]`).join("");
  // Highest total first — the order the turns go in (ties keep the order listed).
  const ordered = opts.combatants
    .map((c, i) => ({ c, i }))
    .sort((a, b) => (initiativeTotal(b.c) ?? -Infinity) - (initiativeTotal(a.c) ?? -Infinity) || a.i - b.i)
    .map(({ c }) => c);
  const lines = [`? ${opts.question.trim()}${foeTags}`];
  if (opts.narration?.trim()) lines.push(`=> ${opts.narration.trim()}`);
  // The surprised side, each tagged with the condition.
  if (opts.surprise === "party" || opts.surprise === "foes") {
    const side = opts.combatants.filter((c) => (opts.surprise === "foes" ? c.foe : !c.foe));
    if (side.length > 0) {
      const tags = side.map((c) => (c.foe ? `[F:${c.name}|+surprised]` : `[PC:${c.name}|+surprised]`)).join(" ");
      lines.push(`=> ${opts.surprise === "party" ? "The party is" : "The foes are"} surprised. ${tags}`);
    }
  }
  // The order — and, on a map, everyone's starting square with their roll.
  const map = opts.map?.trim();
  if (ordered.length > 0) lines.push(`[Init: ${ordered.map((c) => initEntry(c, !!map)).join("; ")}]`);
  // The fight, on its map if it has one: a map note by its link, a map the
  // log keeps in its header by its plain name.
  lines.push(map ? `[COMBAT: ${map}]` : "[COMBAT]");
  lines.push("T1");
  return lines.join("\n");
}

/**
 * The foes a GM listed, one per line (`[[Kobold, Elite]]`, `Fat [[Kobold, A]]`),
 * with the statblock each links to.
 */
export function parseFoeList(text: string): Array<{ name: string; link?: string }> {
  return text
    .split("\n")
    .map((l) => l.trim().replace(/^[-*]\s+/, ""))
    .filter(Boolean)
    .map((name) => {
      const link = name.match(/\[\[([^\]|#]+)/)?.[1]?.trim();
      return link ? { name, link } : { name };
    });
}

/** A d20 roll. */
export const rollD20 = (): number => 1 + Math.floor(Math.random() * 20);
