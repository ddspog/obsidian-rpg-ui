/**
 * `rpg map` with `grid: hex` — mounted by `MapRenderChild` when the block's
 * head says `grid: hex`, so it renders wherever `rpg map` does (its own page,
 * `.bare()` embeds). Tiles come from the vault's hex packs; the map redraws
 * when a pack changes.
 *
 * Paint mode (design §13) edits a copy of the block's text, drawn straight
 * away, and writes it into the note when a stroke ends. Writing re-renders the
 * block, so the tool, brush, selection, view and undo history are kept per map
 * in `sessions` and picked up by the new render.
 *
 * A map's finer levels (`level 1:`, `level 2:`, §13.9) are shown in place:
 * zooming far enough in shows the level below, the whole level above drawn
 * underneath it, six times larger and faded, with its grid. A stroke paints
 * across coarse borders; the first one in a coarse hex fills its inner hexes
 * with its tile, staged (dimmed) until Done writes them. A detail map in a
 * note of its own (`of: "[[Parent]]"`, §13.7) draws its parent the same way,
 * and is drawn, read-only, at its parent's level below.
 *
 * A map with `import:` (design §15) draws other notes' maps in its own at
 * their places, merged in under its own hexes, or faded underneath with
 * `show: faint`. Imported hexes are drawn, never written.
 */

import { type App, type Component, Notice, TFile } from "obsidian";
import * as React from "react";
import * as ReactDOM from "react-dom";
import {
  DEFAULT_PAINT,
  HexPaintSidebar,
  HexPaintToolbar,
  LookPanel,
  type MapMode,
  ModeSwitch,
  type PaintState,
  stateForMode,
} from "lib/components/hexmap/hex-paint-bar";
import { newPlayState, type PlayState, usePlay, withPieces } from "lib/components/hexmap/hex-play";
import {
  BuilderPanel,
  CustomBrush,
  CustomTilesPanel,
  type EditedPoint,
  PointPanel,
  RegionPanel,
  ScalePanel,
  SelectionPanel,
  StackListPanel,
  TintPanel,
  UnderlayPanel,
} from "lib/components/hexmap/hex-paint-panels";
import { openTileBuilder } from "lib/components/hexmap/tile-builder";
import {
  type HexMapEditing,
  HexLayoutGroup,
  HexMapView,
  type PaintPointer,
  type ViewBox,
} from "lib/components/hexmap/hex-map-view";
import { type Drawn, drawFar, drawHexMap } from "lib/components/hexmap/draw-hex-map";
import { pickNote } from "lib/components/hexmap/note-picker";
import { type RegionEntry, RegionList } from "lib/components/hexmap/region-list";
import { useMarginSpill } from "lib/components/hexmap/use-margin-spill";
import { LucideIcon } from "lib/components/session-log/lucide-icon";
import { hexAtlas } from "lib/services/hex-atlas";
import { editPackYml } from "lib/services/hex-pack-files";
import { hexPackIndex } from "lib/services/hex-pack-index";
import { settingsStore } from "lib/services/settings-store";
import { hexesInPolygon, hexesInRect, type Point } from "./area";
import { type Axial, hexCenter, hexKey, hexPoints, neighbour, SIDES } from "./axial";
import { childHexesOf, detailRatio, parentHexesOf, parentTransform } from "./detail";
import { applyHexEdits, cellsAt, type CellLayer, type HexEdit, type HexTint } from "./edit-hex-map";
import { extractHexes } from "./extract";
import { importAt, loadImports, mergeImports, noteName, ownsRegion, type PlacedImport } from "./imports";
import { labelFamilies } from "./labels";
import {
  type CoarseTile,
  coarseHexOf,
  coarseHexesOf,
  editLevel,
  type FillHex,
  fillHexes,
  importsAtLevel,
  innerHexesOf,
  LEVEL_RATIO,
  levelScale,
  levelView,
  MAX_LEVEL,
  migrateDetails,
  viewAtLevel,
  withFill,
} from "./levels";
import type { HexPack } from "./packs";
import { replaceMapBody } from "./fence-text";
import { type HexInfo, type HexLayout, type ImageSize, STEP_METRES } from "./layout";
import {
  type HexCell,
  type HexLook,
  type HexUnderlay,
  type ParentMode,
  parseHexMap,
  type ParsedHexMap,
} from "./parse-hex-map";
import { stampFromHexes, stampItems } from "./stamps";

interface HexMapBlockProps {
  source: string;
  app: App;
  sourcePath: string;
  /** The render child, for Obsidian's page preview on hover. */
  component: Component;
  /** The tile builder: painting a custom tile in a window, saved to the pack (not a note). */
  builder?: TileBuilderProps;
}

export interface TileBuilderProps {
  /** The custom tile being edited, if it has a name yet. */
  name?: string;
  onSave: (name: string, source: string) => Promise<void>;
  onClose: () => void;
}

/** One map's paint session, kept while Obsidian re-renders the block. */
interface Session {
  mode: MapMode;
  /** Play mode's sandbox, per level of the block (never written). */
  play: Record<string, PlayState>;
  paint: PaintState;
  undo: string[];
  redo: string[];
  /** The changes to imported maps at each undo / redo step, alongside the text (§15). */
  undoImports?: Array<Record<string, string>>;
  redoImports?: Array<Record<string, string>>;
  view?: ViewBox;
  /** The last drawing, so a re-render after a write doesn't flash "Drawing…". */
  drawn?: Drawn;
  /** Selected hexes (`q,r`). */
  selection: string[];
  /** The hex last clicked: the Look tool's, and the one Detail makes a map of. */
  picked: Axial | null;
  /** Which level of the block is shown: 0 its main map, 1 six times finer, 2 finer again. */
  level: number;
  /** New details' fills, staged until Done: by level, then by coarse hex (`q,r`). */
  fills?: Record<number, Record<string, FillHex[]>>;
  /** The marker or label the Edit tool has selected: its layer and line. */
  point?: { layer: "marker" | "label"; line: number } | null;
  /** Open in a window of its own over the page. */
  floating?: boolean;
  /** The imports last read, so a re-render after a write draws them straight away. */
  imported?: { imports: PlacedImport[]; problems: string[] };
  /** Imported maps changed from this one (a region on their hexes), by note: kept until Done, like the map's own. */
  importEdits?: Record<string, string>;
  /** Markers and labels, and region outlines, hidden while working (never written). */
  hidePoints?: boolean;
  hideRegions?: boolean;
  /** When editing stack, which element is selected for look editing (by index in stack array). */
  stackIndex?: number | null;
}

/** Links to a level of this block at a coarse hex (`rpg-detail:1:3,-2`), told apart from note links. */
const DETAIL_LINK = "rpg-detail:";

/** What a coarse hex is drawn with, to fill a new detail with: its top terrain, its base, its height. */
function coarseTile(map: ParsedHexMap, q: number, r: number): CoarseTile | null {
  const cells = map.cells.filter((c) => c.q === q && c.r === r && !c.faint);
  const terrain = cells
    .filter((c) => c.layer === "terrain" && c.spec)
    .reduce<HexCell | null>((t, c) => (!t || c.height >= t.height ? c : t), null);
  const base = [...cells].reverse().find((c) => c.layer === "base" && c.spec)?.spec ?? terrain?.groupBase;
  if (!terrain && !base) return null;
  return { terrain: terrain?.spec, base, height: terrain?.height ?? 0 };
}

/** The hexes a map has a terrain or base line on. */
function paintedHexes(map: ParsedHexMap): Set<string> {
  const out = new Set<string>();
  for (const c of map.cells) if (c.layer === "terrain" || c.layer === "base") out.add(hexKey(c.q, c.r));
  return out;
}

/** A drag in progress that draws something: a lasso loop or a selection box. */
type Gesture =
  | { kind: "lasso"; pts: Point[]; erase: boolean }
  | { kind: "box"; a: Point; b: Point; mode: "set" | "add" | "cut" };

const sessions = new Map<string, Session>();
const UNDO_LIMIT = 100;
const sameText = (a: string, b: string) => a.replace(/\s+$/, "") === b.replace(/\s+$/, "");

/** A map is known by its note and its title (painting never changes those). */
function sessionKey(sourcePath: string, map: ParsedHexMap): string {
  return `${sourcePath}\n${map.title ?? ""}\n${map.of ?? ""}`;
}

/** Empty hexes up to two steps around the map (around (0,0) for an empty one). */
function ghostRing(layout: HexLayout): Axial[] {
  const taken = new Set(layout.hexes.keys());
  const seeds = taken.size ? [...layout.hexes.values()] : [{ q: 0, r: 0 }];
  const out = new Map<string, Axial>();
  const visit = (h: Axial, depth: number) => {
    const key = hexKey(h.q, h.r);
    if (!taken.has(key)) out.set(key, h);
    if (depth > 0) for (const side of SIDES) visit(neighbour(h, side), depth - 1);
  };
  for (const s of seeds) visit({ q: s.q, r: s.r }, taken.size ? 2 : 3);
  return [...out.values()];
}

/** The line the Look tool works on: the hex's top line of the layer (terrain for markers and labels). */
function lookTarget(map: ParsedHexMap, at: Axial | null, layer: PaintState["layer"]): HexCell | null {
  if (!at) return null;
  const want = layer === "marker" || layer === "label" ? "terrain" : layer;
  const cells = map.cells.filter((c) => c.q === at.q && c.r === at.r && c.layer === want);
  if (want === "terrain") return cells.reduce<HexCell | null>((t, c) => (!t || c.height >= t.height ? c : t), null);
  return cells[cells.length - 1] ?? null;
}

const toPoint = (a: Axial, R: number): Point => ({ x: 1.5 * R * a.q, y: Math.sqrt(3) * R * (a.r + a.q / 2) });

/** An underlay as the header writes it. */
function underlayValue(u: HexUnderlay): Record<string, unknown> {
  return {
    image: `[[${u.image}]]`,
    opacity: Math.round(u.opacity * 100) / 100,
    width: u.width,
    at: u.at,
    ...(u.top ? { top: true } : {}),
  };
}

