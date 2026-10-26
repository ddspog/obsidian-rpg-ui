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

import { actionTarget, leadingActionCall } from "./action-call";
import { parseSceneMarker } from "lib/domains/lonelog/parser";
import { answerFateCheck, answerFateQuestion, fateCheckModifier, fateThreshold } from "lib/domains/gm/fate-chart";
import { parsePickSpec } from "lib/domains/gm/steps";
import { parseFormula, refStem, rolledDice, rolledValue, type FormulaContext, type FormulaVars } from "./formula";
import { combatantKey, foldInitiative } from "./initiative";
import { matchActor } from "./actors";
import { conditionChange, type ConditionChange } from "./conditions";
import { foldFoes, segmentFoes } from "./foes";
import type { InitiativeEntry, InitiativeTag, InventoryTag } from "lib/domains/lonelog/types";
import type { RollEntry, PersistentTag, OracleCallEntry } from "lib/domains/lonelog/types";
import type { ResolvedDialOp } from "lib/domains/lonelog/dial-ops";
import type { ResolvedListOp } from "lib/domains/lonelog/list-ops";
import type { ProseSegment } from "./prose-grouper";
import type { RoundEconomy } from "./round-economy";
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
  | { kind: "dialogue"; speaker: string; speakerType: "pc" | "npc"; text: string; sourceId: number }
  /** A fight, `[COMBAT]` to `[/COMBAT]`: its turns, and who did what in them. */
  | { kind: "combat"; nodes: ProseNode[]; sourceId: number }
  /** A turn of the fight (`T2`) — a pass through the initiative order. */
  | { kind: "turn"; number: number; sourceId: number }
  /** In a fight, what one creature's action came to — told beside its name. */
  | { kind: "beat"; actor: string; fragments: ProseFragment[] }
  /** A journey starts (`[TRAVEL: [[Map]]]`): its map goes here. */
  | { kind: "travel"; sourceId: number }
  /** A journey ends (`[/TRAVEL: arrive … | … | outcome …]`): when, its numbers, what came of it. */
  | { kind: "arrival"; sourceId: number; arrive?: string; stats: string[]; outcome?: string };

/**
 * A creature's name as the prose margin shows it, short: a statblock's `Kobold,
 * Tinkerer` as `K. Tinkerer` (the creature, then which one); one told apart by
 * a word before it and a letter after (`Thin Kobold, A`) as `T. Kobold` — the
 * word, then the creature; anything else as written, links read as their text.
 */
