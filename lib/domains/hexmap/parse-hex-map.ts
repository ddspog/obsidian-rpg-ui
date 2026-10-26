/**
 * `rpg map` with `grid: hex` — an overworld hex map, in the hex-map-editor's
 * syntax below a small header:
 *
 *   grid: hex
 *   title: Dunlind
 *   pack: basic                # else the settings default
 *   seed: 7                    # reshuffles random variants
 *   scale: 6 mi
 *   step: 100 m                # metres per height step (100 m if not given)
 *   coords: hover              # off | hover | always (else the settings default)
 *   origin: [4, 0]             # this map's (0,0) among its neighbours (imports.ts)
 *   import: ["[[Rindelbran map]]"]   # other notes' maps drawn in this one
 *   regions:
 *     Dunlind: { color: "#8a3b2e", link: "[[Dunlind]]" }
 *   ---
 *   0m:
 *     * t(0,0): (Featherbark) [[Holy City of Featherbark]] city @Dunlind
 *     * s(0,0): buildings x3
 *     * p(1,0): roads
 *     * t(1,0): forest[lush] + #2e7d32
 *   100m: base=rocky           # the group's base, unless a hex has its own
 *     * t(2,0): mountain[snowy]
 *     * b(2,0): level
 *   l(1.5,-0.5): (The Sunken Coast) title-1 size=1.2 rot=-4
 *
 * Coordinates are axial `(q, r)`; `t` / `s` / `p` pick the terrain, stack or
 * path layer (bare `q,r:` is terrain), `e` an edge piece placed by hand
 * (edges along water are laid by themselves; `e(q,r): hue=30`, with no tile,
 * only colours them), and `b` the hex's base, the
 * slab under it. Everything the editor reads is read:
 * `(Label)`, `spec + #color`, a lone colour, empty hexes, `Nm:` height groups
 * with `*` items, and its legacy `q,r,content,color,terrain` lines. Added:
 * `[[Note]]` (a place), `@Region`, `xN` (scatter N copies).
 *
 * `l(q,r)` puts a label anywhere: its coordinates may be fractions, between
 * hexes. `(Text)` (or a `[[Note]]`'s name), then a label family from the
 * pack's `label/` folder (`title-1`), `size=` (banner height, 1 by default),
 * `rot=` (degrees) and `#colour` (text).
 *
 * `m(q,r)` stands a marker on a point (fractions too): a style and its mark
 * from the pack's `marker/` folder (`pedestal-gold[tower]`, a catalog name),
 * then `(Name)` (its caption), `[[Note]]` and `size=`.
 */

import { parse as parseYaml } from "yaml";
import { type HexImport, readImports } from "./imports";
import type { Layer } from "./packs";

export interface HexCell {
  q: number;
  r: number;
  layer: Layer;
  /** Height group in metres (`100m:`), 0 by default. */
  height: number;
  /** The group's base (`100m: base=rocky`). */
  groupBase?: string;
  spec?: string;
  color?: string;
  label?: string;
  /** Link text of a `[[Note]]`. */
  link?: string;
  regions: string[];
  /** `xN` — copies scattered on the hex. */
  count: number;
  /** `size=` `shift=` `hue=` `sat=` `bright=` — how the tile is drawn (design §13.2). */
  look?: HexLook;
  /** Put down by this stamp (its line is the `stamp(q,r)` line). */
  stamp?: string;
  /** A neighbouring map's, imported `show: faint`: drawn dimmed, and only there for context. */
  faint?: boolean;
  /** A faint neighbour's regions: drawn with it (outlines and names dimmed), not this map's to edit. */
  faintRegions?: string[];
  /** 1-based line in the block. */
  line: number;
}

/** How a hex line's tile is drawn, beyond its pack's tuning. */
export interface HexLook {
  /** Scale around the hex centre (0.4–5). */
  size?: number;
  /** Offset in hex widths: right, down. */
  shift?: [number, number];
  /** Hue turn in degrees. */
  hue?: number;
  /** Saturation multiplier (0 grey, 1 as drawn). */
  sat?: number;
  /** Brightness multiplier (0 black, 1 as drawn). */
  bright?: number;
}

