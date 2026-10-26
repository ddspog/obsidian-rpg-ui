/**
 * `rpg map` — a battle map, drawn from its block: terrain on a square grid,
 * labelled like a chessboard, with any default starting spots its `tokens:`
 * list gives. A combat in a session log binds it with `[COMBAT: [[Map]]]`.
 *
 * Mounted by both the primary `rpg` processor in main.ts and the sub-render
 * dispatcher (process-rpg-fences.ts), so it draws the same inside an embed.
 */

import { type App, MarkdownRenderChild, TFile } from "obsidian";
import * as React from "react";
import * as ReactDOM from "react-dom/client";
import { MapTokenEditor } from "lib/components/battlemap/map-token-editor";
import type { MapToken } from "lib/components/battlemap/square-map-view";
import { isHexMapSource } from "lib/domains/hexmap/parse-hex-map";
import { HexMapBlock } from "lib/domains/hexmap/render-hex-map-block";
import { fitToImage, parseSquareMap, type SquareMap } from "./square-map";

/** Point a picture map at its picture: `[[ambush.webp]]` → a URL the page can
 *  load, found from the note the map is written in. A picture not found is
 *  left unresolved (the map draws nothing until it's fixed). */
export function resolveMapImage(map: SquareMap, app: App, sourcePath: string): SquareMap {
  if (!map.image) return map;
  const linktext = map.image.link
    .replace(/^!?\[\[/, "")
    .replace(/\]\]$/, "")
    .split("|")[0]
    .trim();
  const file = app.metadataCache.getFirstLinkpathDest(linktext, sourcePath);
  return file instanceof TFile ? { ...map, image: { ...map.image, url: app.vault.getResourcePath(file) } } : map;
}

/** A picture map, measured: its squares counted from the picture's own size
 *  (loaded once) — for code that needs the board's size before it's drawn. */
export function measureMapImage(map: SquareMap): Promise<SquareMap> {
  const url = map.image?.url;
  if (!url || (map.cols > 0 && map.rows > 0)) return Promise.resolve(map);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(fitToImage(map, img.naturalWidth, img.naturalHeight));
    img.onerror = () => resolve(map);
    img.src = url;
  });
}

/** A map's default spots as tokens: a linked name is a creature from a
 *  statblock (a foe), a plain one a PC. */
export function defaultTokens(map: SquareMap): MapToken[] {
  return Object.entries(map.tokens).map(([name, at]) => ({
    name,
    at,
    side: name.includes("[[") ? "foe" : "pc",
  }));
}

function MapBlock({ map, source, sourcePath, app }: { map: SquareMap; source: string; sourcePath: string; app: App }) {
  if (map.image && !map.image.url) {
    return <div className="notice">rpg map: picture not found — {map.image.link}</div>;
  }
  if (!map.image && (map.rows === 0 || map.cols === 0)) {
    return <div className="notice">rpg map: draw the grid below the `---`</div>;
  }
  return <MapTokenEditor map={map} source={source} sourcePath={sourcePath} app={app} />;
}

export class MapRenderChild extends MarkdownRenderChild {
  private root: ReactDOM.Root | null = null;

  constructor(
    containerEl: HTMLElement,
    private app: App,
    private source: string,
    private sourcePath: string
  ) {
    super(containerEl);
  }

  onload() {
    this.root = ReactDOM.createRoot(this.containerEl);
    // `grid: hex` — an overworld hex map (lib/domains/hexmap).
    if (isHexMapSource(this.source)) {
      this.root.render(
        <HexMapBlock source={this.source} app={this.app} sourcePath={this.sourcePath} component={this} />
      );
      return;
    }
    this.root.render(
      <MapBlock
        map={resolveMapImage(parseSquareMap(this.source), this.app, this.sourcePath)}
        source={this.source}
        sourcePath={this.sourcePath}
        app={this.app}
      />
    );
  }

  onunload() {
    this.root?.unmount();
    this.root = null;
  }
}
