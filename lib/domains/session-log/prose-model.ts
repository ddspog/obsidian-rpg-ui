/**
 * Prose Model
 *
 * Transforms grouped lonelog segments into the structures the "prose mode"
 * reading view renders:
 *   - `assembleProse` → scenes of narration / dialogue / joined conclusions,
 *     hiding the mechanical machinery (rolls, oracles, tables, markers).
 *   - `buildSidebarItems` → the mechanical entries surfaced in the right rail.
 *   - `laneForSpeaker` → a deterministic horizontal lane per chat interlocutor.
 *
 * Provenance: every conclusion fragment, dialogue node and sidebar item carries
 * the same `sourceId` (the segment's `sourceIndex`), so the prose dot, the
 * sidebar card and the scroll target all reference one shared id.
 */

import { parseSceneMarker } from "lib/domains/lonelog/parser";
import type { RollEntry, PersistentTag } from "lib/domains/lonelog/types";
import type { ProseSegment } from "./prose-grouper";
import { summarizeRoll } from "./prose-grouper";

export interface ProseFragment {
  /** Story-facing narration (raw markdown — wikilinks resolve at render time). */
  text: string;
  /** Provenance id linking this fragment's dot to its sidebar card / source. */
  sourceId: number;
}

export interface ProseSceneHead {
  number: string;
  context: string;
  /** Set when the scene was opened by a `=> S## Title` consequence (gets a dot). */
  sourceId?: number;
  fromConsequence: boolean;
}

export type ProseNode =
  | { kind: "paragraph"; fragments: ProseFragment[] }
  | { kind: "narration"; text: string; sourceId: number }
  | { kind: "dialogue"; speaker: string; speakerType: "pc" | "npc"; text: string; sourceId: number };

export interface ProseScene {
  head: ProseSceneHead | null;
  nodes: ProseNode[];
}

/**
 * Build the prose-mode scene list from grouped segments. Conclusions become
 * dotted fragments; `++` joins consecutive conclusions into one paragraph; a
 * scene-shaped conclusion (`=> S## Title`) opens a new scene carrying a dot.
 */
export function assembleProse(segments: ProseSegment[]): ProseScene[] {
  const scenes: ProseScene[] = [];
  let current: ProseScene = { head: null, nodes: [] };
  let lastParagraph: Extract<ProseNode, { kind: "paragraph" }> | null = null;
  let joinNext = false;

  const flushScene = () => {
    if (current.head || current.nodes.length > 0) scenes.push(current);
  };

  const startScene = (head: ProseSceneHead) => {
    flushScene();
    current = { head, nodes: [] };
    lastParagraph = null;
    joinNext = false;
  };

  const addFragment = (fragment: ProseFragment) => {
    if (joinNext && lastParagraph) {
      lastParagraph.fragments.push(fragment);
    } else {
      lastParagraph = { kind: "paragraph", fragments: [fragment] };
      current.nodes.push(lastParagraph);
    }
    joinNext = false;
  };

  // A consequence's conclusion either opens a scene or contributes a fragment.
  const consumeConclusion = (conclusion: string | undefined, sourceId: number) => {
    const text = (conclusion ?? "").trim();
    if (!text) return; // tag-only consequence → nothing reaches prose
    const scene = parseSceneMarker(text);
    if (scene) {
      startScene({ number: scene.number, context: scene.context, sourceId, fromConsequence: true });
      return;
    }
    addFragment({ text, sourceId });
  };

  const breakFlow = () => {
    lastParagraph = null;
    joinNext = false;
  };

  for (const seg of segments) {
    switch (seg.type) {
      case "scene":
        startScene({ number: seg.entry.number, context: seg.entry.context, fromConsequence: false });
        break;

      case "concat":
        joinNext = true;
        break;

      case "action-group":
      case "world-event":
        for (const c of seg.consequences) consumeConclusion(c.conclusion, seg.sourceIndex);
        break;

      case "oracle":
        for (const c of seg.consequences) consumeConclusion(c.conclusion, seg.sourceIndex);
        break;

      case "standalone-consequence":
        consumeConclusion(seg.entry.conclusion, seg.sourceIndex);
        break;

      case "dialogue":
        current.nodes.push({
          kind: "dialogue",
          speaker: seg.entry.speaker,
          speakerType: seg.entry.speakerType,
          text: seg.entry.text,
          sourceId: seg.sourceIndex,
        });
        breakFlow();
        break;

      case "narrative":
        current.nodes.push({ kind: "narration", text: seg.entry.text, sourceId: seg.sourceIndex });
        breakFlow();
        break;

      default:
        // rolls, tables, generators, meta, and structural markers are
        // mechanical-only — they appear in the sidebar, never in prose.
        break;
    }
  }

  flushScene();
  return scenes;
}

