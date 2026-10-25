/**
 * Editing a hex map's block text: what paint mode (§13 of the design) writes.
 * Pure, on the block's source, so the note stays the save and every change
 * reads like a hand-typed line.
 *
 * Edits touch as little as they can: painting terrain swaps only the spec on
 * the hex's `t` line, keeping its `(Label)`, `[[Note]]`, `@Region`, colour and
 * comment. New lines go into their `Nm:` height group, written the way that
 * group's lines already are (`  * t(q,r): …`).
 */

import { parseDocument } from "yaml";
import {
  type HexCell,
  type HexLook,
  mainEnd,
  parseHexMap,
  type ParsedHexMap,
  readLook,
  splitTokens,
} from "./parse-hex-map";
import type { Layer } from "./packs";

/** The layers painted per hex (markers and labels stand on a point instead). */
export type CellLayer = Extract<Layer, "terrain" | "base" | "edge" | "path" | "stack">;

export const LAYER_PREFIX: Record<CellLayer, string> = { terrain: "t", base: "b", edge: "e", path: "p", stack: "s" };

export type HexEdit =
  /** Put `spec` on the hex: terrain and base replace theirs, paths and edges
   *  add one unless it's there, stacks add one or another copy (`x2`). */
  | { kind: "paint"; layer: CellLayer; q: number; r: number; spec: string; height?: number }
  /** Take the top item of the layer off the hex (terrain: the whole line). */
  | { kind: "erase"; layer: CellLayer; q: number; r: number }
  /** A marker (`m`) or label (`l`) line at a point, fractions allowed. */
  | { kind: "point"; layer: "marker" | "label"; q: number; r: number; content: string }
  /** Drop a line (1-based, as the parser numbers them). */
  | { kind: "remove"; line: number }
  /** Add or remove `@name` on the hex's terrain line (toggled when `on` is unset). */
  | { kind: "region"; q: number; r: number; name: string; on?: boolean }
  /** Move the hex's lines into the `Nm:` group of `height`. */
  | { kind: "height"; q: number; r: number; height: number }
  /** Set a line's look (`size=` `shift=` `hue=` `sat=` `bright=`); unset keys and defaults are dropped. */
  | { kind: "look"; line: number; look: HexLook }
  /** Tint a hex's edges or paths: every line of the layer takes this colour (its size and shift stay).
   *  A coast that lays itself takes a line of its own with only the colour (`e(q,r): hue=30`). */
  | { kind: "tint"; layer: "edge" | "path"; q: number; r: number; tint: HexTint }
  /** Put a custom tile down (`c(q,r): name rot=N`), at the hex's height. */
  | { kind: "stamp"; q: number; r: number; name: string; rot: number; height?: number }
  /** A line swapped for these items, each put in its height group (a stamp expanded). */
  | { kind: "replace"; line: number; items: Array<{ height: number; item: string }> }
  /** A marker or label line moved to another point (fractions allowed). */
  | { kind: "move"; line: number; q: number; r: number }
  /** A marker or label line's content (after `m(q,r):`) rewritten; its point and comment stay. */
  | { kind: "content"; line: number; content: string }
  /** A header key set (objects and lists written on one line) or, with `null`, removed. */
  | { kind: "header"; key: string; value: unknown }
  /** One region's declaration under `regions:` set (on one line) or, with `null`, removed; the others stay. */
  | { kind: "region-decl"; id: string; value: Record<string, unknown> | null }
  /** Swap two lines' positions (for reordering stacks): line1 moves to line2's position, line2 shifts accordingly. */
  | { kind: "swap"; line1: number; line2: number };

/** How a rewritten header is written: long lines (a region's one-line declaration) aren't folded. */
const HEAD_YAML = { lineWidth: 0 } as const;

