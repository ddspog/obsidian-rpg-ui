/**
 * The far art composer (design §13.11), in the pack studio's far tab: a
 * family's tiles built from the pack's stack sprites and terrain tiles.
 *
 * The big hex is the one being edited, drawn with its joined neighbours. Its
 * sprites come from a template (a middle that's in every variation, and sides
 * drawn when the hex joins, or doesn't join, across them: designed once facing
 * N and turned to all six, or for one side alone), or, for a variation finished
 * by hand, from its own list. Below, every variation (64 of them) is drawn with
 * its neighbours, so the joins show; clicking one shows it in the big hex.
 * Bake writes them all as images and lists them in `far:`.
 */

import * as React from "react";
import { type Side, SIDES } from "lib/domains/hexmap/axial";
import {
  type FarCompose,
  type FarSprite,
  type FarTemplateSprite,
  type FarZone,
  farVariations,
  type PlacedSprite,
  spritesFor,
  templateSprites,
  DEFAULT_CANVAS,
  depthSorted,
} from "lib/domains/hexmap/far-compose";
import { displayFor, groundOf, type HexPack, type TileFolder } from "lib/domains/hexmap/packs";
import { FAR_SHAPES, shapeName, shapeSides, type ShapeSlot, shapesWithSides } from "lib/domains/hexmap/path-shapes";
import { spriteTile, spriteUnits } from "lib/services/far-bake";
import { hexPackIndex } from "lib/services/hex-pack-index";

interface Props {
  pack: HexPack;
  family: string;
  /** The terrains it stands for (`forest`): their land tiles are drawn under it, to match. */
  of: string[];
  compose?: FarCompose;
  /** A change finished (a drag let go, a field set): the recipe as it is now. */
  onCommit: (compose: FarCompose) => void;
  onBake: (compose: FarCompose) => void;
  busy: boolean;
}

/** What the big hex edits: a zone of the template, or one variation's own list. */
type Target = { kind: "zone"; zone: FarZone } | { kind: "shape"; shape: string };

const EMPTY: FarCompose = { sprites: [], shapes: {}, canvas: DEFAULT_CANVAS };

/** A flat-top hex one wide (circumradius 0.5), centred on (x, y), shrunk by `k`. */
function hexPoints(x: number, y: number, k = 1): string {
  return [0, 1, 2, 3, 4, 5]
    .map((i) => {
      const a = (Math.PI / 3) * i;
      return `${(x + 0.5 * k * Math.cos(a)).toFixed(4)},${(y + 0.5 * k * Math.sin(a)).toFixed(4)}`;
    })
    .join(" ");
}

/** Where the neighbour across a side stands (its centre). */
function across(side: number): { x: number; y: number } {
  const a = (Math.PI / 3) * side - Math.PI / 2;
  const d = Math.sqrt(3) / 2;
  return { x: d * Math.cos(a), y: d * Math.sin(a) };
}

/** The band along a side, between the middle zone and the hex's edge. */
function bandPoints(side: number): string {
  // Side k runs between corners k+4 and k+5 (corner 0 is east, clockwise; side 0 is N).
  const corner = (i: number, k: number) => {
    const a = (Math.PI / 3) * i;
    return `${(0.5 * k * Math.cos(a)).toFixed(4)},${(0.5 * k * Math.sin(a)).toFixed(4)}`;
  };
  const a = (side + 4) % 6;
  const b = (side + 5) % 6;
  return [corner(a, 1), corner(b, 1), corner(b, 0.45), corner(a, 0.45)].join(" ");
}

interface SpriteInfo {
  url: string;
  /** Width and height on the map, in hex widths (before `s`). */
  w: number;
  h: number;
  /** The image's own width (px): hex widths per pixel is `w / px`. */
  px: number;
}