const LOOK = /^(size|shift|hue|sat|bright)=(-?\d*\.?\d+)(?:,(-?\d*\.?\d+))?$/i;

/** `size=1.5` `shift=0.1,-0.2` `hue=40` `sat=0.6` `bright=1.2` → into `look`; false when the token isn't one. */
export function readLook(look: HexLook, token: string): boolean {
  const m = token.match(LOOK);
  if (!m) return false;
  const key = m[1].toLowerCase();
  const a = parseFloat(m[2]);
  if (key === "shift") look.shift = [a, m[3] !== undefined ? parseFloat(m[3]) : 0];
  else if (m[3] !== undefined) return false;
  else if (key === "size") look.size = Math.min(5, Math.max(0.4, a));
  else if (key === "hue") look.hue = a;
  else if (key === "bright") look.bright = Math.max(0, a);
  else look.sat = Math.max(0, a);
  return true;
}

export interface HexRegion {
  name: string;
  /** The name drawn (`label:`); unset: the linked note's name, else `name`. `false`: none
   *  (the map letters it itself, with an `l(q,r)` line). */
  label?: string | false;
  /** The fill's colour (`tint:`); unset: `color`, which is the border's. */
  tint?: string;
  /** How strong the fill is (`tintOpacity: 0.4`), 0–1; unset: the stylesheet's. */
  tintOpacity?: number;
  /** Where the name is drawn (`at: [q, r]`, fractions allowed); unset: the member hex nearest the middle. */
  at?: [number, number];
  /** `labelAt: border` — the name small, just inside the region's top border; `middle` (the default) across it. */
  labelAt?: "border" | "bottom" | "middle";
  /** The name's colour (`labelColor:`); unset: the border's. */
  labelColor?: string;
  /** The rest of how the name is drawn (`label: { size, offset, rot, style, halo, case, arc, spacing }`). */
  labelLook?: RegionLabelLook;
  /** The hex the name is put on (`label: { on: [q, r] }`): its top or bottom side, or its middle. */
  labelOn?: [number, number];
  color?: string;
  link?: string;
  parent?: string;
  /** How it's marked on the map (`demark:`): `outline` only, `fill` only, or `none`; unset: both. */
  demark?: "outline" | "fill" | "none";
  /** `override: true` — this map's fields go over the region's own map's, here only (an exception). */
  override?: boolean;
  /** The note whose map the region is (when it's imported), set when maps are merged. */
  source?: string;
}

/** How a region's name is drawn, beyond its text, place and colour. */
export interface RegionLabelLook {
  /** Times the usual size. */
  size?: number;
  /** Nudged from its spot, in hex radii: right, down. */
  offset?: [number, number];
  /** Turned, in degrees. */
  rot?: number;
  /** A lettering style from the pack's `labels:` (its font, weight, colour and halo). */
  style?: string;
  /** The outline round the letters: a colour, or `false` for none. */
  halo?: string | false;
  /** In capitals; unset: capitals unless it has a lettering style. (Older form of `case`.) */
  caps?: boolean;
  /** UPPER, Title, lower, or as written (`none`); over `caps`. */
  case?: "upper" | "title" | "lower" | "none";
  /** Bent along an arc of this many degrees (positive bows up). */
  arc?: number;
  /** Letter spacing, in ems. */
  spacing?: number;
  /** At most this wide, in hex radii; a longer name goes on more lines. */
  width?: number;
}

/**
 * A `label:` as a region (or an import entry) writes it: the name (`The Clodgate`), `false` (none),
 * or the whole object `{ text, at, color, size, offset, rot, style, halo, caps, spacing }`, where
 * `at` is `middle`, `border`, `none` or a hex `[q, r]`. Gives the region fields it sets.
 */
