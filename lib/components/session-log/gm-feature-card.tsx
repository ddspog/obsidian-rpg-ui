import * as React from "react";
import type { GMFeature, GMStack } from "../../domains/features/types";
import { gmPrimaryStack } from "../../domains/gm/emit";
import { collectResources } from "../../domains/lonelog/dial-ops";
import type { GMStepContext } from "../../domains/gm/example";
import { Markdown } from "../markdown";
import { InlineMarkdown } from "./inline-markdown";
import { FeatureExample } from "./feature-example";
import { GMFeatureBody } from "./gm-feature-body";

const STACK_LABELS: Record<GMStack, string> = {
  oracle: "Oracle",
  meaning: "Meaning",
  list: "List",
  combat: "Combat",
  roll: "Roll",
  table: "Table",
  generator: "Generator",
  event: "Event",
  scene: "Scene",
};

/**
 * In-place render of a single `rpg feature.gm` block in its GM Screen file.
 * Mirrors the `feature.details` compendium card (same `.rpg-feature-card`
 * structure + classes) so a GM Screen reads like a compendium page — a heading
 * and flowing prose, no card chrome. The block's oracle/roll/etc. aspects stay
 * as data (they define the log snippet appended on the session log) and aren't
 * shown here.
 */
export function GMFeatureCard({
  feature,
  sourcePath,
  stepCtx,
}: {
  feature: GMFeature;
  sourcePath?: string;
  stepCtx?: GMStepContext;
}) {
  const stack = gmPrimaryStack(feature);
  // Heading level for the name: 1–6, or `"none"` to suppress it (default 3).
  const headingLevel = feature.heading === "none" ? null : typeof feature.heading === "number" ? feature.heading : 3;
  const HeadingTag = headingLevel ? (`h${headingLevel}` as keyof React.JSX.IntrinsicElements) : null;
  return (
    <article className="rpg-feature-card" aria-label={`Feature ${feature.name}`}>
      <hgroup>
        {HeadingTag && <HeadingTag>{feature.name}</HeadingTag>}
        <p>
          {stack && <small aria-details="GM Stack">{STACK_LABELS[stack]}</small>}
          {feature.uses != null && (
            <small aria-details="Feature Uses">
              {feature.uses} use{feature.uses === 1 ? "" : "s"}
            </small>
          )}
          {feature.recovery && <small aria-details="Recovery">Recovery: {feature.recovery}</small>}
        </p>
      </hgroup>
      {feature.text && <Markdown source={feature.text} sourcePath={sourcePath} className="rpg-feature-text" />}
      {feature.body ? (
        <GMFeatureBody
          feature={feature}
          sourcePath={sourcePath}
          stepCtx={stepCtx}
          decls={stepCtx?.resources ?? collectResources([feature])}
        />
      ) : (
        feature.example && <FeatureExample feature={feature} sourcePath={sourcePath} stepCtx={stepCtx} />
      )}
      {feature.source && (
        <p className="rpg-feature-card-source">
          <InlineMarkdown source={feature.source} sourcePath={sourcePath ?? ""} />
        </p>
      )}
    </article>
  );
}
