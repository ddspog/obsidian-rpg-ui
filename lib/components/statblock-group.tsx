import * as React from "react";
import { Markdown } from "./markdown";
import { HabitatTreasureLine, InlineWikilinks } from "./statblock-shared";

export interface StatblockCategoryProps {
  name: string;
  subtitle?: string;
  habitat?: string;
  treasure?: string;
  body?: string;
  hideTitle?: boolean;
  sourcePath?: string;
}

/**
 * A monster category header — shared habitat/treasure + flavor for a set of
 * `stat.monster` blocks that link to it via `category:`. Renders the title bar,
 * subtitle, the justified Habitat/Treasure line, then the contents prose.
 */
export function StatblockCategory({
  name,
  subtitle,
  habitat,
  treasure,
  body,
  hideTitle,
  sourcePath,
}: StatblockCategoryProps) {
  return (
    <article className="rpg-statblock rpg-statblock-category">
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

/** @deprecated Use StatblockCategory */
export const StatblockGroup = StatblockCategory;
/** @deprecated Use StatblockCategoryProps */
export type StatblockGroupProps = StatblockCategoryProps;

export default StatblockCategory;