export function actorLabel(name: string): string {
  const shown = name
    .replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g, (_m, t: string, a?: string) => a ?? t)
    .trim();
  const m = shown.match(/^(.+?),\s*(\S.*)$/);
  if (!m) return shown;
  const words = m[1].trim().split(/\s+/);
  const kind = words.pop()!;
  const which = m[2].trim();
  // A variant letter (`, A`): what tells it apart is the word before the creature.
  if (which.length === 1) {
    return words.length > 0 ? [...words.map((w) => `${w[0]}.`), kind].join(" ") : shown;
  }
  return [...words, `${kind[0]}.`, which].join(" ");
}

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

  // The fight being told, if one is open: what follows goes inside it. A fight
  // opens at its first turn — what's said and done after `[COMBAT]` but before
  // anyone's turn (the standoff, the taunts) is still the story around it.
  let combat: Extract<ProseNode, { kind: "combat" }> | null = null;
  let pendingCombat: number | null = null;
  const into = (): ProseNode[] => (combat ? combat.nodes : current.nodes);
  // A round (`R(Kobold, Tinkerer)`) tells everything done in it as one: its
  // creature's name, beside every action's outcome merged into one paragraph.
  let round: { actor: string; beat: Extract<ProseNode, { kind: "beat" }> | null } | null = null;
  const openCombat = () => {
    if (pendingCombat == null) return;
    combat = { kind: "combat", nodes: [], sourceId: pendingCombat };
    current.nodes.push(combat);
    pendingCombat = null;
    breakFlow();
  };

  const flushScene = () => {
    if (current.head || current.nodes.length > 0) scenes.push(current);
  };

  const startScene = (head: ProseSceneHead) => {
    flushScene();
    current = { head, nodes: [] };
    lastParagraph = null;
    joinNext = false;
    // A fight that runs on into a new scene carries on there.
    if (combat) {
      combat = { kind: "combat", nodes: [], sourceId: combat.sourceId };
      current.nodes.push(combat);
    }
  };

  const addFragment = (fragment: ProseFragment) => {
    if (joinNext && lastParagraph) {
      lastParagraph.fragments.push(fragment);
    } else {
      lastParagraph = { kind: "paragraph", fragments: [fragment] };
      into().push(lastParagraph);
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

      case "action-group": {
        // A fight with no turn marker opens at its first action.
        openCombat();
        // In a fight, each action is told beside who took it — or, in a round,
        // beside whose round it is, joined to what else happened in it.
        const told = seg.consequences.map((c) => (c.conclusion ?? "").trim()).filter((t) => t && !parseSceneMarker(t));
        const fragments = told.map((text) => ({ text, sourceId: seg.sourceIndex }));
        if (combat && round && told.length > 0) {
          const nodes = into();
          // Still the latest thing told (nothing said in between): add to it.
          if (round.beat && nodes[nodes.length - 1] === round.beat) round.beat.fragments.push(...fragments);
          else {
            round.beat = { kind: "beat", actor: round.actor, fragments };
            nodes.push(round.beat);
          }
          breakFlow();
          break;
        }
        if (combat && seg.action.actor && told.length > 0) {
          into().push({ kind: "beat", actor: seg.action.actor, fragments });
          breakFlow();
          break;
        }
        for (const c of seg.consequences) consumeConclusion(c.conclusion, seg.sourceIndex);
        break;
      }

      case "world-event":
        for (const c of seg.consequences) consumeConclusion(c.conclusion, seg.sourceIndex);
        break;

      case "combat-start":
        pendingCombat = seg.sourceIndex;
        break;

      case "travel-start":
        breakFlow();
        into().push({ kind: "travel", sourceId: seg.sourceIndex });
        break;

      case "travel-end":
        breakFlow();
        into().push({
          kind: "arrival",
          sourceId: seg.sourceIndex,
          ...(seg.entry.end?.arrive ? { arrive: seg.entry.end.arrive } : {}),
          stats: seg.entry.end?.stats ?? [],
          ...(seg.entry.end?.outcome ? { outcome: seg.entry.end.outcome } : {}),
        });
        break;

      case "combat-end":
        combat = null;
        pendingCombat = null;
        round = null;
        breakFlow();
        break;

      case "turn":
        // Whose round it is: what's done next is told beside their name.
        openCombat();
        round = combat ? { actor: seg.actor, beat: null } : null;
        break;

      case "round":
        openCombat();
        round = null;
        if (combat) {
          into().push({ kind: "turn", number: seg.round, sourceId: seg.sourceIndex });
          breakFlow();
        }
        break;

      case "oracle":
        for (const c of seg.consequences) consumeConclusion(c.conclusion, seg.sourceIndex);
        break;

      case "standalone-consequence":
        consumeConclusion(seg.entry.conclusion, seg.sourceIndex);
        break;

      case "dialogue":
        into().push({
          kind: "dialogue",
          speaker: seg.entry.speaker,
          speakerType: seg.entry.speakerType,
          text: seg.entry.text,
          sourceId: seg.sourceIndex,
        });
        breakFlow();
        break;

      case "narrative":
        into().push({ kind: "narration", text: seg.entry.text, sourceId: seg.sourceIndex });
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
  | "meta"
  | "initiative"
  | "round"
  | "turn";

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
  /** Shown on the same line as the row above (authored `& label: …`). Each part keeps its
   *  own source line, die and result. */
  joined?: boolean;
  /** The columns a second roll below this row chooses among: this row reads as what it offers. */
  pickedBy?: { spec: string; part: number };
  /** A second roll on the row above (`@pick(1,2+3)`): the columns it chooses among. */
  pick?: string;
  /** The row a second roll reads: its raw line and its content, to find its die. */
  pickFrom?: { source: string; content: string }[];
  /** A second roll with no die: it shows the name (or names) its rows make. */
  pickOnly?: boolean;
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
  /** Running resource values in effect at this row (`CF` → 5), so a bare
   *  threshold in a formula (`d10=8 vs CF`) reads the current value. */
  vars?: FormulaVars;
  /** Who acts on this row (`@(Talon)`, `d(Talon):`) — whose modifiers a
   *  `[[Name]]` term in its roll reads. */
  actor?: string;
  /** An action's actor, shown once before its text — in the `@` squircle, a
   *  link to their page once the log knows it (`Talon` → `Talon Pallton`). */
  actorPill?: { label: string; page?: string };
  /** What a damage row left its target with: the target as the log wrote it
   *  (its link — `Fat [[Kobold, A]]`) and its health after (`6/9 HP`, `KO`). */
  leaves?: { target: string; left: string };
  /** What the entry did to its target's conditions (`+pinned` from Icicle
   *  Javelin º), shown on its attack row — the target's own row would only
   *  repeat the action line. */
  inflicts?: ConditionChange[];
  /** A round line's tally: the owner's action, bonus action, reaction and
   *  attacks so far, and who else reacted in it. */
  economy?: RoundEconomy;
  /** The action's target as the log first named it — its link (`Fat [[Kobold, A]]`) —
   *  once its own row is dropped for repeating the action line. */
  targetAs?: string;
  /** The actor's value for each `[[Name]]` on the row (`Insight` → 3), filled
   *  by {@link withActorRefs} once the PCs are loaded. */
  refs?: Record<string, number>;
  /** An initiative-order row's combatant, so its written roll can be worked
   *  back from the total once the combatant's modifiers are known. */
  combatant?: InitiativeEntry;
  /** A foe row: its health and conditions as of this entry, shown on hover. */
  foe?: { current?: number; max?: number; state?: string; conditions?: string[] };
  /** A top-level row whose DICE can be rolled and typed in the Log (an `o:`
   *  line), written back through `source`. Its result is derived, not typed. */
  rollable?: boolean;
  /** A check's result worked out from its roll — `Success` / `Failure` against
   *  its DC — when none was written. */
  derivedResult?: string;
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
  /** An attack a Multiattack holds (`part`, the `last` of them) — drawn on as
   *  one entry, its line folded into the first one's header strip. */
  group?: "part" | "last";
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
      return { name: tag.name, value: tag.tags.length ? tag.tags.join(", ") : undefined, kind: tag.kind };
    case "foe":
      // Listed as the entry's foe rows (with tracked HP), not as a pill.
      return { name: "", kind: tag.kind };
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
    case "initiative":
      // Rendered as its own entry (the order list), not as a dateline pill.
      return { name: "", kind: tag.kind };
    case "position":
    case "move":
      // Drawn on the battle map, not shown as a pill.
      return { name: "", kind: tag.kind };
    case "time":
      return { name: "Time", value: tag.raw, kind: "time" };
    case "weather":
      return { name: "Weather", value: tag.parts.join(" · "), kind: "weather" };
    case "group": {
      const who = tag.members?.join(", ");
      const value =
        tag.op === "define"
          ? who
          : tag.op === "split"
            ? `${who} → ${tag.to}`
            : tag.op === "merge"
              ? `→ ${tag.to}`
              : tag.op === "rename"
                ? `now ${tag.to}`
                : `${tag.op === "add" ? "+" : "−"} ${who}`;
      return { name: tag.group, value, kind: "group" };
    }
    case "mark":
      return { name: tag.name, value: tag.end ? "ends" : tag.until ? `until ${tag.until}` : tag.spec, kind: "mark" };
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
  actor: r.actor,
  pills: [],
  // Its dice roll and take typed values in the Log (a card's `d: d20+5=`),
  // written back through the line it came from.
  ...(r.raw ? { source: r.raw, rollable: true } : {}),
});

