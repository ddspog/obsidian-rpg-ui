/**
 * Settings › Hex maps › Terrain types: what each kind of ground does on a journey (the books'
 * numbers, changeable here), and which of a pack's tile folders counts as which terrain (written to
 * the pack's pack.yml `classify:`). A map's own `classify:` and a hex's `terrain=` still go over both.
 */

import type { App } from "obsidian";
import * as React from "react";
import type { HexPack, TileFolder } from "lib/domains/hexmap/packs";
import {
  BOOK_TERRAIN_RULES,
  applyTerrainOverrides,
  classifyPath,
  DEFAULT_CLASSIFY,
  type Pace,
  TERRAIN_IDS,
  TERRAIN_RULES,
  type TerrainId,
  type TerrainOverrides,
  type TerrainRules,
} from "lib/domains/hexmap/terrain";
import { editPackYml } from "lib/services/hex-pack-files";
import { hexPackIndex } from "lib/services/hex-pack-index";

export interface TerrainSettingsProps {
  app: App;
  overrides: TerrainOverrides;
  onOverrides: (next: TerrainOverrides) => void;
}

type NumKey = "navigationDC" | "foragingDC" | "searchDC" | "campDC";
const NUMBERS: Array<{ key: NumKey; label: string; hint: string }> = [
  { key: "navigationDC", label: "Navigate", hint: "WIS (Survival) to stay on course, Normal or Slow pace (+5 Fast)" },
  { key: "foragingDC", label: "Forage", hint: "WIS (Survival) to forage" },
  { key: "searchDC", label: "Search", hint: "WIS (Perception) to find a place you're looking for" },
  { key: "campDC", label: "Camp", hint: "WIS (Survival) to find a campsite (Solo Adventurer's Toolbox)" },
];

/** A pack's terrain folders two and three deep (`land/forest`, `land/forest/dead`), with their tile counts. */
function terrainFolders(pack: HexPack): Array<{ path: string; depth: number; tiles: number }> {
  const count = (f: TileFolder): number => f.files.length + [...f.folders.values()].reduce((n, s) => n + count(s), 0);
  const out: Array<{ path: string; depth: number; tiles: number }> = [];
  const walk = (f: TileFolder, path: string[], depth: number) => {
    for (const sub of f.folders.values()) {
      const p = [...path, sub.name.toLowerCase()];
      if (depth >= 1) out.push({ path: p.join("/"), depth, tiles: count(sub) });
      if (depth < 2) walk(sub, p, depth + 1);
    }
  };
  walk(pack.layers.terrain, [], 0);
  return out;
}

