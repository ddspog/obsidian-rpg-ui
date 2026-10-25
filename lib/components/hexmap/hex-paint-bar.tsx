/**
 * Paint mode's controls (design §13.1), in the session log's look: a slim
 * toolbar of segmented radio groups above the map (tool, layer; undo, redo,
 * done), and a sidebar beside it with the brush (what it paints, the height,
 * region or text a tool needs) and the palette: catalog names, joined path
 * families and the pack's folders, with thumbnails and a filter.
 * Presentational: the map block owns the state and does the writing.
 */

import * as React from "react";
import { LucideIcon } from "lib/components/session-log/lucide-icon";
import { type Ground, GROUNDS, groundOf, type HexPack, type Layer, selectTile } from "lib/domains/hexmap/packs";
import type { HexLook } from "lib/domains/hexmap/parse-hex-map";
import {
  catalogEntries,
  familyEntries,
  folderEntries,
  paintableLayers,
  type PaletteEntry,
} from "lib/domains/hexmap/palette";

export type PaintTool =
  | "paint"
  | "erase"
  | "lasso"
  | "select"
  | "stamp"
  | "pick"
  | "look"
  | "region"
  | "height"
  | "move"
  | "edit"
  | "pan";

/** The map block's modes (design §14): playing it (the sandbox, nothing saved),
 *  marking it (markers and labels), building it (tiles, paths, stacks), and
 *  marking out its regions (§15). */
export type MapMode = "play" | "mark" | "build" | "regions";

export const MODES: Array<{ mode: MapMode; icon: string; name: string; hint: string }> = [
  { mode: "play", icon: "footprints", name: "Play", hint: "Move pieces, measure, try the map out (nothing is saved)" },
  { mode: "mark", icon: "map-pin", name: "Mark", hint: "Place, move and name markers and labels" },
  { mode: "build", icon: "paintbrush", name: "Build", hint: "Paint terrain, bases, paths and stacks" },
  {
    mode: "regions",
    icon: "land-plot",
    name: "Regions",
    hint: "Name regions, put hexes in or out of them, and set how they're marked and named",
  },
];

/** What each editing mode offers. */
const MODE_TOOLS: Record<Exclude<MapMode, "play">, PaintTool[]> = {
  build: ["paint", "erase", "lasso", "select", "pick", "look", "height", "pan"],
  mark: ["paint", "edit", "move", "erase", "pick", "pan"],
  regions: ["region", "pick", "pan"],
};
const MODE_LAYERS: Record<Exclude<MapMode, "play">, Layer[]> = {
  build: ["terrain", "base", "edge", "path", "stack"],
  mark: ["marker", "label"],
  // Regions are painted on the hexes, whatever is on them.
  regions: [],
};

/** The brush fitted to a mode: a layer and a tool the mode has. */
export function stateForMode(state: PaintState, mode: Exclude<MapMode, "play">): PaintState {
  const layers = MODE_LAYERS[mode];
  const layer = layers.length === 0 || layers.includes(state.layer) ? state.layer : layers[0];
  if (mode === "regions")
    return { ...state, layer, tool: MODE_TOOLS.regions.includes(state.tool) ? state.tool : "region" };
  const tool = MODE_TOOLS[mode].includes(state.tool) || state.tool === "stamp" ? state.tool : "paint";
  return { ...state, layer, tool: mode === "mark" && tool === "stamp" ? "paint" : tool };
}

export interface PaintState {
  layer: Layer;
  tool: PaintTool;
  /** What the brush paints, per layer. */
  spec: Partial<Record<Layer, string>>;
  /** The palette folder open, per layer. */
  folder: Partial<Record<Layer, string[]>>;
  /** Terrain's section painted from, when the pack has land and water: each is a layer button of its own. */
  ground?: Ground;
  /** Metres, for new hexes and the height tool. */
  height: number;
  region: string;
  /** A marker's caption, or a label's text. */
  text: string;
  /** The stamp the Stamp tool puts down, and its turn (60° steps). */
  stamp?: string;
  rot: number;
}

