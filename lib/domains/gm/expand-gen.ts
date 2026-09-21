/**
 * Expand a called generator's cross-file `emits:` composition.
 *
 * `calls:` (a step handing off to a generator) lays that generator's steps out
 * as `+ ` children. When the called generator has no `steps:` of its own but
 * `emits:` other generators (e.g. Random Event = Event Focus + Event Meaning),
 * those sub-generators live in OTHER files, so their steps must be resolved and
 * flattened here — one flat child list under the caller. Depth/cycle guarded.
 *
 * Pure of Obsidian: the caller supplies `readFeatures(target)` (the linked
 * file's GM features). Alongside the flattened steps it returns the touched
 * files' step blocks (for a `choices` step's pick map) and their `reads:`-bearing
 * features (for list imports) so the loader can wire the full context.
 */

import type { GMFeature, GMGenStep, GMGeneratorAspect } from "../features/types";
import { generatorSteps } from "./emit";
import { parseBranchRef } from "./steps";
import { selectGenerator } from "./card-refs";

const MAX_EMIT_DEPTH = 6;

export interface ExpandedGen {
  /** The flattened working steps — the generator's own plus every emitted
   *  sub-generator's, in emit order. */
  steps: GMGenStep[];
  /** Step blocks declared in the files touched, for a `choices` step's pick map
   *  (e.g. Event Meaning's Meaning Tables word-pair choices). */
  stepBlocks: GMFeature[];
  /** Features carrying `reads:` in the files touched, for importing their lists
   *  (e.g. Event Focus `reads:` Characters / Threads). */
  readsFeatures: GMFeature[];
}

/**
 * Flatten `gen`'s steps, recursively following its cross-file `emits:` refs
 * (`@[[File]]#id`). A generator with only `emits:` contributes its sub-gens'
 * steps; a plain `steps:` generator returns them unchanged (backward compatible).
 */
export async function expandCalledGenerator(
  gen: GMGeneratorAspect,
  readFeatures: (target: string) => Promise<GMFeature[] | null>,
  seen: Set<string> = new Set(),
  depth = 0
): Promise<ExpandedGen> {
  const out: ExpandedGen = { steps: [...generatorSteps(gen)], stepBlocks: [], readsFeatures: [] };
  if (depth >= MAX_EMIT_DEPTH || !gen.emits) return out;
  for (const piece of gen.emits) {
    if (typeof piece !== "string") continue;
    const ref = parseBranchRef(piece); // cross-file `@[[File]]#id` only (locals skipped)
    if (!ref) continue;
    const key = `${ref.target}#${ref.block ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const features = await readFeatures(ref.target);
    if (!features) continue;
    out.readsFeatures.push(...features);
    out.stepBlocks.push(...features.filter((f) => (f.steps?.length ?? 0) > 0));
    const sub = selectGenerator(features, ref.block);
    if (!sub) continue;
    const nested = await expandCalledGenerator(sub, readFeatures, seen, depth + 1);
    out.steps.push(...nested.steps);
    out.stepBlocks.push(...nested.stepBlocks);
    out.readsFeatures.push(...nested.readsFeatures);
  }
  return out;
}