export function HexMapBlock({ source, app, sourcePath, component, builder }: HexMapBlockProps) {
  const first = React.useMemo(() => parseHexMap(source), [source]);
  const key = sessionKey(sourcePath, first);
  const session = React.useMemo<Session>(() => {
    // The builder's session is its own, and starts painting.
    if (builder)
      return {
        mode: "build",
        play: {},
        paint: DEFAULT_PAINT,
        undo: [],
        redo: [],
        selection: [],
        picked: null,
        level: 0,
      };
    let s = sessions.get(key);
    if (!s) {
      s = {
        mode: "play",
        play: {},
        paint: DEFAULT_PAINT,
        undo: [],
        redo: [],
        selection: [],
        picked: null,
        // The block opens at the level its `view:` names.
        level: Math.min(first.view?.level ?? 0, MAX_LEVEL),
      };
      sessions.set(key, s);
    }
    return s;
  }, [key]);

  // The text drawn: the block's, or paint mode's copy until it's written. Older
  // `detail(q,r):` sections are read as levels (and written so with the next save).
  const [draft, setDraft] = React.useState(() => migrateDetails(source));
  const written = React.useRef(source);
  const [mode, setModeState] = React.useState<MapMode>(session.mode);
  const editing = mode !== "play";
  const [paint, setPaintState] = React.useState(session.paint);
  const [history, setHistory] = React.useState({ undo: session.undo.length, redo: session.redo.length });
  const [selection, setSelectionState] = React.useState(() => new Set(session.selection));
  const [picked, setPickedState] = React.useState<Axial | null>(session.picked);
  const [point, setPointState] = React.useState(session.point ?? null);
  // The Region panel waiting for a click on the map to put its name on that hex, and the hex it got.
  const [pickingLabelHex, setPickingLabelHex] = React.useState(false);
  const [labelHex, setLabelHex] = React.useState<{ hex: [number, number]; n: number } | undefined>();
  const [floating, setFloatingState] = React.useState(!!session.floating);
  const [hidden, setHidden] = React.useState({ points: !!session.hidePoints, regions: !!session.hideRegions });
  const [stackIndex, setStackIndex] = React.useState<number | null>(session.stackIndex ?? null);
  const toggleHidden = (which: "points" | "regions") => {
    const next = { ...hidden, [which]: !hidden[which] };
    session.hidePoints = next.points;
    session.hideRegions = next.regions;
    setHidden(next);
  };
  const setFloating = (next: boolean) => {
    session.floating = next;
    setFloatingState(next);
  };
  const setPoint = (next: Session["point"]) => {
    session.point = next;
    setPointState(next ?? null);
  };
  const [gesture, setGestureState] = React.useState<Gesture | null>(null);
  const gestureRef = React.useRef<Gesture | null>(null);
  const setGesture = (g: Gesture | null) => {
    gestureRef.current = g;
    setGestureState(g);
  };
  const [status, setStatus] = React.useState<string | undefined>();
  // Changes held in the editor until Done (or Play, or the block going away) writes them.
  const [unsaved, setUnsaved] = React.useState(false);
  const [version, setVersion] = React.useState(0);
  const [drawn, setDrawn] = React.useState<Drawn | null>(() =>
    session.drawn && sameText(session.drawn.source, levelView(migrateDetails(source), session.level))
      ? session.drawn
      : null
  );
  // The level shown: the block's main map, or one of its finer levels as a map of its own.
  const [level, setLevelState] = React.useState<number>(session.level);
  // The level the drawing is of: a switch's view waits for it.
  const [drawnLevel, setDrawnLevel] = React.useState(session.level);
  const view = React.useMemo(() => levelView(draft, level), [draft, level]);
  const parsed = React.useMemo(() => parseHexMap(view), [view]);
  const top = React.useMemo(() => (level ? parseHexMap(draft) : parsed), [draft, level, parsed]);
  const levelRef = React.useRef(level);
  levelRef.current = level;
  /** A text's map at the level shown, and edits made there written back into the block. */
  const viewOf = React.useCallback((text: string) => levelView(text, levelRef.current), []);
  const editText = React.useCallback(
    (text: string, edits: HexEdit[]) => editLevel(text, levelRef.current, (v) => applyHexEdits(v, edits)),
    []
  );

  // ---- new details' fills, staged until Done ----
  const [fills, setFillsState] = React.useState(() => session.fills ?? {});
  const fillsRef = React.useRef(fills);
  const setFills = React.useCallback(
    (next: Record<number, Record<string, FillHex[]>>) => {
      fillsRef.current = next;
      session.fills = next;
      setFillsState(next);
    },
    [session]
  );
  // This level's, less the hexes painted since.
  const staged = React.useMemo(() => {
    const own = paintedHexes(parsed);
    return Object.values(fills[level] ?? {})
      .flat()
      .filter((f) => !own.has(hexKey(f.q, f.r)));
  }, [fills, level, parsed]);

  // ---- Play mode: the sandbox of this level ----
  const levelKey = String(level);
  const [playState, setPlayStateRaw] = React.useState<PlayState>(() => session.play[levelKey] ?? newPlayState());
  React.useEffect(() => setPlayStateRaw(session.play[levelKey] ?? newPlayState()), [levelKey, session]);
  const setPlayState = React.useCallback(
    (next: PlayState) => {
      session.play[levelKey] = next;
      setPlayStateRaw(next);
    },
    [session, levelKey]
  );
  // In Play, pieces are drawn where the sandbox moved them.
  const drawSource =
    mode === "play" && !builder ? withPieces(view, playState) : staged.length ? withFill(view, staged) : view;

  React.useEffect(() => hexPackIndex.subscribe(() => setVersion((v) => v + 1)), []);

  // ---- other notes' maps drawn in this one (`import:`, the main map only) ----
  const [imported, setImportedState] = React.useState<{ imports: PlacedImport[]; problems: string[] }>(
    () => session.imported ?? { imports: [], problems: [] }
  );
  const setImported = React.useCallback(
    (next: React.SetStateAction<{ imports: PlacedImport[]; problems: string[] }>) =>
      setImportedState((was) => {
        const value = typeof next === "function" ? next(was) : next;
        session.imported = value;
        return value;
      }),
    [session]
  );
  const topRef = React.useRef(top);
  topRef.current = top;
  const importKey = !top.imports?.length ? "" : JSON.stringify([top.imports, top.origin, top.scaleMetres]);
  React.useEffect(() => {
    if (!importKey) {
      setImported((was) => (was.imports.length || was.problems.length ? { imports: [], problems: [] } : was));
      return;
    }
    let alive = true;
    let paths = new Set<string>();
    const load = () =>
      void loadImports(topRef.current, sourcePath, (link, from) => hexAtlas.mapIn(link, from)).then((found) => {
        if (!alive) return;
        paths = new Set(found.imports.map((i) => i.path));
        setImported(found);
      });
    load();
    // An imported note edited: read again.
    const ref = app.vault.on("modify", (f) => paths.has(f.path) && load());
    return () => {
      alive = false;
      app.vault.offref(ref);
    };
  }, [importKey, sourcePath, app, version]);
  // Changes made here to imported maps, not yet written to their notes.
  const [importEdits, setImportEditsState] = React.useState<Record<string, string>>(() => session.importEdits ?? {});
  const importEditsRef = React.useRef(importEdits);
  const setImportEdits = React.useCallback(
    (value: Record<string, string>) => {
      importEditsRef.current = value;
      session.importEdits = value;
      setImportEditsState(value);
    },
    [session]
  );
  // Every import is drawn in the one map: faint ones dimmed, so rows overlap in order and coasts see across.
  const merged = React.useMemo(
    () => imported.imports.map((i) => (importEdits[i.path] ? { ...i, map: parseHexMap(importEdits[i.path]) } : i)),
    [imported, importEdits]
  );
  const mergedRef = React.useRef(merged);
  mergedRef.current = merged;

  // ---- detail maps in notes of their own (`of:` this map, or a map it imports): drawn a level down ----
  const [detailNotes, setDetailNotes] = React.useState<PlacedImport[]>([]);
  const hostsKey = JSON.stringify([
    sourcePath,
    top.scaleMetres,
    merged.filter((i) => !i.faint).map((i) => [i.path, i.offset]),
  ]);
  React.useEffect(() => {
    if (builder) return;
    let alive = true;
    let paths = new Set<string>();
    const hosts = [
      { path: sourcePath, offset: [0, 0] as [number, number] },
      ...mergedRef.current.filter((i) => !i.faint).map((i) => ({ path: i.path, offset: i.offset })),
    ];
    const load = async () => {
      const out: PlacedImport[] = [];
      for (const host of hosts) {
        for (const e of await hexAtlas.detailsOf(host.path)) {
          // Only maps one level finer line up with the level below.
          if (detailRatio(topRef.current.scaleMetres, e.scaleMetres) !== LEVEL_RATIO) continue;
          const found = await hexAtlas.mapIn(e.path.replace(/\.md$/, ""), sourcePath);
          if (!found || found.path === sourcePath) continue;
          const [aq, ar] = e.at ?? [0, 0];
          out.push({
            path: found.path,
            body: found.body,
            map: parseHexMap(found.body),
            offset: [LEVEL_RATIO * (host.offset[0] + aq), LEVEL_RATIO * (host.offset[1] + ar)],
            faint: false,
            via: host.path,
          });
        }
      }
      if (!alive) return;
      paths = new Set(out.map((i) => i.path));
      setDetailNotes((was) => (was.length === 0 && out.length === 0 ? was : out));
    };
    void load();
    const off = hexAtlas.subscribe(() => void load());
    const ref = app.vault.on("modify", (f) => paths.has(f.path) && void load());
    return () => {
      alive = false;
      off();
      app.vault.offref(ref);
    };
  }, [hostsKey, app, builder]);

  /** What's drawn into a level from other notes: the imports' own levels, and detail notes a level up from theirs. */
  const importsAt = React.useCallback(
    (depth: number): PlacedImport[] =>
      depth === 0 ? merged : [...importsAtLevel(merged, depth), ...importsAtLevel(detailNotes, depth - 1)],
    [merged, detailNotes]
  );
  const shownImports = React.useMemo(() => importsAt(level), [importsAt, level]);
  const shownImportsRef = React.useRef(shownImports);
  shownImportsRef.current = shownImports;

  React.useEffect(() => {
    let alive = true;
    const at = level;
    void drawHexMap(drawSource, shownImports).then((d) => {
      if (!alive) return;
      session.drawn = d;
      setDrawn(d);
      setDrawnLevel(at);
    });
    return () => {
      alive = false;
    };
  }, [drawSource, shownImports, version, session, level]);

  const setPaint = React.useCallback(
    (next: PaintState) => {
      session.paint = next;
      setPaintState(next);
    },
    [session]
  );
  const setSelection = React.useCallback(
    (next: Set<string>) => {
      session.selection = [...next];
      setSelectionState(next);
    },
    [session]
  );
  const setPicked = React.useCallback(
    (next: Axial | null) => {
      session.picked = next;
      setPickedState(next);
    },
    [session]
  );
  const setStackIndexAndSync = React.useCallback(
    (next: number | null) => {
      session.stackIndex = next;
      setStackIndex(next);
    },
    [session]
  );

  // ---- the map above, underneath (a level, or a detail map) ----
  const [parent, setParent] = React.useState<{ path: string; map: ParsedHexMap; layout: HexLayout } | null>(null);
  const parentView = level ? levelView(draft, level - 1) : null;
  const parentImports = React.useMemo(() => (level ? importsAt(level - 1) : []), [importsAt, level]);
  React.useEffect(() => {
    if (parentView !== null) {
      // The level above is in the block too, with what it imports.
      let alive = true;
      void drawHexMap(parentView, parentImports).then(
        (d) =>
          alive &&
          setParent({
            path: sourcePath,
            map: mergeImports(parseHexMap(parentView), parentImports),
            layout: d.layout,
          })
      );
      return () => {
        alive = false;
      };
    }
    if (!parsed.of) {
      setParent(null);
      return;
    }
    let alive = true;
    let path = "";
    const load = () =>
      void hexAtlas.mapIn(parsed.of!, sourcePath).then(async (found) => {
        if (!alive || !found) return;
        path = found.path;
        const d = await drawHexMap(found.body);
        if (alive) setParent({ path: found.path, map: parseHexMap(found.body), layout: d.layout });
      });
    load();
    const ref = app.vault.on("modify", (f) => f.path === path && load());
    return () => {
      alive = false;
      app.vault.offref(ref);
    };
  }, [parsed.of, parentView, parentImports, sourcePath, app, version]);
  // Two levels down, the level above that too (30 mi under 1 mi), where the one above has no hexes.
  const [grand, setGrand] = React.useState<HexLayout | null>(null);
  const grandView = level >= 2 ? levelView(draft, level - 2) : null;
  const grandImports = React.useMemo(() => (level >= 2 ? importsAt(level - 2) : []), [importsAt, level]);
  React.useEffect(() => {
    if (grandView === null) {
      setGrand(null);
      return;
    }
    let alive = true;
    // Its hex borders, 36 times thicker here, would cut across the level: left out.
    void drawHexMap(grandView, grandImports).then((d) => alive && setGrand({ ...d.layout, borders: [] }));
    return () => {
      alive = false;
    };
  }, [grandView, grandImports]);
  const ratio = level ? LEVEL_RATIO : detailRatio(parent?.map.scaleMetres, parsed.scaleMetres);
  // Where this map's (0,0) is on the one above: a level's coordinates are global.
  const parentAt = level ? undefined : parsed.at;
  const parentMode: ParentMode = parsed.parent ?? "faint";

  // ---- the hexes with detail below them ----
  // The level below (this block's, its imports' and detail notes'): zoomed into in place.
  const belowMarks = React.useMemo(() => {
    const marks = new Map<string, string>();
    if (level >= MAX_LEVEL || builder) return marks;
    const hexes = [
      ...parseHexMap(levelView(draft, level + 1)).cells,
      ...importsAt(level + 1).flatMap((i) => i.map.cells.map((c) => ({ q: c.q + i.offset[0], r: c.r + i.offset[1] }))),
    ];
    for (const k of coarseHexesOf(hexes)) marks.set(k, `${DETAIL_LINK}${level + 1}:${k}`);
    return marks;
  }, [draft, level, importsAt, builder]);
  // Detail notes at other scales: the mark opens the note.
  const [noteMarks, setNoteMarks] = React.useState<Map<string, string>>(new Map());
  React.useEffect(() => {
    let alive = true;
    const load = () =>
      void hexAtlas.detailsOf(level ? "" : sourcePath).then((entries) => {
        if (!alive) return;
        const marks = new Map<string, string>();
        for (const e of entries) {
          const n = detailRatio(parsed.scaleMetres, e.scaleMetres);
          if (n === LEVEL_RATIO) continue;
          const keys = e.hexes.length
            ? parentHexesOf(e.hexes, n, e.at)
            : new Set(e.at ? [hexKey(e.at[0], e.at[1])] : []);
          for (const k of keys) if (!marks.has(k)) marks.set(k, e.path);
        }
        setNoteMarks(marks);
      });
    load();
    const off = hexAtlas.subscribe(load);
    return () => {
      alive = false;
      off();
    };
  }, [sourcePath, parsed.scaleMetres, level]);
  const details = React.useMemo(() => new Map([...noteMarks, ...belowMarks]), [noteMarks, belowMarks]);

  // ---- the level below, as this one shows it: far art and shrunk tiles over the hexes with detail (§13.10) ----
  const [far, setFar] = React.useState<HexLayout | null>(null);
  const farSource = level < MAX_LEVEL && belowMarks.size > 0 && !builder ? levelView(draft, level + 1) : null;
  const farImports = React.useMemo(() => (farSource ? importsAt(level + 1) : []), [farSource, importsAt, level]);
  React.useEffect(() => {
    if (!farSource || !drawn || drawnLevel !== level) {
      setFar(null);
      return;
    }
    let alive = true;
    const coarse = { map: mergeImports(parseHexMap(drawn.source), shownImportsRef.current), layout: drawn.layout };
    void drawFar(farSource, farImports, coarse).then((l) => alive && setFar(l));
    return () => {
      alive = false;
    };
  }, [farSource, farImports, drawn, drawnLevel, level, version]);

  // ---- the reference picture ----
  const [underlay, setUnderlay] = React.useState<{ url: string; size: ImageSize } | null>(null);
  const underlayImage = parsed.underlay?.image;
  React.useEffect(() => {
    if (!underlayImage) {
      setUnderlay(null);
      return;
    }
    const file = app.metadataCache.getFirstLinkpathDest(underlayImage, sourcePath);
    if (!(file instanceof TFile)) {
      setUnderlay(null);
      return;
    }
    const url = app.vault.getResourcePath(file);
    let alive = true;
    void hexPackIndex.measure(url).then((size) => alive && size && setUnderlay({ url, size }));
    return () => {
      alive = false;
    };
  }, [underlayImage, sourcePath, app]);

  // ---- writing ----
  const pending = React.useRef<number | null>(null);
  const draftRef = React.useRef(draft);
  draftRef.current = draft;

  /** Writes the changes made here to imported maps into their notes. False if one couldn't be. */
  const flushImports = React.useCallback(async () => {
    const edits = importEditsRef.current;
    const paths = Object.keys(edits);
    if (paths.length === 0) return true;
    let ok = true;
    const saved: Record<string, string> = {};
    for (const path of paths) {
      const was = mergedRef.current.find((i) => i.path === path);
      const file = app.vault.getAbstractFileByPath(path);
      let found = false;
      if (was && file instanceof TFile) {
        await app.vault.process(file, (text) => {
          const out = replaceMapBody(text, was.body, edits[path]);
          found = out !== null;
          return out ?? text;
        });
      }
      if (found) saved[path] = edits[path];
      else {
        ok = false;
        new Notice(`Hex map: couldn't find the map in ${path} (changed elsewhere?), so its change wasn't saved.`);
      }
    }
    // What was written is what they are now: no flash back before they're read again.
    setImported((was) => ({
      ...was,
      imports: was.imports.map((i) =>
        saved[i.path] ? { ...i, body: saved[i.path], map: parseHexMap(saved[i.path]) } : i
      ),
    }));
    setImportEdits({});
    return ok;
  }, [app, setImported, setImportEdits]);

  const flush = React.useCallback(async () => {
    if (pending.current !== null) window.clearTimeout(pending.current);
    pending.current = null;
    const importsSaved = await flushImports();
    const next = draftRef.current;
    if (sameText(next, written.current)) {
      if (importsSaved) setUnsaved(false);
      return;
    }
    // The builder keeps its text here until it's saved to the pack.
    if (builder) {
      written.current = next;
      return;
    }
    const file = app.vault.getAbstractFileByPath(sourcePath);
    if (!(file instanceof TFile)) {
      new Notice(`Hex map: can't find ${sourcePath} to save the map in.`);
      return;
    }
    const before = written.current;
    let found = true;
    setStatus("Saving…");
    await app.vault.process(file, (text) => {
      const out = replaceMapBody(text, before, next);
      found = out !== null;
      // Before the write lands: the block may re-render (and flush again) before this call returns.
      if (found) written.current = next;
      return out ?? text;
    });
    if (!found) {
      setStatus("Not saved: this map's block isn't in this note (embedded, or changed elsewhere)");
      new Notice("Hex map: couldn't find this map's block in its note, so the change wasn't saved.");
      return;
    }
    setStatus(undefined);
    if (importsSaved) setUnsaved(false);
  }, [app, sourcePath, builder, flushImports]);

  // A change is kept here, not written at once: writing re-renders the block, which would
  // interrupt the work. Done (or Play) writes it; so does the block going away.
  const schedule = React.useCallback(() => {
    if (pending.current !== null) window.clearTimeout(pending.current);
    pending.current = null;
    setUnsaved(true);
  }, []);

  // Unsaved changes are written when the block goes away, or the window closes.
  React.useEffect(() => {
    const onLeave = () => void flush();
    window.addEventListener("beforeunload", onLeave);
    return () => {
      window.removeEventListener("beforeunload", onLeave);
      void flush();
    };
  }, [flush]);

  /** A finished change: one undo step back to where it started. */
  const commit = React.useCallback(
    /** One undo step back to `start`, and to the imported maps' changes as they were (unchanged, unless said). */
    (start: string, importsBefore: Record<string, string> = importEditsRef.current) => {
      session.undo.push(start);
      (session.undoImports ??= []).push(importsBefore);
      if (session.undo.length > UNDO_LIMIT) {
        session.undo.shift();
        session.undoImports.shift();
      }
      session.redo = [];
      session.redoImports = [];
      setHistory({ undo: session.undo.length, redo: 0 });
    },
    [session]
  );

  const show = React.useCallback((next: string) => {
    draftRef.current = next;
    setDraft(next);
  }, []);

  /** Edits made at once: drawn, one undo step, written. */
  const apply = React.useCallback(
    (edits: HexEdit[]) => {
      const start = draftRef.current;
      const next = editText(start, edits);
      if (next === start) return;
      show(next);
      commit(start);
      schedule();
    },
    [show, commit, schedule]
  );

  /** Edits to the block's own header (shared by all its levels), whatever level is shown. */
  const applyTop = React.useCallback(
    (edits: HexEdit[]) => {
      const start = draftRef.current;
      const next = applyHexEdits(start, edits);
      if (next === start) return;
      show(next);
      commit(start);
      schedule();
    },
    [show, commit, schedule]
  );

  // Edits that follow a slider or a drag: each from where it started, one undo step when let go.
  const liveBase = React.useRef<string | null>(null);
  const live = React.useCallback(
    (edits: HexEdit[]) => {
      if (liveBase.current === null) liveBase.current = draftRef.current;
      show(editText(liveBase.current, edits));
    },
    [show]
  );
  const commitLive = React.useCallback(() => {
    const start = liveBase.current;
    liveBase.current = null;
    if (start === null || start === draftRef.current) return;
    commit(start);
    schedule();
  }, [commit, schedule]);

  const stepHistory = React.useCallback(
    (back: boolean) => {
      const from = back ? session.undo : session.redo;
      const to = back ? session.redo : session.undo;
      const fromImports = back ? (session.undoImports ??= []) : (session.redoImports ??= []);
      const toImports = back ? (session.redoImports ??= []) : (session.undoImports ??= []);
      const next = from.pop();
      if (next === undefined) return;
      const nextImports = fromImports.pop() ?? importEditsRef.current;
      to.push(draftRef.current);
      toImports.push(importEditsRef.current);
      setHistory({ undo: session.undo.length, redo: session.redo.length });
      show(next);
      setImportEdits(nextImports);
      setStatus(undefined);
      schedule();
    },
    [session, schedule, show, setImportEdits]
  );

  // ---- painting ----
  const stroke = React.useRef<{
    seen: Set<string>;
    start: string;
    text: string;
    regionOn?: boolean;
    /** The imported maps' changes when the stroke began (a stroke can change them: regions on their hexes). */
    imports?: Record<string, string>;
    look?: { from: Point; shift: [number, number]; line: number; look: HexLook };
    /** Mark's Move: the marker or label line being dragged. */
    moving?: number;
  } | null>(null);
  const layout = drawn?.layout;
  const R = layout?.R ?? 40;

  const play = usePlay({
    state: playState,
    onState: setPlayState,
    map: parsed,
    layout,
    hexMetres: parsed.scaleMetres,
    active: mode === "play" && !builder,
  });

  const cellEdits = React.useCallback(
    (hexes: Axial[], erase: boolean): HexEdit[] => {
      const layer = paint.layer as CellLayer;
      const spec = paint.spec[paint.layer]?.trim();
      if (erase) return hexes.map((h) => ({ kind: "erase", layer, q: h.q, r: h.r }));
      if (!spec) return [];
      return hexes.map((h) => ({ kind: "paint", layer, q: h.q, r: h.r, spec, height: paint.height }));
    },
    [paint]
  );

  /** Puts these hexes (host coordinates) of an imported map in or out of a region, in that map. */
  const regionInImport = React.useCallback(
    (from: PlacedImport, hexes: Axial[], name: string, label: string, on: boolean) => {
      const name_ = from.path.replace(/^.*\//, "").replace(/\.md$/, "");
      if (from.faint) {
        setStatus(`That hex is ${name_}'s, shown faint: change its region in ${name_}`);
        return;
      }
      const body = importEditsRef.current[from.path] ?? from.body;
      const edits: HexEdit[] = [
        ...(on && label !== name && !parseHexMap(body).regions[name]
          ? [{ kind: "region-decl" as const, id: name, value: { label } }]
          : []),
        ...hexes.map((h) => ({ kind: "region" as const, q: h.q - from.offset[0], r: h.r - from.offset[1], name, on })),
      ];
      const next = applyHexEdits(body, edits);
      if (next === body) return;
      // The note's text as it was, kept in the undo step: undone past a save, Done writes it back.
      const before = { ...importEditsRef.current, [from.path]: body };
      setImportEdits({ ...importEditsRef.current, [from.path]: next });
      // A stroke makes its one undo step when it ends; a selection's change is one now.
      const s = stroke.current;
      if (!s) commit(draftRef.current, before);
      else if (s.imports && !(from.path in s.imports)) s.imports = { ...s.imports, [from.path]: body };
      setStatus(`Changed in ${name_}: Done saves it there`);
      schedule();
    },
    [setImportEdits, schedule, commit]
  );

  const editsFor = React.useCallback(
    (p: PaintPointer, text: string): HexEdit[] | null => {
      const { layer, tool } = paint;
      const spec = paint.spec[layer]?.trim();
      const { q, r } = p.hex;
      const pointLayer = layer === "marker" || layer === "label";
      const erase = tool === "erase" || p.button === 2;

      // Region tool, Alt-click: take the hex's innermost region into the brush (to style it), painting nothing.
      if (tool === "region" && p.alt) {
        if (p.phase !== "down") return null;
        const inner = innermostRegion(layout, p.hex);
        if (inner) setPaint({ ...paint, region: inner });
        else setStatus("That hex is in no region");
        return null;
      }
      // Regions' Pick: the hex's innermost region, to paint and style.
      if (mode === "regions" && tool === "pick") {
        if (p.phase !== "down") return null;
        const inner = innermostRegion(layout, p.hex);
        if (inner) setPaint({ ...paint, region: inner });
        else setStatus("That hex is in no region");
        return null;
      }
      if (tool === "pick" || p.alt) {
        const info = layout?.hexes.get(hexKey(q, r));
        let got: string | undefined;
        if (pointLayer && layout) got = nearestPoint(layout, layer, p.point)?.spec;
        else got = [...(info?.specs ?? [])].reverse().find((s) => s.layer === layer && s.spec)?.spec;
        if (got) setPaint({ ...paint, tool: tool === "pick" ? "paint" : tool, spec: { ...paint.spec, [layer]: got } });
        return null;
      }
      if (tool === "region") {
        const label = paint.region.trim();
        // Tags are one word: "The Clodgate" is `@TheClodgate`, declared with its name.
        const name = label.replace(/\s+/g, "");
        if (!name) {
          setStatus("Name the region first");
          return null;
        }
        const named: HexEdit[] =
          label !== name && !parseHexMap(viewOf(text)).regions[name]
            ? [{ kind: "region-decl", id: name, value: { label } }]
            : [];
        // A hex an imported map has: changed in that map (written to its note on Done), not here.
        const from = level ? undefined : importAt(parseHexMap(viewOf(text)), mergedRef.current, q, r);
        if (from) {
          if (stroke.current && stroke.current.regionOn === undefined) {
            const [lq, lr] = [q - from.offset[0], r - from.offset[1]];
            stroke.current.regionOn = !from.map.cells.some(
              (c) => c.q === lq && c.r === lr && c.layer === "terrain" && c.regions.includes(name)
            );
          }
          regionInImport(from, [{ q, r }], name, label, stroke.current?.regionOn ?? true);
          return null;
        }
        // A stroke adds or removes, by what its first hex had.
        if (stroke.current && stroke.current.regionOn === undefined) {
          const had = parseHexMap(viewOf(text)).cells.some(
            (c) => c.q === q && c.r === r && c.layer === "terrain" && c.regions.includes(name)
          );
          stroke.current.regionOn = !had;
        }
        return [...named, { kind: "region", q, r, name, on: stroke.current?.regionOn }];
      }
      if (tool === "height") return [{ kind: "height", q, r, height: paint.height }];
      if (tool === "stamp") {
        // A one-hex custom tile paints like a tile; a bigger one goes down once per click.
        const def = paint.stamp ? drawn?.pack?.config.stamps[paint.stamp] : undefined;
        if (p.phase !== "down" && def && customSize(def) > 1) return null;
        if (!paint.stamp) {
          setStatus("Choose a custom tile in the palette first");
          return null;
        }
        return [{ kind: "stamp", q, r, name: paint.stamp, rot: paint.rot, height: paint.height }];
      }
      if (pointLayer) {
        if (p.phase !== "down") return null;
        if (erase) {
          const near = layout ? nearestPoint(layout, layer, p.point) : null;
          return near ? [{ kind: "remove", line: near.line }] : null;
        }
        if (!spec && layer === "marker") {
          setStatus("Pick a marker from the palette first");
          return null;
        }
        const words = paint.text.trim();
        if (layer === "label" && !words) {
          setStatus("Type the label's text first");
          return null;
        }
        const content =
          layer === "label"
            ? `(${words.replace(/[()]/g, "")})${spec ? ` ${spec}` : ""}`
            : `${spec}${words ? ` (${words.replace(/[()]/g, "")})` : ""}`;
        return [{ kind: "point", layer, q: p.point.q, r: p.point.r, content }];
      }
      const edits = cellEdits([p.hex], erase);
      if (edits.length === 0) setStatus("Pick something from the palette first");
      return edits;
    },
    [paint, layout, setPaint, cellEdits, level, regionInImport, mode]
  );

  /**
   * Starting a detail on a coarse hex: its inner hexes at `depth` get its tile
   * (terrain, base, height), staged until Done. Once per coarse hex; one whose
   * inner hexes have anything of their own already isn't filled.
   */
  const ensureFill = React.useCallback(
    (depth: number, at: Axial, coarse: ParsedHexMap | undefined) => {
      if (!depth || !coarse) return;
      const k = hexKey(at.q, at.r);
      const was = fillsRef.current[depth] ?? {};
      if (k in was) return;
      const own = paintedHexes(parseHexMap(levelView(draftRef.current, depth)));
      for (const i of depth === levelRef.current ? shownImportsRef.current : [])
        for (const c of i.map.cells) own.add(hexKey(c.q + i.offset[0], c.r + i.offset[1]));
      const started = innerHexesOf(at.q, at.r).some((h) => own.has(hexKey(h.q, h.r)));
      const tile = started ? null : coarseTile(coarse, at.q, at.r);
      setFills({ ...fillsRef.current, [depth]: { ...was, [k]: tile ? fillHexes(at.q, at.r, tile, own) : [] } });
    },
    [setFills]
  );
  /** The fills staged so far written into the block (Done): one undo step. */
  const writeFills = React.useCallback(() => {
    let text = draftRef.current;
    for (const [d, byHex] of Object.entries(fillsRef.current)) {
      const depth = Number(d);
      const own = paintedHexes(parseHexMap(levelView(text, depth)));
      const hexes = Object.values(byHex)
        .flat()
        .filter((f) => !own.has(hexKey(f.q, f.r)));
      if (hexes.length) text = editLevel(text, depth, (v) => withFill(v, hexes));
    }
    setFills({});
    if (text === draftRef.current) return;
    const start = draftRef.current;
    show(text);
    commit(start);
    schedule();
  }, [setFills, show, commit, schedule]);
  const parentMapRef = React.useRef<ParsedHexMap | undefined>(undefined);
  parentMapRef.current = level ? parent?.map : undefined;
  /** A stroke at a level reaching a coarse hex: the detail there starts with its tile. */
  const reach = React.useCallback(
    (hexes: Axial[]) => {
      const depth = levelRef.current;
      if (!depth) return;
      for (const k of coarseHexesOf(hexes)) {
        const [q, r] = k.split(",").map(Number);
        ensureFill(depth, { q, r }, parentMapRef.current);
      }
    },
    [ensureFill]
  );

  const onPointer = React.useCallback(
    (p: PaintPointer) => {
      const { tool } = paint;
      const at = toPoint(p.point, R);
      // Picking a hex for a region's name: this click is the hex, and nothing else happens.
      if (pickingLabelHex) {
        if (p.phase === "down") setLabelHex({ hex: [p.hex.q, p.hex.r], n: (labelHex?.n ?? 0) + 1 });
        return;
      }
      if (p.phase === "down") {
        setStatus(undefined);
        setPicked(p.hex);
        stroke.current = {
          seen: new Set(),
          start: draftRef.current,
          text: draftRef.current,
          imports: importEditsRef.current,
        };
      }
      const s = stroke.current;
      if (!s) return;

      // Mark's Move: drag a marker or label; Shift drops it on a hex's middle.
      // Edit selects what it presses on (either layer, the brush's first) and drags it the same way.
      if (tool === "move" || tool === "edit") {
        if (p.phase === "down") {
          const layer = paint.layer === "label" ? "label" : "marker";
          if (tool === "edit") {
            const other = layer === "label" ? "marker" : "label";
            const hit = layout ? (pointHit(layout, layer, p.point) ?? pointHit(layout, other, p.point)) : null;
            setPoint(hit);
            s.moving = hit?.line;
            if (!hit) setStatus("Click a marker or a label to edit it (regions: in the Regions mode)");
            return;
          }
          s.moving = layout ? nearestPoint(layout, layer, p.point)?.line : undefined;
          if (s.moving === undefined) setStatus(`Press on a ${layer} to move it`);
          return;
        }
        if (p.phase === "move" && s.moving !== undefined) {
          const to = p.shift ? p.hex : p.point;
          live([{ kind: "move", line: s.moving, q: to.q, r: to.r }]);
          return;
        }
        stroke.current = null;
        commitLive();
        return;
      }

      // Gestures that draw: a lasso loop, a selection box.
      if (tool === "lasso" || tool === "select") {
        if (p.phase === "down") {
          setGesture(
            tool === "lasso"
              ? { kind: "lasso", pts: [at], erase: p.button === 2 }
              : { kind: "box", a: at, b: at, mode: p.shift ? "add" : p.alt ? "cut" : "set" }
          );
          return;
        }
        const g = gestureRef.current;
        if (p.phase === "move") {
          if (g?.kind === "lasso") setGesture({ ...g, pts: [...g.pts, at] });
          else if (g?.kind === "box") setGesture({ ...g, b: at });
          return;
        }
        stroke.current = null;
        setGesture(null);
        if (g?.kind === "lasso") {
          const inside = hexesInPolygon(g.pts, R);
          if (!g.erase) reach(inside);
          const edits = cellEdits(inside, g.erase);
          if (paint.layer === "marker" || paint.layer === "label") setStatus("Fill works on hex layers");
          else if (!edits.length && !g.erase) setStatus("Pick something from the palette first");
          else apply(edits);
        } else if (g?.kind === "box") {
          const small = Math.hypot(g.b.x - g.a.x, g.b.y - g.a.y) < R * 0.3;
          const hexes = small ? [p.hex] : hexesInRect(g.a, g.b, R);
          const next = g.mode === "set" ? new Set<string>() : new Set(selection);
          for (const h of hexes) {
            const k = hexKey(h.q, h.r);
            if (g.mode === "cut" || (small && g.mode === "add" && next.has(k))) next.delete(k);
            else next.add(k);
          }
          setSelection(next);
        }
        return;
      }

      // Look: drag shifts the hex's tile.
      if (tool === "look") {
        if (p.phase === "down") {
          const target = lookTarget(parseHexMap(viewOf(s.text)), p.hex, paint.layer);
          if (target)
            s.look = { from: at, shift: target.look?.shift ?? [0, 0], line: target.line, look: target.look ?? {} };
          return;
        }
        if (p.phase === "move" && s.look) {
          const { from, shift, line, look } = s.look;
          const dx = (at.x - from.x) / (2 * R);
          const dy = (at.y - from.y) / (2 * R);
          live([{ kind: "look", line, look: { ...look, shift: [shift[0] + dx, shift[1] + dy] } }]);
          return;
        }
        stroke.current = null;
        commitLive();
        return;
      }

      if (p.phase === "up") {
        stroke.current = null;
        if (s.text !== s.start || (s.imports && s.imports !== importEditsRef.current)) {
          commit(s.start, s.imports);
          schedule();
        }
        return;
      }
      // Each hex once per stroke.
      const k = hexKey(p.hex.q, p.hex.r);
      if (s.seen.has(k)) return;
      s.seen.add(k);
      if ((tool === "paint" || tool === "stamp" || tool === "height") && p.button !== 2 && !p.alt) reach([p.hex]);
      const edits = editsFor(p, s.text);
      if (!edits) return;
      const next = editText(s.text, edits);
      if (next === s.text) return;
      s.text = next;
      // Drawn at once; one undo step and one write for the whole stroke.
      show(next);
    },
    [
      paint,
      R,
      setPicked,
      cellEdits,
      apply,
      selection,
      setSelection,
      live,
      commitLive,
      commit,
      schedule,
      editsFor,
      show,
      pickingLabelHex,
      labelHex,
      reach,
    ]
  );

  /** Play, Mark or Build: the brush fitted to what the mode offers. */
  const setMode = (next: MapMode) => {
    if (builder && next === "play") return;
    session.mode = next;
    setModeState(next);
    if (next !== "play") setPaint(stateForMode(paint, next));
    else {
      // Done: new details' fills are written with the rest.
      writeFills();
      void flush();
    }
  };
  const startEditing = () => setMode("build");
  const stopEditing = () => {
    if (builder) {
      builder.onClose();
      return;
    }
    setMode("play");
  };

  // Keys while painting: undo / redo, R turns the stamp, Escape clears the selection.
  const figureRef = React.useRef<HTMLDivElement>(null);
  // Mark and Build spread into the page's margins (measured once the map is drawn).
  const spill = useMarginSpill(figureRef, editing && !floating && !!drawn);
  // Esc puts a floating map back, unless it's busy with a selection or a field.
  React.useEffect(() => {
    if (!floating) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || selection.size) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      setFloating(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  React.useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest?.("input, textarea, [contenteditable]")) return;
      if (!figureRef.current?.matches(":hover") && !figureRef.current?.contains(document.activeElement)) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.stopPropagation();
        stepHistory(!e.shiftKey);
      } else if (e.key.toLowerCase() === "r" && !e.metaKey && !e.ctrlKey && paint.tool === "stamp") {
        e.preventDefault();
        setPaint({ ...paint, rot: (paint.rot + (e.shiftKey ? 5 : 1)) % 6 });
      } else if (e.key === "Escape" && selection.size) {
        e.preventDefault();
        setSelection(new Set());
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [editing, stepHistory, paint, setPaint, selection, setSelection]);

  // Somewhere to paint: around the map, and all over the parent hexes a detail map covers.
  const ghosts = React.useMemo(() => {
    if (!editing || !layout) return undefined;
    const ring = ghostRing(layout);
    // A level's empty hexes are a grid all over the level above (`gridArea`).
    if (level || !parsed.of) return ring;
    const covered = parsed.at
      ? new Set([hexKey(parsed.at[0], parsed.at[1])])
      : parentHexesOf(layout.hexes.values(), ratio, parsed.at);
    if (covered.size === 0) covered.add("0,0");
    if (covered.size > 24) return ring;
    const out = new Map(ring.map((h) => [hexKey(h.q, h.r), h]));
    for (const k of covered) {
      const [pq, pr] = k.split(",").map(Number);
      for (const h of childHexesOf(pq, pr, ratio, parsed.at)) {
        const hk = hexKey(h.q, h.r);
        if (!layout.hexes.has(hk)) out.set(hk, h);
      }
    }
    return [...out.values()];
  }, [editing, layout, parsed.of, parsed.at, ratio, level]);

  const editingProps = React.useMemo<HexMapEditing | undefined>(
    () =>
      editing && ghosts
        ? {
            ghosts,
            pan: paint.tool === "pan",
            onPointer,
            status: status ?? (unsaved && !builder ? "Not saved yet: Done writes your changes to the note" : undefined),
          }
        : undefined,
    [editing, ghosts, paint.tool, onPointer, status, unsaved, builder]
  );
  // The view now, in every mode (a level switch starts from it); kept for re-renders while working.
  const viewNow = React.useRef<ViewBox | undefined>(session.view);
  const editingRef = React.useRef(editing);
  editingRef.current = editing;
  const onViewChange = React.useCallback(
    (v: ViewBox) => {
      viewNow.current = v;
      if (editingRef.current) session.view = v;
    },
    [session]
  );

  // ---- stamps, selection, detail ----
  const pack = drawn?.pack;
  /** The tile builder, on a custom tile or (from a selection) a new one. */
  const buildTile = (name?: string, lines?: string[]) => {
    if (!pack) {
      setStatus("Custom tiles need a pack");
      return;
    }
    openTileBuilder(app, { pack: pack.name, name, lines: lines ?? (name ? pack.config.stamps[name] : []) });
  };
  const deleteStamp = async (name: string) => {
    if (
      !pack ||
      !window.confirm(`Delete the custom tile "${name}" from ${pack.name}? Maps using it will show a problem.`)
    )
      return;
    await editPackYml(app, pack.name, [{ kind: "stamp-set", name, lines: null }]);
  };
  const stampHere = picked ? parsed.stamps?.find((st) => st.q === picked.q && st.r === picked.r) : undefined;
  const expandStamp = () => {
    const def = stampHere && pack?.config.stamps[stampHere.name];
    if (!stampHere || !def) return;
    apply([{ kind: "replace", line: stampHere.line, items: stampItems(def, stampHere) }]);
  };

  const pickedKey = picked ? hexKey(picked.q, picked.r) : "";
  // Each level's scale, from the main map's: 30 mi, 5 mi, 1 mi.
  const levelScales = [0, 1, 2].map((d) => levelScale(top.scale, d));
  // Semantic zoom: in Build and Mark down to the finest level; in Play, where there's detail to see.
  const levels =
    builder || parsed.of
      ? undefined
      : {
          canIn: level < MAX_LEVEL && (editing || belowMarks.size > 0),
          canOut: level > 0,
          onLevel: (dir: 1 | -1, v: ViewBox) => setLevel(level + dir, viewAtLevel(v, level, level + dir)),
        };
  const detailOfPicked = details.get(pickedKey);
  // A level switch's view, shown once the new level is drawn.
  // A level below the main map keeps its view across a re-render (Done writing the note), in every mode.
  const [levelView_, setLevelView] = React.useState<{ box: ViewBox; n: number } | null>(() =>
    session.level && session.view ? { box: session.view, n: 1 } : null
  );
  /** Show another level of the block, at this view (that level's units). */
  const setLevel = React.useCallback(
    (next: number, box: ViewBox) => {
      if (next < 0 || next > MAX_LEVEL || next === levelRef.current) return;
      session.level = next;
      levelRef.current = next;
      setLevelState(next);
      setSelection(new Set());
      setPicked(null);
      session.view = box;
      viewNow.current = box;
      setLevelView((v) => ({ box, n: (v?.n ?? 0) + 1 }));
    },
    [session, setSelection, setPicked]
  );
  /** The view a level would show, kept where the view is now. */
  const viewFor = (next: number): ViewBox =>
    viewAtLevel(viewNow.current ?? layout?.bounds ?? { x: 0, y: 0, w: 1, h: 1 }, level, next);
  /** The level below, framed on a hex of this one. */
  const zoomInto = (depth: number, q: number, r: number) => {
    const c = hexCenter(q, r, R);
    const k = Math.pow(LEVEL_RATIO, depth - level);
    const span = 1.4 * R * k;
    setLevel(depth, { x: c.x * k - span * 1.2, y: c.y * k - span, w: span * 2.4, h: span * 2 });
  };
  const openDetail = (link: string): boolean => {
    if (!link.startsWith(DETAIL_LINK)) return false;
    const m = link.slice(DETAIL_LINK.length).match(/^(\d+):(-?\d+),(-?\d+)$/);
    if (m) zoomInto(Number(m[1]), Number(m[2]), Number(m[3]));
    return true;
  };

  /** Detail: zoom into the picked hex a level down (its inner hexes start as its tile, staged until Done). */
  const makeDetail = () => {
    if (!picked || level >= MAX_LEVEL) return;
    if (detailOfPicked && !detailOfPicked.startsWith(DETAIL_LINK)) {
      void app.workspace.openLinkText(detailOfPicked, sourcePath, "tab");
      return;
    }
    ensureFill(level + 1, picked, mergeImports(parsed, shownImports));
    zoomInto(level + 1, picked.q, picked.r);
  };

  const target =
    editing && paint.tool === "look" && paint.layer === "stack" && stackIndex !== null
      ? (cellsAt(parsed, picked!.q, picked!.r, "stack")[stackIndex] ?? lookTarget(parsed, picked, paint.layer))
      : editing && paint.tool === "look"
        ? lookTarget(parsed, picked, paint.layer)
        : null;

  // The Select tool's Tint: the selected hexes with edges (placed by hand or laid along a coast) or paths.
  const tintLayer = paint.tool === "select" && (paint.layer === "edge" || paint.layer === "path") ? paint.layer : null;
  const tinted = React.useMemo(() => {
    if (!tintLayer || selection.size === 0) return { hexes: [] as Axial[], tint: {} as HexTint };
    const has = new Set<string>();
    for (const c of parsed.cells)
      if (c.layer === tintLayer && c.spec && c.spec.toLowerCase() !== "none") has.add(hexKey(c.q, c.r));
    if (tintLayer === "edge")
      for (const item of layout?.items ?? []) if (/^-?\d+,-?\d+:edge:/.test(item.key)) has.add(item.key.split(":")[0]);
    const hexes = keysToHexes(new Set([...selection].filter((k) => has.has(k))));
    // From the first one that has a colour: a coast's tint line, else its lines.
    const look = hexes
      .flatMap((h) => parsed.cells.filter((c) => c.q === h.q && c.r === h.r && c.layer === tintLayer))
      .find((c) => c.look && (c.look.hue || (c.look.sat ?? 1) !== 1 || (c.look.bright ?? 1) !== 1))?.look;
    return { hexes, tint: { hue: look?.hue, sat: look?.sat, bright: look?.bright } };
  }, [tintLayer, selection, parsed, layout]);

  // ---- what's drawn under and over the map ----
  const t = parentTransform(ratio, parentAt, R);
  const parentHexes = React.useMemo(() => {
    if (!parent) return [];
    const keys = new Set(parent.layout.hexes.keys());
    if (layout) for (const k of parentHexesOf(layout.hexes.values(), ratio, parentAt)) keys.add(k);
    if (parentAt) keys.add(hexKey(parentAt[0], parentAt[1]));
    return [...keys].map((k) => k.split(",").map(Number) as [number, number]);
  }, [parent, layout, ratio, parentAt]);
  // A level's empty hexes: all over the levels above, and a hex's width round them.
  const gridArea = React.useMemo(() => {
    if (!level || !parent || !editing) return undefined;
    const pad = R * LEVEL_RATIO;
    const boxes = [viewAtLevel(parent.layout.bounds, 0, 1)];
    if (grand && level >= 2) boxes.push(viewAtLevel(grand.bounds, 0, 2));
    const x0 = Math.min(...boxes.map((b) => b.x)) - pad;
    const y0 = Math.min(...boxes.map((b) => b.y)) - pad;
    const x1 = Math.max(...boxes.map((b) => b.x + b.w)) + pad;
    const y1 = Math.max(...boxes.map((b) => b.y + b.h)) + pad;
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }, [level, parent, grand, editing, R]);
  // The coarse hex being worked in, outlined in the grid of the level above.
  const focus =
    level && picked ? coarseHexOf(picked.q, picked.r) : parentAt ? { q: parentAt[0], r: parentAt[1] } : null;

  // A detail map opens on the parent hexes it covers, not just its own; a level, on the whole level above.
  const frame = React.useMemo(() => {
    if (level && parent) {
      const b = parent.layout.bounds;
      return viewAtLevel({ x: b.x, y: b.y, w: b.w, h: b.h }, 0, 1);
    }
    if (!parent || parentHexes.length === 0) return undefined;
    const covered = parentAt ? [parentAt] : parentHexes;
    const xs: number[] = [];
    const ys: number[] = [];
    for (const [q, r] of covered) {
      const c = hexCenter(q, r, R);
      const x = (c.x + t.x) * t.scale;
      const y = (c.y + t.y) * t.scale;
      xs.push(x - R * t.scale, x + R * t.scale);
      ys.push(y - R * t.scale * 0.9, y + R * t.scale * 0.9);
    }
    const pad = R * 0.4;
    return {
      x: Math.min(...xs) - pad,
      y: Math.min(...ys) - pad,
      w: Math.max(...xs) - Math.min(...xs) + 2 * pad,
      h: Math.max(...ys) - Math.min(...ys) + 2 * pad,
    };
  }, [parent, parentHexes, parentAt, R, t.x, t.y, t.scale, level]);

  const underlayEl =
    underlay && parsed.underlay ? (
      <image
        href={underlay.url}
        x={hexCenter(parsed.underlay.at[0], parsed.underlay.at[1], R).x}
        y={hexCenter(parsed.underlay.at[0], parsed.underlay.at[1], R).y}
        width={parsed.underlay.width * 2 * R}
        height={(parsed.underlay.width * 2 * R * underlay.size.h) / underlay.size.w}
        opacity={parsed.underlay.opacity}
        preserveAspectRatio="none"
        className="rpg-hexmap-underlay"
      />
    ) : null;

  const backdrop = (
    <>
      {parent && parentMode === "faint" && (
        // Faded as one, so the level above hides the one above it where it has hexes.
        <g className="rpg-hexmap-parent">
          {grand && level >= 2 && (
            <g transform={`scale(${LEVEL_RATIO * LEVEL_RATIO})`}>
              <HexLayoutGroup layout={grand} />
            </g>
          )}
          <g transform={`scale(${t.scale}) translate(${t.x} ${t.y})`}>
            <HexLayoutGroup layout={parent.layout} />
          </g>
        </g>
      )}
      {!parsed.underlay?.top && underlayEl}
    </>
  );

  // A hex with detail below it: a small magnifier in its corner while the pointer is on it, to zoom in.
  const detailMark = (hex: HexInfo) => {
    const path = details.get(hexKey(hex.q, hex.r));
    if (!path) return null;
    const x = hex.cx + R * 0.48;
    const y = hex.cy - R * 0.52;
    const r = R * 0.13;
    return (
      <g className="rpg-hexmap-detail-mark" data-link={path}>
        <title>
          {path.startsWith(DETAIL_LINK)
            ? "Zoom into this hex"
            : `Open the detail map: ${path.split("/").pop()?.replace(/\.md$/, "")}`}
        </title>
        <circle cx={x} cy={y} r={r} />
        <circle cx={x - r * 0.12} cy={y - r * 0.12} r={r * 0.42} fill="none" strokeWidth={R * 0.022} />
        <path d={`M${x + r * 0.2},${y + r * 0.2}l${r * 0.32},${r * 0.32}`} strokeWidth={R * 0.03} />
      </g>
    );
  };

  const edited: EditedPoint | null = (() => {
    if (!point || paint.tool !== "edit") return null;
    if (point.layer === "marker") {
      const line = parsed.markers.find((m) => m.line === point.line);
      return line ? { layer: "marker", line } : null;
    }
    const line = parsed.labels.find((l) => l.line === point.line);
    return line ? { layer: "label", line } : null;
  })();

  const overlay = (
    <>
      {play.overlay}
      {editing && staged.length > 0 && (
        <g className="rpg-hexmap-staged">
          <title>Filled from the hex above: Done writes these</title>
          {staged.map((f) => {
            const info = layout?.hexes.get(hexKey(f.q, f.r));
            const c = info ? { x: info.cx, y: info.cy } : hexCenter(f.q, f.r, R);
            return <polygon key={`${f.q},${f.r}`} points={hexPoints(c.x, c.y, R)} strokeWidth={R / 20} />;
          })}
        </g>
      )}
      {parsed.underlay?.top && underlayEl}
      {parent && parentMode !== "off" && (
        <g className="rpg-hexmap-parent-grid">
          {parentHexes.map(([q, r]) => {
            const c = hexCenter(q, r, R);
            const x = (c.x + t.x) * t.scale;
            const y = (c.y + t.y) * t.scale;
            return (
              <g key={`${q},${r}`}>
                <polygon
                  points={hexPoints(x, y, R * t.scale)}
                  strokeWidth={R / 10}
                  className={focus && focus.q === q && focus.r === r ? "is-focus" : undefined}
                />
                <text x={x} y={y - R * t.scale * 0.72} style={{ fontSize: R * 0.6 }}>
                  {q},{r}
                </text>
              </g>
            );
          })}
        </g>
      )}
      {builder && (
        <polygon
          points={hexPoints(hexCenter(0, 0, R).x, hexCenter(0, 0, R).y, R)}
          className="rpg-hexmap-origin"
          strokeWidth={R / 16}
        />
      )}
      {editing &&
        paint.tool === "select" &&
        [...selection].map((k) => {
          const [q, r] = k.split(",").map(Number);
          const info = layout?.hexes.get(k);
          const c = info ? { x: info.cx, y: info.cy } : hexCenter(q, r, R);
          return <polygon key={`sel:${k}`} points={hexPoints(c.x, c.y, R * 0.92)} className="rpg-hexmap-selected" />;
        })}
      {editing &&
        paint.tool === "edit" &&
        edited &&
        layout &&
        (() => {
          // A box round the marker, or round the label turned with it.
          const b = edited.layer === "label" ? layout.banners.find((x) => x.line === edited.line.line) : undefined;
          const box = b
            ? { x: b.cx - (b.w * b.scale) / 2, y: b.cy - (b.h * b.scale) / 2, w: b.w * b.scale, h: b.h * b.scale }
            : layout.markers.find((m) => m.line === edited.line.line)?.box;
          if (!box) return null;
          const pad = R * 0.08;
          return (
            <rect
              x={box.x - pad}
              y={box.y - pad}
              width={box.w + 2 * pad}
              height={box.h + 2 * pad}
              transform={b ? `rotate(${b.rot} ${b.cx} ${b.cy})` : undefined}
              className="rpg-hexmap-picked"
              fill="none"
              strokeWidth={R / 16}
            />
          );
        })()}
      {editing && paint.tool === "look" && picked && (
        <polygon
          points={(() => {
            const info = layout?.hexes.get(pickedKey);
            const c = info ? { x: info.cx, y: info.cy } : hexCenter(picked.q, picked.r, R);
            return hexPoints(c.x, c.y, R);
          })()}
          className="rpg-hexmap-picked"
          strokeWidth={R / 12}
        />
      )}
      {gesture?.kind === "lasso" && (
        <polygon
          points={gesture.pts.map((p) => `${p.x},${p.y}`).join(" ")}
          className="rpg-hexmap-lasso"
          strokeWidth={R / 20}
        />
      )}
      {gesture?.kind === "box" && (
        <rect
          x={Math.min(gesture.a.x, gesture.b.x)}
          y={Math.min(gesture.a.y, gesture.b.y)}
          width={Math.abs(gesture.b.x - gesture.a.x)}
          height={Math.abs(gesture.b.y - gesture.a.y)}
          className="rpg-hexmap-lasso"
          strokeWidth={R / 20}
        />
      )}
    </>
  );

  const empty =
    parsed.cells.length === 0 && parsed.labels.length === 0 && parsed.markers.length === 0 && !parsed.stamps?.length;
  if (empty && !editing && !parent && !parsed.imports?.length) {
    return (
      <div className="notice">
        rpg map: add hexes below the <code>---</code> — <code>t(q,r): terrain</code>, <code>s(q,r): stack</code>,{" "}
        <code>p(q,r): path</code>, <code>m(q,r): marker</code>, <code>l(q,r): (Text) label</code>
        {parsed.errors.length > 0 &&
          ` (${parsed.errors.length} problem${parsed.errors.length === 1 ? "" : "s"}: line ${parsed.errors[0].line}: ${parsed.errors[0].message})`}{" "}
        <button type="button" onClick={startEditing}>
          Paint it
        </button>
      </div>
    );
  }
  if (!drawn) return <div className="rpg-hexmap rpg-hexmap--loading">Drawing hex map…</div>;
  const settings = settingsStore.getSettings();
  const regionNames = [...new Set([...Object.keys(parsed.regions), ...parsed.cells.flatMap((c) => c.regions)])].sort(
    (a, b) => a.localeCompare(b)
  );
  const brushSpec = paint.layer === "marker" || paint.layer === "label" ? undefined : paint.spec[paint.layer];

  /** Moves these hexes (this map's own) into a map at the end of a note picked from the vault; this map imports it. */
  const extractTo = (hexes: Set<string>, what: string) => {
    if (builder) return;
    if (level) {
      new Notice("Hex map: extract from the main map, not a finer level.");
      return;
    }
    pickNote(app, `The note ${what} goes in…`, sourcePath, (file) => void extractInto(file, hexes));
  };
  const extractInto = async (file: TFile, hexes: Set<string>) => {
    const host = app.vault.getAbstractFileByPath(sourcePath);
    if (!(host instanceof TFile)) return;
    const text = await app.vault.read(file);
    if (/```rpg map\n(?:[^\n]*\n)*?\s*grid:\s*hex\b/.test(text)) {
      new Notice(`Hex map: ${file.basename} has a hex map already, so nothing was moved.`);
      return;
    }
    const start = draftRef.current;
    const out = extractHexes(
      start,
      hexes,
      app.metadataCache.fileToLinktext(file, sourcePath, true),
      app.metadataCache.fileToLinktext(host, file.path, true),
      file.basename
    );
    if (!out) {
      new Notice("Hex map: those hexes have nothing on them to move.");
      return;
    }
    // The new map first, so the import it gets finds it; then this map, saved straight away.
    await app.vault.process(file, (t) => `${t.replace(/\s*$/, "")}\n\n${out.block}\n`);
    show(out.remaining);
    commit(start);
    setSelection(new Set());
    await flush();
    new Notice(
      `Hex map: ${out.hexes} hex${out.hexes === 1 ? "" : "es"}${out.markers ? ` and ${out.markers} marker${out.markers === 1 ? "" : "s"}` : ""} moved to ${file.basename}.`
    );
  };

  const regionId = paint.region.trim().replace(/\s+/g, "");
  const regionsMode = mode === "regions";
  // The map as drawn, imports and all: what the Regions mode lists, shows and counts.
  const whole = regionsMode ? mergeImports(parsed, merged) : parsed;
  const regionHexes = new Map<string, Set<string>>();
  if (regionsMode)
    for (const c of whole.cells)
      for (const r of c.regions) regionHexes.set(r, (regionHexes.get(r) ?? new Set()).add(hexKey(c.q, c.r)));
  const shownRegion = whole.regions[regionId];
  const ownRegion = parsed.regions[regionId];
  // Imported, its own map declaring it: this map's declaration counts only as an exception.
  const regionFrom = shownRegion?.source ? noteName(shownRegion.source.split("/").pop()!) : undefined;
  const regionFromTitle = shownRegion?.source?.split("/").pop()?.replace(/\.md$/i, "");
  const regionEntries: RegionEntry[] = regionsMode
    ? (() => {
        const ancestors = (id: string, seen = new Set<string>()): string[] => {
          const parent = whole.regions[id]?.parent;
          if (!parent || seen.has(id) || !whole.regions[parent]) return [];
          seen.add(id);
          return [...ancestors(parent, seen), parent];
        };
        const ids = [...new Set([...Object.keys(parsed.regions), ...regionHexes.keys()])];
        return ids
          .map((id) => {
            const r = whole.regions[id];
            const source = r?.source?.split("/").pop()?.replace(/\.md$/i, "");
            return {
              id,
              title:
                typeof r?.label === "string"
                  ? r.label
                  : r?.link
                    ? r.link.split("|").pop()!.split("#")[0].split("/").pop()!
                    : id.replace(/([a-z])([A-Z])/g, "$1 $2"),
              color: r?.color,
              hexes: regionHexes.get(id)?.size ?? 0,
              depth: ancestors(id).length,
              main: ownsRegion(parsed.regions[id], sourcePath),
              from: source,
              overridden: !!(source && parsed.regions[id]?.override),
              sortKey: [...ancestors(id), id].join("/"),
            };
          })
          .sort((a, b) => Number(b.main) - Number(a.main) || a.sortKey.localeCompare(b.sortKey))
          .map(({ sortKey: _, ...e }) => e);
      })()
    : [];
  const panels = (
    <>
      {regionsMode && (
        <RegionList
          entries={regionEntries}
          selected={regionId}
          onSelect={(id) => setPaint({ ...paint, region: id })}
          onNew={(name) => {
            const id = name.replace(/\s+/g, "");
            if (!parsed.regions[id]) apply([{ kind: "region-decl", id, value: name !== id ? { label: name } : {} }]);
            setPaint({ ...paint, region: id, tool: "region" });
          }}
        />
      )}
      {regionsMode && (
        <RegionPanel
          id={regionId}
          decl={regionFrom && !ownRegion?.override ? undefined : ownRegion}
          shown={shownRegion}
          from={regionFromTitle}
          follows={!!regionFrom && !ownRegion?.override}
          onRemove={
            builder
              ? undefined
              : () => {
                  if (regionFrom) {
                    apply([
                      { kind: "region-decl", id: regionId, value: { override: true, demark: "none", label: false } },
                    ]);
                    return;
                  }
                  const tagged = parsed.cells.filter((c) => c.regions.includes(regionId));
                  apply([
                    ...tagged.map((c) => ({ kind: "region" as const, q: c.q, r: c.r, name: regionId, on: false })),
                    ...(ownRegion ? [{ kind: "region-decl" as const, id: regionId, value: null }] : []),
                  ]);
                  setPaint({ ...paint, region: "" });
                }
          }
          onFollow={(follow) =>
            apply([
              {
                kind: "region-decl",
                id: regionId,
                // Following: this map says nothing of it. Changing: an exception, empty until a field is set.
                value: follow ? null : { override: true },
              },
            ])
          }
          regions={regionEntries.map((e) => e.id).sort((a, b) => a.localeCompare(b))}
          lettering={[...labelFamilies(pack).values()].filter((f) => f.lettering).map((f) => f.name)}
          hexes={regionHexes.get(regionId)?.size ?? 0}
          onDecl={(value) =>
            live([{ kind: "region-decl", id: regionId, value: regionFrom ? { ...value, override: true } : value }])
          }
          onCommit={commitLive}
          picking={pickingLabelHex}
          onPick={setPickingLabelHex}
          picked={labelHex}
          onExtract={
            builder || regionFrom
              ? undefined
              : () =>
                  extractTo(
                    new Set(parsed.cells.filter((c) => c.regions.includes(regionId)).map((c) => hexKey(c.q, c.r))),
                    regionId.replace(/([a-z])([A-Z])/g, "$1 $2")
                  )
          }
        />
      )}
      {paint.tool === "edit" && (
        <PointPanel
          point={edited}
          families={labelFamilyNames(pack)}
          lettering={[...labelFamilies(pack).values()].filter((f) => f.lettering).map((f) => f.name)}
          onContent={(content) => point && live([{ kind: "content", line: point.line, content }])}
          onCommit={commitLive}
          onRemove={() => {
            if (!point) return;
            apply([{ kind: "remove", line: point.line }]);
            setPoint(null);
          }}
        />
      )}
      {paint.tool === "look" && (
        <>
          <LookPanel
            target={
              target
                ? { q: target.q, r: target.r, layer: target.layer, spec: target.spec, look: target.look ?? {} }
                : null
            }
            onLook={(look) => target && live([{ kind: "look", line: target.line, look }])}
            onCommit={commitLive}
          />
          {paint.layer === "stack" && picked && (
            <StackListPanel
              elements={cellsAt(parsed, picked.q, picked.r, "stack").map((c) => ({
                line: c.line,
                spec: c.spec ?? "",
                count: c.count,
                look: c.look,
              }))}
              selectedIndex={stackIndex}
              onSwap={(idx1, idx2) => {
                const stackCells = cellsAt(parsed, picked.q, picked.r, "stack");
                if (idx1 < 0 || idx2 < 0 || idx1 >= stackCells.length || idx2 >= stackCells.length) return;
                const line1 = stackCells[idx1].line;
                const line2 = stackCells[idx2].line;
                apply([{ kind: "swap", line1, line2 }]);
              }}
              onRemove={(idx) => {
                const stackCells = cellsAt(parsed, picked.q, picked.r, "stack");
                if (idx < 0 || idx >= stackCells.length) return;
                const line = stackCells[idx].line;
                apply([{ kind: "remove", line }]);
              }}
              onSelect={(idx) => setStackIndexAndSync(idx)}
              onCommit={commitLive}
            />
          )}
        </>
      )}
      {paint.tool === "select" && (
        <SelectionPanel
          count={selection.size}
          brush={brushSpec}
          region={paint.region.trim()}
          onFill={() => apply(cellEdits(keysToHexes(selection), false))}
          onErase={() => apply(cellEdits(keysToHexes(selection), true))}
          onRegion={(on) => {
            const label = paint.region.trim();
            const name = label.replace(/\s+/g, "");
            // Hexes an imported map has are changed in that map; the rest here.
            const own: Axial[] = [];
            const byImport = new Map<PlacedImport, Axial[]>();
            for (const h of keysToHexes(selection)) {
              const from = level ? undefined : importAt(parsed, merged, h.q, h.r);
              if (from) byImport.set(from, [...(byImport.get(from) ?? []), h]);
              else own.push(h);
            }
            for (const [from, hexes] of byImport) regionInImport(from, hexes, name, label, on);
            if (own.length)
              apply([
                ...(label !== name && !parsed.regions[name]
                  ? [{ kind: "region-decl" as const, id: name, value: { label } }]
                  : []),
                ...own.map((h) => ({ kind: "region" as const, q: h.q, r: h.r, name, on })),
              ]);
          }}
          onSave={() => buildTile(undefined, stampFromHexes(viewOf(draftRef.current), selection))}
          onClear={() => setSelection(new Set())}
          onExtract={builder ? undefined : () => extractTo(selection, "these hexes")}
        />
      )}
      {tintLayer && selection.size > 0 && (
        <TintPanel
          layer={tintLayer}
          count={tinted.hexes.length}
          tint={tinted.tint}
          onTint={(tint) =>
            live(tinted.hexes.map((h) => ({ kind: "tint" as const, layer: tintLayer, q: h.q, r: h.r, tint })))
          }
          onCommit={commitLive}
        />
      )}
      {builder && (
        <BuilderPanel name={builder.name} pack={pack?.name} onSave={(n) => void builder.onSave(n, draftRef.current)} />
      )}
    </>
  );

  const mapPanels = (
    <>
      {!builder && (
        <ScalePanel
          scale={parsed.scale}
          levels={levels ? levelScales : []}
          level={level}
          onLevel={(d) => setLevel(d, viewFor(d))}
          of={
            level
              ? `${top.title ?? "this map"}${levelScales[level - 1] ? ` at ${levelScales[level - 1]}` : ""}`
              : parsed.of
          }
          ratio={ratio}
          parentMode={parentMode}
          onParentMode={(m) => applyTop([{ kind: "header", key: "parent", value: m === "faint" ? null : m }])}
          hex={picked}
          next={levelScales[level + 1]}
          detail={detailOfPicked ? (detailOfPicked.startsWith(DETAIL_LINK) ? "inline" : "note") : undefined}
          onDetail={makeDetail}
          staged={staged.length}
        />
      )}
      {!builder && level === 0 && (
        <UnderlayPanel
          underlay={parsed.underlay}
          onLive={(u) => live([{ kind: "header", key: "underlay", value: underlayValue(u) }])}
          onCommit={commitLive}
          onSet={(image) =>
            apply([
              {
                kind: "header",
                key: "underlay",
                value: image ? underlayValue({ image, opacity: 0.45, width: 10, at: [0, 0], top: false }) : null,
              },
            ])
          }
        />
      )}
    </>
  );

  const holding = paint.tool === "stamp" && paint.stamp;
  const used = new Set(parsed.cells.map((c) => c.spec).filter((sp): sp is string => !!sp));

  const map = (
    <HexMapView
      layout={drawn.layout}
      title={parsed.title}
      scale={parsed.scale}
      coords={parsed.coords ?? settings?.hexCoords ?? "hover"}
      gridLines={editing || (settings?.hexGridLines ?? false)}
      labelScale={settings?.hexLabelScale ?? 1}
      maxHeight={floating ? 92 : (settings?.hexMapMaxHeight ?? 75)}
      errors={
        imported.problems.length
          ? [...drawn.errors, ...imported.problems.map((message) => ({ line: 1, message }))]
          : drawn.errors
      }
      editing={editingProps}
      onEdit={startEditing}
      play={mode === "play" && !builder ? { claims: play.claims, onPointer: play.onPointer } : undefined}
      hud={play.hud}
      modeSwitch={!builder ? <ModeSwitch mode={mode} onMode={setMode} /> : undefined}
      float={!builder ? { open: floating, onToggle: () => setFloating(!floating) } : undefined}
      shown={{
        points: !hidden.points,
        regions: !hidden.regions,
        onPoints: () => toggleHidden("points"),
        onRegions: () => toggleHidden("regions"),
      }}
      initialView={session.view}
      startZoom={top.view && level === Math.min(top.view.level, MAX_LEVEL) && !editing ? top.view : undefined}
      onViewChange={onViewChange}
      levels={levels}
      showView={levelView_ && drawnLevel === level ? levelView_ : undefined}
      gridArea={gridArea}
      crumbs={
        levels &&
        (level > 0 || belowMarks.size > 0 || editing) && (
          <nav className="rpg-hexmap-crumbs" aria-label="Level">
            {levelScales.map((sc, d) => (
              <React.Fragment key={d}>
                {d > 0 && <LucideIcon name="chevron-right" size={12} />}
                <button
                  type="button"
                  aria-current={d === level ? "page" : undefined}
                  onClick={() => setLevel(d, viewFor(d))}
                  title={
                    d === level
                      ? "The level shown"
                      : `Show the map at ${sc ?? `level ${d}`} (or zoom ${d < level ? "out" : "in"})`
                  }
                >
                  {d === 0 && <LucideIcon name="map" size={12} />}
                  <span>{d === 0 ? `${top.title ?? "Map"}${sc ? ` · ${sc}` : ""}` : (sc ?? `level ${d}`)}</span>
                </button>
              </React.Fragment>
            ))}
            {level > 0 && (
              <span className="rpg-hexmap-crumbs-up">
                <button type="button" onClick={() => setLevel(level - 1, viewFor(level - 1))} title="Up a level">
                  <LucideIcon name="arrow-up" size={12} />
                  <span>Up</span>
                </button>
              </span>
            )}
          </nav>
        )
      }
      backdrop={backdrop}
      overlay={overlay}
      hoverOverlay={detailMark}
      overTiles={
        far && (
          <g className="rpg-hexmap-far" transform={`scale(${1 / LEVEL_RATIO})`}>
            <HexLayoutGroup layout={far} />
          </g>
        )
      }
      frame={frame}
      toolbar={
        editing && (
          <HexPaintToolbar
            mode={mode}
            onMode={setMode}
            pack={pack}
            state={paint}
            onChange={setPaint}
            canUndo={history.undo > 0}
            canRedo={history.redo > 0}
            onUndo={() => stepHistory(true)}
            onRedo={() => stepHistory(false)}
            onDone={stopEditing}
            unsaved={unsaved && !builder}
          />
        )
      }
      sidebar={
        editing && (
          <HexPaintSidebar
            pack={pack}
            state={paint}
            onChange={setPaint}
            regions={regionNames}
            step={parsed.step ?? STEP_METRES}
            extra={panels}
            footer={regionsMode ? undefined : mapPanels}
            bare={regionsMode}
            used={used}
            brush={
              holding ? (
                <CustomBrush
                  pack={pack}
                  name={paint.stamp!}
                  rot={paint.rot}
                  onTurn={(rot) => setPaint({ ...paint, rot })}
                  onDrop={() => setPaint({ ...paint, tool: "paint" })}
                  here={stampHere ? { name: stampHere.name } : undefined}
                  onExpand={expandStamp}
                  onRemove={() => stampHere && apply([{ kind: "remove", line: stampHere.line }])}
                />
              ) : undefined
            }
            palettePrefix={
              mode === "build" && (
                <CustomTilesPanel
                  pack={pack}
                  stamp={holding ? paint.stamp : undefined}
                  onPick={(name) => setPaint({ ...paint, stamp: name, tool: "stamp" })}
                  onNew={() => buildTile()}
                  onEdit={(name) => buildTile(name)}
                  onDelete={(name) => void deleteStamp(name)}
                />
              )
            }
          />
        )
      }
      onOpenLink={(link, evt) =>
        openDetail(link) || void app.workspace.openLinkText(link, sourcePath, evt.metaKey || evt.ctrlKey)
      }
      // Page previews only in Play: in Mark and Build a hover is aiming at the map, not the note.
      onHoverLink={(link, evt, targetEl) =>
        !editing &&
        !link.startsWith(DETAIL_LINK) &&
        app.workspace.trigger("hover-link", {
          event: evt,
          source: "preview",
          hoverParent: component,
          targetEl,
          linktext: link,
          sourcePath,
        })
      }
    />
  );

  // In a window of its own: the map over the page, and a note in its place.
  if (floating && !builder) {
    return (
      <div ref={figureRef} className="rpg-hexmap-float-spot">
        <button type="button" className="rpg-hexpaint-button" onClick={() => setFloating(false)}>
          <LucideIcon name="minimize-2" size={13} />
          <span>{parsed.title ?? "The map"} is open in a window — put it back</span>
        </button>
        {ReactDOM.createPortal(
          <div
            className="rpg-hexmap-float"
            role="dialog"
            aria-label={`Map: ${parsed.title ?? "hex map"}`}
            onPointerDown={(e) => e.target === e.currentTarget && setFloating(false)}
          >
            <section className="rpg-hexmap-float-pane">{map}</section>
          </div>,
          document.body
        )}
      </div>
    );
  }
  // Mark and Build take the page's margins, as the log does with its sidebar open.
  return (
    <div
      ref={figureRef}
      className={spill ? "rpg-hexmap-wide" : undefined}
      style={spill ? { width: `calc(100% + ${spill}px)`, marginInlineStart: `${-spill / 2}px` } : undefined}
    >
      {map}
    </div>
  );
}

/** The innermost region a hex is in (a duchy before its realm), imports included. */
function innermostRegion(layout: HexLayout | undefined, at: Axial): string | undefined {
  const names = layout?.hexes.get(hexKey(at.q, at.r))?.regions ?? [];
  const depth = (name: string) => layout?.regions.find((g) => g.name === name)?.depth ?? 0;
  return [...names].sort((a, b) => depth(b) - depth(a))[0];
}

/** The marker or label of a layer under a point, as the Edit tool selects it. */
function pointHit(
  layout: HexLayout,
  layer: "marker" | "label",
  at: Axial
): { layer: "marker" | "label"; line: number } | null {
  const near = nearestPoint(layout, layer, at);
  return near ? { layer, line: near.line } : null;
}

/** A pack's label styles and banner families, by name, for the Edit panel. */
function labelFamilyNames(pack: HexPack | undefined): string[] {
  return [...labelFamilies(pack).values()]
    .map((f) => f.name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

/** How many hexes a custom tile covers. */
function customSize(def: string[]): number {
  return new Set(parseHexMap(`---\n${def.join("\n")}`).cells.map((c) => hexKey(c.q, c.r))).size;
}

function keysToHexes(keys: Set<string>): Axial[] {
  return [...keys].map((k) => {
    const [q, r] = k.split(",").map(Number);
    return { q, r };
  });
}

/** The marker or label nearest a point, within a hex. */
function nearestPoint(layout: HexLayout, layer: "marker" | "label", at: Axial): { line: number; spec?: string } | null {
  const R = layout.R;
  const { x, y } = toPoint(at, R);
  // What's pressed on: inside a marker's picture or a label's box (turned with it), the
  // smallest first; else the nearest middle within a hex's radius.
  const points =
    layer === "marker"
      ? layout.markers.map((m) => ({
          x: m.x,
          y: m.y - m.box.h / 2,
          line: m.line,
          spec: m.spec,
          inside: x >= m.box.x && x <= m.box.x + m.box.w && y >= m.box.y && y <= m.box.y + m.box.h,
          area: m.box.w * m.box.h,
        }))
      : layout.banners.map((b) => {
          const a = (-b.rot * Math.PI) / 180;
          const dx = x - b.cx;
          const dy = y - b.cy;
          const u = dx * Math.cos(a) - dy * Math.sin(a);
          const v = dx * Math.sin(a) + dy * Math.cos(a);
          const hw = (b.w * b.scale) / 2;
          const hh = (b.h * b.scale) / 2;
          return {
            x: b.cx,
            y: b.cy,
            line: b.line,
            spec: undefined as string | undefined,
            inside: Math.abs(u) <= hw && Math.abs(v) <= hh,
            area: 4 * hw * hh,
          };
        });
  let best: { line: number; spec?: string } | null = null;
  let bestArea = Infinity;
  let bestD = R;
  for (const p of points) {
    // Imported markers and labels (negative lines) belong to their own notes.
    if (p.line <= 0) continue;
    if (p.inside) {
      if (p.area < bestArea) {
        bestArea = p.area;
        best = { line: p.line, spec: p.spec };
      }
      continue;
    }
    if (bestArea < Infinity) continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < bestD) {
      bestD = d;
      best = { line: p.line, spec: p.spec };
    }
  }
  return best;
}
