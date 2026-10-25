# Test 14: Session Log — Prose Mode

## Test Objective

Verify the `rpg log` block's **prose mode** (the new default reading view):

- Only `=>` conclusions surface as prose; the `@` / `d:` / `?` / `gen:` machinery is hidden.
- `[[wikilinks]]` inside narration and dialogue render as real links.
- A `=> S## Title` consequence opens a scene whose title carries a provenance dot, in the left margin.
- `PC()` / `N()` dialogue renders as chat balloons that fit their words: player characters on the left, everyone else on the right.
- `++` joins consecutive conclusions into one paragraph, each keeping its own margin dot.
- The **Log** fold at the top-right (on a phone, **Log** in the bottom bar) opens the read-only sidebar; **↓ Latest** jumps to the last block.
- The **Actions** drawer starts folded to a slim bar showing who is acting; press **A** (or tap the bar) to open it.
- **Write** in the bookkeeping first shows what will change and asks you to confirm; **Esc** cancels.
- Clicking a dot opens + highlights the matching sidebar card; clicking a card scrolls to the passage.

Open this file in **Reading View**.

---

## Test 1: Scene from an oracle conclusion + narration with wikilinks

Expected (Prose mode): the `?`, `gen:` and the indented working line vanish. Only a scene
heading `S01 After the Landslide` (with a dot) and the narrative paragraphs show, with
`[[Lilith]]`, `[[Bellscarp Range]]`, etc. rendered as links.

```rpg log
state_key: prose-scene-from-oracle
---
? [CF:5] Does the "The party start journey on their mission, but a landslide force them to take a longer path." scene occurs?
gen: Testing the Expected Scene
  Alterations: d10=8 vs CF 5 -> Expected Scene
=> S01 After the Landslide

Our final lesson behind us, we were no longer students. The guild gave us our last assignment before full induction: pick a quest, complete it as a team, and prove ourselves ready.

I chose [[Lilith]] and [[Jacqui Ilitul]]—both sharp blades and steady minds. We met with Marcel, a longtime friend of my father, who suggested we stay near the [[Bellscarp Range]]. Folk there still remember the Lurkers and often send word when trouble stirs.

We found such trouble quickly—a beast was loose in the northern pass of the [[Wisdom’s Path]]. With the guild’s help, we gathered what we needed: gear, a cart, and a strong horse to carry us up the mountain trails.

Our path began through the [[Safe Passage]], not far from my father’s home. But we had barely left the last rooftops behind when the sky turned. Rain poured in cold sheets, dimming the day before its time.

I knew the road — its old stones, its steady footing — and we pressed on through the storm. But the rain turned the ground slick, the air thick, and the shadows deeper. Then came the ambush.
```

---

## Test 2: Dialogue chat balloons

Expected (Prose mode): six balloons, one per row. `Lilith`, `Talon`, `Jacqui` styled as PCs;
`Kobold` styled as NPC. Each speaker keeps the same horizontal lane; the `[[Carnsperbourne]]`
link renders inside Talon's balloon.

```rpg log
state_key: prose-dialogue
---
PC(Lilith): Where in the hells did he come from?
PC(Talon): The pack. Enchanted, maybe. I don't know if it was with us since [[Carnsperbourne]], or joined us in the fall.
N(Kobold): I snuck in. I had to! I’m not your enemy — I’m running from mine!
PC(Jacqui): Running from who?
N(Kobold): My old cult. Other kobolds. I escaped, and they’re after me. Let me stay with you. I can help. I have the bag — I can sleep in it. Just... please, let me stay.
PC(Talon): You sleep in that bag?
```

---

## Test 3: `++` concatenated conclusions

Expected (Prose mode): a single paragraph reading
"I watched him. Scared, yes. But honest. There was no lie in his voice.• And I began to think
of what we might gain by keeping him close.•" — two dots, one per source action.

```rpg log
state_key: prose-concat
---
@(Talon) Checking if the Kobold is lying
d: d20+[[Insight]]=11 vs DC 10 -> Success
=> I watched him. Scared, yes. But honest. There was no lie in his voice.
++
@(Talon) Received [[Kowyn's Bag]] from Kobold.
=> And I began to think of what we might gain by keeping him close.
```

---

## Test 4: Mixed scene with all features + sidebar

Expected: scene heading, a narrated conclusion with a dot, dialogue balloons, and—via the
**Actions** button—a sidebar listing the `@` action (with its roll), the `?` oracle (CF 5),
and the bare consequences. Clicking the dot highlights the matching card.

```rpg log
state_key: prose-mixed
---
S02 The Kobold's Bargain

@(Lilith) Searches the fallen pack for traps
d: Investigation d20+3=17 vs DC 12 -> Success
=> The pack is harmless — just a frightened creature inside.

PC(Lilith): Show yourself. Slowly.
N(Kobold): Please — I mean no harm!

? [CF:5] Is the kobold telling the truth?
-> Yes, and... (d6=6)
=> Its fear is genuine; there is no malice here.
```
