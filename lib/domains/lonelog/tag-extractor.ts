import type {
  PersistentTag,
  DialOpTag,
  ListOpTag,
  InventoryTag,
  WealthTag,
  RoomTag,
  InitiativeTag,
  InitiativeEntry,
} from "./types";

/** Kinds recognized by the tag grammar — shared by extraction and stripping. */
const TAG_KINDS =
  "N|L|E|Clock|Track|Dial|Timer|Thread|PC|F|Faction|Party|Inv|Wealth|R|Init|Pos|Mv|Time|Weather|Group|Mark";

/** A tag's body: anything up to its closing `]`, where a `[[wikilink]]` counts
 *  as one piece so its own brackets don't end the tag (`[Inv:[[Rope]]+1]`), and
 *  so does a single `[…]` (a hex map spec: `[Mark: Camp|pin[red]@(2,0)]`). */
const TAG_BODY = String.raw`((?:\[\[[^\]\n]*\]\]|\[[^\[\]\n]*\]|[^\]])+)`;

/**
 * A SESSION resource op, addressed by abbr: `[CF+1]`/`[CF-2]` (inc/dec),
 * `[CF=5]`/`[CF:5]` (set), `[CF?]` (inspect). ABBR is uppercase letters/digits.
 * Factories (not shared globals) so `lastIndex` never leaks between calls.
 */
function dialOpRegex(): RegExp {
  return /\[([A-Z][A-Z0-9]*)(?:([:=+-])\s*(\d+)|(\?))\]/g;
}

/**
 * A PC resource op, `[<Character>/<Resource><op>]`: `[Talon/Mystic Mark-1]`,
 * `[Talon/Mystic Mark=3]`, `[Talon/Mystic Mark?]`. Names allow spaces but not
 * `] | / :`, so the `/` separator + trailing op keep it disjoint from
 * `[[wikilinks]]`, `[Kind:content]`, and `[PC:Name|…]`. No `:` set-synonym here
 * (would collide with `[Kind:…]`) — use `=`.
 */
function pcOpRegex(): RegExp {
  return /\[([^\]|/:]+)\/([^\]|/:]+?)\s*(?:([=+-])\s*(\d+)|(\?))\]/g;
}

/**
 * A LIST op, `[<Name><op>]`. Growth: `[Characters+ Bertha]` (add),
 * `[Threads- Find the stone]` (remove); a `;`-separated body adds/removes
 * several at once (`[Characters+ A Mouse; Brian]`). Two reads — `?` inspects, `@` draws:
 *   - `[Characters?]`             — INSPECT: show the whole list;
 *   - `[Characters@]`             — ROLL one entry off the sheet (unrolled);
 *   - `[Characters@ r1=3 r2=7]`   — a rolled selection: the roll VALUES in order
 *                                   (which die each used is derived from the
 *                                   list's size, so `r`, not `d4`/`d10`);
 *   - `[Characters@ Tocky]`       — an explicit pick.
 * The name is Title Case — an uppercase initial followed by a lowercase letter —
 * which keeps it disjoint from the ALLCAPS resource abbrs matched by
 * `dialOpRegex` (`[CF+1]`, `[CF?]`). Names may contain spaces; the `/`-free body
 * keeps it disjoint from a PC op. The `@` sits INSIDE the brackets, so it never
 * collides with a line-initial `@(Actor)` action or an `@[[file]]` call token.
 */
function listOpRegex(): RegExp {
  return /\[([A-Z][a-z][A-Za-z ]*?)\s*(?:@\s*([^\][]*?)|([+-])\s*([^\][]+?)|(\?))\]/g;
}

/**
 * The ordered roll values of a list draw (`r1=3 r2=7`), or null when the body is
 * an explicit entry pick. Rolls are numbered, NOT typed: the list works out
 * which die each one used from its current size, so the author never writes
 * `d4`/`d10` and the log stays correct as the list grows.
 */
function parseListRolls(body: string): number[] | null {
  const found = [...body.matchAll(/r(\d+)\s*=\s*(\d+)/gi)];
  if (found.length === 0) return null;
  return found
    .map((m) => ({ n: parseInt(m[1], 10), v: parseInt(m[2], 10) }))
    .sort((a, b) => a.n - b.n)
    .map((r) => r.v);
}

/**
 * Remove all persistent `[...]` tags from a string, leaving only narration.
 * Used to derive a consequence's prose `conclusion` from its raw `text`.
 */
