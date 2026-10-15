/**
 * `rpg map` with `grid: hex` — mounted by `MapRenderChild` when the block's
 * head says `grid: hex`, so it renders wherever `rpg map` does (its own page,
 * `.bare()` embeds). Tiles come from the vault's hex packs; the map redraws
 * when a pack changes.
 */

import type { App, Component } from "obsidian";
import * as React from "react";
import { HexMapView } from "lib/components/hexmap/hex-map-view";
import { hexPackIndex } from "lib/services/hex-pack-index";
import { settingsStore } from "lib/services/settings-store";
import { type HexLayout, type ImageSize, layoutHexMap, resolveHexMap } from "./layout";
import { type HexMapError, parseHexMap } from "./parse-hex-map";

interface HexMapBlockProps {
  source: string;
  app: App;
  sourcePath: string;
  /** The render child, for Obsidian's page preview on hover. */
  component: Component;
}

export function HexMapBlock({ source, app, sourcePath, component }: HexMapBlockProps) {
  const parsed = React.useMemo(() => parseHexMap(source), [source]);
  const [version, setVersion] = React.useState(0);
  const [drawn, setDrawn] = React.useState<{ layout: HexLayout; errors: HexMapError[] } | null>(null);

  React.useEffect(() => hexPackIndex.subscribe(() => setVersion((v) => v + 1)), []);

  React.useEffect(() => {
    let alive = true;
    void (async () => {
      const packs = await hexPackIndex.getPacks();
      const resolved = resolveHexMap(parsed, packs, hexPackIndex.defaultPack());
      const sizes = new Map<string, ImageSize>();
      await Promise.all(
        resolved.urls.map(async (url) => {
          const size = await hexPackIndex.measure(url);
          if (size) sizes.set(url, size);
        })
      );
      if (alive) setDrawn({ layout: layoutHexMap(resolved, sizes), errors: resolved.errors });
    })();
    return () => {
      alive = false;
    };
  }, [parsed, version]);

  if (parsed.cells.length === 0) {
    return (
      <div className="notice">
        rpg map: add hexes below the <code>---</code> — <code>t(q,r): terrain</code>, <code>s(q,r): stack</code>,{" "}
        <code>p(q,r): path</code>
        {parsed.errors.length > 0 &&
          ` (${parsed.errors.length} problem${parsed.errors.length === 1 ? "" : "s"}: line ${parsed.errors[0].line}: ${parsed.errors[0].message})`}
      </div>
    );
  }
  if (!drawn) return <div className="rpg-hexmap rpg-hexmap--loading">Drawing hex map…</div>;
  const settings = settingsStore.getSettings();

  return (
    <HexMapView
      layout={drawn.layout}
      title={parsed.title}
      scale={parsed.scale}
      coords={parsed.coords ?? settings?.hexCoords ?? "hover"}
      gridLines={settings?.hexGridLines ?? false}
      labelScale={settings?.hexLabelScale ?? 1}
      maxHeight={settings?.hexMapMaxHeight ?? 75}
      errors={drawn.errors}
      onOpenLink={(link, evt) => void app.workspace.openLinkText(link, sourcePath, evt.metaKey || evt.ctrlKey)}
      onHoverLink={(link, evt, targetEl) =>
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
}
