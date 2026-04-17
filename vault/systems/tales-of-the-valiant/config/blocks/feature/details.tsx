import * as React from "react";
import { EntityBlock } from "rpg-ui-toolkit";
import type { FeatureDetails } from "../../../../../../lib/domains/features/types";

export const details: EntityBlock<FeatureDetails> = ({ self }) => {
  const values = self.values && self.values.length > 0 ? self.values : self.value ? [self.value] : [];

  return (
    <article className="rpg-feature-card" aria-label={`Feature ${self.name}`}>
      <hgroup>
        <h4>{self.name}</h4>
        <p>
          {self.level != null && <small aria-details="Feature Level">Lv. {self.level}</small>}
          {self.type && <small aria-details="Feature Type">{self.type.replace(/_/g, " ")}</small>}
          {self.uses != null && <small aria-details="Feature Uses">{self.uses} use{self.uses === 1 ? "" : "s"}</small>}
          {self.pick != null && <small aria-details="Feature Pick">Pick {self.pick}</small>}
        </p>
      </hgroup>

      {self.tag && values.length > 0 && (
        <dl aria-label="Feature Grant">
          <dt>{self.tag.replace(/_/g, " ")}</dt>
          {values.map((v, i) => (
            <dd key={i}>{v}</dd>
          ))}
        </dl>
      )}

      {self.description && <p aria-label="Feature Description">{self.description}</p>}

      {self.link && (
        <p aria-label="Feature Link">
          <a href={self.link.replace(/^\[\[|\]\]$/g, "")}>{self.link.replace(/^\[\[|\]\]$/g, "")}</a>
        </p>
      )}
    </article>
  );
};

export default details;
