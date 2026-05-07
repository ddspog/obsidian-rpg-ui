import * as React from "react";
import {
  EntityBlock,
  EvalContext,
  FeatureDetails,
  Markdown,
  TableDef,
} from "rpg-ui-toolkit";

/** Resolve `[[Target]]` against the vault — returns null if no file exists. */
function resolveWikilink(link: string): string | null {
  const target = link.replace(/^\[\[|\]\]$/g, "").split("|")[0].split("#")[0].trim();
  if (!target) return null;
  const app = (globalThis as unknown as { app?: { metadataCache?: { getFirstLinkpathDest?: (path: string, source: string) => unknown } } }).app;
  const dest = app?.metadataCache?.getFirstLinkpathDest?.(target, "");
  return dest ? link : null;
}

/** Pretty-print `max` for a resource — scalar passes through (including
 *  string tokens like `"PB"`); `{ level: max }` map renders as
 *  `Lv1: 1, Lv6: 2`. */
function formatMax(max: FeatureDetails["max"]): string {
  if (max == null) return "";
  if (typeof max === "number") return String(max);
  if (typeof max === "string") return max;
  return Object.entries(max)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([lv, n]) => `Lv${lv}: ${n}`)
    .join(", ");
}

interface DetailsLookup {
  /** Tables declared in the same compendium document, keyed by name. */
  $tables?: Record<string, TableDef>;
}

/** True when the author asked to suppress the card title — accepts any of
 *  `"No Title"`, `"no-title"`, `"notitle"` (case-insensitive, whitespace
 *  and hyphens ignored) so compendium YAML can use whichever spelling
 *  reads best. */
function isNoTitleView(raw: unknown): boolean {
  if (typeof raw !== "string") return false;
  return raw.toLowerCase().replace(/[\s\-_]+/g, "") === "notitle";
}

export const details: EntityBlock<FeatureDetails, { lookup: DetailsLookup }> = ({
  self,
  lookup,
}) => {
  const resolvedLink = self.link ? resolveWikilink(self.link) : null;
  const isResource = self.type === "resource";
  const hideTitle = isNoTitleView(self.view);

  const context: EvalContext = React.useMemo(
    () => ({ tables: lookup?.$tables ?? {}, vars: {} }),
    [lookup?.$tables],
  );

  return (
    <article className="rpg-feature-card" aria-label={`Feature ${self.name}`}>
      <hgroup>
        {!hideTitle && <h3>{self.name}</h3>}
        <p>
          {self.subtitle ? (
            <small aria-details="Feature Subtitle">{self.subtitle}</small>
          ) : (
            <>
              {self.level != null && <small aria-details="Feature Level">Lv. {self.level}</small>}
              {self.uses != null && <small aria-details="Feature Uses">{self.uses} use{self.uses === 1 ? "" : "s"}</small>}
            </>
          )}
          {isResource && self.max != null && (
            <small aria-details="Resource Max">Max: {formatMax(self.max)}</small>
          )}
          {isResource && self.recovery && (
            <small aria-details="Resource Recovery">Recovery: {self.recovery}</small>
          )}
        </p>
      </hgroup>

      {self.text && (
        <Markdown source={self.text} context={context} className="rpg-feature-text" />
      )}

      {resolvedLink && (
        <Markdown source={resolvedLink} className="rpg-feature-link" />
      )}
    </article>
  );
};

export default details;
