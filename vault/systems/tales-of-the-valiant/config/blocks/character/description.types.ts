/**
 * Types for the Description block of the Character Entity.
 *
 * Authored as a single `rpg character.description` YAML fence. Each top-level
 * key maps to a tab (appearance, backstory, allies + enemies, organizations,
 * motivation). The UI surfaces whichever tabs have content — a missing key
 * collapses its tab visually rather than erroring.
 */

/** Flat key/value row for an Appearance "side prop" group. YAML authors a
 *  list of rows; each row renders as a horizontal fieldset labelled with the
 *  keys (`AGE`, `HEIGHT`, `WEIGHT`) above the values. Numbers coerce to
 *  strings on render. */
export type SidePropRow = {
  [label: string]: string | number;
};

/** How the character art fills its reserved box.
 *   - `cover`   (default): scale to fill, crop the overflow via `align`.
 *   - `contain`: letterbox — whole image visible, no crop.
 *   - `width`:   match the frame's width exactly, height proportional.
 *                Vertical overflow is clipped and nudged by `align`.
 *   - `height`:  match the frame's height exactly, width proportional.
 *                Horizontal overflow is clipped and nudged by `align`.
 */
export type ArtFit = "cover" | "contain" | "width" | "height";

/** Where the visible part of the image anchors when cropping happens.
 *  Accepts single keywords (`top`, `bottom`, `left`, `right`, `center`),
 *  two-axis pairs (`top left`, `bottom right`, `center center`), or any
 *  raw CSS `object-position` value (`20% 40%`, `right 10%`). For
 *  `fit: width` only the vertical component matters; for `fit: height`
 *  only the horizontal. */
export type ArtAlign = string;

/** Object form of `appearance.art`. The scalar wikilink shorthand
 *  (`art: "[[portrait.webp]]"`) is always valid too — the renderer
 *  accepts either. */
export type ArtObject = {
  /** Wikilink / path to the image. Same shape PortraitThumb accepts. */
  src: string | unknown;
  fit?: ArtFit;
  align?: ArtAlign;
};

export type AppearanceSection = {
  /** Prose about the character's physical build / face / hair (markdown). */
  body?: string;
  /** Prose about outfit / signature garments (markdown). */
  clothes?: string;
  /** Grouped quick-facts shown as label/value grids. Author one object per
   *  group to keep related facts together (e.g. `[ {age, height, weight},
   *  {eyes, skin, hair} ]`). */
  side_props?: SidePropRow[];
  /** Main art asset. Two shapes accepted:
   *    art: "[[portrait.webp]]"                 # simple
   *    art: { src: "[[portrait.webp]]",         # rich
   *           fit: cover | contain | width | height,
   *           align: top | center | ... | "20% 40%" }
   *  Distinct from `health.portrait` — this is the big 40%-width hero
   *  image on the Appearance tab. */
  art?: string | ArtObject | unknown;
};

/** One highlight row shown beneath the backstory. Two shapes are accepted:
 *   - `{ key, value }`  → renders as a definition row (dt + dd).
 *   - `{ footnote }`    → renders as a full-width muted italic line, meant
 *                         for TLDR subtitles (`_An character with good
 *                         connections to nobility._`). */
export type BackstoryHighlight = {
  key?: string;
  value?: string;
  footnote?: string;
};

export type BackstorySection = {
  /** Pill displayed above the story. May be a wikilink. */
  homeland?: string | unknown;
  /** Scrollable narrative — multi-line markdown with wikilinks, emphasis,
   *  embeds. The tab gives this a capped height so long backstories don't
   *  push other tabs' content off-screen. */
  text?: string;
  /** TLDR bullets. Order preserved; mix `{key, value}` and `{footnote}`
   *  freely — the renderer branches per-row. */
  highlights?: BackstoryHighlight[];
};

/** Shared shape for ally / enemy / organization rows. Each renders as a
 *  ribbon (name + role + portrait) beside body prose. */
export type RibbonEntry = {
  /** Display name. May be a plain string or a wikilink. */
  name: string;
  /** Small subtitle inside the ribbon ("Guardian", "Lover", "Rival", …). */
  role?: string;
  /** Wikilink to a portrait image. Absent → ribbon renders without art. */
  portrait?: string | unknown;
  /** Body prose attached to the entry (markdown). */
  text?: string;
};

export type OrganizationEntry = RibbonEntry & {
  /** Character's standing inside the organization ("Graduating, on final
   *  quest", "Initiate", "Full Member", …). Rendered in a dedicated footer
   *  below the ribbon row rather than inside it. */
  position?: string;
};

export type MotivationCard = {
  /** Card body (markdown). */
  text: string;
  /** Optional per-card accent. Any CSS colour string. */
  color?: string;
};

export type DescriptionBlockData = {
  appearance?: AppearanceSection;
  backstory?: BackstorySection;
  allies?: RibbonEntry[];
  enemies?: RibbonEntry[];
  organizations?: OrganizationEntry[];
  motivation?: MotivationCard[];
};
