/**
 * `rpg map` with `grid: hex` — an overworld hex map, in the hex-map-editor's
 * syntax below a small header:
 *
 *   grid: hex
 *   title: Dunlind
 *   pack: basic                # else the settings default
 *   seed: 7                    # reshuffles random variants
 *   scale: 6 mi
 *   coords: hover              # off | hover | always (else the settings default)
 *   regions:
 *     Dunlind: { color: "#8a3b2e", link: "[[Dunlind]]" }
 *   ---
 *   0m:
 *     * t(0,0): (Featherbark) [[Holy City of Featherbark]] city @Dunlind
 *     * s(0,0): buildings x3
 *     * p(1,0): roads
 *     * t(1,0): forest[lush] + #2e7d32
 *   100m:
 *     * t(2,0): mountain[snowy]
 *
 * Coordinates are axial `(q, r)`; `t` / `s` / `p` pick the terrain, stack or
 * path layer (bare `q,r:` is terrain). Everything the editor reads is read:
 * `(Label)`, `spec + #color`, a lone colour, empty hexes, `Nm:` height groups
 * with `*` items, and its legacy `q,r,content,color,terrain` lines. Added:
 * `[[Note]]` (a place), `@Region`, `xN` (scatter N copies).
 */

import { parse as parseYaml } from "yaml";
import type { Layer } from "./packs";

export interface HexCell {
  q: number;
  r: number;
  layer: Layer;
  /** Height group in metres (`100m:`), 0 by default. */
  height: number;
  spec?: string;
  color?: string;
  label?: string;
  /** Link text of a `[[Note]]`. */
  link?: string;
  regions: string[];
  /** `xN` — copies scattered on the hex. */
  count: number;
  /** 1-based line in the block. */
  line: number;
}

export interface HexRegion {
  name: string;
  color?: string;
  link?: string;
  parent?: string;
}

export interface HexMapError {
  line: number;
  message: string;
}

export type CoordMode = "off" | "hover" | "always";

export interface ParsedHexMap {
  title?: string;
  pack?: string;
  seed: string;
  scale?: string;
  /** Unset: the settings default. */
  coords?: CoordMode;
  regions: Record<string, HexRegion>;
  cells: HexCell[];
  errors: HexMapError[];
}

const NAMED_COLORS = new Set([
  "red",
  "green",
  "blue",
  "yellow",
  "orange",
  "purple",
  "pink",
  "brown",
  "black",
  "white",
  "gray",
  "grey",
  "cyan",
  "magenta",
  "lime",
  "navy",
  "teal",
  "silver",
  "maroon",
  "olive",
  "aqua",
  "fuchsia",
]);

function isColor(token: string): boolean {
  return /^#[0-9a-f]{3,8}$/i.test(token) || NAMED_COLORS.has(token.toLowerCase());
}