export function stripTags(text: string): string {
  const re = new RegExp(`\\[(?:#)?(?:${TAG_KINDS}):${TAG_BODY}\\]`, "g");
  return text
    .replace(re, "")
    .replace(dialOpRegex(), "")
    .replace(pcOpRegex(), "")
    .replace(listOpRegex(), "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** List ops in a string, in left-to-right order. */
function extractListOps(text: string): ListOpTag[] {
  const found: ListOpTag[] = [];
  const re = listOpRegex();
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const name = m[1].trim();
    if (m[2] !== undefined) {
      // `[Name@ …]` — a ROLL. Bare (`[Name@]`) is unrolled; otherwise the body
      // records the result: the dice (section + row) or an explicit entry pick.
      const body = m[2].trim();
      if (!body) {
        found.push({ kind: "list-op", name, op: "roll" });
        continue;
      }
      const rolls = parseListRolls(body);
      if (rolls) {
        found.push({ kind: "list-op", name, op: "roll", rolled: true, rolls });
      } else {
        found.push({ kind: "list-op", name, op: "roll", rolled: true, entry: body });
      }
    } else if (m[5] === "?") {
      found.push({ kind: "list-op", name, op: "inspect" });
    } else {
      // `[Name+ A Mouse; Brian]` is shorthand for two ops — a `;`-separated body
      // yields one tag per entry, so it is EXACTLY equivalent to writing
      // `[Name+ A Mouse][Name+ Brian]`. The separator is a SEMICOLON because
      // commas occur naturally inside entries ("Bertha, the Angry Avian").
      const op = m[3] === "+" ? "add" : "remove";
      for (const part of (m[4] ?? "").split(";")) {
        const entry = part.trim();
        if (entry) found.push({ kind: "list-op", name, op, entry });
      }
    }
  }
  return found;
}

/** Session + PC resource ops in a string, in left-to-right order. */
function extractResourceOps(text: string): DialOpTag[] {
  const found: { index: number; tag: DialOpTag }[] = [];
  const opOf = (sym: string | undefined, q: string | undefined): DialOpTag["op"] =>
    q === "?" ? "inspect" : sym === "+" ? "inc" : sym === "-" ? "dec" : "set";
  const sRe = dialOpRegex();
  for (let m = sRe.exec(text); m; m = sRe.exec(text)) {
    const op = opOf(m[2], m[4]);
    found.push({
      index: m.index,
      tag: { kind: "dial-op", abbr: m[1], op, amount: m[4] ? undefined : parseInt(m[3], 10) },
    });
  }
  const pRe = pcOpRegex();
  for (let m = pRe.exec(text); m; m = pRe.exec(text)) {
    const op = opOf(m[3], m[5]);
    found.push({
      index: m.index,
      tag: { kind: "dial-op", pc: m[1].trim(), name: m[2].trim(), op, amount: m[5] ? undefined : parseInt(m[4], 10) },
    });
  }
  return found.sort((a, b) => a.index - b.index).map((f) => f.tag);
}

/** Extract all persistent tags from a text string */
export function extractTags(text: string): PersistentTag[] {
  const tags: PersistentTag[] = [];
  const tagRegex = new RegExp(`\\[(?:#)?(${TAG_KINDS}):${TAG_BODY}\\]`, "g");

  let match;
  while ((match = tagRegex.exec(text)) !== null) {
    const isRef = text[match.index + 1] === "#";
    const kind = match[1];
    const content = match[2];

    switch (kind) {
      case "N": {
        const parts = content.split("|").map((s) => s.trim());
        const name = parts[0];
        const tagList = parts.slice(1).filter(Boolean);
        tags.push({ kind: "npc", name, tags: tagList, ref: isRef });
        break;
      }
      case "L": {
        const parts = content.split("|").map((s) => s.trim());
        const name = parts[0];
        const tagList = parts.slice(1).filter(Boolean);
        tags.push({ kind: "location", name, tags: tagList });
        break;
      }
      case "E": {
        const m = content.match(/^(.+?)\s+(\d+)\/(\d+)$/);
        if (m) tags.push({ kind: "event", name: m[1].trim(), current: parseInt(m[2], 10), max: parseInt(m[3], 10) });
        break;
      }
      case "Clock": {
        const m = content.match(/^(.+?)\s+(\d+)\/(\d+)$/);
        if (m) {
          tags.push({ kind: "clock", name: m[1].trim(), current: parseInt(m[2], 10), max: parseInt(m[3], 10) });
        } else {
          const alt = content.match(/^(\d+)\/(\d+)$/);
          if (alt)
            tags.push({ kind: "clock", name: "Clock", current: parseInt(alt[1], 10), max: parseInt(alt[2], 10) });
        }
        break;
      }
      case "Track": {
        const m = content.match(/^(.+?)\s+(\d+)\/(\d+)$/);
        if (m) tags.push({ kind: "track", name: m[1].trim(), current: parseInt(m[2], 10), max: parseInt(m[3], 10) });
        break;
      }
      case "Dial": {
        // [Dial:Name|current|min-max]  e.g. [Dial:Chaos Factor|5|1-9]
        const parts = content.split("|").map((s) => s.trim());
        const range = parts[2]?.match(/^(\d+)\s*-\s*(\d+)$/);
        if (parts[0] && /^\d+$/.test(parts[1] ?? "") && range) {
          tags.push({
            kind: "dial",
            name: parts[0],
            current: parseInt(parts[1], 10),
            min: parseInt(range[1], 10),
            max: parseInt(range[2], 10),
          });
        }
        break;
      }
      case "Time": {
        const raw = content.trim();
        const advance = raw.match(/^\+\s*(\d+(?:\.\d+)?)\s*(h|hours?|d|days?|m|min(?:utes?)?)?$/i);
        if (advance) {
          const n = parseFloat(advance[1]);
          const unit = (advance[2] ?? "h").toLowerCase();
          tags.push({ kind: "time", advance: unit.startsWith("d") ? n * 24 : unit.startsWith("m") ? n / 60 : n, raw });
        } else {
          const day = raw.match(/day\s*(\d+)/i);
          const hour = raw.match(/(\d{1,2}):(\d{2})/);
          tags.push({
            kind: "time",
            set: {
              ...(day ? { day: parseInt(day[1], 10) } : {}),
              ...(hour ? { hour: parseInt(hour[1], 10) + parseInt(hour[2], 10) / 60 } : {}),
            },
            raw,
          });
        }
        break;
      }
      case "Weather": {
        tags.push({
          kind: "weather",
          parts: content
            .split(/\s*[·,]\s*/)
            .map((p) => p.trim())
            .filter(Boolean),
        });
        break;
      }
      case "Timer": {
        const m = content.match(/^(.+?)\s+(\d+)$/);
        if (m) {
          tags.push({ kind: "timer", name: m[1].trim(), value: parseInt(m[2], 10) });
        } else {
          const num = content.match(/^(\d+)$/);
          if (num) tags.push({ kind: "timer", name: "Timer", value: parseInt(num[1], 10) });
        }
        break;
      }
      case "Thread":
        tags.push({
          kind: "thread",
          name: content.split("|")[0].trim(),
          state: content.split("|")[1]?.trim() || "Open",
        });
        break;
      case "PC": {
        const parts = content.split("|").map((s) => s.trim());
        const name = parts[0];
        const changes = parts.slice(1).filter(Boolean);
        tags.push({ kind: "pc", name, changes });
        break;
      }
      case "F": {
        tags.push(parseFoeTag(content, isRef));
        break;
      }
      case "Init": {
        tags.push(parseInitiativeTag(content));
        break;
      }
      case "Pos": {
        tags.push(parsePositionTag(content));
        break;
      }
      case "Mv": {
        const move = parseMoveTag(content);
        if (move) tags.push(move);
        break;
      }
      case "Inv": {
        tags.push(parseInventoryTag(content, isRef));
        break;
      }
      case "R": {
        tags.push(parseRoomTag(content, isRef));
        break;
      }
      case "Wealth": {
        tags.push(...parseWealthTag(content));
        break;
      }
      case "Group": {
        const group = parseGroupTag(content);
        if (group) tags.push(group);
        break;
      }
      case "Mark": {
        const mark = parseMarkTag(content);
        if (mark) tags.push(mark);
        break;
      }
      case "Faction":
      case "Party":
        break;
    }
  }

  // Second pass: stateful resource ops — session `[CF+1]` and PC
  // `[Talon/Mystic Mark-1]`. These don't fit the `[Kind:content]` grammar, so
  // they're matched separately (in left-to-right order). Each is inert until
  // matched to a declared resource at the render layer.
  tags.push(...extractResourceOps(text));
  tags.push(...extractListOps(text));

  return tags;
}

/** Split on `|` outside a `[[wikilink]]` (whose own pipe is its alias). */
function splitPipes(content: string): string[] {
  return content
    .replace(/\[\[[^\]\n]*\]\]/g, (m) => m.replace(/\|/g, "\uE000"))
    .split("|")
    .map((part) => part.replace(/\uE000/g, "|").trim());
}

