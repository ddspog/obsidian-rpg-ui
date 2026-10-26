/**
 * Settings → Hex maps → Custom tiles: each pack's custom tiles with their
 * pictures, built, edited and deleted in the tile builder (design §13.3).
 */

import type { App } from "obsidian";
import * as React from "react";
import { CustomTilesPanel } from "lib/components/hexmap/hex-paint-panels";
import { openTileBuilder } from "lib/components/hexmap/tile-builder";
import type { HexPack } from "lib/domains/hexmap/packs";
import { editPackYml } from "lib/services/hex-pack-files";
import { hexPackIndex } from "lib/services/hex-pack-index";

export function CustomTilesSettings({ app }: { app: App }) {
  const [packs, setPacks] = React.useState<Map<string, HexPack>>(new Map());
  const [name, setName] = React.useState(hexPackIndex.defaultPack());
  React.useEffect(() => {
    const load = () => void hexPackIndex.getPacks().then(setPacks);
    load();
    return hexPackIndex.subscribe(load);
  }, []);
  const pack = packs.get(name) ?? [...packs.values()][0];
  return (
    <div className="rpg-hexpaint-sidebar rpg-custom-tiles-settings">
      <label className="rpg-hexpaint-check">
        Pack
        <select className="dropdown" value={pack?.name ?? ""} onChange={(e) => setName(e.target.value)}>
          {[...packs.keys()].map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>
      <CustomTilesPanel
        pack={pack}
        onPick={(tile) =>
          pack && openTileBuilder(app, { pack: pack.name, name: tile, lines: pack.config.stamps[tile] })
        }
        onNew={() => pack && openTileBuilder(app, { pack: pack.name })}
        onEdit={(tile) =>
          pack && openTileBuilder(app, { pack: pack.name, name: tile, lines: pack.config.stamps[tile] })
        }
        onDelete={(tile) => {
          if (
            pack &&
            window.confirm(`Delete the custom tile "${tile}" from ${pack.name}? Maps using it will show a problem.`)
          )
            void editPackYml(app, pack.name, [{ kind: "stamp-set", name: tile, lines: null }]);
        }}
      />
    </div>
  );
}
