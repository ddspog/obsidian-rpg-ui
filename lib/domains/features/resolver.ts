/**
 * Pure resolver: turn a CharacterDecl + CompendiumLib into a ResolvedView.
 *
 * The resolver iterates `decl.classes` (multiclass), pulls features from each
 * class doc up to the declared level, optionally appends the subclass once its
 * unlock threshold is met, then appends lineage / heritage / background
 * sources. Each picked option (whether from a separate `feature.choice` block
 * or from an inline `choose` spec) contributes its values to the running
 * traits aggregate, and any unresolved picks bundle into `pendingChoices`.
 *
 * No I/O — fully testable from hand-rolled SourceDoc fixtures.
 */

import type {
  CharacterDecl,
  ChooseSpec,
  CompendiumLib,
  FeatureChoiceOption,
  FeatureDetails,
  PendingChoice,
  ResolvedSource,
  ResolvedView,
  SourceDoc,
  TraitMap,
  TraitValue,
} from "./types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Coerce a choice payload to `string[]` regardless of single vs multi pick. */
function pickedNames(picked: string | string[] | undefined): string[] {
  if (!picked) return [];
  return Array.isArray(picked) ? picked : [picked];
}

/**
 * Normalise a YAML-parsed trait value (or option list entry) into a flat
 * `string[]`.
 *
 * Plain strings come through unchanged. Arrays are walked recursively. The
 * `[[X]]` wikilink shape — which YAML parses as a nested flow array
 * `[["X"]]` when authored without quotes — is reconstructed back to the
 * literal `"[[X]]"` string so the rendered output keeps the link.
 */
export function normalizeTraitValue(val: unknown): string[] {
  if (val == null) return [];
  if (typeof val === "string") return [val];
  if (typeof val === "number" || typeof val === "boolean") return [String(val)];
  if (Array.isArray(val)) {
    // Detect the [[X]] flow shape: a 1-element array containing a 1-element
    // array containing a string. Only matches the leaf, so a list-of-wikilinks
    // recurses element-by-element.
    if (
      val.length === 1 &&
      Array.isArray(val[0]) &&
      val[0].length === 1 &&
      typeof val[0][0] === "string"
    ) {
      return [`[[${val[0][0]}]]`];
    }
    return val.flatMap(normalizeTraitValue);
  }
  return [];
}

/** Merge a feature/option's `traits` into the running aggregate map. */
function collectTraits(
  agg: Record<string, string[]>,
  traits: TraitMap | undefined,
): void {
  if (!traits) return;
  for (const [key, value] of Object.entries(traits)) {
    const values = normalizeTraitValue(value as TraitValue);
    if (values.length === 0) continue;
    if (!agg[key]) agg[key] = [];
    agg[key].push(...values);
  }
}

/** Strip wikilink delimiters for a clean display label inside a button. */
function stripWikilink(s: string): string {
  return s.replace(/^\[\[/, "").replace(/\]\]$/, "");
}

/**
 * Build synthetic `FeatureChoiceOption` objects for an inline `choose` spec
 * so the existing PendingChoice rendering path works uniformly.
 */
function inlineChooseOptions(
  parent: FeatureDetails,
  choose: ChooseSpec,
): FeatureChoiceOption[] {
  const opts = normalizeTraitValue(choose.options as unknown);
  return opts.map((value) => ({
    parent: parent.name,
    name: value,
    traits: { [choose.category]: value },
  }));
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
  traitsAgg: Record<string, string[]>,
  opts: ResolveOpts = {},
): ResolvedSource {
  const features: FeatureDetails[] = [];
  const pendingChoices: PendingChoice[] = [];

  for (const detail of doc.details) {
    if (opts.maxLevel != null && detail.level != null && detail.level > opts.maxLevel) {
      continue;
    }

    // Always contribute the feature's own traits.
    collectTraits(traitsAgg, detail.traits);

    // Apply per-level augmentations (feature.level blocks) whose level is met.
    if (detail.levels && detail.levels.length > 0) {
      const cap = opts.maxLevel ?? 0;
      for (const add of detail.levels) {
        if (add.level <= cap) collectTraits(traitsAgg, add.traits);
      }
    }

    // Inline choose spec — picks add values to the named trait category.
    if (detail.choose && detail.choose.type === "traits") {
      const picked = pickedNames(picksForSource?.[detail.name]);
      const cat = detail.choose.category;
      if (picked.length > 0) {
        if (!traitsAgg[cat]) traitsAgg[cat] = [];
        for (const p of picked) traitsAgg[cat].push(p);
      }
      const remaining = Math.max(0, detail.choose.number - picked.length);
      if (remaining > 0) {
        pendingChoices.push({
          source: doc.name,
          feature: detail,
          options: inlineChooseOptions(detail, detail.choose),
          picked,
          remaining,
        });
      }
    }

    // `pick` slot with separate feature.choice blocks.
    if (detail.pick != null) {
      const allOptions = doc.options.filter((o) => o.parent === detail.name);
      const picked = pickedNames(picksForSource?.[detail.name]);

      for (const pickedName of picked) {
        const option = allOptions.find((o) => (o.name ?? "") === pickedName);
        if (!option) continue;
        collectTraits(traitsAgg, option.traits);
        for (const nested of option.features ?? []) {
          collectTraits(traitsAgg, nested.traits);
          features.push(nested);
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
    }

    features.push(detail);
  }

  return {
    source: doc.name,
    kind: doc.kind,
    level,
    features,
    pendingChoices,
  };
}

// ─── Public entrypoint ────────────────────────────────────────────────────────

export function resolveFeatures(decl: CharacterDecl, lib: CompendiumLib): ResolvedView {
  const sources: ResolvedSource[] = [];
  const traits: Record<string, string[]> = {};

  for (const entry of decl.classes ?? []) {
    const classDoc = lib.classes[entry.name];
    if (!classDoc) continue;

    const classPicks = decl.choices?.[entry.name];
    sources.push(
      resolveSource(classDoc, entry.level, classPicks, traits, { maxLevel: entry.level }),
    );

    if (entry.subclass) {
      const subclassDoc = lib.subclasses[entry.subclass];
      if (subclassDoc && subclassUnlockedAt(classDoc, entry.level)) {
        const subclassPicks = decl.choices?.[entry.subclass];
        sources.push(
          resolveSource(subclassDoc, entry.level, subclassPicks, traits, { maxLevel: entry.level }),
        );
      }
    }
  }

  appendIf(sources, lib.lineages, decl.lineage, decl.choices, traits);
  appendIf(sources, lib.heritages, decl.heritage, decl.choices, traits);
  appendIf(sources, lib.backgrounds, decl.background, decl.choices, traits);

  const pendingChoices = sources.flatMap((s) => s.pendingChoices);

  return { sources, traits, pendingChoices };
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
  traitsAgg: Record<string, string[]>,
) {
  if (!name) return;
  const doc = lib[name];
  if (!doc) return;
  sources.push(resolveSource(doc, undefined, choices?.[name], traitsAgg));
}

// Re-exports for callers that touch the resolver API
export type { FeatureChoiceOption };
export { stripWikilink };