const FOE_STATES = /^(dead|fled|defeated|unconscious|down|surrendered)$/i;

/**
 * `[F:Fat [[Kobold, A]]|HP 9]` — a foe and its tags. HP is read out of them:
 * `HP 9` sets it (`HP 9/12` with its max), `HP-5` / `HP+3` moves it; an end
 * state (`dead`, `fled`, …) is noted. Every tag is kept as written too.
 */
function parseFoeTag(content: string, isRef: boolean): PersistentTag {
  const [name, ...rest] = splitPipes(content);
  const tag: Extract<PersistentTag, { kind: "foe" }> = { kind: "foe", name, tags: rest.filter(Boolean) };
  if (isRef) tag.ref = true;
  for (const t of tag.tags) {
    const delta = t.match(/^HP\s*([+-])\s*(\d+)$/i);
    const set = t.match(/^HP\s*:?\s*(\d+)(?:\s*\/\s*(\d+))?$/i);
    if (delta) tag.hp = { delta: parseInt(delta[2], 10) * (delta[1] === "-" ? -1 : 1) };
    else if (set) tag.hp = { set: parseInt(set[1], 10), ...(set[2] ? { max: parseInt(set[2], 10) } : {}) };
    else if (FOE_STATES.test(t)) tag.state = t.toLowerCase();
  }
  return tag;
}

