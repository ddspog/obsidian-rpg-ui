/**
 * Parse a single compendium document (Cleric.md, Human.md, …) into a SourceDoc.
 *
 * Boundary between vault I/O and the pure resolver. The input is a
 * `WikiFileDescriptor` as produced by `wiki.folder()`/`wiki.file()` — body text
 * lives in `$contents`, frontmatter keys are spread on top.
 *
 * We extract `rpg feature.details`, `rpg feature.choice`, `rpg feature.unlock`
 * code blocks from the body and parse each one's YAML payload.
 */

import { parse as parseYaml } from "yaml";
import { extractCodeBlocks } from "../../utils/codeblock-extractor";
import type {
  FeatureChoiceOption,
  FeatureDetails,
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

export function parseSourceDoc(raw: SourceDocInput, kind: SourceDocKind): SourceDoc {
  const body = (raw.$contents as string | undefined) ?? "";
  const metaKey = META_KEYS[kind];
  const meta = (raw[metaKey] as Record<string, unknown> | undefined) ?? {};
  const parent_class = (raw[metaKey] as { parent_class?: string } | undefined)?.parent_class;

  const details: FeatureDetails[] = [];
  for (const yaml of extractCodeBlocks(body, "rpg feature.details")) {
    const parsed = safeParse<FeatureDetails>(yaml, `feature.details in ${raw.$name}`);
    if (parsed && parsed.name) details.push(parsed);
  }

  const options: FeatureChoiceOption[] = [];
  for (const yaml of extractCodeBlocks(body, "rpg feature.choice")) {
    const parsed = safeParse<FeatureChoiceOption>(yaml, `feature.choice in ${raw.$name}`);
    if (parsed && parsed.parent) options.push(parsed);
  }

  const unlocks: UnlockBlock[] = [];
  for (const yaml of extractCodeBlocks(body, "rpg feature.unlock")) {
    const parsed = safeParse<UnlockBlock>(yaml, `feature.unlock in ${raw.$name}`);
    if (parsed && parsed.kind && typeof parsed.level === "number") unlocks.push(parsed);
  }

  return {
    name: raw.$name,
    kind,
    meta,
    details,
    options,
    unlocks,
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
