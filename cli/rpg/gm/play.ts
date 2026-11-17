/**
 * A GM Screen card played without a hand on it: its slots filled from what the
 * caller gives, its dice rolled here (never by the caller), its dropdowns
 * picked, and the lines read as the log reads them (a Fate Question answered
 * against the Chaos Factor the log stands at, a table roll looked up).
 */

import { rollTemplate } from "lib/domains/draft/draft";
import { genNameAbove, resolveGmBody, scopedStepLines } from "lib/domains/gm/example";
import { applyChoicePick, NESTED_SEP } from "lib/domains/session-log/choice";
import { parseLogTemplate, resolveLogTemplate } from "lib/domains/session-log/template-resolver";
import type { Screen, ScreenCard } from "./screen";

export interface Slot {
  name: string;
  options?: string[];
  optional: boolean;
  /** Its options hang on another slot's pick. */
  dependsOn?: string;
  optionsBy?: Record<string, string[]>;
}

export interface Waiting {
  /** The line holding the dropdown. */
  line: string;
  options: string[];
}

export interface Played {
  card: string;
  lines: string[];
  /** Dropdowns still unpicked: play again with `--pick` to go on. */
  waiting: Waiting[];
  /** What the card leaves to be said once its rolls are read: lines to write by hand. */
  conclusions: string[];
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** A card by name: exact, else the only one whose name holds every word. */
export function findCard(screen: Screen, name: string): ScreenCard {
  const want = norm(name);
  const exact = screen.cards.filter((c) => norm(c.name) === want);
  if (exact.length >= 1) return exact[0];
  const words = want.split(" ");
  const near = screen.cards.filter((c) => words.every((w) => norm(c.name).includes(w)));
  if (near.length === 1) return near[0];
  if (near.length > 1) throw new Error(`"${name}" is several cards: ${near.map((c) => c.name).join(", ")}.`);
  throw new Error(`No card "${name}" on the GM Screen. See them with: rpg gm cards <session>`);
}

/** A list's real options: its `## Group` headings are not picks. */
const picks = (options: string[] | undefined) => options?.filter((o) => !o.startsWith("##"));

export function slotsOf(card: ScreenCard): Slot[] {
  return parseLogTemplate(card.template).map((p) => ({
    name: p.kind,
    ...(picks(p.options)?.length ? { options: picks(p.options) } : {}),
    optional: !!p.optional || !!p.suggested || !!p.dependsOn,
    ...(p.dependsOn ? { dependsOn: p.dependsOn, optionsBy: p.optionsBy } : {}),
  }));
}

/** One of `options` by what was typed: exact, else the only one starting with it or holding it. */
function oneOf(options: string[], typed: string, what: string): string {
  const t = norm(typed);
  const exact = options.find((o) => norm(o) === t);
  if (exact) return exact;
  const starts = options.filter((o) => norm(o).startsWith(t));
  if (starts.length === 1) return starts[0];
  const holds = options.filter((o) => norm(o).includes(t));
  if (holds.length === 1) return holds[0];
  throw new Error(`${what}: "${typed}" is not one of ${options.join(" | ")}`);
}

const CHOICE = /\[([^\][]+?)\s+-\s+([^\][]*?)\]/;
const optionsIn = (line: string) =>
  (line.match(CHOICE)?.[1] ?? "")
    .split("/")
    .map((s) => s.trim())
    .filter((o) => o && !o.startsWith("##"));

const join = (body: string, text: string) =>
  [body.replace(/\s+$/, ""), text.replace(/^\n+/, "").replace(/\s+$/, "")].filter(Boolean).join("\n");

/**
 * A card whose slots picked a dropdown's option arrives with it selected (`[a/b - a]`): that
 * option's lines are spawned, as the log block does when the card is appended.
 */
function spawnPicked(screen: Screen, text: string): string {
  const stepLines = scopedStepLines(screen.features, text.match(/^gen:\s*(.+)$/m)?.[1]?.trim(), screen.ctx);
  const found = [...text.matchAll(/^(\s*\+?\s*[^\n:]+:\s*)?\[[^\][]+?\s+-\s+([^\][]*?)\]/gm)];
  const kindLine = found.length > 1 && /^\s*\+/.test(found[1][0]) ? found[1] : undefined;
  if (kindLine) {
    const kind = kindLine[2]?.trim();
    if (kind && stepLines[`${found[0][2]?.trim()}${NESTED_SEP}${kind}`] != null)
      return applyChoicePick(text, kind, stepLines, { source: kindLine[0].trim(), nth: 0 });
    return text;
  }
  const picked = found[0]?.[2]?.trim();
  return picked && stepLines[picked] ? applyChoicePick(text, picked, stepLines) : text;
}

/**
 * Play `card` after `before` (the log so far: where the Chaos Factor and the
 * lists are read from). Returns only the card's own lines.
 */
export function playCard(
  screen: Screen,
  card: ScreenCard,
  before: string,
  values: Record<string, string>,
  pickList: string[],
  rng: () => number = Math.random
): Played {
  if (card.kind) throw new Error(`"${card.name}" is a fight card: it is played from the log block in Obsidian.`);
  const slots = slotsOf(card);
  const given: Record<string, string> = {};
  for (const [k, v] of Object.entries(values)) {
    const slot = slots.find((s) => norm(s.name) === norm(k));
    if (!slot)
      throw new Error(
        `"${card.name}" has no slot "${k}". Its slots: ${slots.map((s) => s.name).join(", ") || "none"}.`
      );
    const options = slot.dependsOn ? slot.optionsBy?.[given[slot.dependsOn] ?? ""] : slot.options;
    given[slot.name] = options?.length ? oneOf(options, v, slot.name) : v;
  }
  // A card may end in what the rolls come to (`! {{event}}`, `=> … is named {{result?}}`): that
  // cannot be said before the dice are read, so such a line is held back and handed to the caller.
  const tplLines = card.template.split("\n");
  const rollsAbove = (i: number) => tplLines.slice(0, i).some((l) => /\bd\d+=|\[[^\][]+\s-\s[^\][]*\]/.test(l));
  const conclusions: string[] = [];
  const kept = tplLines.filter((line, i) => {
    if (!/^\s*(=>|!)/.test(line) || !rollsAbove(i)) return true;
    const open = [...line.matchAll(/\{\{(\w+)[?~]?(?:@\w+)?(?::[^{}]*)?\}\}/g)].filter((m) => {
      const slot = slots.find((sl) => sl.name === m[1]);
      return slot && !slot.options && !slot.dependsOn && !given[slot.name]?.trim();
    });
    if (open.length === 0) return true;
    conclusions.push(
      line
        .trim()
        .replace(
          /\{\{(\w+)[?~]?(?:@\w+)?(?::[^{}]*)?\}\}/g,
          (all, k: string) => given[k] ?? `<${k.replace(/_/g, " ")}>`
        )
    );
    return false;
  });
  const template = kept.join("\n");
  const asked = new Set(parseLogTemplate(template).map((p) => p.kind as string));
  const missing = slots.filter((sl) => asked.has(sl.name) && !sl.optional && !given[sl.name]?.trim());
  if (missing.length)
    throw new Error(
      `"${card.name}" needs ${missing
        .map((sl) => `--set ${sl.name}=${sl.options ? `<${sl.options.join("|")}>` : "…"}`)
        .join(" ")}`
    );

  const base = before.replace(/\s+$/, "");
  const baseLines = base ? base.split("\n").length : 0;
  const resolve = (own: string) => {
    const whole = resolveGmBody(join(base, own), screen.features, screen.ctx);
    return whole.split("\n").slice(baseLines).join("\n");
  };
  let own = resolve(rollTemplate(spawnPicked(screen, resolveLogTemplate(template, given)), rng));

  // Dropdowns, top to bottom: each pick spawns its lines, which are rolled and read in turn.
  const queue = [...pickList];
  for (let guard = 0; guard < 40; guard++) {
    const lines = own.split("\n");
    const at = lines.findIndex((l) => CHOICE.test(l) && !l.match(CHOICE)![2].trim());
    if (at < 0 || queue.length === 0) break;
    const line = lines[at];
    const selected = oneOf(optionsIn(line), queue.shift()!, line.trim().split(":")[0]);
    const nthIn = (text: string, upTo: number) =>
      text
        .split("\n")
        .slice(0, upTo)
        .filter((l) => l.trim() === line.trim()).length;
    const whole = join(base, own);
    const where = { source: line, nth: nthIn(whole, baseLines + at) };
    const stepLines = scopedStepLines(screen.features, genNameAbove(whole, where), screen.ctx);
    const picked = applyChoicePick(whole, selected, stepLines, where);
    own = resolve(rollTemplate(picked.split("\n").slice(baseLines).join("\n"), rng));
  }
  if (queue.length) throw new Error(`Nothing left to pick for: ${queue.join(", ")}`);
  const lines = own.split("\n");
  const waiting = lines
    .filter((l) => CHOICE.test(l) && !l.match(CHOICE)![2].trim())
    .map((l) => ({ line: l.trim(), options: optionsIn(l) }));
  return { card: card.name, lines, waiting, conclusions };
}

/** Dice rolled here: `2d6+3`, `d20+5 vs 14`, `2d20kh1+6`. A `d:` line the log reads. */
export function rollDice(expr: string, label: string | undefined, rng: () => number = Math.random): string {
  const m = expr
    .replace(/\s+/g, " ")
    .trim()
    .match(/^(.+?)(?:\s+vs\s+(.+))?$/i);
  if (!m) throw new Error(`Not a roll: ${expr}`);
  const formula = m[1].replace(/\s+/g, "");
  if (!/^[\dd+\-khl*]+$/i.test(formula) || !/\d*d\d+/i.test(formula)) throw new Error(`Not a roll: ${expr}`);
  let total = 0;
  const shown: string[] = [];
  for (const term of formula.match(/[+-]?[^+-]+/g) ?? []) {
    const sign = term.startsWith("-") ? -1 : 1;
    const t = term.replace(/^[+-]/, "");
    const d = t.match(/^(\d*)d(\d+)(?:k([hl])(\d+))?$/i);
    if (!d) {
      if (!/^\d+$/.test(t)) throw new Error(`Not a roll: ${expr}`);
      total += sign * parseInt(t, 10);
      continue;
    }
    const n = Math.max(1, parseInt(d[1] || "1", 10));
    const faces = Array.from({ length: n }, () => 1 + Math.floor(rng() * parseInt(d[2], 10)));
    let kept = faces;
    if (d[3]) {
      const sorted = [...faces].sort((a, b) => (d[3].toLowerCase() === "h" ? b - a : a - b));
      kept = sorted.slice(0, parseInt(d[4], 10));
    }
    total += sign * kept.reduce((a, b) => a + b, 0);
    if (n > 1) shown.push(`${t}: ${faces.join(",")}`);
  }
  const versus = m[2]
    ? ` vs ${m[2]} -> ${total >= parseInt(m[2].replace(/\D+/g, ""), 10) ? "Success" : "Failure"}`
    : "";
  const dice = shown.length ? ` (${shown.join("; ")})` : "";
  return `d: ${label ? `${label} | ` : ""}${formula}=${total}${versus}${dice}`;
}