/** A square named like a chessboard (`C4`, `AA10`), or a hex in parentheses (`(2,-1)`). */
const SQUARE = "(?:[A-Za-z]{1,2}\\d{1,3}|\\(\\s*-?\\d+\\s*,\\s*-?\\d+\\s*\\))";

/** A place as the map code reads it: squares upper-cased, hexes closed up (`(2,-1)`). */
const place = (s: string) => (s.startsWith("(") ? s.replace(/\s+/g, "") : s.toUpperCase());

/** `[Pos: Talon C4; [[Kobold, Elite]] H2]` — each entry a name, then its square. */
function parsePositionTag(content: string): PersistentTag {
  const entries = splitEntries(content).flatMap((part) => {
    const m = part.match(new RegExp(`^(.+?)\\s+(${SQUARE})$`));
    return m ? [{ name: m[1].trim(), at: place(m[2]) }] : [];
  });
  return { kind: "position", entries };
}

/**
 * `[Mv: E3]`, `[Mv: G4>F4>E4]`, `[Mv: Lilith D5]` — an optional name, then the
 * route to where it stops. Null when no square ends it.
 */
function parseMoveTag(content: string): PersistentTag | null {
  // `… | teleport`: how it goes, when not on foot (a travel map draws it apart).
  const [main, ...mods] = content.split("|");
  const via = mods[0]?.trim().toLowerCase();
  // A route may be spaced (`G4 > F4`); close it up so it can't read as a name.
  const text = main
    .trim()
    .replace(/\s*>\s*/g, ">")
    .replace(/\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)/g, "($1,$2)");
  const m = text.match(new RegExp(`^(?:(.+?)\\s+)?(${SQUARE}(?:>${SQUARE})*)$`));
  if (!m) return null;
  const path = m[2].split(">").map(place);
  return { kind: "move", ...(m[1] ? { who: m[1].trim() } : {}), path, ...(via ? { via } : {}) };
}

/** Names in a group tag: split on `,` or `;`. */
function memberList(text: string): string[] {
  return text
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** `[Group: …]` — see `GroupTag`. Null when it reads as none of its verbs. */
function parseGroupTag(content: string): PersistentTag | null {
  const t = content.trim();
  let m = t.match(/^(.+?)\s*>\s*(.+?)\s*=\s*(.+)$/);
  if (m) return { kind: "group", op: "split", group: m[1], to: m[2], members: memberList(m[3]) };
  m = t.match(/^(.+?)\s*=\s*(.+)$/);
  if (m) return { kind: "group", op: "define", group: m[1], members: memberList(m[2]) };
  m = t.match(/^(.+?)\s*>\s*(.+)$/);
  if (m) return { kind: "group", op: "merge", group: m[1], to: m[2] };
  m = t.match(/^(.+?)\s+as\s+(.+)$/i);
  if (m) return { kind: "group", op: "rename", group: m[1], to: m[2] };
  m = t.match(/^(.+?)\s+([+-])\s*(.+)$/);
  if (m) return { kind: "group", op: m[2] === "+" ? "add" : "remove", group: m[1], members: memberList(m[3]) };
  return null;
}

/** `[Mark: Name|spec@(q,r)|until …]`, `[Mark: Name|@(q,r)]`, `[Mark: -Name]`. */
function parseMarkTag(content: string): PersistentTag | null {
  const [head, ...rest] = content.split("|").map((s) => s.trim());
  if (!head) return null;
  if (head.startsWith("-")) return { kind: "mark", name: head.slice(1).trim(), end: true };
  const mark: Extract<PersistentTag, { kind: "mark" }> = { kind: "mark", name: head };
  for (const part of rest) {
    const until = part.match(/^until\s+(.+)$/i);
    if (until) {
      mark.until = until[1].trim();
      continue;
    }
    const at = part.match(/^(.*?)@\s*\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)$/);
    if (at) {
      if (at[1].trim()) mark.spec = at[1].trim();
      mark.at = [parseFloat(at[2]), parseFloat(at[3])];
    } else if (!mark.spec) mark.spec = part;
  }
  return mark;
}

