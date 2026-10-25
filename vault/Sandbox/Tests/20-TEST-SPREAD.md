---
cssclasses: ["note-feature", "rpg-ui"]
source: From **Tales of the Valiant** "Player's Guide" book by **Kobold Press**
---
# Test 20: Spread Side Blocks (`.spread()`)

Verifies the `.spread()` view: like `.callout()`, it renders imported content
into a `rule.side` block — but with `kind: spread` (banner heading + optional
subtitle + body). Consecutive `.spread()` calls and folder imports lay out in
a two-column grid, matching the `rpg rule.side` fence with `kind: spread`.

It accepts the same params as `.callout()` (`type`, `name`, `content`), plus an
optional `subtitle`.

---

## A. Consecutive single calls → two-column grid

`@[[Darkvision]].spread()`
`@[[Keensense]].spread()`
`@[[Tremorsense]].spread()`
`@[[Truesight]].spread()`

---

## B. Folder import → two-column grid

`@[[glossary/senses/]].spread()`

---

## C. Standalone spread (single — should stay one column)

`@[[Darkvision]].spread()`

---

## D. Named params (`name`, `subtitle`, `type`)

`@[[Darkvision]].spread(name: "DARKVISION", subtitle: "Sense • 60 ft. radius")`
`@[[Keensense]].spread(name: "KEENSENSE", subtitle: "Sense • non-visual perception")`

---

## E. With `.highlight()` (homebrew badge per item)

`@[[Far Sight ᴺ]].highlight().spread()`
`@[[Low-Light Vision ᴺ]].highlight().spread()`

---

## F. Fence equivalent (baseline — should match the call output above)

````rpg rule.side
kind: spread
title: DARKVISION
subtitle: "Sense • 60 ft. radius"
---
A creature with darkvision can see in dim light within a radius as if it were bright light, and in darkness as if it were dim light.
````

````rpg rule.side
kind: spread
title: KEENSENSE
subtitle: "Sense • non-visual perception"
---
A creature with keensense can perceive its surroundings using a sense other than vision, such as echolocation or an extraordinary sense of smell.
````
