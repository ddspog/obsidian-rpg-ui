/**
 * Draft an encounter from one line of prose: which bestiary creatures it
 * names, how many of each, whether the line reads like a fight, and how far to
 * trust the guess. A heuristic for a person (or a model) to review, not a
 * parser: every guess leaves a reason. No Obsidian and no I/O.
 */

import { findMentions, tokenize, type Mention, type MonsterIndex, type Token } from "./monster-index";

export interface ExtractedMonster {
  /** The bestiary note's vault path. */
  note: string;
  name: string;
  cr?: string;
  /** How many: read from the line, or guessed (see `inferred`). A dice count is its average, rounded. */
  count: number;
  /** The dice the line gave for the count, e.g. "1d4 + 1" (only when one mention gave the whole count). */
  dice?: string;
  /** The words that gave this monster, with their count words ("two bandits"); several are joined with "; ". */
  matchedText: string;
  /** True when some part of the count is a guess ("the wolves" with no number is 2). */
  inferred: boolean;
}

export type CombatLikelihood = "likely" | "possible" | "unlikely";
export type Confidence = "high" | "medium" | "low";

export interface ExtractedEncounter {
  monsters: ExtractedMonster[];
  /** "five shriekers": a count before a plural noun no bestiary name matched. */
  unresolved: string[];
  combat: CombatLikelihood;
  confidence: Confidence;
  reasons: string[];
}

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  both: 2,
  single: 1,
  lone: 1,
  trio: 3,
};

/** Words that end a noun phrase: a count word before one of these does not belong to the mention. */
const STOP_WORDS = new Set([
  "all",
  "and",
  "any",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "each",
  "every",
  "for",
  "from",
  "has",
  "have",
  "her",
  "his",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "of",
  "on",
  "onto",
  "or",
  "other",
  "than",
  "that",
  "the",
  "their",
  "them",
  "then",
  "these",
  "this",
  "those",
  "to",
  "was",
  "were",
  "when",
  "which",
  "while",
  "who",
  "with",
]);

/** Determiners that point back at a creature already named. */
const ANAPHORS = new Set(["the", "these", "those", "both", "its", "their", "his", "her", "that", "this"]);

const REINFORCEMENT = new Set(["another", "additional", "more", "extra", "further"]);

const VAGUE_MANY = new Set(["several", "numerous", "multiple", "various", "many"]);

/** A plural-looking word that is not a creature. */
const NON_CREATURE = new Set([
  "arrows",
  "attempts",
  "attacks",
  "bolts",
  "checks",
  "chests",
  "chunks",
  "coins",
  "copies",
  "creatures",
  "damage",
  "days",
  "doors",
  "eggs",
  "feet",
  "gems",
  "heads",
  "hexes",
  "hours",
  "inches",
  "items",
  "levels",
  "means",
  "miles",
  "minutes",
  "months",
  "options",
  "pieces",
  "piles",
  "pits",
  "points",
  "potions",
  "rations",
  "rings",
  "rolls",
  "rooms",
  "rounds",
  "saves",
  "scrolls",
  "seconds",
  "seems",
  "sets",
  "sides",
  "snowballs",
  "songs",
  "spaces",
  "squares",
  "stories",
  "tokens",
  "turns",
  "uses",
  "wands",
  "weapons",
  "weeks",
  "years",
  "yards",
]);

/** A noun a singular creature name can be a modifier of: "wyvern nesting ground", "hippogriff nest" (plural ones are subjects: "wyverns nest"). */
const MODIFIER_FOLLOW = new Set([
  "bones",
  "breeding",
  "carving",
  "carvings",
  "claw",
  "claws",
  "den",
  "droppings",
  "egg",
  "eggs",
  "feather",
  "feathers",
  "ground",
  "grounds",
  "hide",
  "lair",
  "nest",
  "nesting",
  "pelt",
  "skull",
  "statue",
  "statues",
  "territory",
  "tooth",
  "teeth",
]);

/** Words that are quantities but not head counts. */
const NOT_A_COUNT = new Set(["both", "single", "lone", "trio", "one"]);

/** A word before a number that makes it a rule number, not a head count. */
const NUMBER_CONTEXT = new Set([
  "dc",
  "cr",
  "level",
  "levels",
  "tier",
  "chapter",
  "entry",
  "page",
  "pages",
  "table",
  "ac",
]);

