/**
 * A name index over the bestiary, for finding the creatures a line of prose
 * names. Names are normalised (case, diacritics, the Kobold Press `ᴷ` mark,
 * punctuation), comma forms are read both ways ("Wolf, Dire" is also "dire
 * wolf"), and each name answers to its plural ("winter wolves", "swarms of
 * rats"). No Obsidian and no I/O: callers hand in `{ note, name, cr }` entries.
 */

/** What a caller knows of one bestiary note. */
export interface MonsterEntry {
  /** The note's vault path. */
  note: string;
  /** The `name` of its `stat.monster` fence, e.g. "Wolf, Dire". */
  name: string;
  /** The CR as written, e.g. "1/2". */
  cr?: string;
}

/** A note an index entry could also have been. */
export interface MonsterRef {
  note: string;
  name: string;
  cr?: string;
}

/** The note chosen for a normalised name, and the other notes that bore the same name. */
export interface MonsterIndexEntry extends MonsterRef {
  /** The canonical normalised name, e.g. "dire wolf". */
  key: string;
  /** The word that names the creature: "wolf" for "dire wolf", "swarm" for "swarm of rats". */
  head: string;
  /** Other notes with the same normalised name, in preference order (the Kobold Press ones last). */
  alternatives: MonsterRef[];
}

/** An answer to a name: the entry, and whether the phrase was its plural. */
export interface MonsterMatch extends MonsterIndexEntry {
  plural: boolean;
}

/** One creature named in a text, with where. */
export interface Mention extends MonsterMatch {
  /** Offsets into the text given to `findMentions`. */
  start: number;
  end: number;
  /** The words as written. */
  text: string;
}

export interface MonsterIndex {
  /** Every normalised phrase the index answers to. */
  keys: Map<string, MonsterMatch>;
  /** The most words in any key (the widest n-gram worth trying). */
  maxWords: number;
  /** One entry per distinct normalised name. */
  entries: MonsterIndexEntry[];
}

/** A word (or a dice expression) of a text. */
export interface Token {
  raw: string;
  /** Lowercased, accents and possessive `'s` removed; for dice, "1d4" or "1d4 + 1". */
  norm: string;
  start: number;
  end: number;
  kind: "word" | "dice";
}

