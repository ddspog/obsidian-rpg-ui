import * as React from "react";
import { EntityBlock } from "rpg-ui-toolkit";
import { CharacterEntity } from "../../entities/character.types";
import type { HeaderProps } from "./header.types";
import type { FeaturesBlockData } from "./features.types";
import { resolveFeatures } from "../../../../../../lib/domains/features/resolver";
import { tagLabel } from "../../../../../../lib/domains/features/grants";
import type {
  CharacterDecl,
  PendingChoice,
  ResolvedSource,
} from "../../../../../../lib/domains/features/types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Pull "Human" out of a PillDetails like { file: "[[Human]]" } or { file: "Human.md" }. */
function pillStem(p: { file?: string } | undefined): string | undefined {
  if (!p?.file) return undefined;
  const stem = p.file.replace(/^\[\[/, "").replace(/\]\]$/, "").replace(/\.md$/, "").trim();
  return stem || undefined;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SourceGroup({ src }: { src: ResolvedSource }) {
  return (
    <section className="rpg-feature-source" aria-label={`Source ${src.source}`}>
      <hgroup className={`rpg-feature-source-header rpg-feature-source-${src.kind}`}>
        <h4>{src.source}</h4>
        {src.level != null && <p><small>Lv. {src.level}</small></p>}
      </hgroup>

      {src.grants.length > 0 && (
        <dl aria-label="Tagged Grants">
          {src.grants.map(({ tag, values }) => (
            <React.Fragment key={tag}>
              <dt>{tagLabel(tag)}</dt>
              {values.map((v, i) => (
                <dd key={i}>+{v}</dd>
              ))}
            </React.Fragment>
          ))}
        </dl>
      )}

      {src.features.length > 0 && (
        <ul aria-label="Source Features">
          {src.features.map((f, i) => (
            <li key={i} className="rpg-feature-entry">
              <strong>{f.name}</strong>
              {f.type && <small> · {f.type.replace(/_/g, " ")}</small>}
              {f.uses != null && <small> · {f.uses} use{f.uses === 1 ? "" : "s"}</small>}
              {f.description && <span> — {f.description}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PendingChoiceRow({ pending }: { pending: PendingChoice }) {
  return (
    <aside className="rpg-feature-pending" aria-label={`Pending ${pending.feature.name}`}>
      <p>
        <strong>{pending.source}</strong>: pick {pending.remaining} more for{" "}
        <em>{pending.feature.name}</em>
      </p>
      {pending.options.length > 0 && (
        <menu aria-label="Choice Options">
          {pending.options.map((o, i) => {
            const label = o.name ?? o.value ?? "(unnamed)";
            const alreadyPicked = pending.picked.includes(label);
            return (
              <li key={i}>
                <button type="button" disabled={alreadyPicked} aria-pressed={alreadyPicked}>
                  {label}
                </button>
              </li>
            );
          })}
        </menu>
      )}
    </aside>
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

  return (
    <article aria-label="Character Features" className="rpg-feature-source-groups">
      <h3>Traits</h3>
      {view.sources.length === 0 ? (
        <p aria-details="No Sources"><em>No class, lineage, or background declared.</em></p>
      ) : (
        view.sources.map((src) => <SourceGroup key={`${src.source}:${src.kind}`} src={src} />)
      )}
      {view.pendingChoices.length > 0 && (
        <section aria-label="Pending Choices" className="rpg-feature-pending-list">
          <h3>Choices to make</h3>
          {view.pendingChoices.map((p) => (
            <PendingChoiceRow key={`${p.source}:${p.feature.name}`} pending={p} />
          ))}
        </section>
      )}
    </article>
  );
};

export default features;
