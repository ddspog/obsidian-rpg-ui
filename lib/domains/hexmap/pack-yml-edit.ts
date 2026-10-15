/**
 * Edits to a pack's `pack.yml`, applied to its text so the file keeps its
 * comments and layout: catalog names added, renamed, removed; display tuning
 * set or cleared at the pack, folder or tile level. The settings' pack
 * browser queues these and writes them on Save.
 */

import { Document, isMap, parse as parseYaml, parseDocument, Scalar, type YAMLMap } from "yaml";
import type { TileDisplay } from "./packs";

export type TuneKey = "hexWidth" | "zoom" | "offsetX" | "offsetY" | "borderWidth";
export const TUNE_KEYS: TuneKey[] = ["hexWidth", "zoom", "offsetX", "offsetY", "borderWidth"];

/** Where tuning applies: the whole pack, a folder (`forest`, `stack/island`),
 *  or one tile (`forest/lush/conifer-0`). */
export type TuneLevel = { kind: "defaults" } | { kind: "terrains"; key: string } | { kind: "files"; key: string };

export type PackEdit =
  | { kind: "catalog-set"; id: string; spec: string; color?: string }
  | { kind: "catalog-delete"; id: string }
  | { kind: "catalog-rename"; from: string; to: string }
  /** `null` clears the key at that level (falls back to the level above). */
  | { kind: "tune"; level: TuneLevel; key: TuneKey; value: number | null };

function levelPath(level: TuneLevel): string[] {
  return level.kind === "defaults" ? ["defaults"] : [level.kind, level.key];
}

/** The map at `path`, created (in block style) if missing. */
function ensureMap(doc: Document, path: string[]): YAMLMap {
  let node = doc.getIn(path, true);
  if (!isMap(node)) {
    doc.setIn(path, doc.createNode({}));
    node = doc.getIn(path, true);
  }
  const map = node as YAMLMap;
  return map;
}

function setValue(doc: Document, path: string[], value: unknown): void {
  const parent = ensureMap(doc, path.slice(0, -1));
  // An empty `{}` written in the template turns to block style once it holds something.
  if (parent.flow && parent.items.length === 0) parent.flow = false;
  parent.set(path[path.length - 1], value);
}

function deleteValue(doc: Document, path: string[]): void {
  if (!doc.hasIn(path)) return;
  doc.deleteIn(path);
  // Drop a tile or folder entry left with nothing in it.
  const parentPath = path.slice(0, -1);
  const parent = doc.getIn(parentPath, true);
  if (parentPath.length === 2 && isMap(parent) && parent.items.length === 0) doc.deleteIn(parentPath);
}

export function applyPackEdits(text: string, edits: PackEdit[]): string {
  if (edits.length === 0) return text;
  const parsed = parseDocument(text || "");
  // An empty (or non-map) file starts from a fresh document.
  const doc: Document = isMap(parsed.contents) ? parsed : new Document({});
  for (const edit of edits) {
    if (edit.kind === "catalog-set") {
      setValue(
        doc,
        ["catalog", edit.id],
        edit.color ? doc.createNode({ spec: edit.spec, color: edit.color }, { flow: true }) : edit.spec
      );
    } else if (edit.kind === "catalog-delete") {
      deleteValue(doc, ["catalog", edit.id]);
    } else if (edit.kind === "catalog-rename") {
      const value = doc.getIn(["catalog", edit.from], true);
      if (value === undefined || edit.from === edit.to) continue;
      doc.deleteIn(["catalog", edit.from]);
      setValue(doc, ["catalog", edit.to], value);
    } else {
      const path = [...levelPath(edit.level), edit.key];
      if (edit.value === null) {
        deleteValue(doc, path);
      } else if (edit.level.kind === "defaults") {
        setValue(doc, path, edit.value);
      } else {
        // Tile and folder entries are one-liners: `"forest/lush/conifer-0": { offsetY: -3 }`.
        const entryPath = levelPath(edit.level);
        const entry = doc.getIn(entryPath, true);
        if (!isMap(entry)) {
          const section = ensureMap(doc, [edit.level.kind]);
          if (section.flow && section.items.length === 0) section.flow = false;
          // Tile paths are quoted, like the entries the pack ships with.
          const key = new Scalar(edit.level.key);
          if (edit.level.kind === "files") key.type = Scalar.QUOTE_DOUBLE;
          section.set(key, doc.createNode({ [edit.key]: edit.value }, { flow: true }));
        } else {
          entry.set(edit.key, edit.value);
        }
      }
    }
  }
  return doc.toString();
}

/** The tuning a level sets itself (not inherited), from a parsed config section. */
export function ownTuning(section: Partial<TileDisplay> | undefined): Partial<Record<TuneKey, number>> {
  const out: Partial<Record<TuneKey, number>> = {};
  for (const key of TUNE_KEYS) {
    const v = section?.[key];
    if (typeof v === "number") out[key] = v;
  }
  return out;
}

/** The `defaults:` tuning the file itself writes (the parsed config also
 *  fills in built-in defaults, which shouldn't show as set). */
export function ownDefaults(text: string): Partial<Record<TuneKey, number>> {
  try {
    const raw = parseYaml(text || "") as { defaults?: Partial<TileDisplay> } | null;
    return ownTuning(raw?.defaults);
  } catch {
    return {};
  }
}
