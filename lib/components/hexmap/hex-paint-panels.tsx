/**
 * Paint mode's sidebar panels beyond the brush (design §13.2–13.7): stamps
 * with their previews, what to do with a selection, the map's scale and its
 * detail maps, and the reference picture underneath. Presentational, in the
 * sidebar's look; the map block does the work.
 */

import * as React from "react";
import { HexMapStatic } from "lib/components/hexmap/hex-map-view";
import { IconButton, Segmented, SidebarSection } from "lib/components/hexmap/hex-paint-bar";
import { measureEm } from "lib/components/hexmap/measure-text";
import { LucideIcon } from "lib/components/session-log/lucide-icon";
import type { HexTint } from "lib/domains/hexmap/edit-hex-map";
import { type HexLayout, type ImageSize, layoutHexMap, resolveHexMap } from "lib/domains/hexmap/layout";
import type { HexPack } from "lib/domains/hexmap/packs";
import {
  type HexLabelLine,
  type HexMarkerLine,
  type HexRegion,
  type HexUnderlay,
  type ParentMode,
  parseHexMap,
} from "lib/domains/hexmap/parse-hex-map";
import { type LabelFields, labelContent, markerContent, type MarkerFields } from "lib/domains/hexmap/point-lines";
import { hexPackIndex } from "lib/services/hex-pack-index";

/** A stamp drawn small, from its lines. */
function StampPreview({ pack, lines }: { pack: HexPack; lines: string[] }) {
  const [layout, setLayout] = React.useState<HexLayout | null>(null);
  const key = lines.join("\n");
  React.useEffect(() => {
    let alive = true;
    const resolved = resolveHexMap(parseHexMap(`grid: hex\n---\n${key}`), new Map([[pack.name, pack]]), pack.name);
    void Promise.all(resolved.urls.map(async (u) => [u, await hexPackIndex.measure(u)] as const)).then((pairs) => {
      if (!alive) return;
      const sizes = new Map<string, ImageSize>();
      for (const [u, s] of pairs) if (s) sizes.set(u, s);
      setLayout(layoutHexMap(resolved, sizes, undefined, measureEm));
    });
    return () => {
      alive = false;
    };
  }, [pack, key]);
  return layout ? <HexMapStatic layout={layout} /> : <LucideIcon name="stamp" size={20} />;
}

/** The pack's custom tiles, first in the palette: pick one to paint it; build, edit or delete them. */
export function CustomTilesPanel({
  pack,
  stamp,
  onPick,
  onNew,
  onEdit,
  onDelete,
}: {
  pack?: HexPack;
  /** The one in hand. */
  stamp?: string;
  onPick: (name: string) => void;
  onNew: () => void;
  onEdit: (name: string) => void;
  onDelete: (name: string) => void;
}) {
  const tiles = Object.entries(pack?.config.stamps ?? {}).sort(([a], [b]) => a.localeCompare(b));
  return (
    <SidebarSection
      title="Custom tiles"
      aside={
        <button type="button" className="rpg-hexpaint-more" onClick={onNew} title="Build a new custom tile">
          + new
        </button>
      }
    >
      {tiles.length === 0 ? (
        <p className="rpg-hexpaint-empty">
          None yet. Build one from the pack's art with <b>+ new</b>, or select hexes and save them as one.
        </p>
      ) : (
        <menu className="rpg-hexpaint-stamps">
          {tiles.map(([name, lines]) => (
            <li key={name}>
              <button
                type="button"
                className={`rpg-hexpaint-stamp${name === stamp ? " is-selected" : ""}`}
                aria-pressed={name === stamp}
                title={lines.join("\n")}
                onClick={() => onPick(name)}
              >
                <span className="rpg-hexpaint-stamp-art">{pack && <StampPreview pack={pack} lines={lines} />}</span>
                <span className="rpg-hexpaint-swatch-name">{name}</span>
              </button>
              <span className="rpg-hexpaint-stamp-tools">
                <IconButton icon="pencil" label={`Edit ${name} in the tile builder`} onClick={() => onEdit(name)} />
                <IconButton icon="trash-2" label={`Delete ${name}`} onClick={() => onDelete(name)} />
              </span>
            </li>
          ))}
        </menu>
      )}
    </SidebarSection>
  );
}

/** The brush when a custom tile is in hand: its picture, its turn, and the one on the hex last clicked. */
export function CustomBrush({
  pack,
  name,
  rot,
  onTurn,
  onDrop,
  here,
  onExpand,
  onRemove,
}: {
  pack?: HexPack;
  name: string;
  rot: number;
  onTurn: (rot: number) => void;
  /** Back to the layer's own brush. */
  onDrop: () => void;
  here?: { name: string };
  onExpand: () => void;
  onRemove: () => void;
}) {
  const lines = pack?.config.stamps[name];
  return (
    <section className="rpg-hexpaint-brush is-custom" aria-label="Brush">
      <div className="rpg-hexpaint-brush-thumb">
        {pack && lines ? <StampPreview pack={pack} lines={lines} /> : <LucideIcon name="stamp" size={24} />}
      </div>
      <dl className="rpg-hexpaint-fields">
        <dt>Custom</dt>
        <dd className="rpg-hexpaint-custom-name">
          <strong>{name}</strong>
          <IconButton icon="x" label="Put it down: back to this layer's brush" onClick={onDrop} />
        </dd>
        <dt>Turn</dt>
        <dd className="rpg-hexpaint-turn">
          <IconButton icon="rotate-ccw" label="Turn left 60° (Shift+R)" onClick={() => onTurn((rot + 5) % 6)} />
          <output>{rot * 60}°</output>
          <IconButton icon="rotate-cw" label="Turn right 60° (R)" onClick={() => onTurn((rot + 1) % 6)} />
        </dd>
      </dl>
      {here && (
        <div className="rpg-hexpaint-here">
          <span>
            On this hex: <strong>{here.name}</strong>
          </span>
          <IconButton
            icon="expand"
            label="Expand: its lines become this map's own, to change by hand"
            onClick={onExpand}
          >
            <span>Expand</span>
          </IconButton>
          <IconButton icon="trash-2" label="Take it off the map" onClick={onRemove} />
        </div>
      )}
    </section>
  );
}