export function readRegionLabel(raw: unknown, keywords = false): Partial<HexRegion> {
  if (raw === false) return { label: false };
  if (typeof raw === "string") {
    const t = raw.trim();
    // On an import entry a word says where its regions' names go.
    if (keywords)
      return t === "none"
        ? { label: false }
        : t === "border" || t === "top" || t === "bottom" || t === "middle"
          ? { labelAt: t === "top" ? "border" : t }
          : {};
    return t ? { label: t } : {};
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const out: Partial<HexRegion> = {};
  if (typeof o.text === "string" && o.text.trim()) out.label = o.text.trim();
  if (o.at === "none" || o.show === false) out.label = false;
  else if (o.at === "border" || o.at === "top") out.labelAt = "border";
  else if (o.at === "bottom" || o.at === "middle") out.labelAt = o.at;
  else if (pair(o.at)) out.at = pair(o.at);
  if (typeof o.color === "string") out.labelColor = o.color;
  if (pair(o.on)) out.labelOn = pair(o.on);
  const look: RegionLabelLook = {};
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
  if (n(o.size) !== undefined) look.size = Math.max(0.1, n(o.size)!);
  if (pair(o.offset)) look.offset = pair(o.offset);
  if (n(o.rot) !== undefined) look.rot = n(o.rot);
  if (typeof o.style === "string" && o.style.trim()) look.style = o.style.trim();
  if (o.halo === false || o.halo === "none") look.halo = false;
  else if (typeof o.halo === "string") look.halo = o.halo;
  if (typeof o.caps === "boolean") look.caps = o.caps;
  if (o.case === "upper" || o.case === "title" || o.case === "lower" || o.case === "none") look.case = o.case;
  if (n(o.arc) !== undefined) look.arc = Math.max(-300, Math.min(300, n(o.arc)!));
  if (n(o.spacing) !== undefined) look.spacing = n(o.spacing);
  if (n(o.width) !== undefined && n(o.width)! > 0) look.width = n(o.width);
  if (Object.keys(look).length) out.labelLook = look;
  return out;
}

export interface HexMapError {
  line: number;
  message: string;
}

/** `l(q,r): (Text) family …` — a banner put together to fit its text. */
export interface HexLabelLine {
  /** Axial, fractions allowed. */
  q: number;
  r: number;
  text?: string;
  link?: string;
  /** A `label/` folder of the pack; unset: its first. */
  family?: string;
  size: number;
  rot: number;
  /** `arc=` — the text bends along an arc of this many degrees (positive bows upwards). */
  arc?: number;
  /** `width=` — lettering at most this wide, in hex radii; longer text goes on more lines. */
  width?: number;
  /** `line=` — lettering's outline: a colour, or `none` (`false`); unset: its style's. */
  halo?: string | false;
  /** `case=` — UPPER, Title, lower, or as written. */
  case?: "upper" | "title" | "lower" | "none";
  /** `space=` — letter spacing, in ems; unset: its style's. */
  spacing?: number;
  color?: string;
  /** A faint neighbour's: drawn dimmed, not counted in the map's bounds. */
  faint?: boolean;
  line: number;
}

/** `m(q,r): style[mark] (Name) [[Note]]` — a pin, flag or pedestal standing on a point. */
export interface HexMarkerLine {
  /** Axial, fractions allowed. */
  q: number;
  r: number;
  spec?: string;
  text?: string;
  link?: string;
  size: number;
  /** `piece` — moves in Play mode (party figures are pieces anyway). */
  piece?: boolean;
  /** How its caption is drawn: `text=place` (a lettering style), `tsize=`, `toff=dx,dy` (hex radii), `arc=`, `#colour`. */
  caption?: MarkerCaption;
  /** A faint neighbour's: drawn dimmed, not counted in the map's bounds. */
  faint?: boolean;
  line: number;
}

export interface MarkerCaption {
  /** A lettering style from the pack's `labels:` (font, weight, colour, halo). */
  style?: string;
  /** Size, 1 by default. */
  size?: number;
  /** Moved from its spot under the marker, in hex radii: right, down. */
  offset?: [number, number];
  /** Bent along an arc of this many degrees (positive bows up). */
  arc?: number;
  color?: string;
  /** The outline round its letters: a colour, or `false` for none (`tline=`). */
  halo?: string | false;
  /** UPPER, Title, lower, or as written (`tcase=`). */
  case?: "upper" | "title" | "lower" | "none";
  /** Turned, in degrees (`trot=`). */
  rot?: number;
  /** Letter spacing, in ems (`tspace=`). */
  spacing?: number;
  /** At most this wide, in hex radii; longer text goes on more lines (`twidth=`). */
  width?: number;
}

/** A marker Play mode moves: flagged `piece`, or a party figure. */
export function isPiece(m: HexMarkerLine): boolean {
  return !!m.piece || /^party\b/i.test(m.spec ?? "") || /\[party-\d+\]/i.test(m.spec ?? "");
}

/** `c(q,r): name rot=N` — a custom tile from the pack's `custom:` put down here (design §13.3). */
export interface HexStampLine {
  q: number;
  r: number;
  name: string;
  /** Turned this many 60° steps clockwise (0–5). */
  rot: number;
  /** The height group it's in: added to the stamp's own heights. */
  height: number;
  line: number;
}

/** `view:` — where the block opens: a level, zoomed in on the fitted map (design §14.3). */
export interface HexStartView {
  /** The block's level shown first (0 is the main map). */
  level: number;
  /** The hex (fractions allowed) the view centres on, in that level's coordinates; unset: the map's middle. */
  at?: [number, number];
  /** How many times closer than the fitted map; 1 is the fit. */
  zoom: number;
}

/** `underlay:` — a picture under the tiles to trace over (design §13.5). */
export interface HexUnderlay {
  /** Link text of the picture (`Realm sketch.jpg`). */
  image: string;
  opacity: number;
  /** Width in hex widths. */
  width: number;
  /** The hex under the picture's top-left corner. */
  at: [number, number];
  /** Over the tiles instead of under them. */
  top: boolean;
}

/** `detail(1,0): …` — a finer map of a hex, kept in this block after the main map
 *  (design §13.8); `detail(1,0 / 2,-1):` one level further down. */
export interface HexDetailSection {
  /** Hexes from the top map down: `[(1,0), (2,-1)]`. */
  path: Array<[number, number]>;
  /** `1,0/2,-1`. */
  key: string;
  /** 0-based line of the heading; its lines run to `to` (exclusive). */
  line: number;
  to: number;
  /** `detail(1,0): 6 mi` — else one level down. */
  scale?: string;
  /** `detail(1,0): [[Note]]` — split out to that note. */
  link?: string;
}

const DETAIL = /^\s*(?:\*\s*)?detail\s*\(\s*([-\d\s,/]+?)\s*\)\s*:\s*(.*?)\s*$/i;

/** The block's `detail(…)` sections, in order. */
export function detailSections(source: string): HexDetailSection[] {
  const lines = source.split("\n");
  const sep = lines.findIndex((l) => l.trim() === "---");
  const out: HexDetailSection[] = [];
  for (let i = sep + 1; i < lines.length; i++) {
    const m = stripComment(lines[i]).match(DETAIL);
    if (!m) continue;
    const path = m[1].split("/").map((part) => part.split(",").map((n) => parseInt(n.trim(), 10)) as [number, number]);
    if (path.some((h) => h.length !== 2 || h.some((n) => Number.isNaN(n)))) continue;
    if (out.length) out[out.length - 1].to = i;
    const rest = m[2].trim();
    const link = rest.match(/^\[\[([^\]]+)\]\]$/)?.[1];
    out.push({
      path,
      key: path.map(([q, r]) => `${q},${r}`).join("/"),
      line: i,
      to: lines.length,
      scale: !link && rest ? rest : undefined,
      link: link?.trim(),
    });
  }
  return out;
}

