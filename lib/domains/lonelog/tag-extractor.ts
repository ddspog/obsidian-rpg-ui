import type { PersistentTag, DialOpTag, ListOpTag, InventoryTag, WealthTag, RoomTag } from "./types";

/** Kinds recognized by the tag grammar — shared by extraction and stripping. */
const TAG_KINDS = "N|L|E|Clock|Track|Dial|Timer|Thread|PC|F|Faction|Party|Inv|Wealth|R";

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
  const re = new RegExp(`\\[(?:#)?(?:${TAG_KINDS}):[^\\]]+\\]`, "g");
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
  const tagRegex = /\[(?:#)?(N|L|E|Clock|Track|Dial|Timer|Thread|PC|F|Faction|Party|Inv|Wealth|R):([^\]]+)\]/g;

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
        const parts = content.split("|").map((s) => s.trim());
        const name = parts[0];
        const tagList = parts.slice(1).filter(Boolean);
        tags.push({ kind: "foe", name, tags: tagList });
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

function parseInventoryTag(content: string, isRef: boolean): InventoryTag {
  const tag: InventoryTag = { kind: "inventory", name: "", ref: isRef, props: [] };

  // Check for delta shorthand: [Inv:Item+N] or [Inv:Item-N]
  const deltaMatch = content.match(/^(.+?)([+-])(\d+)$/);
  if (deltaMatch) {
    tag.name = deltaMatch[1].trim();
    tag.delta = parseInt(deltaMatch[3], 10) * (deltaMatch[2] === "-" ? -1 : 1);
    return tag;
  }

  const parts = content.split("|").map((s) => s.trim());
  tag.name = parts[0];

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
