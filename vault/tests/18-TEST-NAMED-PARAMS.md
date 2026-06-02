---
cssclasses: ["note-adventurer"]
source: From **Tales of the Valiant** "Player's Guide" by **Kobold Press".
---
# Named Parameters Test

Verifies the `name:` and `content:` named parameters on `.p()` and `.inline()` views. Open in **reading view** to confirm rendering.

---

## Baseline — whole-file (no block ID)

`.p()` with no positional arg → whole-file mode. Name inferred from filename:

`@[[Noisy]].p()`

Expected: ***Noisy.*** This armor imposes disadvantage…

---

## Baseline — with block ID

`.p(Noisy)` selects the block by name → block frontmatter has `name: Noisy`:

`@[[Noisy]].p(Noisy)`

Expected: ***Noisy.*** This armor imposes disadvantage…

---

## Override name with a static string

`@[[Noisy]].p(name: "Noisy Armor")`

Expected: ***Noisy Armor.*** This armor imposes disadvantage…

---

## Override name with a template expression

`@[[Blunted Bash ᴷ]].p(name: "${name} (Weapon Option)")`

Expected: ***Blunted Bash (Weapon Option).*** Instead of dealing piercing damage…

---

## Named param with empty value (use default)

`@[[Noisy]].p(Noisy, content:)`

Expected: same as block-id baseline — ***Noisy.*** This armor imposes…

---

## Named param on inline view

`@[[Noisy]].inline(name: "Noisy Property")`

Expected: **Noisy Property.** This armor imposes disadvantage… (inline, no block wrapper)

---

## Template with parens in value

`@[[Ammunition]].p(name: "${name} (Property)")`

Expected: ***Ammunition (Property).*** You can use a weapon…

---

## Positional block ID + named param

`@[[Blunted Bash ᴷ]].p(name: "${name} ᴷ")`

Expected: ***Blunted Bash ᴷ.*** Instead of dealing piercing damage…

---

## Name override without template (plain string)

`@[[Ammunition]].inline(name: "Ammo Rules")`

Expected: **Ammo Rules.** You can use a weapon…

---

## Folder — name override with template

Each file in the folder gets its own `${name}` resolved from its block frontmatter:

`@[[concepts/armor-property/]].p(name: "${name} (Armor)")`

Expected: Three paragraphs:
- ***Cumbersome (Armor).*** This armor is heavy…
- ***Natural Materials (Armor).*** …
- ***Noisy (Armor).*** This armor imposes…

---

## Folder — inline with static name override

All items get the same overridden name:

`@[[concepts/armor-property/]].inline(name: "Property")`

Expected: Three inline entries, all prefixed **Property.** …

---

## Folder — no named params (baseline)

`@[[concepts/armor-property/]].p()`

Expected: Three paragraphs using the filename as name:
- ***Cumbersome.*** This armor is heavy…
- ***Natural Materials.*** …
- ***Noisy.*** This armor imposes…

