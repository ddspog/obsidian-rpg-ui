/**
 * Prepared encounters in a session log: an encounter readied from a party's
 * encounter catalog, waiting for the Start Combat card. One Lonelog tag:
 *
 *   [Enc:[[…/encounter-catalog/ashen-four#^forests-t1-9-8-baboon|8 Baboons]]|8 [[Baboon]]|prepared]
 *
 * the catalog entry's link (its block id), the foes as `count [[note]]` joined
 * by `; `, and a state. Starting a fight from it appends the same tag with
 * `fought S02` (on the fight's opening line), so the log stays append-only and
 * the prepared line reads as fought from then on. Pure: no Obsidian and no I/O.
 */

export type EncounterState = "prepared" | "fought";

export interface EncounterTag {
  /** The catalog entry's link as written: `[[path#^id|Name]]`. */
  link: string;
  /** The link's target: `path#^id`. */
  target: string;
  /** What the link shows (its alias), else the entry id. */
  name: string;
  /** The foes as written: `8 [[Baboon]]; [[Wolf, Dire]]`. */
  foes: string;
  state: EncounterState;
  /** The scene it was fought in (`S02`), when written. */
  scene?: string;
}

/** The catalog note and entry id a prepared encounter points at. */
export function catalogRefOf(target: string): { note: string; id: string } | null {
  const m = /^(.+?)#\^([\w-]+)$/.exec(target.trim());
  return m ? { note: m[1], id: m[2] } : null;
}

/** Reads the body of an `[Enc:…]` tag (what follows `Enc:`); null when it is not one. */
export function parseEncounterTag(body: string): EncounterTag | null {
  const link = /^\s*(\[\[[^\]]+\]\])/.exec(body);
  if (!link) return null;
  const rest = body
    .slice(link.index + link[0].length)
    .split("|")
    .map((s) => s.trim());
  // rest[0] is what came between the link and its first pipe (nothing).
  const [, foes = "", state = "prepared"] = rest;
  const inner = link[1].slice(2, -2);
  const [target, alias] = inner.split("|");
  const st = /^fought\b\s*(\S+)?/i.exec(state);
  return {
    link: link[1],
    target: target.trim(),
    name: (alias ?? catalogRefOf(target)?.id ?? target).trim(),
    foes,
    state: st ? "fought" : "prepared",
    ...(st?.[1] ? { scene: st[1] } : {}),
  };
}

/** The tag as written in the log. */
export function formatEncounterTag(tag: Pick<EncounterTag, "link" | "foes" | "state" | "scene">): string {
  const state = tag.state === "fought" ? `fought${tag.scene ? ` ${tag.scene}` : ""}` : "prepared";
  return `[Enc:${tag.link}|${tag.foes}|${state}]`;
}

/** Every `[Enc:…]` tag of a text, in order. */
export function encounterTagsIn(text: string): EncounterTag[] {
  const out: EncounterTag[] = [];
  // A body may hold [[links]]: match them whole, anything else up to the closing ].
  const re = /\[Enc:((?:\[\[[^\]]*\]\]|[^\]])*)\]/g;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const tag = parseEncounterTag(m[1]);
    if (tag) out.push(tag);
  }
  return out;
}

export interface PreparedEncounter extends EncounterTag {
  /** Fought later in the log (a fought tag with the same target): the scene, when it says. */
  foughtIn?: string;
  fought: boolean;
}

/** The encounters prepared in a log, each with whether a later fight used it; the latest last. */
export function preparedEncounters(text: string): PreparedEncounter[] {
  const tags = encounterTagsIn(text);
  const out: PreparedEncounter[] = [];
  tags.forEach((tag, i) => {
    if (tag.state !== "prepared") return;
    const later = tags.slice(i + 1).find((t) => t.state === "fought" && t.target === tag.target);
    out.push({ ...tag, fought: !!later, ...(later?.scene ? { foughtIn: later.scene } : {}) });
  });
  return out;
}

/** The foes of a prepared encounter as Start Combat's foe box takes them: one line each, numbered when many. */
export function foeLines(foes: string): string[] {
  const lines: string[] = [];
  for (const part of foes.split(";")) {
    const m = /^\s*(\d+)?\s*(.+?)\s*$/.exec(part);
    if (!m || !m[2]) continue;
    const count = Math.min(30, Math.max(1, m[1] ? Number(m[1]) : 1));
    for (let i = 1; i <= count; i++) lines.push(count === 1 ? m[2] : `${m[2]} ${i}`);
  }
  return lines;
}

/** The foes of a catalog entry as the tag writes them: `8 [[Baboon]]; [[Wolf, Dire]]`. */
export function foesText(monsters: Array<{ link: string; count: number }>): string {
  return monsters.map((m) => (m.count === 1 ? `[[${m.link}]]` : `${m.count} [[${m.link}]]`)).join("; ");
}

/** A note's text with `line` added at the end of its first `rpg log` block's body; null when it has none. */
export function appendToLog(note: string, line: string): string | null {
  const lines = note.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const open = /^(`{3,})\s*rpg\s+log\b/.exec(lines[i]);
    if (!open) continue;
    let close = i + 1;
    while (close < lines.length && !new RegExp(`^${open[1]}\\s*$`).test(lines[close])) close++;
    if (close >= lines.length) return null;
    let at = close;
    while (at > i + 1 && lines[at - 1].trim() === "") at--;
    lines.splice(at, 0, line);
    return lines.join("\n");
  }
  return null;
}

/** A note's text without the prepared line of this target (the first one still prepared); null when absent. */
export function removePrepared(note: string, target: string): string | null {
  const lines = note.split("\n");
  const at = lines.findIndex((l) => {
    const tag = encounterTagsIn(l)[0];
    return !!tag && tag.state === "prepared" && tag.target === target && l.trim().startsWith("[Enc:");
  });
  if (at < 0) return null;
  lines.splice(at, 1);
  return lines.join("\n");
}

/** The scene a log is in now: its last scene line (`=> S02 …`), as `S02`; undefined before the first. */
export function currentScene(text: string): string | undefined {
  let last: string | undefined;
  for (const m of text.matchAll(/^\s*=>\s*S(\d+[a-z]?)\b/gim)) last = `S${m[1]}`;
  return last;
}
