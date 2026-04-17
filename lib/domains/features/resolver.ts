/**
 * Pure resolver: turn a CharacterDecl + CompendiumLib into a ResolvedView.
 *
 * The resolver iterates `decl.classes` (multiclass), pulls features from each
 * class doc up to the declared level, optionally appends the subclass once its
 * unlock threshold is met, then appends lineage / heritage / background
 * sources. Tagged grants are merged by tag; picked options are expanded into
 * grants and any nested features; unresolved picks bundle into `pendingChoices`.
 *
 * No I/O — fully testable from hand-rolled SourceDoc fixtures.
 */

import { groupByTag } from "./grants";
import type {
  CharacterDecl,
  CompendiumLib,
  FeatureChoiceOption,
  FeatureDetails,
  Grant,
  PendingChoice,
  ResolvedSource,
  ResolvedView,
  SourceDoc,
  SourceDocKind,
  TagId,
} from "./types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Read either `value` or `values[]` from anything that carries grant data. */
function valuesOf(f: { value?: string; values?: string[] }): string[] {
  if (f.values && f.values.length > 0) return f.values;
  if (f.value) return [f.value];
  return [];
}

/** Pick label = explicit `name`, else fallback to first `value` for simple picks. */
function optionLabel(o: FeatureChoiceOption): string {
  if (o.name) return o.name;
  const vs = valuesOf(o);
  return vs[0] ?? "(unnamed option)";
}

/** Coerce a choice payload to `string[]` regardless of single vs multi pick. */
function pickedNames(picked: string | string[] | undefined): string[] {
  if (!picked) return [];
  return Array.isArray(picked) ? picked : [picked];
}

// ─── Single-source resolution ─────────────────────────────────────────────────

interface ResolveOpts {
  /** Filter `details` by `level <= maxLevel`. Omit to include every detail. */
  maxLevel?: number;
}

function resolveSource(
  doc: SourceDoc,
  level: number | undefined,
  picksForSource: Record<string, string | string[]> | undefined,
  opts: ResolveOpts = {},
): ResolvedSource {
  const grants: Grant[] = [];
  const features: FeatureDetails[] = [];
  const pendingChoices: PendingChoice[] = [];

  for (const detail of doc.details) {
    if (opts.maxLevel != null && detail.level != null && detail.level > opts.maxLevel) {
      continue;
    }

    if (detail.pick != null) {
      const allOptions = doc.options.filter((o) => o.parent === detail.name);
      const picked = pickedNames(picksForSource?.[detail.name]);

      // Apply each picked option's grants and nested features
      for (const pickedName of picked) {
        const option = allOptions.find((o) => optionLabel(o) === pickedName);
        if (!option) continue;
        if (option.tag) {
          const vs = valuesOf(option);
          if (vs.length > 0) grants.push({ tag: option.tag, values: vs });
          else grants.push({ tag: option.tag, values: [pickedName] });
        } else if (detail.tag) {
          // Simple pick against a tagged parent (e.g. skill_proficiency)
          const vs = valuesOf(option);
          grants.push({ tag: detail.tag, values: vs.length > 0 ? vs : [pickedName] });
        }
        for (const nested of option.features ?? []) {
          if (nested.tag) {
            const vs = valuesOf(nested);
            if (vs.length > 0) grants.push({ tag: nested.tag, values: vs });
          } else {
            features.push(nested);
          }
        }
      }

      const remaining = Math.max(0, detail.pick - picked.length);
      if (remaining > 0) {
        pendingChoices.push({
          source: doc.name,
          feature: detail,
          options: allOptions,
          picked,
          remaining,
        });
      }
      continue;
    }

    if (detail.tag) {
      const vs = valuesOf(detail);
      if (vs.length > 0) grants.push({ tag: detail.tag, values: vs });
      continue;
    }

    features.push(detail);
  }

  return {
    source: doc.name,
    kind: doc.kind,
    level,
    grants: groupByTag(grants),
    features,
    pendingChoices,
  };
}

// ─── Public entrypoint ────────────────────────────────────────────────────────

export function resolveFeatures(decl: CharacterDecl, lib: CompendiumLib): ResolvedView {
  const sources: ResolvedSource[] = [];

  for (const entry of decl.classes ?? []) {
    const classDoc = lib.classes[entry.name];
    if (!classDoc) continue;

    const classPicks = decl.choices?.[entry.name];
    sources.push(resolveSource(classDoc, entry.level, classPicks, { maxLevel: entry.level }));

    if (entry.subclass) {
      const subclassDoc = lib.subclasses[entry.subclass];
      if (subclassDoc && subclassUnlockedAt(classDoc, entry.level)) {
        const subclassPicks = decl.choices?.[entry.subclass];
        sources.push(
          resolveSource(subclassDoc, entry.level, subclassPicks, { maxLevel: entry.level }),
        );
      }
    }
  }

  appendIf(sources, lib.lineages, decl.lineage, decl.choices);
  appendIf(sources, lib.heritages, decl.heritage, decl.choices);
  appendIf(sources, lib.backgrounds, decl.background, decl.choices);

  const pendingChoices = sources.flatMap((s) => s.pendingChoices);

  return { sources, pendingChoices };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function subclassUnlockedAt(classDoc: SourceDoc, level: number): boolean {
  const unlock = classDoc.unlocks.find((u) => u.kind === "subclass");
  if (!unlock) return true;
  return level >= unlock.level;
}

function appendIf(
  sources: ResolvedSource[],
  lib: Record<string, SourceDoc>,
  name: string | undefined,
  choices: CharacterDecl["choices"],
) {
  if (!name) return;
  const doc = lib[name];
  if (!doc) return;
  sources.push(resolveSource(doc, undefined, choices?.[name]));
}

// Re-export TagId for convenience
export type { TagId };
