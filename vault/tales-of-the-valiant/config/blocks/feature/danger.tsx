import * as React from "react";
import { EntityBlock, Markdown } from "rpg-ui-toolkit";

/**
 * `rpg feature.danger` — an environmental hazard / trap / disease.
 *
 * Authored as a one-file compendium note: a YAML head (name, type, and the
 * Trigger / Effects / Resolution mechanics) followed by a `---` separator and
 * a flavour description in markdown. Rendered as a book-style hazard sidebar:
 *
 *   ```rpg feature.danger
 *   name: Extreme Cold
 *   type: Hazard
 *   trigger: …
 *   effects: …
 *   resolution: …
 *   ---
 *   Exposure to temperatures below 0 degrees Fahrenheit …
 *   ```
 *
 * It's modelled as a `feature` block (rather than a `rule.*` subtype) because
 * its effects are meant to be assignable to a character — a GM picks active
 * dangers in the character.features block and they surface in a dedicated
 * "Dangers" section (description + effects only, hidden when empty). That
 * character-sheet integration is a later phase; this block plus the
 * `@[[file]].danger()` import view are the standalone foundation.
 */
export interface DangerProps {
  /** Hazard name — the card title. */
  name?: string;
  /** Category subtitle, e.g. "Hazard", "Trap", "Disease". */
  type?: string;
  /** What sets the danger off. */
  trigger?: string;
  /** Mechanical effects — the one mechanic also shown on a character sheet. */
  effects?: string;
  /** How the danger ends or resets. */
  resolution?: string;
  /** Flavour description (the markdown body after the `---` separator). */
  text?: string;
  /** Title heading level (1–6); defaults to 3 so it nests under doc h1/h2. */
  heading?: number;
}

/** One run-in mechanic line ("**Trigger** …"). Renders nothing when empty so
 *  a danger can omit any of trigger / effects / resolution. */
function Mechanic({
  label,
  value,
  sourcePath,
}: {
  label: string;
  value?: string;
  sourcePath?: string;
}) {
  if (typeof value !== "string" || !value.trim()) return null;
  return (
    <div className="rpg-danger-card__mechanic">
      <dt>{label}</dt>
      <dd>
        <Markdown source={value.trim()} sourcePath={sourcePath} />
      </dd>
    </div>
  );
}

export interface DangerCardProps extends DangerProps {
  /** Path of the host note, for relative wikilink resolution in markdown. */
  sourcePath?: string;
}

/** Pure presentational card — shared by the `feature.danger` block and the
 *  `@[[file]].danger()` import view so both render identically. */
export function DangerCard({
  name,
  type,
  trigger,
  effects,
  resolution,
  text,
  heading,
  sourcePath,
}: DangerCardProps) {
  const HeadingTag = `h${Math.max(1, Math.min(6, heading ?? 3))}` as
    | "h1"
    | "h2"
    | "h3"
    | "h4"
    | "h5"
    | "h6";
  const hasMechanics = [trigger, effects, resolution].some(
    (v) => typeof v === "string" && v.trim()
  );
  return (
    <article className="rpg-danger-card" aria-label={`Danger ${name ?? ""}`.trim()}>
      <hgroup>
        <HeadingTag>{name}</HeadingTag>
        {type && (
          <p>
            <small aria-details="Danger Type">{type}</small>
          </p>
        )}
      </hgroup>

      {text && (
        <Markdown source={text} sourcePath={sourcePath} className="rpg-danger-card__desc" />
      )}

      {hasMechanics && (
        <dl className="rpg-danger-card__mechanics">
          <Mechanic label="Trigger" value={trigger} sourcePath={sourcePath} />
          <Mechanic label="Effects" value={effects} sourcePath={sourcePath} />
          <Mechanic label="Resolution" value={resolution} sourcePath={sourcePath} />
        </dl>
      )}
    </article>
  );
}

/** Entity-block wrapper: maps parsed YAML (`self`) onto the shared card. The
 *  description body after `---` arrives as `self.text` (see the EntityBlock
 *  body-split in main.ts). */
export const danger: EntityBlock<DangerProps> = ({ self }) => (
  <DangerCard
    name={self.name}
    type={self.type}
    trigger={self.trigger}
    effects={self.effects}
    resolution={self.resolution}
    text={self.text}
    heading={self.heading}
  />
);

export default danger;
