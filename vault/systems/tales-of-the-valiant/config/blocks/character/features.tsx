import * as React from "react";
import {
  EntityBlock,
  EvalContext,
  FeatureAspect,
  FeatureDetails,
  Markdown,
  PendingChoiceRow,
  ResolvedSource,
  ResolvedView,
  resolveFeatures,
  CharacterDecl,
} from "rpg-ui-toolkit";
import { CharacterEntity } from "../../entities/character.types";
import type { HeaderProps } from "./header.types";
import type { FeaturesBlockData } from "./features.types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Pull "Human" out of a PillDetails.file. Two shapes can arrive depending on
 * how the source YAML was written:
 *   - quoted: `file: "[[Human]]"`   → string `"[[Human]]"`
 *   - bare:   `file: [[Human]]`     → nested flow array `[["Human"]]`
 * Both yield the same stem.
 */
function pillStem(p: { file?: unknown } | undefined): string | undefined {
  if (!p?.file) return undefined;
  let raw: unknown = p.file;
  while (Array.isArray(raw)) raw = raw[0];
  if (typeof raw !== "string") return undefined;
  const stem = raw.replace(/^\[\[/, "").replace(/\]\]$/, "").replace(/\.md$/, "").trim();
  return stem || undefined;
}

/** Pretty-print a resource `max` — scalar passes through; per-level map picks
 *  the value whose level is highest while still ≤ the character's level. */
function maxAtLevel(max: FeatureAspect["max"], characterLevel?: number): string {
  if (max == null) return "—";
  if (typeof max === "number") return String(max);
  const entries = Object.entries(max)
    .map(([lv, n]) => [Number(lv), n] as const)
    .sort((a, b) => a[0] - b[0]);
  if (entries.length === 0) return "—";
  if (characterLevel == null) return String(entries[entries.length - 1][1]);
  let chosen = entries[0][1];
  for (const [lv, n] of entries) {
    if (lv <= characterLevel) chosen = n;
    else break;
  }
  return String(chosen);
}

// ─── Bucketing ───────────────────────────────────────────────────────────────

/**
 * Accordion buckets in display order. Each id is both a valid `type:` value
 * and a valid aspect sub-key on `FeatureDetails`.
 */
const BUCKETS: Array<{ id: BucketId; label: string }> = [
  { id: "action", label: "Action" },
  { id: "bonus", label: "Bonus Action" },
  { id: "reaction", label: "Reaction" },
  { id: "active", label: "Active" },
  { id: "passive", label: "Passive" },
  { id: "resource", label: "Resource" },
];
type BucketId = "action" | "bonus" | "reaction" | "active" | "passive" | "resource";
const BUCKET_IDS = new Set<string>(BUCKETS.map((b) => b.id));

interface BucketEntry {
  feature: FeatureDetails;
  aspect: FeatureAspect;
  bucket: BucketId;
  source: string;
  level?: number;
}

/**
 * Classify each resolved feature into zero or more buckets:
 *  - every aspect sub-object on the feature emits its own entry in that bucket
 *  - a feature without any aspect falls back to its `type:` (backwards compat)
 *  - resource shorthand: `max:`/`recovery:` on the parent places the feature
 *    in the Resource bucket when no `resource:` aspect was declared
 *
 * Features that match none of those rules are intentionally skipped — their
 * contributions (trait maps, pick prompts, spellcasting configs) already
 * surface in the Traits bucket, the "Choices to make" section, or dedicated
 * renderers. No generic catch-all bucket.
 */
