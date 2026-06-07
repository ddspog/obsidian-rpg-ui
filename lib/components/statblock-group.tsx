import * as React from "react";
import { Markdown } from "./markdown";
import { HabitatTreasureLine, InlineWikilinks } from "./statblock-shared";

export interface StatblockCategoryProps {
  name: string;
  /** Heading level (1–6) for the title; defaults to 2. */
  level?: number;
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
  level,
  subtitle,
  habitat,
  treasure,
  body,
  hideTitle,
  sourcePath,
}: StatblockCategoryProps) {
  const Heading = `h${Math.min(6, Math.max(1, level ?? 2))}` as
    | "h1"
    | "h2"
    | "h3"
    | "h4"
    | "h5"
    | "h6";
  return (
    <article className="rpg-statblock rpg-statblock-category">
      {!hideTitle && (
        <header className="rpg-statblock-header">
          <Heading>{name}</Heading>
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