const COMBAT_PATTERNS: RegExp[] = [
  /\battack(?:s|ed|ing)?\b/,
  /\bambush(?:es|ed|ing)?\b/,
  /\bpatrol(?:s|led|ling)?\b/,
  /\bprowl(?:s|ed|ing)?\b/,
  /\bhunt(?:s|ed|ing)?\b/,
  /\bstalk(?:s|ed|ing)?\b/,
  /\bcharg(?:e|es|ed|ing)\b/,
  /\bguard(?:s|ed|ing)?\b/,
  /\braid(?:s|ed|ing|ers)?\b/,
  /\bdemand(?:s|ed|ing)?\b/,
  /\bfight(?:s|ing)?\b|\bfought\b/,
  /\bbattle(?:s|d)?\b/,
  /\bcombat\b/,
  /\blairs?\b/,
  /\banimat(?:e|es|ed|ing)\b/,
  /\bemerg(?:e|es|ed|ing)\b/,
  /\barriv(?:e|es|ed|ing)\b/,
  /\bchuck(?:s|ed|ing)?\b/,
  /\brush(?:es|ed|ing)?\b/,
  /\bdescend(?:s|ed|ing)?\b/,
  /\bswoop(?:s|ed|ing)?\b/,
  /\bpursu(?:e|es|ed|ing)\b/,
  /\bthreat(?:en|ens|ened|ening)\b/,
  /\bhostile\b/,
  /\bdevour(?:s|ed|ing)?\b/,
  /\bsurround(?:s|ed|ing)?\b/,
  /\bwaylay(?:s|ing)?\b/,
  /\bconfront(?:s|ed|ing)?\b/,
  /\bkill(?:s|ed|ing)?\b/,
  /\bdefeat(?:s|ed|ing)?\b/,
  /\bweapons?\b/,
  /\bstrik(?:e|es|ing)\b/,
  /\bslay(?:s|ing)?\b/,
  /\bassault(?:s|ed|ing)?\b/,
  /\bgrowl(?:s|ed|ing)?\b|\bsnarl(?:s|ed|ing)?\b/,
  /\baccus(?:e|es|ed|ing)\b/,
  /\bturns? (?:its|their|his|her) attention\b/,
];