/**
 * Deterministic horizontal lane (0–1) for a chat interlocutor, derived from
 * the speaker name so a given character always sits in the same lane within a
 * block. Kept clear of the extreme edges.
 */
export function laneForSpeaker(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) % 100000;
  }
  const t = h / 100000; // [0, 1)
  return 0.08 + t * 0.84; // [0.08, 0.92)
}

export type SidebarItemKind =
  | "action"
  | "world-event"
  | "oracle"
  | "consequence"
  | "roll"
  | "table"
  | "generator"
  | "meta";

/**
 * One tag in an entry's top "dateline" strip (e.g. `CF 5`, `Goblin: dead`). The
 * `name` is the key (rendered as a muted small-caps caption in the category's
 * hue); the optional `value` is the state/number (rendered emphasized).
 */
export interface SidebarPill {
  name: string;
  value?: string;
  kind: string;
}

/**
 * The icon shown in a row's first column: a short glyph (`?`, `@`, `!`, `d`), a
 * named lucide icon (for `gen`, `tbl`, `=>`, `->`), or none (continuation rows).
 */
export type RowIcon = { glyph: string } | { lucide: string } | null;

/**
 * A scene-shaped consequence (`=> S## Name`) surfaced as an editable row:
 * `Start Scene(NN): "Name"`. Edits are written back to the `=>` source line.
 */
export interface SceneRowData {
  /** The raw consequence text (after `=>`) — used to locate the source line. */
  original: string;
  /** Scene number without a leading "S" (e.g. "01"). */
  number: string;
  /** Scene name / context. */
  name: string;
  /** Whether the number carried a leading "S" (re-added on save). */
  hadS: boolean;
}

export interface SidebarRow {
  icon: RowIcon;
  /** Markdown — wikilinks resolve at render time. Empty when `scene` drives the row. */
  content: string;
  pills: SidebarPill[];
  /** When set, the row renders editable scene inputs instead of `content`. */
  scene?: SceneRowData;
  /** Indented working/detail line (rendered as a nested bullet). */
  detail?: boolean;
  /** The `label:` prefix of a detail line, styled apart from its content. */
  label?: string;
  /** The raw (trimmed) source line — used to write inline die-value edits back. */
  source?: string;
}

/** Rebuild the `=> ` text for an edited scene (re-adding the "S" prefix when it was present). */
export function reconstructScene(number: string, name: string, hadS: boolean): string {
  const num = `${hadS ? "S" : ""}${number}`.trim();
  const label = name.trim();
  return label ? `${num} ${label}` : num;
}

/**
 * Apply scene-line edits to a note's raw markdown. In the first `rpg log` code
 * block, each `=> <from>` line is rewritten to `=> <to>` (matched by the text
 * after `=>`, indentation preserved). Header-agnostic: a YAML header, if any,
 * is left untouched because its lines never match a `=>` line. Returns the
 * content unchanged when there's no block or nothing matched.
 */
export function applySceneEdits(content: string, replacements: Array<{ from: string; to: string }>): string {
  if (replacements.length === 0) return content;
  const codeBlockRegex = /(```rpg log\n)([\s\S]*?)(```)/;
  const match = content.match(codeBlockRegex);
  if (!match) return content;

  const [, fence, blockContent, closing] = match;
  const lines = blockContent.split("\n");
  for (const { from, to } of replacements) {
    const idx = lines.findIndex((line) => line.trim().replace(/^=>\s*/, "") === from);
    if (idx >= 0) {
      const indent = lines[idx].match(/^\s*/)?.[0] ?? "";
      lines[idx] = `${indent}=> ${to}`;
    }
  }

  const updatedBlock = `${fence}${lines.join("\n")}${closing}`;
  return content.replace(codeBlockRegex, () => updatedBlock);
}

/**
 * Rewrite inline tokens (a die's `d10=8`, a threshold's `CF 5`) on matched lines
 * of the first `rpg log` code block. Each edit locates a body line by its trimmed
 * text and swaps the first occurrence of `from` for `to`; edits sharing a line
 * are applied together (so editing two tokens on one line both land), leaving
 * indentation and the rest of the line intact. Unchanged when nothing matched.
 */
