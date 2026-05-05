/**
 * Parse a single compendium document (Cleric.md, Human.md, …) into a SourceDoc.
 *
 * Boundary between vault I/O and the pure resolver. The input is a
 * `WikiFileDescriptor` as produced by `wiki.folder()`/`wiki.file()` — body text
 * lives in `$contents`, frontmatter keys are spread on top.
 *
 * We walk `rpg feature.{details,choice,unlock,level}` code blocks in document
 * order so `feature.level` blocks can attach to the most recent
 * `feature.details` without requiring an explicit parent field.
 */

import { parse as parseYaml } from "yaml";
import { stripCalloutMarkers } from "../../utils/callout";
import { parseTableBlock } from "../tables/parse-table-block";
import type { TableDef } from "../tables/types";
import type {
  FeatureChoiceOption,
  FeatureDetails,
  FeatureLevelAddition,
  SourceDoc,
  SourceDocKind,
  UnlockBlock,
} from "./types";

/** Minimal shape we consume — matches `WikiFileDescriptor` without importing it. */
export interface SourceDocInput {
  $name: string;
  $contents?: string;
  [key: string]: unknown;
}

/** Per-kind frontmatter key conventions used by compendium docs. */
const META_KEYS: Record<SourceDocKind, string> = {
  class: ".CLASS",
  subclass: ".SUBCLASS",
  lineage: ".LINEAGE",
  heritage: ".HERITAGE",
  background: ".BACKGROUND",
  talent: ".TALENT",
};

/** Parse a YAML payload safely; returns `null` on failure (with a console warn). */
function safeParse<T>(yaml: string, ctx: string): T | null {
  try {
    const parsed = parseYaml(yaml);
    return (parsed && typeof parsed === "object" ? (parsed as T) : null);
  } catch (err) {
    console.warn(`[parseSourceDoc] failed to parse ${ctx}:`, err);
    return null;
  }
}

type FeatureBlockKind = "details" | "choice" | "unlock" | "level";

interface OrderedBlock {
  kind: FeatureBlockKind;
  yaml: string;
}

/**
 * Scan a document body for every `rpg feature.{details,choice,unlock,level}`
 * fence and return them in document order. Callout markers are stripped first
 * so fences inside callouts are still picked up.
 */
function extractOrderedFeatureBlocks(body: string): OrderedBlock[] {
  const cleaned = stripCalloutMarkers(body);
  const re = /```rpg feature\.(details|choice|unlock|level)\s*\n([\s\S]*?)```/g;
  const blocks: OrderedBlock[] = [];
  for (const m of cleaned.matchAll(re)) {
    blocks.push({
      kind: m[1] as FeatureBlockKind,
      yaml: m[2].replace(/\n+$/, ""),
    });
  }
  return blocks;
}

/**
 * Scan a document body for every `rpg table.<name>` fence and parse each into
 * a `TableDef`. `<name>` is captured from the fence info string and becomes
 * the table's local name inside its source doc.
 */
function extractTableBlocks(body: string): TableDef[] {
  const cleaned = stripCalloutMarkers(body);
  const re = /```rpg table\.([A-Za-z0-9_-]+)\s*\n([\s\S]*?)```/g;
  const out: TableDef[] = [];
  for (const m of cleaned.matchAll(re)) {
    out.push(parseTableBlock(m[1], m[2]));
  }
  return out;
}

export function parseSourceDoc(raw: SourceDocInput, kind: SourceDocKind): SourceDoc {
  const body = (raw.$contents as string | undefined) ?? "";
  const metaKey = META_KEYS[kind];
  const meta = (raw[metaKey] as Record<string, unknown> | undefined) ?? {};
  const parent_class = (raw[metaKey] as { parent_class?: string } | undefined)?.parent_class;

  const details: FeatureDetails[] = [];
  const options: FeatureChoiceOption[] = [];
  const unlocks: UnlockBlock[] = [];

  // Track the most recent details block so feature.level can attach without
  // needing an explicit `parent:` field.
  let currentDetails: FeatureDetails | null = null;

  for (const block of extractOrderedFeatureBlocks(body)) {
    const ctx = `feature.${block.kind} in ${raw.$name}`;
    switch (block.kind) {
      case "details": {
        const parsed = safeParse<FeatureDetails>(block.yaml, ctx);
        if (parsed) {
          // A `name:` is optional in the source. When missing, synthesize a
          // stable positional key so downstream code (pick lookups, React
          // keys, choice tracking) can still identify this block uniquely
          // within its source doc. Picks under the synthetic key persist as
          // long as block order doesn't change.
          if (!parsed.name) parsed.name = `__auto_${details.length}`;
          details.push(parsed);
          currentDetails = parsed;
        }
        break;
      }
      case "choice": {
        const parsed = safeParse<FeatureChoiceOption>(block.yaml, ctx);
        if (parsed && parsed.parent) options.push(parsed);
        break;
      }
      case "unlock": {
        const parsed = safeParse<UnlockBlock>(block.yaml, ctx);
        if (parsed && parsed.kind && typeof parsed.level === "number") {
          unlocks.push(parsed);
        }
        break;
      }
      case "level": {
        const parsed = safeParse<FeatureLevelAddition>(block.yaml, ctx);
        if (!parsed || typeof parsed.level !== "number") break;
        if (!currentDetails) {
          console.warn(
            `[parseSourceDoc] feature.level in ${raw.$name} has no preceding feature.details — skipping`,
          );
          break;
        }
        if (!currentDetails.levels) currentDetails.levels = [];
        currentDetails.levels.push(parsed);
        break;
      }
    }
  }

  // Frontmatter `.features` — alternate data source for compendium docs that
  // keep their bodies as pure markdown (so they render cleanly in Obsidian).
  // Existing rpg feature.* code blocks above remain supported; both sources
  // contribute to the same lists.
  const fmFeatures = (raw[".features"] as
    | {
        details?: FeatureDetails[];
        choices?: FeatureChoiceOption[];
        unlocks?: UnlockBlock[];
      }
    | undefined) ?? {};
  if (Array.isArray(fmFeatures.details)) {
    for (const f of fmFeatures.details) {
      if (!f) continue;
      if (!f.name) f.name = `__auto_${details.length}`;
      details.push(f);
    }
  }
  if (Array.isArray(fmFeatures.choices)) {
    for (const c of fmFeatures.choices) {
      if (c && c.parent) options.push(c);
    }
  }
  if (Array.isArray(fmFeatures.unlocks)) {
    for (const u of fmFeatures.unlocks) {
      if (u && u.kind && typeof u.level === "number") unlocks.push(u);
    }
  }

  return {
    name: raw.$name,
    kind,
    meta,
    details,
    options,
    unlocks,
    tables: extractTableBlocks(body).map((t) => ({ ...t, source: raw.$name })),
    parent_class,
  };
}

/** Convenience: parse an array of docs (one folder's worth) into a name-keyed map. */
export function parseSourceDocs(
  raws: SourceDocInput[],
  kind: SourceDocKind,
): Record<string, SourceDoc> {
  const out: Record<string, SourceDoc> = {};
  for (const raw of raws) {
    const doc = parseSourceDoc(raw, kind);
    out[doc.name] = doc;
  }
  return out;
}