/** Split on `;` outside a `[[wikilink]]`. */
export function splitEntries(content: string): string[] {
  return content
    .replace(/\[\[[^\]\n]*\]\]/g, (m) => m.replace(/;/g, "\uE001"))
    .split(";")
    .map((part) => part.replace(/\uE001/g, ";").trim())
    .filter(Boolean);
}

/**
 * `[Init: Talon 17; [[Kobold, Elite]] 12; Lilith d20+1=9]` — entries split on
 * `;` (names carry commas), each a name then its value: a number, or a written
 * roll whose total follows its `=`. A leading `+` / `-` adds or removes.
 *
 * An entry may end with where that combatant starts on the battle map —
 * `Talon d20+[[Initiative]]=14 @J14` — so a fight is placed in the same list,
 * in the same order, as it's rolled; and with an emoji for its token in this
 * fight — `Fat [[Kobold, A]] 9 @F7 🐸` — over the one its page sets.
 */
/** One `[Init:]` entry, as written: `Fat [[Kobold, A]] d20+[[Initiative]]=9 @F7 🐸`. */
export function parseInitEntry(written: string): InitiativeEntry {
  // The trailing extras, in either order: `@F7 🐸` or `🐸 @F7`.
  let part = written.trim();
  const extras: { at?: string; icon?: string } = {};
  for (let more = true; more; ) {
    more = false;
    const square = !extras.at && part.match(/\s+@\s*([A-Za-z]{1,2}\d{1,3})$/);
    if (square) {
      extras.at = square[1].toUpperCase();
      part = part.slice(0, square.index).trim();
      more = true;
    }
    const emoji = !extras.icon && part.match(TRAILING_EMOJI);
    if (emoji) {
      extras.icon = emoji[1];
      part = part.slice(0, emoji.index).trim();
      more = true;
    }
  }
  const at = extras.at ? { at: extras.at } : {};
  const icon = extras.icon ? { icon: extras.icon } : {};
  const m = part.match(/^(.+?)\s+(?:(\d*d[\d%F]\S*?=)\s*)?(-?\d+)$/i);
  if (!m) return { name: part, ...at, ...icon };
  return { name: m[1].trim(), value: parseInt(m[3], 10), ...(m[2] ? { roll: m[2] } : {}), ...at, ...icon };
}

/** An emoji (with its modifiers, or a ZWJ sequence) at the end, after a space. */
const TRAILING_EMOJI =
  /\s+(\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier}|\u200D\p{Extended_Pictographic}\uFE0F?)*)$/u;

function parseInitiativeTag(content: string): InitiativeTag {
  const opMatch = content.match(/^\s*([+-])/);
  const op = opMatch ? (opMatch[1] === "+" ? "add" : "remove") : "set";
  const body = opMatch ? content.slice(opMatch[0].length) : content;
  const entries: InitiativeEntry[] = splitEntries(body).map(parseInitEntry);
  return { kind: "initiative", op, entries };
}

/** An item name as written — a `[[wikilink]]` is read as its note name. */
function itemName(raw: string, tag: InventoryTag): string {
  const t = raw.trim();
  const link = t.match(/^\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]$/);
  if (!link) return t;
  tag.link = true;
  return link[1].trim();
}