/** Every sprite the recipe names (and the palette shows), measured once. */
function useSprites(pack: HexPack, srcs: string[]): Map<string, SpriteInfo> {
  const key = [...new Set(srcs)].sort().join("\n");
  const [infos, setInfos] = React.useState<Map<string, SpriteInfo>>(new Map());
  React.useEffect(() => {
    let alive = true;
    void Promise.all(
      key
        .split("\n")
        .filter(Boolean)
        .map(async (src) => {
          const found = spriteTile(pack, src);
          const size = found ? await hexPackIndex.measure(found.tile.url) : null;
          if (!found || !size) return null;
          const w = spriteUnits(pack, found.layer, found.tile.path, size.w);
          return [src, { url: found.tile.url, w, h: (w * size.h) / size.w, px: size.w }] as const;
        })
    ).then((pairs) => {
      if (!alive) return;
      setInfos(new Map(pairs.filter((p): p is NonNullable<typeof p> => !!p)));
    });
    return () => {
      alive = false;
    };
  }, [pack, key]);
  return infos;
}

function SpriteImage({
  s,
  info,
  dx = 0,
  dy = 0,
  dim,
  index,
  selected,
}: {
  s: FarSprite;
  info?: SpriteInfo;
  dx?: number;
  dy?: number;
  dim?: boolean;
  index?: number;
  selected?: boolean;
}) {
  if (!info) return null;
  const w = info.w * s.s;
  const h = info.h * s.s;
  const x = dx + s.x;
  const y = dy + s.y;
  return (
    <g
      className={`rpg-farcomp-sprite${dim ? " is-dim" : ""}${selected ? " is-selected" : ""}`}
      data-index={index}
      transform={s.flip ? `translate(${2 * x} 0) scale(-1 1)` : undefined}
    >
      <image href={info.url} x={x - w / 2} y={y - h} width={w} height={h} preserveAspectRatio="none" />
      {selected && <rect x={x - w / 2} y={y - h} width={w} height={h} />}
    </g>
  );
}

/** A variation with the neighbours it joins, each joining back (their other sides open). */
function Cluster({
  compose,
  shape,
  infos,
  sprite,
  neighbours = true,
  under,
}: {
  compose: FarCompose;
  shape: ShapeSlot;
  infos: Map<string, SpriteInfo>;
  /** How each of the centre hex's sprites is drawn (the editor marks what it edits). */
  sprite?: (s: PlacedSprite, i: number) => React.ReactNode;
  /** The joined neighbours' sprites too (else only their outlines). */
  neighbours?: boolean;
  /** Drawn under each hex of the cluster, centred on (x, y): the land tile the far art stands for. */
  under?: (x: number, y: number) => React.ReactNode;
}) {
  const sides = shapeSides(shape.type, shape.slot).map((s) => SIDES.indexOf(s));
  const centre = spritesFor(compose, shape);
  // Every sprite of the cluster in one pass, back to front, so a neighbour's trees overlap the centre's properly.
  const all = depthSorted(
    [
      ...(neighbours ? sides : []).flatMap((side) => {
        const at = across(side);
        const back = SIDES[(side + 3) % 6];
        return spritesFor(compose, { type: "start", slot: (side + 3) % 6 }).map((s) => ({
          s: { ...s, x: s.x + at.x, y: s.y + at.y },
          centre: -1,
          key: `${side}:${back}`,
        }));
      }),
      ...centre.map((s, i) => ({ s, centre: i, key: "c" })),
    ].map((e) => ({ ...e, y: e.s.y }))
  );
  return (
    <>
      {under && (
        <g className="rpg-farcomp-under">
          {[{ x: 0, y: 0 }, ...sides.map(across)].map((at, i) => (
            <React.Fragment key={i}>{under(at.x, at.y)}</React.Fragment>
          ))}
        </g>
      )}
      {SIDES.map((_, side) => {
        const at = across(side);
        return (
          <polygon
            key={`n${side}`}
            points={hexPoints(at.x, at.y)}
            className={sides.includes(side) ? "rpg-farcomp-hex is-joined" : "rpg-farcomp-hex is-open"}
          />
        );
      })}
      <polygon points={hexPoints(0, 0)} className="rpg-farcomp-hex is-centre" />
      {all.map((e, n) =>
        e.centre >= 0 && sprite ? (
          <React.Fragment key={`${e.key}${n}`}>{sprite(e.s, e.centre)}</React.Fragment>
        ) : (
          <SpriteImage key={`${e.key}${n}`} s={e.s} info={infos.get(e.s.src)} dim={e.centre < 0} />
        )
      )}
    </>
  );
}

