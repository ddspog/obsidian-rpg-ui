/**
 * The pack browser's marker layer: where a style stands on its picture (its
 * anchor) and how big it's drawn, in `pack.yml`'s `markers:`; and imported
 * marker files sorted into style folders by name (markers.ts).
 */

import * as React from "react";
import { NumberField } from "lib/components/hexmap/label-studio";
import { MARKER_ANCHOR, markerPathFromName } from "lib/domains/hexmap/markers";
import type { MarkerKey } from "lib/domains/hexmap/pack-yml-edit";
import type { MarkerTuning, TileFolder } from "lib/domains/hexmap/packs";

type Renames = Array<{ from: string; to: string }>;

/** A folder's files that an imported name places in a style folder (`Pins - Pin, red` → `pin/red`). */
export function markerSorts(folder: TileFolder): Renames {
  return folder.files.flatMap((f) => {
    const to = markerPathFromName(f.name);
    return to && to.toLowerCase() !== f.path.toLowerCase() ? [{ from: f.path, to }] : [];
  });
}

export function MarkerBox({
  style,
  tuning,
  sample,
  onSample,
  onSet,
}: {
  style: string;
  tuning: MarkerTuning;
  sample: string;
  onSample: (text: string) => void;
  onSet: (key: MarkerKey, value: number | number[] | null) => void;
}) {
  const anchor = tuning.anchor;
  const setAnchor = (i: 0 | 1, v: number | null) => {
    const next: [number, number] = [...(anchor ?? MARKER_ANCHOR)];
    next[i] = v ?? MARKER_ANCHOR[i];
    onSet("anchor", next[0] === MARKER_ANCHOR[0] && next[1] === MARKER_ANCHOR[1] ? null : next);
  };
  return (
    <fieldset className="rpg-hexstudio-tune">
      <legend>Marker “{style}”</legend>
      <label>
        <span>Sample name</span>
        <input type="text" value={sample} onChange={(e) => onSample(e.target.value)} />
      </label>
      <NumberField
        label="Stands at, across (0–1)"
        own={anchor?.[0]}
        placeholder={String(MARKER_ANCHOR[0])}
        onChange={(v) => setAnchor(0, v)}
      />
      <NumberField
        label="Stands at, down (0–1)"
        own={anchor?.[1]}
        placeholder={String(MARKER_ANCHOR[1])}
        onChange={(v) => setAnchor(1, v)}
      />
      <NumberField label="Size" own={tuning.size} placeholder="1" onChange={(v) => onSet("size", v)} />
      <p className="setting-item-description">
        The dot is the marker's spot: the point of the picture that stands on it (a pin's tip, a pole's foot), as shares
        of its width and height. Size multiplies every <code>{style}</code> marker. Maps write{" "}
        <code>m(q,r): {style}[mark] (Name) [[Note]]</code>.
      </p>
    </fieldset>
  );
}