/** `grid: hex` in a block's head (above its `---`). */
export function isHexMapSource(source: string): boolean {
  const lines = source.split("\n");
  const sep = lines.findIndex((l) => l.trim() === "---");
  const head = sep >= 0 ? lines.slice(0, sep) : lines;
  return head.some((l) => /^\s*grid\s*:\s*["']?hex["']?\s*$/i.test(l));
}

/** Split on whitespace outside brackets and parentheses. */
function splitTokens(s: string): string[] {
  const out: string[] = [];
  let cur = "";
  let depth = 0;
  for (const ch of s) {
    if (ch === "[" || ch === "(") depth++;
    else if ((ch === "]" || ch === ")") && depth > 0) depth--;
    if (/\s/.test(ch) && depth === 0) {
      if (cur) out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur) out.push(cur);
  return out;
}

/** Drop a trailing ` # comment` (a colour `#abc` has no space after its `#`). */
function stripComment(line: string): string {
  const m = line.match(/(^|\s)#\s/);
  return m && m.index !== undefined ? line.slice(0, m.index) : line;
}

const HEAD_KEY = /^(grid|title|pack|seed|scale|coords)\s*:\s*(.*)$/;
const CELL = /^(?:([tps])\s*\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)|(-?\d+)\s*,\s*(-?\d+))\s*:(.*)$/;
const LEGACY = /^(-?\d+)\s*,\s*(-?\d+)\s*,(.*)$/;
const HEIGHT = /^(-?\d+)\s*m\s*:\s*$/;

const LAYER_OF: Record<string, Layer> = { t: "terrain", s: "stack", p: "path" };

function unquote(v: string): string {
  const t = v.trim();
  return /^(["']).*\1$/.test(t) ? t.slice(1, -1) : t;
}

function linkText(token: string): string {
  return token.replace(/^\[\[/, "").replace(/\]\]$/, "").trim();
}

function applyHeadValue(map: ParsedHexMap, key: string, value: unknown): void {
  const str = value === null || value === undefined ? "" : String(value).trim();
  if (key === "title" && str) map.title = str;
  else if (key === "pack" && str) map.pack = str;
  else if (key === "seed" && str) map.seed = str;
  else if (key === "scale" && str) map.scale = str;
  else if (key === "coords" && (str === "off" || str === "hover" || str === "always")) map.coords = str;
}

function readRegions(map: ParsedHexMap, raw: unknown): void {
  if (!raw || typeof raw !== "object") return;
  for (const [name, v] of Object.entries(raw as Record<string, unknown>)) {
    const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
    map.regions[name] = {
      name,
      color: typeof o.color === "string" ? o.color : undefined,
      link: typeof o.link === "string" ? linkText(o.link) : undefined,
      parent: typeof o.parent === "string" ? o.parent : undefined,
    };
  }
}

/** The content after `t(q,r):` — `(Label) spec + #color [[Note]] @Region xN`. */
function parseContent(cell: HexCell, content: string, errors: HexMapError[]): void {
  let rest = content.trim();
  const label = rest.match(/^\(([^)]*)\)\s*/);
  if (label) {
    cell.label = label[1].trim() || undefined;
    rest = rest.slice(label[0].length);
  }
  const tokens = splitTokens(rest);
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok.startsWith("[[") && tok.endsWith("]]")) {
      cell.link = linkText(tok);
    } else if (tok.startsWith("@") && tok.length > 1) {
      cell.regions.push(tok.slice(1));
    } else if (/^x\d+$/.test(tok)) {
      cell.count = Math.max(1, parseInt(tok.slice(1), 10));
    } else if (tok === "+") {
      const next = tokens[i + 1];
      if (next) {
        cell.color = next;
        i++;
      }
    } else if (tok.startsWith("+")) {
      cell.color = tok.slice(1);
    } else if (!cell.spec && !cell.color && isColor(tok)) {
      cell.color = tok;
    } else if (!cell.spec) {
      cell.spec = tok;
    } else {
      errors.push({ line: cell.line, message: `unexpected "${tok}" after "${cell.spec}"` });
    }
  }
}

export function parseHexMap(source: string): ParsedHexMap {
  const map: ParsedHexMap = { seed: "", regions: {}, cells: [], errors: [] };
  const lines = source.split("\n");
  const sep = lines.findIndex((l) => l.trim() === "---");
  let bodyStart = 0;
  if (sep >= 0) {
    bodyStart = sep + 1;
    const headText = lines.slice(0, sep).join("\n");
    try {
      const head = (parseYaml(headText) ?? {}) as Record<string, unknown>;
      for (const [k, v] of Object.entries(head)) {
        if (k === "regions") readRegions(map, v);
        else applyHeadValue(map, k, v);
      }
    } catch (err) {
      map.errors.push({
        line: 1,
        message: `header: ${err instanceof Error ? err.message.split("\n")[0] : "invalid YAML"}`,
      });
    }
  }

  let height = 0;
  const terrainAt = new Map<string, number>();
  for (let i = bodyStart; i < lines.length; i++) {
    const lineNo = i + 1;
    let line = stripComment(lines[i]).trim();
    if (!line) continue;
    if (line.startsWith("*")) line = line.slice(1).trim();

    const head = line.match(HEAD_KEY);
    if (head) {
      applyHeadValue(map, head[1], unquote(head[2]));
      continue;
    }
    const h = line.match(HEIGHT);
    if (h) {
      height = parseInt(h[1], 10);
      continue;
    }

    const c = line.match(CELL);
    let cell: HexCell | null = null;
    if (c) {
      const layer = c[1] ? LAYER_OF[c[1]] : "terrain";
      const q = parseInt(c[2] ?? c[4], 10);
      const r = parseInt(c[3] ?? c[5], 10);
      cell = { q, r, layer, height, regions: [], count: 1, line: lineNo };
      parseContent(cell, c[6], map.errors);
    } else {
      const legacy = line.match(LEGACY);
      if (legacy) {
        const [content, color, terrain] = legacy[3].split(",").map((p) => p.trim());
        cell = {
          q: parseInt(legacy[1], 10),
          r: parseInt(legacy[2], 10),
          layer: "terrain",
          height,
          regions: [],
          count: 1,
          line: lineNo,
          label: content || undefined,
          color: color || undefined,
          spec: terrain || undefined,
        };
      }
    }
    if (!cell) {
      map.errors.push({
        line: lineNo,
        message: `not a hex line: "${line}" — expected t(q,r): …, s(q,r): …, p(q,r): … or Nm:`,
      });
      continue;
    }
    // One terrain per hex and height: a later line replaces it. Stacks and
    // paths add up.
    if (cell.layer === "terrain") {
      const key = `${cell.q},${cell.r},${cell.height}`;
      const prev = terrainAt.get(key);
      if (prev !== undefined) {
        map.cells[prev] = cell;
        continue;
      }
      terrainAt.set(key, map.cells.length);
    }
    map.cells.push(cell);
  }
  return map;
}