// Indented working lines become nested bullet rows. A leading `label:` prefix
// (e.g. "Alterations: d10=8 …") is split out so it can be styled apart. A
// leading `+ ` marks a composed child (rendered one level deeper); a trailing
// ` ...` marks a step that spawns the following step(s).
const continuationRows = (extras: string[]): SidebarRow[] => withPickSources(extras.map(continuationRow));

/** A name's second roll (`@pick(…)`) reads the rows above it, one per part of its spec: tell it which. */
function withPickSources(rows: SidebarRow[]): SidebarRow[] {
  const seen: SidebarRow[] = [];
  for (const row of rows) {
    const spec = row.source?.match(/@pick\(([^)\n]*)\)/)?.[1];
    if (spec == null) {
      if (row.source && /@?\[\[[^\]\n]+\]\]/.test(row.source)) seen.push(row);
      continue;
    }
    const from = seen.slice(-parsePickSpec(spec).length);
    row.pick = spec;
    row.pickFrom = from.map((r) => ({ source: r.source ?? "", content: r.content }));
    from.forEach((r, part) => {
      r.pickedBy = { spec, part };
    });
  }
  return rows;
}

const continuationRow = (raw: string): SidebarRow => {
  const child = /^\+\s/.test(raw);
  const spawns = /\s\.\.\.$/.test(raw);
  let text = raw;
  if (child) text = text.replace(/^\+\s+/, "");
  if (spawns) text = text.replace(/\s*\.\.\.$/, "");
  // A word-pair line self-describes its table (`@[[file]]#id d100= ->`) so the
  // roll knows what to fill from. That ref is plumbing, not content — hide it
  // and show just the die + result. `source` keeps the raw line, so editing
  // and re-resolution still find the table.
  text = text.replace(/(:\s+)(?:@?\[\[[^\]\n]+\]\](?:#[\w./-]+)?|@pick\([^)\n]*\))\s+(?=d\d)/i, "$1");
  // Unicode letters, hyphens and a parenthetical, so a table named for its style
  // (`Nörslik 1:`, `Brittonian (Welsh) 1:`, `Dharc-Metallik 1:`) keeps its label.
  const m = text.match(/^(?:(&)\s+)?(\p{L}(?:[\p{L}\p{N}_ ,'’/-]|\([\p{L}\p{N}_ ,'’/-]*\))*?):\s+(.+)$/u);
  const row: SidebarRow = m
    ? { icon: null, content: m[3], label: m[2], detail: true, pills: [], source: raw }
    : { icon: null, content: text, detail: true, pills: [], source: raw };
  // A second roll with no die is only its result: the name (or names) the rows above make.
  if (m && /@pick\([^)\n]*\)\s*(->|→)/.test(m[3]) && !/\bd\d/.test(m[3].replace(/@pick\([^)\n]*\)/, ""))) {
    row.content = m[3].replace(/^.*?(?:->|→)\s*/, "");
    row.pickOnly = true;
  }
  // `& Ending: …` — the same line as the row above (a Start and its Ending, one name).
  if (m?.[1]) row.joined = true;
  if (child) row.child = true;
  if (spawns) row.spawns = true;
  return row;
};
/**
 * An `o:` row: `Fate Chart (likely) d100=22 -> Yes`.
 *
 * The odds and the chaos factor pick a cell of the chart, so the row shows what the
 * roll had to beat — the reason to consult a chart at all — and reads the answer off
 * the roll. A written result survives only where the roll cannot decide one.
 */
