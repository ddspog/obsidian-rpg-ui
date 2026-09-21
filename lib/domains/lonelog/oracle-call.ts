/**
 * The `o:` line — an oracle consulted for the question above it.
 *
 *   ? [CF:5] Is the gate still guarded?
 *   o: Fate Chart (likely) d100=22 -> Yes
 *
 * The sibling `tbl:` and `gen:` always had and the oracle lacked: name the source,
 * say how it was rolled, show what came back. A BARE NAME, because that is what a
 * log line uses to name a feature — `@[[…]]` belongs in the YAML that declares one.
 *
 * The question stays prose on its `?` line. This line is the machinery, so the odds
 * live here with the source they qualify, and the result is derived rather than
 * typed.
 */

import type { GMLikelihood } from "lib/domains/features/types";

/** A die anywhere in the line: `d100`, `d100=22`, `2d10=[1,2]`. */
const ROLL_RE = /\d*d\d+[^\s]*/i;

/**
 * The odds a question was asked at, however they were spelled.
 *
 * The Fate Chart prints "Nearly Certain" and the type is `near-certain`, so a log
 * written from the book still resolves. Spaces, hyphens and case are all one thing.
 */
export function parseLikelihood(text: string): GMLikelihood | null {
  const t = text.trim().toLowerCase().replace(/\s+/g, "-");
  const direct: GMLikelihood[] = [
    "certain",
    "near-certain",
    "very-likely",
    "likely",
    "50/50",
    "unlikely",
    "very-unlikely",
    "near-impossible",
    "impossible",
  ];
  if ((direct as string[]).includes(t)) return t as GMLikelihood;
  // The wording on the chart itself, and the obvious shorthands.
  const aliases: Record<string, GMLikelihood> = {
    "nearly-certain": "near-certain",
    "nearly-impossible": "near-impossible",
    "50-50": "50/50",
    "50/50": "50/50",
    even: "50/50",
    "coin-flip": "50/50",
    sure: "certain",
  };
  return aliases[t] ?? null;
}

/**
 * Parse an `o:` line's content: `Fate Chart (likely) d100=22 -> Yes`.
 *
 * The source may hold spaces ("Fate Chart"), so it is everything up to the odds or
 * the die rather than the first whitespace-delimited word — splitting on whitespace
 * is what leaves `tbl: Wilderness Encounters d100=63` with a source of
 * "Wilderness".
 */
export function parseOracleCallLine(content: string): OracleCallLine {
  const arrow = content.indexOf("->");
  const head = (arrow >= 0 ? content.slice(0, arrow) : content).trim();
  const result = arrow >= 0 ? content.slice(arrow + 2).trim() : undefined;

  const odds = head.match(/\(([^)]*)\)/);
  const beforeOdds = odds ? head.slice(0, odds.index).trim() : head;
  const afterOdds = odds ? head.slice(odds.index! + odds[0].length).trim() : "";

  // With odds, the die follows them; without, it follows the name.
  const rollIn = odds ? afterOdds : beforeOdds;
  const rollMatch = rollIn.match(ROLL_RE);
  const roll = rollMatch ? rollMatch[0] : undefined;
  const source = (odds ? beforeOdds : rollMatch ? rollIn.slice(0, rollMatch.index).trim() : rollIn).trim();

  const line: OracleCallLine = { source };
  if (odds && odds[1].trim()) {
    line.oddsText = odds[1].trim();
    const likelihood = parseLikelihood(odds[1]);
    if (likelihood) line.likelihood = likelihood;
  }
  if (roll) line.roll = roll;
  if (result) line.result = result;
  return line;
}

/** What an `o:` line says, before anything resolves it. */
export interface OracleCallLine {
  source: string;
  oddsText?: string;
  likelihood?: GMLikelihood;
  roll?: string;
  result?: string;
}