/** A terrain tile as the map draws it: centred on its hex (x, y), with its pack offsets. */
function TileImage({
  pack,
  src,
  info,
  x,
  y,
  k = 1,
}: {
  pack: HexPack;
  src: string;
  info?: SpriteInfo;
  x: number;
  y: number;
  k?: number;
}) {
  if (!info) return null;
  const d = displayFor(pack.config, "terrain", src.slice(src.indexOf("/") + 1));
  const unit = (info.w / info.px) * k;
  const w = info.w * k;
  const h = info.h * k;
  return (
    <image
      href={info.url}
      x={x + d.offsetX * unit - w / 2}
      y={y + d.offsetY * unit - h / 2}
      width={w}
      height={h}
      preserveAspectRatio="none"
    />
  );
}

/** The terrain tiles under folders of these names (`forest` → land/forest/…), as sprite sources. */
function tilesOf(pack: HexPack, names: string[]): string[] {
  const want = names.map((n) => n.toLowerCase());
  const out: string[] = [];
  const all = (f: TileFolder) => {
    for (const t of f.files) out.push(`terrain/${t.path}`);
    f.folders.forEach(all);
  };
  const walk = (f: TileFolder) => {
    for (const sub of f.folders.values()) {
      if (want.includes(sub.name.toLowerCase())) all(sub);
      else if (groundOf(sub.name)) walk(sub);
    }
  };
  walk(pack.layers.terrain);
  return out;
}

/** A wood in the middle 30-mile hex running out into its NE neighbour, and one 5-mile hex alone in the SW one. */
const SAMPLE: Array<[number, number]> = (() => {
  const out: Array<[number, number]> = [];
  for (let q = -2; q <= 2; q++) for (let r = Math.max(-2, -q - 2); r <= Math.min(2, -q + 2); r++) out.push([q, r]);
  out.push([3, -3], [4, -4], [5, -5], [6, -6], [6, -5], [-6, 6]);
  return out;
})();

/** Seven 30-mile hexes of a land tile, with the far art drawn on them a sixth the size, as the map shows it. */
function MapPreview({
  pack,
  recipe,
  infos,
  coarse,
}: {
  pack: HexPack;
  recipe: FarCompose;
  infos: Map<string, SpriteInfo>;
  coarse: string;
}) {
  const n = 6;
  const fineR = 0.5 / n;
  const set = new Set(SAMPLE.map(([q, r]) => `${q},${r}`));
  const sprites = depthSorted(
    SAMPLE.flatMap(([q, r]) => {
      const sides = SIDES.filter((side, k) => {
        const step = [
          [0, -1],
          [1, -1],
          [1, 0],
          [0, 1],
          [-1, 1],
          [-1, 0],
        ][k];
        return set.has(`${q + step[0]},${r + step[1]}`);
      });
      const shape: ShapeSlot = sides.length
        ? (shapesWithSides(sides.join(","))[0] ?? { type: "star", slot: 0 })
        : { type: "alone", slot: 0 };
      const cx = 1.5 * fineR * q;
      const cy = Math.sqrt(3) * fineR * (r + q / 2);
      return spritesFor(recipe, shape).map((sp) => ({ ...sp, x: cx + sp.x / n, y: cy + sp.y / n, s: sp.s / n }));
    })
  );
  const coarseInfo = infos.get(coarse);
  return (
    <svg className="rpg-farcomp-map" viewBox="-1.65 -1.55 3.3 3.1">
      {[{ x: 0, y: 0 }, ...[0, 1, 2, 3, 4, 5].map(across)]
        .sort((a, b) => a.y - b.y)
        .map((at, i) => (
          <React.Fragment key={i}>
            <TileImage pack={pack} src={coarse} info={coarseInfo} x={at.x} y={at.y} />
            <polygon points={hexPoints(at.x, at.y)} className="rpg-farcomp-hex is-coarse" />
          </React.Fragment>
        ))}
      {sprites.map((sp, i) => (
        <SpriteImage key={i} s={sp} info={infos.get(sp.src)} />
      ))}
    </svg>
  );
}

