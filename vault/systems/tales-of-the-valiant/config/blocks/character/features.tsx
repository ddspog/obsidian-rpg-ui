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

/** Numeric-form of `maxAtLevel` — returns null when no max is declared so
 *  callers can branch cleanly on "limited uses? y/n". */
function resolveMaxCount(max: FeatureAspect["max"], characterLevel?: number): number | null {
  if (max == null) return null;
  if (typeof max === "number") return max;
  const entries = Object.entries(max)
    .map(([lv, n]) => [Number(lv), n] as const)
    .sort((a, b) => a[0] - b[0]);
  if (entries.length === 0) return null;
  if (characterLevel == null) return entries[entries.length - 1][1];
  let chosen: number | null = null;
  for (const [lv, n] of entries) {
    if (lv <= characterLevel) chosen = n;
    else break;
  }
  return chosen ?? entries[0][1];
}

/** Interactive "fill-me-up" usage dots next to a feature's name. Clicking a
 *  dot toggles it — click the i-th empty dot to mark uses 0..i as spent;
 *  click an already-filled dot to mark uses i+1..max as available again.
 *  Matches the death-save / exhaustion pattern used elsewhere on the sheet. */
function UsageDots({
  count,
  spent,
  onSpentChange,
}: {
  count: number;
  spent: number;
  onSpentChange?: (next: number) => void;
}) {
  if (count <= 0) return null;
  const clamped = Math.max(0, Math.min(spent, count));
  return (
    <span
      className="rpg-feature-bucket-dots"
      role="group"
      aria-label={`${count - clamped} of ${count} uses remaining`}
    >
      {Array.from({ length: count }, (_, i) => {
        const filled = i < clamped;
        return (
          <button
            key={i}
            type="button"
            className="rpg-feature-bucket-dot"
            aria-pressed={filled}
            aria-label={`Use ${i + 1}${filled ? " (spent)" : ""}`}
            disabled={!onSpentChange}
            onClick={() => onSpentChange?.(filled ? i : i + 1)}
          />
        );
      })}
    </span>
  );
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
  spent,
  onSpentChange,
}: {
  entry: BucketEntry;
  characterLevel?: number;
  context?: EvalContext;
  spent: number;
  onSpentChange?: (next: number) => void;
}) {
  const { feature, aspect, source } = entry;
  const displayName = aspect.name ?? feature.name;
  const isResource = entry.bucket === "resource";
  // Resource entries render their own aspect text only; the parent feature's
  // long prose belongs to the Action/Passive aspects, not the bare pool.
  const cardText = isResource ? aspect.text : (aspect.text ?? feature.text);
  const maxCount = resolveMaxCount(aspect.max, characterLevel);

  return (
    <li className="rpg-feature-bucket-entry">
      <div className="rpg-feature-bucket-entry-title">
        <strong className="rpg-feature-bucket-entry-name">{displayName}</strong>
        {maxCount != null && (
          <UsageDots count={maxCount} spent={spent} onSpentChange={onSpentChange} />
        )}
        {aspect.recharge && (
          <small aria-details="Recharge">↻ {aspect.recharge}</small>
        )}
        {(isResource || aspect.resource != null) && aspect.recovery && (
          <small aria-details="Resource Recovery">recharge on {aspect.recovery}</small>
        )}
      </div>
      <div className="rpg-feature-bucket-entry-meta">
        <a
          className="internal-link rpg-feature-bucket-source"
          href={source}
          data-href={source}
          aria-details="Feature Source"
        >
          {source}
        </a>
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
  spentMap,
  onSpentChange,
}: {
  id: string;
  label: string;
  entries: BucketEntry[];
  characterLevel?: number;
  context?: EvalContext;
  spentMap: Record<string, number>;
  onSpentChange?: (key: string, next: number) => void;
}) {
  if (entries.length === 0) return null;
  return (
    <details className={`rpg-feature-bucket rpg-feature-bucket-${id}`}>
      <summary>
        <span className="rpg-feature-bucket-label">{label}</span>
        <span className="rpg-feature-bucket-count">{entries.length}</span>
      </summary>
      <ul>
        {entries.map((entry, i) => {
          const key = `${entry.source}:${entry.feature.name}:${entry.bucket}`;
          return (
            <EntryRow
              key={i}
              entry={entry}
              characterLevel={characterLevel}
              context={context}
              spent={spentMap[key] ?? 0}
              onSpentChange={onSpentChange ? (next) => onSpentChange(key, next) : undefined}
            />
          );
        })}
      </ul>
    </details>
  );
}

/** Render a trait value with its `+` prefix, keeping wikilinks as real
 *  internal-link anchors so hover-preview + click-to-open work. */
