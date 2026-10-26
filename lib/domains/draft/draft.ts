/**
 * `rpg draft` — a GM's scratchpad for an adventure (design: docs/draft-block.md).
 * Its head says what's gathered: the GM Screen whose cards and generators it
 * rolls, a map and the hexes picked on it, notes attached (statblocks, items,
 * places), and what to ask an LLM for. Its body is free text: ideas, and the
 * lines rolled from cards and tables. Copy prompt puts all of it, the hexes
 * described and the notes summarised, into one prompt for an LLM.
 *
 *   ```rpg draft
 *   draft: Ambush on the woods road
 *   gm: "[[00. GM Screen]]"
 *   map: "[[Pointy Woods]]"
 *   level: 2
 *   hexes: [[33, -51], [34, -51]]
 *   attach: ["[[Kobold]]", "[[Kowyn's Bag]]"]
 *   ask: encounter
 *   ---
 *   The kobold cult tracks Kowyn through the woods.
 *   gen: Random Event
 *     Event Focus: d100=37 -> NPC Action
 *   ```
 */

import { parseDocument } from "yaml";

export interface DraftBlock {
  title?: string;
  gm?: string;
  map?: string;
  /** The map's level the hexes are on (0: its main map). */
  level: number;
  hexes: Array<[number, number]>;
  attach: string[];
  ask?: DraftAsk;
  body: string;
}

/** What the prompt asks the LLM to make. */
export type DraftAsk = "encounter" | "statblock" | "npc" | "place" | "region" | "item" | "scene" | "free";

export const DRAFT_ASKS: Array<{ value: DraftAsk; label: string; instruction: string }> = [
  {
    value: "encounter",
    label: "Encounter",
    instruction:
      "Design an encounter that fits the place, the rolls and the ideas: what the party meets, why it's there, how it can go (fight, talk, avoid), the terrain's part in it, and what it leads to. Give foes as short statblock references or full statblocks when none fits.",
  },
  {
    value: "statblock",
    label: "Statblock",
    instruction:
      "Write a statblock for the creature these notes describe, in the same system and style as the attached statblocks: size, type, AC, HP, speed, abilities, traits, actions, and a few lines of how it fights.",
  },
  {
    value: "npc",
    label: "NPC",
    instruction:
      "Create an NPC from these notes: name, look, manner, what they want and fear, what they know, how they react to the party, and a line or two they might say.",
  },
  {
    value: "place",
    label: "Place",
    instruction:
      "Describe a place at the picked hexes: what it looks like from afar and up close, who and what is there, its history in a few lines, hooks and dangers, and what can be found.",
  },
  {
    value: "region",
    label: "Region",
    instruction:
      "Describe the region these hexes make up: its terrain and climate, its people and creatures, its notable places (one per picked hex where it makes sense), its dangers and its conflicts.",
  },
  {
    value: "item",
    label: "Item",
    instruction:
      "Create an item from these notes, in the same system and style as the attached items: name, type, rarity, properties, what it does, its story, and a drawback or quirk.",
  },
  {
    value: "scene",
    label: "Scene",
    instruction:
      "Turn the rolls and ideas into the next scene: its opening image, what's at stake, two or three ways it can unfold, and what the GM should be ready to roll.",
  },
  { value: "free", label: "Free", instruction: "Help the GM with what the notes ask for." },
];

const ASK_VALUES = new Set<string>(DRAFT_ASKS.map((a) => a.value));

const link = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);

/** The block's text read: its head (above `---`) and its body. */
export function parseDraftBlock(source: string): DraftBlock {
  const lines = source.split("\n");
  const sep = lines.findIndex((l) => l.trim() === "---");
  const headText = (sep >= 0 ? lines.slice(0, sep) : lines).join("\n");
  const body = sep >= 0 ? lines.slice(sep + 1).join("\n") : "";
  let head: Record<string, unknown> = {};
  try {
    const parsed = parseDocument(headText).toJS();
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) head = parsed as Record<string, unknown>;
  } catch {
    head = {};
  }
  const hexes: Array<[number, number]> = [];
  for (const h of Array.isArray(head.hexes) ? head.hexes : []) {
    const pair = Array.isArray(h) ? h : typeof h === "string" ? h.replace(/[()[\]]/g, "").split(",") : [];
    const [q, r] = pair.map((n: unknown) => parseInt(String(n), 10));
    if (Number.isFinite(q) && Number.isFinite(r)) hexes.push([q, r]);
  }
  const attach = (Array.isArray(head.attach) ? head.attach : head.attach ? [head.attach] : [])
    .map(link)
    .filter((a): a is string => !!a);
  const ask = typeof head.ask === "string" && ASK_VALUES.has(head.ask) ? (head.ask as DraftAsk) : undefined;
  const level = typeof head.level === "number" && head.level >= 0 ? Math.floor(head.level) : 0;
  return {
    title: link(head.draft) ?? link(head.title),
    gm: link(head.gm),
    map: link(head.map),
    level,
    hexes,
    attach,
    ...(ask ? { ask } : {}),
    body,
  };
}

