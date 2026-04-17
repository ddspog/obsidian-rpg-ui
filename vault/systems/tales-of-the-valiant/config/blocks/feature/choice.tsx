import * as React from "react";
import { EntityBlock } from "rpg-ui-toolkit";
import type { FeatureChoiceOption } from "../../../../../../lib/domains/features/types";

export const choice: EntityBlock<FeatureChoiceOption> = ({ self }) => {
  const label = self.name ?? self.value ?? "(unnamed)";
  const values = self.values && self.values.length > 0 ? self.values : self.value && !self.name ? [] : self.value ? [self.value] : [];

  return (
    <article className="rpg-feature-card rpg-feature-card-choice" aria-label={`Choice ${label}`}>
      <hgroup>
        <h5>{label}</h5>
        <p>
          <small aria-details="Choice Parent">→ {self.parent}</small>
          {self.tag && <small aria-details="Choice Tag">{self.tag.replace(/_/g, " ")}</small>}
        </p>
      </hgroup>

      {values.length > 0 && (
        <ul aria-label="Choice Grants">
          {values.map((v, i) => (
            <li key={i}>{v}</li>
          ))}
        </ul>
      )}

      {self.description && <p aria-label="Choice Description">{self.description}</p>}

      {self.features && self.features.length > 0 && (
        <menu aria-label="Choice Sub-features">
          {self.features.map((f, i) => (
            <li key={i}>
              <strong>{f.name}</strong>
              {f.description && <span> — {f.description}</span>}
            </li>
          ))}
        </menu>
      )}
    </article>
  );
};

export default choice;