function TraitValue({ value }: { value: string }) {
  const prefixed = value.startsWith("+") || value.startsWith("−") ? value : `+${value}`;
  const parts = prefixed.split(/(\[\[[^\]]+\]\])/);
  return (
    <>
      {parts.map((part, i) => {
        const match = part.match(/^\[\[([^|\]]+)(?:\|([^\]]+))?\]\]$/);
        if (match) {
          const href = match[1];
          const label = match[2] ?? match[1];
          return (
            <a
              key={i}
              className="internal-link"
              href={href}
              data-href={href}
            >
              {label}
            </a>
          );
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </>
  );
}

/** Inline trait list: `**TraitA** (+v1, +v2), **TraitB** (+v3)`. */
function TraitsInline({ traits }: { traits: Record<string, string[]> }) {
  const entries = Object.entries(traits);
  if (entries.length === 0) return null;
  return (
    <>
      {entries.map(([name, values], i) => (
        <React.Fragment key={name}>
          {i > 0 && ", "}
          <strong>{name}</strong>
          {" ("}
          {values.map((v, j) => (
            <React.Fragment key={j}>
              {j > 0 && ", "}
              <TraitValue value={v} />
            </React.Fragment>
          ))}
          {")"}
        </React.Fragment>
      ))}
    </>
  );
}

/** One source's contribution to the character sheet's traits bucket. */
function TraitsSourceLine({ src }: { src: ResolvedSource }) {
  const isClass = src.kind === "class" || src.kind === "subclass";
  const hasBase = Object.keys(src.baseTraits).length > 0;
  const hasLeveled = Object.keys(src.leveledTraits).length > 0;
  if (!hasBase && !hasLeveled) return null;
  return (
    <div className="rpg-feature-traits-source">
      <p>
        <a
          className="internal-link rpg-feature-traits-source-link"
          href={src.source}
          data-href={src.source}
        >
          {src.source}
        </a>
        {isClass && src.level != null && (
          <span className="rpg-feature-traits-source-level"> (Lv. {src.level})</span>
        )}
        {hasBase && (
          <>
            {" — "}
            <TraitsInline traits={src.baseTraits} />
          </>
        )}
      </p>
      {hasLeveled && isClass && (
        <ul className="rpg-feature-traits-leveled">
          <li>
            <TraitsInline traits={src.leveledTraits} />
          </li>
        </ul>
      )}
      {hasLeveled && !isClass && !hasBase && (
        <p>
          <TraitsInline traits={src.leveledTraits} />
        </p>
      )}
    </div>
  );
}

function TraitsBucket({ sources }: { sources: ResolvedSource[] }) {
  const visible = sources.filter(
    (s) =>
      Object.keys(s.baseTraits).length > 0 ||
      Object.keys(s.leveledTraits).length > 0,
  );
  if (visible.length === 0) return null;
  return (
    <details className="rpg-feature-bucket rpg-feature-bucket-traits">
      <summary>
        <span className="rpg-feature-bucket-label">Traits</span>
        <span className="rpg-feature-bucket-count">{visible.length}</span>
      </summary>
      <div className="rpg-feature-traits-summary">
        {visible.map((src) => (
          <TraitsSourceLine key={`${src.source}:${src.kind}`} src={src} />
        ))}
      </div>
    </details>
  );
}

// ─── Decisions log (collapsed review of picks already made) ───────────────────

interface Decision {
  /** Category rendered in the line label — the parent feature's choose
   *  `category` when present, else the feature name. */
  category: string;
  /** Picked values, verbatim (wikilinks supported — rendered as internal-links). */
  values: string[];
}

interface DecisionGroup {
  /** Header for the group. Source name, leveled-feature name, or choice name. */
  label: string;
  /** Optional wikilink target — used when the label refers to a compendium doc. */
  link?: string;
  decisions: Decision[];
}

/**
 * Walk resolved sources + the character's recorded picks and bucket each
 * decision:
 *
 *   - a pick on an unleveled feature → the source's group (one group per
 *     class / subclass / lineage / heritage / background)
 *   - a pick on a leveled feature → a group of its own, labelled with the
 *     feature name
 *   - a pick stored under a name the source doesn't expose as a feature is
 *     treated as a sub-choice fired by a feature.choice option, and goes in
 *     its own group labelled with the choice (option) name
 */
function gatherDecisions(
  sources: ResolvedSource[],
  choices: FeaturesBlockData["choices"],
): DecisionGroup[] {
  if (!choices) return [];
  const groups: DecisionGroup[] = [];

  for (const src of sources) {
    const sourcePicks = choices[src.source];
    if (!sourcePicks) continue;

    const sourceGroup: DecisionGroup = {
      label: src.source,
      link: src.source,
      decisions: [],
    };
    const featureGroups = new Map<string, DecisionGroup>();
    const seenFeatureNames = new Set<string>();

    for (const feature of src.features) {
      seenFeatureNames.add(feature.name);
      const raw = sourcePicks[feature.name];
      if (raw == null) continue;
      const values = Array.isArray(raw) ? raw : [raw];
      if (values.length === 0) continue;
      const category =
        feature.choose?.type === "traits" ? feature.choose.category : feature.name;
      const decision: Decision = { category, values };

      if (feature.level == null) {
        sourceGroup.decisions.push(decision);
      } else {
        let fg = featureGroups.get(feature.name);
        if (!fg) {
          fg = { label: feature.name, decisions: [] };
          featureGroups.set(feature.name, fg);
        }
        fg.decisions.push(decision);
      }
    }

    if (sourceGroup.decisions.length > 0) groups.push(sourceGroup);
    for (const fg of featureGroups.values()) groups.push(fg);

    // Picks stored under a key the source doesn't expose as a feature are
    // sub-choices fired by a picked feature.choice option. Group each one
    // under the choice (option) name, using the option name itself as the
    // visible category since we can't easily recover the original
    // `choose.category` without threading extra data through the resolver.
    for (const [key, raw] of Object.entries(sourcePicks)) {
      if (seenFeatureNames.has(key)) continue;
      const values = Array.isArray(raw) ? raw : [raw];
      if (values.length === 0) continue;
      groups.push({
        label: key,
        decisions: [{ category: key, values }],
      });
    }
  }

  return groups;
}

function DecisionsLog({
  sources,
  choices,
}: {
  sources: ResolvedSource[];
  choices: FeaturesBlockData["choices"];
}) {
  const groups = React.useMemo(() => gatherDecisions(sources, choices), [sources, choices]);
  if (groups.length === 0) return null;
  const total = groups.reduce((n, g) => n + g.decisions.length, 0);
  return (
    <details className="rpg-feature-decisions">
      <summary>
        <span className="rpg-feature-decisions-label">Decisions made</span>
        <span className="rpg-feature-decisions-count">{total}</span>
      </summary>
      <div className="rpg-feature-decisions-groups">
        {groups.map((g, i) => (
          <div key={`${g.label}:${i}`} className="rpg-feature-decisions-group">
            <p className="rpg-feature-decisions-group-label">
              {g.link ? (
                <a className="internal-link" href={g.link} data-href={g.link}>
                  {g.label}
                </a>
              ) : (
                g.label
              )}
            </p>
            <ul>
              {g.decisions.map((d, j) => (
                <li key={j}>
                  <strong>{d.category}</strong>
                  {": "}
                  {d.values.map((v, k) => (
                    <React.Fragment key={k}>
                      {k > 0 && ", "}
                      <TraitValue value={v} />
                    </React.Fragment>
                  ))}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}

function FeaturesAccordion({
  view,
  characterLevel,
  context,
  spentMap,
  onSpentChange,
}: {
  view: ResolvedView;
  characterLevel?: number;
  context?: EvalContext;
  spentMap: Record<string, number>;
  onSpentChange?: (key: string, next: number) => void;
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
          spentMap={spentMap}
          onSpentChange={onSpentChange}
        />
      ))}
      <TraitsBucket sources={view.sources} />
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
  const setSpent = (self as { setSpent?: (u: (prev: FeaturesBlockData["spent"]) => FeaturesBlockData["spent"]) => void }).setSpent;
  const spentMap = self.spent ?? {};
  const handleSpentChange = setSpent
    ? (key: string, next: number) => {
        setSpent((prev) => {
          const out = { ...(prev ?? {}) };
          if (next <= 0) delete out[key];
          else out[key] = next;
          return out;
        });
      }
    : undefined;
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
        <FeaturesAccordion
          view={view}
          characterLevel={characterLevel}
          context={context}
          spentMap={spentMap}
          onSpentChange={handleSpentChange}
        />
      )}
      {(view.pendingChoices.length > 0 || Object.keys(self.choices ?? {}).length > 0) && (
        <section aria-label="Pending Choices" className="rpg-feature-pending-list">
          <h3>Choices to make</h3>
          {view.pendingChoices.map((p) => (
            <PendingChoiceRow
              key={`${p.source}:${p.feature.name}`}
              pending={p}
              onToggle={makeToggle(p.source, p.feature.name)}
            />
          ))}
          <DecisionsLog sources={view.sources} choices={self.choices} />
        </section>
      )}
    </section>
  );
};

export default features;