/** Signs the line only shows what a creature left behind. */
const TRACE_PATTERNS: RegExp[] = [
  /\b(?:foot|paw|hoof|claw)?prints?\b/,
  /\btracks\b(?!\s+(?:the|them|their|a|an|pcs?|and|but)\b)/,
  /\bpassed (?:through|by)\b|\bhas passed\b|\bhad passed\b/,
  /\bidentifies\b.{0,60}\bas\b/,
  /\breveals\b.{0,30}\b(?:creature|as)\b/,
  /(?:\u2019s|'s|\ba|\bthe|\bits) shadow\b/,
  /\b(?:evidence|signs?|traces?|remains) of\b/,
  /\bcarcass(?:es)?\b|\bdroppings\b/,
];

/** Weaker hints of a scene with no living creature in it; they only count when no combat word does. */
const STILL_PATTERNS: RegExp[] = [
  /\bcorpses?\b/,
  /\bbodies\b/,
  /\bfrozen\b/,
  /\babandoned\b/,
  /\bdead\b/,
  /\bwreck(?:age)?\b/,
];

/** Words before a creature that make it the quarry of the real encounter: "stalking a wounded seal". */
const PREY_LEAD =
  /\b(?:stalking|stalks|hunting|hunts|chasing|chases|devouring|devours|eating|eats|feasting on|feasts on|feeding on|feeds on|alternative to|instead of|rather than|resembles?|resembling|looks? like|looking like|shaped like|disguised as|in the shape of)\s+(?:(?:an?|the|some|its|their|his|her)\s+)?(?:[\p{L}\u2019'-]+\s+){0,2}$/iu;

/** Between two prey in a list: "moose and deer". */
const LIST_GAP = /^\s*(?:,|,?\s*(?:and|or))?\s*$/i;

/** "a creature's shadow": the Shadow of the bestiary is not in the scene. */
const SHADOW_OF_SOMETHING = /(?:(?:\u2019s|'s|\ba|\bthe|\bits) shadow\b|\bshadow(?:\u2019s|'s)\b)/gi;

const GAP = /^[\s\-\u2013]*$/;

/** Prose out of a table cell: wikilinks to their text, emphasis and tags dropped. */
function plainText(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, "$2")
    .replace(/\[\[([^\]]*)\]\]/g, "$1")
    .replace(/[*`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

interface CountRead {
  count: number;
  dice?: string;
  /** The count was stated, not guessed. */
  explicit: boolean;
  /** Index of the first token of the count phrase. */
  from: number;
  reinforcement?: boolean;
  note?: string;
}

function diceAverage(dice: string): number {
  const m = dice.match(/^(\d+)d(\d+)(?: ([+-]) (\d+))?$/);
  if (!m) return 0;
  const base = (parseInt(m[1], 10) * (parseInt(m[2], 10) + 1)) / 2;
  const flat = m[3] ? (m[3] === "+" ? 1 : -1) * parseInt(m[4], 10) : 0;
  return Math.max(1, Math.round(base + flat));
}

function numberOf(token: Token | undefined): number | null {
  if (!token || token.kind !== "word") return null;
  if (/^\d+$/.test(token.norm)) return parseInt(token.norm, 10);
  return NUMBER_WORDS[token.norm] ?? null;
}

function joined(text: string, a: Token, b: Token): boolean {
  return GAP.test(text.slice(a.end, b.start));
}

/**
 * The count the words before a mention give it: "two bandits", "a bandit
 * captain", "1d4 + 1 grimlocks", "a pack of four winter wolves", "a pair of
 * ogres", "a healthy frost giant". `null` when there is none.
 */
function readCount(text: string, tokens: Token[], k: number, plural: boolean, covered: Set<number>): CountRead | null {
  let mods = 0;
  for (let i = k - 1; i >= 0; i--) {
    const tok = tokens[i];
    if (covered.has(i) || !joined(text, tok, tokens[i + 1])) return null;
    const reinforcement = (from: number) => from > 0 && REINFORCEMENT.has(tokens[from - 1].norm);

    if (tok.kind === "dice") {
      return { count: diceAverage(tok.norm), dice: tok.norm, explicit: true, from: i, reinforcement: reinforcement(i) };
    }
    const n = numberOf(tok);
    if (n !== null) {
      return { count: n, explicit: true, from: i, reinforcement: reinforcement(i) };
    }
    if (tok.norm === "a" || tok.norm === "an") {
      // "a ... wolves" says nothing about how many.
      return plural ? null : { count: 1, explicit: true, from: i };
    }
    if (VAGUE_MANY.has(tok.norm)) {
      return { count: 3, explicit: false, from: i, note: `"${tok.raw}" read as 3` };
    }
    if (tok.norm === "of" && i > 0) {
      const head = tokens[i - 1].norm;
      if (!joined(text, tokens[i - 1], tok)) return null;
      if (head === "pair") return { count: 2, explicit: true, from: i - 1 };
      if (head === "couple") return { count: 2, explicit: false, from: i - 1, note: `"couple" read as 2` };
      if (head === "dozen") {
        const times = i > 1 ? numberOf(tokens[i - 2]) : null;
        return { count: 12 * (times ?? 1), explicit: true, from: times !== null ? i - 2 : i - 1 };
      }
      // "a pack of winter wolves" (a band, a team, a troop): the group is one, its members have no number.
      return null;
    }
    if (tok.norm === "dozen") {
      const times = i > 0 ? numberOf(tokens[i - 1]) : null;
      return { count: 12 * (times ?? 1), explicit: true, from: times !== null ? i - 1 : i };
    }
    if (STOP_WORDS.has(tok.norm)) return null;
    mods++;
    if (mods > 2) return null;
  }
  return null;
}

/** "10 of them animate as ghouls": a count that comes before the pronoun, not the noun. */
function readOfThem(text: string, tokens: Token[], k: number): CountRead | null {
  const link = tokens[k - 1]?.norm;
  if (!link || !["as", "into", "become", "becoming", "are", "turn"].includes(link)) return null;
  for (let i = k - 2; i >= 0 && i >= k - 9; i--) {
    if (/[.!?;]/.test(text.slice(tokens[i].end, tokens[i + 1].start))) return null;
    const n = numberOf(tokens[i]);
    if (n !== null && tokens[i + 1]?.norm === "of" && ["them", "these", "those"].includes(tokens[i + 2]?.norm ?? "")) {
      return {
        count: n,
        explicit: true,
        from: i,
        note: `"${tokens[i].raw} of ${tokens[i + 2].raw}" read as the count`,
      };
    }
  }
  return null;
}

/** True when the offset sits inside an open parenthesis: a cross-reference, not a creature in the scene. */
function inParenthesis(text: string, offset: number): boolean {
  const before = text.slice(0, offset);
  return before.lastIndexOf("(") > before.lastIndexOf(")");
}

interface Found {
  mention: Mention;
  count: CountRead | null;
  /** The count came from the words, with no number to read. */
  guess: number;
  phrase: string;
  anaphoric: boolean;
  prey: boolean;
  /** Sentence number of the mention. */
  sentence: number;
  /** Followed by a noun it modifies ("wyvern nesting ground"). */
  modifier: boolean;
}

function looksPlural(word: string): boolean {
  if (NON_CREATURE.has(word) || word.length < 4) return false;
  return /(?:[^s]s|ies|ves|men)$/.test(word) && !/(?:us|is|ss)$/.test(word);
}

/** Counts that precede a plural noun no bestiary name matched. */
function findUnresolved(text: string, tokens: Token[], covered: Set<number>): string[] {
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const n = numberOf(tokens[i]);
    if (n === null || covered.has(i) || NOT_A_COUNT.has(tokens[i].norm)) continue;
    if (i > 0 && NUMBER_CONTEXT.has(tokens[i - 1].norm)) continue;
    for (let j = i + 1; j < tokens.length && j <= i + 3; j++) {
      if (!joined(text, tokens[j - 1], tokens[j]) || covered.has(j) || tokens[j].kind !== "word") break;
      const word = tokens[j].norm;
      if (STOP_WORDS.has(word) || NON_CREATURE.has(word) || numberOf(tokens[j]) !== null) break;
      if (looksPlural(word)) {
        out.push(text.slice(tokens[i].start, tokens[j].end));
        break;
      }
    }
  }
  return out;
}

function countMatches(patterns: RegExp[], lower: string): number {
  return patterns.filter((p) => p.test(lower)).length;
}

/** What the line says about a fight, from the words around the creatures. */
function judgeCombat(lower: string, hasMonsters: boolean, reasons: string[]): CombatLikelihood {
  const combat = countMatches(COMBAT_PATTERNS, lower);
  const traces = countMatches(TRACE_PATTERNS, lower);
  const still = countMatches(STILL_PATTERNS, lower);
  if (traces >= 1 && combat <= 1) {
    reasons.push("reads as signs of a creature (tracks, shadow, remains), not a meeting");
    return "unlikely";
  }
  if (traces >= 1) {
    reasons.push("signs of a creature, but also fighting words");
    return "possible";
  }
  if (combat >= 1) return "likely";
  if (still >= 1) {
    reasons.push("a still scene (corpses, something abandoned) with no fighting words");
    return "unlikely";
  }
  if (hasMonsters) {
    reasons.push("creatures named, but no fighting words");
    return "possible";
  }
  return "unlikely";
}

/** The count of each creature the line names, whether it reads like a fight, and how far to trust it. */
export function extractEncounter(rawText: string, index: MonsterIndex): ExtractedEncounter {
  const text = plainText(rawText);
  const lower = text.toLowerCase();
  const reasons: string[] = [];
  const tokens = tokenize(text);
  const mentions = findMentions(index, text);

  // Tokens inside a mention belong to it, and no count phrase may reach into one.
  const covered = new Set<number>();
  const firstToken: number[] = mentions.map((m) => tokens.findIndex((t) => t.start === m.start));
  for (const m of mentions) {
    tokens.forEach((t, ti) => {
      if (t.start >= m.start && t.end <= m.end) covered.add(ti);
    });
  }

  const found: Found[] = [];
  mentions.forEach((mention, mi) => {
    const k = firstToken[mi];
    let count = k > 0 ? readCount(text, tokens, k, mention.plural, covered) : null;
    if (!count && k > 0) count = readOfThem(text, tokens, k);
    const phraseStart = count ? tokens[count.from].start : mention.start;
    const before = k > 0 ? tokens[k - 1].norm : "";
    const previous = found[found.length - 1];
    const prey =
      PREY_LEAD.test(text.slice(0, phraseStart)) ||
      (!!previous?.prey && LIST_GAP.test(text.slice(previous.mention.end, phraseStart)));
    const last = tokens.findIndex((t) => t.end === mention.end);
    const next = last >= 0 ? tokens[last + 1] : undefined;
    found.push({
      prey,
      sentence: (text.slice(0, mention.start).match(/[.!?]\s/g) ?? []).length,
      modifier: !mention.plural && !!next && MODIFIER_FOLLOW.has(next.norm) && joined(text, tokens[last], next),
      mention,
      count,
      guess: mention.plural ? 2 : 1,
      phrase: text.slice(phraseStart, mention.end),
      anaphoric: !count && ANAPHORS.has(before),
    });
  });

  const shadows = [...text.matchAll(SHADOW_OF_SOMETHING)].map((m): [number, number] => {
    const at = (m.index ?? 0) + m[0].toLowerCase().indexOf("shadow");
    return [at, at + "shadow".length];
  });
  const kept: Found[] = [];
  for (const f of found) {
    const { mention } = f;
    if (f.modifier) {
      reasons.push(`"${mention.text}" modifies the noun after it (a nest, a lair): not counted`);
      continue;
    }
    if (f.prey) {
      reasons.push(`"${f.phrase}" looks like prey or a comparison, not part of the encounter`);
      continue;
    }
    if (
      shadows.some((r) => mention.start < r[1] && mention.end > r[0]) &&
      /^shadow(?:[\u2019']s)?$/i.test(mention.text)
    ) {
      reasons.push(`"${mention.text}" is a shadow cast by something, not the creature`);
      continue;
    }
    if (!f.count && inParenthesis(text, mention.start)) {
      reasons.push(`"${mention.text}" is in a parenthesis with no number: a cross-reference, not counted`);
      continue;
    }
    if (f.anaphoric) {
      const earlier = kept.find((e) => e.mention.note === mention.note || e.mention.head === mention.head);
      if (earlier) {
        reasons.push(`"${f.phrase}" read as the "${earlier.mention.text}" already named`);
        continue;
      }
    }
    kept.push(f);
  }

  // One monster per note; sum the mentions of the same note.
  const order: string[] = [];
  const byNote = new Map<string, Found[]>();
  for (const f of kept) {
    if (!byNote.has(f.mention.note)) {
      byNote.set(f.mention.note, []);
      order.push(f.mention.note);
    }
    byNote.get(f.mention.note)?.push(f);
  }

  const monsters: ExtractedMonster[] = [];
  for (const note of order) {
    let group = byNote.get(note) ?? [];
    const firm = group.filter((f) => !f.count?.reinforcement);
    if (firm.length > 0 && firm.length < group.length) {
      const extra = group.filter((f) => f.count?.reinforcement).map((f) => `"${f.phrase}"`);
      reasons.push(`reinforcements not counted: ${extra.join(", ")}`);
      group = firm;
    }
    // A later sentence with a number of its own ("...the next night, eight werewolves attack") is a follow-up, not more of the first group.
    const lead = group[0];
    if (lead.count?.explicit) {
      const later = group.filter((f) => f !== lead && f.sentence > lead.sentence && f.count?.explicit);
      if (later.length > 0) {
        reasons.push(`later numbers for the same creature not added: ${later.map((f) => `"${f.phrase}"`).join(", ")}`);
        group = group.filter((f) => !later.includes(f));
      }
    }
    let total = 0;
    let inferred = false;
    for (const f of group) {
      if (f.count) {
        total += f.count.count;
        if (!f.count.explicit) inferred = true;
        if (f.count.note) reasons.push(f.count.note);
      } else {
        total += f.guess;
        inferred = true;
        reasons.push(
          f.mention.plural
            ? `"${f.mention.text}" is plural with no number: counted as 2`
            : `"${f.mention.text}" has no count: counted as 1`
        );
      }
    }
    const first = group[0].mention;
    if (group.length > 1) {
      reasons.push(`${group.length} mentions of ${first.name} summed to ${total}`);
    }
    const dice = group.length === 1 ? group[0].count?.dice : undefined;
    monsters.push({
      note,
      name: first.name,
      ...(first.cr !== undefined ? { cr: first.cr } : {}),
      count: total,
      ...(dice ? { dice } : {}),
      matchedText: group.map((f) => f.phrase).join("; "),
      inferred,
    });
  }

  // A count word before a plural noun nothing matched: the model should look at it.
  const unresolved = [...new Set(findUnresolved(text, tokens, covered))];
  if (unresolved.length > 0) reasons.push(`counts before names not in the bestiary: ${unresolved.join(", ")}`);

  const combat = judgeCombat(lower, monsters.length > 0, reasons);

  let confidence: Confidence;
  if (monsters.length === 0) {
    confidence = "low";
    reasons.push("no bestiary creature named");
  } else if (combat === "unlikely") {
    confidence = "low";
  } else if (combat === "likely" && unresolved.length === 0 && monsters.every((m) => !m.inferred)) {
    confidence = "high";
  } else {
    confidence = "medium";
  }

  return { monsters, unresolved, combat, confidence, reasons };
}