const oracleCallRow = (call: OracleCallEntry, cf: number | undefined): SidebarRow => {
  const source = { name: call.source, value: call.oddsText ?? "", kind: "oracle" };
  const randomEvent = { name: "Random Event", kind: "warn" };
  // A Fate Check adds two d10s plus the odds and chaos modifiers, so it shows
  // the dice sum that answers Yes rather than a d100 cell.
  if (/fate\s*check/i.test(call.source)) {
    const dice = call.roll ? rolledDice(call.roll) : [];
    const pair = dice.length === 2 ? ([dice[0], dice[1]] as [number, number]) : null;
    const answer = call.likelihood && cf != null && pair ? answerFateCheck(pair, cf, call.likelihood) : null;
    const yesOn = call.likelihood && cf != null ? 11 - fateCheckModifier(cf, call.likelihood) : null;
    const result = answer ? `${answer.wording} (${answer.total})` : (call.result ?? "");
    return {
      icon: { lucide: "Dices" },
      content: `${call.roll ?? ""}${result ? ` → ${result}` : ""}`.trim(),
      ...(call.raw ? { source: call.raw, rollable: true } : {}),
      pills: [
        source,
        ...(yesOn != null ? [{ name: "yes on", value: `≥${yesOn}`, kind: "cf" }] : []),
        ...(answer?.randomEvent ? [randomEvent] : []),
      ],
    };
  }
  const rolled = call.roll ? rolledValue(call.roll) : null;
  const answer =
    call.likelihood && cf != null && rolled != null ? answerFateQuestion(rolled, cf, call.likelihood) : null;
  const threshold = call.likelihood && cf != null ? fateThreshold(cf, call.likelihood) : null;
  const result = answer ? answer.wording : (call.result ?? "");
  return {
    icon: { lucide: "Dices" },
    content: `${call.roll ?? ""}${result ? ` → ${result}` : ""}`.trim(),
    ...(call.raw ? { source: call.raw, rollable: true } : {}),
    pills: [
      source,
      ...(threshold != null ? [{ name: "yes on", value: `≤${threshold}`, kind: "cf" }] : []),
      ...(answer?.randomEvent ? [randomEvent] : []),
    ],
  };
};

/**
 * Whether an entry's `=>` line shows in the Log. A line that is nothing but an
 * `[Inv:]` tag (`=> [Inv:[[Kowyn's Bag]]+1]`) is bookkeeping for the inventory
 * checklist — the entry already says what happened — so it stays out of view.
 */
const isShown = (c: { conclusion?: string; tags: PersistentTag[] }): boolean =>
  !!c.conclusion?.trim() || c.tags.length === 0 || !c.tags.every((t) => t.kind === "inventory");

/** A map tag as a sentence: `Placed Talon at C4, Kobold, Elite at H2` / `Moved Lilith to D5`. */
function describeMapTag(t: PersistentTag): string | null {
  if (t.kind === "position") return `Placed ${t.entries.map((e) => `${shownName(e.name)} at ${e.at}`).join(", ")}`;
  if (t.kind === "move") return `Then moved ${t.who ? `${shownName(t.who)} ` : ""}to ${t.path[t.path.length - 1]}`;
  return null;
}

/** A move on an action line, as a pill: `Move → E3` (or `→ G4 › F4 › E4` for a route). */
function movePills(tags: PersistentTag[] | undefined): SidebarPill[] {
  return (tags ?? []).flatMap((t) =>
    // Before the action, a move; after it, what came next.
    t.kind === "move"
      ? [
          {
            name: `${t.after ? "Then" : "Move"}${t.who ? ` ${shownName(t.who)}` : ""}`,
            value: `→ ${t.path.join(" › ")}`,
            kind: "move",
          },
        ]
      : []
  );
}

/** A row with something to show — text, a pill, or a scene to edit. */
const saysSomething = (row: SidebarRow): boolean => !!row.content || row.pills.length > 0 || !!row.scene;

const consequenceRow = (c: { conclusion?: string; text: string; tags: PersistentTag[] }): SidebarRow => {
  // A line that only places or moves combatants reads as what it did.
  if (!c.conclusion?.trim() && c.tags.length > 0 && c.tags.every((t) => t.kind === "position" || t.kind === "move")) {
    return { icon: { lucide: "Map" }, content: c.tags.map(describeMapTag).filter(Boolean).join("; "), pills: [] };
  }
  // A tag-only `[Init:…]` line inside an entry says what changed, not its raw tag.
  const inits = c.tags.filter((t): t is InitiativeTag => t.kind === "initiative");
  if (!c.conclusion?.trim() && inits.length > 0) return initiativeHeader(inits);
  // A line of tags only (`=> [F:…|+marked] [Talon/Mystic Mark-1]`) is
  // bookkeeping: its pills go up to the entry's strip, its text isn't shown.
  const conclusion = c.conclusion?.trim() || (c.tags.length > 0 ? "" : c.text);
  // A move in an outcome comes after the action: `Then → J14`.
  const thenPills: SidebarPill[] = c.tags.flatMap((t) =>
    t.kind === "move"
      ? [{ name: t.who ? `Then ${shownName(t.who)}` : "Then", value: `→ ${t.path.join(" › ")}`, kind: "move" }]
      : []
  );
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
  // An `[Inv:]` on a line that already says what happened is bookkeeping for
  // the inventory checklist, not a heading for the entry.
  const said = !!c.conclusion?.trim();
  return {
    icon: { lucide: "CornerDownRight" },
    content: conclusion,
    pills: [
      ...c.tags
        .filter((t) => !(said && t.kind === "inventory"))
        .map(tagPill)
        .filter((p) => p.name),
      ...thenPills,
    ],
  };
};