// A dice expression (with its flat modifier) or a word; a dice-like run inside a longer word is part of the word.
const TOKEN = /(\d*d\d+(?:\s*[+\u2212\u2013-]\s*\d+)?)(?![\p{L}\p{N}])|[\p{L}\p{N}]+(?:['\u2019][\p{L}\p{N}]+)*/giu;

/** One word, normalised: lowercase, no accents, no `ᴷ`-like marks, no possessive. */
export function normWord(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\p{M}\p{Lm}\u00AA\u00BA]/gu, "")
    .toLowerCase()
    .replace(/['\u2019]s$/, "")
    .replace(/['\u2019]/g, "");
}

function normDice(raw: string): string {
  const m = raw.toLowerCase().match(/^(\d*)d(\d+)(?:\s*([+\u2212\u2013-])\s*(\d+))?$/);
  if (!m) return raw.toLowerCase();
  const base = `${m[1] || "1"}d${m[2]}`;
  if (!m[3]) return base;
  return `${base} ${m[3] === "+" ? "+" : "-"} ${m[4]}`;
}

/** The words and dice of a text, with their offsets. */
export function tokenize(text: string): Token[] {
  const out: Token[] = [];
  for (const m of text.matchAll(TOKEN)) {
    const start = m.index ?? 0;
    const raw = m[0];
    if (m[1] !== undefined) {
      out.push({ raw, norm: normDice(raw), start, end: start + raw.length, kind: "dice" });
      continue;
    }
    const norm = normWord(raw);
    if (norm) out.push({ raw, norm, start, end: start + raw.length, kind: "word" });
  }
  return out;
}

/** The normalised words of a phrase ("Ice Mephits," -> ["ice", "mephits"]). */
export function wordsOf(phrase: string): string[] {
  return tokenize(phrase)
    .filter((t) => t.kind === "word")
    .map((t) => t.norm);
}

const INVARIANT = new Set([
  "sheep",
  "deer",
  "fish",
  "moose",
  "swine",
  "series",
  "species",
  "aircraft",
  "bison",
  "salmon",
]);

const IRREGULAR_PLURAL = new Map<string, string[]>(
  Object.entries({
    child: ["children"],
    cyclops: ["cyclopes"],
    djinni: ["djinn", "djinni"],
    foot: ["feet"],
    fungus: ["fungi", "funguses"],
    goose: ["geese"],
    homunculus: ["homunculi"],
    louse: ["lice"],
    magus: ["magi"],
    man: ["men"],
    mouse: ["mice"],
    ox: ["oxen"],
    person: ["people"],
    tooth: ["teeth"],
    woman: ["women"],
  })
);

/** The plural forms of one word (not the word itself; none for an invariant one). */
export function pluralsOf(word: string): string[] {
  if (INVARIANT.has(word) || word.length < 2) return [];
  const irregular = IRREGULAR_PLURAL.get(word);
  if (irregular) return irregular;
  const out: string[] = [];
  if (/[^aeiou]y$/.test(word)) {
    out.push(`${word.slice(0, -1)}ies`);
  } else if (/(s|x|z|ch|sh)$/.test(word)) {
    out.push(`${word}es`);
  } else if (/fe$/.test(word)) {
    out.push(`${word.slice(0, -2)}ves`, `${word}s`);
  } else if (/f$/.test(word)) {
    out.push(`${word.slice(0, -1)}ves`, `${word}s`);
  } else if (/[^aeiou]o$/.test(word)) {
    out.push(`${word}es`, `${word}s`);
  } else {
    out.push(`${word}s`);
  }
  if (/man$/.test(word)) out.push(`${word.slice(0, -3)}men`);
  if (/us$/.test(word)) out.push(`${word.slice(0, -2)}i`);
  return out;
}

/** The index of the word a plural is made on: the one before "of" in "swarm of rats", else the last. */
function nounIndex(words: string[]): number {
  const of = words.indexOf("of");
  return of > 0 ? of - 1 : words.length - 1;
}

/** Every plural spelling of a phrase's noun. */
function pluralPhrases(words: string[]): string[][] {
  const at = nounIndex(words);
  return pluralsOf(words[at]).map((p) => words.map((w, i) => (i === at ? p : w)));
}

const ARTICLES = new Set(["a", "an", "the"]);

interface Form {
  words: string[];
  /** 0 for the way the note writes its name, 1 for a way it can also be said. */
  priority: number;
}

/** The ways a bestiary name can be said: its canonical words, and variants. */
function formsOf(name: string): Form[] {
  const cleaned = name.replace(/\([^)]*\)/g, " ").replace(/\s+CR\s*[\u2014\u2013-]\s*$/i, "");
  const parts = cleaned
    .split(",")
    .map((p) => wordsOf(p))
    .filter((p) => p.length > 0);
  if (parts.length === 0) return [];
  const original = parts.flat();
  if (parts.length === 1) return [{ words: original, priority: 0 }];
  const tail = parts.slice(1);
  // "Kobold, A" is the plain kobold ("a kobold"): the tail is only an article.
  if (tail.every((p) => p.length === 1 && ARTICLES.has(p[0]))) return [{ words: parts[0], priority: 0 }];
  // Any other lone letter is not a kind of creature: say the name as written.
  if (tail.some((p) => p.length === 1 && p[0].length === 1)) return [{ words: original, priority: 0 }];
  // "Rat, Swarm of Rats": the tail alone is the name.
  if (tail.some((p) => p.includes("of"))) {
    return [{ words: tail.flat(), priority: 0 }];
  }
  const inverted = [...parts].reverse().flat();
  const forms: Form[] = [
    { words: inverted, priority: 0 },
    { words: original, priority: 1 },
  ];
  // "Insect, Giant Wasp" is also a "giant wasp" (a one-word tail like "Dire" is not a name).
  for (const p of tail) if (p.length > 1) forms.push({ words: p, priority: 1 });
  return forms;
}

function isKobold(path: string, name: string): boolean {
  return /\u1D37|\u1D4F/.test(path) || /\u1D37|\u1D4F/.test(name);
}

function compareNotes(a: MonsterEntry, b: MonsterEntry): number {
  const ka = isKobold(a.note, a.name) ? 1 : 0;
  const kb = isKobold(b.note, b.name) ? 1 : 0;
  if (ka !== kb) return ka - kb;
  if (a.note.length !== b.note.length) return a.note.length - b.note.length;
  return a.note < b.note ? -1 : a.note > b.note ? 1 : 0;
}

const ref = (e: MonsterEntry): MonsterRef => ({
  note: e.note,
  name: e.name,
  ...(e.cr !== undefined ? { cr: e.cr } : {}),
});

/** Another name for a bestiary note, kept by a person: "warden robot" for `Robot Warden`. */
export interface MonsterAlias {
  /** The words as a text says them, singular ("warden robot"); the plural answers too. */
  phrase: string;
  /** The vault path of the note it names (one of the entries). */
  note: string;
}

/**
 * Builds the index. Notes that normalise to the same name share one entry:
 * the one without the `ᴷ` suffix wins, then the shortest path; the rest are
 * its `alternatives`. An alias names the entry of its note, before any name.
 */
export function buildMonsterIndex(entries: MonsterEntry[], aliases: MonsterAlias[] = []): MonsterIndex {
  const groups = new Map<string, { forms: Form[]; notes: MonsterEntry[] }>();
  for (const e of entries) {
    const forms = formsOf(e.name);
    if (forms.length === 0) continue;
    const key = forms[0].words.join(" ");
    const group = groups.get(key);
    if (group) group.notes.push(e);
    else groups.set(key, { forms, notes: [e] });
  }

  const index: MonsterIndex = { keys: new Map(), maxWords: 1, entries: [] };
  const taken = new Map<string, number>();
  const register = (words: string[], entry: MonsterIndexEntry, plural: boolean, priority: number) => {
    const key = words.join(" ");
    const have = taken.get(key);
    if (have !== undefined && have <= priority) return;
    taken.set(key, priority);
    index.keys.set(key, { ...entry, plural });
    index.maxWords = Math.max(index.maxWords, words.length);
  };

  // Group order is the order of the first note met; make the order of preference not depend on it.
  const sorted = [...groups.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  for (const [key, group] of sorted) {
    const notes = [...group.notes].sort(compareNotes);
    const words = group.forms[0].words;
    const entry: MonsterIndexEntry = {
      ...ref(notes[0]),
      key,
      head: words[nounIndex(words)],
      alternatives: notes.slice(1).map(ref),
    };
    index.entries.push(entry);
    for (const form of group.forms) {
      register(form.words, entry, false, form.priority * 2);
      for (const plural of pluralPhrases(form.words)) register(plural, entry, true, form.priority * 2);
    }
  }
  for (const alias of aliases) {
    const entry = index.entries.find((e) => e.note === alias.note || e.alternatives.some((a) => a.note === alias.note));
    const words = wordsOf(alias.phrase);
    if (!entry || words.length === 0) continue;
    const named =
      entry.note === alias.note ? entry : { ...entry, ...ref(entries.find((e) => e.note === alias.note) ?? entry) };
    // An alias is a person's word: it wins over a name the bestiary would give the same words.
    taken.delete(words.join(" "));
    register(words, named, false, -1);
    for (const plural of pluralPhrases(words)) {
      taken.delete(plural.join(" "));
      register(plural, named, true, -1);
    }
  }
  return index;
}

/** The entry a phrase names, if any ("Winter Wolves" -> Winter Wolf, plural). */
export function lookupName(index: MonsterIndex, phrase: string): MonsterMatch | undefined {
  const key = wordsOf(phrase).join(" ");
  return key ? index.keys.get(key) : undefined;
}

// Between two words of one name there is only space or a hyphen.
const NAME_GAP = /^[\s\-\u2013\u2019']*$/;

/**
 * Every creature a text names, longest name first and none overlapping:
 * "winter wolf" beats "wolf" and "bandit captain" beats "bandit".
 */
export function findMentions(index: MonsterIndex, text: string): Mention[] {
  const tokens = tokenize(text);
  const candidates: { from: number; to: number; match: MonsterMatch }[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].kind !== "word") continue;
    const parts: string[] = [];
    for (let j = i; j < tokens.length && j - i < index.maxWords; j++) {
      if (tokens[j].kind !== "word") break;
      if (j > i && !NAME_GAP.test(text.slice(tokens[j - 1].end, tokens[j].start))) break;
      parts.push(tokens[j].norm);
      const match = index.keys.get(parts.join(" "));
      if (match) candidates.push({ from: i, to: j, match });
    }
  }
  candidates.sort((a, b) => {
    const la = a.to - a.from;
    const lb = b.to - b.from;
    if (la !== lb) return lb - la;
    return a.from - b.from;
  });
  const used = new Set<number>();
  const chosen: typeof candidates = [];
  for (const c of candidates) {
    let free = true;
    for (let k = c.from; k <= c.to; k++) if (used.has(k)) free = false;
    if (!free) continue;
    for (let k = c.from; k <= c.to; k++) used.add(k);
    chosen.push(c);
  }
  return chosen
    .sort((a, b) => a.from - b.from)
    .map((c) => {
      const start = tokens[c.from].start;
      const end = tokens[c.to].end;
      return { ...c.match, start, end, text: text.slice(start, end) };
    });
}