function bucketize(sources: ResolvedSource[]): Record<string, BucketEntry[]> {
  const byBucket: Record<string, BucketEntry[]> = {};

  for (const src of sources) {
    for (const feature of src.features) {
      let placed = false;

      for (const { id } of BUCKETS) {
        const raw = (feature as unknown as Record<string, unknown>)[id];
        if (raw && typeof raw === "object" && !Array.isArray(raw)) {
          (byBucket[id] ??= []).push({
            feature,
            aspect: raw as FeatureAspect,
            bucket: id,
            source: src.source,
            level: src.level,
          });
          placed = true;
        }
      }

      if (!placed && feature.type && BUCKET_IDS.has(feature.type)) {
        const bucket = feature.type as BucketId;
        (byBucket[bucket] ??= []).push({
          feature,
          aspect: {},
          bucket,
          source: src.source,
          level: src.level,
        });
        placed = true;
      }

      if (!placed && feature.max != null) {
        (byBucket.resource ??= []).push({
          feature,
          aspect: { max: feature.max, recovery: feature.recovery },
          bucket: "resource",
          source: src.source,
          level: src.level,
        });
      }
    }
  }

  return byBucket;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function EntryRow({
  entry,
  characterLevel,
  context,
}: {
  entry: BucketEntry;
  characterLevel?: number;
  context?: EvalContext;
}) {
  const { feature, aspect, source, level } = entry;
  const displayName = aspect.name ?? feature.name;
  const isResource = entry.bucket === "resource";
  // Resource entries render their own aspect text only; the parent feature's
  // long prose belongs to the Action/Passive aspects, not the bare pool.
  const cardText = isResource ? aspect.text : (aspect.text ?? feature.text);

  return (
    <li className="rpg-feature-bucket-entry">
      <strong className="rpg-feature-bucket-entry-name">{displayName}</strong>
      <div className="rpg-feature-bucket-entry-meta">
        <small aria-details="Feature Source" className="rpg-feature-bucket-source">
          {source}
        </small>
        {aspect.recharge && (
          <small aria-details="Recharge">↻ {aspect.recharge}</small>
        )}
        {isResource && aspect.max != null && (
          <small aria-details="Resource Max">Max: {maxAtLevel(aspect.max, characterLevel)}</small>
        )}
        {(isResource || aspect.resource != null) && aspect.recovery && (
          <small aria-details="Resource Recovery">Recovery: {aspect.recovery}</small>
        )}
      </div>
      <figure className="rpg-feature-bucket-entry-image" aria-hidden="true" />
      {cardText && (
        <Markdown
          source={cardText}
          context={context}
          className="rpg-feature-bucket-entry-desc"
        />
      )}
    </li>
  );
}

function Bucket({
  id,
  label,
  entries,
  characterLevel,
  context,
}: {
  id: string;
  label: string;
  entries: BucketEntry[];
  characterLevel?: number;
  context?: EvalContext;
}) {
  if (entries.length === 0) return null;
  return (
    <details className={`rpg-feature-bucket rpg-feature-bucket-${id}`}>
      <summary>
        <span className="rpg-feature-bucket-label">{label}</span>
        <span className="rpg-feature-bucket-count">{entries.length}</span>
      </summary>
      <ul>
        {entries.map((entry, i) => (
          <EntryRow key={i} entry={entry} characterLevel={characterLevel} context={context} />
        ))}
      </ul>
    </details>
  );
}

function TraitsBucket({ traits }: { traits: Record<string, string[]> }) {
  const entries = Object.entries(traits);
  if (entries.length === 0) return null;
  return (
    <details className="rpg-feature-bucket rpg-feature-bucket-traits">
      <summary>
        <span className="rpg-feature-bucket-label">Traits</span>
        <span className="rpg-feature-bucket-count">{entries.length}</span>
      </summary>
      <dl>
        {entries.map(([key, values]) => (
          <React.Fragment key={key}>
            <dt>{key}</dt>
            <dd>{values.join(" ")}</dd>
          </React.Fragment>
        ))}
      </dl>
    </details>
  );
}

function FeaturesAccordion({
  view,
  characterLevel,
  context,
}: {
  view: ResolvedView;
  characterLevel?: number;
  context?: EvalContext;
}) {
  const byBucket = React.useMemo(() => bucketize(view.sources), [view.sources]);
  return (
    <section className="rpg-feature-accordion" aria-label="Features by Type">
      {BUCKETS.map(({ id, label }) => (
        <Bucket
          key={id}
          id={id}
          label={label}
          entries={byBucket[id] ?? []}
          characterLevel={characterLevel}
          context={context}
        />
      ))}
      <TraitsBucket traits={view.traits} />
    </section>
  );
}

// ─── Main block ──────────────────────────────────────────────────────────────

export const features: EntityBlock<FeaturesBlockData, CharacterEntity> = ({
  self,
  blocks,
  lookup,
  frontmatter,
}) => {
  const lib = lookup.$compendium;
  const header = (blocks.header ?? {}) as Partial<HeaderProps>;

  const decl: CharacterDecl = {
    classes: (header.classes ?? []).map((c) => ({
      name: c.name,
      level: c.level,
      subclass: c.subclass,
    })),
    lineage: pillStem(header.lineage),
    heritage: pillStem(header.heritage),
    background: pillStem(header.background),
    choices: self.choices,
  };

  const view = resolveFeatures(decl, lib);
  const primaryClass = (header.classes ?? [])[0];
  const characterLevel = primaryClass?.level;

  /* Build the expression context handed to every feature-card <Markdown>:
   *   - `tables` comes from the resolved view (every loaded source's tables
   *     keyed by bare `<name>` and fully-qualified `<source>:<name>`).
   *   - `vars` carries common identifiers authors use in `{{ … }}`
   *     expressions: class level, ability scores + modifiers, PB. Frontmatter
   *     is the source of truth; sensible defaults keep things rendering when
   *     a character file hasn't filled in every stat yet. */
  const context: EvalContext = React.useMemo(() => {
    const fm = (frontmatter ?? {}) as Record<string, unknown>;
    const num = (key: string, fallback: number) => {
      const v = fm[key];
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? n : fallback;
    };
    const mod = (score: number) => Math.floor((score - 10) / 2);
    const str = num("strength", 10);
    const dex = num("dexterity", 10);
    const con = num("constitution", 10);
    const intel = num("intelligence", 10);
    const wis = num("wisdom", 10);
    const cha = num("charisma", 10);
    const lv = characterLevel ?? num("level", 1);

    return {
      tables: view.tables,
      vars: {
        LV: lv,
        CLASS_LEVEL: lv,
        CLASS: primaryClass?.name ?? "",
        PB: num("proficiency_bonus", 2),
        STR: str, DEX: dex, CON: con, INT: intel, WIS: wis, CHA: cha,
        STR_MOD: mod(str),
        DEX_MOD: mod(dex),
        CON_MOD: mod(con),
        INT_MOD: mod(intel),
        WIS_MOD: mod(wis),
        CHA_MOD: mod(cha),
      },
    };
  }, [view.tables, characterLevel, primaryClass, frontmatter]);

  const setChoices = (self as { setChoices?: (u: (prev: FeaturesBlockData["choices"]) => FeaturesBlockData["choices"]) => void }).setChoices;
  const makeToggle = (source: string, featureName: string) =>
    setChoices
      ? (option: string) => {
          setChoices((prev) => {
            const next: NonNullable<FeaturesBlockData["choices"]> = { ...(prev ?? {}) };
            const sourcePicks = { ...(next[source] ?? {}) };
            const current = sourcePicks[featureName];
            const currentArr = Array.isArray(current)
              ? [...current]
              : current
                ? [current]
                : [];
            const idx = currentArr.indexOf(option);
            if (idx >= 0) currentArr.splice(idx, 1);
            else currentArr.push(option);
            if (currentArr.length === 0) delete sourcePicks[featureName];
            else sourcePicks[featureName] = currentArr;
            next[source] = sourcePicks;
            return next;
          });
        }
      : undefined;

  return (
    <section aria-label="Character Features" className="rpg-feature-source-groups">
      {view.sources.length === 0 ? (
        <p aria-details="No Sources"><em>No class, lineage, or background declared.</em></p>
      ) : (
        <FeaturesAccordion view={view} characterLevel={characterLevel} context={context} />
      )}
      {view.pendingChoices.length > 0 && (
        <section aria-label="Pending Choices" className="rpg-feature-pending-list">
          <h3>Choices to make</h3>
          {view.pendingChoices.map((p) => (
            <PendingChoiceRow
              key={`${p.source}:${p.feature.name}`}
              pending={p}
              onToggle={makeToggle(p.source, p.feature.name)}
            />
          ))}
        </section>
      )}
    </section>
  );
};

export default features;