/** The tile builder's own panel: name the custom tile and save it to the pack. */
export function BuilderPanel({ name, pack, onSave }: { name?: string; pack?: string; onSave: (name: string) => void }) {
  const [value, setValue] = React.useState(name ?? "");
  return (
    <SidebarSection title="Custom tile" aside={pack && <span>{pack}</span>}>
      <p className="rpg-hexpaint-note">
        Paint it around the middle hex (0,0), on any layer: terrain, base, paths, stacks, markers. Use Look to size,
        shift or recolour each piece. Several hexes make a set that goes down together.
      </p>
      <form
        className="rpg-hexpaint-inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(value);
        }}
      >
        <input type="text" value={value} placeholder="walled-town" onChange={(e) => setValue(e.target.value)} />
        <button type="submit" className="rpg-hexpaint-button is-done" disabled={!value.trim()}>
          <LucideIcon name="save" size={14} />
          <span>Save</span>
        </button>
      </form>
    </SidebarSection>
  );
}

export function SelectionPanel({
  count,
  brush,
  region,
  onFill,
  onErase,
  onRegion,
  onSave,
  onClear,
  onExtract,
}: {
  count: number;
  /** What Fill paints (the brush), if anything. */
  brush?: string;
  region: string;
  onFill: () => void;
  onErase: () => void;
  onRegion: (on: boolean) => void;
  /** Open the tile builder with the selected hexes. */
  onSave: () => void;
  onClear: () => void;
  /** Move the selected hexes into a map in another note. */
  onExtract?: () => void;
}) {
  return (
    <SidebarSection
      title="Selection"
      aside={
        <span>
          {count} hex{count === 1 ? "" : "es"}
        </span>
      }
    >
      {count === 0 ? (
        <p className="rpg-hexpaint-empty">Drag a box over hexes; Shift adds, Alt takes away.</p>
      ) : (
        <>
          <menu className="rpg-hexpaint-row-buttons">
            <li>
              <IconButton
                icon="paint-bucket"
                label={brush ? `Fill with ${brush}` : "Pick a brush to fill"}
                disabled={!brush}
                onClick={onFill}
              >
                <span>Fill</span>
              </IconButton>
            </li>
            <li>
              <IconButton icon="eraser" label="Erase this layer" onClick={onErase}>
                <span>Erase</span>
              </IconButton>
            </li>
            <li>
              <IconButton icon="x" label="Clear the selection (Esc)" onClick={onClear}>
                <span>Clear</span>
              </IconButton>
            </li>
          </menu>
          <menu className="rpg-hexpaint-row-buttons">
            <li>
              <IconButton
                icon="land-plot"
                label={region ? `Add to ${region}` : "Name a region (Region tool) first"}
                disabled={!region}
                onClick={() => onRegion(true)}
              >
                <span>{region ? `+ ${region}` : "+ region"}</span>
              </IconButton>
            </li>
            <li>
              <IconButton
                icon="minus"
                label={region ? `Take out of ${region}` : "Name a region first"}
                disabled={!region}
                onClick={() => onRegion(false)}
              >
                <span>− region</span>
              </IconButton>
            </li>
          </menu>
          <IconButton icon="stamp" label="Make a custom tile from these hexes, in the tile builder" onClick={onSave}>
            <span>Make a custom tile</span>
          </IconButton>
          {onExtract && (
            <IconButton
              icon="file-output"
              label="Move these hexes into a map of their own, at the end of another note; this map imports it"
              onClick={onExtract}
            >
              <span>Extract to a note…</span>
            </IconButton>
          )}
        </>
      )}
    </SidebarSection>
  );
}

const TINT_SLIDERS: Array<{ key: keyof HexTint; name: string; min: number; max: number; step: number; unit: string }> =
  [
    { key: "hue", name: "Hue", min: -180, max: 180, step: 1, unit: "°" },
    { key: "sat", name: "Saturation", min: 0, max: 2, step: 0.05, unit: "×" },
    { key: "bright", name: "Brightness", min: 0, max: 2, step: 0.05, unit: "×" },
  ];
const TINT_DEFAULT: Required<HexTint> = { hue: 0, sat: 1, bright: 1 };

/**
 * The Select tool's colour for the selected hexes' edges or paths: one tint for
 * them all (`hue=` `sat=` `bright=` on each line; a coast that lays itself takes
 * a line of its own). Starts from the first tinted one.
 */
export function TintPanel({
  layer,
  count,
  tint,
  onTint,
  onCommit,
}: {
  layer: "edge" | "path";
  /** Selected hexes with something of the layer on them. */
  count: number;
  tint: HexTint;
  /** Live, while a slider moves. */
  onTint: (tint: HexTint) => void;
  /** A slider let go: one undo step and a write. */
  onCommit: () => void;
}) {
  const what = layer === "edge" ? "edge" : "path";
  return (
    <SidebarSection
      title={`Tint ${what}s`}
      aside={
        <span>
          {count} hex{count === 1 ? "" : "es"}
        </span>
      }
    >
      {count === 0 ? (
        <p className="rpg-hexpaint-empty">No {what}s in the selection.</p>
      ) : (
        <>
          <dl className="rpg-hexpaint-fields rpg-hexpaint-look">
            {TINT_SLIDERS.map((sl) => {
              const value = tint[sl.key] ?? TINT_DEFAULT[sl.key];
              return (
                <React.Fragment key={sl.key}>
                  <dt>{sl.name}</dt>
                  <dd>
                    <input
                      type="range"
                      min={sl.min}
                      max={sl.max}
                      step={sl.step}
                      value={value}
                      onChange={(e) => onTint({ ...tint, [sl.key]: parseFloat(e.target.value) })}
                      onPointerUp={onCommit}
                      onKeyUp={onCommit}
                    />
                    <output>
                      {Math.round(value * 100) / 100}
                      {sl.unit}
                    </output>
                  </dd>
                </React.Fragment>
              );
            })}
          </dl>
          <button
            type="button"
            className="rpg-hexpaint-button"
            onClick={() => {
              onTint({});
              onCommit();
            }}
          >
            Reset tint
          </button>
        </>
      )}
    </SidebarSection>
  );
}

