/**
 * Draft an encounter from one line of prose: which bestiary creatures it
 * names, how many of each, whether the line reads like a fight, and how far to
 * trust the guess. A heuristic for a person (or a model) to review, not a
 * parser: every guess leaves a reason. No Obsidian and no I/O.
 */

import { findMentions, pluralsOf, tokenize, type Mention, type MonsterIndex, type Token } from "./monster-index";

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
  /** The template the text puts on it, as written: "void" for "giant frog with the void template". */
  template?: string;
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
  "barges",
  "barrels",
  "boats",
  "bolts",
  "cannons",
  "carts",
  "checks",
  "chests",
  "chunks",
  "coins",
  "copies",
  "crates",
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
  "ships",
  "sides",
  "snowballs",
  "songs",
  "spaces",
  "squares",
  "stories",
  "tokens",
  "torches",
  "trees",
  "turns",
  "uses",
  "wagons",
  "wands",
  "weapons",
  "weeks",
  "years",
  "yards",
]);

/** A noun a singular creature name can be a modifier of: "wyvern nesting ground", "gnoll hunting party", "in wolf form", "wolf-shaped" (plural ones are subjects: "wyverns nest"). */
const MODIFIER_FOLLOW = new Set([
  "army",
  "band",
  "bones",
  "breeding",
  "camp",
  "caravan",
  "cart",
  "carving",
  "carvings",
  "clan",
  "claw",
  "claws",
  "crew",
  "cult",
  "den",
  "droppings",
  "egg",
  "eggs",
  "feather",
  "feathers",
  "fleet",
  "form",
  "forms",
  "gang",
  "goods",
  "ground",
  "grounds",
  "guise",
  "headed",
  "horde",
  "hunting",
  "lair",
  "legion",
  "like",
  "nest",
  "nesting",
  "pack",
  "party",
  "patrol",
  "pelt",
  "raiding",
  "shape",
  "shaped",
  "ship",
  "sized",
  "skull",
  "squad",
  "statue",
  "statues",
  "teeth",
  "template",
  "territory",
  "tooth",
  "tribe",
  "troop",
  "vessel",
  "village",
  "wagon",
  "war",
  "warband",
  "wares",
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
  /\bdefend(?:s|ed|ing)?\b/,
  /\baggressive(?:ly)?\b/,
  /\bastray\b|\blur(?:e|es|ed|ing)\b/,
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

/** Verbs and phrases before a creature that make it the quarry, the sought or a likeness, not a foe of the scene. */
const PREY_WORDS = [
  "stalking",
  "stalks",
  "stalk",
  "hunting",
  "hunts",
  "hunt",
  "chasing",
  "chases",
  "chase",
  "devouring",
  "devours",
  "eating",
  "eats",
  "feasting on",
  "feasts on",
  "feeding on",
  "feeds on",
  "threatens",
  "threatening",
  "searching for",
  "searches for",
  "search for",
  "looking for",
  "looks for",
  "seeking",
  "seeks",
  "in search of",
  "have seen",
  "has seen",
  "rescue",
  "rescuing",
  "save",
  "saving",
  "capture",
  "captured",
  "capturing",
  "snags",
  "snatches",
  "slaughter",
  "slaughtering",
  "butchering",
  "butcher",
  "alternative to",
  "instead of",
  "rather than",
  "resembles?",
  "resembling",
  "looks? like",
  "looking like",
  "shaped like",
  "disguised as",
  "in the shape of",
  "in the form of",
  "takes the form of",
  "guise of",
].join("|");

/** "hunting party", "hunting expedition": the verb is an adjective there. */
const NOT_A_VERB = "party|parties|pack|packs|group|groups|band|bands|trip|expedition|grounds?";

/** Words before a creature that make it the quarry of the real encounter: "stalking a wounded seal", "in search of a spy". */
const PREY_LEAD = new RegExp(
  `\\b(?:${PREY_WORDS})(?!\\s+(?:${NOT_A_VERB})\\b)\\s+(?:(?:an?|the|some|its|their|his|her)\\s+)?(?:[\\p{L}\\u2019'-]+\\s+){0,2}$`,
  "iu"
);

/** Words after a creature that make it the quarry: "a mammoth being pursued by", "a deer gallops past, fleeing from". */
const PREY_FOLLOW =
  /^[^.;!?]{0,60}?\b(?:(?:is|are) being |being )?(?:pursued|chased|hunted|stalked|attacked|threatened) by\b|^[^.;!?]{0,40}?\bfle(?:eing|es) from\b/i;

/** Words before a creature that put it out of the scene: "the corpse of a young dragon", "occupied by a powerful mage". */
const ABSENT_LEAD =
  /(?:\b(?:corpses?|carcass(?:es)?|bod(?:y|ies)|remains|skeletons?|statues?|bones|skull|carvings?|image|figure) of\s+(?:(?:an?|the|some|its|their)\s+)?(?:[\p{L}’'-]+\s+){0,2}|\b(?:previously|formerly|once)\s+(?:[\p{L}’'-]+\s+){0,3}by\s+(?:an?|the)\s+(?:[\p{L}’'-]+\s+){0,2})$/iu;

/** Words after a creature that put it out of the scene: "the druid who summoned them died", "the goat they have killed". */
const ABSENT_FOLLOW =
  /^\s*,?\s*(?:who|that|which)\b[^.]{0,80}?\b(?:died|is dead|was (?:slain|killed)|perished)\b|^\s*(?:they|it|he|she) (?:have|has|had) (?:killed|slain)\b/i;

/** A dead one in the words of the count: "a dying mule", "dead rats". */
const DEAD_WORDS = /\b(?:dead|dying|slain|deceased|lifeless)\b/i;

/** Bestiary names that are everyday words: a mention counts only with a number ("three shadows"), not "in the shadows", "city guards", "spies the PCs". */
const COMMON_WORD_NAMES = new Set(["shadow", "guard", "scout", "spy", "scavenger", "peer", "unearthed"]);

/** A creature of another book right after a name: "… antipaladin [ToB1]", "ghost knights [ToB1]", "[CC]", "[BoET]". */
const OTHER_BOOK = /^(?:[\s-]+[\p{L}\u2019'-]+){0,3}\s*\[(?:ToB|TOB|CC|BoET|ToH|CoS)\d*\]/u;

/** A rank after a creature: "a frost giant chieftain" is a frost giant, maybe a stronger one. */
const RANK_FOLLOW = new Set([
  "chieftain",
  "chief",
  "leader",
  "king",
  "queen",
  "lord",
  "lady",
  "shaman",
  "priest",
  "priestess",
  "conjurer",
  "matriarch",
  "patriarch",
  "elder",
  "ruler",
  "boss",
  "warlord",
  "sorcerer",
  "queen",
  "templar",
]);

/** Determiners: a creature with none and no number before it ("to guard", "have unearthed") is a word, not a creature. */
const DETERMINERS = new Set([
  "a",
  "an",
  "the",
  "these",
  "those",
  "its",
  "their",
  "his",
  "her",
  "our",
  "your",
  "that",
  "this",
  "each",
  "every",
  "another",
  "any",
  "some",
  "no",
]);

const POSSESSIVES = new Set(["its", "their", "his", "her", "our", "your"]);

/** "They are vampire spawn": a name after these is a creature even with no article. */
const PREDICATES = new Set(["are", "is", "was", "were", "as", "become", "becomes", "became"]);

/** Words that say a fight need not happen: they make a scene with few fighting words a "possible" one. */
const PEACEFUL_PATTERNS: RegExp[] = [
  /\bmeans? no harm\b/,
  /\bno interest in\b/,
  /\bpeaceful(?:ly)?\b/,
  /\bfriendly\b/,
  /\bhospitality\b/,
  /\bnot (?:immediately )?hostile\b|\b(?:isn|aren)[’']t (?:immediately )?hostile\b/,
  /\bpay no mind\b/,
  /\bwithout bothering\b/,
  /\bwelcome[sd]?\b/,
];

/** A fighting word that is denied: "don't fight", "won't attack", "aren't aggressive". */
const NEGATED_COMBAT =
  /\b(?:don[’']t|do not|doesn[’']t|does not|won[’']t|will not|never|aren[’']t|are not|isn[’']t|is not)\s+(?:(?!hesitate\b)[a-z]+\s+){0,2}?(?:fight|attack|engage|aggressive)\w*(?![^.;]{0,30}\b(?:unless|that|who|until)\b)/g;

/** Between two prey in a list: "moose and deer". */
const LIST_GAP = /^\s*(?:,|,?\s*(?:and|or))?\s*$/i;

/** "a creature's shadow": the Shadow of the bestiary is not in the scene. */
const SHADOW_OF_SOMETHING = /(?:(?:\u2019s|'s|\ba|\bthe|\bits) shadow\b|\bshadow(?:\u2019s|'s)\b)/gi;

const GAP = /^[\s\-\u2013\u2019']*$/;

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
    const reinforcement = (from: number) =>
      from > 0 && REINFORCEMENT.has(tokens[from - 1].norm) && joined(text, tokens[from - 1], tokens[from]);

    if (tok.kind === "dice") {
      return { count: diceAverage(tok.norm), dice: tok.norm, explicit: true, from: i, reinforcement: reinforcement(i) };
    }
    const n = numberOf(tok);
    if (n !== null) {
      // "twenty-four nobles": the tens before a hyphen add to the units.
      const tens = i > 0 ? numberOf(tokens[i - 1]) : null;
      if (
        tens !== null &&
        tens >= 20 &&
        tens % 10 === 0 &&
        n < 10 &&
        /^-$/.test(text.slice(tokens[i - 1].end, tok.start))
      ) {
        return { count: tens + n, explicit: true, from: i - 1, reinforcement: reinforcement(i - 1) };
      }
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
      if (head === "pair" || head === "duo") return { count: 2, explicit: true, from: i - 1 };
      if (head === "trio") return { count: 3, explicit: true, from: i - 1 };
      if (head === "quartet") return { count: 4, explicit: true, from: i - 1 };
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
    // "three of its servitor mummies", "two of the three hags": the number before "of".
    if (["the", "its", "their", "his", "her"].includes(tok.norm) && i > 1 && tokens[i - 1].norm === "of") {
      const n = numberOf(tokens[i - 2]);
      if (n !== null && !NOT_A_COUNT.has(tokens[i - 2].norm)) return { count: n, explicit: true, from: i - 2 };
    }
    if (STOP_WORDS.has(tok.norm)) return null;
    // "two iron golems guard": a plural noun ends the phrase, the number is its own.
    if (looksPlural(tok.norm)) return null;
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
  /** No number and no determiner before it ("to guard"): a word, not a creature. */
  bare: boolean;
  prey: boolean;
  /** Out of the scene: dead, a statue, a corpse, a former owner. */
  absent: boolean;
  /** Sentence number of the mention. */
  sentence: number;
  /** Followed by a noun it modifies ("wyvern nesting ground"). */
  modifier: boolean;
  /** Followed by a rank ("frost giant chieftain"): the creature, maybe a stronger one. */
  rank?: string;
  /** The head of a creature another book has ("shadow antipaladin [ToB1]"): not counted. */
  otherBook?: boolean;
  /** Read as part of the creature named next to it ("void piper selang", "merchant commoners"). */
  mergedInto?: Found;
  /** Its stats are another's ("four giant bees (use giant wasp)"). */
  replacedBy?: Found;
  /** The template written after it ("with the void template"). */
  template?: string;
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
        // "four giant bees (use giant wasp)": the parenthesis says which creature.
        if (!/^\s*\(\s*use\b/i.test(text.slice(tokens[j].end))) out.push(text.slice(tokens[i].start, tokens[j].end));
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
  const negated = lower.match(NEGATED_COMBAT) ?? [];
  const affirmed = lower.replace(NEGATED_COMBAT, " ");
  const combat = countMatches(COMBAT_PATTERNS, affirmed);
  const traces = countMatches(TRACE_PATTERNS, lower);
  const still = countMatches(STILL_PATTERNS, lower);
  const peaceful = countMatches(PEACEFUL_PATTERNS, lower);
  if (traces >= 1 && combat <= 1) {
    reasons.push("reads as signs of a creature (tracks, shadow, remains), not a meeting");
    return "unlikely";
  }
  if (traces >= 1) {
    reasons.push("signs of a creature, but also fighting words");
    return "possible";
  }
  if (combat === 0 && negated.length > 0) {
    reasons.push(`the fighting words are denied ("${(negated[0] ?? "").trim()}")`);
    return "unlikely";
  }
  if (peaceful >= 1 && combat <= 1) {
    reasons.push("reads as a peaceful meeting that could turn to a fight");
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

/**
 * The determiner before a mention, over at most two describing words ("the haughty mages", "his prized
 * pony"). A possessive reads as "a" (another one: "its selang bodyguard", "their injured frost giant
 * comrade"); a group ("hundreds of lantern hagfish") and a predicate ("they are vampire spawn") as "of".
 */
function determinerBefore(text: string, tokens: Token[], k: number, covered: Set<number>): string | undefined {
  let mods = 0;
  for (let i = k - 1; i >= 0 && mods <= 2; i--) {
    const t = tokens[i];
    if (covered.has(i) || !joined(text, t, tokens[i + 1])) return undefined;
    if (POSSESSIVES.has(t.norm)) return "a";
    if (DETERMINERS.has(t.norm)) return t.norm;
    if (t.norm === "of" || PREDICATES.has(t.norm)) return "of";
    if (t.kind !== "word" || STOP_WORDS.has(t.norm) || numberOf(t) !== null) return undefined;
    mods++;
  }
  return undefined;
}

/** A CR as a number ("1/8" is 0.125); 0 when there is none. */
function crValue(cr: string | undefined): number {
  if (!cr) return 0;
  const m = cr.trim().match(/^(\d+)\s*\/\s*(\d+)$/);
  if (m) return Number(m[1]) / Number(m[2]);
  const n = Number(cr);
  return Number.isFinite(n) ? n : 0;
}

/** Whether a later mention can be read as one already named: "the captain" after "a bandit captain", "the quippers" after "a swarm of quippers". */
function refersTo(later: Mention, earlier: Mention): boolean {
  if (later.note === earlier.note) return true;
  // "the local ancient red dragon" is not the adult red dragon named before it.
  if (later.key.includes(" ")) return false;
  if (later.head === earlier.head) return true;
  const words = earlier.key.split(" ");
  const forms = [later.head, ...pluralsOf(later.head)];
  if (forms.some((w) => words.includes(w))) return true;
  return earlier.key.length > later.key.length && earlier.key.endsWith(later.key);
}

/** "eight of them stop their work to attack": the number of a group first named with none ("dozens of giant fire beetles"). */
function laterOfThem(text: string, tokens: Token[], from: number): CountRead | null {
  for (let i = 0; i < tokens.length - 2; i++) {
    if (tokens[i].start < from) continue;
    const t = tokens[i];
    const n = t.kind === "dice" ? diceAverage(t.norm) : numberOf(t);
    if (n === null || n === 0 || NOT_A_COUNT.has(t.norm)) continue;
    if (tokens[i + 1].norm === "of" && ["them", "these", "those"].includes(tokens[i + 2].norm)) {
      return {
        count: n,
        ...(t.kind === "dice" ? { dice: t.norm } : {}),
        explicit: true,
        from: i,
        note: `"${t.raw} of ${tokens[i + 2].raw}" read as the count`,
      };
    }
  }
  return null;
}

/** The count of each creature the line names, whether it reads like a fight, and how far to trust it. */
export interface ExtractOptions {
  /**
   * The text is prose about one group (an adventure's keyed area), not a table row: a creature named again
   * is the same creature ("Duxt … Duxt" is one Duxt). The names it sets in bold (`named`, as written) are
   * where each creature comes in: those mentions are summed ("two duelists … a third duelist"), the rest
   * are echoes. With no bold mention of a creature, its largest count stands.
   */
  prose?: { named: string[] };
}

export function extractEncounter(
  rawText: string,
  index: MonsterIndex,
  options: ExtractOptions = {}
): ExtractedEncounter {
  const text = plainText(rawText);
  const lower = text.toLowerCase();
  const reasons: string[] = [];
  const tokens = tokenize(text);
  const mentions = findMentions(index, text);
  /** Something to look at twice: the guess is fair but not sure (a rank read as the creature). */
  let doubt = false;

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
    const det = count || k <= 0 ? undefined : determinerBefore(text, tokens, k, covered);
    // "their injured frost giant comrade": another one, one of it.
    if (!count && det === "a" && !mention.plural) count = { count: 1, explicit: true, from: k };
    const previous = found[found.length - 1];
    const before = text.slice(0, phraseStart);
    const after = text.slice(mention.end);
    const prey =
      PREY_LEAD.test(before) ||
      PREY_FOLLOW.test(after) ||
      (!!previous?.prey && LIST_GAP.test(text.slice(previous.mention.end, phraseStart)));
    const last = tokens.findIndex((t) => t.end === mention.end);
    const next = last >= 0 ? tokens[last + 1] : undefined;
    const nextJoined = !!next && joined(text, tokens[last], next);
    const phrase = text.slice(phraseStart, mention.end);
    found.push({
      prey,
      absent:
        ABSENT_LEAD.test(before) ||
        ABSENT_FOLLOW.test(after) ||
        DEAD_WORDS.test(text.slice(phraseStart, mention.start)),
      sentence: (text.slice(0, mention.start).match(/[.!?]\s/g) ?? []).length,
      modifier: !mention.plural && nextJoined && MODIFIER_FOLLOW.has(next.norm),
      ...(!mention.plural && nextJoined && RANK_FOLLOW.has(next.norm)
        ? { rank: next.raw }
        : !mention.plural &&
            nextJoined &&
            tokens[last + 2] &&
            joined(text, next, tokens[last + 2]) &&
            RANK_FOLLOW.has(tokens[last + 2].norm)
          ? { rank: `${next.raw} ${tokens[last + 2].raw}` }
          : {}),
      // "a derro shadow antipaladin [ToB1]": a creature of another book, not the bestiary's.
      ...(OTHER_BOOK.test(after) ? { otherBook: true } : {}),
      mention,
      count,
      guess: mention.plural ? 2 : 1,
      phrase,
      anaphoric: !count && !!det && ANAPHORS.has(det),
      bare: !count && !det && !mention.plural && k > 0,
    });
  });

  // "four giant bees (use giant wasp)": the creature in the parenthesis takes the count, the one before it goes.
  found.forEach((f, fi) => {
    const open = text.lastIndexOf("(", f.mention.start);
    if (open < 0 || !inParenthesis(text, f.mention.start)) return;
    // "(use giant wasp)", "(use the statistics of a wolf, except …)".
    if (
      !/^\(\s*use\s+(?:the\s+(?:statistics|stats)\s+(?:of|for)\s+)?(?:an?\s+|the\s+)?$/i.test(
        text.slice(open, f.mention.start)
      )
    )
      return;
    let at = tokens.findIndex((t) => t.start >= open) - 1;
    let count: CountRead | null = null;
    for (let i = at, seen = 0; i >= 0 && seen < 5; i--, seen++) {
      const t = tokens[i];
      if (STOP_WORDS.has(t.norm) && !["a", "an", "of"].includes(t.norm)) break;
      if (t.norm === "dozen") {
        const times = i > 0 ? numberOf(tokens[i - 1]) : null;
        count = { count: 12 * (times ?? 1), explicit: true, from: times !== null ? i - 1 : i };
        break;
      }
      const n = t.kind === "dice" ? diceAverage(t.norm) : numberOf(t);
      if (n !== null) {
        count = { count: n, ...(t.kind === "dice" ? { dice: t.norm } : {}), explicit: true, from: i };
        break;
      }
      if (t.norm === "a" || t.norm === "an") {
        count = { count: 1, explicit: true, from: i };
        break;
      }
      at = i;
    }
    const from = count ? tokens[count.from].start : tokens[Math.max(0, at)].start;
    for (const g of found.slice(0, fi)) {
      if (g.mention.start >= from && g.mention.end <= open && !g.replacedBy) g.replacedBy = f;
    }
    const plural =
      /s\s*$/.test(text.slice(from, open).trim()) || found.some((g) => g.replacedBy === f && g.mention.plural);
    f.count = count ?? { count: plural ? 2 : 1, explicit: false, from: Math.max(0, at) };
    f.phrase = `${text.slice(from, open).trim()} (use ${f.mention.text})`;
    f.bare = false;
    f.anaphoric = false;
    reasons.push(`"${f.phrase}": the stats named in the parenthesis`);
  });

  // "use mage with the Void-blessed template", "a giant ape with the bramble creature template": one template, named.
  for (const f of found) {
    const m = text
      .slice(f.mention.end)
      .match(/^\s+(?:modified\s+)?with\s+the\s+([\p{L}\u2019'-]+(?:\s+[\p{L}\u2019'-]+){0,2}?)\s+template\b(?!s)/iu);
    if (!m || /\b(?:or|and)\b/i.test(m[1])) continue;
    f.template = m[1].trim();
    reasons.push(`"${f.mention.text}" with the ${f.template} template`);
  }

  // Two names side by side are one creature: "void piper selang" is a Void Piper, "merchant commoners" are commoners.
  for (let i = 0; i + 1 < found.length; i++) {
    const a = found[i];
    const b = found[i + 1];
    if (a.mergedInto || a.replacedBy || b.replacedBy) continue;
    // "a lion spies the PCs": an everyday word after a name is the verb, not a second name.
    if (COMMON_WORD_NAMES.has(b.mention.key) || COMMON_WORD_NAMES.has(a.mention.key)) continue;
    const ta = tokens.findIndex((t) => t.end === a.mention.end);
    if (ta < 0 || tokens[ta + 1]?.start !== b.mention.start || !joined(text, tokens[ta], tokens[ta + 1])) continue;
    const keepA = crValue(a.mention.cr) > crValue(b.mention.cr);
    const [keep, drop] = keepA ? [a, b] : [b, a];
    drop.mergedInto = keep;
    // The count is the first one's ("four void piper selangs"), the number the second one's (it is plural).
    keep.count = a.count ?? b.count;
    keep.phrase = `${a.phrase} ${b.mention.text}`;
    keep.bare = false;
    keep.anaphoric = a.anaphoric;
    if (!keep.count && b.mention.plural) keep.guess = 2;
    keep.rank = b.rank;
    reasons.push(`"${keep.phrase}" read as ${keep.count?.count ?? keep.guess} ${keep.mention.name}`);
  }

  const shadows = [...text.matchAll(SHADOW_OF_SOMETHING)].map((m): [number, number] => {
    const at = (m.index ?? 0) + m[0].toLowerCase().indexOf("shadow");
    return [at, at + "shadow".length];
  });
  const kept: Found[] = [];
  /** Creatures named and out of the scene, for the later mentions that point back at them. */
  const gone: Found[] = [];
  /** Everything a later "the …" may point back at, the merged names too. */
  const named: Mention[] = [];
  for (const f of found) {
    const { mention } = f;
    if (f.mergedInto || f.replacedBy) {
      named.push(mention);
      continue;
    }
    if (f.otherBook) {
      reasons.push(`"${f.phrase}" names a creature of another book: not counted`);
      continue;
    }
    if (f.modifier) {
      reasons.push(`"${mention.text}" modifies the noun after it (a nest, a lair, a form): not counted`);
      continue;
    }
    if (f.prey) {
      reasons.push(`"${f.phrase}" looks like prey, the sought or a likeness, not part of the encounter`);
      gone.push(f);
      continue;
    }
    if (f.absent) {
      reasons.push(`"${f.phrase}" is out of the scene (dead, a statue, a former owner): not counted`);
      gone.push(f);
      continue;
    }
    if (shadows.some((r) => mention.start < r[1] && mention.end > r[0]) && /^shadow(?:[’']s)?$/i.test(mention.text)) {
      reasons.push(`"${mention.text}" is a shadow cast by something, not the creature`);
      continue;
    }
    if (!f.count?.explicit && COMMON_WORD_NAMES.has(mention.key)) {
      reasons.push(`"${f.phrase}" reads as the everyday word, not the ${mention.name} (no number): not counted`);
      continue;
    }
    if (!f.count && inParenthesis(text, mention.start)) {
      reasons.push(`"${mention.text}" is in a parenthesis with no number: a cross-reference, not counted`);
      continue;
    }
    if (f.anaphoric || (!f.count && mention.plural)) {
      // "the selangs" may be the void piper selangs; a bare "ghasts" only the ghasts already named.
      const same = (e: Mention) => (f.anaphoric ? refersTo(mention, e) : e.note === mention.note);
      const earlier = named.find(same);
      if (earlier) {
        reasons.push(`"${f.phrase}" read as the "${earlier.text}" already named`);
        continue;
      }
      const dead = gone.find((g) => same(g.mention));
      if (dead) {
        reasons.push(`"${f.phrase}" read as the "${dead.mention.text}" out of the scene`);
        continue;
      }
    }
    if (f.bare) {
      reasons.push(`"${mention.text}" has no number or article: read as a word, not the ${mention.name}`);
      continue;
    }
    if (f.rank) {
      reasons.push(`"${mention.text} ${f.rank}" read as a ${mention.name} (a stronger one may suit)`);
      doubt = true;
    }
    kept.push(f);
    named.push(mention);
  }

  // A group named with no number whose number comes later: "dozens of giant fire beetles ... eight of them".
  for (const f of kept) {
    if (f.count || !f.mention.plural) continue;
    const later = laterOfThem(text, tokens, f.mention.end);
    if (later) f.count = later;
  }

  // A mention with no number beside a counted one of the same kind is the same creatures: "a band of lizardfolk ... four lizardfolk".
  const counted = kept.filter((f) => f.count?.explicit);
  const echoOf = (f: Found) =>
    counted.find(
      (c) => c !== f && (c.mention.note === f.mention.note || (f.anaphoric && refersTo(f.mention, c.mention)))
    );
  // Each bold name stands for one mention: the first mention whose words it is takes it.
  const unnamed = (options.prose?.named ?? []).map((n) => n.toLowerCase());
  const takeNamed = (words: string): boolean => {
    const at = unnamed.indexOf(words.toLowerCase());
    if (at < 0) return false;
    unnamed.splice(at, 1);
    return true;
  };
  const bold = new Set(options.prose ? kept.filter((f) => takeNamed(f.mention.text)) : []);
  // In prose a bold name is a creature coming in ("a third duelist"), not an echo of the counted ones.
  const echoes = kept.filter((f) => !f.count && echoOf(f) && !bold.has(f));
  for (const f of echoes) {
    const c = echoOf(f);
    reasons.push(`"${f.phrase}" read as the "${c?.phrase}" counted`);
  }
  const counting = kept.filter((f) => !echoes.includes(f));

  // One monster per note; sum the mentions of the same note.
  const order: string[] = [];
  const byNote = new Map<string, Found[]>();
  for (const f of counting) {
    if (!byNote.has(f.mention.note)) {
      byNote.set(f.mention.note, []);
      order.push(f.mention.note);
    }
    byNote.get(f.mention.note)?.push(f);
  }
  // A creature that only comes as reinforcements ("an additional four bugbears") is not in the first fight.
  const firstFight = order.filter((note) => (byNote.get(note) ?? []).some((f) => !f.count?.reinforcement));
  if (firstFight.length > 0 && firstFight.length < order.length) {
    const extra = order
      .filter((n) => !firstFight.includes(n))
      .flatMap((n) => (byNote.get(n) ?? []).map((f) => `"${f.phrase}"`));
    reasons.push(`reinforcements not counted: ${extra.join(", ")}`);
    order.splice(0, order.length, ...firstFight);
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
      // (In prose a later bold name is one more coming in: "a third duelist keeps watch".)
      const later = group.filter(
        (f) => f !== lead && f.sentence > lead.sentence && f.count?.explicit && !(bold.has(f) && bold.has(lead))
      );
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
    if (group.length > 1 && options.prose) {
      const named = group.filter((f) => bold.has(f));
      const amount = (f: Found) => f.count?.count ?? f.guess;
      total = named.length ? named.reduce((sum, f) => sum + amount(f), 0) : Math.max(...group.map(amount));
      reasons.push(
        named.length > 1
          ? `${named.length} mentions of ${first.name} in bold summed to ${total}, the rest read as the same ones`
          : `${group.length} mentions of ${first.name} read as the same ${total}`
      );
    } else if (group.length > 1) {
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
      ...(group.find((f) => f.template) ? { template: group.find((f) => f.template)!.template } : {}),
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
  } else if (combat === "likely" && !doubt && unresolved.length === 0 && monsters.every((m) => !m.inferred)) {
    confidence = "high";
  } else {
    confidence = "medium";
  }

  return { monsters, unresolved, combat, confidence, reasons };
}
