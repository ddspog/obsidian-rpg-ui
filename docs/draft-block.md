# `rpg draft` — the GM's drafting block

A scratchpad for preparing an adventure that ends in a prompt for an LLM.

````md
```rpg draft
draft: Kobold cult in the Pointy Woods
gm: "[[00. GM Screen]]"
map: "[[Pointy Woods]]"
level: 2
hexes: [[33, -51]]
attach: ["[[Kobolds]]"]
ask: encounter
---
The cult tracks Kowyn to the wreck.
```
````

The ideas below `---` are a lonelog, and the block reads them as a log block
does:

- **Prose** tells them, with the **Log** beside it (or under it, when the
  page is narrow): every roll there is editable and rerolls with a click, a
  result can be typed over, a GM step is picked from its dropdown, a list
  consult picks its entry. Edits wait for **Save** (or **Undo**), then are
  written together, GM lines re-resolved from their new dice.
- **Code** shows the same ideas as text, written when the box loses focus.
- **The drawer** at the foot holds the GM Screen's cards, as the log's GM
  hotbar does (the same panel: preview, odds, dice to roll or type, Append).
  Playing one appends its lines to the ideas. It holds the GM's story
  cards only: no roster, no Rest, no fight cards (Start Combat and the
  turn cards), and it is only as tall as its cards.

Above the ideas, what the prompt is made of:

- **GM Screen:** whose cards the drawer holds.
- **Tables:** add any note with `rpg table.*` blocks; each table rolls once
  per click, into the ideas.
- **Attached:** statblocks, items, places. The prompt summarises them
  (their `rpg` blocks as YAML, then their prose, cut to length).
- **Map:** choose a hex map and its level, then *Pick hexes*. The prompt
  describes each: terrain, regions, places, markers and stacks.
- **Ask for** (in the head): encounter, statblock, NPC, place, region, item,
  scene, or free. Each adds its own instructions.
- **Prompt** shows the prompt as it stands; **Copy prompt** puts it on the
  clipboard.

Everything is kept in the block's text. The block finds itself by its exact
text, as the hex map does. With the Log open beside the prose, the head and
the sources widen with it, so the block reads as one frame.

The code: `lib/domains/draft/draft.ts` (parse, write, roll a template,
summarise a note, build the prompt), `lib/components/draft/draft-block.tsx`,
`lib/views/DraftView.tsx`, the shared GM Screen loader
`lib/services/gm-loader.ts` and the Log's room measure
`lib/components/session-log/use-sidebar-room.ts` (the session log uses both).
