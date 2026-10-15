/**
 * The hex pack browser, in the plugin settings: pick a pack and a layer,
 * browse its folders and tiles, see the selection on a 7-hex cluster, tune
 * where it sits (pack, folder or tile level), and name it in the catalog.
 * Changes are a draft until Save, which edits the pack's `pack.yml` in place
 * (comments kept; a `pack.yml.bak` is made the first time).
 */

import { type App, Notice, TFile } from "obsidian";
import * as React from "react";
import { HexMapStatic } from "lib/components/hexmap/hex-map-view";
import { neighbour, SIDES } from "lib/domains/hexmap/axial";
import { autotileFamily } from "lib/domains/hexmap/autotile";
import { type HexLayout, type ImageSize, layoutHexMap, resolveHexMap } from "lib/domains/hexmap/layout";
import {
  applyPackEdits,
  ownDefaults,
  ownTuning,
  type PackEdit,
  TUNE_KEYS,
  type TuneKey,
  type TuneLevel,
} from "lib/domains/hexmap/pack-yml-edit";
import {
  displayFor,
  type HexPack,
  type Layer,
  LAYERS,
  parsePackConfig,
  type TileFile,
  type TileFolder,
} from "lib/domains/hexmap/packs";
import type { HexCell, ParsedHexMap } from "lib/domains/hexmap/parse-hex-map";
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
};

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
  const [base, ...rest] = path;
  return base + rest.map((p) => `[${p}]`).join("") + (tile ? `[${tile.name}]` : "");
}

function cell(q: number, r: number, layer: Layer, spec: string | undefined, line: number, color?: string): HexCell {
  return { q, r, layer, height: 0, spec, color, regions: [], count: 1, line };
}

/** A centre hex and its six neighbours, showing the selection where it belongs. */
function previewMap(pack: HexPack, layer: Layer, spec: string): ParsedHexMap {
  const ring = [{ q: 0, r: 0 }, ...SIDES.map((side) => neighbour({ q: 0, r: 0 }, side))];
  const ground = pack.config.catalog.plains ? "plains" : undefined;
  const cells: HexCell[] = [];
  let line = 1;
  for (const h of ring) {
    if (layer === "terrain") cells.push(cell(h.q, h.r, "terrain", spec, line++));
    else cells.push(cell(h.q, h.r, "terrain", ground, line++, ground ? undefined : "#b9c08a"));
  }
  if (layer === "stack") cells.push(cell(0, 0, "stack", spec, line++));
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
  return { seed: "preview", regions: {}, cells, errors: [] };
}