export function applyTokenEdits(content: string, edits: Array<{ line: string; from: string; to: string }>): string {
  if (edits.length === 0) return content;
  const codeBlockRegex = /(```rpg log\n)([\s\S]*?)(```)/;
  const match = content.match(codeBlockRegex);
  if (!match) return content;

  const [, fence, blockContent, closing] = match;
  const lines = blockContent.split("\n");
  // Group by target line so several token swaps on one line all apply (each is
  // matched against the original line text before any swap changes it).
  const byLine = new Map<string, Array<{ from: string; to: string }>>();
  for (const { line, from, to } of edits) {
    const swaps = byLine.get(line) ?? [];
    swaps.push({ from, to });
    byLine.set(line, swaps);
  }
  for (const [line, swaps] of byLine) {
    const idx = lines.findIndex((l) => l.trim() === line);
    if (idx < 0) continue;
    let updated = lines[idx];
    for (const { from, to } of swaps) {
      if (updated.includes(from)) updated = updated.replace(from, to);
    }
    lines[idx] = updated;
  }

  const updatedBlock = `${fence}${lines.join("\n")}${closing}`;
  return content.replace(codeBlockRegex, () => updatedBlock);
}

export interface SidebarItem {
  /** Shared provenance id (segment.sourceIndex). */
  id: number;
  kind: SidebarItemKind;
  /** One row per source line: icon | content | pills. */
  rows: SidebarRow[];
}

function rollLine(roll: { roll: string; result: string; actor?: string }): string {
  const actor = roll.actor ? `${roll.actor}: ` : "";
  const result = roll.result ? ` → ${roll.result}` : "";
  return `${actor}${roll.roll}${result}`;
}

/** Stable key for a formula result edit (the text after `->` on a source line). */
export function resultEditKey(source: string): string {
  return `${source} #result`;
}

/** Stable key for one die-value edit slot: source line + die raw + slot index. */
export function dieEditKey(source: string, raw: string, slot: number): string {
  return `${source} ${raw} #${slot}`;
}

/** A persistent tag split into a key (`name`) and an optional state (`value`). */
function tagPill(tag: PersistentTag): SidebarPill {
  switch (tag.kind) {
    case "npc":
    case "foe":
      return { name: tag.name, value: tag.tags.length ? tag.tags.join(", ") : undefined, kind: tag.kind };
    case "location":
      return { name: tag.name, kind: tag.kind };
    case "pc":
      return { name: tag.name, value: tag.changes.length ? tag.changes.join(", ") : undefined, kind: tag.kind };
    case "clock":
    case "event":
    case "track":
      return { name: tag.name, value: `${tag.current}/${tag.max}`, kind: tag.kind };
    case "timer":
      return { name: tag.name, value: String(tag.value), kind: tag.kind };
    case "thread":
      return { name: tag.name, value: tag.state, kind: tag.kind };
    case "inventory":
      return { name: tag.name, kind: tag.kind };
    case "wealth":
      return { name: tag.currency, kind: tag.kind };
    case "room":
      return { name: `R${tag.id}`, kind: tag.kind };
  }
}

const rollRow = (r: RollEntry): SidebarRow => ({ icon: { glyph: "d" }, content: rollLine(r), pills: [] });

// Indented working lines become nested bullet rows. A leading `label:` prefix
// (e.g. "Alterations: d10=8 …") is split out so it can be styled apart.
const continuationRows = (extras: string[]): SidebarRow[] =>
  extras.map((text) => {
    const m = text.match(/^([A-Za-z][\w ]*?):\s+(.+)$/);
    return m
      ? { icon: null, content: m[2], label: m[1], detail: true, pills: [], source: text }
      : { icon: null, content: text, detail: true, pills: [], source: text };
  });
const consequenceRow = (c: { conclusion?: string; text: string; tags: PersistentTag[] }): SidebarRow => {
  const conclusion = c.conclusion || c.text;
  const scene = parseSceneMarker(conclusion);
  if (scene) {
    const hadS = /^s/i.test(scene.number);
    const number = hadS ? scene.number.slice(1) : scene.number;
    return {
      icon: { lucide: "CornerDownRight" },
      content: `Start Scene(${number}): "${scene.context}"`,
      pills: [],
      scene: { original: c.text, number, name: scene.context, hadS },
    };
  }
  return {
    icon: { lucide: "CornerDownRight" },
    content: conclusion,
    pills: c.tags.map(tagPill).filter((p) => p.name),
  };
};