function parseInventoryTag(content: string, isRef: boolean): InventoryTag {
  const tag: InventoryTag = { kind: "inventory", name: "", ref: isRef, props: [] };

  // An owner prefix, `[Inv:Talon/Rope+1]` — the same `Character/` addressing as
  // a PC resource op. Without one, the item belongs to whoever acts on the line.
  // Containers it's put in follow, one `/` each, the item last:
  // `[Inv:Kowyn's Bag/[[Pouch]]/[[Sling bullets]]+15]` (a `/` inside a
  // `[[link]]` is the link's own).
  const segments = content
    .replace(/\[\[[^\]\n]*\]\]/g, (m) => m.replace(/\//g, "\uE001"))
    .split("/")
    .map((x) => x.replace(/\uE001/g, "/"));
  if (segments.length > 1) {
    const plain = (x: string) =>
      x
        .trim()
        .replace(/^\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]$/, "$1")
        .trim();
    tag.owner = plain(segments[0]);
    const path = segments.slice(1, -1).map(plain).filter(Boolean);
    if (path.length > 0) tag.path = path;
    content = segments[segments.length - 1];
  }

  // Check for delta shorthand: [Inv:Item+N] or [Inv:Item-N]
  const deltaMatch = content.match(/^(.+?)([+-])(\d+)$/);
  if (deltaMatch) {
    tag.name = itemName(deltaMatch[1], tag);
    tag.delta = parseInt(deltaMatch[3], 10) * (deltaMatch[2] === "-" ? -1 : 1);
    return tag;
  }

  // Split on pipes outside a wikilink (`[[Rope|rope]]|3` is the link, then 3).
  const parts = content
    .replace(/\[\[[^\]\n]*\]\]/g, (m) => m.replace(/\|/g, "\uE000"))
    .split("|")
    .map((s) => s.replace(/\uE000/g, "|").trim());
  tag.name = itemName(parts[0], tag);

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];

    // Quantity transition: 3→2 or 3->2
    const transMatch = part.match(/^(\d+)\s*(?:→|->)\s*(\d+)$/);
    if (transMatch) {
      tag.transition = { from: parseInt(transMatch[1], 10), to: parseInt(transMatch[2], 10) };
      continue;
    }

    // Plain quantity
    if (/^\d+$/.test(part)) {
      tag.quantity = parseInt(part, 10);
      continue;
    }

    // Depleted marker
    if (part.toLowerCase() === "depleted") {
      tag.depleted = true;
      continue;
    }

    // Everything else is a property
    tag.props.push(part);
  }

  return tag;
}

function parseWealthTag(content: string): WealthTag[] {
  const tags: WealthTag[] = [];
  const entries = content.split("|").map((s) => s.trim());

  for (const entry of entries) {
    // Delta: Gold+15 or Gold-8
    const deltaMatch = entry.match(/^(.+?)([+-])(\d+)$/);
    if (deltaMatch) {
      tags.push({
        kind: "wealth",
        currency: deltaMatch[1].trim(),
        delta: parseInt(deltaMatch[3], 10) * (deltaMatch[2] === "-" ? -1 : 1),
      });
      continue;
    }

    // Transition: Gold 45→52 or Gold 45->52
    const transMatch = entry.match(/^(.+?)\s+(\d+)\s*(?:→|->)\s*(\d+)$/);
    if (transMatch) {
      tags.push({
        kind: "wealth",
        currency: transMatch[1].trim(),
        transition: { from: parseInt(transMatch[2], 10), to: parseInt(transMatch[3], 10) },
      });
      continue;
    }

    // Absolute: Gold 45
    const absMatch = entry.match(/^(.+?)\s+(\d+)$/);
    if (absMatch) {
      tags.push({ kind: "wealth", currency: absMatch[1].trim(), amount: parseInt(absMatch[2], 10) });
      continue;
    }

    // Just a name (no amount)
    if (entry.trim()) {
      tags.push({ kind: "wealth", currency: entry.trim() });
    }
  }

  return tags;
}

function parseRoomTag(content: string, isRef: boolean): RoomTag {
  const tag: RoomTag = { kind: "room", id: "", ref: isRef };

  const parts = content.split("|").map((s) => s.trim());
  tag.id = parts[0];

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];

    // Exits field: "exits N:R2, E:R3"
    if (part.toLowerCase().startsWith("exits ") || part.toLowerCase().startsWith("exits:")) {
      const exitsStr = part.replace(/^exits[\s:]+/i, "");
      tag.exits = exitsStr
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean);
      continue;
    }

    // First non-exits field after ID is status
    if (!tag.status) {
      tag.status = part;
      continue;
    }

    // Second non-exits field is description
    if (!tag.description) {
      tag.description = part;
      continue;
    }
  }

  return tag;
}