function useLayout(pack: HexPack | null, layer: Layer, spec: string | null): HexLayout | null {
  const [layout, setLayout] = React.useState<HexLayout | null>(null);
  React.useEffect(() => {
    if (!pack || !spec) {
      setLayout(null);
      return;
    }
    let alive = true;
    const resolved = resolveHexMap(previewMap(pack, layer, spec), new Map([[pack.name, pack]]), pack.name);
    void Promise.all(resolved.urls.map(async (u) => [u, await hexPackIndex.measure(u)] as const)).then((pairs) => {
      if (!alive) return;
      const sizes = new Map<string, ImageSize>();
      for (const [u, s] of pairs) if (s) sizes.set(u, s);
      setLayout(layoutHexMap(resolved, sizes));
    });
    return () => {
      alive = false;
    };
  }, [pack, layer, spec]);
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
  onChange,
}: {
  label: string;
  own: number | undefined;
  effective: number | undefined;
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
        placeholder={effective === undefined ? "image width" : String(effective)}
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

  const pack = packs.get(packName) ?? null;
  const draftText = React.useMemo(() => applyPackEdits(original, edits), [original, edits]);
  const draft = React.useMemo<HexPack | null>(
    () => (pack ? { ...pack, config: parsePackConfig(draftText, pack.name) } : null),
    [pack, draftText]
  );

  const layerRoot = draft?.layers[layer] ?? null;
  const folder = layerRoot && folderPath.length ? folderAt(layerRoot, folderPath) : null;
  const spec = folderPath.length ? specFor(folderPath, tile) : null;
  const layout = useLayout(draft, layer, spec);

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

  // Typing into a tuning field replaces its own last edit instead of queueing one per keystroke.
  const queue = (edit: PackEdit) =>
    setEdits((e) => {
      const last = e[e.length - 1];
      const sameField =
        last?.kind === "tune" &&
        edit.kind === "tune" &&
        last.key === edit.key &&
        JSON.stringify(last.level) === JSON.stringify(edit.level);
      return sameField ? [...e.slice(0, -1), edit] : [...e, edit];
    });

  const save = async () => {
    if (!ymlPath || edits.length === 0) return;
    const file = app.vault.getAbstractFileByPath(ymlPath);
    try {
      if (file instanceof TFile) {
        const bak = `${ymlPath}.bak`;
        if (!app.vault.getAbstractFileByPath(bak)) await app.vault.create(bak, await app.vault.read(file));
        const written = await app.vault.process(file, (text) => applyPackEdits(text, edits));
        setOriginal(written);
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

  const fillFromFolders = () => {
    if (!layerRoot || !config) return;
    const used = new Set(Object.values(config.catalog).map((c) => c.spec));
    const add: PackEdit[] = [];
    const walk = (f: TileFolder, path: string[]) => {
      for (const sub of f.folders.values()) {
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
          {LAYERS.map((l) => (
            <li key={l}>
              <button
                type="button"
                className={l === layer ? "is-selected" : undefined}
                onClick={() => {
                  setLayer(l);
                  setFolderPath([]);
                  setTile(null);
                }}
              >
                {l} <span className="rpg-hexstudio-count">{draft ? countFiles(draft.layers[l]) : 0}</span>
              </button>
            </li>
          ))}
        </menu>
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
          {layerRoot && layerRoot.folders.size > 0 ? (
            <FolderTree
              folder={layerRoot}
              path={[]}
              selected={folderPath}
              onSelect={(p) => {
                setFolderPath(p);
                setTile(null);
                setLevelKind((k) => (k === "files" ? "terrains" : k));
              }}
            />
          ) : (
            <p className="setting-item-description">No {layer} tiles in this pack.</p>
          )}
        </nav>
        <div className="rpg-hexstudio-tiles">
          {folder ? (
            folder.files.length ? (
              <ul>
                {folder.files.map((f) => (
                  <li key={f.path}>
                    <button
                      type="button"
                      className={tile?.path === f.path ? "is-selected" : undefined}
                      title={f.name}
                      onClick={() => setTile(tile?.path === f.path ? null : f)}
                    >
                      <img src={f.url} alt={f.name} loading="lazy" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="setting-item-description">Only subfolders here — pick one on the left.</p>
            )
          ) : (
            <p className="setting-item-description">Pick a folder to see its tiles.</p>
          )}
        </div>
      </div>

      {spec && (
        <div className="rpg-hexstudio-detail">
          <figure className="rpg-hexstudio-preview">
            {layout ? <HexMapStatic layout={layout} /> : <div className="rpg-hexmap--loading">…</div>}
            <figcaption>
              <code>{spec}</code>
            </figcaption>
          </figure>

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
            {TUNE_KEYS.map((key) => (
              <TuneField
                key={`${current.kind}:${key}`}
                label={TUNE_LABEL[key]}
                own={own[key]}
                effective={effective?.[key]}
                onChange={(value) => queue({ kind: "tune", level: current.level, key, value })}
              />
            ))}
            <p className="setting-item-description">Blank inherits from the level above. Pixels are the image's own.</p>
          </fieldset>

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
                const id = (newName.trim() || (tile?.name ?? folderPath.join("-"))).toLowerCase().replace(/\s+/g, "-");
                queue({ kind: "catalog-set", id, spec });
                setNewName("");
              }}
            >
              Add to catalog
            </button>
          </fieldset>
        </div>
      )}

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
    </section>
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