/**
 * What an entry stowed, by where it went — one detail row per place, what
 * was put inside a container found under it:
 *
 *   • KOWYN'S BAG  1 Leather · 2 Sling · 1 Pouch
 *     + IN POUCH   1 Sling bullets
 *   • TALON › QUIVER  1 Arrows
 */
function stowRows(tags: PersistentTag[]): SidebarRow[] {
  const inv = tags.filter((t): t is InventoryTag => t.kind === "inventory" && !!t.name && !!t.owner);
  if (inv.length === 0) return [];
  const item = (t: InventoryTag) => {
    const n = t.delta ?? t.quantity ?? t.transition?.to;
    const count = t.depleted ? "used up" : n == null ? "" : t.delta != null && t.delta < 0 ? `−${-t.delta}` : String(n);
    return `${count ? `${count} ` : ""}${t.link ? `[[${t.name}]]` : t.name}`;
  };
  const places = new Map<string, { at: string[]; items: string[] }>();
  for (const t of inv) {
    const at = [t.owner!, ...(t.path ?? [])];
    const key = at.join("/").toLowerCase();
    if (!places.has(key)) places.set(key, { at, items: [] });
    places.get(key)!.items.push(item(t));
  }
  // A place inside something stowed in the same line (a Pouch found) goes under it.
  const keys = [...places.keys()];
  const parentOf = (key: string) =>
    keys.find((k) => k !== key && key.startsWith(`${k}/`) && key.split("/").length === k.split("/").length + 1);
  const rows: SidebarRow[] = [];
  const emit = (key: string, child: boolean) => {
    const p = places.get(key)!;
    rows.push({
      icon: { lucide: "Package" },
      detail: true,
      ...(child ? { child: true } : {}),
      label: child ? `in ${p.at[p.at.length - 1]}` : p.at.join(" › "),
      content: p.items.join(" · "),
      pills: [],
    });
    for (const k of keys) if (parentOf(k) === key) emit(k, true);
  };
  for (const k of keys) if (!parentOf(k)) emit(k, false);
  return rows;
}

/** An outcome's row, and under it what it stowed where. */
const consequenceRows = (c: { conclusion?: string; text: string; tags: PersistentTag[] }): SidebarRow[] => [
  consequenceRow(c),
  ...stowRows(c.tags),
];

/** A combatant's name for a caption: links read as their text. */
const shownName = (name: string) =>
  name.replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g, (_m, t: string, a?: string) => a ?? t).trim();

/**
 * The order as indented rows. A plain value reads `14 Talon`. A written roll
 * reads as the roll — the name as its caption, the dice, and the total it came
 * to (`TALON  d20 +4 INITIATIVE → 14`); the die's face is worked back from that
 * total by {@link withCombatantRolls} once the modifiers are known.
 */
const orderRows = (order: InitiativeEntry[]): SidebarRow[] =>
  order.map((e) =>
    e.roll && e.value != null
      ? {
          icon: null,
          detail: true,
          label: shownName(e.name),
          content: `${e.roll} → ${e.value}`,
          pills: [],
          combatant: e,
        }
      : { icon: null, detail: true, label: e.value != null ? String(e.value) : "—", content: e.name, pills: [] }
  );

/**
 * Fill each initiative roll for its combatant: resolve the roll's `[[Name]]`
 * modifiers, so the total as written reads its die (`d20+[[Initiative]]=14`
 * with Initiative +4 rolled a 10). A roll with a modifier that cannot be
 * resolved stays unrolled.
 */
export function withCombatantRolls(
  items: SidebarItem[],
  resolve: (combatant: string, name: string) => number | undefined
): SidebarItem[] {
  return items.map((item) => ({
    ...item,
    rows: item.rows.map((row) => {
      const c = row.combatant;
      if (!c?.roll || c.value == null) return row;
      const refs: Record<string, number> = {};
      let mods = 0;
      for (const m of c.roll.matchAll(/([+-])\s*(\d+|\[\[[^\]\n]+\]\])/g)) {
        const sign = m[1] === "-" ? -1 : 1;
        if (/^\d+$/.test(m[2])) {
          mods += sign * parseInt(m[2], 10);
          continue;
        }
        const name = refStem(m[2]);
        const value = resolve(c.name, name);
        if (value == null) return row;
        refs[name] = value;
        mods += sign * value;
      }
      void mods;
      return { ...row, content: `${c.roll}${c.value}`, refs };
    }),
  }));
}