export function ScalePanel({
  scale,
  levels,
  level,
  onLevel,
  of,
  ratio,
  parentMode,
  onParentMode,
  hex,
  next,
  detail,
  onDetail,
  staged,
}: {
  scale?: string;
  /** Each level's scale (30 mi, 5 mi, 1 mi; unset where the map has no scale); none for a detail note. */
  levels: Array<string | undefined>;
  /** The level shown (0: the main map). */
  level: number;
  onLevel: (level: number) => void;
  /** What this map details: a note (`of:`), or the level above in this block. */
  of?: string;
  ratio: number;
  parentMode: ParentMode;
  onParentMode: (m: ParentMode) => void;
  /** The hex last clicked, to detail. */
  hex: { q: number; r: number } | null;
  /** The next scale down. */
  next?: string;
  /** The picked hex's detail: at the level below (`inline`) or in a note at another scale. */
  detail?: "inline" | "note";
  onDetail: () => void;
  /** Hexes a new detail filled from the hex above, not written yet. */
  staged: number;
}) {
  const where = hex ? `(${hex.q}, ${hex.r})` : "";
  const finest = levels.length > 1 && level >= levels.length - 1;
  return (
    <SidebarSection title="Scale" aside={<span>{scale ? `1 hex = ${scale}` : "no scale"}</span>}>
      {levels.length > 1 && (
        <Segmented<string>
          legend="Level"
          value={String(level)}
          onChange={(v) => onLevel(Number(v))}
          options={levels.map((sc, d) => ({
            value: String(d),
            label: sc ?? `Level ${d}`,
            title: d === 0 ? "The main map" : `${Math.pow(ratio, d)} hexes across each hex of the main map`,
          }))}
        />
      )}
      {of && (
        <>
          <p className="rpg-hexpaint-note">
            Details <strong>{of}</strong>, {ratio} hexes across each of its hexes. Zoom out to go back up.
          </p>
          <Segmented<ParentMode>
            legend="Map above"
            value={parentMode}
            onChange={onParentMode}
            options={[
              { value: "faint", label: "Tiles", title: "The map above's tiles, faded, under this one" },
              { value: "grid", label: "Grid", title: "Only its hex outlines" },
              { value: "off", label: "Off" },
            ]}
          />
        </>
      )}
      {staged > 0 && (
        <p className="rpg-hexpaint-note">
          {staged} hex{staged === 1 ? "" : "es"} filled from the hex above, dimmed: <strong>Done</strong> writes them.
        </p>
      )}
      {!finest && (
        <IconButton
          icon={detail === "note" ? "external-link" : "zoom-in"}
          label={
            !hex
              ? "Click a hex first"
              : detail === "note"
                ? `Open the note with the detail of ${where}`
                : detail === "inline"
                  ? `Zoom into the detail of ${where}`
                  : `Map hex ${where} at ${next ?? "a finer scale"}: its inner hexes start as its tile`
          }
          disabled={!hex}
          onClick={onDetail}
        >
          <span>
            {!hex ? "Detail a hex…" : detail ? `Open detail ${where}` : `Detail ${where} at ${next ?? "finer"}`}
          </span>
        </IconButton>
      )}
    </SidebarSection>
  );
}

export function UnderlayPanel({
  underlay,
  onLive,
  onCommit,
  onSet,
}: {
  underlay?: HexUnderlay;
  /** While a slider moves. */
  onLive: (u: HexUnderlay) => void;
  onCommit: () => void;
  /** A new picture, or none. */
  onSet: (image: string | null) => void;
}) {
  const [link, setLink] = React.useState("");
  if (!underlay) {
    return (
      <SidebarSection title="Reference picture">
        <form
          className="rpg-hexpaint-inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (link.trim()) onSet(link.trim());
          }}
        >
          <input type="text" value={link} placeholder="Realm sketch.jpg" onChange={(e) => setLink(e.target.value)} />
          <button type="submit" className="rpg-hexpaint-button" disabled={!link.trim()}>
            <LucideIcon name="image" size={14} />
            <span>Trace</span>
          </button>
        </form>
      </SidebarSection>
    );
  }
  const live = (patch: Partial<HexUnderlay>) => onLive({ ...underlay, ...patch });
  const slider = (name: string, value: number, min: number, max: number, step: number, set: (v: number) => void) => (
    <>
      <dt>{name}</dt>
      <dd>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => set(parseFloat(e.target.value))}
          onPointerUp={onCommit}
          onKeyUp={onCommit}
        />
        <output>{Math.round(value * 100) / 100}</output>
      </dd>
    </>
  );
}

export interface StackElement {
  line: number;
  spec: string;
  count: number;
  look?: { size?: number; shift?: [number, number]; hue?: number; sat?: number; bright?: number };
}

