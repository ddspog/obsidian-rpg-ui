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

import type { TableDef } from "../tables/types";
import { expandOptionRefs } from "./index-builder";
import { stripWikilinkToName } from "./spellcasting";
import type {
  CharacterDecl,
  ChooseSpec,
  CompendiumLib,
  ExtraRef,
  FeatureAspect,
  FeatureChoiceOption,
  FeatureDetails,
  PendingChoice,
  ResolvedCaster,
  ResolvedSource,
  ResolvedView,
  SourceDoc,
  SourceDocKind,
  SpellcastingFragment,
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
  if (typeof val === "number") return [String(val)];
  // Boolean trait values: `true` marks the key as present without any
  // value ("bare flag" traits like `Initiative A.: true`). It lands in
  // the trait map as an empty-string entry so downstream consumers see
  // the key exists; the display layer skips the value parens when all
  // entries are empty. `false` drops the trait entirely.
  if (typeof val === "boolean") return val ? [""] : [];
  if (Array.isArray(val)) {
    // Detect the [[X]] flow shape: a 1-element array containing a 1-element
    // array containing a string. Only matches the leaf, so a list-of-wikilinks
    // recurses element-by-element.
    if (val.length === 1 && Array.isArray(val[0]) && val[0].length === 1 && typeof val[0][0] === "string") {
      return [`[[${val[0][0]}]]`];
    }
    return val.flatMap(normalizeTraitValue);
  }
  return [];
}

