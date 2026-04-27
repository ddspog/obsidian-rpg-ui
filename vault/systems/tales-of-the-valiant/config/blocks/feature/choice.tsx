import * as React from "react";
import { EntityBlock, FeatureChoiceOption, Markdown } from "rpg-ui-toolkit";

export const choice: EntityBlock<FeatureChoiceOption> = ({ self }) => {
  const label = self.name ?? "(unnamed)";

  return (
    <article className="rpg-feature-card rpg-feature-card-choice" aria-label={`Choice ${label}`}>
      <hgroup>
        <h5>{label}</h5>
        <p>
          <small aria-details="Choice Parent">→ {self.parent}</small>
          {self.type && <small aria-details="Choice Type">{self.type.replace(/_/g, " ")}</small>}
        </p>
      </hgroup>

      {self.text && (
        <Markdown source={self.text} className="rpg-feature-text" />
      )}

      {self.features && self.features.length > 0 && (
        <menu aria-label="Choice Sub-features">
          {self.features.map((f, i) => (
            <li key={i}>
              <strong>{f.name}</strong>
              {f.text && <Markdown source={f.text} className="rpg-feature-subtext" />}
            </li>
          ))}
        </menu>
      )}
    </article>
  );
};

export default choice;