/** What `[Init:…]` tags did, as a row: `Initiative — Kobold Archer joins`. */
function initiativeHeader(tags: InitiativeTag[]): SidebarRow {
  const names = (op: InitiativeTag["op"]) =>
    tags.filter((t) => t.op === op).flatMap((t) => t.entries.map((e) => e.name));
  const joined = names("add");
  const left = names("remove");
  const what = [
    ...(joined.length ? [`${joined.join(", ")} joins`] : []),
    ...(left.length ? [`${left.join(", ")} leaves`] : []),
  ];
  return {
    icon: { lucide: "ListOrdered" },
    content: what.length ? `Initiative — ${what.join("; ")}` : "Initiative",
    pills: [],
  };
}

/** A bare `[Init:…]` line: what it did, then the order it leaves. */
function initiativeRows(tags: InitiativeTag[], order: InitiativeEntry[]): SidebarRow[] {
  return [initiativeHeader(tags), ...orderRows(order)];
}

/**
 * A check's result from its roll: `Success` when the die plus its modifiers
 * meets the DC, `Failure` otherwise. Null unless the line is a single die
 * `vs DC n`, rolled, with every modifier known, and no result written.
 */
export function checkResult(content: string, ctx: FormulaContext): string | null {
  const f = parseFormula(content, ctx);
  if (!f || (f.result != null && f.result.trim() !== "") || f.check.kind !== "contest") return null;
  const { left, right } = f.check;
  // A check against a DC succeeds or fails; an attack against an AC hits or misses.
  if (
    left.kind !== "dice" ||
    left.value == null ||
    right.kind !== "threshold" ||
    (right.label !== "DC" && right.label !== "AC")
  )
    return null;
  let mods = 0;
  if (left.mods) {
    for (const m of left.mods) {
      if (m.value == null) return null; // a modifier still unresolved
      mods += m.sign === "-" ? -m.value : m.value;
    }
  } else {
    for (const m of left.modifier.matchAll(/([+-])\s*(\d+)/g)) mods += (m[1] === "-" ? -1 : 1) * parseInt(m[2], 10);
  }
  const met = left.value + mods >= right.value;
  return right.label === "AC" ? (met ? "Hit" : "Miss") : met ? "Success" : "Failure";
}

/** Give each check row with no written result the one its roll implies. */
export function withCheckResults(items: SidebarItem[]): SidebarItem[] {
  return items.map((item) => ({
    ...item,
    rows: item.rows.map((row) => {
      if (!(row.detail || row.rollable)) return row;
      const result = checkResult(row.content, { vars: row.vars, refs: row.refs });
      if (!result) return row;
      const content = `${row.content.replace(/\s*(?:->|→)\s*$/, "")} → ${result}`;
      return { ...row, content, derivedResult: result };
    }),
  }));
}

/** A row's own actor (`d(Kowyn):`) wins; otherwise it acts for its entry's. */
const withActor = (row: SidebarRow, actor: string | undefined): SidebarRow =>
  row.actor || !actor ? row : { ...row, actor };

/**
 * Fill each row's `[[Name]]` terms with its actor's value for them, so
 * `d20+[[Insight]]` under `@(Talon)` reads Talon's Insight. `resolve` is the
 * system's answer (a character's `Modifier` expression) and returns undefined
 * for a name it does not know, which leaves that term unresolved.
 */