export function StackListPanel({
  elements,
  selectedIndex,
  onSwap,
  onRemove,
  onSelect,
  onCommit,
}: {
  /** Stack elements on the selected hex, in line order (bottom to top). */
  elements: StackElement[];
  /** Currently selected element index for editing. */
  selectedIndex: number | null;
  /** Swap two elements by their indices in the array. */
  onSwap: (index1: number, index2: number) => void;
  /** Remove an element by its index. */
  onRemove: (index: number) => void;
  /** Select an element for editing its look. */
  onSelect: (index: number) => void;
  /** Commit changes (called after swap/remove). */
  onCommit: () => void;
}) {
  if (elements.length === 0) {
    return (
      <SidebarSection title="Stack">
        <p className="rpg-hexpaint-empty">No stack elements on this hex.</p>
      </SidebarSection>
    );
  }

  return (
    <SidebarSection
      title="Stack"
      aside={
        <span>
          {elements.length} element{elements.length === 1 ? "" : "s"}
        </span>
      }
    >
      <p className="rpg-hexpaint-note">
        Order determines z-index: first is drawn at the bottom. Click to edit, use arrows to reorder.
      </p>
      <menu className="rpg-hexpaint-stack-list">
        {elements.map((el, idx) => (
          <li
            key={el.line}
            className={`rpg-hexpaint-stack-item${selectedIndex === idx ? " is-selected" : ""}`}
          >
            <button
              type="button"
              className="rpg-hexpaint-stack-item-btn"
              onClick={() => onSelect(idx)}
              title={`Edit ${el.spec}`}
            >
              <div className="rpg-hexpaint-stack-item-info">
                <span className="rpg-hexpaint-stack-order">{idx + 1}</span>
                <span className="rpg-hexpaint-stack-spec">{el.spec}</span>
                {el.count > 1 && <span className="rpg-hexpaint-stack-count">×{el.count}</span>}
              </div>
            </button>
            <div className="rpg-hexpaint-stack-actions">
              <button
                type="button"
                className="rpg-hexpaint-icon-btn"
                disabled={idx === 0}
                onClick={(e) => {
                  e.stopPropagation();
                  onSwap(idx, idx - 1);
                  onCommit();
                  if (selectedIndex === idx) onSelect(idx - 1);
                  else if (selectedIndex === idx - 1) onSelect(idx);
                }}
                title="Move down (lower z-index)"
              >
                <LucideIcon name="arrow-down" size={14} />
              </button>
              <button
                type="button"
                className="rpg-hexpaint-icon-btn"
                disabled={idx === elements.length - 1}
                onClick={(e) => {
                  e.stopPropagation();
                  onSwap(idx, idx + 1);
                  onCommit();
                  if (selectedIndex === idx) onSelect(idx + 1);
                  else if (selectedIndex === idx + 1) onSelect(idx);
                }}
                title="Move up (higher z-index)"
              >
                <LucideIcon name="arrow-up" size={14} />
              </button>
              <button
                type="button"
                className="rpg-hexpaint-icon-btn rpg-hexpaint-icon-btn-danger"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(idx);
                  onCommit();
                  if (selectedIndex === idx && elements.length > 1) onSelect(Math.max(0, idx - 1));
                }}
                title="Remove from stack"
              >
                <LucideIcon name="trash-2" size={14} />
              </button>
            </div>
          </li>
        ))}
      </menu>
    </SidebarSection>
  );
}

/** The marker or label the Edit tool has selected. */
export type EditedPoint = { layer: "marker"; line: HexMarkerLine } | { layer: "label"; line: HexLabelLine };

/** A slider that writes live while it moves and saves when let go. */
function PointSlider({
  name,
  hint,
  value,
  min,
  max,
  step,
  unit,
  onChange,
  onCommit,
}: {
  name: string;
  /** What it means, on hover. */
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (v: number) => void;
  onCommit: () => void;
}) {
  return (
    <>
      <dt title={hint}>{name}</dt>
      <dd>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={Math.min(max, Math.max(min, value))}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          onPointerUp={onCommit}
          onKeyUp={onCommit}
        />
        {/* The number itself, for any value, past the slider's ends too. */}
        <span className="rpg-hexpaint-number">
          <input
            type="number"
            step={step}
            value={Math.round(value * 100) / 100}
            aria-label={name}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (Number.isFinite(v)) onChange(v);
            }}
            onBlur={onCommit}
            onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
          />
          {unit ?? ""}
        </span>
      </dd>
    </>
  );
}

/** A text field that writes live as you type and saves when you leave it (or press Enter). */
function PointText({
  name,
  value,
  placeholder,
  list,
  onChange,
  onCommit,
}: {
  name: string;
  value: string;
  placeholder?: string;
  list?: string;
  onChange: (v: string) => void;
  onCommit: () => void;
}) {
  return (
    <>
      <dt>{name}</dt>
      <dd>
        <input
          type="text"
          value={value}
          placeholder={placeholder}
          list={list}
          spellCheck={false}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onCommit}
          onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
        />
      </dd>
    </>
  );
}

/**
 * Mark mode's Edit tool: the selected marker's or label's fields, each change
 * written to its line as it's made (one undo step per field or slider).
 */