/** Merge a feature/option's `traits` into the running aggregate map. */
function collectTraits(agg: Record<string, string[]>, traits: TraitMap | undefined): void {
  if (!traits) return;
  for (const [key, value] of Object.entries(traits)) {
    const values = normalizeTraitValue(value as TraitValue);
    // `normalizeTraitValue` returns `[""]` for a bare-flag trait
    // (`Key: true`). Pushing an empty string still marks the key as
    // present so consumers can check existence without matching any
    // meaningful value. An entirely empty array is the `false` case —
    // drop it.
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
 *
 * If `tagIndex` / `folderIndex` are provided, `#Tag` and `@folder/path`
 * entries in `choose.options` are expanded to the concrete `[[Item]]`
 * wikilinks those refs resolve to. Literal strings pass through untouched.
 */
function inlineChooseOptions(
  parent: FeatureDetails,
  choose: ChooseSpec,
  tagIndex?: Record<string, string[]>,
  folderIndex?: Record<string, string[]>
): FeatureChoiceOption[] {
  const raw = normalizeTraitValue(choose.options as unknown);
  // Defaults for typed-but-optionless choose specs:
  //   - `asi`    → the six core attributes
  //   - `talent` → every talent in the compendium (expanded via
  //                folderIndex's `compendium/talents` key)
  let withDefault = raw;
  if (raw.length === 0) {
    if (choose.type === "asi") withDefault = DEFAULT_ASI_OPTIONS;
    else if (choose.type === "talent") withDefault = ["@compendium/talents"];
  }
  const opts = expandOptionRefs(withDefault, tagIndex, folderIndex);
  const cat = resolveCategory(choose);
  return opts.map((value) => ({
    parent: parent.name,
    name: value,
    traits: { [cat]: value },
  }));
}

const DEFAULT_ASI_OPTIONS: string[] = ["Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma"];

/** Category a choose spec contributes to. `traits` requires an explicit
 *  `category`; `asi` falls back to "Ability Scores" and `talent` to
 *  "Talent" for display. */
function resolveCategory(choose: ChooseSpec): string {
  if (choose.category) return choose.category;
  if (choose.type === "asi") return "Ability Scores";
  if (choose.type === "talent") return "Talent";
  if (choose.type === "spellcasting") return "Spellcasting";
  return "";
}

/** Format a single pick value for its trait category. `asi` picks are
 *  prefixed with `+{quantity}` and their wikilink delimiters are stripped
 *  so the trait reads as `+2 Wisdom` rather than `+2 [[Wisdom]]`. */
function formatPickValue(choose: ChooseSpec, pick: string): string {
  if (choose.type !== "asi") return pick;
  const qty = choose.quantity ?? 1;
  return `+${qty} ${stripWikilink(pick)}`;
}

// ─── Single-source resolution ─────────────────────────────────────────────────

interface ResolveOpts {
  /** Filter `details` by `level <= maxLevel`. Omit to include every detail. */
  maxLevel?: number;
  /** Index of `#Tag` → `"[[Item]]"` wikilinks for expanding `choose.options`. */
  tagIndex?: Record<string, string[]>;
  /** Index of `@folder/path` → `"[[Item]]"` wikilinks for expanding `choose.options`. */
  folderIndex?: Record<string, string[]>;
  /** Talent library — parsed compendium docs for each talent, keyed by its
   *  basename. Looked up when a `type: "talent"` pick lands, so the talent's
   *  feature.details blocks can be spread into the picking source. */
  talents?: Record<string, SourceDoc>;
}

function resolveSource(
  doc: SourceDoc,
  level: number | undefined,
  picksForSource: Record<string, string | string[]> | undefined,
  traitsAgg: Record<string, string[]>,
  opts: ResolveOpts = {}
): ResolvedSource {
  const features: FeatureDetails[] = [];
  const pendingChoices: PendingChoice[] = [];
  // Per-source traits, split so the character-sheet traits bucket can show
  // unlevelled class rules on one line and leveled features (Spellcasting,
  // Channel Divinity, …) as a bulleted sub-list beneath.
  const baseTraits: Record<string, string[]> = {};
  const leveledTraits: Record<string, string[]> = {};
  // Per-level breakdown. Unlevelled features bucket at level 1 (you gain
  // them when you take the class); levelled features bucket at their own
  // level; `feature.level` augmentations bucket at the augmentation's level.
  const traitsByLevel: Record<number, Record<string, string[]>> = {};
  // Set when any detail on this source declared `choose: { type:
  // "spellcasting", category: "ability" }`. Empty string means declared
  // but not yet picked — still enough to flag the source as wanting its
  // own standalone caster via `resolveCasters`.
  let spellcastingAbilityPick: string | undefined;

  // Normalise a feature's declared level into a single number for bucketing.
  // `level` may be an array when a feature repeats across levels (e.g.
  // Improvement at 4/8/12/…); we collapse to the smallest applicable level
  // at or below the character's cap so the row shows up the turn the
  // feature first unlocks. Features without a `level:` return `undefined`
  // so their traits stay on the source's base line rather than being
  // coerced into a Lv. 1 bucket.
  const levelKeyFor = (l: number | number[] | undefined): number | undefined => {
    if (l == null) return undefined;
    if (Array.isArray(l)) {
      const nums = l.filter((n): n is number => typeof n === "number");
      if (nums.length === 0) return undefined;
      const cap = opts.maxLevel ?? Infinity;
      const applicable = nums.filter((n) => n <= cap);
      return applicable.length > 0 ? Math.min(...applicable) : Math.min(...nums);
    }
    return l;
  };

  const collectAtLevel = (lvl: number | undefined, traits: TraitMap | undefined) => {
    if (!traits || lvl == null) return;
    const bucket = (traitsByLevel[lvl] ??= {});
    collectTraits(bucket, traits);
  };

  /**
   * Spread a picked talent's feature.details into the current source,
   * attributing every rendered card + trait contribution to the picking
   * detail's level. Called when a `type: "talent"` pick lands — the talent
   * itself lives as a standalone compendium doc (`lib.talents[name]`),
   * but its content "flows" into whichever source granted the talent
   * pick (class level, background, lineage, …).
   */
  const applyTalentPick = (pickedName: string, hostDetail: FeatureDetails) => {
    const talentLib = opts.talents ?? {};
    const bareName = pickedName.replace(/^\[\[|\]\]$/g, "").split("|")[0];
    const talentDoc = talentLib[bareName];
    if (!talentDoc) return;
    const hostLevel = levelKeyFor(hostDetail.level);
    const perHost: Record<string, string[]> = hostDetail.level != null ? leveledTraits : baseTraits;
    for (const talentDetail of talentDoc.details) {
      const synthetic: FeatureDetails = {
        ...talentDetail,
        // Fall back to the talent file's basename when the feature.details
        // block was authored without a `name:` field (parser synthesises
        // `__auto_N` internal keys that shouldn't leak to the UI).
        name: talentDetail.name && !talentDetail.name.startsWith("__auto_") ? talentDetail.name : bareName,
        // Inherit the host detail's level so the talent's traits and card
        // show up alongside the feature that unlocked it.
        level: hostDetail.level,
      };
      features.push(synthetic);
      collectTraits(perHost, talentDetail.traits);
      collectTraits(traitsAgg, talentDetail.traits);
      collectAtLevel(hostLevel, talentDetail.traits);
      // Per-level augmentations on the talent use their own level keys.
      if (talentDetail.levels && talentDetail.levels.length > 0) {
        const cap = opts.maxLevel ?? 0;
        for (const add of talentDetail.levels) {
          if (add.level <= cap) {
            collectTraits(leveledTraits, add.traits);
            collectTraits(traitsAgg, add.traits);
            collectAtLevel(add.level, add.traits);
          }
        }
      }
    }
  };

  // Expand multi-level pick features into one synthetic detail per
  // applicable level so the user gets a separate pending choice at each
  // unlock. Without this, a feature like Cleric's Improvement (lv 4, 8,
  // 12, 16, 19) would only ever expose a single pick slot. The synthetic
  // name suffixes the level (`Improvement@8`) so persisted picks stay
  // independent across levels; option lookup still happens against the
  // base name so the same `feature.choice` blocks apply to every
  // iteration.
  const expandedDetails: FeatureDetails[] = [];
  for (const detail of doc.details) {
    if (Array.isArray(detail.level) && detail.pick != null) {
      const cap = opts.maxLevel ?? Infinity;
      const levels = detail.level
        .filter((n): n is number => typeof n === "number")
        .filter((n) => n <= cap)
        .sort((a, b) => a - b);
      if (levels.length === 0) continue;
      for (const lv of levels) {
        expandedDetails.push({ ...detail, name: `${detail.name}@${lv}`, level: lv });
      }
    } else {
      expandedDetails.push(detail);
    }
  }

  for (const detail of expandedDetails) {
    if (opts.maxLevel != null && detail.level != null) {
      const detailLevel = Array.isArray(detail.level)
        ? Math.min(...(detail.level.filter((n) => typeof n === "number") as number[]))
        : detail.level;
      if (detailLevel > opts.maxLevel) continue;
    }

    // Features that carry an explicit `level:` belong to the "leveled" bucket
    // for the source (and stay there even at level 1 — authors use `level:`
    // to mark a feature as a named per-level ability). Unlevelled features
    // (the base class rules: hit points, armor, saves…) go in `baseTraits`.
    const perSource: Record<string, string[]> = detail.level != null ? leveledTraits : baseTraits;
    const detailLevelKey = levelKeyFor(detail.level);

    // Contribute the feature's own traits to both the per-source bucket and
    // the global aggregate.
    collectTraits(perSource, detail.traits);
    collectTraits(traitsAgg, detail.traits);
    collectAtLevel(detailLevelKey, detail.traits);

    // Apply per-level augmentations (feature.level blocks) whose level is met.
    // These always belong to the leveled bucket since they only apply past the
    // feature's own declaration level.
    if (detail.levels && detail.levels.length > 0) {
      const cap = opts.maxLevel ?? 0;
      for (const add of detail.levels) {
        if (add.level <= cap) {
          collectTraits(leveledTraits, add.traits);
          collectTraits(traitsAgg, add.traits);
          collectAtLevel(add.level, add.traits);
        }
      }
    }

    // Inline choose spec — picks add values to the named trait category.
    // `detail.choose` may be a single spec or an array of specs; each spec
    // tracks its own picks under a distinct pick key so they don't overwrite
    // one another.
    const rawChoose = detail.choose;
    const chooseSpecs: ChooseSpec[] = Array.isArray(rawChoose) ? rawChoose : rawChoose ? [rawChoose] : [];
    const multiChoose = chooseSpecs.length > 1;
    // When a detail has a `buy:` budget, the buy-mode picker stores its
    // picks under the bare `detail.name` key. If we also keyed the
    // inline `choose:` picks the same way they'd collide with the buy
    // picks (option names leaking into whichever category the choose
    // targets). Force the composite `name:category` key in that case
    // so the two pick buckets stay independent.
    const useCompositeChooseKey = multiChoose || detail.buy != null;
    for (const spec of chooseSpecs) {
      if (spec.type === "spellcasting") {
        // Standalone-caster ability pick (Acolyte-style heritages).
        // Category defaults to "Spellcasting" / "ability"; anything else
        // is ignored for now. Picks store on the source via
        // `spellcastingAbilityPick` so `resolveCasters` can fold them
        // into the caster's `ability` field.
        const cat = resolveCategory(spec);
        const chooseKey = useCompositeChooseKey ? `${detail.name}:${cat}` : detail.name;
        const picked = pickedNames(picksForSource?.[chooseKey]);
        const category = (spec.category ?? "").toLowerCase();
        if (category === "ability" || category === "" || category === "spellcasting") {
          // Record the first pick (single-select semantics — `number: 1`).
          spellcastingAbilityPick = picked[0] ?? "";
        }
        const remaining = Math.max(0, spec.number - picked.length);
        if (remaining > 0) {
          const specWithCat: ChooseSpec = { ...spec, category: cat };
          const featureForPending: FeatureDetails = useCompositeChooseKey
            ? { ...detail, name: chooseKey, choose: specWithCat }
            : { ...detail, choose: specWithCat };
          pendingChoices.push({
            source: doc.name,
            feature: featureForPending,
            options: inlineChooseOptions(featureForPending, spec, opts.tagIndex, opts.folderIndex),
            picked,
            remaining,
          });
        }
        continue;
      }
      if (spec.type !== "traits" && spec.type !== "asi" && spec.type !== "talent") continue;
      const cat = resolveCategory(spec);
      const chooseKey = useCompositeChooseKey ? `${detail.name}:${cat}` : detail.name;
      const picked = pickedNames(picksForSource?.[chooseKey]);
      if (picked.length > 0) {
        if (!perSource[cat]) perSource[cat] = [];
        if (!traitsAgg[cat]) traitsAgg[cat] = [];
        const values: string[] = [];
        for (const p of picked) {
          const val = formatPickValue(spec, p);
          perSource[cat].push(val);
          traitsAgg[cat].push(val);
          values.push(val);
          // `talent` picks: spread the picked talent doc's features into
          // this source attributed to the hosting detail's level.
          if (spec.type === "talent") applyTalentPick(p, detail);
        }
        collectAtLevel(detailLevelKey, { [cat]: values });
      }
      const remaining = Math.max(0, spec.number - picked.length);
      if (remaining > 0) {
        // For multi-spec blocks we emit a synthetic per-spec feature so the
        // pending row's React key, toggle identity, and display can tell the
        // specs apart. Single-spec keeps the original detail for continuity.
        // Attach the resolved category onto the spec so the UI can detect
        // `"parent:category"` composite names and strip them for display,
        // even when the author didn't set `category:` explicitly.
        const specWithCat: ChooseSpec = { ...spec, category: cat };
        const featureForPending: FeatureDetails = useCompositeChooseKey
          ? { ...detail, name: chooseKey, choose: specWithCat }
          : { ...detail, choose: specWithCat };
        pendingChoices.push({
          source: doc.name,
          feature: featureForPending,
          options: inlineChooseOptions(featureForPending, spec, opts.tagIndex, opts.folderIndex),
          picked,
          remaining,
        });
      }
    }

    // `pick` slot with separate feature.choice blocks.
    if (detail.pick != null) {
      // For multi-level features (Improvement, etc.) the detail name was
      // suffixed with `@<level>` so each level gets its own pick slot.
      // Options still match the base name authored on the choice blocks,
      // and sub-pick keys carry the same suffix so per-level option picks
      // (e.g. ASI selections at Lv 4 vs Lv 8) stay independent.
      const at = detail.name.lastIndexOf("@");
      const baseName = at >= 0 && /^\d+$/.test(detail.name.slice(at + 1)) ? detail.name.slice(0, at) : detail.name;
      const suffix = baseName !== detail.name ? detail.name.slice(at) : "";
      const allOptions = doc.options.filter((o) => o.parent === baseName);
      const picked = pickedNames(picksForSource?.[detail.name]);

      for (const pickedName of picked) {
        const option = allOptions.find((o) => (o.name ?? "") === pickedName);
        if (!option) continue;
        collectTraits(perSource, option.traits);
        collectTraits(traitsAgg, option.traits);
        collectAtLevel(detailLevelKey, option.traits);

        // Convert the picked option into a FeatureDetails and push it so its
        // aspects (action/passive/reaction/…), text, and traits show up in
        // the accordion's bucketed display. Spreading brings aspect
        // sub-objects through even though `FeatureChoiceOption` doesn't
        // declare them — authors place them alongside the YAML's top-level
        // keys and we preserve them verbatim.
        const optionFeature: FeatureDetails = {
          ...(option as unknown as FeatureDetails),
          name: option.name ?? pickedName,
          level: detail.level,
        };
        features.push(optionFeature);

        // A picked option may carry its own inline `choose` — a sub-pick that
        // fires after the user takes the option. Example: Manifest Might →
        // "pick 1 Martial weapon"; Talented Growth → "+1 ASI" + "pick 1
        // talent". `choose` may be a single spec or an array of specs; each
        // spec gets its own pick slot so multi-spec arrays don't collapse
        // into a single hidden talent/asi pick.
        const optChoose = option.choose;
        const optSpecs: ChooseSpec[] = Array.isArray(optChoose) ? optChoose : optChoose ? [optChoose] : [];
        const optMulti = optSpecs.length > 1;
        if (option.name) {
          for (const subSpec of optSpecs) {
            if (subSpec.type !== "traits" && subSpec.type !== "asi" && subSpec.type !== "talent") continue;
            const subCat = resolveCategory(subSpec);
            // Single-spec keeps the historical `option.name` key so persisted
            // picks stay backward-compatible. Multi-spec suffixes the spec's
            // category to keep specs distinguishable inside the same option.
            const baseSubKey: string = optMulti ? `${option.name}:${subCat}` : option.name;
            const optionKey = `${baseSubKey}${suffix}`;
            const subPicked = pickedNames(picksForSource?.[optionKey]);
            if (subPicked.length > 0) {
              if (!perSource[subCat]) perSource[subCat] = [];
              if (!traitsAgg[subCat]) traitsAgg[subCat] = [];
              const subValues: string[] = [];
              for (const p of subPicked) {
                const val = formatPickValue(subSpec, p);
                perSource[subCat].push(val);
                traitsAgg[subCat].push(val);
                subValues.push(val);
                // `talent` picks: spread the talent doc's features into this
                // source, attributed to the host detail's level (e.g. Cleric's
                // Improvement at Lv. 4 → picked talent's card shows at Lv. 4).
                if (subSpec.type === "talent") applyTalentPick(p, detail);
              }
              collectAtLevel(detailLevelKey, { [subCat]: subValues });
            }
            const subRemaining = Math.max(0, subSpec.number - subPicked.length);
            if (subRemaining > 0) {
              // Attach the resolved category onto the spec so the UI can
              // recognise composite `parent:cat` names and strip them for
              // display. The pending feature's `name` carries the full
              // suffixed key so the pending row maps cleanly back to its
              // pick slot in the choices map.
              const subSpecWithCat: ChooseSpec = { ...subSpec, category: subCat };
              pendingChoices.push({
                source: doc.name,
                feature: { ...optionFeature, name: optionKey, choose: subSpecWithCat },
                options: inlineChooseOptions(optionFeature, subSpec, opts.tagIndex, opts.folderIndex),
                picked: subPicked,
                remaining: subRemaining,
              });
            }
          }
        }

        for (const nested of option.features ?? []) {
          collectTraits(perSource, nested.traits);
          collectTraits(traitsAgg, nested.traits);
          collectAtLevel(detailLevelKey, nested.traits);
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

    // `buy` budget: options carry per-item `cost` and the user may pick any
    // combination whose cost sum ≤ the numeric value of `buy`. Mutually
    // exclusive with `pick` — a feature declares one or the other. The
    // pending choice is always emitted (no slot-gate like `pick`) so the
    // player can keep spending remaining points across render cycles; the
    // UI block evaluates `buy` against the character's EvalContext to get
    // the actual budget and disables options whose cost exceeds what's
    // left.
    if (detail.buy != null && detail.pick == null) {
      const allOptions = doc.options.filter((o) => o.parent === detail.name);
      const picked = pickedNames(picksForSource?.[detail.name]);
      for (const pickedName of picked) {
        const option = allOptions.find((o) => (o.name ?? "") === pickedName);
        if (!option) continue;
        collectTraits(perSource, option.traits);
        collectTraits(traitsAgg, option.traits);
        collectAtLevel(detailLevelKey, option.traits);
        const optionFeature: FeatureDetails = {
          ...(option as unknown as FeatureDetails),
          name: option.name ?? pickedName,
          level: detail.level,
        };
        features.push(optionFeature);

        // A picked buy option may carry its own inline `choose` — e.g.
        // Twisted Minion's "Knowledge Implant, Skills" grants one
        // proficiency from a list. Mirrors the pick-mode sub-choose
        // handling so buy options fire sub-picks the same way.
        const optChoose = option.choose;
        const optSpecs: ChooseSpec[] = Array.isArray(optChoose) ? optChoose : optChoose ? [optChoose] : [];
        const optMulti = optSpecs.length > 1;
        if (option.name) {
          for (const subSpec of optSpecs) {
            if (subSpec.type !== "traits" && subSpec.type !== "asi" && subSpec.type !== "talent") continue;
            const subCat = resolveCategory(subSpec);
            const optionKey = optMulti ? `${option.name}:${subCat}` : option.name;
            const subPicked = pickedNames(picksForSource?.[optionKey]);
            if (subPicked.length > 0) {
              if (!perSource[subCat]) perSource[subCat] = [];
              if (!traitsAgg[subCat]) traitsAgg[subCat] = [];
              const subValues: string[] = [];
              for (const p of subPicked) {
                const val = formatPickValue(subSpec, p);
                perSource[subCat].push(val);
                traitsAgg[subCat].push(val);
                subValues.push(val);
                if (subSpec.type === "talent") applyTalentPick(p, detail);
              }
              collectAtLevel(detailLevelKey, { [subCat]: subValues });
            }
            const subRemaining = Math.max(0, subSpec.number - subPicked.length);
            if (subRemaining > 0) {
              const subSpecWithCat: ChooseSpec = { ...subSpec, category: subCat };
              pendingChoices.push({
                source: doc.name,
                feature: { ...optionFeature, name: optionKey, choose: subSpecWithCat },
                options: inlineChooseOptions(optionFeature, subSpec, opts.tagIndex, opts.folderIndex),
                picked: subPicked,
                remaining: subRemaining,
              });
            }
          }
        }

        for (const nested of option.features ?? []) {
          collectTraits(perSource, nested.traits);
          collectTraits(traitsAgg, nested.traits);
          collectAtLevel(detailLevelKey, nested.traits);
          features.push(nested);
        }
      }
      // Strip the detail's own `choose:` off the pending's feature — that
      // inline choose is a SIBLING pending (rendered as a traits picker)
      // and shouldn't leak into the buy emission, whose `feature.choose`
      // the UI uses as a signal that this is a plain traits pick. Without
      // the strip, both pendings would look identical to the renderer.
      const buyFeature: FeatureDetails = { ...detail };
      delete buyFeature.choose;
      // `remaining` is cosmetic for buy-mode choices — the UI recomputes
      // spent/available from cost sums against the evaluated budget.
      pendingChoices.push({
        source: doc.name,
        feature: buyFeature,
        options: allOptions,
        picked,
        remaining: allOptions.length,
      });
    }

    features.push(detail);
  }

  return {
    source: doc.name,
    kind: doc.kind,
    level,
    features,
    pendingChoices,
    baseTraits,
    leveledTraits,
    traitsByLevel,
    spellcastingAbilityPick,
  };
}

// ─── Public entrypoint ────────────────────────────────────────────────────────

export function resolveFeatures(decl: CharacterDecl, lib: CompendiumLib): ResolvedView {
  const sources: ResolvedSource[] = [];
  const traits: Record<string, string[]> = {};
  const tagIndex = lib.tagIndex;
  const folderIndex = lib.folderIndex;
  const talents = lib.talents;

  for (const entry of decl.classes ?? []) {
    const classDoc = lib.classes[entry.name];
    if (!classDoc) continue;

    const classPicks = decl.choices?.[entry.name];
    sources.push(
      resolveSource(classDoc, entry.level, classPicks, traits, {
        maxLevel: entry.level,
        tagIndex,
        folderIndex,
        talents,
      })
    );

    if (entry.subclass) {
      const subclassDoc = lib.subclasses[entry.subclass];
      if (subclassDoc && subclassUnlockedAt(classDoc, entry.level)) {
        const subclassPicks = decl.choices?.[entry.subclass];
        sources.push(
          resolveSource(subclassDoc, entry.level, subclassPicks, traits, {
            maxLevel: entry.level,
            tagIndex,
            folderIndex,
            talents,
          })
        );
      }
    }
  }

  appendIf(sources, lib.lineages, decl.lineage, decl.choices, traits, tagIndex, folderIndex, talents);
  appendIf(sources, lib.heritages, decl.heritage, decl.choices, traits, tagIndex, folderIndex, talents);
  appendIf(sources, lib.backgrounds, decl.background, decl.choices, traits, tagIndex, folderIndex, talents);

  applyAdditional(sources, decl.additional, talents, traits);

  // Apply `update:` patches: progression features (e.g. Cleric Greater
  // Preservation at Lv 11) declare an `update:` block that rewrites an
  // aspect on a previously-loaded feature (Preserve Life's action). Run
  // this after every source has been resolved so updates can reach
  // features in any earlier source, then pull the update-carriers out of
  // the rendered list — they exist only to deliver the patch and
  // shouldn't render their own card.
  applyFeatureUpdates(sources);

  // Fold every source's `spellcasting:` fragments into at most one
  // ResolvedCaster per source. Emitted after updates run so a source's
  // Spellcasting feature can itself be update-patched (rare but legal).
  const casters = resolveCasters(sources, decl);

  const pendingChoices = sources.flatMap((s) => s.pendingChoices);
  const tables = aggregateTables(decl, lib);

  return { sources, traits, pendingChoices, tables, casters };
}

const ASPECT_KEYS = ["action", "bonus", "reaction", "active", "passive", "resource"] as const;

/**
 * Fold every `spellcasting:` fragment in a source into a single
 * ResolvedCaster. A source only produces a caster if one of its
 * fragments declares the caster (ability + type + tier all set) —
 * every other fragment on the same source contributes additively to
 * slot counts and merges into the `granted` maps.
 *
 * Multiclass: each class source resolves independently, so the caster
 * from Cleric and the caster from Wizard stay separate and the spells
 * block can render one sub-section per entry.
 *
 * Subclass handling: the user's convention is to put the subclass's
 * spell grants (Life Domain Spells) on the subclass source itself,
 * which doesn't carry its own declaration. Those grants fold into the
 * parent class's caster by source-name prefix match
 * (subclass source's `level` equals the class level, so the resolver
 * emits both sources during class iteration and we sweep the subclass's
 * grants into the class caster via the `decl.classes[].subclass` link).
 */
function resolveCasters(sources: ResolvedSource[], decl: CharacterDecl): ResolvedCaster[] {
  const bySource = new Map<string, ResolvedSource>();
  for (const s of sources) bySource.set(s.source, s);

  const out: ResolvedCaster[] = [];
  const claimed = new Set<string>();

  // 1) Classes — one caster per class, subclass merges into its parent.
  for (const classEntry of decl.classes ?? []) {
    const classSrc = bySource.get(classEntry.name);
    if (!classSrc) continue;
    const caster = foldCasterFromSource(classSrc);
    if (!caster) continue;
    claimed.add(classEntry.name);
    if (classEntry.subclass) {
      const subSrc = bySource.get(classEntry.subclass);
      if (subSrc) {
        mergeFragmentsInto(caster, subSrc);
        claimed.add(classEntry.subclass);
      }
    }
    out.push(caster);
  }

  // 2) Non-class sources that ASSERT their own caster — either via a full
  //    `ability + type + tier` declaration or via a `choose: { type:
  //    spellcasting, category: ability }` pick on one of their details.
  //    Acolyte-style heritages land here. Per-source aggregation: each
  //    qualifying source gets its own standalone caster.
  for (const src of sources) {
    if (claimed.has(src.source)) continue;
    const caster = foldCasterFromSource(src);
    if (caster) {
      claimed.add(src.source);
      out.push(caster);
    }
  }

  // 3) Remaining sources with bare augment fragments (e.g. a Ritualist
  //    talent grafted onto an Adherent background) fold into every class
  //    caster the character has, matching the pre-Phase-B behaviour. These
  //    sources don't declare a new caster — they just contribute slot
  //    counts or grants to existing ones.
  for (const src of sources) {
    if (claimed.has(src.source)) continue;
    const hasFragment = src.features.some((f) => f.spellcasting);
    if (!hasFragment) continue;
    for (const classEntry of decl.classes ?? []) {
      const classCaster = out.find((c) => c.source === classEntry.name);
      if (classCaster) mergeFragmentsInto(classCaster, src);
    }
  }

  return out;
}

function foldCasterFromSource(src: ResolvedSource): ResolvedCaster | undefined {
  let caster: ResolvedCaster | undefined;
  // A source gets its own standalone caster when EITHER:
  //   (a) some spellcasting fragment declares ability + type + tier, OR
  //   (b) the source declared a `choose: { type: spellcasting, category:
  //       ability }` pick — even if the pick is still pending.
  // This covers Acolyte-style heritages (b) without disturbing bare
  // augment sources (e.g. Ritualist talents on a background) that just
  // contribute slot counts to an existing class caster.
  const hasChoosePick = src.spellcastingAbilityPick !== undefined;
  for (const f of src.features) {
    const frag = f.spellcasting;
    if (!frag) continue;
    if (!caster) {
      const fullyDeclared = !!(frag.ability && frag.type && frag.tier);
      if (!fullyDeclared && !hasChoosePick) continue;
      // Auto-derive cantrip_pool / ritual_pool from the class's `pool:`
      // magic when not explicitly declared. `pool: "[[Divine]]"` gives
      // `cantrip_pool: "[[Divine-Cantrip]]"` and `ritual_pool:
      // "[[Divine-Ritual]]"` — composite tags synthesised by the system
      // config from each spell's `source × circle` combination.
      const poolMagic = frag.pool ? stripWikilinkToName(frag.pool) : undefined;
      const autoCantrip = poolMagic ? `[[${poolMagic}-Cantrip]]` : undefined;
      const autoRitual = poolMagic ? `[[${poolMagic}-Ritual]]` : undefined;
      caster = {
        source: src.source,
        level: src.level ?? 0,
        // Declaration wins; otherwise use the choose-pick (empty string
        // when pending — the caster still renders, just with a placeholder
        // ability so the user sees the source exists).
        ability: frag.ability ?? src.spellcastingAbilityPick ?? "",
        type: frag.type ?? "known",
        tier: frag.tier ?? "none",
        pool: frag.pool,
        cantrip_pool: frag.cantrip_pool ?? autoCantrip,
        ritual_pool: frag.ritual_pool ?? autoRitual,
        style: Array.isArray(frag.style) ? [...frag.style] : [],
        prepared_max: frag.prepared_max,
        cantrips: 0,
        rituals: 0,
        ritualsByLevel: {},
        known: 0,
        rituals_per_circle: 0,
        granted: { prepared: {}, cantrips: {}, rituals: {} },
        grantedBy: {},
      };
    }
    // Grants on the class's own Spellcasting feature attribute back to
    // the declaring feature's name (e.g. `Spellcasting`). Falls back to
    // the source name when unnamed.
    foldFragment(caster, frag, f.name || src.source, typeof f.level === "number" ? f.level : 1);
    if (f.levels && f.levels.length > 0) {
      for (const lvlEntry of f.levels) {
        if (!lvlEntry.spellcasting) continue;
        if (lvlEntry.level > caster.level) continue;
        foldFragment(caster, lvlEntry.spellcasting, f.name || src.source, lvlEntry.level);
      }
    }
  }
  return caster;
}

function mergeFragmentsInto(caster: ResolvedCaster, src: ResolvedSource): void {
  // Subclass / heritage / background / talent sources merge their
  // fragments into the parent caster. Grants attribute back to the
  // subclass-source name (`Life Domain`, not `Cleric`) so the spells
  // block can show the actual enabling feature in the right column.
  for (const f of src.features) {
    if (f.spellcasting) foldFragment(caster, f.spellcasting, src.source, typeof f.level === "number" ? f.level : 1);
    if (f.levels && f.levels.length > 0) {
      for (const lvlEntry of f.levels) {
        if (!lvlEntry.spellcasting) continue;
        if (lvlEntry.level > caster.level) continue;
        foldFragment(caster, lvlEntry.spellcasting, src.source, lvlEntry.level);
      }
    }
  }
}

function foldFragment(
  caster: ResolvedCaster,
  frag: SpellcastingFragment,
  providerSource: string,
  atLevel: number
): void {
  if (typeof frag.cantrips === "number") caster.cantrips += frag.cantrips;
  if (typeof frag.rituals === "number") {
    caster.rituals += frag.rituals;
    caster.ritualsByLevel[atLevel] = (caster.ritualsByLevel[atLevel] ?? 0) + frag.rituals;
  }
  if (typeof frag.known === "number") caster.known += frag.known;
  if (typeof frag.rituals_per_circle === "number") caster.rituals_per_circle += frag.rituals_per_circle;
  // Augmentations on subclass / talent / heroic-boon fragments may want
  // to extend the caster's declared style list (e.g. a subclass attunes
  // the Cleric to a specific flavor). Merge additively, de-duped, and
  // normalise every entry — YAML lets the author write `[[Dream]]`
  // (a nested 1×1 flow array) alongside `"Dream"` and `"[[Dream]]"`,
  // and all three shapes should collapse to `"Dream"`.
  if (frag.style != null) {
    const normaliseStyle = (v: unknown): string => {
      let cur: unknown = v;
      while (Array.isArray(cur)) cur = cur[0];
      if (typeof cur !== "string") return "";
      return cur.replace(/^\[\[/, "").replace(/\]\]$/, "").split("|")[0].trim();
    };
    const raws = Array.isArray(frag.style) ? frag.style : [frag.style];
    for (const raw of raws) {
      const s = normaliseStyle(raw);
      if (s && !caster.style.includes(s)) caster.style.push(s);
    }
  }
  // Ritual pool declared on any fragment (base or augmentation) wins
  // on first-write; subsequent fragments don't override so the primary
  // class declaration stays authoritative.
  if (typeof frag.ritual_pool === "string" && !caster.ritual_pool) {
    caster.ritual_pool = frag.ritual_pool;
  }
  const granted = frag.granted;
  if (granted) {
    mergeGrantMap(caster.granted.prepared, granted.prepared, caster.grantedBy, providerSource);
    mergeGrantMap(caster.granted.cantrips, granted.cantrips, caster.grantedBy, providerSource);
    mergeGrantMap(caster.granted.rituals, granted.rituals, caster.grantedBy, providerSource);
  }
}

function mergeGrantMap(
  target: Record<number, string[]>,
  source: Record<number, unknown[]> | undefined,
  providers: Record<string, string>,
  providerSource: string
): void {
  if (!source) return;
  for (const [lvlStr, raws] of Object.entries(source)) {
    const lvl = Number(lvlStr);
    if (!Number.isFinite(lvl) || !Array.isArray(raws)) continue;
    const bucket = (target[lvl] ??= []);
    for (const raw of raws) {
      const str = stringifyRef(raw);
      if (!str) continue;
      if (!bucket.includes(str)) bucket.push(str);
      const stem = grantStem(str);
      // First grant wins for provenance (keeps the earliest-granting
      // feature visible when later features regrant the same spell).
      if (stem && !providers[stem]) providers[stem] = providerSource;
    }
  }
}

function grantStem(raw: string): string {
  return raw.replace(/^\[\[/, "").replace(/\]\]$/, "").replace(/\.md$/, "").split("|")[0].trim();
}

function stringifyRef(raw: unknown): string | undefined {
  let v: unknown = raw;
  while (Array.isArray(v)) v = v[0];
  if (typeof v === "string") {
    const trimmed = v.trim();
    // Preserve wikilink delimiters so the renderer can resolve them;
    // callers that need a bare stem can strip further.
    return trimmed || undefined;
  }
  return undefined;
}

/**
 * Walk every resolved feature with an `update:` block and rewrite the
 * matching aspect on a sibling feature. Matching is done across all
 * sources (a subclass feature can patch a class feature it builds on).
 * The carrier feature is dropped from its source's render list so it
 * doesn't show up as a duplicate card.
 */
function applyFeatureUpdates(sources: ResolvedSource[]): void {
  // Index every feature by aspect to make the lookup O(1) per patch.
  // A feature can declare aspects two ways: an explicit `passive: { … }`
  // sub-object, or `type: passive` on the feature itself (the renderer
  // synthesizes an empty aspect for the latter and falls back to the
  // feature's top-level text). Mirror that here — synthesize the empty
  // aspect on first index hit so update patches can target it the same
  // way they target an explicit aspect.
  type AspectRef = { feature: FeatureDetails; bucket: (typeof ASPECT_KEYS)[number] };
  const byAspectName = new Map<string, AspectRef[]>();
  for (const src of sources) {
    for (const f of src.features) {
      for (const bucket of ASPECT_KEYS) {
        let aspect = f[bucket];
        if (!aspect && f.type === bucket) {
          aspect = {};
          f[bucket] = aspect;
        }
        const aspectName = aspect?.name ?? f.name;
        if (!aspect || !aspectName) continue;
        const list = byAspectName.get(aspectName) ?? [];
        list.push({ feature: f, bucket });
        byAspectName.set(aspectName, list);
      }
    }
  }

  for (const src of sources) {
    const dropped = new Set<FeatureDetails>();
    for (const carrier of src.features) {
      const u = carrier.update;
      if (!u) continue;
      // First aspect key with a string value is the selector.
      let selectorBucket: (typeof ASPECT_KEYS)[number] | undefined;
      let selectorName: string | undefined;
      for (const bucket of ASPECT_KEYS) {
        const v = u[bucket];
        if (typeof v === "string" && v.length > 0) {
          selectorBucket = bucket;
          selectorName = v;
          break;
        }
      }
      if (!selectorBucket || !selectorName) continue;
      const candidates = byAspectName.get(selectorName) ?? [];
      // Strict bucket match — author keys (action / passive / …) must
      // line up with the source aspect's bucket. If they're mismatched,
      // skip the patch silently so the divergence stays visible in the
      // rendered sheet rather than being silently corrected.
      const target = candidates.find((c) => c.bucket === selectorBucket);
      if (!target) continue;
      // Shallow-merge the patch onto the target aspect, ignoring the
      // selector field itself.
      const patch: Partial<FeatureAspect> = {};
      if (u.name != null) patch.name = u.name;
      if (u.text != null) patch.text = u.text;
      if (u.recharge != null) patch.recharge = u.recharge;
      if (u.recovery != null) patch.recovery = u.recovery;
      if (u.max != null) patch.max = u.max;
      target.feature[target.bucket] = { ...target.feature[target.bucket], ...patch };
      dropped.add(carrier);
    }
    if (dropped.size > 0) {
      src.features = src.features.filter((f) => !dropped.has(f));
    }
  }
}

/**
 * Fold homebrew / one-off `additional:` entries from the features block
 * into the resolved view.
 *
 * Each entry is a wikilink reference to an existing feature.details-
 * bearing page (typically a talent for now; boons / curses / generic
 * features join the same lookup once those folders exist). For each
 * reference we spread the page's feature.details into the host source:
 *
 * - Object form `{ ref, source, level }` → attribute into the named
 *   ResolvedSource at the given level. Creates the source if missing.
 * - String form `"[[Name]]"` or object without `source` → attribute into
 *   a synthetic `Homebrew` source (created on first use).
 */
function applyAdditional(
  sources: ResolvedSource[],
  additional: CharacterDecl["additional"],
  talents: Record<string, SourceDoc> | undefined,
  traitsAgg: Record<string, string[]>
): void {
  if (!additional || !talents) return;
  const lists: Array<ExtraRef[] | undefined> = [
    additional.talents,
    additional.features,
    additional.boons,
    additional.curses,
  ];
  const allRefs = lists.flatMap((l) => l ?? []);
  if (allRefs.length === 0) return;

  const ensureSource = (name: string, kind: SourceDocKind = "background"): ResolvedSource => {
    let existing = sources.find((s) => s.source === name);
    if (existing) return existing;
    const created: ResolvedSource = {
      source: name,
      kind,
      level: undefined,
      features: [],
      pendingChoices: [],
      baseTraits: {},
      leveledTraits: {},
      traitsByLevel: {},
    };
    sources.push(created);
    return created;
  };

  for (const raw of allRefs) {
    const entry = typeof raw === "string" ? { ref: raw } : raw;
    if (!entry?.ref) continue;
    const bareName = entry.ref
      .replace(/^\[\[|\]\]$/g, "")
      .split("|")[0]
      .trim();
    if (!bareName) continue;
    const doc = talents[bareName];
    if (!doc) continue; // silently skip missing pages

    const hostName = entry.source ?? "Homebrew";
    const host = ensureSource(hostName, "background");
    const perHost: Record<string, string[]> = entry.level != null ? host.leveledTraits : host.baseTraits;

    for (const talentDetail of doc.details) {
      const synthetic: FeatureDetails = {
        ...talentDetail,
        name: talentDetail.name && !talentDetail.name.startsWith("__auto_") ? talentDetail.name : bareName,
        level: entry.level ?? talentDetail.level,
      };
      host.features.push(synthetic);
      collectTraits(perHost, talentDetail.traits);
      collectTraits(traitsAgg, talentDetail.traits);
      if (entry.level != null) {
        const bucket = (host.traitsByLevel[entry.level] ??= {});
        collectTraits(bucket, talentDetail.traits);
      }
    }
  }
}

/**
 * Collect every `TableDef` from the sources referenced by `decl` into a flat
 * lookup keyed by both `<source>:<name>` and bare `<name>` (latest loaded
 * wins on bare-name collisions). The ordering mirrors resolver load order:
 * classes → subclasses → lineage → heritage → background.
 */
function aggregateTables(decl: CharacterDecl, lib: CompendiumLib): Record<string, TableDef> {
  const out: Record<string, TableDef> = {};
  const add = (doc: SourceDoc | undefined) => {
    if (!doc) return;
    for (const t of doc.tables ?? []) {
      const tagged: TableDef = { ...t, source: doc.name };
      out[`${doc.name}:${t.name}`] = tagged;
      out[t.name] = tagged;
    }
  };
  for (const entry of decl.classes ?? []) {
    add(lib.classes[entry.name]);
    if (entry.subclass) add(lib.subclasses[entry.subclass]);
  }
  if (decl.lineage) add(lib.lineages[decl.lineage]);
  if (decl.heritage) add(lib.heritages[decl.heritage]);
  if (decl.background) add(lib.backgrounds[decl.background]);
  return out;
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
  tagIndex?: Record<string, string[]>,
  folderIndex?: Record<string, string[]>,
  talents?: Record<string, SourceDoc>
) {
  if (!name) return;
  const doc = lib[name];
  if (!doc) return;
  sources.push(resolveSource(doc, undefined, choices?.[name], traitsAgg, { tagIndex, folderIndex, talents }));
}

// Re-exports for callers that touch the resolver API
export type { FeatureChoiceOption };
export { stripWikilink };