/**
 * The mechanical entries surfaced in the right-rail "Log" sidebar — every `@` /
 * `!` / `?` and the other special stuff (rolls, tables, generators, meta, bare
 * consequences). Each entry becomes a small table: one row per source line
 * (icon | content | pills). Dialogue, narration and scene headers are the prose
 * itself and are intentionally excluded.
 */
export function buildSidebarItems(segments: ProseSegment[]): SidebarItem[] {
  const items: SidebarItem[] = [];

  for (const seg of segments) {
    const id = seg.sourceIndex;
    const extras = seg.continuations ?? [];

    switch (seg.type) {
      case "action-group": {
        const actor = seg.action.actor
          ? `${seg.action.actor}${seg.action.assist ? ` > ${seg.action.assist}` : ""}: `
          : "";
        items.push({
          id,
          kind: "action",
          rows: [
            { icon: { glyph: "@" }, content: `${actor}${seg.action.text}`, pills: [] },
            ...seg.rolls.map(rollRow),
            ...continuationRows(extras),
            ...seg.consequences.map(consequenceRow),
          ],
        });
        break;
      }

      case "world-event":
        items.push({
          id,
          kind: "world-event",
          rows: [
            {
              icon: { glyph: "!" },
              content: seg.entry.text,
              pills: seg.entry.tags.map(tagPill).filter((p) => p.name),
            },
            ...seg.rolls.map(rollRow),
            ...continuationRows(extras),
            ...seg.consequences.map(consequenceRow),
          ],
        });
        break;

      case "oracle": {
        const actor = seg.question.actor ? `(${seg.question.actor}) ` : "";
        const headPills: SidebarPill[] =
          seg.question.chaosFactor != null ? [{ name: "CF", value: String(seg.question.chaosFactor), kind: "cf" }] : [];
        const rows: SidebarRow[] = [
          { icon: { glyph: "?" }, content: `${actor}${seg.question.text}`, pills: headPills },
        ];
        if (seg.answer) {
          rows.push({
            icon: { lucide: "ArrowRight" },
            content: `${seg.answer.text}${seg.answer.roll ? ` (${seg.answer.roll})` : ""}`,
            pills: [],
          });
        }
        for (const g of seg.generators) {
          rows.push({ icon: { lucide: "Sprout" }, content: `${g.source}${g.result ? ` ${g.result}` : ""}`, pills: [] });
        }
        for (const t of seg.tables) {
          rows.push({ icon: { lucide: "Table" }, content: `${t.source} ${t.roll} → ${t.result}`.trim(), pills: [] });
        }
        rows.push(...seg.rolls.map(rollRow));
        rows.push(...continuationRows(extras));
        rows.push(...seg.consequences.map(consequenceRow));
        items.push({ id, kind: "oracle", rows });
        break;
      }

      case "standalone-consequence":
        items.push({
          id,
          kind: "consequence",
          rows: [consequenceRow(seg.entry), ...continuationRows(extras)],
        });
        break;

      case "standalone-roll":
        items.push({ id, kind: "roll", rows: [rollRow(seg.entry), ...continuationRows(extras)] });
        break;

      case "standalone-table":
        items.push({
          id,
          kind: "table",
          rows: [
            {
              icon: { lucide: "Table" },
              content: `${seg.entry.source} ${seg.entry.roll} → ${seg.entry.result}`.trim(),
              pills: [],
            },
            ...continuationRows(extras),
          ],
        });
        break;

      case "standalone-generator":
        items.push({
          id,
          kind: "generator",
          rows: [
            {
              icon: { lucide: "Sprout" },
              content: `${seg.entry.source}${seg.entry.result ? ` ${seg.entry.result}` : ""}`,
              pills: [],
            },
            ...continuationRows(extras),
          ],
        });
        break;

      case "meta":
        items.push({
          id,
          kind: "meta",
          rows: [{ icon: { glyph: "※" }, content: seg.entry.text, pills: [] }, ...continuationRows(extras)],
        });
        break;

      default:
        // scenes, dialogue, narration, concat, structural markers, rounds
        break;
    }
  }

  return items;
}

// Re-export so the prose view can summarize rolls from one module.
export { summarizeRoll };