/** A string as YAML writes it: plain when it can be, quoted when it must (links always are). */
function scalar(v: string): string {
  return /^[\w][\w ,.'’!?&-]*$/.test(v) && !/^(true|false|null|yes|no)$/i.test(v) ? v : JSON.stringify(v);
}

/** The block's text from a draft: its head in the order written above, then `---` and the body. */
export function formatDraftBlock(d: DraftBlock): string {
  const head = [`draft: ${scalar(d.title ?? "Untitled")}`];
  if (d.gm) head.push(`gm: ${JSON.stringify(d.gm)}`);
  if (d.map) head.push(`map: ${JSON.stringify(d.map)}`);
  if (d.map && d.level) head.push(`level: ${d.level}`);
  if (d.hexes.length) head.push(`hexes: [${d.hexes.map(([q, r]) => `[${q}, ${r}]`).join(", ")}]`);
  if (d.attach.length) head.push(`attach: [${d.attach.map((a) => JSON.stringify(a)).join(", ")}]`);
  if (d.ask) head.push(`ask: ${d.ask}`);
  return `${head.join("\n")}\n---\n${d.body.replace(/^\n+/, "")}`.replace(/\n+$/, "");
}

/**
 * A card's or generator's log template with every unrolled die rolled
 * (`d100=` → `d100=37`, `2d10=` → `2d10=[3,7]`), so the log's resolver can
 * fill in what the rolls mean.
 */
export function rollTemplate(template: string, rng: () => number = Math.random): string {
  return template.replace(/(^|[\s(])(\d*)d(\d+)=(?=$|[\s),])/gm, (_all, lead: string, count: string, sides: string) => {
    const n = Math.max(1, parseInt(count || "1", 10));
    const faces = Array.from({ length: n }, () => 1 + Math.floor(rng() * parseInt(sides, 10)));
    return `${lead}${count}d${sides}=${n === 1 ? faces[0] : `[${faces.join(",")}]`}`;
  });
}

/** A rolled table's line for the body: `table: Actions 1 (37) -> Abandon`. */
export function tableLine(name: string, result: string, roll?: number): string {
  return `table: ${name}${roll !== undefined ? ` (${roll})` : ""} -> ${result}`;
}

// The body is optional: an empty block must not run on into the next one.
const FENCE = /^(`{3,}|~{3,})\s*rpg\s+([\w.-]+)[^\n]*\n(?:([\s\S]*?)\n)??\1\s*$/gm;

/** A note made short enough for a prompt: its statblocks, items and features as their YAML, else its prose. */
export function summarizeNote(name: string, text: string, limit = 2400): string {
  const withoutFm = text.replace(/^---\n[\s\S]*?\n---\n?/, "");
  const blocks: string[] = [];
  for (const m of withoutFm.matchAll(FENCE)) {
    const entity = m[2];
    if (/^(stat\.|item\.|feature\.details|character\.header|character\.stats|spell)/.test(entity))
      blocks.push(`[${entity}]\n${(m[3] ?? "").trim()}`);
  }
  const prose = withoutFm
    .replace(FENCE, "")
    .replace(/!\[\[[^\]]*\]\]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  let out = blocks.length ? blocks.join("\n\n") : prose;
  if (blocks.length && prose) out += `\n\n${prose}`;
  if (out.length > limit) out = `${out.slice(0, limit).replace(/\s+\S*$/, "")} …`;
  return `### ${name}\n${out}`;
}

/** One picked hex, as the prompt describes it. */
export interface HexFact {
  q: number;
  r: number;
  terrain?: string;
  label?: string;
  link?: string;
  regions: string[];
  /** Markers and labels standing on it. */
  marks: string[];
}

export interface PromptContext {
  /** The note the block is in. */
  note: string;
  /** The map's name and the scale of the level the hexes are on. */
  map?: { name: string; scale?: string };
  hexes: HexFact[];
  attachments: Array<{ name: string; summary: string }>;
}

/** The prompt Copy puts on the clipboard. */
export function buildPrompt(d: DraftBlock, ctx: PromptContext): string {
  const ask = DRAFT_ASKS.find((a) => a.value === (d.ask ?? "free")) ?? DRAFT_ASKS[DRAFT_ASKS.length - 1];
  const parts: string[] = [];
  parts.push(
    "You are helping a game master prepare a tabletop RPG adventure. Use the notes below: they are the GM's own " +
      "ideas, random rolls from their GM tools (keep what the rolls decided), places on their map, and notes from " +
      "their compendium. Stay consistent with all of it."
  );
  parts.push(`## Task: ${ask.label}\n${ask.instruction}`);
  parts.push(`## Draft${d.title ? `: ${d.title}` : ""}\nFrom the note "${ctx.note}".`);
  const body = d.body.trim();
  if (body) parts.push(`## Ideas and rolls\n${body}`);
  if (ctx.map && ctx.hexes.length) {
    const lines = ctx.hexes.map((h) => {
      const bits = [
        h.terrain ? `terrain ${h.terrain}` : "no terrain",
        h.regions.length ? `in ${h.regions.join(", ")}` : "",
        h.label ? `"${h.label}"` : "",
        h.link ? `place [[${h.link}]]` : "",
        h.marks.length ? `marked ${h.marks.join("; ")}` : "",
      ].filter(Boolean);
      return `- (${h.q},${h.r}): ${bits.join(", ")}`;
    });
    parts.push(
      `## Map: ${ctx.map.name}${ctx.map.scale ? ` (1 hex = ${ctx.map.scale})` : ""}\nThe picked hexes, in axial coordinates (q,r):\n${lines.join("\n")}`
    );
  }
  if (ctx.attachments.length) parts.push(`## Attached notes\n${ctx.attachments.map((a) => a.summary).join("\n\n")}`);
  parts.push(
    "## Answer\nWrite it ready to paste into an Obsidian note: Markdown, with [[wikilinks]] for the people, places and " +
      "things that have (or should have) notes of their own."
  );
  return parts.join("\n\n");
}