/** `level 1:` — the map six times finer, kept in this block after the main map (design §13.9). */
export interface LevelSection {
  depth: number;
  /** 0-based line of the heading; its lines run to `to` (exclusive). */
  line: number;
  to: number;
}

const LEVEL = /^\s*(?:\*\s*)?level\s+(\d+)\s*:\s*$/i;

/** The block's `level N:` sections, in order. */
export function levelSections(source: string): LevelSection[] {
  const lines = source.split("\n");
  const sep = lines.findIndex((l) => l.trim() === "---");
  const out: LevelSection[] = [];
  for (let i = sep + 1; i < lines.length; i++) {
    const m = stripComment(lines[i]).match(LEVEL);
    if (!m) continue;
    const depth = parseInt(m[1], 10);
    if (depth < 1) continue;
    if (out.length) out[out.length - 1].to = i;
    out.push({ depth, line: i, to: lines.length });
  }
  return out;
}

/** The 0-based line the main map's lines end at: its first level (or old detail) heading. */
export function mainEnd(source: string): number {
  const starts = [...levelSections(source).map((s) => s.line), ...detailSections(source).map((d) => d.line)];
  return starts.length ? Math.min(...starts) : source.split("\n").length;
}

/** How a detail map shows the coarser map it details: faded tiles, only its grid, or not at all. */
export type ParentMode = "faint" | "grid" | "off";

