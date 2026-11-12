/**
 * How rulebooks of the 5e family word the lines that mark an entity, whatever
 * type they are set in. The layout uses them to keep such a line a line of
 * its own; the recognisers use them to tell what a section is.
 */

/** A stat block's or a spell's fact: a known label, then its value. */
export const FACT_LINE =
  /^(?:(?:armor class|hit points|speed|challenge|casting time|range|components?|duration)(?:\s*:|\s+[\d+−–—-])|(?:senses|languages|skills|saving throws|saves|vulnerable|resistant|immune|damage (?:resistances|immunities|vulnerabilities)|condition immunities)\s+(?!(?:is|are|can|and|of|to|that|in|for|you|your|the)\b)|str\s+dex\s+con\b)/i;

/** The line under a spell's name: `2nd-Circle Arcane (Evocation)`, `3rd-level evocation (ritual)`, `Evocation cantrip`, `Level 2 Evocation (Wizard)`. */
export const SPELL_HEAD =
  /^(?:[0-9a-z]{1,2}(?:st|nd|rd|th)[- ]?(?:circle|level)\s*[a-z]+(?:\s*(?:,|and|or)\s*[a-z]+)*\s*(?:\([a-z ]+\))?\s*(?:\(ritual\))?|[a-z]+(?:\s*(?:,|and|or)\s*[a-z]+)*\s+cantrip\s*(?:\([a-z ]+\))?|level \d+ [a-z]+\s*(?:\([a-z ,]+\))?)$/i;

/** The line under a magic item's name: `Wondrous Item, Uncommon 1,000 gp`, `Weapon (any sword), rare (requires attunement)`. */
export const MAGIC_HEAD =
  /^((?:Armor|Weapon|Wondrous Item|Potion|Ring|Rod|Staff|Wand|Scroll|Ammunition|Shield)s?\b(?:\s*\([^)]*\))?[^,]*),\s*(.*(?:Common|Uncommon|Rare|Legendary|Fabled|Artifact|Varies).*)$/i;

/** The line under a creature's name: `Large Beast`, `Medium humanoid (any race), any alignment`. */
export const CREATURE_TYPE = /^(tiny|small|medium|large|huge|gargantuan)\b(?:[^.!?(]|\([^)]*\)){2,70}$/i;

/** A line that opens an entity's facts, so the line above it is the entity's name. */
export const opensEntity = (text: string): boolean =>
  text.length <= 110 && (SPELL_HEAD.test(text) || MAGIC_HEAD.test(text) || CREATURE_TYPE.test(text));

/** A name set as the first words of a paragraph, where no emphasis marks it (a scan): `Bite. Melee Weapon Attack…`. */
export const PLAIN_RUN_IN =
  /^([A-Z][A-Za-z’'\-/]*(?: (?:[A-Za-z’'\-/]+|\d+)){0,4}(?: \([^)]{1,32}\))?)[.:]\s+(?=[A-Z(+\d])/;
