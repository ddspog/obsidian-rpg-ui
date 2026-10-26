/**
 * The hex pack browser, in the plugin settings: pick a pack and a layer,
 * browse its folders and tiles, see the selection on a 7-hex cluster, tune
 * where it sits (pack, folder or tile level), and name it in the catalog.
 * Changes are a draft until Save, which edits the pack's `pack.yml` in place
 * (comments kept; a `pack.yml.bak` is made the first time). Tile files can be
 * renamed or moved to another layer (pack.yml following) and converted to WebP,
 * at once, with no draft open. On the base and terrain layers the preview's
 * middle hex stands raised, a slider's steps high, to show the base.
 * On the path layer, Classify gives each tile its shape — a type and a slot
 * (path-shapes.ts) — which places it in its family's `autotile:` table.
 * On the label layer, Classify names each banner piece for its role, and the
 * preview shows a sample text on the banner grown to fit it.
 * On the far layer (how terrains look from the level above, far.ts), each top
 * folder is a family: Classify gives its tiles their shapes in `far:`, the
 * family says which terrains it stands for, and the preview joins it up.
 */

import { type App, Notice, TFile } from "obsidian";
import * as React from "react";
import { FarComposer } from "lib/components/hexmap/far-composer";
import { HexMapStatic } from "lib/components/hexmap/hex-map-view";
import { LabelCoverage, LabelRolePanel, LabelTextBox, RoleBadge } from "lib/components/hexmap/label-studio";
import { MarkerBox, markerSorts } from "lib/components/hexmap/marker-studio";
import { measureEm } from "lib/components/hexmap/measure-text";
import { neighbour, SIDES } from "lib/domains/hexmap/axial";
import { autotileFamily } from "lib/domains/hexmap/autotile";
import { farLayout, resolveFar } from "lib/domains/hexmap/far";
import { labelFamilies } from "lib/domains/hexmap/labels";
import { type HexLayout, type ImageSize, layoutHexMap, resolveHexMap, terrainAround } from "lib/domains/hexmap/layout";
import {
  applyPackEdits,
  ownDefaults,
  ownFlag,
  ownTuning,
  type PackEdit,
  type Section,
  TUNE_KEYS,
  type TuneKey,
  type TuneLevel,
} from "lib/domains/hexmap/pack-yml-edit";
import {
  type AutotileFamily,
  DEFAULT_STEP,
  displayFor,
  type EdgeFamily,
  type FarFamily,
  type Ground,
  groundOf,
  type HexPack,
  type Layer,
  LAYERS,
  parsePackConfig,
  parseTileSpec,
  type PackConfig,
  type TileDisplay,
  type TileFile,
  type TileFolder,
} from "lib/domains/hexmap/packs";
import type { HexCell, HexLabelLine, HexMarkerLine, ParsedHexMap } from "lib/domains/hexmap/parse-hex-map";
import {
  type PathShape,
  pathShape,
  planShapeRenames,
  sameShape,
  shapesOf,
  type Centre,
  CENTRES,
  shapeFromName,
  shapeMask,
  shapeName,
  shapeSides,
  type ShapeSlot,
  shapesWithSides,
} from "lib/domains/hexmap/path-shapes";
import {
  canConvert,
  cleanTileName,
  convertToWebp,
  editPackYml,
  moveTiles,
  renameTile,
  renameTiles,
  tileFileOf,
} from "lib/services/hex-pack-files";
import { bakeFarFamily } from "lib/services/far-bake";
import { hexPackIndex } from "lib/services/hex-pack-index";

interface Props {
  app: App;
}

const TUNE_LABEL: Record<TuneKey, string> = {
  hexWidth: "Hex width (px)",
  zoom: "Zoom",
  offsetX: "Offset X (px)",
  offsetY: "Offset Y (px)",
  borderWidth: "Border",
  step: "Height step (px)",
};

/** Metres per step in the preview (the maps' default). */
const PREVIEW_STEP = 100;
const MAX_RAISE = 5;

const CENTRE_HINT: Record<Centre, string> = {
  hub: "a round centre: a cul-de-sac or roundabout on a road, a lake on a river",
  stub: "the path begins inside the hex and branches out; autotile only draws it where a map asks",
};

const withCentre = (shape: ShapeSlot, centre: Centre | null): ShapeSlot => (centre ? { ...shape, centre } : shape);

const R3 = Math.sqrt(3) / 2;
const HEX_POINTS = [0, 1, 2, 3, 4, 5]
  .map((k) => `${Math.cos((k * Math.PI) / 3).toFixed(3)},${Math.sin((k * Math.PI) / 3).toFixed(3)}`)
  .join(" ");

/** A flat-top hex of circumradius 1, centred on 0,0, with a spoke out through each
 *  side the shape uses; a hub draws a round centre, a stub a square one. */
function Spokes({ shape }: { shape: ShapeSlot | null }) {
  const sides = shape ? shapeSides(shape.type, shape.slot) : [];
  if (shape && pathShape(shape.type)?.kind === "edge") {
    // An edge piece lies along its sides: a bar on each hex edge it covers.
    return (
      <>
        <polygon points={HEX_POINTS} />
        {sides.map((side) => (
          <EdgeBar key={side} side={SIDES.indexOf(side)} />
        ))}
      </>
    );
  }
  return (
    <>
      <polygon points={HEX_POINTS} />
      {sides.map((side) => {
        const a = ((SIDES.indexOf(side) * 60 - 90) * Math.PI) / 180;
        return <line key={side} x1={0} y1={0} x2={R3 * Math.cos(a)} y2={R3 * Math.sin(a)} />;
      })}
      {shape?.mouth !== undefined && <EdgeBar side={shape.mouth} />}
      {shape?.centre === "hub" ? (
        <circle className="is-hub" r={0.32} />
      ) : shape?.centre === "stub" ? (
        <rect className="is-stub" x={-0.18} y={-0.18} width={0.36} height={0.36} />
      ) : (
        sides.length > 0 && <circle r={0.12} />
      )}
    </>
  );
}

/** A thick line along one hex edge (side 0 N … 5 NW): between corners 4 + side and 5 + side. */
function EdgeBar({ side }: { side: number }) {
  const at = (k: number) => [Math.cos(((k + side) * Math.PI) / 3), Math.sin(((k + side) * Math.PI) / 3)];
  const [x1, y1] = at(4);
  const [x2, y2] = at(5);
  return <line className="is-mouth" x1={x1} y1={y1} x2={x2} y2={y2} />;
}

function ShapeGlyph({ shape }: { shape: ShapeSlot | null }) {
  return (
    <svg className="rpg-hexstudio-glyph" viewBox={`-1 ${-R3} 2 ${2 * R3}`} aria-hidden="true">
      <Spokes shape={shape} />
    </svg>
  );
}

/** A path tile in its hex the way maps place it (the pack's hex width, zoom and
 *  offsets, as in layout.ts), with the shape's spokes over it to check the art. */
function FittedTile({ tile, display, shape }: { tile: TileFile; display: TileDisplay; shape: ShapeSlot | null }) {
  const size = useImageSize(tile.url);
  const m = 1.15; // room for art that overhangs the hex
  let art: React.ReactNode = null;
  if (display.clip) {
    art = <image href={tile.url} x={-1} y={-R3} width={2} height={2 * R3} preserveAspectRatio="none" />;
  } else if (size) {
    const scale = (2 / (display.hexWidth ?? size.w)) * display.zoom;
    const w = size.w * scale;
    const h = size.h * scale;
    art = (
      <image
        href={tile.url}
        x={-w / 2 + display.offsetX * scale}
        y={-h / 2 + display.offsetY * scale}
        width={w}
        height={h}
      />
    );
  }
  return (
    <svg
      className="rpg-hexstudio-fitted"
      viewBox={`${-m} ${-R3 * m} ${2 * m} ${2 * R3 * m}`}
      role="img"
      aria-label={tile.name}
    >
      {art}
      <g className="rpg-hexstudio-spokes">
        <Spokes shape={shape} />
      </g>
    </svg>
  );
}

function folderAt(root: TileFolder, path: string[]): TileFolder | null {
  let f: TileFolder | undefined = root;
  for (const part of path) {
    f = f?.folders.get(part);
    if (!f) return null;
  }
  return f ?? null;
}

/** The spec that picks a folder (`forest[lush]`) or one tile (`forest[lush][conifer-0]`). */
function specFor(path: string[], tile: TileFile | null): string {
  // Terrain's sections aren't named in specs: `land/forest` is `forest`.
  if (path.length > 1 && groundOf(path[0])) path = path.slice(1);
  const [base, ...rest] = path;
  return base + rest.map((p) => `[${p}]`).join("") + (tile ? `[${tile.name}]` : "");
}

