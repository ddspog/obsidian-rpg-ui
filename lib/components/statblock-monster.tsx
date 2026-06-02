import * as React from "react";
import { Markdown } from "./markdown";
import type { AbilityScores, ResolvedStatFeature } from "../domains/statblocks/types";
import {
  AbilitiesTable,
  FeatureSections,
  groupFeatures,
  HabitatTreasureLine,
  InlineWikilinks,
  renderStatEntries,
} from "./statblock-shared";

export interface StatblockMonsterProps {
  name: string;
  /** Full type line, e.g. `Large [[Beast]]` (wikilinks render inline). */
  type: string;
  /** Challenge-rating display value (e.g. `1`). */
  cr?: string;
  /** Habitat line — shown (with treasure) below the card when ungrouped. */
  habitat?: string;
  /** Treasure line — shown (with habitat) below the card when ungrouped. */
  treasure?: string;
  /** Markdown image ref (`![[creature.webp|384]]`). */
  image?: string;
  /** When set (a `stat.group` link), habitat/treasure come from the group
   *  and are not rendered on the monster card. */
  group?: string;
  stats: Record<string, string>;
  abilities: AbilityScores;
  features: ResolvedStatFeature[];
  body?: string;
  hideTitle?: boolean;
  sourcePath?: string;
}

const STAT_LABELS: Record<string, string> = {
  ac: "Armor Class",
  hp: "Hit Points",
  speed: "Speed",
  immune: "Immunities",
  pas_perception: "Perception",
  pas_stealth: "Stealth",
  vulnerable: "Vulnerable",
  resistant: "Resistant",
  senses: "Senses",
  languages: "Languages",
};

const PAIRED_STATS = new Set(["pas_perception", "pas_stealth"]);

export function StatblockMonster({
  name,
  type,
  cr,
  habitat,
  treasure,
  image,
  group,
  stats,
  abilities,
  features,
  body,
  hideTitle,
  sourcePath,
}: StatblockMonsterProps) {
  const { traits, sections } = React.useMemo(() => groupFeatures(features), [features]);

  const description = body ? (
    <section className="rpg-statblock-desc">
      <Markdown source={body} sourcePath={sourcePath} />
    </section>
  ) : null;

  // Ensure senses and languages always appear (with __ when empty).
  const displayStats = { ...stats };
  if (!displayStats.senses) displayStats.senses = "__";
  if (!displayStats.languages) displayStats.languages = "__";

  return (
    <article className="rpg-statblock rpg-statblock-monster">
      {!hideTitle && (
        <header className="rpg-statblock-header">
          <h3>{name}</h3>
          {cr ? <span className="rpg-statblock-cr">CR {cr}</span> : null}
        </header>
      )}

      <p className="rpg-statblock-subtitle">
        <em>
          <InlineWikilinks text={type} />
        </em>
      </p>

      <dl className="rpg-statblock-stats">
        {renderStatEntries(Object.entries(displayStats), STAT_LABELS, PAIRED_STATS, sourcePath)}
      </dl>

      <AbilitiesTable abilities={abilities} />

      <FeatureSections traits={traits} sections={sections} sourcePath={sourcePath} />

      {description}

      {image ? (
        <figure className="rpg-statblock-figure">
          <Markdown source={image} sourcePath={sourcePath} />
        </figure>
      ) : null}

      {/* Habitat / treasure footer — only when the monster isn't grouped
          (a grouped monster inherits these from its `stat.group`). */}
      {group ? null : <HabitatTreasureLine habitat={habitat} treasure={treasure} />}
    </article>
  );
}

export default StatblockMonster;