export function PointPanel({
  point,
  families,
  lettering,
  onContent,
  onCommit,
  onRemove,
}: {
  point: EditedPoint | null;
  /** The pack's label styles and banners, for the label's style field. */
  families: string[];
  /** The pack's lettering styles alone, for a marker's caption. */
  lettering: string[];
  /** Live: the line's new content (after `m(q,r):` / `l(q,r):`). */
  onContent: (content: string) => void;
  onCommit: () => void;
  onRemove: () => void;
}) {
  const listId = React.useId();
  if (!point) {
    return (
      <SidebarSection title="Edit">
        <p className="rpg-hexpaint-empty">
          Click a marker or label to change it, and drag it to move it. Click anywhere in a region to style its name.
        </p>
      </SidebarSection>
    );
  }
  const where = `(${Math.round(point.line.q * 100) / 100}, ${Math.round(point.line.r * 100) / 100})`;
  if (point.layer === "marker") {
    const m = point.line;
    const set = (patch: Partial<MarkerFields>) => onContent(markerContent({ ...m, ...patch }));
    const cap = m.caption ?? {};
    const setCap = (patch: Partial<NonNullable<MarkerFields["caption"]>>) => set({ caption: { ...cap, ...patch } });
    return (
      <SidebarSection title="Marker" aside={<span className="rpg-hexpaint-look-where">{where}</span>}>
        <dl className="rpg-hexpaint-fields rpg-hexpaint-look">
          <PointText
            name="Style"
            value={m.spec ?? ""}
            placeholder="pin[red]"
            onChange={(spec) => set({ spec })}
            onCommit={onCommit}
          />
          <PointText
            name="Caption"
            value={m.text ?? ""}
            placeholder="optional"
            onChange={(text) => set({ text })}
            onCommit={onCommit}
          />
          <PointText
            name="Note"
            value={m.link ?? ""}
            placeholder="optional"
            onChange={(link) => set({ link })}
            onCommit={onCommit}
          />
          <PointSlider
            name="Size"
            value={m.size}
            min={0.3}
            max={4}
            step={0.05}
            onChange={(size) => set({ size })}
            onCommit={onCommit}
          />
          <dt title="A piece is a token you can drag hex to hex in Play mode (a party, a ship); nothing is saved">
            Moves in Play
          </dt>
          <dd>
            <Segmented
              legend="Moves in Play"
              value={m.piece ? "yes" : "no"}
              onChange={(v) => {
                set({ piece: v === "yes" });
                onCommit();
              }}
              options={[
                { value: "no", label: "No" },
                { value: "yes", label: "Yes", title: "A token you can drag hex to hex in Play mode" },
              ]}
            />
          </dd>
        </dl>
        {m.text && (
          <>
            <h5 className="rpg-hexpaint-subhead">Caption</h5>
            <dl className="rpg-hexpaint-fields rpg-hexpaint-look">
              <PointText
                name="Style"
                value={cap.style ?? ""}
                placeholder="plain"
                list={listId}
                onChange={(style) => setCap({ style })}
                onCommit={onCommit}
              />
              <datalist id={listId}>
                {lettering.map((f) => (
                  <option key={f} value={f} />
                ))}
              </datalist>
              <PointSlider
                name="Size"
                value={cap.size ?? 1}
                min={0.4}
                max={4}
                step={0.05}
                onChange={(size) => setCap({ size })}
                onCommit={onCommit}
              />
              <PointSlider
                name="Across"
                value={cap.offset?.[0] ?? 0}
                min={-2}
                max={2}
                step={0.02}
                onChange={(x) => setCap({ offset: [x, cap.offset?.[1] ?? 0] })}
                onCommit={onCommit}
              />
              <PointSlider
                name="Down"
                value={cap.offset?.[1] ?? 0}
                min={-2}
                max={2}
                step={0.02}
                onChange={(y) => setCap({ offset: [cap.offset?.[0] ?? 0, y] })}
                onCommit={onCommit}
              />
              <PointSlider
                name="Bend"
                value={cap.arc ?? 0}
                min={-120}
                max={120}
                step={1}
                unit="°"
                onChange={(arc) => setCap({ arc })}
                onCommit={onCommit}
              />
              <PointSlider
                name="Turn"
                value={cap.rot ?? 0}
                min={-180}
                max={180}
                step={1}
                unit="°"
                onChange={(rot) => setCap({ rot })}
                onCommit={onCommit}
              />
              <ColourField
                name="Colour"
                value={cap.color}
                placeholder="the style's"
                onChange={(color) => setCap({ color })}
                onCommit={onCommit}
              />
              <dt>Case</dt>
              <dd>
                <Segmented
                  legend="Case"
                  value={cap.case ?? "none"}
                  onChange={(v) => {
                    setCap({ case: v === "none" ? undefined : v });
                    onCommit();
                  }}
                  options={[
                    { value: "upper", label: "AB", title: "UPPER CASE" },
                    { value: "title", label: "Ab", title: "Title Case" },
                    { value: "lower", label: "ab", title: "lower case" },
                    { value: "none", label: "As written", title: "As the caption is written" },
                  ]}
                />
              </dd>
              <dt>Outline</dt>
              <dd>
                <Segmented
                  legend="Outline"
                  value={cap.halo === false ? "off" : "on"}
                  onChange={(v) => {
                    setCap({ halo: v === "off" ? false : undefined });
                    onCommit();
                  }}
                  options={[
                    { value: "on", label: "On", title: "An outline round the letters, so they read over the map" },
                    { value: "off", label: "Off", title: "No outline" },
                  ]}
                />
              </dd>
              {cap.halo !== false && (
                <ColourField
                  name="Halo"
                  value={typeof cap.halo === "string" ? cap.halo : undefined}
                  placeholder="the style's"
                  onChange={(halo) => setCap({ halo })}
                  onCommit={onCommit}
                />
              )}
              <PointSlider
                name="Spacing"
                value={cap.spacing ?? 0}
                min={-0.1}
                max={1}
                step={0.01}
                onChange={(spacing) => setCap({ spacing })}
                onCommit={onCommit}
              />
              <PointSlider
                name="Width"
                hint="At most this wide, in hex radii; longer text goes on more lines (0: no limit; a bent one stays on one line)"
                value={cap.width ?? 0}
                min={0}
                max={10}
                step={0.1}
                onChange={(width) => setCap({ width: width > 0 ? width : undefined })}
                onCommit={onCommit}
              />
            </dl>
          </>
        )}
        <button type="button" className="rpg-hexpaint-button" onClick={onRemove}>
          Remove marker
        </button>
      </SidebarSection>
    );
  }
  const l = point.line;
  const set = (patch: Partial<LabelFields>) => onContent(labelContent({ ...l, ...patch }));
  return (
    <SidebarSection title="Label" aside={<span className="rpg-hexpaint-look-where">{where}</span>}>
      <dl className="rpg-hexpaint-fields rpg-hexpaint-look">
        <PointText name="Text" value={l.text ?? ""} onChange={(text) => set({ text })} onCommit={onCommit} />
        <PointText
          name="Style"
          value={l.family ?? ""}
          placeholder={families[0] ?? "realm"}
          list={listId}
          onChange={(family) => set({ family })}
          onCommit={onCommit}
        />
        <datalist id={listId}>
          {families.map((f) => (
            <option key={f} value={f} />
          ))}
        </datalist>
        <PointText
          name="Note"
          value={l.link ?? ""}
          placeholder="optional"
          onChange={(link) => set({ link })}
          onCommit={onCommit}
        />
        <PointSlider
          name="Size"
          value={l.size}
          min={0.2}
          max={5}
          step={0.05}
          onChange={(size) => set({ size })}
          onCommit={onCommit}
        />
        <PointSlider
          name="Turn"
          value={l.rot}
          min={-180}
          max={180}
          step={1}
          unit="°"
          onChange={(rot) => set({ rot })}
          onCommit={onCommit}
        />
        <PointSlider
          name="Bend"
          value={l.arc ?? 0}
          min={-120}
          max={120}
          step={1}
          unit="°"
          onChange={(arc) => set({ arc })}
          onCommit={onCommit}
        />
        <PointSlider
          name="Width"
          hint="At most this wide, in hex radii; longer text goes on more lines (0: no limit; a bent one stays on one line) (lettering styles only)"
          value={l.width ?? 0}
          min={0}
          max={15}
          step={0.1}
          onChange={(width) => set({ width: width > 0 ? width : undefined })}
          onCommit={onCommit}
        />
        <dt>Case</dt>
        <dd>
          <Segmented
            legend="Case"
            value={l.case ?? "none"}
            onChange={(v) => {
              set({ case: v === "none" ? undefined : v });
              onCommit();
            }}
            options={[
              { value: "upper", label: "AB", title: "UPPER CASE" },
              { value: "title", label: "Ab", title: "Title Case" },
              { value: "lower", label: "ab", title: "lower case" },
              { value: "none", label: "As written", title: "As the label is written" },
            ]}
          />
        </dd>
        <dt title="Lettering styles only; banners have their own art">Outline</dt>
        <dd>
          <Segmented
            legend="Outline"
            value={l.halo === false ? "off" : "on"}
            onChange={(v) => {
              set({ halo: v === "off" ? false : undefined });
              onCommit();
            }}
            options={[
              { value: "on", label: "On", title: "An outline round the letters (the style's colour unless set)" },
              { value: "off", label: "Off", title: "No outline" },
            ]}
          />
        </dd>
        {l.halo !== false && (
          <ColourField
            name="Halo"
            value={typeof l.halo === "string" ? l.halo : undefined}
            placeholder="the style's"
            onChange={(halo) => set({ halo })}
            onCommit={onCommit}
          />
        )}
        <PointSlider
          name="Spacing"
          value={l.spacing ?? 0}
          min={-0.1}
          max={1}
          step={0.01}
          onChange={(spacing) => set({ spacing })}
          onCommit={onCommit}
        />
        <PointText
          name="Colour"
          value={l.color ?? ""}
          placeholder="the style's"
          onChange={(color) => set({ color })}
          onCommit={onCommit}
        />
      </dl>
      <button type="button" className="rpg-hexpaint-button" onClick={onRemove}>
        Remove label
      </button>
    </SidebarSection>
  );
}

