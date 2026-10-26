/**
 * The pack browser's label layer: Classify gives each piece of a banner its
 * role, by renaming the file for it (`left`, `fill`, `centre` …: labels.ts);
 * the text box says where a family's text sits, in `pack.yml`'s `labels:`.
 */

import * as React from "react";
import {
  canGrow,
  LABEL_OVERLAP,
  LABEL_ROLES,
  LABEL_TEXT_SIZE,
  type LabelFamily,
  type LabelRole,
  labelRole,
  legacyLabelRole,
  planLabelRenames,
  ROLE_HINT,
} from "lib/domains/hexmap/labels";
import type { LabelKey } from "lib/domains/hexmap/pack-yml-edit";
import type { LabelTuning, TileFile, TileFolder } from "lib/domains/hexmap/packs";

type Renames = Array<{ from: string; to: string }>;

/** The name a tile takes for a role in its folder: the role, else the role numbered. */
function nameFor(folder: TileFolder, tile: TileFile, role: LabelRole): string {
  const taken = new Set(folder.files.filter((f) => f.path !== tile.path).map((f) => f.name.toLowerCase()));
  let name: string = role;
  for (let n = 2; taken.has(name); n++) name = `${role}-${n}`;
  const dir = tile.path.includes("/") ? tile.path.slice(0, tile.path.lastIndexOf("/") + 1) : "";
  return dir + name;
}

/** Where a role sits in a banner: five slots (cap, strip, centre, strip, cap). */
export function RoleGlyph({ role }: { role: LabelRole | null }) {
  const slots: Array<{ x: number; w: number; on: boolean }> = [
    { x: 0, w: 6, on: role === "left" },
    { x: 7, w: 9, on: role === "fill-left" || role === "fill" },
    { x: 17, w: 10, on: role === "centre" },
    { x: 28, w: 9, on: role === "fill-right" || role === "fill" },
    { x: 38, w: 6, on: role === "right" },
  ];
  return (
    <svg viewBox="0 0 44 12" className="rpg-hexstudio-roleglyph" aria-hidden="true">
      {slots.map((sl, i) => (
        <rect key={i} x={sl.x} y={1} width={sl.w} height={10} rx={1.5} className={sl.on ? "is-on" : undefined} />
      ))}
      {(role === "fill" || role === "fill-left" || role === "fill-right") && (
        // Repeats: a tiny "×n" mark.
        <text x={role === "fill-right" ? 32.5 : 11.5} y={9} className="rpg-hexstudio-roleglyph-mark">
          ×
        </text>
      )}
    </svg>
  );
}

/** A tile's role badge for the browser grid. */
export function RoleBadge({ tile }: { tile: TileFile }) {
  const role = labelRole(tile.name);
  return <span className={role ? "rpg-hexstudio-role" : "rpg-hexstudio-role is-missing"}>{role ?? "no role"}</span>;
}

/**
 * Classify for a label family, as for paths: the picked piece, then its role
 * from buttons that show where it sits; picking one renames the file for it
 * and moves on to the next piece with no role.
 */
export function LabelRolePanel({
  folder,
  tile,
  locked,
  onAssign,
  onRename,
}: {
  folder: TileFolder;
  tile: TileFile | null;
  /** File work waits for a saved or discarded draft. */
  locked: boolean;
  /** Rename the tile for a role; `next` is the piece to pick afterwards. */
  onAssign: (rename: { from: string; to: string }, next: string | null) => void;
  onRename: (renames: Renames) => void;
}) {
  const hasExtensions = folder.files.some((f) => /extension/i.test(f.name));
  const fromNames = planLabelRenames(folder.files, (f) => legacyLabelRole(f.name, hasExtensions));
  const current = tile ? labelRole(tile.name) : null;
  const guess = tile && !current ? legacyLabelRole(tile.name, hasExtensions) : null;
  const assign = (role: LabelRole) => {
    if (!tile) return;
    const to = nameFor(folder, tile, role);
    // The next piece still without a role, after this one (else the next one).
    const at = folder.files.findIndex((f) => f.path === tile.path);
    const after = [...folder.files.slice(at + 1), ...folder.files.slice(0, at)];
    const next = after.find((f) => !labelRole(f.name)) ?? folder.files[at + 1] ?? null;
    if (to === tile.path) {
      if (next) onAssign({ from: tile.path, to: tile.path }, next.path);
      return;
    }
    onAssign({ from: tile.path, to }, next?.path ?? null);
  };
  return (
    <fieldset className="rpg-hexstudio-shape">
      <legend>Role in “{folder.name}”</legend>
      {tile ? (
        <>
          <figure>
            <div className="rpg-hexstudio-shape-tile rpg-hexstudio-label-tile">
              <img src={tile.url} alt={tile.name} />
            </div>
            <figcaption>
              <code>{tile.name}</code> — {current ?? "no role yet"}
              {guess && <> · its name says {guess}</>}
            </figcaption>
          </figure>
          <div className="rpg-hexstudio-shape-pick">
            <menu aria-label="Role">
              {LABEL_ROLES.map((r) => (
                <li key={r}>
                  <button
                    type="button"
                    title={ROLE_HINT[r]}
                    disabled={locked}
                    className={r === current ? "is-selected" : r === guess ? "is-suggested" : undefined}
                    onClick={() => assign(r)}
                  >
                    <RoleGlyph role={r} />
                    {r}
                  </button>
                </li>
              ))}
            </menu>
            <p className="setting-item-description">
              {current ? `${current}: ${ROLE_HINT[current]}. ` : "Pick its role. "}A role starting with{" "}
              <code>fill</code> repeats to fit the text; the others are drawn once. Picking a role renames the file for
              it and moves on to the next piece.
              {locked && " Save or discard the pack.yml changes first."}
            </p>
          </div>
        </>
      ) : (
        <p className="setting-item-description">Pick a piece above to give it a role.</p>
      )}
      {fromNames.length > 0 && (
        <button type="button" disabled={locked} onClick={() => onRename(fromNames)}>
          Name {fromNames.length} piece{fromNames.length === 1 ? "" : "s"} from their names (
          {fromNames
            .slice(0, 2)
            .map((r) => `${r.from.slice(r.from.lastIndexOf("/") + 1)} → ${r.to.slice(r.to.lastIndexOf("/") + 1)}`)
            .join(", ")}
          {fromNames.length > 2 ? ", …" : ""})
        </button>
      )}
    </fieldset>
  );
}