export const DEFAULT_PAINT: PaintState = {
  layer: "terrain",
  tool: "paint",
  spec: {},
  folder: {},
  height: 0,
  region: "",
  text: "",
  rot: 0,
};

const TOOLS: Array<{ tool: PaintTool; icon: string; name: string; hint: string }> = [
  { tool: "paint", icon: "paintbrush", name: "Paint", hint: "Click or drag to paint; right-click erases" },
  { tool: "erase", icon: "eraser", name: "Erase", hint: "Take the top item of this layer off" },
  {
    tool: "lasso",
    icon: "lasso",
    name: "Fill",
    hint: "Draw a loop: every hex inside gets the brush (right-drag erases)",
  },
  { tool: "select", icon: "box-select", name: "Select", hint: "Drag a box over hexes (Shift adds, Alt takes away)" },
  { tool: "pick", icon: "pipette", name: "Pick", hint: "Copy what a hex has on this layer (or Alt-click)" },
  {
    tool: "look",
    icon: "scaling",
    name: "Look",
    hint: "Select a hex: drag to shift it; size and colour in the sidebar",
  },
  {
    tool: "region",
    icon: "land-plot",
    name: "Region",
    hint: "Add hexes to a region, or take them out; Alt-click a hex to pick its region and style it",
  },
  { tool: "height", icon: "mountain", name: "Height", hint: "Move hexes to the height in the brush" },
  { tool: "move", icon: "move", name: "Move", hint: "Drag a marker or label to a new spot" },
  {
    tool: "edit",
    icon: "pencil",
    name: "Edit",
    hint: "Click a marker or label to change it (drag to move it)",
  },
  { tool: "pan", icon: "hand", name: "Pan", hint: "Drag to move the view (or Space-drag, middle-drag)" },
];

/** Whether a pack's terrain is split into land and water sections. */
function hasSections(pack: HexPack | undefined): boolean {
  return !!pack && [...pack.layers.terrain.folders.keys()].some((k) => !!groundOf(k));
}

/** The section (land or water) a terrain spec's tile is in. */
function entryGround(pack: HexPack, spec: string): Ground | null {
  const picked = selectTile(pack, "terrain", spec, `palette:${spec}`);
  return picked ? groundOf(picked.file.path) : null;
}

export const LAYER_NAME: Record<Layer, string> = {
  terrain: "Terrain",
  base: "Base",
  edge: "Edge",
  path: "Path",
  stack: "Stack",
  marker: "Marker",
  label: "Label",
  far: "Far",
};

/** A segmented radio group, as the Log's Party / Foes: real radios, so arrow keys move. */
export function Segmented<T extends string>({
  legend,
  value,
  options,
  onChange,
}: {
  legend: string;
  value: T;
  options: Array<{ value: T; label: React.ReactNode; title?: string }>;
  onChange: (v: T) => void;
}) {
  const name = React.useId();
  return (
    <fieldset className="rpg-hexpaint-segmented">
      <legend className="rpg-hexpaint-sr">{legend}</legend>
      {options.map((o) => (
        <label key={o.value} className={o.value === value ? "is-checked" : undefined} title={o.title}>
          <input type="radio" name={name} checked={o.value === value} onChange={() => onChange(o.value)} />
          {o.label}
        </label>
      ))}
    </fieldset>
  );
}

export function IconButton({
  icon,
  label,
  onClick,
  disabled,
  className,
  children,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`rpg-hexpaint-button${className ? ` ${className}` : ""}`}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      <LucideIcon name={icon} size={14} />
      {children}
    </button>
  );
}

/** Play / Mark / Build, as a segmented radio group. */
export function ModeSwitch({ mode, onMode }: { mode: MapMode; onMode: (m: MapMode) => void }) {
  return (
    <Segmented
      legend="Mode"
      value={mode}
      onChange={onMode}
      options={MODES.map((m) => ({
        value: m.mode,
        title: `${m.name} — ${m.hint}`,
        label: (
          <>
            <LucideIcon name={m.icon} size={14} />
            <span>{m.name}</span>
          </>
        ),
      }))}
    />
  );
}