function cell(
  q: number,
  r: number,
  layer: Layer,
  spec: string | undefined,
  line: number,
  color?: string,
  height = 0
): HexCell {
  return { q, r, layer, height, spec, color, regions: [], count: 1, line };
}

/** A centre hex and its six neighbours, showing the selection where it belongs;
 *  on the base and terrain layers the centre stands `raise` steps high. A label
 *  family (`title-1`, or any piece of it) shows `sample` on it. */
function previewMap(pack: HexPack, layer: Layer, spec: string, raise: number, sample: string): ParsedHexMap {
  const ring = [{ q: 0, r: 0 }, ...SIDES.map((side) => neighbour({ q: 0, r: 0 }, side))];
  const ground = pack.config.catalog.plains ? "plains" : undefined;
  const cells: HexCell[] = [];
  let line = 1;
  const lift = layer === "base" || layer === "terrain" ? raise * PREVIEW_STEP : 0;
  // A label shows alone, at the preview's full width.
  for (const h of layer === "label" ? [] : ring) {
    const height = h.q === 0 && h.r === 0 ? lift : 0;
    if (layer === "terrain") cells.push(cell(h.q, h.r, "terrain", spec, line++, undefined, height));
    else cells.push(cell(h.q, h.r, "terrain", ground, line++, ground ? undefined : "#b9c08a", height));
    if (layer === "base") cells.push(cell(h.q, h.r, "base", spec, line++, undefined, height));
  }
  if (layer === "stack" || layer === "edge") cells.push(cell(0, 0, layer, spec, line++));
  // A marker stands on the middle hex's centre, named with the sample.
  const markers: HexMarkerLine[] =
    layer === "marker" ? [{ q: 0, r: 0, spec, text: sample || undefined, size: 1, line: line++ }] : [];
  const labels: HexLabelLine[] = [];
  if (layer === "label") {
    labels.push({ q: 0, r: 0, text: sample || " ", family: parseTileSpec(spec).base, size: 1, rot: 0, line: line++ });
  }
  if (layer === "path") {
    // A family that joins up runs through the centre, north to south.
    const through = autotileFamily(pack, spec)
      ? [
          { q: 0, r: -1 },
          { q: 0, r: 0 },
          { q: 0, r: 1 },
        ]
      : [{ q: 0, r: 0 }];
    for (const h of through) cells.push(cell(h.q, h.r, "path", spec, line++));
  }
  return { seed: "preview", step: PREVIEW_STEP, regions: {}, cells, markers, labels, errors: [] };
}

/** A tile's own size, measured once per URL. */
function useImageSize(url: string | null): ImageSize | null {
  const [size, setSize] = React.useState<ImageSize | null>(null);
  React.useEffect(() => {
    setSize(null);
    if (!url) return;
    let alive = true;
    void hexPackIndex.measure(url).then((s) => alive && setSize(s));
    return () => {
      alive = false;
    };
  }, [url]);
  return size;
}

/** The widths of a folder's tiles, measured once per URL. */
function useImageWidths(urls: string[]): number[] {
  const key = urls.join("\n");
  const [widths, setWidths] = React.useState<number[]>([]);
  React.useEffect(() => {
    let alive = true;
    void Promise.all(urls.map((u) => hexPackIndex.measure(u))).then(
      (sizes) => alive && setWidths(sizes.filter((s): s is ImageSize => !!s).map((s) => s.w))
    );
    return () => {
      alive = false;
    };
  }, [key]);
  return widths;
}

function useLayout(
  pack: HexPack | null,
  layer: Layer,
  spec: string | null,
  raise: number,
  sample: string
): HexLayout | null {
  const [layout, setLayout] = React.useState<HexLayout | null>(null);
  React.useEffect(() => {
    if (!pack || !spec) {
      setLayout(null);
      return;
    }
    let alive = true;
    const resolved = resolveHexMap(
      previewMap(pack, layer, spec, raise, sample),
      new Map([[pack.name, pack]]),
      pack.name
    );
    void Promise.all(resolved.urls.map(async (u) => [u, await hexPackIndex.measure(u)] as const)).then((pairs) => {
      if (!alive) return;
      const sizes = new Map<string, ImageSize>();
      for (const [u, s] of pairs) if (s) sizes.set(u, s);
      setLayout(layoutHexMap(resolved, sizes, undefined, measureEm));
    });
    return () => {
      alive = false;
    };
  }, [pack, layer, spec, raise, sample]);
  return layout;
}

/** A far family joined up: seven hexes of it together (the middle one with every side joined,
 *  the ring with three each), and one on its own. */
function useFarPreview(pack: HexPack | null, family: string | null): HexLayout | null {
  const [layout, setLayout] = React.useState<HexLayout | null>(null);
  React.useEffect(() => {
    const fam = family && pack ? pack.config.far[family] : undefined;
    if (!pack || !fam) {
      setLayout(null);
      return;
    }
    let alive = true;
    const spec = fam.of[0] ?? family!;
    const hexes = [{ q: 0, r: 0 }, ...SIDES.map((side) => neighbour({ q: 0, r: 0 }, side)), { q: 3, r: -1 }];
    const map: ParsedHexMap = {
      seed: "far-preview",
      regions: {},
      cells: hexes.map((h, i) => cell(h.q, h.r, "terrain", spec, i + 1)),
      markers: [],
      labels: [],
      errors: [],
    };
    const resolved = resolveHexMap(map, new Map([[pack.name, pack]]), pack.name);
    const picks = resolveFar(map, pack, terrainAround(map, pack).around);
    const urls = [...resolved.urls, ...picks.map((p) => p.file.url)];
    void Promise.all(urls.map(async (u) => [u, await hexPackIndex.measure(u)] as const)).then((pairs) => {
      if (!alive) return;
      const sizes = new Map<string, ImageSize>();
      for (const [u, sz] of pairs) if (sz) sizes.set(u, sz);
      const fine = { map, layout: layoutHexMap(resolved, sizes, undefined, measureEm) };
      const empty = { map: { ...map, cells: [] }, layout: { ...fine.layout, items: [], hexes: new Map() } };
      // The hexes without far art (none, when the family has its tiles) shrunk tiles: the preview shows them full size.
      setLayout(farLayout(fine, picks, empty, pack, sizes));
    });
    return () => {
      alive = false;
    };
  }, [pack, family]);
  return layout;
}

function FolderTree({
  folder,
  path,
  selected,
  onSelect,
}: {
  folder: TileFolder;
  path: string[];
  selected: string[];
  onSelect: (path: string[]) => void;
}) {
  return (
    <ul>
      {[...folder.folders.values()].map((sub) => {
        const p = [...path, sub.name];
        const isSelected = p.join("/") === selected.join("/");
        const open = selected.slice(0, p.length).join("/") === p.join("/");
        return (
          <li key={sub.name}>
            <button
              type="button"
              className={isSelected ? "is-selected" : undefined}
              onClick={() => onSelect(p)}
              title={specFor(p, null)}
            >
              {sub.name} <span className="rpg-hexstudio-count">{countFiles(sub)}</span>
            </button>
            {open && sub.folders.size > 0 && (
              <FolderTree folder={sub} path={p} selected={selected} onSelect={onSelect} />
            )}
          </li>
        );
      })}
    </ul>
  );
}

function countFiles(f: TileFolder): number {
  let n = f.files.length;
  f.folders.forEach((sub) => (n += countFiles(sub)));
  return n;
}

function TuneField({
  label,
  own,
  effective,
  fallback = "image width",
  onChange,
}: {
  label: string;
  own: number | undefined;
  effective: number | undefined;
  /** Shown when nothing above sets it either. */
  fallback?: string;
  onChange: (v: number | null) => void;
}) {
  const [text, setText] = React.useState(own === undefined ? "" : String(own));
  React.useEffect(() => setText(own === undefined ? "" : String(own)), [own]);
  return (
    <label>
      <span>{label}</span>
      <input
        type="number"
        step="any"
        value={text}
        placeholder={effective === undefined ? fallback : String(effective)}
        onChange={(e) => {
          setText(e.target.value);
          const v = e.target.value.trim();
          if (v === "") onChange(null);
          else if (Number.isFinite(Number(v))) onChange(Number(v));
        }}
      />
    </label>
  );
}