/** Which roles a family has, as the paths' coverage table: what it can't draw is marked. */
export function LabelCoverage({ family, folder }: { family: LabelFamily | undefined; folder: TileFolder }) {
  const p = family?.pieces ?? {};
  const n = (r: LabelRole) => p[r]?.length ?? 0;
  const strip = n("fill") + n("fill-left") + n("fill-right");
  const missing = (r: LabelRole) =>
    (r === "left" || r === "right") && !n(r) ? true : r === "fill" && !strip && !n("centre");
  const grows = family ? canGrow(family) : false;
  const unnamed = folder.files.filter((f) => !labelRole(f.name)).length;
  return (
    <details className="rpg-hexstudio-coverage" open>
      <summary>
        “{folder.name}” — {grows ? "grows to fit its text" : "can't grow yet"}
        {n("centre") ? ", from a fixed centre" : ""}
        {unnamed ? ` · ${unnamed} piece${unnamed === 1 ? "" : "s"} with no role` : ""}
      </summary>
      <table>
        <tbody>
          <tr>
            {LABEL_ROLES.map((r) => (
              <td
                key={r}
                className={missing(r) ? "is-missing" : n(r) ? undefined : "is-empty"}
                title={`${r}: ${ROLE_HINT[r]} — ${
                  (p[r] ?? []).map((f) => f.name).join(", ") ||
                  (missing(r)
                    ? "needed to grow"
                    : r.startsWith("fill") && strip
                      ? "none of its own — the other strip stands in"
                      : "none (optional)")
                }`}
              >
                <RoleGlyph role={r} />
                <span>
                  {r} {n(r) || ""}
                </span>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </details>
  );
}

export function NumberField({
  label,
  own,
  placeholder,
  onChange,
}: {
  label: string;
  own: number | undefined;
  placeholder: string;
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
        placeholder={placeholder}
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

const SIDE_NAMES = ["Top", "Right", "Bottom", "Left"];

export function LabelTextBox({
  family,
  tuning,
  defaultInset,
  sample,
  onSample,
  onSet,
}: {
  family: string;
  tuning: LabelTuning;
  /** The insets used while the pack sets none (a quarter of each cap, an eighth of the height). */
  defaultInset: [number, number, number, number];
  sample: string;
  onSample: (text: string) => void;
  onSet: (key: LabelKey, value: number | string | number[] | null) => void;
}) {
  const inset = tuning.inset;
  return (
    <fieldset className="rpg-hexstudio-tune">
      <legend>Text on “{family}”</legend>
      <label>
        <span>Sample text</span>
        <input type="text" value={sample} onChange={(e) => onSample(e.target.value)} />
      </label>
      {SIDE_NAMES.map((name, i) => (
        <NumberField
          key={name}
          label={`${name} inset (px)`}
          own={inset?.[i]}
          placeholder={String(Math.round(defaultInset[i]))}
          onChange={(v) => {
            // The four go together: setting one writes the others as they're drawn now.
            const next = (inset ?? defaultInset).map(Math.round);
            if (v === null && inset) {
              next[i] = Math.round(defaultInset[i]);
            } else if (v !== null) next[i] = v;
            onSet("inset", next.every((n, k) => n === Math.round(defaultInset[k])) ? null : next);
          }}
        />
      ))}
      <NumberField
        label="Text size (share of height)"
        own={tuning.size}
        placeholder={String(LABEL_TEXT_SIZE)}
        onChange={(v) => onSet("size", v)}
      />
      <NumberField
        label="Seam overlap (px)"
        own={tuning.overlap}
        placeholder={String(LABEL_OVERLAP)}
        onChange={(v) => onSet("overlap", v)}
      />
      <label>
        <span>Text colour</span>
        <input
          type="text"
          defaultValue={tuning.color ?? ""}
          placeholder="#2b2118"
          onBlur={(e) => onSet("color", e.target.value.trim() || null)}
        />
      </label>
      <label>
        <span>Font</span>
        <input
          type="text"
          defaultValue={tuning.font ?? ""}
          placeholder="Georgia, serif"
          onBlur={(e) => onSet("font", e.target.value.trim() || null)}
        />
      </label>
      <p className="setting-item-description">
        Insets are the banner's own pixels from each edge to where text may go; the text is centred in that box. Blank
        uses the default. Maps write <code>l(q,r): (Text) {family}</code>.
      </p>
    </fieldset>
  );
}