function RulesTable({ overrides, onOverrides }: Omit<TerrainSettingsProps, "app">) {
  const set = (id: TerrainId, patch: Partial<TerrainRules>) => {
    const own = { ...(overrides[id] ?? {}), ...patch };
    // A value back at the book's is no change at all.
    for (const k of Object.keys(own) as Array<keyof typeof own>)
      if (own[k] === BOOK_TERRAIN_RULES[id][k]) delete own[k];
    const next = { ...overrides, [id]: own };
    if (Object.keys(own).length === 0) delete next[id];
    applyTerrainOverrides(next);
    onOverrides(next);
  };
  return (
    <div className="rpg-terrain-settings-scroll">
      <table className="rpg-terrain-settings-table">
        <thead>
          <tr>
            <th scope="col">Terrain</th>
            <th scope="col" title="Halves travel speed off a road">
              Difficult
            </th>
            <th scope="col" title="The fastest pace the ground allows; a good road raises it one step">
              Fastest pace
            </th>
            {NUMBERS.map((n) => (
              <th key={n.key} scope="col" title={n.hint}>
                {n.label} DC
              </th>
            ))}
            <th scope="col" />
          </tr>
        </thead>
        <tbody>
          {TERRAIN_IDS.map((id) => {
            const rules = TERRAIN_RULES[id];
            const changed = !!overrides[id];
            return (
              <tr key={id} className={changed ? "is-changed" : undefined}>
                <th scope="row">{rules.name}</th>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`${rules.name} is difficult terrain`}
                    checked={rules.difficult}
                    onChange={(e) => set(id, { difficult: e.target.checked })}
                  />
                </td>
                <td>
                  <select
                    aria-label={`${rules.name} fastest pace`}
                    value={rules.maxPace ?? "boat"}
                    onChange={(e) => set(id, { maxPace: e.target.value === "boat" ? null : (e.target.value as Pace) })}
                  >
                    <option value="slow">Slow</option>
                    <option value="normal">Normal</option>
                    <option value="fast">Fast</option>
                    <option value="boat">By boat</option>
                  </select>
                </td>
                {NUMBERS.map((n) => (
                  <td key={n.key}>
                    <input
                      type="number"
                      min={0}
                      max={30}
                      aria-label={`${rules.name} ${n.label} DC`}
                      value={rules[n.key] ?? ""}
                      placeholder="—"
                      onChange={(e) => {
                        const v = e.target.value === "" ? undefined : Number(e.target.value);
                        if (v === undefined || Number.isFinite(v)) set(id, { [n.key]: v });
                      }}
                    />
                  </td>
                ))}
                <td>
                  {changed && (
                    <button
                      type="button"
                      className="rpg-terrain-settings-reset"
                      onClick={() => {
                        const next = { ...overrides };
                        delete next[id];
                        applyTerrainOverrides(next);
                        onOverrides(next);
                      }}
                    >
                      Book's
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PackFolders({ app, pack, onSaved }: { app: App; pack: HexPack; onSaved: () => void }) {
  const folders = React.useMemo(() => terrainFolders(pack), [pack]);
  const own = new Map(pack.config.classify.map((r) => [r.pattern, r.terrain]));
  const rules = [...pack.config.classify, ...DEFAULT_CLASSIFY];
  const [busy, setBusy] = React.useState(false);
  const change = async (pattern: string, terrain: string | null) => {
    setBusy(true);
    try {
      await editPackYml(app, pack.name, [{ kind: "classify-set", pattern, terrain }]);
      hexPackIndex.invalidate();
      onSaved();
    } finally {
      setBusy(false);
    }
  };
  if (folders.length === 0)
    return <p className="setting-item-description">This pack's terrain has no folders to sort.</p>;
  return (
    <ul className="rpg-terrain-settings-folders" aria-busy={busy}>
      {folders.map((f) => {
        const mine = own.get(f.path);
        // What it counts as without its own rule: the pack's broader rules, then the built-in ones.
        const inherited = classifyPath(
          f.path,
          rules.filter((r) => r.pattern !== f.path)
        );
        return (
          <li key={f.path} className={`depth-${f.depth}${mine ? " is-own" : ""}`}>
            <code>{f.path}</code>
            <span className="rpg-terrain-settings-count">{f.tiles} tiles</span>
            <select
              aria-label={`Terrain for ${f.path}`}
              value={mine ?? ""}
              disabled={busy}
              onChange={(e) => void change(f.path, e.target.value || null)}
            >
              <option value="">{inherited ? `${TERRAIN_RULES[inherited].name} (inherited)` : "Not classified"}</option>
              {TERRAIN_IDS.map((id) => (
                <option key={id} value={id}>
                  {TERRAIN_RULES[id].name}
                </option>
              ))}
            </select>
          </li>
        );
      })}
    </ul>
  );
}

export function TerrainSettings({ app, overrides, onOverrides }: TerrainSettingsProps) {
  const [packs, setPacks] = React.useState<HexPack[] | null>(null);
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    let alive = true;
    void hexPackIndex.getPacks().then((p) => alive && setPacks([...p.values()]));
    return () => {
      alive = false;
    };
  }, [tick]);
  const [open, setOpen] = React.useState<string | null>(null);
  return (
    <div className="rpg-terrain-settings">
      <h4>What each terrain does</h4>
      <p className="setting-item-description">
        Travel in Play mode and on journeys reads these. The numbers are the Game Master's Guide's (Travel Terrain,
        Overland Navigation) and the Solo Adventurer's Toolbox's (campsites); a changed row is marked, and Book's puts
        it back.
      </p>
      <RulesTable overrides={overrides} onOverrides={onOverrides} />
      <h4>Which tiles are which terrain</h4>
      <p className="setting-item-description">
        Each folder of a pack's terrain tiles counts as a terrain type. Choosing one here writes it to the pack's
        pack.yml under <code>classify:</code>. A map can still say otherwise in its own head (<code>classify:</code>),
        and one hex with <code>terrain=swamp</code> on its line.
      </p>
      {packs === null ? (
        <p className="setting-item-description">Reading packs…</p>
      ) : packs.length === 0 ? (
        <p className="setting-item-description">No packs found: set the packs folder above.</p>
      ) : (
        packs.map((pack) => (
          <details
            key={pack.name}
            open={open === pack.name}
            onToggle={(e) => (e.currentTarget.open ? setOpen(pack.name) : null)}
          >
            <summary>
              {pack.config.name || pack.name}{" "}
              <span className="rpg-terrain-settings-count">{pack.config.classify.length} rules of its own</span>
            </summary>
            <PackFolders app={app} pack={pack} onSaved={() => setTick((t) => t + 1)} />
          </details>
        ))
      )}
    </div>
  );
}
