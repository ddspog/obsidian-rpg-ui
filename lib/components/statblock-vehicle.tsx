import * as React from "react";
import { Markdown } from "./markdown";
import type { AbilityScores, ResolvedStatFeature } from "../domains/statblocks/types";
import {
  AbilitiesTable,
  FeatureSections,
  groupFeatures,
  renderStatEntries,
} from "./statblock-shared";

export interface StatblockVehicleProps {
  name: string;
  size: string;
  type: string;
  dimensions?: string;
  stats: Record<string, string>;
  abilities: AbilityScores;
  features: ResolvedStatFeature[];
  body?: string;
  image?: string;
  view?: string;
  hideTitle?: boolean;
  sourcePath?: string;
}

const STAT_LABELS: Record<string, string> = {
  ac: "Armor Class",
  hp: "Hit Points",
  speed: "Speed",
  immune: "Immune",
  initiative: "Initiative",
  crew: "Crew",
  passengers: "Passengers",
  cargo: "Cargo Capacity",
};

const PAIRED_STATS = new Set(["crew", "passengers"]);

export function StatblockVehicle({
  name,
  size,
  type,
  dimensions,
  stats,
  abilities,
  features,
  body,
  image,
  view,
  hideTitle,
  sourcePath,
}: StatblockVehicleProps) {
  const { traits, sections } = React.useMemo(() => groupFeatures(features), [features]);
  const subtitle = dimensions ? `${size} ${type} (${dimensions})` : `${size} ${type}`;
  const descAfter = view === "desc-after";

  const description = body ? (
    <section className="rpg-statblock-desc">
      <Markdown source={body} sourcePath={sourcePath} />
    </section>
  ) : null;

  return (
    <article className="rpg-statblock rpg-statblock-vehicle">
      {!descAfter && description}

      {!hideTitle && (
        <header className="rpg-statblock-header">
          <h3>{name}</h3>
        </header>
      )}
      <p className="rpg-statblock-subtitle">
        <em>{subtitle}</em>
      </p>

      <dl className="rpg-statblock-stats">
        {renderStatEntries(Object.entries(stats), STAT_LABELS, PAIRED_STATS, sourcePath)}
      </dl>

      <AbilitiesTable abilities={abilities} />

      <FeatureSections traits={traits} sections={sections} sourcePath={sourcePath} />

      {descAfter && description}

      {image ? (
        <figure className="rpg-statblock-figure">
          <Markdown source={image} sourcePath={sourcePath} />
        </figure>
      ) : null}
    </article>
  );
}

export default StatblockVehicle;
