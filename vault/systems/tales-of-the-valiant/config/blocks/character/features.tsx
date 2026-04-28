import * as React from "react";
import {
  EntityBlock,
  PendingChoiceRow,
  resolveFeatures,
  CharacterDecl,
  FeatureDetails,
  ResolvedSource,
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

// ─── Sub-components ──────────────────────────────────────────────────────────

function TraitsSection({
  traits,
}: {
  traits: Record<string, string[]>;
}) {
  const entries = Object.entries(traits);
  if (entries.length === 0) return null;
  return (
    <section className="rpg-feature-traits" aria-label="Aggregated Traits">
      <h4>Traits</h4>
      <dl>
        {entries.map(([key, values]) => (
          <React.Fragment key={key}>
            <dt>{key}</dt>
            <dd>{values.join(" ")}</dd>
          </React.Fragment>
        ))}
      </dl>
    </section>
  );
}

/** Format `max` for display — scalar passes through, level map picks the
 *  highest entry whose level <= the character's level. */
function maxAtLevel(max: FeatureDetails["max"], characterLevel?: number): string {
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

function ResourcesSection({
  resources,
  characterLevel,
}: {
  resources: FeatureDetails[];
  characterLevel?: number;
}) {
  if (resources.length === 0) return null;
  return (
    <section className="rpg-feature-resources" aria-label="Resources">
      <h4>Resources</h4>
      <dl>
        {resources.map((r) => (
          <React.Fragment key={r.name}>
            <dt>{r.name}</dt>
            <dd>
              {maxAtLevel(r.max, characterLevel)}
              {r.recovery && <small> · {r.recovery}</small>}
            </dd>
          </React.Fragment>
        ))}
      </dl>
    </section>
  );
}

function SourceGroup({ src }: { src: ResolvedSource }) {
  // Resource-typed features render in the dedicated Resources section, so
  // hide them from the per-source feature list.
  const features = src.features.filter((f) => f.type !== "resource");
  return (
    <section className="rpg-feature-source" aria-label={`Source ${src.source}`}>
      <hgroup className={`rpg-feature-source-header rpg-feature-source-${src.kind}`}>
        <h4>{src.source}</h4>
        {src.level != null && <p><small>Lv. {src.level}</small></p>}
      </hgroup>

      {features.length > 0 && (
        <ul aria-label="Source Features">
          {features.map((f, i) => (
            <li key={i} className="rpg-feature-entry">
              <strong>{f.name}</strong>
              {f.subtitle && <small> · {f.subtitle}</small>}
              {f.type && <small> · {f.type.replace(/_/g, " ")}</small>}
              {f.uses != null && <small> · {f.uses} use{f.uses === 1 ? "" : "s"}</small>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ─── Main block ──────────────────────────────────────────────────────────────

export const features: EntityBlock<FeaturesBlockData, CharacterEntity> = ({
  self,
  blocks,
  lookup,
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

  // Pull resource-typed features out of the resolved sources for the
  // dedicated Resources section. They still appear in `view.sources`, but
  // SourceGroup hides them from the per-source list.
  const resources = view.sources.flatMap((s) =>
    s.features.filter((f) => f.type === "resource"),
  );

  // Build a toggle handler if the wrapper exposes setChoices. Picking adds
  // the option to the slot; clicking an already-picked option removes it.
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
    <article aria-label="Character Features" className="rpg-feature-source-groups">
      <ResourcesSection
        resources={resources}
        characterLevel={(header.classes ?? [])[0]?.level}
      />
      <TraitsSection traits={view.traits} />
      {view.sources.length === 0 ? (
        <p aria-details="No Sources"><em>No class, lineage, or background declared.</em></p>
      ) : (
        view.sources.map((src) => <SourceGroup key={`${src.source}:${src.kind}`} src={src} />)
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
    </article>
  );
};

export default features;
