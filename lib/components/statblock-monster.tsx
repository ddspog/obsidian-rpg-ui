import * as React from "react";
import { SUBROLE_MEANING } from "../domains/encounter-sim/monster-role";
import { statblockRole } from "../domains/encounter-sim/statblock-role";
import { settingsStore } from "../services/settings-store";
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
  /** When set (a `stat.category` link), habitat/treasure come from the category
   *  and are not rendered on the monster card. */
  category?: string;
  stats: Record<string, string>;
  abilities: AbilityScores;
  /** Scores not known (written as "—"): shown as "—". */
  unknownAbilities?: Array<keyof AbilityScores>;
  features: ResolvedStatFeature[];
  body?: string;
  hideTitle?: boolean;
  sourcePath?: string;
  /** Monster Vault role as written (`role:`); without it the card shows a guess, marked as one. */
  role?: string;
  /** Its subrole as written (`subrole:`). */
  subrole?: string;
}

const STAT_LABELS: Record<string, string> = {
  ac: "Armor Class",
  hp: "Hit Points",
  speed: "Speed",
  immune: "Immune",
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
  category,
  stats,
  abilities,
  unknownAbilities,
  features,
  body,
  hideTitle,
  sourcePath,
  role,
  subrole,
}: StatblockMonsterProps) {
  const { traits, sections } = React.useMemo(() => groupFeatures(features), [features]);
  // A guess needs the features: until they are resolved only a written role shows.
  const guesses = settingsStore.getSettings()?.statblockRoleGuesses ?? "sure";
  const shown = React.useMemo(() => {
    const found =
      role || features.length > 0 ? statblockRole({ name, type, cr, stats, features, role, subrole }) : undefined;
    // A guess shows as the settings say: every one, the fairly sure ones, or none.
    if (!found || found.written) return found;
    if (guesses === "none" || (guesses === "sure" && found.confidence === "low")) return undefined;
    return found;
  }, [name, type, cr, stats, features, role, subrole, guesses]);
  const [explained, setExplained] = React.useState(false);
  const noteId = React.useId();
  const roleLabel = shown ? shown.role[0].toUpperCase() + shown.role.slice(1) : "";
  const subroleLabel = shown ? shown.subrole.replace(/-/g, " ") : "";
  // Shown on a tap (a phone has no hover): what the role means and, for a guess, how to settle it.
  const roleNote = shown
    ? `${roleLabel}, ${subroleLabel}: ${SUBROLE_MEANING[shown.subrole]}.` +
      (shown.written
        ? ""
        : ` Guessed from the statblock (${shown.confidence} confidence), not written in it: settle it with rpg sim roles --set "${name}=${shown.role}/${shown.subrole}".`)
    : "";

  const description = body ? (
    <section className="rpg-statblock-desc">
      <Markdown source={body} sourcePath={sourcePath} />
    </section>
  ) : null;

  // Senses and languages always appear (with __ when empty) and always sit at
  // the end, senses before languages. Building the map explicitly avoids
  // appending a missing `senses` *after* an existing `languages`.
  const displayStats: Record<string, string> = {};
  for (const [k, v] of Object.entries(stats)) {
    if (k === "senses" || k === "languages") continue;
    displayStats[k] = v;
  }
  displayStats.senses = stats.senses ?? "__";
  displayStats.languages = stats.languages ?? "__";

  return (
    <article className="rpg-statblock rpg-statblock-monster">
      {!hideTitle && (
        <header className="rpg-statblock-header">
          <h3>{name}</h3>
          {/* Role and CR stay together; on a narrow card they drop under the name as one. */}
          <span className="rpg-statblock-header-meta">
            {shown ? (
              <button
                type="button"
                className={`rpg-statblock-role rpg-statblock-role--${shown.role}${shown.written ? "" : " is-guess"}`}
                aria-expanded={explained}
                aria-controls={noteId}
                title={roleNote}
                onClick={() => setExplained((v) => !v)}
              >
                {roleLabel}
                {shown.written ? null : (
                  <span aria-hidden="true" className="rpg-statblock-role-q">
                    ?
                  </span>
                )}
                {shown.written ? null : <span className="rpg-sr-only"> (guessed)</span>}
              </button>
            ) : null}
            {cr ? <span className="rpg-statblock-cr">CR {cr}</span> : null}
          </span>
        </header>
      )}

      <p className="rpg-statblock-subtitle">
        <em>
          <InlineWikilinks text={type} />
        </em>
        {shown ? (
          <span className={`rpg-statblock-subrole rpg-statblock-subrole--${shown.role}`}>
            <span className="rpg-statblock-subrole-dot" aria-hidden="true">
              {" · "}
            </span>
            {subroleLabel}
          </span>
        ) : null}
      </p>
      {shown && explained ? (
        <p id={noteId} className="rpg-statblock-role-note">
          {roleNote}
        </p>
      ) : null}

      <dl className="rpg-statblock-stats">
        {renderStatEntries(Object.entries(displayStats), STAT_LABELS, PAIRED_STATS, sourcePath)}
      </dl>

      <AbilitiesTable abilities={abilities} unknown={unknownAbilities} />

      <FeatureSections traits={traits} sections={sections} sourcePath={sourcePath} />

      {description}

      {image ? (
        <figure className="rpg-statblock-figure">
          <Markdown source={image} sourcePath={sourcePath} />
        </figure>
      ) : null}

      {/* Habitat / treasure footer — only when the monster has no category
          (a categorized monster inherits these from its `stat.category`). */}
      {category ? null : <HabitatTreasureLine habitat={habitat} treasure={treasure} />}
    </article>
  );
}

export default StatblockMonster;
