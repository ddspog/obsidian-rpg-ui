import * as React from "react";
import { EntityBlock, FeatureDetails, Markdown } from "rpg-ui-toolkit";

/** Resolve `[[Target]]` against the vault — returns null if no file exists. */
function resolveWikilink(link: string): string | null {
  const target = link.replace(/^\[\[|\]\]$/g, "").split("|")[0].split("#")[0].trim();
  if (!target) return null;
  const app = (globalThis as unknown as { app?: { metadataCache?: { getFirstLinkpathDest?: (path: string, source: string) => unknown } } }).app;
  const dest = app?.metadataCache?.getFirstLinkpathDest?.(target, "");
  return dest ? link : null;
}

export const details: EntityBlock<FeatureDetails> = ({ self }) => {
  const resolvedLink = self.link ? resolveWikilink(self.link) : null;

  return (
    <article className="rpg-feature-card" aria-label={`Feature ${self.name}`}>
      <hgroup>
        <h3>{self.name}</h3>
        <p>
          {self.subtitle ? (
            <small aria-details="Feature Subtitle">{self.subtitle}</small>
          ) : (
            <>
              {self.level != null && <small aria-details="Feature Level">Lv. {self.level}</small>}
              {self.type && <small aria-details="Feature Type">{self.type.replace(/_/g, " ")}</small>}
              {self.uses != null && <small aria-details="Feature Uses">{self.uses} use{self.uses === 1 ? "" : "s"}</small>}
              {self.pick != null && <small aria-details="Feature Pick">Pick {self.pick}</small>}
            </>
          )}
        </p>
      </hgroup>

      {self.text && (
        <Markdown source={self.text} className="rpg-feature-text" />
      )}

      {resolvedLink && (
        <Markdown source={resolvedLink} className="rpg-feature-link" />
      )}
    </article>
  );
};

export default details;
