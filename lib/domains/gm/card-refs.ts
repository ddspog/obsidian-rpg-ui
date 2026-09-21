/**
 * Cross-file card `@ref` resolution.
 *
 * A card's `emits` may carry an `@ref` string: a LOCAL `@id` (a `generators:`
 * entry on the same feature — resolved in ./emit) or a CROSS-FILE
 * `@[[File]]#id` pointing at a generator in another tool page. The load layer
 * reads the target file and hands the resolved generator aspects to
 * {@link inlineCardXFileRefs}, which appends them to the feature's `generators:`
 * and rewrites the matching emit strings to their new local `@id` — after which
 * ./emit's `emitCard` treats them like any local ref.
 *
 * Pure: no Obsidian / vault. The render layer performs the actual file reads.
 */

import type { EmitPiece, GMFeature, GMGeneratorAspect, NamedGenerator } from "../features/types";
import { parseBranchRef } from "./steps";

/**
 * Pick a generator aspect from a page's features by id: a `generators:` entry
 * whose id matches, else the feature whose own `id:` matches (using its
 * `generator:` aspect). With no id, the single generator-bearing feature, if
 * unambiguous. Null when absent.
 */
export function selectGenerator(features: GMFeature[], id?: string): GMGeneratorAspect | null {
  if (!id) {
    const withGen = features.filter((f) => f.generator);
    return withGen.length === 1 ? withGen[0].generator ?? null : null;
  }
  for (const f of features) {
    const named = f.generators?.find((g) => g.id === id);
    if (named) return named;
  }
  for (const f of features) {
    if (f.id === id && f.generator) return f.generator;
  }
  return null;
}

/** Every emit list in a feature — each card's `emits` and each generator's
 *  `emits` (generators may compose other generators). */
function emitLists(feature: GMFeature): EmitPiece[][] {
  const lists: EmitPiece[][] = [];
  for (const c of feature.cards ?? []) lists.push(c.emits);
  for (const g of feature.generators ?? []) if (g.emits) lists.push(g.emits);
  return lists;
}

/**
 * The distinct cross-file generator refs (`@[[File]]#id`) a feature emits —
 * across both card `emits` and generator `emits` — as opposed to a local `@id`
 * or an inline piece.
 */
export function cardXFileRefs(feature: GMFeature): string[] {
  const out = new Set<string>();
  for (const list of emitLists(feature)) {
    for (const p of list) {
      if (typeof p === "string" && parseBranchRef(p)) out.add(p.trim());
    }
  }
  return [...out];
}

/**
 * Inline resolved cross-file refs into a feature: each resolved ref becomes a
 * synthesized `generators:` entry (a stable local id), and every matching emit
 * string — in cards AND generators — is rewritten to that local `@id`.
 * Unresolved refs stay as-is (emitCard drops them). Pure — the caller supplies
 * the resolved map (ref → generator).
 */
export function inlineCardXFileRefs(
  feature: GMFeature,
  resolved: Record<string, GMGeneratorAspect>
): GMFeature {
  const refs = cardXFileRefs(feature).filter((r) => resolved[r]);
  if (refs.length === 0) return feature;
  const rename: Record<string, string> = {};
  const xrefGens: NamedGenerator[] = refs.map((ref, i) => {
    const id = `xref-${i}`;
    rename[ref] = `@${id}`;
    return { ...resolved[ref], id };
  });
  const rewrite = (list: EmitPiece[]): EmitPiece[] =>
    list.map((p) => (typeof p === "string" && rename[p.trim()] ? rename[p.trim()] : p));
  const generators: NamedGenerator[] = [
    ...(feature.generators ?? []).map((g) => (g.emits ? { ...g, emits: rewrite(g.emits) } : g)),
    ...xrefGens,
  ];
  const cards = (feature.cards ?? []).map((c) => ({ ...c, emits: rewrite(c.emits) }));
  return { ...feature, generators, cards };
}
