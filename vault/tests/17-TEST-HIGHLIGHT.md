---
cssclasses: ["note-feature", "rpg-ui"]
source: From **Tales of the Valiant** "Player's Guide" book by **Kobold Press**
---
# Test 17: Highlight (Explicit Chain Function)

## Test Objective
Verify that `.highlight()` in chain calls explicitly flags imported content with
a visual homebrew/custom modifier. Highlighting is always opt-in — importing from
a different source does NOT auto-highlight.

---

# Section A: Text Views (p, bare, h*, inline)

## A1. Normal imports (no highlight regardless of source)

Same-source and different-source imports look identical without `.highlight()`:

### .bare() — same source, no highlight
`@[[Checks]].bare()`

### .bare() — different source (ᴷ), still no highlight
`@[[Short Draw ᴷ]].bare()`

### .p() — homebrew (ᴴ), still no highlight
`@[[Acolyte ᴴ]].p()`

### .h4() — organization homebrew (ᴺ), still no highlight
`@[[Far Sight ᴺ]].h4()`

### .inline() — D&D Beyond (ᴰ), no highlight
The spell `@[[Create Bonfire ᴰ]].inline()` creates fire on the ground.

---

## A2. Explicit .highlight() on text views

### .highlight().bare() — homebrew (ᴴ)
`@[[Acolyte ᴴ]].highlight().bare()`

### .highlight().p() — Kobold Press D&D 5e (ᴷ)
`@[[Short Draw ᴷ]].highlight().p()`

### .highlight().h4() — organization (ᴺ)
`@[[Far Sight ᴺ]].highlight().h4()`

### .highlight().inline() — D&D Beyond (ᴰ)
The spell `@[[Create Bonfire ᴰ]].highlight().inline()` creates fire on the ground.

---

# Section B: Box Views (float, callout, commentary)

## B1. Normal imports (no highlight)

### .callout() — no highlight
`@[[Darkvision]].callout()`

### .float() — no highlight
`@[[Short Draw ᴷ]].float()`

### .commentary() — no highlight
`@[[Far Sight ᴺ]].commentary()`

---

## B2. Explicit .highlight() on boxes

### .highlight().callout()
`@[[Far Sight ᴺ]].highlight().callout()`

### .highlight().float()
`@[[Short Draw ᴷ]].highlight().float()`

### .highlight().commentary()
`@[[Blunted Bash ᴷ]].highlight().commentary()`

---

# Section C: Row View (table)

## C1. Normal table (no highlights)
````rpg table.weapons-c1
| Link | Cost | Weight |
|---|---|---|
| `@[[Longsword]].row(link, cost, weight)` |
| `@[[Scimitar]].row(link, cost, weight)` |
| `@[[Maul]].row(link, cost, weight)` |
| `@[[Northlands Estoc ᴷ]].row(link, cost, weight)` |
[MARTIAL WEAPONS]
````

## C2. Mixed table — some rows highlighted
````rpg table.weapons-c2
| Link | Cost | Weight |
|---|---|---|
| `@[[Longsword]].row(link, cost, weight)` |
| `@[[Northlands Estoc ᴷ]].highlight().row(link, cost, weight)` |
| `@[[Scimitar]].row(link, cost, weight)` |
| `@[[Maul]].row(link, cost, weight)` |
[MIXED WEAPONS]
````

## C3. Folder table — highlight detects homebrew per row
````rpg table.weapons-c3
| Link | Cost | Weight |
|---|---|---|
| > `@[[items/weapons/martial-melee/]].highlight().row(link, cost, weight)` |
[MARTIAL MELEE — FOLDER IMPORT]
````

---

# Section D: Item/List View

## D1. Normal items (no highlight)

`@[[Darkvision]].item()`
`@[[Short Draw ᴷ]].item()`
`@[[Far Sight ᴺ]].item()`

## D2. Mixed list with selective highlight

`@[[Darkvision]].item()`
`@[[Short Draw ᴷ]].highlight().item()`
`@[[Far Sight ᴺ]].highlight().item()`
`@[[Blunted Bash ᴷ]].highlight().item()`

---

## D3. Folder list — highlight detects homebrew per item

`@[[concepts/weapon-options/]].highlight().item()`

---

# Section E: Tab View

## E1. Normal tabs (no highlight)

`@[[Acrobatics]].tab()`
`@[[Athletics]].tab()`

## E2. Highlighted tab

`@[[Acrobatics]].tab()`
`@[[Acolyte ᴴ]].highlight().tab()`
`@[[Athletics]].tab()`

---

# Section F: Magic Item Views

## F1. Normal magic items (no highlight)
`@[[Blood Spike Armor]].magic()`
`@[[Sentinel Shield ᴰ]].magic()`

## F2. Highlighted magic item
`@[[Sentinel Shield ᴰ]].highlight().magic()`

---

# Section G: Folder Imports (Mixed Sources)

These folders contain a mix of official ToV content and homebrew/third-party
files. The highlight should only appear on items explicitly marked.

## G1. Senses folder — mix of official (ᴺ) and ToV

Without highlight — all render identically:
`@[[glossary/senses/]].h4()`

## G2. Senses folder — all highlighted

`@[[glossary/senses/]].highlight().h4()`

## G3. Weapon options folder — all ᴷ (Kobold Press D&D 5e)

Without highlight:
`@[[concepts/weapon-options/]].p()`

## G4. Weapon options folder — highlighted

`@[[concepts/weapon-options/]].highlight(third-party).p()`

## G5. Weapon options — filtered subset, highlighted

`@[[concepts/weapon-options/]].filter(Short prefix name).highlight(adapted).p()`

---

# Section H: Filter + Highlight Order

## H1. Filter then highlight
`@[[concepts/weapon-options/]].filter(Short prefix name).highlight().p()`

## H2. Highlight then filter — same behavior expected
`@[[concepts/weapon-options/]].highlight().filter(Short prefix name).p()`

---

# Section H: Highlight Variants

These demonstrate argument-based variants for different visual treatments.
The default (no args) uses the standard homebrew badge.

## H1. Default highlight (homebrew badge)
`@[[Acolyte ᴴ]].highlight().p()`

## H2. Highlight with "adapted" label
`@[[Short Draw ᴷ]].highlight(adapted).p()`

## H3. Highlight with "house-rule" label
`@[[Far Sight ᴺ]].highlight(house-rule).p()`

## H4. Highlight with "third-party" label
`@[[Sentinel Shield ᴰ]].highlight(third-party).magic()`

## H5. Highlight with custom color
`@[[Acolyte ᴴ]].highlight(homebrew, purple).p()`