/** A folder's tiles, and its subfolders', as sprite sources (`stack/foliage/x`). */
function folderSprites(layer: string, prefix: string, f: TileFolder): Array<{ folder: string; srcs: string[] }> {
  const here = f.files.length
    ? [{ folder: `${layer}/${prefix}`.replace(/\/$/, ""), srcs: f.files.map((t) => `${layer}/${t.path}`) }]
    : [];
  return [...here, ...[...f.folders.values()].flatMap((sub) => folderSprites(layer, `${prefix}${sub.name}/`, sub))];
}

const ZONE_SIDES: Array<{ value: string; label: string }> = [
  { value: "*", label: "Every side" },
  ...SIDES.map((s) => ({ value: s, label: s })),
];

/** The variation that shows a zone best: its side joined alone, or open alone. */
function shapeShowing(zone: FarZone, current: ShapeSlot): ShapeSlot {
  if (zone === "mid") return current;
  const side = zone[0] === "*" ? 0 : SIDES.indexOf(zone.slice(0, -1) as Side);
  return zone.endsWith("+") ? { type: "start", slot: side } : { type: "star5", slot: (side + 3) % 6 };
}

export function FarComposer({ pack, family, of, compose, onCommit, onBake, busy }: Props) {
  const [recipe, setRecipe] = React.useState<FarCompose>(compose ?? EMPTY);
  const [target, setTarget] = React.useState<Target>({ kind: "zone", zone: "mid" });
  const [shape, setShape] = React.useState<ShapeSlot>({ type: "star", slot: 0 });
  const [selected, setSelected] = React.useState<number | null>(null);
  const [picked, setPicked] = React.useState<string | null>(null);
  const [folder, setFolder] = React.useState("");
  const [filter, setFilter] = React.useState("");
  // The land tiles it stands for, one drawn under the hexes to match; and the 30-mile tile the preview sits on.
  // Lush first: the biome most maps are painted in.
  const landTiles = React.useMemo(
    () =>
      tilesOf(pack, of.length ? of : [family]).sort(
        (a, b) => Number(!/\/lush\//i.test(a)) - Number(!/\/lush\//i.test(b))
      ),
    [pack, of, family]
  );
  const [reference, setReference] = React.useState<string | null>(null);
  const ref = reference ?? landTiles[0] ?? null;
  const [showUnder, setShowUnder] = React.useState(true);
  const [showNeighbours, setShowNeighbours] = React.useState(false);
  const allLand = React.useMemo(
    () =>
      tilesOf(
        pack,
        [...pack.layers.terrain.folders.values()].flatMap((f) => (groundOf(f.name) ? [...f.folders.keys()] : [f.name]))
      ),
    [pack]
  );
  const [coarse, setCoarse] = React.useState<string>(
    () => allLand.find((t) => /\/basic\/lush$/i.test(t)) ?? allLand[0] ?? ""
  );
  const recipeRef = React.useRef(recipe);
  recipeRef.current = recipe;
  const svgRef = React.useRef<SVGSVGElement>(null);
  const drag = React.useRef<{ index: number; dx: number; dy: number; moved: boolean } | null>(null);
  const wheelCommit = React.useRef<number | undefined>(undefined);

  const sources = React.useMemo(
    () => [...folderSprites("stack", "", pack.layers.stack), ...folderSprites("terrain", "", pack.layers.terrain)],
    [pack]
  );
  React.useEffect(() => {
    if (!folder && sources.length) setFolder(sources[0].folder);
  }, [sources, folder]);
  const shown = sources.find((s) => s.folder === folder)?.srcs ?? [];
  const palette = shown.filter((src) => src.toLowerCase().includes(filter.trim().toLowerCase()));
  const used = [
    ...recipe.sprites.map((s) => s.src),
    ...Object.values(recipe.shapes).flatMap((l) => l.map((s) => s.src)),
  ];
  const infos = useSprites(pack, [...used, ...palette, ...landTiles, ...(coarse ? [coarse] : [])]);

  const name = shapeName(shape);
  const own = recipe.shapes[name];
  /** The sprites the big hex edits, as a list of their own: the zone's, or the variation's. */
  const editable: FarSprite[] =
    target.kind === "zone"
      ? recipe.sprites.filter((s) => s.zone === target.zone)
      : (own ?? templateSprites(recipe, shapeSides(shape.type, shape.slot)).map(({ from: _f, turn: _t, ...s }) => s));

  const change = (next: FarCompose, commit = true) => {
    setRecipe(next);
    if (commit) onCommit(next);
  };
  /** The editable list replaced, written back where it belongs. */
  const setEditable = (list: FarSprite[], commit = true) => {
    const r = recipeRef.current;
    if (target.kind === "zone") {
      const zone = target.zone;
      const rest = r.sprites.filter((s) => s.zone !== zone);
      change({ ...r, sprites: [...rest, ...list.map((s): FarTemplateSprite => ({ ...s, zone }))] }, commit);
    } else change({ ...r, shapes: { ...r.shapes, [target.shape]: list } }, commit);
  };

  const pointAt = (e: React.PointerEvent) => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const p = svg.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    return p.matrixTransform(ctm.inverse());
  };
  const onDown = (e: React.PointerEvent) => {
    const at = pointAt(e);
    if (!at) return;
    const hit = (e.target as Element).closest?.("[data-index]")?.getAttribute("data-index");
    if (hit !== null && hit !== undefined) {
      const index = Number(hit);
      const s = editable[index];
      setSelected(index);
      drag.current = { index, dx: at.x - s.x, dy: at.y - s.y, moved: false };
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
      return;
    }
    if (picked) {
      // One sprite per pick (Shift keeps it for more), so clicks don't pile up copies.
      if (!e.shiftKey) setPicked(null);
      // Far art is small on the map: a sprite starts larger than its size as a prop.
      setEditable([...editable, { src: picked, x: round(at.x), y: round(at.y), s: DEFAULT_SIZE }]);
      setSelected(editable.length);
      return;
    }
    setSelected(null);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const at = d ? pointAt(e) : null;
    if (!d || !at) return;
    d.moved = true;
    const list = editable.map((s, i) => (i === d.index ? { ...s, x: round(at.x - d.dx), y: round(at.y - d.dy) } : s));
    setEditable(list, false);
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (d?.moved) onCommit(recipeRef.current);
  };

  const sel = selected !== null ? editable[selected] : undefined;
  // The wheel sizes the sprite picked (the page scrolls when none is): a listener that may stop the scroll.
  const wheelRef = React.useRef<(e: WheelEvent) => void>(() => {});
  wheelRef.current = (e: WheelEvent) => {
    if (!sel) return;
    e.preventDefault();
    const s = Math.min(MAX_SIZE, Math.max(0.1, round(sel.s * (e.deltaY < 0 ? 1.06 : 1 / 1.06))));
    editSel({ s }, false);
    window.clearTimeout(wheelCommit.current);
    wheelCommit.current = window.setTimeout(() => onCommit(recipeRef.current), 300);
  };
  React.useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => wheelRef.current(e);
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, []);
  const editSel = (patch: Partial<FarSprite> | null, commit = true) => {
    if (selected === null) return;
    const list =
      patch === null
        ? editable.filter((_, i) => i !== selected)
        : editable.map((s, i) => (i === selected ? { ...s, ...patch } : s));
    if (patch === null) setSelected(null);
    setEditable(list, commit);
  };

  // The big hex: its editable sprites drawn as such, the rest dimmed.
  const zone = target.kind === "zone" ? target.zone : null;
  const drawSprite = (s: PlacedSprite) => {
    const mine =
      target.kind === "shape" ? true : s.from !== undefined && recipe.sprites[s.from]?.zone === zone && !s.turn;
    const index = mine
      ? target.kind === "shape"
        ? editable.findIndex((x) => x.x === s.x && x.y === s.y && x.src === s.src)
        : recipe.sprites
            .map((x, i) => ({ x, i }))
            .filter((e) => e.x.zone === zone)
            .findIndex((e) => e.i === s.from)
      : -1;
    return (
      <SpriteImage
        s={s}
        info={infos.get(s.src)}
        dim={!mine}
        index={mine && index >= 0 ? index : undefined}
        selected={mine && index === selected}
      />
    );
  };

  const setZone = (z: FarZone) => {
    setTarget({ kind: "zone", zone: z });
    setShape((cur) => shapeShowing(z, cur));
    setSelected(null);
  };
  const zoneKind = zone === "mid" ? "mid" : zone?.endsWith("+") ? "+" : zone?.endsWith("-") ? "-" : null;
  const zoneSide = zone && zone !== "mid" ? zone.slice(0, -1) : "*";

  const variations = farVariations();
  return (
    <section className="rpg-farcomp">
      <header>
        <h4>Compose “{family}”</h4>
        <p className="setting-item-description">
          Pick a sprite, click the hex to put it down, drag to move it, scroll over it to size it. The middle is in
          every variation; a side's sprites show where the hex joins its neighbour across it (Joined) or doesn't (Open).
        </p>
      </header>
      <div className="rpg-farcomp-work">
        <aside className="rpg-farcomp-palette">
          <select value={folder} onChange={(e) => setFolder(e.target.value)} aria-label="Sprites from">
            {sources.map((s) => (
              <option key={s.folder} value={s.folder}>
                {s.folder} ({s.srcs.length})
              </option>
            ))}
          </select>
          <input type="search" placeholder="Filter…" value={filter} onChange={(e) => setFilter(e.target.value)} />
          <ul>
            {palette.map((src) => {
              const info = infos.get(src);
              return (
                <li key={src}>
                  <button
                    type="button"
                    className={picked === src ? "is-selected" : undefined}
                    title={src}
                    onClick={() => setPicked(picked === src ? null : src)}
                  >
                    {info ? <img src={info.url} alt="" loading="lazy" /> : <span>…</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <div className="rpg-farcomp-stage">
          <menu className="rpg-farcomp-target">
            <li>
              <button
                type="button"
                className={zoneKind === "mid" ? "is-selected" : undefined}
                onClick={() => setZone("mid")}
              >
                Middle
              </button>
            </li>
            <li>
              <button
                type="button"
                className={zoneKind === "+" ? "is-selected" : undefined}
                onClick={() => setZone(`${zoneSide === "*" ? "*" : zoneSide}+` as FarZone)}
              >
                Joined side
              </button>
            </li>
            <li>
              <button
                type="button"
                className={zoneKind === "-" ? "is-selected" : undefined}
                onClick={() => setZone(`${zoneSide === "*" ? "*" : zoneSide}-` as FarZone)}
              >
                Open side
              </button>
            </li>
            <li>
              <button
                type="button"
                className={target.kind === "shape" ? "is-selected" : undefined}
                title="This variation's own sprites, instead of the template's"
                onClick={() => {
                  setTarget({ kind: "shape", shape: name });
                  setSelected(null);
                }}
              >
                Just {name}
              </button>
            </li>
          </menu>
          {(zoneKind === "+" || zoneKind === "-") && (
            <menu className="rpg-farcomp-target is-sides">
              {ZONE_SIDES.map((o) => (
                <li key={o.value}>
                  <button
                    type="button"
                    className={zoneSide === o.value ? "is-selected" : undefined}
                    title={
                      o.value === "*" ? "Designed facing N, turned round to each side" : `Only the ${o.value} side`
                    }
                    onClick={() => setZone(`${o.value}${zoneKind}` as FarZone)}
                  >
                    {o.label}
                  </button>
                </li>
              ))}
            </menu>
          )}
          <svg
            ref={svgRef}
            className="rpg-farcomp-editor"
            viewBox="-1.35 -1.3 2.7 2.6"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
          >
            <Cluster
              compose={recipe}
              shape={shape}
              infos={infos}
              sprite={(s) => drawSprite(s)}
              neighbours={showNeighbours}
              under={
                showUnder && ref
                  ? (x, y) => <TileImage pack={pack} src={ref} info={infos.get(ref)} x={x} y={y} />
                  : undefined
              }
            />
            {zone === "mid" && <polygon points={hexPoints(0, 0, 0.45)} className="rpg-farcomp-zone" />}
            {zone && zone !== "mid" && (
              <polygon
                points={bandPoints(zoneSide === "*" ? 0 : SIDES.indexOf(zoneSide as Side))}
                className="rpg-farcomp-zone"
              />
            )}
          </svg>
          <p className="setting-item-description">
            Showing <code>{name}</code>
            {own ? " — finished by hand" : ""}.{" "}
            {target.kind === "shape" &&
              (own ? (
                <button
                  type="button"
                  onClick={() => {
                    const rest = Object.fromEntries(Object.entries(recipe.shapes).filter(([k]) => k !== name));
                    change({ ...recipe, shapes: rest });
                    setSelected(null);
                  }}
                >
                  Back to the template
                </button>
              ) : (
                "Its first change keeps a copy of its own."
              ))}
          </p>
          <p className="rpg-farcomp-view">
            <label>
              <input type="checkbox" checked={showUnder} onChange={(e) => setShowUnder(e.target.checked)} />
              <span>Land tile under it</span>
            </label>
            <label>
              <input type="checkbox" checked={showNeighbours} onChange={(e) => setShowNeighbours(e.target.checked)} />
              <span>Neighbours' sprites</span>
            </label>
            <span className="rpg-farcomp-hint">Faded sprites belong to other zones: switch zone to edit them.</span>
          </p>
          {landTiles.length > 0 && (
            <menu className="rpg-farcomp-land" aria-label="Land tile to match">
              {landTiles.map((t) => (
                <li key={t}>
                  <button
                    type="button"
                    className={t === ref ? "is-selected" : undefined}
                    title={`${t.slice(t.indexOf("/") + 1)}: the 5-mile tile this far art stands for`}
                    onClick={() => setReference(t)}
                  >
                    {infos.get(t) ? <img src={infos.get(t)!.url} alt="" loading="lazy" /> : <span>…</span>}
                  </button>
                </li>
              ))}
            </menu>
          )}
          {editable.length > 0 && (
            <ul className="rpg-farcomp-list" aria-label="Sprites being edited">
              {editable.map((sp, i) => (
                <li key={i} className={i === selected ? "is-selected" : undefined}>
                  <button type="button" onClick={() => setSelected(i)} title={sp.src}>
                    {infos.get(sp.src) ? <img src={infos.get(sp.src)!.url} alt="" /> : null}
                    <span>{sp.src.split("/").pop()}</span>
                  </button>
                  <button
                    type="button"
                    aria-label="Remove"
                    title="Remove"
                    onClick={() => {
                      setEditable(editable.filter((_, j) => j !== i));
                      setSelected(null);
                    }}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          {sel && (
            <fieldset className="rpg-farcomp-selected">
              <legend>{sel.src.split("/").pop()}</legend>
              <label>
                <span>Size</span>
                <input
                  type="range"
                  min={0.1}
                  max={MAX_SIZE}
                  step={0.01}
                  value={sel.s}
                  onChange={(e) => editSel({ s: Number(e.target.value) }, false)}
                  onPointerUp={() => onCommit(recipeRef.current)}
                />
                <output>{sel.s.toFixed(2)}</output>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={!!sel.flip}
                  onChange={(e) => editSel({ flip: e.target.checked || undefined })}
                />
                <span>Mirrored</span>
              </label>
              <button type="button" onClick={() => setEditable([...editable, { ...sel, x: sel.x + 0.05 }])}>
                Duplicate
              </button>
              <button type="button" onClick={() => editSel(null)}>
                Remove
              </button>
            </fieldset>
          )}
          <p className="rpg-farcomp-bake">
            <label>
              <span>Canvas</span>
              <input
                type="number"
                min={1}
                max={3}
                step={0.1}
                value={recipe.canvas}
                title="The baked image's width and height, in hex widths: room for sprites to reach past the hex"
                onChange={(e) => {
                  const n = parseFloat(e.target.value);
                  if (Number.isFinite(n) && n >= 1) change({ ...recipe, canvas: n });
                }}
              />
            </label>
            <button
              type="button"
              className="mod-cta"
              disabled={busy || (recipe.sprites.length === 0 && Object.keys(recipe.shapes).length === 0)}
              onClick={() => onBake(recipeRef.current)}
              title={`Writes far/${family}/<shape>.webp for every variation and lists them as the family's tiles (replacing its table)`}
            >
              Bake {variations.length} tiles
            </button>
          </p>
        </div>
      </div>

      <section className="rpg-farcomp-onmap">
        <header>
          <h5>On the 30-mile map</h5>
          <label>
            <span>30-mile tile</span>
            <select value={coarse} onChange={(e) => setCoarse(e.target.value)}>
              {allLand.map((t) => (
                <option key={t} value={t}>
                  {t.slice(t.indexOf("/") + 1)}
                </option>
              ))}
            </select>
          </label>
        </header>
        <MapPreview pack={pack} recipe={recipe} infos={infos} coarse={coarse} />
        <p className="setting-item-description">
          A wood of it in the middle hex, running out into the NE one, and one 5-mile hex of it alone in the SW one,
          drawn as the 30-mile map draws them once baked.
        </p>
      </section>

      <table className="rpg-farcomp-showcase">
        <tbody>
          {FAR_SHAPES.map((t) => (
            <tr key={t.type}>
              <th scope="row" title={t.hint}>
                {t.type}
              </th>
              {[...Array(t.slots).keys()].map((slot) => {
                const v = { type: t.type, slot };
                const n = shapeName(v);
                return (
                  <td key={slot}>
                    <button
                      type="button"
                      className={`${n === name ? "is-selected" : ""}${recipe.shapes[n] ? " is-own" : ""}`}
                      title={`${n}${recipe.shapes[n] ? " (finished by hand)" : ""}`}
                      onClick={() => {
                        setShape(v);
                        setSelected(null);
                        if (target.kind === "shape") setTarget({ kind: "shape", shape: n });
                      }}
                    >
                      <svg viewBox="-1.35 -1.3 2.7 2.6">
                        <Cluster compose={recipe} shape={v} infos={infos} />
                      </svg>
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

const round = (n: number) => Math.round(n * 1000) / 1000;
/** A new sprite's size, and the largest, as multiples of its size as a prop on the map. */
const DEFAULT_SIZE = 1.5;
const MAX_SIZE = 5;