export function withActorRefs(
  items: SidebarItem[],
  resolve: (actor: string, name: string) => number | undefined
): SidebarItem[] {
  return items.map((item) => ({
    ...item,
    rows: item.rows.map((row) => {
      if (!row.actor || !row.content.includes("[[")) return row;
      const refs: Record<string, number> = {};
      for (const m of row.content.matchAll(/[+-]\s*(\[\[[^\]\n]+\]\])/g)) {
        const name = refStem(m[1]);
        const value = resolve(row.actor, name);
        if (value != null) refs[name] = value;
      }
      return Object.keys(refs).length > 0 ? { ...row, refs } : row;
    }),
  }));
}

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
  listOps?: Map<number, ResolvedListOp[]>,
  /** Starting values for bare thresholds — the declared resources' defaults. */
  seedVars?: FormulaVars
): SidebarItem[] {
  const items: SidebarItem[] = [];

  // Ops are keyed by ENTRY, items by SEGMENT (its first entry). A segment spans
  // several entries — an action, its rolls, its `=>` lines, a bare `[CF-1]`
  // after them — so an op on any of those lines belongs to the segment it falls
  // in, not to a segment of its own.
  const starts = segments.map((seg) => seg.sourceIndex);
  const bySegment = <T>(m?: Map<number, T[]>): Map<number, T[]> | undefined => {
    if (!m) return m;
    const out = new Map<number, T[]>();
    for (const [i, list] of Array.from(m.entries()).sort((a, b) => a[0] - b[0])) {
      let id = starts[0] ?? i;
      for (const start of starts) {
        if (start > i) break;
        id = start;
      }
      out.set(id, [...(out.get(id) ?? []), ...list]);
    }
    return out;
  };
  // Ops written on a question's own line, before regrouping hides which line
  // they were on: they move the dial BEFORE the question is asked.
  const questionOpCount = new Map<number, number>();
  for (const seg of segments) {
    if (seg.type === "oracle") questionOpCount.set(seg.sourceIndex, dialOps?.get(seg.sourceIndex)?.length ?? 0);
  }
  dialOps = bySegment(dialOps);
  listOps = bySegment(listOps);

  const initAt = foldInitiative(segments);
  const foesAt = foldFoes(segments);

  // Running resource values in effect at each segment, so a bare `vs CF` and a
  // Fate Chart row read what CF IS at that point: declared defaults, then each
  // question's own `[CF:n]` or `[CF±n]` (the value its checks run against), then
  // every later op's result after it.
  const varsAt = new Map<number, FormulaVars>();
  {
    const running: FormulaVars = { ...seedVars };
    for (const seg of segments) {
      const ops = dialOps?.get(seg.sourceIndex) ?? [];
      const asked = questionOpCount.get(seg.sourceIndex) ?? 0;
      const stated = seg.type === "oracle" ? seg.question.chaosFactor : undefined;
      if (stated != null) running.CF = stated;
      for (const op of ops.slice(0, asked)) running[op.key] = op.current;
      varsAt.set(seg.sourceIndex, { ...running });
      for (const op of ops.slice(asked)) running[op.key] = op.current;
    }
  }

  for (const seg of segments) {
    const id = seg.sourceIndex;
    const extras = seg.continuations ?? [];

    switch (seg.type) {
      case "action-group": {
        // An action called on its actor's page (`@[[Kobold, Elite]].action(…)`)
        // names the actor itself, once — the row is the call, no `Actor:` before it.
        // Either way the actor shows once, in the `@` squircle: an action written
        // plainly (`@(Talon) Checking if the Kobold is lying`) gets it before its
        // text; an assisted one (`@(Talon > Lilith)`) keeps its written form.
        const called = !seg.action.assist && leadingActionCall(seg.action.text);
        const pill = !called && !seg.action.assist && seg.action.actor ? { label: seg.action.actor } : undefined;
        const actor =
          seg.action.actor && !called && !pill
            ? `${seg.action.actor}${seg.action.assist ? ` > ${seg.action.assist}` : ""}: `
            : "";
        items.push({
          id,
          kind: "action",
          rows: [
            {
              icon: called || pill ? null : { glyph: "@" },
              content: `${actor}${seg.action.text}`,
              pills: movePills(seg.action.tags),
              ...(pill ? { actorPill: pill } : {}),
            },
            ...seg.rolls.map(rollRow),
            ...continuationRows(extras),
            ...seg.consequences.filter(isShown).flatMap(consequenceRows).filter(saysSomething),
          ].map((row) => withActor(row, seg.action.actor)),
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
            ...seg.consequences.filter(isShown).flatMap(consequenceRows).filter(saysSomething),
          ],
        });
        break;

      case "oracle": {
        const actor = seg.question.actor ? `(${seg.question.actor}) ` : "";
        // A question states its CF (`? [CF:4]`) or runs on the current one. Only
        // what was WRITTEN gets a pill — a stated value here, a `[CF±1]` op as its
        // own pill below; the running value surfaces where it is used (`vs CF`, a
        // Fate Chart row), not as a pill on every question.
        const cf = seg.question.chaosFactor ?? varsAt.get(id)?.CF;
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
        rows.push(...seg.consequences.filter(isShown).flatMap(consequenceRows).filter(saysSomething));
        items.push({ id, kind: "oracle", rows: rows.map((row) => withActor(row, seg.question.actor)) });
        break;
      }

      case "standalone-consequence": {
        const conclusion = (seg.entry.conclusion ?? "").trim();
        const initTags = seg.entry.tags.filter((t): t is InitiativeTag => t.kind === "initiative");
        // A bare `[Init: …]` line → the combat order, as its own entry.
        if (!conclusion && initTags.length > 0) {
          items.push({ id, kind: "initiative", rows: initiativeRows(initTags, initAt.get(id)?.order ?? []) });
          break;
        }
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
          rows: [...consequenceRows(seg.entry), ...continuationRows(extras)],
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

      case "round":
        items.push({
          id,
          kind: "round",
          rows: [{ icon: { lucide: "RotateCw" }, content: `Turn ${seg.round}`, pills: [] }],
        });
        break;

      case "turn":
        items.push({
          id,
          kind: "turn",
          rows: [{ icon: { lucide: "ChevronsRight" }, content: `${seg.actor}'s round`, pills: [] }],
        });
        break;

      default:
        // scenes, dialogue, narration, concat, structural markers
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
      // A question's stated `[CF:n]` is a set with no pill of its own to fill.
      const ops = dialOps.get(item.id)?.filter((op) => !op.stated);
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

  for (const item of items) {
    const vars = varsAt.get(item.id);
    if (vars && Object.keys(vars).length > 0) for (const row of item.rows) row.vars = vars;
  }

  // Combat order on entries that are not the bare `[Init:]` line: an action
  // taken ahead of its turn gets a pill; an `[Init:]` written on an `=>` line
  // (`=> Reinforcements arrive. [Init:+ Kobold Archer 14]`) lists the new order
  // under the entry it changed.
  for (const item of items) {
    const at = initAt.get(item.id);
    if (!at || item.kind === "initiative") continue;
    if (at.outOfTurn && item.rows[0]) {
      item.rows[0] = { ...item.rows[0], pills: [...item.rows[0].pills, { name: "out of turn", kind: "warn" }] };
    }
    if (at.changed) item.rows.push(...orderRows(at.order));
  }

  // The foes an entry mentions, listed under its first line: the link, with
  // the health they have at this point on hover.
  for (const item of items) {
    const all = foesAt.get(item.id);
    if (!all || all.length === 0 || item.rows.length === 0) continue;
    // A foe acting through a call on its page is named by the call already.
    const caller =
      item.kind === "action" && (item.rows[0].actorPill || leadingActionCall(item.rows[0].content))
        ? item.rows[0].actor
        : undefined;
    const others = caller
      ? all.filter(
          (f) =>
            combatantKey(f.name) !== combatantKey(caller) && matchActor(caller, [{ name: combatantKey(f.name) }]) < 0
        )
      : all;
    // The action's target is named on its line already (`→ Kobold, Tinkerer`):
    // what the entry did to it rides on its attack row instead of a row of its own.
    const target = item.kind === "action" ? actionTarget(item.rows[0].content) : undefined;
    const isTarget = (name: string) => !!target && combatantKey(name) === combatantKey(target);
    // A foe the entry only lifts a condition from (Mystic Mark leaving Fat
    // Kobold, A for its new target) needs no row; its HP, its state, a
    // condition it's given, do.
    const segHere = segments.find((s) => s.sourceIndex === item.id);
    const tagsOf = (name: string) =>
      (segHere ? segmentFoes(segHere) : []).filter((t) => combatantKey(t.name) === combatantKey(name));
    const onlyConditions = (name: string) => {
      const tags = tagsOf(name);
      return (
        tags.length > 0 &&
        tags.every((t) => !t.hp && !t.state && t.tags.every((x) => conditionChange(x)?.add === false))
      );
    };
    const foes = others.filter((f) => !isTarget(f.name) && !onlyConditions(f.name));
    const named = others.find((f) => isTarget(f.name));
    if (named) item.rows[0] = { ...item.rows[0], targetAs: named.name };
    if (target && foes.length < others.length) {
      const seg = segments.find((s) => s.sourceIndex === item.id);
      const changes = (seg ? segmentFoes(seg) : [])
        .filter((t) => isTarget(t.name))
        .flatMap((t) => t.tags.map(conditionChange).filter((c): c is ConditionChange => !!c));
      if (changes.length > 0) {
        const label = (r: SidebarRow) => r.content.split("|")[0] ?? "";
        const rolls = item.rows.map((r, i) => (r.rollable ? i : -1)).filter((i) => i >= 0);
        // On the roll that brought it on: a save the target failed (Magnetobolt's
        // STR save → prone), else the attack that hit, else the last roll.
        const at =
          rolls.find((i) => /\bsave\b/i.test(label(item.rows[i]))) ??
          rolls.find((i) => /attack/i.test(label(item.rows[i]))) ??
          rolls[rolls.length - 1] ??
          0;
        item.rows[at] = { ...item.rows[at], inflicts: changes };
      }
    }
    if (foes.length === 0) continue;
    const rows: SidebarRow[] = foes.map((f) => ({
      icon: null,
      detail: true,
      content: f.name,
      pills: [],
      foe: {
        current: f.current,
        max: f.max,
        state: f.state,
        ...(f.conditions?.length ? { conditions: f.conditions } : {}),
      },
    }));
    item.rows.splice(1, 0, ...rows);
  }

  return items;
}

// Re-export so the prose view can summarize rolls from one module.
export { summarizeRoll };

/** Give each action's actor pill the page it links to — the actor's sheet or
 *  statblock, as `pageOf` finds it from the name the log writes — and a damage
 *  row's target written plainly (`Talon`) a link to theirs (`[[Talon Pallton|Talon]]`). */
export function withActorPages(items: SidebarItem[], pageOf: (actor: string) => string | undefined): SidebarItem[] {
  return items.map((item) => {
    const rows = item.rows.map((row, i) => {
      if (i === 0 && row.actorPill && !row.actorPill.page) {
        const page = pageOf(row.actorPill.label);
        if (page) return { ...row, actorPill: { ...row.actorPill, page } };
      }
      if (row.leaves && !row.leaves.target.includes("[[")) {
        const page = pageOf(row.leaves.target);
        if (page) {
          const link = page === row.leaves.target ? `[[${page}]]` : `[[${page}|${row.leaves.target}]]`;
          return { ...row, leaves: { ...row.leaves, target: link } };
        }
      }
      return row;
    });
    return rows.some((r, i) => r !== item.rows[i]) ? { ...item, rows } : item;
  });
}
