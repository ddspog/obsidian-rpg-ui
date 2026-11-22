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
  type StatMarks,
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
  /** Values to mark as changed, with what they were (a template sheet's Try on). */
  marks?: StatMarks;
  /** No role chip (a summon, whose role its caller decides). */
  hideRole?: boolean;
  /** A kind shown in the title bar ("Summon"). */
  kind?: string;
  /** Controls shown under the type line (a summon's circle, form, summoner). */
  controls?: React.ReactNode;
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
  marks,
  kind,
  controls,
  hideRole,
}: StatblockMonsterProps) {
  const { traits, sections } = React.useMemo(() => groupFeatures(features), [features]);
  // A guess needs the features: until they are resolved only a written role shows.
  const guesses = settingsStore.getSettings()?.statblockRoleGuesses ?? "sure";
  const shown = React.useMemo(() => {
    const found =
      !hideRole && (role || features.length > 0)
        ? statblockRole({ name, type, cr, stats, features, role, subrole })
        : undefined;
    // A guess shows as the settings say: every one, the fairly sure ones, or none.
    if (!found || found.written) return found;
    if (guesses === "none" || (guesses === "sure" && found.confidence === "low")) return undefined;
    return found;
  }, [name, type, cr, stats, features, role, subrole, guesses, hideRole]);
  const [explained, setExplained] = React.useState(false);
  // A long name: the role chip leaves the title bar for the type line, so the name keeps the bar.
  const [roleBelow, setRoleBelow] = React.useState(false);
  const headerRef = React.useRef<HTMLElement>(null);
  const probeRef = React.useRef<HTMLSpanElement>(null);
  const crRef = React.useRef<HTMLSpanElement>(null);
  const chipWidth = React.useRef(0);
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

  const roleChip = shown ? (
    <button
      type="button"
      className={`rpg-statblock-role rpg-statblock-role--${shown.role}${shown.written ? "" : " is-guess"}`}
      aria-expanded={explained}
      aria-controls={noteId}
      title={roleNote}
      onClick={() => setExplained((v) => !v)}
      ref={(el) => {
        if (el && !roleBelow) chipWidth.current = el.offsetWidth;
      }}
    >
      {roleLabel}
      {shown.written ? null : (
        <span aria-hidden="true" className="rpg-statblock-role-q">
          ?
        </span>
      )}
      {shown.written ? null : <span className="rpg-sr-only"> (guessed)</span>}
    </button>
  ) : null;

  React.useLayoutEffect(() => {
    const header = headerRef.current;
    const probe = probeRef.current;
    if (!header || !probe || !shown) return;
    const measure = () => {
      const style = getComputedStyle(header);
      const inner = header.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const cr = crRef.current?.offsetWidth ?? 0;
      // Name, gap, chip, gap, CR: the gaps are the header's (12px) and the group's (8px).
      const room = inner - cr - (chipWidth.current ? chipWidth.current + 8 : 0) - 12;
      setRoleBelow(probe.offsetWidth > room);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    return () => observer.disconnect();
  }, [shown, name, cr]);

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
        <header className="rpg-statblock-header" ref={headerRef}>
          <h3>
            {name}
            {/* The name on one line, unseen: measured to know whether it fits beside the role and CR. */}
            <span className="rpg-statblock-name-probe" aria-hidden="true" ref={probeRef}>
              {name}
            </span>
          </h3>
          {/* Role and CR stay together; when the name would wrap beside them, the role moves to the type line. */}
          <span className="rpg-statblock-header-meta">
            {kind ? <span className="rpg-statblock-kind">{kind}</span> : null}
            {shown && !roleBelow ? roleChip : null}
            {cr ? (
              <span className="rpg-statblock-cr" ref={crRef}>
                CR {cr}
              </span>
            ) : null}
          </span>
        </header>
      )}

      <p className={`rpg-statblock-subtitle${marks?.changed.includes("type") ? " rpg-statblock-changed" : ""}`}>
        <em>
          <InlineWikilinks text={type} />
        </em>
        {shown && roleBelow ? roleChip : null}
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

      {controls}

      <dl className="rpg-statblock-stats">
        {renderStatEntries(Object.entries(displayStats), STAT_LABELS, PAIRED_STATS, sourcePath, marks)}
      </dl>

      <AbilitiesTable abilities={abilities} unknown={unknownAbilities} marks={marks} />

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