export function HexPackStudio({ app }: Props) {
  const [packs, setPacks] = React.useState<Map<string, HexPack>>(new Map());
  const [packName, setPackName] = React.useState("");
  const [layer, setLayer] = React.useState<Layer>("terrain");
  const [folderPath, setFolderPath] = React.useState<string[]>([]);
  const [tile, setTile] = React.useState<TileFile | null>(null);
  const [levelKind, setLevelKind] = React.useState<TuneLevel["kind"]>("defaults");
  const [original, setOriginal] = React.useState("");
  const [edits, setEdits] = React.useState<PackEdit[]>([]);
  const [newName, setNewName] = React.useState("");
  const [fileName, setFileName] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  // The tile to pick again once the index has rebuilt (after a rename or conversion).
  const [reselect, setReselect] = React.useState<string | null>(null);
  const [ymlVersion, setYmlVersion] = React.useState(0);
  const [mode, setMode] = React.useState<"browse" | "classify" | "compose">("browse");
  // Terrain's land and water sections, each a tab of its own (the files stay in terrain/land, terrain/water).
  const [ground, setGround] = React.useState<Ground | null>("land");
  const [newFamily, setNewFamily] = React.useState("");
  // A far family begun in Compose with no folder yet (its folder is made when it's baked).
  const [startedFamily, setStartedFamily] = React.useState<string | null>(null);
  const [pickType, setPickType] = React.useState("");
  const [pickCentre, setPickCentre] = React.useState<Centre | null>(null);
  const [pickMouth, setPickMouth] = React.useState<number | null>(null);
  const [hoverShape, setHoverShape] = React.useState<ShapeSlot | null>(null);
  const [raise, setRaise] = React.useState(1);
  const [moveTo, setMoveTo] = React.useState<Layer>("base");
  const [sample, setSample] = React.useState("Featherbark");
  const [markerName, setMarkerName] = React.useState("Talon");

  const ymlPath = packName ? `${hexPackIndex.folder()}/${packName}/pack.yml` : "";

  React.useEffect(() => {
    const load = () =>
      void hexPackIndex.getPacks().then((p) => {
        setPacks(p);
        setPackName((cur) => {
          if (cur && p.has(cur)) return cur;
          const preferred = hexPackIndex.defaultPack();
          return p.has(preferred) ? preferred : (p.keys().next().value ?? "");
        });
      });
    load();
    return hexPackIndex.subscribe(load);
  }, []);

  // Load the pack's pack.yml text whenever the pack changes; drop the draft.
  React.useEffect(() => {
    setEdits([]);
    setFolderPath([]);
    setTile(null);
    if (!ymlPath) return;
    const file = app.vault.getAbstractFileByPath(ymlPath);
    if (file instanceof TFile) void app.vault.read(file).then(setOriginal);
    else setOriginal("");
  }, [app, ymlPath]);

  // pack.yml written outside the draft (a rename): read again, the selection kept.
  React.useEffect(() => {
    if (!ymlVersion || !ymlPath) return;
    const file = app.vault.getAbstractFileByPath(ymlPath);
    if (file instanceof TFile) void app.vault.read(file).then(setOriginal);
  }, [app, ymlPath, ymlVersion]);

  const pack = packs.get(packName) ?? null;
  const draftText = React.useMemo(() => applyPackEdits(original, edits), [original, edits]);
  const draft = React.useMemo<HexPack | null>(
    () => (pack ? { ...pack, config: parsePackConfig(draftText, pack.name) } : null),
    [pack, draftText]
  );

  const layerRoot = draft?.layers[layer] ?? null;
  const sections = (draft ? [...draft.layers.terrain.folders.values()] : []).filter((f) => groundOf(f.name));
  // The tree's root: terrain's section when one is picked, else the layer.
  const treeRoot =
    layer === "terrain" && ground ? (sections.find((f) => f.name.toLowerCase() === ground) ?? layerRoot) : layerRoot;
  const treePath = layer === "terrain" && ground && treeRoot !== layerRoot ? [treeRoot!.name] : [];
  // No folder picked: the layer folder's own files (bases live there), if it has any.
  const folder = layerRoot
    ? folderPath.length
      ? folderAt(layerRoot, folderPath)
      : layerRoot.files.length
        ? layerRoot
        : null
    : null;
  // A tile in the layer folder itself is named by its file name alone.
  const spec = folderPath.length ? specFor(folderPath, tile) : tile ? tile.name : null;
  const layout = useLayout(draft, layer, spec, raise, layer === "marker" ? markerName : sample);

  // After a rename or conversion, pick the tile again by its path once the index has it.
  React.useEffect(() => {
    if (!reselect || !folder) return;
    const found = folder.files.find((f) => f.path.toLowerCase() === reselect.toLowerCase());
    if (found) {
      setTile(found);
      setReselect(null);
    }
  }, [reselect, folder]);

  React.useEffect(() => setFileName(tile?.name ?? ""), [tile]);
  // Terrain moves to base by default, base back to terrain.
  React.useEffect(() => setMoveTo((to) => (to === layer ? (layer === "base" ? "terrain" : "base") : to)), [layer]);

  const tileFile = pack && tile ? tileFileOf(app, pack.name, layer, tile) : null;
  const size = useImageSize(tile?.url ?? null);
  const hexWidth = draft && tile ? displayFor(draft.config, layer, tile.path).hexWidth : undefined;
  // The width this folder's tiles are drawn right at: the commonest one wide enough for the hex.
  const widths = useImageWidths(folder?.files.map((f) => f.url) ?? []);
  const reference = React.useMemo(() => {
    const fit = widths.filter((w) => hexWidth && w >= hexWidth);
    const counts = new Map<number, number>();
    for (const w of fit) counts.set(w, (counts.get(w) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
  }, [widths, hexWidth]);
  // File work writes to the vault (and a rename to pack.yml) at once: not over an unsaved draft.
  const fileLocked = edits.length > 0 || busy;
  const convertible = folder
    ? folder.files
        .map((f) => (pack ? tileFileOf(app, pack.name, layer, f) : null))
        .filter((f): f is TFile => !!f && canConvert(f))
    : [];

  const run = async (what: string, work: () => Promise<void>) => {
    setBusy(true);
    try {
      await work();
    } catch (err) {
      new Notice(`${what} failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  const rename = () =>
    run("Rename", async () => {
      if (!pack || !tile) return;
      const clean = cleanTileName(fileName);
      await renameTile(app, pack.name, layer, tile, clean);
      const dir = tile.path.includes("/") ? tile.path.slice(0, tile.path.lastIndexOf("/") + 1) : "";
      setReselect(dir + clean);
      setYmlVersion((v) => v + 1);
      new Notice(`Renamed to ${clean}.`);
    });

  const convert = (files: TFile[]) =>
    run("Conversion", async () => {
      for (const f of files) await convertToWebp(app, f);
      if (tile) setReselect(tile.path);
      new Notice(files.length === 1 ? `${files[0].basename} is WebP now.` : `${files.length} tiles are WebP now.`);
    });

  /** The tile, or the whole folder, to the same place in another layer; the browser follows it there. */
  const move = (what: "tile" | "folder") =>
    run("Move", async () => {
      if (!pack || !(tile || folderPath.length)) return;
      const path = what === "tile" && tile ? tile.path : folderPath.join("/");
      const n = await moveTiles(app, pack.name, layer, moveTo, path, what === "folder");
      // Bases are kept by file name, in the layer folder itself; a base moved out goes into `bases/`.
      const flat = moveTo === "base";
      const out = layer === "base" && !path.includes("/");
      const where = flat ? [] : out ? ["bases"] : folderPath;
      // Catalog names read per layer: one written for this folder still looks for it on the old one.
      const stale = Object.entries(draft?.config.catalog ?? {})
        .filter(
          ([, c]) => folderPath.length && c.spec.toLowerCase().startsWith(specFor(folderPath, null).toLowerCase())
        )
        .map(([id]) => id);
      if (tile) setReselect(flat ? tile.name : out ? `bases/${tile.path}` : tile.path);
      setLayer(moveTo);
      setFolderPath(where);
      setYmlVersion((v) => v + 1);
      new Notice(
        `Moved ${n} file${n === 1 ? "" : "s"} to ${moveTo}/${where.length ? `${where.join("/")}/` : ""}.` +
          (stale.length ? ` Catalog names for it (${stale.join(", ")}) now pick ${moveTo} tiles.` : "")
      );
    });

  // Tuning levels: the pack, the selection's top folder, the tile.
  const top = folderPath[0];
  const prefixed = (key: string) => (layer === "terrain" ? key : `${layer}/${key}`);
  const levels: Array<{ kind: TuneLevel["kind"]; level: TuneLevel; label: string }> = [
    { kind: "defaults", level: { kind: "defaults" }, label: "Whole pack" },
  ];
  if (top) levels.push({ kind: "terrains", level: { kind: "terrains", key: prefixed(top) }, label: `Folder “${top}”` });
  if (tile) levels.push({ kind: "files", level: { kind: "files", key: prefixed(tile.path) }, label: "This tile" });
  const current = levels.find((l) => l.kind === levelKind) ?? levels[0];
  const config = draft?.config;
  const ownSection =
    current.level.kind === "terrains"
      ? config?.terrains[current.level.key]
      : current.level.kind === "files"
        ? config?.files[current.level.key]
        : undefined;
  const own = current.level.kind === "defaults" ? ownDefaults(draftText) : ownTuning(ownSection);
  const effective = config && tile ? displayFor(config, layer, tile.path) : config?.defaults;

  // Labels: a family is a top folder of the label layer; Classify names its pieces for their roles.
  const labelling = mode === "classify" && layer === "label";
  const labelFamily = layer === "label" && top ? labelFamilies(draft ?? undefined).get(top.toLowerCase()) : undefined;
  const capLeft = useImageSize(labelFamily?.pieces.left?.[0]?.url ?? null);
  const capRight = useImageSize(labelFamily?.pieces.right?.[0]?.url ?? null);
  const capHeight = Math.max(capLeft?.h ?? 0, capRight?.h ?? 0);
  const defaultInset: [number, number, number, number] = [
    capHeight / 8,
    (capRight?.w ?? 0) / 4,
    capHeight / 8,
    (capLeft?.w ?? 0) / 4,
  ];
  const renameLabelPieces = (renames: Array<{ from: string; to: string }>) =>
    run("Renaming", async () => {
      if (!pack || renames.length === 0) return;
      const n = await renameTiles(app, pack.name, "label", renames);
      const mine = tile && renames.find((r) => r.from === tile.path);
      if (mine) setReselect(mine.to);
      setYmlVersion((v) => v + 1);
      new Notice(`Renamed ${n} piece${n === 1 ? "" : "s"} for ${n === 1 ? "its role" : "their roles"}.`);
    });
  // Markers: a style is a top folder; files with imported names can be sorted into styles.
  const sorts = layer === "marker" && folder ? markerSorts(folder) : [];
  const sortMarkers = () =>
    run("Sorting", async () => {
      if (!pack || sorts.length === 0) return;
      const n = await renameTiles(app, pack.name, "marker", sorts);
      setFolderPath([]);
      setTile(null);
      setYmlVersion((v) => v + 1);
      new Notice(`Sorted ${n} marker${n === 1 ? "" : "s"} into style folders.`);
    });

  /** One piece given its role (its file renamed), then the next piece picked. */
  const assignRole = (r: { from: string; to: string }, next: string | null) => {
    if (r.from === r.to) {
      const found = folder?.files.find((f) => f.path === next);
      if (found) setTile(found);
      return;
    }
    void run("Renaming", async () => {
      if (!pack) return;
      await renameTiles(app, pack.name, "label", [r]);
      setReselect(next ?? r.to);
      setYmlVersion((v) => v + 1);
    });
  };

  // Classify: the path family is the top folder, matched to its autotile table if it has one.
  // Paths are classified into `autotile:` by shape, edges into `edges:` by run.
  const classifiable = layer === "path" || layer === "edge" || layer === "far";
  const classifying = mode === "classify" && classifiable;
  const kind: "path" | "edge" | "far" = layer === "edge" ? "edge" : layer === "far" ? "far" : "path";
  const section: Section = kind === "edge" ? "edges" : kind === "far" ? "far" : "autotile";
  const shapes = shapesOf(kind);
  const tablesOf = (cfg: PackConfig | undefined): Record<string, AutotileFamily | EdgeFamily | FarFamily> =>
    cfg ? (kind === "edge" ? cfg.edges : kind === "far" ? cfg.far : cfg.autotile) : {};
  const tables = tablesOf(config);
  const family =
    classifiable && top && config
      ? (Object.keys(tables).find((k) => k.toLowerCase() === top.toLowerCase()) ?? top)
      : null;
  const familyTable: AutotileFamily | EdgeFamily | FarFamily | undefined = family ? tables[family] : undefined;
  const farFamily = kind === "far" && family ? config?.far[family] : undefined;
  const farPreview = useFarPreview(layer === "far" ? draft : null, layer === "far" ? family : null);
  const familyTiles = React.useMemo(() => familyTable?.tiles ?? {}, [familyTable]);
  // Each listed tile's shape (the table keys tiles by shape name).
  const listedShapes = React.useMemo(() => {
    const m = new Map<string, ShapeSlot>();
    for (const [name, list] of Object.entries(familyTiles)) {
      const shape = shapeFromName(name);
      if (shape) for (const p of list) if (!m.has(p.toLowerCase())) m.set(p.toLowerCase(), shape);
    }
    return m;
  }, [familyTiles]);
  const shapeOf = (f: TileFile): ShapeSlot | null => listedShapes.get(f.path.toLowerCase()) ?? null;
  const currentShape = tile ? shapeOf(tile) : null;
  const tileNamed = tile ? shapeFromName(tile.name) : null;
  const picked = pathShape(pickType);
  // Tiles whose names follow the standard but sit elsewhere (or nowhere) in the table.
  const misnamed =
    classifying && folder
      ? folder.files.filter((f) => {
          const named = shapeFromName(f.name);
          return named && !sameShape(named, shapeOf(f));
        })
      : [];
  // Variants share their type's sides, so only the 63 types count towards a full table.
  const tilesAs = (shape: ShapeSlot): string[] => familyTiles[shapeName(shape)] ?? [];
  /** The tiles of a type at a slot, with that centre, opening at any side. */
  const mouthTiles = (type: string, slot: number, centre: Centre | null): string[] =>
    [0, 1, 2, 3, 4, 5].flatMap((mouth) => tilesAs(withCentre({ type, slot, mouth }, centre)));
  // Each type, then its hub, stub and mouth rows when the family has tiles for them.
  const coverageRows = shapes.flatMap((s) => {
    const slots = [...Array(s.slots).keys()];
    const rows: Array<{ s: typeof s; centre: Centre | null; mouth: boolean }> = [{ s, centre: null, mouth: false }];
    // Edge pieces and far art have no centre and no mouth.
    if (kind !== "path") return rows;
    for (const centre of [null, ...CENTRES]) {
      if (centre && slots.some((slot) => tilesAs({ type: s.type, slot, centre }).length))
        rows.push({ s, centre, mouth: false });
      if (slots.some((slot) => mouthTiles(s.type, slot, centre).length)) rows.push({ s, centre, mouth: true });
    }
    return rows;
  });
  /** The family's tiles not yet named for their shape, as a table would leave them. */
  const renamesFor = (cfg: PackConfig | undefined) => {
    const table = family ? tablesOf(cfg)[family]?.tiles : undefined;
    if (!draft || !table) return [];
    const files = draft.byPath[kind];
    const seen = new Set<string>();
    const listed: Array<{ path: string; shape: string }> = [];
    for (const [shape, list] of Object.entries(table))
      for (const p of list) {
        const file = files.get(p.toLowerCase());
        if (file && !seen.has(file.path) && shapeFromName(shape)) {
          seen.add(file.path);
          listed.push({ path: file.path, shape });
        }
      }
    return planShapeRenames(
      listed,
      [...files.values()].map((f) => f.path)
    );
  };
  const pendingRenames = classifying ? renamesFor(config) : [];
  /** Tiles for any shape with these sides (the type or a variant): what autotile can draw. */
  // An edge run with no piece of its own is laid from shorter ones; only a one-side run can't be.
  const tilesWithSides = (mask: string): string[] =>
    kind === "edge"
      ? shapesOf("edge")
          .flatMap((s) => [...Array(s.slots).keys()].map((slot) => ({ type: s.type, slot })))
          .flatMap(tilesAs)
      : mask
        ? shapesWithSides(mask).flatMap(tilesAs)
        : tilesAs({ type: "alone", slot: 0 });
  const counted = shapes.filter((s) => !s.variantOf);
  const total = counted.reduce((n, s) => n + s.slots, 0);
  const covered = counted.reduce(
    (n, s) =>
      n +
      [...Array(s.slots).keys()].filter((slot) =>
        kind === "edge" ? tilesAs({ type: s.type, slot }).length : tilesWithSides(shapeMask(s.type, slot)).length
      ).length,
    0
  );

  React.useEffect(() => {
    setHoverShape(null);
    const known = tile ? (shapeOf(tile) ?? shapeFromName(tile.name)) : null;
    setPickType(known?.type ?? "");
    setPickCentre(known?.centre ?? null);
    setPickMouth(known?.mouth ?? null);
  }, [tile, listedShapes]);

  // Typing into a tuning field replaces its own last edit instead of queueing one per keystroke.
  const queue = (edit: PackEdit) =>
    setEdits((e) => {
      const last = e[e.length - 1];
      const sameField =
        (last?.kind === "tune" &&
          edit.kind === "tune" &&
          last.key === edit.key &&
          JSON.stringify(last.level) === JSON.stringify(edit.level)) ||
        // The composer writes its whole recipe each time: the last one stands.
        (last?.kind === "far-compose" && edit.kind === "far-compose" && last.family === edit.family);
      return sameField ? [...e.slice(0, -1), edit] : [...e, edit];
    });

  /** Place a tile under its shape's mask, then move on to the next tile. */
  const assign = (f: TileFile, shape: ShapeSlot | null) => {
    if (!family) return;
    queue({ kind: "autotile-set", section, family, path: f.path, shape: shape ? shapeName(shape) : null });
    const files = folder?.files ?? [];
    const next = files[files.findIndex((x) => x.path === f.path) + 1];
    if (shape && next) setTile(next);
  };

  const classifyFromNames = () => {
    if (!family) return;
    setEdits((e) => [
      ...e,
      ...misnamed.map((f): PackEdit => {
        const named = shapeFromName(f.name) as ShapeSlot;
        return { kind: "autotile-set", section, family, path: f.path, shape: shapeName(named) };
      }),
    ]);
  };

  const save = async () => {
    if (!ymlPath || edits.length === 0) return;
    const file = app.vault.getAbstractFileByPath(ymlPath);
    try {
      if (file instanceof TFile) {
        const bak = `${ymlPath}.bak`;
        if (!app.vault.getAbstractFileByPath(bak)) await app.vault.create(bak, await app.vault.read(file));
        const written = await app.vault.process(file, (text) => applyPackEdits(text, edits));
        setOriginal(written);
        // Classify names the files for their shapes too, once pack.yml says what they are.
        if (classifying && pack) {
          const renames = renamesFor(parsePackConfig(written, pack.name));
          setEdits([]);
          new Notice(`Saved ${ymlPath}`);
          await renameToShapes(renames);
          return;
        }
      } else {
        const text = applyPackEdits("", edits);
        await app.vault.create(ymlPath, text);
        setOriginal(text);
      }
      setEdits([]);
      new Notice(`Saved ${ymlPath}`);
    } catch (err) {
      new Notice(`Couldn't save ${ymlPath}: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const renameToShapes = (renames: Array<{ from: string; to: string }>) =>
    run("Renaming", async () => {
      if (!pack || renames.length === 0) return;
      const n = await renameTiles(app, pack.name, kind, renames);
      const mine = tile && renames.find((r) => r.from === tile.path);
      if (mine) setReselect(mine.to);
      setYmlVersion((v) => v + 1);
      new Notice(`Renamed ${n} tile${n === 1 ? "" : "s"} for ${n === 1 ? "its shape" : "their shapes"}.`);
    });

  const fillFromFolders = () => {
    if (!layerRoot || !config) return;
    const used = new Set(Object.values(config.catalog).map((c) => c.spec));
    const add: PackEdit[] = [];
    const walk = (f: TileFolder, path: string[]) => {
      for (const sub of f.folders.values()) {
        // Terrain's land / water sections are seen through: `forest`, not `land[forest]`.
        if (layer === "terrain" && path.length === 0 && groundOf(sub.name)) {
          walk(sub, []);
          continue;
        }
        const p = [...path, sub.name];
        const s = specFor(p, null);
        const id = p.join("-").toLowerCase().replace(/\s+/g, "-");
        if (!config.catalog[id] && !used.has(s)) add.push({ kind: "catalog-set", id, spec: s });
        walk(sub, p);
      }
    };
    walk(layerRoot, []);
    if (add.length === 0) new Notice("Every folder already has a catalog name.");
    setEdits((e) => [...e, ...add]);
  };

  if (packs.size === 0) {
    return <p className="setting-item-description">No packs to browse yet — set the packs folder above.</p>;
  }

  return (
    <section className="rpg-hexstudio">
      <header>
        <select value={packName} onChange={(e) => setPackName(e.target.value)} aria-label="Pack">
          {[...packs.keys()].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <menu className="rpg-hexstudio-layers">
          {LAYERS.flatMap(
            (l): Array<{ l: Layer; g: Ground | null; label: string; folder?: TileFolder }> =>
              // Terrain with land and water sections shows them as two tabs.
              l === "terrain" && sections.length
                ? sections.map((f) => ({ l, g: f.name.toLowerCase() as Ground, label: f.name, folder: f }))
                : [{ l, g: null, label: l, folder: draft?.layers[l] }]
          ).map(({ l, g, label, folder: f }) => (
            <li key={`${l}:${g ?? ""}`}>
              <button
                type="button"
                className={l === layer && (g === null || g === ground) ? "is-selected" : undefined}
                title={g ? `Terrain tiles in ${label}/` : undefined}
                onClick={() => {
                  setLayer(l);
                  setGround(g);
                  setFolderPath(g ? [f!.name] : []);
                  setTile(null);
                  if (l !== "far" && mode === "compose") setMode("browse");
                }}
              >
                {label} <span className="rpg-hexstudio-count">{f ? countFiles(f) : 0}</span>
              </button>
            </li>
          ))}
        </menu>
        {(classifiable || layer === "label") && (
          <menu className="rpg-hexstudio-modes" aria-label="Mode">
            {(layer === "far" ? (["browse", "classify", "compose"] as const) : (["browse", "classify"] as const)).map(
              (m) => (
                <li key={m}>
                  <button type="button" className={m === mode ? "is-selected" : undefined} onClick={() => setMode(m)}>
                    {m === "browse" ? "Browse" : m === "classify" ? "Classify" : "Compose"}
                  </button>
                </li>
              )
            )}
          </menu>
        )}
        <menu className="rpg-hexstudio-save">
          <li>
            <button type="button" disabled={edits.length === 0} onClick={() => setEdits([])}>
              Discard
            </button>
          </li>
          <li>
            <button type="button" className="mod-cta" disabled={edits.length === 0} onClick={() => void save()}>
              Save pack.yml{edits.length ? ` (${edits.length})` : ""}
            </button>
          </li>
        </menu>
      </header>

      <div className="rpg-hexstudio-browse">
        <nav className="rpg-hexstudio-tree" aria-label="Folders">
          {layerRoot && treeRoot === layerRoot && layerRoot.files.length > 0 && (
            <ul>
              <li>
                <button
                  type="button"
                  className={folderPath.length === 0 ? "is-selected" : undefined}
                  onClick={() => {
                    setFolderPath([]);
                    setTile(null);
                    setLevelKind((k) => (k === "terrains" ? "defaults" : k));
                  }}
                  title={`Tiles in the ${layer} folder itself, named by file`}
                >
                  {layer}/ <span className="rpg-hexstudio-count">{layerRoot.files.length}</span>
                </button>
              </li>
            </ul>
          )}
          {treeRoot && treeRoot.folders.size > 0 ? (
            <FolderTree
              folder={treeRoot}
              path={treePath}
              selected={folderPath}
              onSelect={(p) => {
                setFolderPath(p);
                setTile(null);
                setLevelKind((k) => (k === "files" ? "terrains" : k));
              }}
            />
          ) : (
            !layerRoot?.files.length && (
              <p className="setting-item-description">
                No {layer} tiles in this pack.
                {layer === "base" && " Move terrain tiles here: they keep only their file name."}
              </p>
            )
          )}
        </nav>
        <div className="rpg-hexstudio-tiles">
          {folder ? (
            folder.files.length ? (
              <ul>
                {folder.files.map((f) => {
                  const shape = classifying ? shapeOf(f) : null;
                  return (
                    <li key={f.path}>
                      <button
                        type="button"
                        className={tile?.path === f.path ? "is-selected" : undefined}
                        title={classifying ? `${f.name} — ${shape ? shapeName(shape) : "no shape"}` : f.name}
                        onClick={() => setTile(tile?.path === f.path ? null : f)}
                      >
                        {classifying && config ? (
                          <FittedTile tile={f} display={displayFor(config, layer, f.path)} shape={shape} />
                        ) : (
                          <img src={f.url} alt={f.name} loading="lazy" />
                        )}
                        {labelling && <RoleBadge tile={f} />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="setting-item-description">Only subfolders here — pick one on the left.</p>
            )
          ) : (
            <p className="setting-item-description">Pick a folder to see its tiles.</p>
          )}
        </div>
      </div>

      {sorts.length > 0 && (
        <p className="setting-item-description">
          {sorts.length} file{sorts.length === 1 ? "" : "s"} here {sorts.length === 1 ? "has" : "have"} an imported
          marker name (
          {sorts
            .slice(0, 2)
            .map((r) => `${r.from.slice(r.from.lastIndexOf("/") + 1)} → ${r.to}`)
            .join(", ")}
          {sorts.length > 2 ? ", …" : ""}).{" "}
          <button type="button" disabled={fileLocked} onClick={() => void sortMarkers()}>
            Sort {sorts.length === 1 ? "it" : "them"} into style folders
          </button>
        </p>
      )}

      {labelling && folder && folderPath.length > 0 && (
        <>
          <LabelRolePanel
            folder={folder}
            tile={tile}
            locked={fileLocked}
            onAssign={assignRole}
            onRename={renameLabelPieces}
          />
          <LabelCoverage family={labelFamily} folder={folder} />
        </>
      )}

      {classifying && family && folder && config && (
        <ShapePanel
          family={family}
          tile={tile}
          display={displayFor(config, layer, tile?.path ?? "")}
          shapes={shapes}
          current={currentShape}
          named={tileNamed}
          picked={picked ?? null}
          centre={pickCentre}
          mouth={pickMouth}
          onPickMouth={setPickMouth}
          hoverShape={hoverShape}
          misnamed={misnamed.length}
          onPickType={setPickType}
          onPickCentre={setPickCentre}
          onHover={setHoverShape}
          onAssign={(shape) => tile && assign(tile, shape)}
          onFromNames={classifyFromNames}
          marks={kind === "path"}
        />
      )}

      {layer === "far" &&
        mode === "compose" &&
        draft &&
        (() => {
          const fam = family ?? startedFamily;
          if (!fam)
            return (
              <div className="rpg-farcomp-new">
                <p>Which terrain is this far art for? Each starts a family of the same name, standing for it.</p>
                {sections.map((section) => (
                  <menu key={section.name} aria-label={section.name}>
                    <li className="rpg-farcomp-new-head">{section.name}</li>
                    {[...section.folders.values()].map((t) => {
                      const has = !!config?.far[t.name];
                      return (
                        <li key={t.name}>
                          <button
                            type="button"
                            className={has ? "is-selected" : undefined}
                            title={has ? `${t.name} has far art: open it` : `Start far art for ${t.name}`}
                            onClick={() => setStartedFamily(t.name)}
                          >
                            {t.name}
                          </button>
                        </li>
                      );
                    })}
                  </menu>
                ))}
                <p>
                  Or a family of your own name:{" "}
                  <input
                    type="text"
                    placeholder="forest"
                    value={newFamily}
                    onChange={(e) => setNewFamily(cleanTileName(e.target.value).replace(/\s+/g, "-").toLowerCase())}
                  />{" "}
                  <button type="button" disabled={!newFamily} onClick={() => setStartedFamily(newFamily)}>
                    Start
                  </button>
                </p>
              </div>
            );
          return (
            <FarComposer
              key={`compose:${packName}:${fam}`}
              pack={draft}
              family={fam}
              of={config?.far[fam]?.of ?? [fam]}
              compose={config?.far[fam]?.compose}
              busy={busy}
              onCommit={(c) => queue({ kind: "far-compose", family: fam, compose: c })}
              onBake={(c) =>
                void run("Baking", async () => {
                  if (!pack) return;
                  const tiles = await bakeFarFamily(app, pack, fam, c);
                  await editPackYml(app, pack.name, [
                    ...edits,
                    { kind: "far-compose", family: fam, compose: c },
                    { kind: "far-baked", family: fam, tiles },
                  ]);
                  setEdits([]);
                  setYmlVersion((v) => v + 1);
                  new Notice(`Baked ${Object.keys(tiles).length} tiles into far/${fam}/ and saved pack.yml.`);
                })
              }
            />
          );
        })()}

      {layer === "far" && family && top && (
        <FarFamilyPanel
          key={`${packName}:${family}`}
          family={family}
          table={farFamily}
          preview={farPreview}
          onSet={(key, value) => queue({ kind: "far-set", family, key, value })}
        />
      )}

      {classifying && family && (
        <details className="rpg-hexstudio-coverage" open>
          <summary>
            “{family}” {kind === "edge" ? "edges" : kind === "far" ? "far art" : "autotile"} — {covered} of {total}{" "}
            {kind === "edge" ? "runs" : "shapes"} have a tile
          </summary>
          <table>
            <tbody>
              {coverageRows.map(({ s, centre, mouth }) => (
                <tr key={`${s.type}-${centre ?? ""}-${mouth ? "mouth" : ""}`}>
                  <th
                    scope="row"
                    title={s.hint + (centre ? `, ${CENTRE_HINT[centre]}` : "") + (mouth ? ", opening at a side" : "")}
                  >
                    {s.type}
                    {centre && ` + ${centre}`}
                    {mouth && " + mouth"}
                  </th>
                  {[...Array(s.slots).keys()].map((slot) => {
                    const shape = withCentre({ type: s.type, slot }, centre);
                    const mask = shapeMask(s.type, slot);
                    const list = mouth ? mouthTiles(s.type, slot, centre) : tilesAs(shape);
                    // A gap only when nothing has these sides; a variant or hub with none just has no art of its own.
                    const drawn = tilesWithSides(mask);
                    // A one-side edge run is the only one shorter pieces can't stand in for.
                    const gap = kind === "edge" ? s.type === "run1" && list.length === 0 : drawn.length === 0;
                    const empty = list.length === 0 && !gap;
                    return (
                      <td
                        key={slot}
                        className={gap ? "is-missing" : empty ? "is-empty" : undefined}
                        title={`${shapeName(shape)} (${mask}): ${
                          list.join(", ") ||
                          (gap
                            ? kind === "edge"
                              ? "no piece — nothing drawn along this side"
                              : kind === "far"
                                ? "no tile — another of the family stands in, else its own tile shrunk"
                                : "no tile — drawn as a stroke"
                            : kind === "edge"
                              ? "none of its own — laid from shorter pieces"
                              : `none of its own — ${drawn.join(", ")} draws here`)
                        }`}
                      >
                        <ShapeGlyph shape={shape} />
                        <span>{list.length || ""}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {pendingRenames.length > 0 && (
            <p className="setting-item-description">
              {pendingRenames.length} tile{pendingRenames.length === 1 ? " isn't" : "s aren't"} named for{" "}
              {pendingRenames.length === 1 ? "its shape" : "their shapes"} (
              {pendingRenames
                .slice(0, 3)
                .map((r) => `${r.from.slice(r.from.lastIndexOf("/") + 1)} → ${r.to.slice(r.to.lastIndexOf("/") + 1)}`)
                .join(", ")}
              {pendingRenames.length > 3 ? ", …" : ""}).{" "}
              {edits.length > 0 ? (
                "Save renames them too."
              ) : (
                <button type="button" disabled={busy} onClick={() => void renameToShapes(pendingRenames)}>
                  Rename {pendingRenames.length === 1 ? "it" : "them"}
                </button>
              )}
            </p>
          )}
          {familyTable && "sideKeys" in familyTable && familyTable.sideKeys > 0 && (
            <p className="setting-item-description">
              {familyTable.sideKeys} key{familyTable.sideKeys === 1 ? " is" : "s are"} still written as sides (
              <code>N,S</code>); they read as their type.{" "}
              <button type="button" onClick={() => queue({ kind: "autotile-shape-keys", section, family })}>
                Rewrite as shape names
              </button>
            </p>
          )}
          {familyTable && familyTable.unknownKeys.length > 0 && (
            <p className="rpg-hexstudio-warn">
              Ignored — not a shape: {familyTable.unknownKeys.map((k) => `“${k}”`).join(", ")}.
            </p>
          )}
        </details>
      )}

      {spec && !classifying && (
        <div className="rpg-hexstudio-detail">
          {/* Far art shows joined up in its family's panel instead. */}
          <figure className="rpg-hexstudio-preview" hidden={layer === "far"}>
            {layout ? (
              <HexMapStatic layout={layout} anchors={layer === "marker"} />
            ) : (
              <div className="rpg-hexmap--loading">…</div>
            )}
            <figcaption>
              <code>{spec}</code>
              {(layer === "base" || layer === "terrain") && (
                <label className="rpg-hexstudio-raise">
                  <span>
                    Middle hex {raise} step{raise === 1 ? "" : "s"} up ({raise * PREVIEW_STEP} m)
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={MAX_RAISE}
                    step={1}
                    value={raise}
                    onChange={(e) => setRaise(Number(e.target.value))}
                  />
                </label>
              )}
            </figcaption>
          </figure>

          {layer === "label" && top && (
            <LabelTextBox
              key={`${packName}:${top}`}
              family={labelFamily?.name ?? top}
              tuning={labelFamily?.tuning ?? {}}
              defaultInset={defaultInset}
              sample={sample}
              onSample={setSample}
              onSet={(key, value) => queue({ kind: "label-set", family: labelFamily?.name ?? top, key, value })}
            />
          )}

          {layer === "marker" && top && (
            <MarkerBox
              key={`${packName}:${top}`}
              style={top}
              tuning={config?.markers[top] ?? {}}
              sample={markerName}
              onSample={setMarkerName}
              onSet={(key, value) => queue({ kind: "marker-set", style: top, key, value })}
            />
          )}

          {layer !== "label" && layer !== "marker" && (
            <fieldset className="rpg-hexstudio-tune">
              <legend>Placement</legend>
              <menu>
                {levels.map((l) => (
                  <li key={l.kind}>
                    <button
                      type="button"
                      className={l.kind === current.kind ? "is-selected" : undefined}
                      onClick={() => setLevelKind(l.kind)}
                    >
                      {l.label}
                    </button>
                  </li>
                ))}
              </menu>
              {TUNE_KEYS.filter((key) => key !== "step" || current.kind === "defaults").map((key) => (
                <TuneField
                  key={`${current.kind}:${key}`}
                  label={TUNE_LABEL[key]}
                  own={own[key]}
                  effective={key === "step" ? config?.defaults.step : effective?.[key]}
                  fallback={
                    key === "step" && config?.defaults.hexWidth
                      ? `${Math.round(DEFAULT_STEP * config.defaults.hexWidth)} (${DEFAULT_STEP * 100} % of the hex width)`
                      : undefined
                  }
                  onChange={(value) => queue({ kind: "tune", level: current.level, key, value })}
                />
              ))}
              {layer === "terrain" && (
                <label>
                  <span>Has a base drawn in</span>
                  <select
                    value={String(
                      ownFlag(current.level.kind === "defaults" ? config?.defaults : ownSection, "hides") ?? ""
                    )}
                    onChange={(e) =>
                      queue({
                        kind: "tune",
                        level: current.level,
                        key: "hides",
                        value: e.target.value === "" ? null : e.target.value === "true",
                      })
                    }
                  >
                    <option value="">{effective?.hides ? "Inherit (yes)" : "Inherit (no)"}</option>
                    <option value="true">Yes — crop it to the face where the hex has a base</option>
                    <option value="false">No</option>
                  </select>
                </label>
              )}
              <p className="setting-item-description">
                Blank inherits from the level above. Pixels are the image's own.
                {current.kind === "defaults" &&
                  " Height step: how far one step (100 m on a map) lifts a hex, in pixels of the whole pack's hex width."}
              </p>
            </fieldset>
          )}

          {layer !== "label" && layer !== "far" && (
            <fieldset className="rpg-hexstudio-name">
              <legend>Name it</legend>
              <input
                type="text"
                placeholder={(tile?.name ?? folderPath.join("-")).toLowerCase().replace(/\s+/g, "-")}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <button
                type="button"
                onClick={() => {
                  const id = (newName.trim() || (tile?.name ?? folderPath.join("-")))
                    .toLowerCase()
                    .replace(/\s+/g, "-");
                  queue({ kind: "catalog-set", id, spec });
                  setNewName("");
                }}
              >
                Add to catalog
              </button>
            </fieldset>
          )}

          <fieldset className="rpg-hexstudio-file">
            <legend>File</legend>
            {tile && tileFile ? (
              <>
                <p className="setting-item-description">
                  <code>{tileFile.path.split("/").slice(-1)[0]}</code>
                  {size && ` — ${size.w} × ${size.h} px`}
                </p>
                {size && hexWidth && size.w < hexWidth && layer !== "label" && layer !== "marker" && (
                  // Hex width is the image's own pixels across the hex face: a picture narrower than it draws small.
                  <p className="rpg-hexstudio-warn">
                    This picture is {size.w} px wide, less than the hex width it's drawn with ({hexWidth} px), so it
                    shows small. Give <em>This tile</em> its own hex width
                    {reference ? (
                      <>
                        {" "}
                        — about {Math.round((size.w * hexWidth) / reference)} px, to match this folder's {reference} px
                        tiles
                      </>
                    ) : null}
                    .
                  </p>
                )}
                <div className="rpg-hexstudio-file-row">
                  <input
                    type="text"
                    value={fileName}
                    aria-label="File name"
                    onChange={(e) => setFileName(e.target.value)}
                  />
                  <button
                    type="button"
                    disabled={fileLocked || !cleanTileName(fileName) || cleanTileName(fileName) === tile.name}
                    onClick={() => void rename()}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    disabled={fileLocked || !canConvert(tileFile)}
                    onClick={() => void convert([tileFile])}
                  >
                    {tileFile.extension.toLowerCase() === "webp" ? "WebP already" : "Convert to WebP"}
                  </button>
                </div>
              </>
            ) : (
              <p className="setting-item-description">Pick a tile to rename or convert it.</p>
            )}
            {convertible.length > 0 && (
              <button type="button" disabled={fileLocked} onClick={() => void convert(convertible)}>
                Convert {convertible.length} PNG / JPEG in this folder to WebP
              </button>
            )}
            <div className="rpg-hexstudio-file-row">
              <label>
                <span>Move to layer</span>
                <select value={moveTo} onChange={(e) => setMoveTo(e.target.value as Layer)}>
                  {LAYERS.filter((l) => l !== layer).map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              {tile && (
                <button type="button" disabled={fileLocked || moveTo === layer} onClick={() => void move("tile")}>
                  Move this tile
                </button>
              )}
              {folderPath.length > 0 && (
                <button type="button" disabled={fileLocked || moveTo === layer} onClick={() => void move("folder")}>
                  Move folder “{folderPath[folderPath.length - 1]}”
                </button>
              )}
            </div>
            <p className="setting-item-description">
              {edits.length > 0
                ? "Save or discard the pack.yml changes first."
                : "Renaming updates pack.yml (this tile's tuning, autotile lists, the catalog names for it). Moving takes the tuning along and keeps the path below the layer, except into base, where only the file name is kept. Converting keeps the name and sends the original to the trash."}
            </p>
          </fieldset>
        </div>
      )}

      {layer !== "far" && (
        <details className="rpg-hexstudio-catalog" open>
          <summary>Catalog — {config ? Object.keys(config.catalog).length : 0} names</summary>
          <p className="setting-item-description">
            Names maps can use instead of a spec: <code>t(0,0): dry-plains</code>.
          </p>
          <table>
            <tbody>
              {config &&
                Object.entries(config.catalog).map(([id, entry]) => (
                  <CatalogRow
                    key={`${packName}:${id}:${entry.spec}`}
                    id={id}
                    spec={entry.spec}
                    color={entry.color}
                    onRename={(to) => queue({ kind: "catalog-rename", from: id, to })}
                    onSpec={(s) => queue({ kind: "catalog-set", id, spec: s, color: entry.color })}
                    onDelete={() => queue({ kind: "catalog-delete", id })}
                  />
                ))}
            </tbody>
          </table>
          <button type="button" onClick={fillFromFolders}>
            Fill from {layer} folders
          </button>
        </details>
      )}
    </section>
  );
}

function ShapePanel({
  family,
  tile,
  display,
  shapes,
  current,
  named,
  picked,
  centre,
  mouth,
  hoverShape,
  misnamed,
  onPickType,
  onPickCentre,
  onPickMouth,
  onHover,
  onAssign,
  onFromNames,
  marks = true,
}: {
  family: string;
  tile: TileFile | null;
  display: TileDisplay;
  /** The catalogue to pick from: paths' shapes or edges' runs. */
  shapes: PathShape[];
  current: ShapeSlot | null;
  named: ShapeSlot | null;
  picked: PathShape | null;
  centre: Centre | null;
  mouth: number | null;
  hoverShape: ShapeSlot | null;
  misnamed: number;
  onPickType: (type: string) => void;
  onPickCentre: (centre: Centre | null) => void;
  onPickMouth: (mouth: number | null) => void;
  onHover: (shape: ShapeSlot | null) => void;
  onAssign: (shape: ShapeSlot | null) => void;
  onFromNames: () => void;
  /** Centres and mouths: paths' marks (edge pieces and far art have neither). */
  marks?: boolean;
}) {
  const shown = hoverShape ?? current;
  // A start begins inside the hex already: it has no stub.
  const stubless = (type: string) => pathShape(type)?.base.length === 1;
  const centreFor = (type: string) => (centre === "stub" && stubless(type) ? null : centre);
  /** The shape the buttons give: with the centre, and the mouth when the slot has that side. */
  const withMarks = (type: string, slot: number): ShapeSlot => {
    const shape = withCentre({ type, slot }, centreFor(type));
    return mouth !== null && shapeSides(type, slot).includes(SIDES[mouth]) ? { ...shape, mouth } : shape;
  };
  return (
    <fieldset className="rpg-hexstudio-shape">
      <legend>Shape in “{family}”</legend>
      {tile ? (
        <>
          <figure>
            <div className="rpg-hexstudio-shape-tile">
              <FittedTile tile={tile} display={display} shape={shown} />
            </div>
            <figcaption>
              <code>{tile.name}</code> — {current ? shapeName(current) : "no shape yet"}
              {named && !sameShape(named, current) && <> · its name says {shapeName(named)}</>}
            </figcaption>
          </figure>
          <div className="rpg-hexstudio-shape-pick">
            <menu aria-label="Type">
              {shapes.map((s) => (
                <li key={s.type}>
                  <button
                    type="button"
                    title={s.hint}
                    className={s.type === picked?.type ? "is-selected" : undefined}
                    onClick={() => onPickType(s.type)}
                  >
                    <ShapeGlyph shape={withCentre({ type: s.type, slot: 0 }, centreFor(s.type))} />
                    {s.type}
                  </button>
                </li>
              ))}
            </menu>
            {marks && (
              <>
                <menu aria-label="Centre" className="rpg-hexstudio-shape-marks">
                  <li>Centre</li>
                  {[null, ...CENTRES].map((c) => (
                    <li key={c ?? "plain"}>
                      <button
                        type="button"
                        title={c ? CENTRE_HINT[c] : "the path just runs through"}
                        className={centre === c ? "is-selected" : undefined}
                        disabled={c === "stub" && !!picked && stubless(picked.type)}
                        onClick={() => onPickCentre(c)}
                      >
                        {c ?? "plain"}
                      </button>
                    </li>
                  ))}
                </menu>
                <menu aria-label="Mouth side" className="rpg-hexstudio-shape-marks">
                  <li>Mouth</li>
                  <li>
                    <button
                      type="button"
                      className={mouth === null ? "is-selected" : undefined}
                      onClick={() => onPickMouth(null)}
                    >
                      none
                    </button>
                  </li>
                  {SIDES.map((side, i) => (
                    <li key={side}>
                      <button
                        type="button"
                        title={`Opens across the ${side} side, like a river into the sea`}
                        className={mouth === i ? "is-selected" : undefined}
                        onClick={() => onPickMouth(i)}
                      >
                        {i} {side}
                      </button>
                    </li>
                  ))}
                </menu>
              </>
            )}
            {picked && (
              <menu aria-label="Slot" onMouseLeave={() => onHover(null)}>
                {[...Array(picked.slots).keys()].map((slot) => {
                  const shape = withMarks(picked.type, slot);
                  // A mouth must be one of the slot's own sides.
                  const fits = mouth === null || shape.mouth !== undefined;
                  return (
                    <li key={slot}>
                      <button
                        type="button"
                        title={`${shapeName(shape)}: ${shapeMask(picked.type, slot)}`}
                        className={sameShape(shape, current) ? "is-selected" : undefined}
                        disabled={!fits}
                        onMouseEnter={() => onHover(shape)}
                        onClick={() => onAssign(shape)}
                      >
                        <ShapeGlyph shape={shape} />
                        {slot}
                      </button>
                    </li>
                  );
                })}
              </menu>
            )}
            <p className="setting-item-description">
              {picked ? `${picked.type}-0 is ${picked.hint}; each slot turns it one side clockwise. ` : "Pick a type. "}
              Picking a slot moves on to the next tile.
              {mouth !== null && " With a mouth, only slots that use that side can be picked."}
            </p>
            <button type="button" disabled={!current} onClick={() => onAssign(null)}>
              Take it out of the table
            </button>
          </div>
        </>
      ) : (
        <p className="setting-item-description">Pick a tile above to give it a shape.</p>
      )}
      {misnamed > 0 && (
        <button type="button" onClick={onFromNames}>
          Classify {misnamed} tile{misnamed === 1 ? "" : "s"} from their names
        </button>
      )}
    </fieldset>
  );
}

/** The far preview's hexes, outlined: seven together and one on its own (as `useFarPreview` lays them). */
function FarPreviewHexes({ R }: { R: number }) {
  const hexes = [{ q: 0, r: 0 }, ...SIDES.map((side) => neighbour({ q: 0, r: 0 }, side)), { q: 3, r: -1 }];
  return (
    <g className="rpg-hexstudio-far-hexes">
      {hexes.map((h) => {
        const x = 1.5 * R * h.q;
        const y = Math.sqrt(3) * R * (h.r + h.q / 2);
        const pts = [0, 1, 2, 3, 4, 5]
          .map((k) => `${x + R * Math.cos((k * Math.PI) / 3)},${y + R * Math.sin((k * Math.PI) / 3)}`)
          .join(" ");
        return <polygon key={`${h.q},${h.r}`} points={pts} strokeWidth={R / 30} />;
      })}
    </g>
  );
}

/** A far family: the terrains it stands for, its tiles' size, and the family joined up. */
function FarFamilyPanel({
  family,
  table,
  preview,
  onSet,
}: {
  family: string;
  table: FarFamily | undefined;
  preview: HexLayout | null;
  onSet: (key: "of" | "size", value: string[] | number | null) => void;
}) {
  const [of, setOf] = React.useState((table?.of ?? [family.toLowerCase()]).join(", "));
  const [size, setSize] = React.useState(table?.size !== undefined ? String(table.size) : "");
  const covered = table ? Object.values(table.tiles).reduce((n, list) => n + list.length, 0) : 0;
  return (
    <fieldset className="rpg-hexstudio-far">
      <legend>Far art “{family}”</legend>
      <figure className="rpg-hexstudio-preview">
        {preview && covered > 0 ? (
          <HexMapStatic layout={preview} overlay={<FarPreviewHexes R={preview.R} />} />
        ) : (
          <p className="setting-item-description">
            {table
              ? "No tile has a shape yet: Classify gives them theirs."
              : "Not in pack.yml yet: give its tiles shapes with Classify, or say what it stands for below."}
          </p>
        )}
        <figcaption>Seven of it together, and one on its own, as the map above draws them.</figcaption>
      </figure>
      <label>
        <span>Stands for</span>
        <input
          type="text"
          value={of}
          placeholder={family.toLowerCase()}
          title="Terrains, by folder, base name or ground (land, water), separated by commas"
          onChange={(e) => {
            setOf(e.target.value);
            const list = e.target.value
              .split(",")
              .map((t) => t.trim().toLowerCase())
              .filter(Boolean);
            onSet("of", list.length === 0 || (list.length === 1 && list[0] === family.toLowerCase()) ? null : list);
          }}
        />
      </label>
      <label>
        <span>Size</span>
        <input
          type="number"
          min={0.2}
          max={3}
          step={0.05}
          value={size}
          placeholder="1"
          title="Its tiles' width, as a share of the hex (1: as wide as the hex)"
          onChange={(e) => {
            setSize(e.target.value);
            const n = parseFloat(e.target.value);
            onSet("size", Number.isFinite(n) && n > 0 && n !== 1 ? n : null);
          }}
        />
      </label>
      <p className="setting-item-description">
        From the level above (the 30-mile map over its 5-mile detail), a hex of these terrains is drawn as this art,
        joined to its neighbours of the same family. Terrains with no far art are drawn as their own tile, shrunk.
      </p>
    </fieldset>
  );
}

function CatalogRow({
  id,
  spec,
  color,
  onRename,
  onSpec,
  onDelete,
}: {
  id: string;
  spec: string;
  color?: string;
  onRename: (to: string) => void;
  onSpec: (spec: string) => void;
  onDelete: () => void;
}) {
  return (
    <tr>
      <td>
        <input
          type="text"
          defaultValue={id}
          aria-label="Name"
          onBlur={(e) => {
            const to = e.target.value.trim();
            if (to && to !== id) onRename(to);
          }}
        />
      </td>
      <td>
        <input
          type="text"
          defaultValue={spec}
          aria-label="Spec"
          onBlur={(e) => {
            const s = e.target.value.trim();
            if (s && s !== spec) onSpec(s);
          }}
        />
      </td>
      <td>{color && <span className="rpg-hexstudio-swatch" style={{ background: color }} title={color} />}</td>
      <td>
        <button type="button" aria-label={`Remove ${id}`} onClick={onDelete}>
          ×
        </button>
      </td>
    </tr>
  );
}