interface ToolbarProps {
  mode: Exclude<MapMode, "play">;
  onMode: (m: MapMode) => void;
  pack?: HexPack;
  state: PaintState;
  onChange: (next: PaintState) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onDone: () => void;
  /** Changes not yet written to the note (Done writes them). */
  unsaved?: boolean;
}

export function HexPaintToolbar({
  pack,
  state,
  onChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onDone,
  mode,
  onMode,
  unsaved,
}: ToolbarProps) {
  const layers = paintableLayers(pack).filter((l) => MODE_LAYERS[mode].includes(l));
  const sections = hasSections(pack);
  const tools = TOOLS.filter((t) => MODE_TOOLS[mode].includes(t.tool)).map((t) =>
    // Markers and labels are placed, not painted.
    mode === "mark" && t.tool === "paint"
      ? { ...t, icon: "map-pin", name: "Place", hint: "Click to place the marker or label in the brush" }
      : mode === "regions" && t.tool === "region"
        ? {
            ...t,
            icon: "paintbrush",
            name: "Paint",
            hint: "Click or drag to put hexes in the region, or take them out (Alt-click picks a hex's region)",
          }
        : mode === "regions" && t.tool === "pick"
          ? { ...t, hint: "Click a hex to pick its innermost region" }
          : t
  );
  return (
    <header className="rpg-hexpaint-toolbar" onPointerDown={(e) => e.stopPropagation()}>
      <ModeSwitch mode={mode} onMode={onMode} />
      <Segmented
        legend="Tool"
        value={state.tool}
        onChange={(tool) => onChange({ ...state, tool })}
        options={tools.map((t) => ({
          value: t.tool,
          title: `${t.name} — ${t.hint}`,
          label: (
            <>
              <LucideIcon name={t.icon} size={14} />
              <span className="rpg-hexpaint-tool-name">{t.name}</span>
            </>
          ),
        }))}
      />
      {layers.length > 0 && (
        <Segmented
          legend="Layer"
          value={state.layer === "terrain" && sections ? `terrain:${state.ground ?? "land"}` : state.layer}
          onChange={(v) => {
            const [layer, ground] = v.split(":") as [Layer, Ground | undefined];
            onChange({ ...state, layer, ...(ground ? { ground } : {}) });
          }}
          options={layers.flatMap((l) =>
            // Terrain with land and water sections is two buttons, as the pack browser's tabs.
            l === "terrain" && sections
              ? GROUNDS.map((g) => ({ value: `terrain:${g}`, label: g === "land" ? "Land" : "Water" }))
              : [{ value: l as string, label: LAYER_NAME[l] }]
          )}
        />
      )}
      <menu className="rpg-hexpaint-actions">
        <li>
          <IconButton icon="undo-2" label="Undo (Ctrl/Cmd+Z)" disabled={!canUndo} onClick={onUndo} />
        </li>
        <li>
          <IconButton icon="redo-2" label="Redo (Shift+Ctrl/Cmd+Z)" disabled={!canRedo} onClick={onRedo} />
        </li>
        <li>
          <IconButton
            icon="check"
            label={unsaved ? "Done: save your changes to the note, back to Play" : "Done: back to Play"}
            className={unsaved ? "is-done is-unsaved" : "is-done"}
            onClick={onDone}
          >
            <span>{unsaved ? "Save & done" : "Done"}</span>
          </IconButton>
        </li>
      </menu>
    </header>
  );
}

function Swatch({ entry, selected, onSelect }: { entry: PaletteEntry; selected: boolean; onSelect: () => void }) {
  return (
    <li>
      <button
        type="button"
        className={`rpg-hexpaint-swatch is-${entry.kind}${selected ? " is-selected" : ""}`}
        title={entry.spec || entry.name}
        aria-pressed={selected}
        onClick={onSelect}
      >
        {entry.url ? (
          <img src={entry.url} alt="" loading="lazy" draggable={false} />
        ) : (
          <span className="rpg-hexpaint-swatch-none" />
        )}
        <span className="rpg-hexpaint-swatch-name">{entry.name}</span>
        {entry.kind === "folder" && <LucideIcon name="chevron-right" size={10} className="rpg-hexpaint-swatch-open" />}
      </button>
    </li>
  );
}