/** `t(q,r):` / `q,r:` up to the colon, then the rest. */
const LEAD = /^(\s*(?:\*\s*)?)((?:[tpseb]\s*\(\s*-?\d+\s*,\s*-?\d+\s*\)|-?\d+\s*,\s*-?\d+)\s*:)(.*)$/;
/** Any item; `CELL_ITEM`: a hex's (not a marker or label, which stand anywhere). */
const ITEM = /^(\s*(?:\*\s*)?)(?:[tpsebmlc]\s*\(|stamp\s*\(|-?\d+\s*,)/;
const CELL_ITEM = /^(\s*(?:\*\s*)?)(?:[tpseb]\s*\(|c\s*\(|stamp\s*\(|-?\d+\s*,)/;

/** A number as a map writes it: at most two decimals, no trailing zeros. */
export function formatCoord(n: number): string {
  return String(Math.round(n * 100) / 100);
}

export function cellsAt(map: ParsedHexMap, q: number, r: number, layer?: Layer): HexCell[] {
  return map.cells.filter((c) => c.q === q && c.r === r && (!layer || c.layer === layer));
}

/** The hex's top terrain line (the highest group; the last of equals). */
function topTerrain(map: ParsedHexMap, q: number, r: number): HexCell | undefined {
  let top: HexCell | undefined;
  for (const c of cellsAt(map, q, r, "terrain")) if (!top || c.height >= top.height) top = c;
  return top;
}

/** The height a hex stands at: its top terrain's, else any line's, else none. */
function heightOf(map: ParsedHexMap, q: number, r: number): number | undefined {
  return topTerrain(map, q, r)?.height ?? cellsAt(map, q, r)[0]?.height;
}

interface SplitLine {
  indent: string;
  lead: string;
  label?: string;
  tokens: string[];
  comment: string;
}

/** A cell line in its parts: indent, `t(q,r):`, `(Label)`, tokens, ` # comment`. */
function splitLine(text: string): SplitLine | null {
  const m = text.match(LEAD);
  if (!m) return null;
  let body = m[3];
  let comment = "";
  const c = body.match(/(^|\s)#\s/);
  if (c && c.index !== undefined) {
    comment = body.slice(c.index).trimEnd();
    body = body.slice(0, c.index);
  }
  body = body.trim();
  let label: string | undefined;
  const lm = body.match(/^\(([^)]*)\)\s*/);
  if (lm) {
    label = lm[0].trim();
    body = body.slice(lm[0].length);
  }
  return { indent: m[1], lead: m[2], label, tokens: splitTokens(body), comment };
}

function joinLine(s: SplitLine): string {
  const content = [s.label, ...s.tokens].filter(Boolean).join(" ");
  return `${s.indent}${s.lead}${content ? ` ${content}` : ""}${s.comment ? ` ${s.comment.trim()}` : ""}`;
}

const isColorToken = (t: string) => /^#[0-9a-f]{3,8}$/i.test(t);

/** Which token is the spec, read the way the parser reads it: the first that
 *  isn't a link, region, count, colour or `key=value`. -1: none. */
function specIndex(tokens: string[]): number {
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === "+") {
      i++;
      continue;
    }
    if (t.startsWith("+") || t.startsWith("@") || (t.startsWith("[[") && t.endsWith("]]"))) continue;
    if (/^x\d+$/.test(t) || /^[a-z]+=/i.test(t) || isColorToken(t)) continue;
    return i;
  }
  return -1;
}

/** The same line with its spec swapped (or added, after the label). */
function withSpec(text: string, spec: string): string {
  const s = splitLine(text);
  if (!s) return text;
  const i = specIndex(s.tokens);
  if (i >= 0) s.tokens[i] = spec;
  else s.tokens.unshift(spec);
  return joinLine(s);
}

/** The same line one copy more (`x2`, `x3` …). */
function withCopy(text: string): string {
  const s = splitLine(text);
  if (!s) return text;
  const i = s.tokens.findIndex((t) => /^x\d+$/.test(t));
  if (i >= 0) s.tokens[i] = `x${parseInt(s.tokens[i].slice(1), 10) + 1}`;
  else s.tokens.push("x2");
  return joinLine(s);
}

function withRegion(text: string, name: string, on: boolean | undefined): string {
  const s = splitLine(text);
  if (!s) return text;
  const tag = `@${name}`;
  const has = s.tokens.includes(tag);
  const want = on ?? !has;
  if (want && !has) s.tokens.push(tag);
  if (!want) s.tokens = s.tokens.filter((t) => t !== tag);
  return joinLine(s);
}

/** The colour part of a look, which the Select tool's Tint sets on many hexes at once. */
export type HexTint = Pick<HexLook, "hue" | "sat" | "bright">;

const round = (n: number) => String(Math.round(n * 100) / 100);

/** A look as tokens, defaults left out. */
export function lookTokens(look: HexLook): string[] {
  const out: string[] = [];
  if (look.size !== undefined && look.size !== 1) out.push(`size=${round(look.size)}`);
  if (look.shift && (look.shift[0] || look.shift[1])) out.push(`shift=${round(look.shift[0])},${round(look.shift[1])}`);
  if (look.hue) out.push(`hue=${round(look.hue)}`);
  if (look.sat !== undefined && look.sat !== 1) out.push(`sat=${round(look.sat)}`);
  if (look.bright !== undefined && look.bright !== 1) out.push(`bright=${round(look.bright)}`);
  return out;
}

function withLook(text: string, look: HexLook): string {
  const s = splitLine(text);
  if (!s) return text;
  s.tokens = [...s.tokens.filter((t) => !readLook({}, t)), ...lookTokens(look)];
  return joinLine(s);
}

/** A line's text from its first item character on (`t(q,r): …` without indent or bullet). */
function itemText(text: string): string {
  return text.replace(/^\s*(?:\*\s*)?/, "");
}

interface Span {
  /** 0-based index range of the group's lines, after its heading. */
  from: number;
  to: number;
  /** 0-based heading index; undefined: the lines before any heading. */
  heading?: number;
}

/** Where the lines of `height` go, and how they're written. */
function groupSpan(lines: string[], map: ParsedHexMap, height: number): { span: Span | null; prefix: string } {
  const body = (map.body ?? 1) - 1;
  const groups = map.groups ?? [];
  const spans: Array<Span & { height: number }> = [];
  const firstHeading = groups.length ? groups[0].line - 1 : lines.length;
  spans.push({ from: body, to: firstHeading, height: 0 });
  groups.forEach((g, i) =>
    spans.push({
      from: g.line,
      to: i + 1 < groups.length ? groups[i + 1].line - 1 : lines.length,
      heading: g.line - 1,
      height: g.height,
    })
  );
  const hasItems = (s: Span) => lines.slice(s.from, s.to).some((l) => CELL_ITEM.test(l));
  const implicit = spans[0];
  const span =
    spans.find((s) => s.heading !== undefined && s.height === height) ??
    (height === 0 && (groups.length === 0 || hasItems(implicit)) ? implicit : null);
  // Written like the group's own items, else like any item in a group, else bare.
  const prefixIn = (s: Span) => {
    for (let i = s.to - 1; i >= s.from; i--) {
      const m = lines[i].match(CELL_ITEM);
      if (m) return m[1];
    }
    return null;
  };
  let prefix = span ? prefixIn(span) : null;
  if (prefix === null) {
    const grouped = spans.find((s) => s.heading !== undefined && prefixIn(s) !== null);
    prefix = span && span.heading === undefined ? "" : grouped ? prefixIn(grouped)! : "  * ";
  }
  return { span, prefix };
}

/** Lines with `item` (`t(q,r): …`) put in its height group, after the group's last item. */
function insertItem(lines: string[], map: ParsedHexMap, height: number, item: string): string[] {
  const { span, prefix } = groupSpan(lines, map, height);
  const out = [...lines];
  if (!span) {
    // No group of that height yet: a new one at the end.
    while (out.length && !out[out.length - 1].trim()) out.pop();
    out.push(`${height}m:`, `${prefix}${item}`);
    return out;
  }
  let at = span.heading !== undefined ? span.heading + 1 : span.from;
  for (let i = span.from; i < span.to; i++) if (CELL_ITEM.test(lines[i])) at = i + 1;
  out.splice(at, 0, `${prefix}${item}`);
  return out;
}

/** A point line (`m(q,r): …`, `l(q,r): …`) after the body's last item. */
function insertPoint(lines: string[], map: ParsedHexMap, item: string): string[] {
  const body = (map.body ?? 1) - 1;
  let at = lines.length;
  let prefix = "";
  for (let i = lines.length - 1; i >= body; i--) {
    const m = lines[i].match(ITEM);
    if (m) {
      at = i + 1;
      prefix = m[1];
      break;
    }
  }
  if (at === lines.length) while (at > body && !lines[at - 1].trim()) at--;
  const out = [...lines];
  out.splice(at, 0, `${prefix}${item}`);
  return out;
}

function applyOne(source: string, edit: HexEdit): string {
  const map = parseHexMap(source);
  const lines = source.split("\n");
  const set = (line: number, text: string) => {
    const out = [...lines];
    out[line - 1] = text;
    return out.join("\n");
  };
  const drop = (line: number) => lines.filter((_, i) => i !== line - 1).join("\n");

  switch (edit.kind) {
    case "paint": {
      const { layer, q, r, spec } = edit;
      const at = heightOf(map, q, r) ?? edit.height ?? 0;
      const item = `${LAYER_PREFIX[layer]}(${q},${r}): ${spec}`;
      if (layer === "terrain") {
        const top = topTerrain(map, q, r);
        if (top) return top.spec === spec ? source : set(top.line, withSpec(lines[top.line - 1], spec));
      } else if (layer === "base") {
        const own = cellsAt(map, q, r, "base").pop();
        if (own) return own.spec === spec ? source : set(own.line, withSpec(lines[own.line - 1], spec));
      } else {
        const same = cellsAt(map, q, r, layer).find((c) => c.spec === spec);
        if (same) return layer === "stack" ? set(same.line, withCopy(lines[same.line - 1])) : source;
      }
      return insertItem(lines, map, at, item).join("\n");
    }
    case "erase": {
      // A coast's tint line (no tile of its own) isn't an edge to erase.
      const cells = cellsAt(map, edit.q, edit.r, edit.layer).filter((c) => edit.layer !== "edge" || c.spec);
      const target = edit.layer === "terrain" ? topTerrain(map, edit.q, edit.r) : cells[cells.length - 1];
      if (target) return drop(target.line);
      // Edges lay themselves: erasing a hex's own coast writes it off by hand.
      if (edit.layer === "edge" && cellsAt(map, edit.q, edit.r).length) {
        const at = heightOf(map, edit.q, edit.r) ?? 0;
        return insertItem(lines, map, at, `e(${edit.q},${edit.r}): none`).join("\n");
      }
      return source;
    }
    case "point": {
      const prefix = edit.layer === "marker" ? "m" : "l";
      const item = `${prefix}(${formatCoord(edit.q)},${formatCoord(edit.r)}): ${edit.content.trim()}`;
      return insertPoint(lines, map, item).join("\n");
    }
    case "look":
      return edit.line >= 1 && edit.line <= lines.length
        ? set(edit.line, withLook(lines[edit.line - 1], edit.look))
        : source;
    case "tint": {
      const { layer, q, r, tint } = edit;
      const tinted = (look: HexLook = {}): HexLook => ({
        ...look,
        hue: tint.hue,
        sat: tint.sat,
        bright: tint.bright,
      });
      const cells = cellsAt(map, q, r, layer);
      const own = cells.filter((c) => c.spec);
      // Edges placed by hand (or `none`) and paths: each line recoloured.
      if (own.length) {
        let out = lines;
        for (const c of own)
          out = [...out.slice(0, c.line - 1), withLook(out[c.line - 1], tinted(c.look)), ...out.slice(c.line)];
        return out.join("\n");
      }
      if (layer !== "edge") return source;
      // The coast lays itself: its tint is a line with only the colour, gone when it's back to as drawn.
      const line = cells[cells.length - 1];
      const tokens = lookTokens(tinted());
      if (line) return tokens.length ? set(line.line, withLook(lines[line.line - 1], tinted())) : drop(line.line);
      if (!tokens.length || !cellsAt(map, q, r).length) return source;
      return insertItem(lines, map, heightOf(map, q, r) ?? 0, `e(${q},${r}): ${tokens.join(" ")}`).join("\n");
    }
    case "stamp": {
      const at = heightOf(map, edit.q, edit.r) ?? edit.height ?? 0;
      const rot = ((edit.rot % 6) + 6) % 6;
      const item = `c(${edit.q},${edit.r}): ${edit.name}${rot ? ` rot=${rot}` : ""}`;
      // One custom tile per hex: the same one again changes nothing, another replaces it.
      const there = (map.stamps ?? []).filter((st) => st.q === edit.q && st.r === edit.r).pop();
      if (there) {
        if (there.name === edit.name && there.rot === rot) return source;
        const indent = lines[there.line - 1].match(/^\s*(?:\*\s*)?/)?.[0] ?? "";
        return set(there.line, `${indent}${item}`);
      }
      return insertItem(lines, map, at, item).join("\n");
    }
    case "replace": {
      if (edit.line < 1 || edit.line > lines.length) return source;
      let text = drop(edit.line);
      for (const { height, item } of edit.items) {
        text = insertItem(text.split("\n"), parseHexMap(text), height, item).join("\n");
      }
      return text;
    }
    case "region-decl": {
      const sep = lines.findIndex((l) => l.trim() === "---");
      if (sep < 0) return source;
      const doc = parseDocument(lines.slice(0, sep).join("\n"));
      if (edit.value === null) doc.deleteIn(["regions", edit.id]);
      else doc.setIn(["regions", edit.id], doc.createNode(edit.value, { flow: true }));
      const head = doc.toString(HEAD_YAML).replace(/\n+$/, "");
      return [...(head ? head.split("\n") : []), ...lines.slice(sep)].join("\n");
    }
    case "header": {
      const sep = lines.findIndex((l) => l.trim() === "---");
      if (sep < 0) return source;
      const doc = parseDocument(lines.slice(0, sep).join("\n"));
      if (edit.value === null || edit.value === undefined) doc.delete(edit.key);
      else doc.set(edit.key, typeof edit.value === "object" ? doc.createNode(edit.value, { flow: true }) : edit.value);
      const head = doc.toString(HEAD_YAML).replace(/\n+$/, "");
      return [...(head ? head.split("\n") : []), ...lines.slice(sep)].join("\n");
    }
    case "move": {
      const text = lines[edit.line - 1];
      if (text === undefined) return source;
      const m = text.match(/^(\s*(?:\*\s*)?)([ml]\s*)\(\s*[-\d.]+\s*,\s*[-\d.]+\s*\)/);
      if (!m) return source;
      return set(edit.line, text.replace(m[0], `${m[1]}${m[2].trim()}(${formatCoord(edit.q)},${formatCoord(edit.r)})`));
    }
    case "content": {
      const text = lines[edit.line - 1];
      if (text === undefined) return source;
      const m = text.match(/^(\s*(?:\*\s*)?[ml]\s*\(\s*[-\d.]+\s*,\s*[-\d.]+\s*\)\s*:)/);
      if (!m) return source;
      // A trailing ` # comment` belongs to the line, not its content.
      const comment = text.match(/(\s+#\s.*)$/)?.[1] ?? "";
      return set(edit.line, `${m[1]} ${edit.content.trim()}${comment}`);
    }
    case "swap": {
      const { line1, line2 } = edit;
      if (line1 < 1 || line1 > lines.length || line2 < 1 || line2 > lines.length) return source;
      if (line1 === line2) return source;
      const out = [...lines];
      const tmp = out[line1 - 1];
      out[line1 - 1] = out[line2 - 1];
      out[line2 - 1] = tmp;
      return out.join("\n");
    }
    case "remove":
      return edit.line >= 1 && edit.line <= lines.length ? drop(edit.line) : source;
    case "region": {
      const top = topTerrain(map, edit.q, edit.r);
      if (top) return set(top.line, withRegion(lines[top.line - 1], edit.name, edit.on));
      if (edit.on === false) return source;
      const at = heightOf(map, edit.q, edit.r) ?? 0;
      return insertItem(lines, map, at, `t(${edit.q},${edit.r}): @${edit.name}`).join("\n");
    }
    case "height": {
      const from = heightOf(map, edit.q, edit.r);
      if (from === undefined || from === edit.height) return source;
      const moving = cellsAt(map, edit.q, edit.r).filter((c) => c.height === from);
      const items = moving.map((c) => itemText(lines[c.line - 1]));
      const gone = new Set(moving.map((c) => c.line - 1));
      let text = lines.filter((_, i) => !gone.has(i)).join("\n");
      for (const item of items) {
        const next = parseHexMap(text);
        text = insertItem(text.split("\n"), next, edit.height, item).join("\n");
      }
      return text;
    }
  }
}

/** One edit to the main map: its levels (after it) are left as they are. */
function applyMain(source: string, edit: HexEdit): string {
  const lines = source.split("\n");
  const end = mainEnd(source);
  if (end >= lines.length || edit.kind === "header") return applyOne(source, edit);
  const main = applyOne(lines.slice(0, end).join("\n"), edit).split("\n");
  // The main map ends with a blank line before its details, as it began.
  while (main.length && !main[main.length - 1].trim()) main.pop();
  return [...main, ...(lines[end - 1]?.trim() ? [] : [""]), ...lines.slice(end)].join("\n");
}

/** The block's source with the edits applied, in order. */
export function applyHexEdits(source: string, edits: HexEdit[]): string {
  return edits.reduce(applyMain, source);
}
