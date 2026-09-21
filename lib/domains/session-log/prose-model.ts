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
import { answerFateQuestion, fateThreshold } from "lib/domains/gm/fate-chart";
import { rolledValue } from "./formula";
import type { RollEntry, PersistentTag, OracleCallEntry } from "lib/domains/lonelog/types";
import type { ResolvedDialOp } from "lib/domains/lonelog/dial-ops";
import type { ResolvedListOp } from "lib/domains/lonelog/list-ops";
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
  | "dial"
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
  /** A consult pill's selectable entries — rendered as an inline picker so the
   *  reader can override the rolled result. */
  options?: string[];
  /** The raw token this pill came from (`[Characters?= Bertha]`), so a pick can
   *  be written back into the source line. */
  token?: string;
  /** The source line holding `token` (trimmed), for the write-back lookup. */
  source?: string;
  /** Which occurrence of `source` the pill's row is (0-based) — disambiguates
   *  verbatim-repeated log lines. */
  sourceNth?: number;
  /** A list pill's live sheet state, so clicking the name can show the printed
   *  page (which rolls address which slot). */
  sheet?: { decl: import("lib/domains/lonelog/list-ops").ListDecl; entries: string[] };
  /** A list draw's dice: the die each roll uses, its value (blank until rolled),
   *  and what it selects — rendered as labelled, editable die badges. */
  dice?: Array<{ sides: number; value?: number; label?: string }>;
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
  /** A composed sub-step (authored with a leading `+ `) — rendered one level
   *  deeper than its parent detail row. */
  child?: boolean;
  /** This step spawns the following step(s) (authored with a trailing ` ...`) —
   *  rendered with a subtle "unfolds into" indicator. */
  spawns?: boolean;
  /** The raw (trimmed) source line — used to write inline die-value edits back. */
  source?: string;
  /**
   * Which occurrence of `source` this row is (0-based). A log may repeat a line
   * verbatim (two identical `? Rolling on the List [Characters@ …]` draws), so
   * text alone is not an identity — an edit must name the occurrence or it
   * rewrites every twin.
   */
  sourceNth?: number;
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
export function applyTokenEdits(
  content: string,
  edits: Array<{ line: string; from: string; to: string; nth?: number }>
): string {
  if (edits.length === 0) return content;
  const codeBlockRegex = /(```rpg log\n)([\s\S]*?)(```)/;
  const match = content.match(codeBlockRegex);
  if (!match) return content;

  const [, fence, blockContent, closing] = match;
  const lines = blockContent.split("\n");
  // Group by target line so several token swaps on one line all apply (each is
  // matched against the original line text before any swap changes it).
  // Keyed by line text AND occurrence: a log may repeat a line verbatim, so an
  // edit names which one it means (`nth`, default the first).
  const byLine = new Map<string, Array<{ from: string; to: string }>>();
  for (const { line, from, to, nth } of edits) {
    const key = `${nth ?? 0}\u0000${line}`;
    const swaps = byLine.get(key) ?? [];
    swaps.push({ from, to });
    byLine.set(key, swaps);
  }
  for (const [key, swaps] of byLine) {
    const sep = key.indexOf("\u0000");
    const nth = parseInt(key.slice(0, sep), 10);
    const line = key.slice(sep + 1);
    let seen = 0;
    const idx = lines.findIndex((l) => l.trim() === line && seen++ === nth);
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

/** Stable key for a formula result edit (the text after `->` on a source line). */
export function resultEditKey(source: string): string {
  return `${source} #result`;
}

/** Stable key for one die-value edit slot: source line + die raw + slot index. */
export function dieEditKey(source: string, raw: string, slot: number): string {
  return `${source}\u0000${raw} #${slot}`;
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
    case "dial":
      return { name: tag.name, value: `${tag.current} (${tag.min}–${tag.max})`, kind: tag.kind };
    case "dial-op":
      // Placeholder — the running value is filled position-aware by buildSidebarItems.
      return { name: tag.name ?? tag.abbr ?? "", kind: "dial" };
    case "list-op":
      // Placeholder — the running entries are filled position-aware below.
      return { name: tag.name, value: tag.entry, kind: "list" };
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

/** A resolved dial op → a clean `name: value` pill (the running value). */
function dialOpPill(r: ResolvedDialOp): SidebarPill {
  return { name: r.name, value: String(r.current), kind: "dial" };
}

/** The exact ROLL token for `name` on a source line — `[Characters@]` or a baked
 *  `[Characters@ Bertha]` — so a pick can swap it in place. */
function consultToken(source: string, name: string): string | undefined {
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return source.match(new RegExp(`\\[${esc}\\s*@[^\\][]*\\]`))?.[0];
}

/** A resolved list op → a pill showing what changed and the resulting size:
 *  `Characters  +Bertha (2)`, `Threads  -Find the stone (1)`, `Characters  Bertha`. */
function listOpPill(r: ResolvedListOp): SidebarPill {
  const mark = r.op === "add" ? "+" : r.op === "remove" ? "−" : "";
  const entry = r.entry ?? "";
  if (r.op === "add" || r.op === "remove") {
    // Merged same-line ops list every entry behind one mark, comma-joined for
    // reading: `+A Mouse, Brian (2)` (the SOURCE separator is `;`).
    const all = r.entries?.length ? r.entries.join(", ") : entry;
    return { name: r.name, value: `${mark}${all} (${r.count})`, kind: "list" };
  }
  // An INSPECT shows the whole list, read-only. A ROLL shows the rolled dice
  // (when rolled) and is pickable: its options let the reader override it.
  if (r.op === "inspect") return { name: r.name, value: `${entry} (${r.count})`, kind: "list" };
  // The sheet's dice: a section die (only once the list spans >1 section) plus
  // the row die. Rendered unrolled too, so a bare `[Characters@]` shows the dice
  // waiting to be rolled rather than nothing.
  // Pair the list's CURRENT dice with the recorded roll values, in order — the
  // log stores `r1`/`r2`, the list decides which polyhedron each one is.
  const dice: Array<{ sides: number; value?: number; label?: string }> = [];
  // Label each roll by what it selects. A one-section list rolls only the row, so
  // the labels are derived from which dice actually exist, never assumed.
  const spec: Array<{ sides: number; label: string }> = [];
  if (r.dice?.section) spec.push({ sides: r.dice.section, label: "sec" });
  if (r.dice?.row) spec.push({ sides: r.dice.row, label: "row" });
  spec.forEach((d, i) => dice.push({ sides: d.sides, value: r.rolls?.[i], label: d.label }));
  return {
    name: r.name,
    value: entry,
    kind: "list",
    options: r.options,
    ...(dice.length > 0 ? { dice } : {}),
  };
}

/**
 * A `d:` / `d(Name):` roll row. The actor goes in `label`, NOT into `content` —
 * a leading `Name: ` sits exactly where the formula parser looks for a die, so
 * folding it in turned every attributed roll into plain text.
 */
const rollRow = (r: RollEntry): SidebarRow => ({
  icon: { glyph: "d" },
  content: `${r.roll}${r.result ? ` → ${r.result}` : ""}`,
  label: r.actor,
  pills: [],
});

// Indented working lines become nested bullet rows. A leading `label:` prefix
// (e.g. "Alterations: d10=8 …") is split out so it can be styled apart. A
// leading `+ ` marks a composed child (rendered one level deeper); a trailing
// ` ...` marks a step that spawns the following step(s).
const continuationRows = (extras: string[]): SidebarRow[] =>
  extras.map((raw) => {
    const child = /^\+\s/.test(raw);
    const spawns = /\s\.\.\.$/.test(raw);
    let text = raw;
    if (child) text = text.replace(/^\+\s+/, "");
    if (spawns) text = text.replace(/\s*\.\.\.$/, "");
    // A word-pair line self-describes its table (`@[[file]]#id d100= ->`) so the
    // roll knows what to fill from. That ref is plumbing, not content — hide it
    // and show just the die + result. `source` keeps the raw line, so editing
    // and re-resolution still find the table.
    text = text.replace(/(:\s+)@?\[\[[^\]\n]+\]\](?:#[\w./-]+)?\s+(?=d\d)/i, "$1");
    const m = text.match(/^([A-Za-z][\w ]*?):\s+(.+)$/);
    const row: SidebarRow = m
      ? { icon: null, content: m[2], label: m[1], detail: true, pills: [], source: raw }
      : { icon: null, content: text, detail: true, pills: [], source: raw };
    if (child) row.child = true;
    if (spawns) row.spawns = true;
    return row;
  });
/**
 * An `o:` row: `Fate Chart (likely) d100=22 -> Yes`.
 *
 * The odds and the chaos factor pick a cell of the chart, so the row shows what the
 * roll had to beat — the reason to consult a chart at all — and reads the answer off
 * the roll. A written result survives only where the roll cannot decide one.
 */
const oracleCallRow = (call: OracleCallEntry, cf: number | undefined): SidebarRow => {
  const rolled = call.roll ? rolledValue(call.roll) : null;
  const answer =
    call.likelihood && cf != null && rolled != null ? answerFateQuestion(rolled, cf, call.likelihood) : null;
  const threshold = call.likelihood && cf != null ? fateThreshold(cf, call.likelihood) : null;
  const result = answer ? answer.wording : (call.result ?? "");
  return {
    icon: { lucide: "Dices" },
    content: `${call.roll ?? ""}${result ? ` → ${result}` : ""}`.trim(),
    pills: [
      { name: call.source, value: call.oddsText ?? "", kind: "oracle" },
      ...(threshold != null ? [{ name: "yes on", value: `≤${threshold}`, kind: "cf" }] : []),
    ],
  };
};

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
export function buildSidebarItems(
  segments: ProseSegment[],
  dialOps?: Map<number, ResolvedDialOp[]>,
  listOps?: Map<number, ResolvedListOp[]>
): SidebarItem[] {
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
        const cf = seg.question.chaosFactor;
        const headPills: SidebarPill[] = [
          ...(seg.question.chaosFactor != null
            ? [{ name: "CF", value: String(seg.question.chaosFactor), kind: "cf" }]
            : []),
          // Dial-op placeholders on the question — resolved to running values by the fill pass.
          ...(seg.question.dialOps ?? []).map(tagPill),
        ];
        const rows: SidebarRow[] = [
          {
            icon: { glyph: "?" },
            content: `${actor}${seg.question.text}`,
            pills: headPills,
            // The raw line (tags intact) so an editable op token on the question
            // can be written back; `text` has had its tags stripped.
            source: seg.question.raw,
          },
        ];
        if (seg.answer) {
          rows.push({
            icon: { lucide: "ArrowRight" },
            content: `${seg.answer.text}${seg.answer.roll ? ` (${seg.answer.roll})` : ""}`.trim(),
            pills: [],
          });
        }
        // Each oracle consulted gets its own row: source and odds as pills, the
        // number to beat, and the answer READ OFF THE ROLL rather than typed.
        for (const o of seg.oracles) rows.push(oracleCallRow(o, cf));
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

      case "standalone-consequence": {
        const conclusion = (seg.entry.conclusion ?? "").trim();
        const dialTags = seg.entry.tags.filter((t) => t.kind === "dial-op");
        // A bare dial-op line (`[CF+1]`) → a mechanical dial entry (no prose);
        // its pills get the computed running value in the fill pass below.
        if (!conclusion && dialTags.length > 0) {
          items.push({
            id,
            kind: "dial",
            rows: [{ icon: { lucide: "Gauge" }, content: "", pills: dialTags.map(tagPill) }],
          });
          break;
        }
        items.push({
          id,
          kind: "consequence",
          rows: [consequenceRow(seg.entry), ...continuationRows(extras)],
        });
        break;
      }

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

  // Number each row against its source text, so a repeated line can be edited by
  // OCCURRENCE rather than by text (which would hit all its twins — a log may
  // repeat `? Rolling on the List [Characters@ …]` verbatim).
  const seenSource = new Map<string, number>();
  for (const item of items) {
    for (const row of item.rows) {
      if (!row.source) continue;
      const nth = seenSource.get(row.source) ?? 0;
      row.sourceNth = nth;
      seenSource.set(row.source, nth + 1);
    }
  }

  // Position-aware fill: replace placeholder dial pills (a `[CF+1]` token, which
  // tagPill can't value on its own) with the computed running value, in order.
  if (dialOps) {
    for (const item of items) {
      const ops = dialOps.get(item.id);
      if (!ops || ops.length === 0) continue;
      let oi = 0;
      for (const row of item.rows) {
        row.pills = row.pills.map((p) =>
          p.kind === "dial" && p.value === undefined && oi < ops.length ? dialOpPill(ops[oi++]) : p
        );
      }
    }
  }

  // Same pass for LIST ops (`[Characters+ …]`): the placeholder carries only the
  // list name, so swap in the resolved entry + running count, in order.
  if (listOps) {
    for (const item of items) {
      const ops = listOps.get(item.id);
      if (!ops || ops.length === 0) continue;
      let oi = 0;
      for (const row of item.rows) {
        // flatMap, not map: same-line ops on one list MERGE, so there can be
        // fewer resolved ops than placeholders — the surplus placeholders are
        // dropped rather than left showing a bare list name.
        row.pills = row.pills.flatMap((p) => {
          if (p.kind !== "list") return [p];
          if (oi >= ops.length) return [];
          const r = ops[oi++];
          const pill = listOpPill(r);
          if (r.sheet) pill.sheet = r.sheet;
          // Carry the source line + the exact roll token so a pick can be
          // written back into the note (mirrors the die-edit token swap).
          const src = row.source ?? row.content;
          if (r.op === "roll" && src) {
            const token = consultToken(src, r.name);
            if (token) {
              pill.source = src;
              pill.token = token;
              pill.sourceNth = row.sourceNth ?? 0;
            }
          }
          return [pill];
        });
      }
    }
  }

  return items;
}

// Re-export so the prose view can summarize rolls from one module.
export { summarizeRoll };