/** How a region's name is shown: across its middle, small under its top border, or not at all. */
type RegionLabelSpot = "middle" | "border" | "bottom" | "none";

/**
 * Build's Region tool: the brush's region and how it's drawn: its border and
 * fill, its note and the region it sits in, and its name, written as one
 * `label: { text, at, color, size, offset, rot, style, halo, caps, spacing }`.
 * Each change is written to its line under `regions:`.
 */
export function RegionPanel({
  id,
  decl,
  shown,
  regions,
  lettering,
  hexes,
  onDecl,
  onCommit,
  picking,
  onPick,
  picked,
  onExtract,
  from,
  follows,
  onFollow,
  onRemove,
}: {
  /** The region's tag (no spaces), or empty when the brush names none. */
  id: string;
  /** Its declaration as this map writes it, if any: changes go here. */
  decl: HexRegion | undefined;
  /** How it's drawn, imports included (a duchy's own colour, the import's `label:`): what's shown. */
  shown?: HexRegion;
  /** Every region on the map, for "Inside". */
  regions: string[];
  /** The pack's lettering styles, for the name's style. */
  lettering: string[];
  /** How many hexes it has. */
  hexes: number;
  /** Live: the declaration's new value. */
  onDecl: (value: Record<string, unknown>) => void;
  onCommit: () => void;
  /** Waiting for a click on the map to put the name on that hex. */
  picking?: boolean;
  onPick?: (on: boolean) => void;
  /** The hex clicked while picking (once), to put the name on. */
  picked?: { hex: [number, number]; n: number };
  /** Move this region's hexes (this map's own) into a map in another note. */
  onExtract?: () => void;
  /** The note it's imported from (its own map declares it): changes here are this map's exception. */
  from?: string;
  /** Imported, and drawn exactly as its own map has it: the fields are locked. */
  follows?: boolean;
  /** As its own map has it (dropping this map's change), or changed on this map (an override). */
  onFollow?: (follow: boolean) => void;
  /** Take it off this map: its declaration and tags (this map's own), or hidden here (imported). */
  onRemove?: () => void;
}) {
  const listId = React.useId();
  // A hex clicked while picking: the name goes on it (the latest write, kept in a ref past the early return).
  const putOn = React.useRef<((hex: [number, number]) => void) | null>(null);
  React.useEffect(() => {
    if (picked) putOn.current?.(picked.hex);
  }, [picked?.n]);
  if (!id) {
    return (
      <SidebarSection title="Region">
        <p className="rpg-hexpaint-empty">
          Pick a region in the list (or with Pick, on the map), or add one; then paint its hexes. Its look is set here.
        </p>
      </SidebarSection>
    );
  }
  // Shown as drawn; written as this map's own fields with the change put over them.
  const view = shown ?? decl;
  const look = view?.labelLook ?? {};
  const ownLook = decl?.labelLook ?? {};
  // The name as one object, defaults left out.
  const labelOf = (
    l: {
      text?: string;
      spot: RegionLabelSpot;
      color?: string;
      on?: [number, number];
      look: NonNullable<HexRegion["labelLook"]>;
    },
    /** This map never says where: leave it to the import. */
    noSpot = false
  ): Record<string, unknown> | undefined => {
    const o: Record<string, unknown> = {};
    if (l.text) o.text = l.text;
    if (noSpot) {
      if (decl?.at) o.at = decl.at;
    } else if (l.spot === "none") o.at = "none";
    else if (l.spot === "border") o.at = "top";
    else if (l.spot === "bottom") o.at = "bottom";
    else if (decl?.at) o.at = decl.at;
    else if (shown?.labelAt === "border" || shown?.label === false) o.at = "middle";
    if (l.color) o.color = l.color;
    const k = l.look;
    if (k.size !== undefined && Math.abs(k.size - 1) > 0.001) o.size = Math.round(k.size * 100) / 100;
    if (k.offset && (k.offset[0] || k.offset[1])) o.offset = k.offset.map((n) => Math.round(n * 100) / 100);
    if (k.rot) o.rot = k.rot;
    if (k.style) o.style = k.style;
    if (k.halo !== undefined) o.halo = k.halo;
    if (k.case) o.case = k.case;
    else if (k.caps !== undefined) o.caps = k.caps;
    if (k.arc) o.arc = k.arc;
    if (l.on) o.on = l.on;
    if (k.spacing) o.spacing = Math.round(k.spacing * 100) / 100;
    if (k.width) o.width = Math.round(k.width * 100) / 100;
    return Object.keys(o).length ? o : undefined;
  };
  const spotOf = (r: HexRegion | undefined): RegionLabelSpot | undefined =>
    r?.label === false
      ? "none"
      : r?.labelAt === "border" || r?.labelAt === "bottom" || r?.labelAt === "middle"
        ? r.labelAt
        : undefined;
  const spot: RegionLabelSpot = spotOf(view) ?? "middle";
  const label = {
    text: typeof view?.label === "string" ? view.label : undefined,
    spot,
    color: view?.labelColor,
    on: view?.labelOn,
    look,
  };
  // This map's own label, before a change: only what it says itself.
  const own = {
    text: typeof decl?.label === "string" ? decl.label : undefined,
    spot: spotOf(decl) ?? "middle",
    color: decl?.labelColor,
    on: decl?.labelOn,
    look: ownLook,
  };
  const write = (patch: Record<string, unknown>, labelPatch?: Partial<typeof label>) => {
    // A spot this map never set stays unset, unless it's the change.
    const ownSpot = labelPatch?.spot ?? spotOf(decl);
    const next = { ...own, ...labelPatch };
    const value: Record<string, unknown> = {
      label: labelOf({ ...next, spot: ownSpot ?? "middle" }, ownSpot === undefined),
      color: decl?.color,
      tint: decl?.tint,
      tintOpacity: decl?.tintOpacity,
      link: decl?.link ? `[[${decl.link}]]` : undefined,
      parent: decl?.parent,
      demark: decl?.demark,
      ...patch,
    };
    for (const [k, v] of Object.entries(value)) if (v === undefined || v === "") delete value[k];
    onDecl(value);
  };
  const setLabel = (patch: Partial<typeof label>) => write({}, patch);
  const setLook = (patch: Partial<typeof look>) => setLabel({ look: { ...ownLook, ...patch } });
  putOn.current = (hex) => {
    setLabel({ on: hex });
    onCommit();
    onPick?.(false);
  };
  return (
    <SidebarSection
      title="Region"
      aside={
        <span className="rpg-hexpaint-look-where">
          @{id} · {hexes} hexes
        </span>
      }
    >
      {from && (
        <dl className="rpg-hexpaint-fields rpg-hexpaint-look">
          <dt title={`Where this map gets the region from: ${from}'s own map, or a change of this map's`}>Shown</dt>
          <dd>
            <Segmented
              legend="Shown"
              value={follows ? "follow" : "change"}
              onChange={(v) => onFollow?.(v === "follow")}
              options={[
                {
                  value: "follow",
                  label: `As in ${from}`,
                  title: `Exactly as ${from}'s map has it; edit it there (this map's changes are dropped)`,
                },
                { value: "change", label: "Changed here", title: "This map's own change over it (an override)" },
              ]}
            />
          </dd>
        </dl>
      )}
      <fieldset className="rpg-hexpaint-region-fields" disabled={follows}>
        <dl className="rpg-hexpaint-fields rpg-hexpaint-look">
          <dt title="How the region is marked on the map: its outline, its fill, both or neither (its name is set below)">
            Marked
          </dt>
          <dd>
            <Segmented
              legend="Marked"
              value={view?.demark ?? "both"}
              onChange={(v) => {
                write({ demark: v === "both" ? undefined : v });
                onCommit();
              }}
              options={[
                { value: "both", label: "Both", title: "Outline and fill" },
                { value: "outline", label: "Outline", title: "Its border only" },
                { value: "fill", label: "Fill", title: "Its tint only, no border" },
                { value: "none", label: "None", title: "Not marked (the regions inside it still are)" },
              ]}
            />
          </dd>
          <ColourField name="Border" value={view?.color} onChange={(color) => write({ color })} onCommit={onCommit} />
          <ColourField
            name="Fill"
            value={view?.tint}
            placeholder="the border's"
            onChange={(tint) => write({ tint })}
            onCommit={onCommit}
          />
          <PointSlider
            name="Strength"
            value={view?.tintOpacity ?? 0.16}
            min={0}
            max={1}
            step={0.01}
            onChange={(tintOpacity) => write({ tintOpacity })}
            onCommit={onCommit}
          />
          <PointText
            name="Note"
            value={view?.link ?? ""}
            placeholder="optional"
            onChange={(v) => write({ link: v ? `[[${v.replace(/^\[\[|\]\]$/g, "")}]]` : undefined })}
            onCommit={onCommit}
          />
          <dt title="Drawn over it with a dashed border">Inside</dt>
          <dd>
            <select
              value={view?.parent ?? ""}
              onChange={(e) => {
                write({ parent: e.target.value || undefined });
                onCommit();
              }}
            >
              <option value="">—</option>
              {regions
                .filter((r) => r !== id)
                .map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
            </select>
          </dd>
        </dl>
        {onExtract && hexes > 0 && (
          <button
            type="button"
            className="rpg-hexpaint-button"
            title="Move this region's hexes into a map of their own, at the end of another note; this map imports it"
            onClick={onExtract}
          >
            Extract to a note…
          </button>
        )}
        <h5 className="rpg-hexpaint-subhead">Name</h5>
        <dl className="rpg-hexpaint-fields rpg-hexpaint-look">
          <PointText
            name="Text"
            value={label.text ?? ""}
            placeholder={id.replace(/([a-z])([A-Z])/g, "$1 $2")}
            onChange={(text) => setLabel({ text })}
            onCommit={onCommit}
          />
          <dt>Where</dt>
          <dd>
            <Segmented
              legend="Where"
              value={spot}
              onChange={(v) => {
                setLabel({ spot: v });
                onCommit();
              }}
              options={[
                { value: "middle", label: "Middle", title: "Across the middle of the region (or the hex it's on)" },
                {
                  value: "border",
                  label: "Top",
                  title: "Small, just inside its top border (or the top of the hex it's on)",
                },
                {
                  value: "bottom",
                  label: "Bottom",
                  title: "Small, just inside its bottom border (or the bottom of its hex)",
                },
                { value: "none", label: "None", title: "No name (letter it with a label instead)" },
              ]}
            />
          </dd>
          <dt title="Put the name on one hex of the region: its top, bottom or middle">On hex</dt>
          <dd className="rpg-hexpaint-onhex">
            <span>{label.on ? `(${label.on[0]}, ${label.on[1]})` : "chosen for it"}</span>
            <button
              type="button"
              className={picking ? "rpg-hexpaint-button is-on" : "rpg-hexpaint-button"}
              onClick={() => onPick?.(!picking)}
            >
              {picking ? "Click a hex…" : "Pick a hex"}
            </button>
            {label.on && (
              <button
                type="button"
                className="rpg-hexpaint-button"
                onClick={() => {
                  setLabel({ on: undefined });
                  onCommit();
                }}
              >
                Clear
              </button>
            )}
          </dd>
          <ColourField
            name="Colour"
            value={label.color}
            placeholder="the border's"
            onChange={(color) => setLabel({ color })}
            onCommit={onCommit}
          />
          <PointSlider
            name="Size"
            value={look.size ?? 1}
            min={0.2}
            max={8}
            step={0.05}
            onChange={(size) => setLook({ size })}
            onCommit={onCommit}
          />
          <PointSlider
            name="Across"
            value={look.offset?.[0] ?? 0}
            min={-10}
            max={10}
            step={0.05}
            onChange={(x) => setLook({ offset: [x, look.offset?.[1] ?? 0] })}
            onCommit={onCommit}
          />
          <PointSlider
            name="Down"
            value={look.offset?.[1] ?? 0}
            min={-10}
            max={10}
            step={0.05}
            onChange={(y) => setLook({ offset: [look.offset?.[0] ?? 0, y] })}
            onCommit={onCommit}
          />
          <PointSlider
            name="Turn"
            value={look.rot ?? 0}
            min={-180}
            max={180}
            step={1}
            unit="°"
            onChange={(rot) => setLook({ rot })}
            onCommit={onCommit}
          />
          <PointSlider
            name="Bend"
            value={look.arc ?? 0}
            min={-180}
            max={180}
            step={1}
            unit="°"
            onChange={(arc) => setLook({ arc })}
            onCommit={onCommit}
          />
          <dt>Case</dt>
          <dd>
            <Segmented
              legend="Case"
              value={look.case ?? (look.caps === false || (look.caps === undefined && look.style) ? "none" : "upper")}
              onChange={(v) => {
                setLook({ case: v, caps: undefined });
                onCommit();
              }}
              options={[
                { value: "upper", label: "AB", title: "UPPER CASE" },
                { value: "title", label: "Ab", title: "Title Case" },
                { value: "lower", label: "ab", title: "lower case" },
                { value: "none", label: "As written", title: "As the name is written" },
              ]}
            />
          </dd>
          <PointText
            name="Style"
            value={look.style ?? ""}
            placeholder="plain"
            list={listId}
            onChange={(style) => setLook({ style: style || undefined })}
            onCommit={onCommit}
          />
          <datalist id={listId}>
            {lettering.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
          <dt>Outline</dt>
          <dd>
            <Segmented
              legend="Outline"
              value={look.halo === false ? "off" : "on"}
              onChange={(v) => {
                setLook({ halo: v === "off" ? false : undefined });
                onCommit();
              }}
              options={[
                { value: "on", label: "On", title: "An outline round the letters, so they read over the map" },
                { value: "off", label: "Off", title: "No outline" },
              ]}
            />
          </dd>
          {look.halo !== false && (
            <ColourField
              name="Halo"
              value={typeof look.halo === "string" ? look.halo : undefined}
              placeholder="the style's"
              onChange={(halo) => setLook({ halo })}
              onCommit={onCommit}
            />
          )}
          <PointSlider
            name="Spacing"
            value={look.spacing ?? 0}
            min={-0.1}
            max={1}
            step={0.01}
            onChange={(spacing) => setLook({ spacing })}
            onCommit={onCommit}
          />
          <PointSlider
            name="Width"
            hint="At most this wide, in hex radii; longer text goes on more lines (0: no limit; a bent one stays on one line)"
            value={look.width ?? 0}
            min={0}
            max={15}
            step={0.1}
            onChange={(width) => setLook({ width: width > 0 ? width : undefined })}
            onCommit={onCommit}
          />
        </dl>
      </fieldset>
      {onRemove && (
        <button
          type="button"
          className="rpg-hexpaint-button rpg-hexpaint-region-remove"
          title={
            from
              ? `Not marked or named on this map (an override); ${from}'s map keeps it`
              : "Its declaration, and its tag on this map's hexes, taken off (Undo brings it back)"
          }
          onClick={onRemove}
        >
          {from ? "Hide on this map" : "Remove region"}
        </button>
      )}
    </SidebarSection>
  );
}

/** A colour: a swatch to pick it, and the text as written (blank: the default). */
function ColourField({
  name,
  value,
  placeholder,
  onChange,
  onCommit,
}: {
  name: string;
  value: string | undefined;
  placeholder?: string;
  onChange: (v: string | undefined) => void;
  onCommit: () => void;
}) {
  const hex = value && /^#[0-9a-f]{6}$/i.test(value) ? value : "#888888";
  return (
    <>
      <dt>{name}</dt>
      <dd className="rpg-hexpaint-colour">
        <input
          type="color"
          value={hex}
          aria-label={`${name} colour`}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onCommit}
        />
        <input
          type="text"
          value={value ?? ""}
          placeholder={placeholder ?? "default"}
          spellCheck={false}
          onChange={(e) => onChange(e.target.value || undefined)}
          onBlur={onCommit}
        />
      </dd>
    </>
  );
}