export function SidebarSection({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rpg-hexpaint-section">
      <header className="rpg-hexpaint-section-head" role="heading" aria-level={4}>
        <span>{title}</span>
        {aside}
      </header>
      {children}
    </section>
  );
}

interface SidebarProps {
  pack?: HexPack;
  state: PaintState;
  onChange: (next: PaintState) => void;
  /** Regions the map declares or uses, for the region tool. */
  regions: string[];
  /** Metres per height step. */
  step: number;
  /** More sections for the tool (look, selection …), under the brush. */
  extra?: React.ReactNode;
  /** Sections for the map itself (scale, reference picture), after the palette. */
  footer?: React.ReactNode;
  /** First in the palette (the pack's custom tiles). */
  palettePrefix?: React.ReactNode;
  /** Specs this map already uses: its named tiles come first. */
  used?: Set<string>;
  /** Replaces the brush (a custom tile in hand). */
  brush?: React.ReactNode;
  /** No brush or palette (the Regions mode): only the tool's sections. */
  bare?: boolean;
}

/** Named tiles shown before "more": they'd take the palette over otherwise. */
const NAMED_SHOWN = 8;

export function HexPaintSidebar({
  pack,
  state,
  onChange,
  regions,
  step,
  extra,
  palettePrefix,
  used,
  brush,
  footer,
  bare,
}: SidebarProps) {
  const [allNamed, setAllNamed] = React.useState(false);
  const { layer } = state;
  const set = (patch: Partial<PaintState>) => onChange({ ...state, ...patch });
  const [filter, setFilter] = React.useState("");
  // Terrain painted from one section (land or water) keeps to its folders and names.
  const ground = layer === "terrain" && hasSections(pack) ? (state.ground ?? "land") : undefined;
  const path = React.useMemo(() => {
    const p = state.folder[layer] ?? [];
    if (!ground) return p;
    return p[0]?.toLowerCase() === ground ? p : [ground];
  }, [state.folder, layer, ground]);
  const selected = state.spec[layer];
  const catalog = React.useMemo(
    () => (pack ? catalogEntries(pack, layer).filter((e) => !ground || entryGround(pack, e.spec) === ground) : []),
    [pack, layer, ground]
  );
  const families = React.useMemo(() => (pack && layer === "path" ? familyEntries(pack) : []), [pack, layer]);
  const entries = React.useMemo(() => (pack ? folderEntries(pack, layer, path) : []), [pack, layer, path]);
  const needle = filter.trim().toLowerCase();
  const keep = (e: PaletteEntry) =>
    !needle || e.name.toLowerCase().includes(needle) || e.spec.toLowerCase().includes(needle);
  // The map's own first, then the rest; eight unless asked (or filtered).
  const namedAll = [...families, ...catalog]
    .filter(keep)
    .sort((a, b) => Number(!!used?.has(b.spec)) - Number(!!used?.has(a.spec)));
  const named = needle || allNamed ? namedAll : namedAll.slice(0, NAMED_SHOWN);
  const hidden = namedAll.length - named.length;
  // What the spec picks, however it was written (a swatch, or typed).
  const thumb = React.useMemo(() => {
    if (!pack || !selected?.trim()) return undefined;
    const family = layer === "path" ? families.find((e) => e.spec === selected) : undefined;
    return family?.url ?? selectTile(pack, layer, selected.trim(), "brush")?.file.url;
  }, [pack, layer, selected, families]);
  const pointLayer = layer === "marker" || layer === "label";
  const regionList = React.useId();

  const choose = (entry: PaletteEntry) => {
    const tool = ["pan", "erase", "pick", "stamp"].includes(state.tool) ? "paint" : state.tool;
    if (entry.kind === "folder") {
      onChange({
        ...state,
        tool,
        folder: { ...state.folder, [layer]: [...path, entry.name] },
        spec: entry.spec ? { ...state.spec, [layer]: entry.spec } : state.spec,
      });
      setFilter("");
    } else onChange({ ...state, tool, spec: { ...state.spec, [layer]: entry.spec } });
  };
  const openFolder = (p: string[]) => set({ folder: { ...state.folder, [layer]: p } });

  // Edit works on what's already on the map: no brush to fill, nothing to pick from.
  const editTool = state.tool === "edit" || !!bare;
  return (
    <aside className="rpg-hexpaint-sidebar" onPointerDown={(e) => e.stopPropagation()}>
      {editTool
        ? null
        : (brush ?? (
            <section className="rpg-hexpaint-brush" aria-label="Brush">
              <div className="rpg-hexpaint-brush-thumb">
                {thumb ? (
                  <img src={thumb} alt="" draggable={false} />
                ) : (
                  <LucideIcon name="hexagon" size={28} strokeWidth={1.25} />
                )}
              </div>
              <dl className="rpg-hexpaint-fields">
                <dt>{LAYER_NAME[layer]}</dt>
                <dd>
                  <input
                    type="text"
                    aria-label="Spec"
                    value={selected ?? ""}
                    placeholder={pointLayer ? "e.g. pin[red]" : "e.g. forest[lush]"}
                    spellCheck={false}
                    onChange={(e) => set({ spec: { ...state.spec, [layer]: e.target.value } })}
                  />
                </dd>
                {pointLayer && (
                  <>
                    <dt>{layer === "label" ? "Text" : "Caption"}</dt>
                    <dd>
                      <input
                        type="text"
                        value={state.text}
                        placeholder={layer === "label" ? "The Sunken Coast" : "optional"}
                        onChange={(e) => set({ text: e.target.value })}
                      />
                    </dd>
                  </>
                )}
                {state.tool === "region" && (
                  <>
                    <dt>Region</dt>
                    <dd>
                      <input
                        type="text"
                        list={regionList}
                        value={state.region}
                        placeholder="Dunlind"
                        onChange={(e) => set({ region: e.target.value })}
                      />
                      <datalist id={regionList}>
                        {regions.map((r) => (
                          <option key={r} value={r} />
                        ))}
                      </datalist>
                    </dd>
                  </>
                )}
                {!pointLayer && (
                  <>
                    <dt title="New hexes go in this height group; the Height tool moves hexes to it">Height</dt>
                    <dd className="rpg-hexpaint-stepper">
                      <button type="button" aria-label="Lower" onClick={() => set({ height: state.height - step })}>
                        −
                      </button>
                      <output>{state.height} m</output>
                      <button type="button" aria-label="Higher" onClick={() => set({ height: state.height + step })}>
                        +
                      </button>
                    </dd>
                  </>
                )}
              </dl>
            </section>
          ))}
      {extra}
      {pack && !editTool && (
        <>
          <input
            type="search"
            className="rpg-hexpaint-filter"
            placeholder="Filter names…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          {palettePrefix}
          {namedAll.length > 0 && (
            <SidebarSection
              title={layer === "path" ? "Joined & named" : "Named"}
              aside={
                (hidden > 0 || allNamed) &&
                !needle && (
                  <button type="button" className="rpg-hexpaint-more" onClick={() => setAllNamed(!allNamed)}>
                    {allNamed ? "fewer" : `+${hidden} more`}
                  </button>
                )
              }
            >
              <menu className="rpg-hexpaint-swatches">
                {named.map((e) => (
                  <Swatch
                    key={`${e.kind}:${e.spec}`}
                    entry={e}
                    selected={selected === e.spec}
                    onSelect={() => choose(e)}
                  />
                ))}
              </menu>
            </SidebarSection>
          )}
          <SidebarSection
            title="Folders"
            aside={
              <nav className="rpg-hexpaint-crumbs" aria-label="Folder">
                <button type="button" onClick={() => openFolder(ground ? [ground] : [])}>
                  {ground ?? layer}
                </button>
                {path.slice(ground ? 1 : 0).map((part, i) => (
                  <React.Fragment key={i}>
                    <LucideIcon name="chevron-right" size={9} />
                    <button type="button" onClick={() => openFolder(path.slice(0, i + 1 + (ground ? 1 : 0)))}>
                      {part}
                    </button>
                  </React.Fragment>
                ))}
              </nav>
            }
          >
            <menu className="rpg-hexpaint-swatches">
              {entries.filter(keep).map((e) => (
                <Swatch
                  key={`${e.kind}:${e.name}`}
                  entry={e}
                  selected={!!e.spec && selected === e.spec}
                  onSelect={() => choose(e)}
                />
              ))}
              {entries.length === 0 && <li className="rpg-hexpaint-empty">Nothing here</li>}
            </menu>
          </SidebarSection>
        </>
      )}
      {!pack && <p className="rpg-hexpaint-empty">Plain colours: type a terrain name or a #colour.</p>}
      {footer}
    </aside>
  );
}

const LOOK_SLIDERS: Array<{
  key: "size" | "x" | "y" | "hue" | "sat" | "bright";
  name: string;
  min: number;
  max: number;
  step: number;
  unit?: string;
}> = [
  { key: "size", name: "Size", min: 0.4, max: 5, step: 0.05, unit: "×" },
  { key: "x", name: "Shift →", min: -1, max: 1, step: 0.01 },
  { key: "y", name: "Shift ↓", min: -1, max: 1, step: 0.01 },
  { key: "hue", name: "Hue", min: -180, max: 180, step: 1, unit: "°" },
  { key: "sat", name: "Saturation", min: 0, max: 2, step: 0.05, unit: "×" },
  { key: "bright", name: "Brightness", min: 0, max: 2, step: 0.05, unit: "×" },
];

/** The Look tool's sliders for the selected hex line (design §13.2). */
export function LookPanel({
  target,
  onLook,
  onCommit,
}: {
  /** The selected line: where and what it is, and its look. */
  target: { q: number; r: number; layer: Layer; spec?: string; look: HexLook } | null;
  /** Live, while a slider moves. */
  onLook: (look: HexLook) => void;
  /** A slider let go: one undo step and a write. */
  onCommit: () => void;
}) {
  if (!target) {
    return (
      <SidebarSection title="Look">
        <p className="rpg-hexpaint-empty">Click a hex to select it.</p>
      </SidebarSection>
    );
  }
  const { look } = target;
  const value = (key: (typeof LOOK_SLIDERS)[number]["key"]) =>
    key === "size"
      ? (look.size ?? 1)
      : key === "x"
        ? (look.shift?.[0] ?? 0)
        : key === "y"
          ? (look.shift?.[1] ?? 0)
          : key === "hue"
            ? (look.hue ?? 0)
            : key === "bright"
              ? (look.bright ?? 1)
              : (look.sat ?? 1);
  const change = (key: (typeof LOOK_SLIDERS)[number]["key"], v: number) => {
    const next: HexLook = { ...look };
    if (key === "size") next.size = v;
    else if (key === "x") next.shift = [v, look.shift?.[1] ?? 0];
    else if (key === "y") next.shift = [look.shift?.[0] ?? 0, v];
    else if (key === "hue") next.hue = v;
    else if (key === "bright") next.bright = v;
    else next.sat = v;
    onLook(next);
  };
  return (
    <SidebarSection
      title="Look"
      aside={
        <span className="rpg-hexpaint-look-where">
          ({target.q}, {target.r}) · {LAYER_NAME[target.layer].toLowerCase()} {target.spec ?? ""}
        </span>
      }
    >
      <dl className="rpg-hexpaint-fields rpg-hexpaint-look">
        {LOOK_SLIDERS.map((sl) => (
          <React.Fragment key={sl.key}>
            <dt>{sl.name}</dt>
            <dd>
              <input
                type="range"
                min={sl.min}
                max={sl.max}
                step={sl.step}
                value={value(sl.key)}
                onChange={(e) => change(sl.key, parseFloat(e.target.value))}
                onPointerUp={onCommit}
                onKeyUp={onCommit}
              />
              <output>
                {Math.round(value(sl.key) * 100) / 100}
                {sl.unit ?? ""}
              </output>
            </dd>
          </React.Fragment>
        ))}
      </dl>
      <button
        type="button"
        className="rpg-hexpaint-button"
        onClick={() => {
          onLook({});
          onCommit();
        }}
      >
        Reset look
      </button>
    </SidebarSection>
  );
}