export type CoordMode = "off" | "hover" | "always";

export interface ParsedHexMap {
  title?: string;
  pack?: string;
  seed: string;
  scale?: string;
  /** Metres per height step (`step: 100 m`); unset: 100. */
  step?: number;
  /** Unset: the settings default. */
  coords?: CoordMode;
  /** `scale` in metres, when it reads as a distance (`30 mi`, `5/6 mi`, `1340 m`). */
  scaleMetres?: number;
  /** The coarser map this one details (`of: "[[Caulkin coast]]"`), as link text. */
  of?: string;
  /** This map's (0,0) is the parent's hex here; unset: coordinates are global (design §13.7). */
  at?: [number, number];
  parent?: ParentMode;
  /** This map's (0,0), in the coordinates it shares with the maps around it (design §15). */
  origin?: [number, number];
  /** Other notes' maps drawn in this one (`import:`, design §15). */
  imports?: HexImport[];
  underlay?: HexUnderlay;
  /** Where the block opens (`view:`). */
  view?: HexStartView;
  stamps?: HexStampLine[];
  /** Detail maps kept in this block (`detail(q,r):` sections after the main map), as older blocks wrote them. */
  details?: HexDetailSection[];
  /** This block's finer levels (`level 1:`, `level 2:` after the main map). */
  levels?: LevelSection[];
  regions: Record<string, HexRegion>;
  cells: HexCell[];
  labels: HexLabelLine[];
  markers: HexMarkerLine[];
  /** `Nm:` group headings, in the block's order (1-based lines). */
  groups?: Array<{ height: number; base?: string; line: number }>;
  /** 1-based line the body starts on (after the header's `---`). */
  body?: number;
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
export function splitTokens(s: string): string[] {
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
export function stripComment(line: string): string {
  const m = line.match(/(^|\s)#\s/);
  return m && m.index !== undefined ? line.slice(0, m.index) : line;
}

const HEAD_KEY = /^(grid|title|pack|seed|scale|step|coords|of|parent)\s*:\s*(.*)$/;
const STAMP = /^(?:c|stamp)\s*\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)\s*:\s*(\S+)(?:\s+rot\s*=\s*(-?\d+))?\s*$/i;
const CELL = /^(?:([tpseb])\s*\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)|(-?\d+)\s*,\s*(-?\d+))\s*:(.*)$/;
const NUM = String.raw`-?\d+(?:\.\d+)?|-?\.\d+`;
const LABEL = new RegExp(String.raw`^l\s*\(\s*(${NUM})\s*,\s*(${NUM})\s*\)\s*:(.*)$`);
const MARKER = new RegExp(String.raw`^m\s*\(\s*(${NUM})\s*,\s*(${NUM})\s*\)\s*:(.*)$`);
const LEGACY = /^(-?\d+)\s*,\s*(-?\d+)\s*,(.*)$/;
const HEIGHT = /^(-?\d+)\s*m\s*:\s*(?:base\s*=\s*(\S+))?\s*$/;

const LAYER_OF: Record<string, Layer> = { t: "terrain", s: "stack", p: "path", e: "edge", b: "base" };

const METRES: Record<string, number> = { m: 1, km: 1000, ft: 0.3048, mi: 1609.344 };

/** `30 mi`, `5/6 mi`, `1340 m`, `6 km` → metres; anything else → undefined. */
export function parseDistance(value: string): number | undefined {
  const m = value.trim().match(/^(\d+(?:\.\d+)?)(?:\s*\/\s*(\d+(?:\.\d+)?))?\s*(m|km|ft|mi|miles?)$/i);
  if (!m) return undefined;
  const unit = m[3].toLowerCase().startsWith("mi") ? "mi" : m[3].toLowerCase();
  const n = parseFloat(m[1]) / (m[2] ? parseFloat(m[2]) : 1);
  const metres = n * METRES[unit];
  return Number.isFinite(metres) && metres > 0 ? metres : undefined;
}

/** `100 m`, `100m`, `330 ft`, `100` (metres) → metres; anything else → undefined. */
export function parseStep(value: string): number | undefined {
  const m = value.trim().match(/^(\d+(?:\.\d+)?)\s*(m|km|ft|mi)?$/i);
  if (!m) return undefined;
  const metres = parseFloat(m[1]) * METRES[(m[2] ?? "m").toLowerCase()];
  return metres > 0 ? metres : undefined;
}

function unquote(v: string): string {
  const t = v.trim();
  return /^(["']).*\1$/.test(t) ? t.slice(1, -1) : t;
}

function linkText(token: string): string {
  return token.replace(/^\[\[/, "").replace(/\]\]$/, "").trim();
}

function pair(value: unknown): [number, number] | undefined {
  const list = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.replace(/[()[\]]/g, "").split(",")
      : null;
  if (!list || list.length !== 2) return undefined;
  const [a, b] = list.map((v) => parseFloat(String(v)));
  return Number.isFinite(a) && Number.isFinite(b) ? [a, b] : undefined;
}

function readUnderlay(raw: unknown): HexUnderlay | undefined {
  const o = (typeof raw === "string" ? { image: raw } : raw) as Record<string, unknown> | null;
  if (!o || typeof o !== "object" || typeof o.image !== "string" || !o.image.trim()) return undefined;
  const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  return {
    image: linkText(o.image.replace(/^!/, "")),
    opacity: Math.min(1, Math.max(0, num(o.opacity, 0.45))),
    width: Math.max(0.5, num(o.width, 10)),
    at: pair(o.at) ?? [0, 0],
    top: o.top === true,
  };
}

function applyHeadValue(map: ParsedHexMap, key: string, value: unknown): void {
  if (key === "at") {
    map.at = pair(value) ?? map.at;
    return;
  }
  if (key === "underlay") {
    map.underlay = readUnderlay(value);
    return;
  }
  if (key === "view") {
    const o = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
    map.view = {
      level: Math.max(0, Math.round(num(o.level) ?? 0)),
      at: pair(o.at),
      zoom: Math.min(12, Math.max(1, num(o.zoom) ?? 1)),
    };
    return;
  }
  if (key === "origin") {
    const p = pair(value);
    map.origin = p ? [Math.round(p[0]), Math.round(p[1])] : map.origin;
    return;
  }
  if (key === "import") {
    map.imports = readImports(value);
    return;
  }
  const str = value === null || value === undefined ? "" : String(value).trim();
  if (key === "title" && str) map.title = str;
  else if (key === "pack" && str) map.pack = str;
  else if (key === "seed" && str) map.seed = str;
  else if (key === "scale" && str) {
    map.scale = str;
    map.scaleMetres = parseDistance(str);
  } else if (key === "of" && str) map.of = linkText(str);
  else if (key === "parent" && (str === "faint" || str === "grid" || str === "off")) map.parent = str;
  else if (key === "step" && str) map.step = parseStep(str) ?? map.step;
  else if (key === "coords" && (str === "off" || str === "hover" || str === "always")) map.coords = str;
}

function readRegions(map: ParsedHexMap, raw: unknown): void {
  if (!raw || typeof raw !== "object") return;
  for (const [name, v] of Object.entries(raw as Record<string, unknown>)) {
    const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
    map.regions[name] = {
      name,
      label: o.label === false ? false : typeof o.label === "string" && o.label.trim() ? o.label.trim() : undefined,
      at: pair(o.at),
      labelAt: o.labelAt === "border" || o.labelAt === "bottom" || o.labelAt === "middle" ? o.labelAt : undefined,
      labelColor: typeof o.labelColor === "string" ? o.labelColor : undefined,
      tint: typeof o.tint === "string" ? o.tint : undefined,
      tintOpacity:
        typeof o.tintOpacity === "number" && Number.isFinite(o.tintOpacity)
          ? Math.min(1, Math.max(0, o.tintOpacity))
          : undefined,
      color: typeof o.color === "string" ? o.color : undefined,
      link: typeof o.link === "string" ? linkText(o.link) : undefined,
      parent: typeof o.parent === "string" ? o.parent : undefined,
      demark: o.demark === "outline" || o.demark === "fill" || o.demark === "none" ? o.demark : undefined,
      override: o.override === true ? true : undefined,
      // `label: { … }` says it all in one place, over the flat keys.
      ...(o.label && typeof o.label === "object" ? readRegionLabel(o.label) : {}),
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
    } else if (readLook((cell.look ??= {}), tok)) {
      continue;
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
  if (cell.look && Object.keys(cell.look).length === 0) delete cell.look;
}

/** The content after `l(q,r):` — `(Text) family [[Note]] size=N rot=N #colour`. */
function parseLabel(label: HexLabelLine, content: string, errors: HexMapError[]): void {
  let rest = content.trim();
  const text = rest.match(/^\(([^)]*)\)\s*/);
  if (text) {
    label.text = text[1].trim() || undefined;
    rest = rest.slice(text[0].length);
  }
  for (const tok of splitTokens(rest)) {
    const look = tok.match(/^(line|case|space)=(\S+)$/i);
    if (look) {
      const [, key, v] = look;
      if (key.toLowerCase() === "line") label.halo = v === "none" ? false : v;
      else if (key.toLowerCase() === "case" && ["upper", "title", "lower", "none"].includes(v))
        label.case = v as HexLabelLine["case"];
      else if (key.toLowerCase() === "space" && Number.isFinite(parseFloat(v))) label.spacing = parseFloat(v);
      else errors.push({ line: label.line, message: `can't read "${tok}"` });
      continue;
    }
    const kv = tok.match(/^(size|rot|arc|width)=(-?\d+(?:\.\d+)?)$/i);
    if (tok.startsWith("[[") && tok.endsWith("]]")) label.link = linkText(tok);
    else if (kv && kv[1].toLowerCase() === "size") label.size = Math.max(0.1, parseFloat(kv[2]));
    else if (kv && kv[1].toLowerCase() === "arc") label.arc = Math.max(-300, Math.min(300, parseFloat(kv[2])));
    else if (kv && kv[1].toLowerCase() === "width") label.width = parseFloat(kv[2]) > 0 ? parseFloat(kv[2]) : undefined;
    else if (kv) label.rot = parseFloat(kv[2]);
    else if (isColor(tok.replace(/^\+/, ""))) label.color = tok.replace(/^\+/, "");
    else if (tok === "+") continue;
    else if (!label.family) {
      if (/^[^()[\]]+$/.test(tok)) label.family = tok;
      else
        errors.push({ line: label.line, message: `"${tok}" isn't a label family — write its folder's name: title-1` });
    } else errors.push({ line: label.line, message: `unexpected "${tok}" after "${label.family}"` });
  }
  if (!label.text && !label.link) errors.push({ line: label.line, message: "a label needs its (Text) or a [[Note]]" });
}

/** The content after `m(q,r):` — `style[mark] (Name) [[Note]] size=N`, in any order. */
function parseMarker(marker: HexMarkerLine, content: string, errors: HexMapError[]): void {
  for (const tok of splitTokens(content.trim())) {
    const size = tok.match(/^size=(\d+(?:\.\d+)?)$/i);
    const cap = tok.match(/^(text|tsize|toff|arc|tline|tcase|trot|tspace|twidth)=(.+)$/i);
    if (cap) {
      const c = (marker.caption ??= {});
      const key = cap[1].toLowerCase();
      const nums = cap[2].split(",").map(Number);
      if (key === "text") c.style = cap[2];
      else if (key === "tsize" && Number.isFinite(nums[0])) c.size = Math.max(0.2, nums[0]);
      else if (key === "toff" && nums.length === 2 && nums.every(Number.isFinite)) c.offset = [nums[0], nums[1]];
      else if (key === "arc" && Number.isFinite(nums[0])) c.arc = Math.max(-300, Math.min(300, nums[0]));
      else if (key === "tline") c.halo = cap[2] === "none" ? false : cap[2];
      else if (key === "tcase" && ["upper", "title", "lower", "none"].includes(cap[2]))
        c.case = cap[2] as MarkerCaption["case"];
      else if (key === "trot" && Number.isFinite(nums[0])) c.rot = nums[0];
      else if (key === "tspace" && Number.isFinite(nums[0])) c.spacing = nums[0];
      else if (key === "twidth" && Number.isFinite(nums[0])) c.width = nums[0] > 0 ? nums[0] : undefined;
      else errors.push({ line: marker.line, message: `can't read "${tok}"` });
      continue;
    }
    if (isColor(tok.replace(/^\+/, "")) && marker.spec) {
      (marker.caption ??= {}).color = tok.replace(/^\+/, "");
      continue;
    }
    if (tok.startsWith("[[") && tok.endsWith("]]")) marker.link = linkText(tok);
    else if (/^\(.*\)$/.test(tok)) marker.text = tok.slice(1, -1).trim() || undefined;
    else if (size) marker.size = Math.max(0.1, parseFloat(size[1]));
    else if (tok.toLowerCase() === "piece") marker.piece = true;
    else if (!marker.spec) marker.spec = tok;
    else errors.push({ line: marker.line, message: `unexpected "${tok}" after "${marker.spec}"` });
  }
  if (!marker.spec)
    errors.push({ line: marker.line, message: "a marker needs its style: pedestal-gold[tower], pin[red]…" });
}

export function parseHexMap(source: string): ParsedHexMap {
  const map: ParsedHexMap = {
    seed: "",
    regions: {},
    cells: [],
    labels: [],
    markers: [],
    groups: [],
    stamps: [],
    errors: [],
  };
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

  map.body = bodyStart + 1;
  // The main map ends where its first level (or old detail section) begins.
  map.details = detailSections(source);
  map.levels = levelSections(source);
  const end = mainEnd(source);
  let height = 0;
  let groupBase: string | undefined;
  const terrainAt = new Map<string, number>();
  for (let i = bodyStart; i < end; i++) {
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
      groupBase = h[2];
      map.groups?.push({ height, base: groupBase, line: lineNo });
      continue;
    }

    const st = line.match(STAMP);
    if (st) {
      const rot = ((parseInt(st[4] ?? "0", 10) % 6) + 6) % 6;
      (map.stamps ??= []).push({
        q: parseInt(st[1], 10),
        r: parseInt(st[2], 10),
        name: st[3],
        rot,
        height,
        line: lineNo,
      });
      continue;
    }

    const l = line.match(LABEL);
    if (l) {
      const label: HexLabelLine = { q: parseFloat(l[1]), r: parseFloat(l[2]), size: 1, rot: 0, line: lineNo };
      parseLabel(label, l[3], map.errors);
      if (label.text || label.link) map.labels.push(label);
      continue;
    }

    const mk = line.match(MARKER);
    if (mk) {
      const marker: HexMarkerLine = { q: parseFloat(mk[1]), r: parseFloat(mk[2]), size: 1, line: lineNo };
      parseMarker(marker, mk[3], map.errors);
      if (marker.spec) map.markers.push(marker);
      continue;
    }

    const c = line.match(CELL);
    let cell: HexCell | null = null;
    if (c) {
      const layer = c[1] ? LAYER_OF[c[1]] : "terrain";
      const q = parseInt(c[2] ?? c[4], 10);
      const r = parseInt(c[3] ?? c[5], 10);
      cell = { q, r, layer, height, groupBase, regions: [], count: 1, line: lineNo };
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
          groupBase,
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
        message: `not a hex line: "${line}" — expected t(q,r): …, s(q,r): …, p(q,r): …, b(q,r): …, m(q,r): …, l(q,r): … or Nm:`,
      });
      continue;
    }
    // One terrain per hex and height, and one base per hex: a later line
    // replaces it. Stacks and paths add up.
    if (cell.layer === "terrain" || cell.layer === "base") {
      const key = cell.layer === "base" ? `${cell.q},${cell.r},base` : `${cell.q},${cell.r},${cell.height}`;
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
