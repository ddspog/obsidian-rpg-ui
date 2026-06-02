import * as React from "react";
import { Markdown } from "./markdown";
import { HabitatTreasureLine, InlineWikilinks } from "./statblock-shared";

export interface StatblockGroupProps {
  name: string;
  /** Optional subtitle (e.g. a shared type line); wikilinks render inline. */
  subtitle?: string;
  habitat?: string;
  treasure?: string;
  /** Descriptive prose (the group's contents). */
  body?: string;
  hideTitle?: boolean;
  sourcePath?: string;
}

/**
 * A monster group header — shared habitat/treasure + flavor for a set of
 * `stat.monster` blocks that link to it via `group:`. Renders the title bar,
 * subtitle, the justified Habitat/Treasure line, then the contents prose.
 */
export function StatblockGroup({
  name,
  subtitle,
  habitat,
  treasure,
  body,
  hideTitle,
  sourcePath,
}: StatblockGroupProps) {
  return (
    <article className="rpg-statblock rpg-statblock-group">
      {!hideTitle && (
        <header className="rpg-statblock-header">
          <h3>{name}</h3>
        </header>
      )}

      {subtitle ? (
        <p className="rpg-statblock-subtitle">
          <em>
            <InlineWikilinks text={subtitle} />
          </em>
        </p>
      ) : null}

      <HabitatTreasureLine habitat={habitat} treasure={treasure} />

      {body ? (
        <section className="rpg-statblock-desc">
          <Markdown source={body} sourcePath={sourcePath} />
        </section>
      ) : null}
    </article>
  );
}

export default StatblockGroup;
