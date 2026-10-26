/**
 * A battle map kept in a note of its own — the library entry a log's
 * `[COMBAT: [[Map]]]` and a hex map's place point at. This is the text of a
 * new one: the map block, then the notes a table wants to hand (cover,
 * hazards, loot), and where each side starts.
 */

import type { DetectedGrid } from "./detect-grid";

export interface MapNoteSpec {
  title: string;
  /** The picture, as a link (`[[ambush.webp]]`), and its grid when it was found. */
  image?: { link: string; grid?: DetectedGrid | null };
}

/** A note's file name from its title: no path or link characters. */
export function mapNoteName(title: string): string {
  return title
    .replace(/[\\/:*?"<>|#^[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const quote = (s: string) => `"${s.replace(/"/g, '\\"')}"`;

/** The note's text. */
export function mapNoteText({ title, image }: MapNoteSpec): string {
  const name = mapNoteName(title) || "Battle map";
  const block = image
    ? [
        "grid: square",
        `title: ${quote(name)}`,
        `image: ${quote(image.link)}`,
        `cell: ${image.grid ? Math.round(image.grid.cell * 100) / 100 : 33}   # pixels per square in the picture`,
        `offset: ${image.grid ? `${Math.round(image.grid.offsetX)}, ${Math.round(image.grid.offsetY)}` : "0, 0"}   # where the first grid line falls`,
        "tokens:   # where each side starts; press Place tokens on the map to move them",
        "---",
      ]
    : [
        "grid: square",
        `title: ${quote(name)}`,
        "legend:",
        '  ".": { terrain: grass }',
        '  "^": { terrain: rocks, cover: half }',
        '  "~": { terrain: water, difficult: true }',
        '  "#": { terrain: wall, blocks: true }',
        "---",
        "# # # # # # # # # # # #",
        "# . . . . . . . . . . #",
        "# . . . ^ ^ . . ~ ~ . #",
        "# . . . . . . . ~ ~ . #",
        "# . . . . . . . . . . #",
        "# # # # # # # # # # # #",
      ];
  return `---
cssclasses:
  - note-feature
---
# ${name}
Where it is, and what the party sees on arriving.

\`\`\`rpg map
${block.join("\n")}
\`\`\`

## Starting positions
- **Party:** where they come in, and why there.
- **Foes:** where they wait, and what they are doing.

## Cover and terrain
- Cover:
- Difficult ground:
- Blocked squares:

## Hazards
- 

## Loot
- 

## Notes for the GM
- How it usually goes, and what changes it.
`;
}
