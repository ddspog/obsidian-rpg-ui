---
source:
  system: tov
  book: Player's Guide
  company: Kobold Press
cssclasses:
  - note-feature
---

# Phase 1 Demo — `rpg rule.*`

This file exercises everything Phase 1 implements. The **file-level `source:`** in frontmatter is inherited by every rule block that doesn't declare its own — so most blocks need no `source` line at all. Only set `source:` on a block when you want to override the file's tuple (e.g., for homebrew or cross-system content).

Blocks that carry metadata — `source` override, `tags`, `tier`, `revision`, or `replaces` — render with corner brackets and small icon badges in the top-right corner. Hover a badge to see what metadata the block carries.

---

## Section 1 · `rpg rule.content`

### 1.1 — Plain body (inherits file source)

```rpg rule.content
On your turn you can take one **Action** and move up to your speed. You can also take a single **Bonus Action** if one is available to you. The order is up to you.
```

Plain prose, flush with the page. Source inherited from file frontmatter → not homebrew, no badge, no brackets.

### 1.2 — Custom source override (marks as homebrew + shows badge)

```rpg rule.content
source:
  system: dnd5e
  book: Player's Handbook
  company: Wizards of the Coast
---
**Crits (WotC version).** On a natural 20, you roll double the attack's damage dice.
```

Different system than the file → flagged homebrew. Corner brackets + a `pen-line` badge in top-right. Hover → "Custom source: dnd5e · Player's Handbook · Wizards of the Coast".

### 1.3 — Named anchor (forward-looking; idea 2)

```rpg rule.content
id: grapple
name: Grappling
---
**Grapple.** Use the Attack action to make a special melee attack. On success, the target is grappled and its speed becomes 0 until the grapple ends.
```

No special styling — `id` / `name` fields don't currently trigger brackets. Phase 3 will make `@[[rules/phase-1-demo]].view(grapple)` pull just this block.

### 1.4 — Tags for filtering (idea 4)

```rpg rule.content
tags: [optional, combat]
tier: advanced
---
**Cleave (optional variant).** When you reduce a creature to 0 HP with a melee attack, any leftover damage carries to a second creature within reach.
```

Corner brackets + two badges: `tag` (tags list) and `layers` (tier). Phase 4 compendium settings will toggle these.

### 1.5 — Designer commentary (idea 5)

```rpg rule.content
On your turn you can use your movement to Disengage, which means any opportunity attacks against you are made with disadvantage until the start of your next turn.
```

```rpg rule.side
kind: commentary
type: quote
---
At my table I house-rule this to skip the action cost entirely — disengaging is just the default, and attacking locks you in. Speeds up skirmishes.
```

The commentary block is now an `rpg rule.side` with `kind: commentary`. It renders inline (no float), with semi-transparent italic text and a left border in the `type:` accent color. It implicitly comments on the block above it — no `about` or `id` needed.

### 1.6 — Revision (idea 1)

```rpg rule.content
id: ac-calculation
revision:
  author: ddspog
  date: 2026-05-10
  reason: bounded accuracy cap
original: |
  Your Armor Class (AC) equals 10 + your DEX modifier + any armor bonus.
---
Your Armor Class (AC) equals 8 + your DEX modifier + any armor bonus, capped at 18 before magical effects.
```

Corner brackets + `history` badge. Hover → "Revised by ddspog on 2026-05-10: bounded accuracy cap". The `original:` text is preserved in the YAML; a future revision-aware view will surface it.

### 1.7 — Replacement chain (idea 3)

```rpg rule.content
id: grapple
replaces: tov:grapple
source:
  system: homebrew
  company: ddspog
---
**My house-ruled grapple.** Any creature, regardless of size, may attempt to grapple. Make a contested STR (Athletics) check; winner's choice of position.
```

Three badges: `pen-line` (custom source), `arrow-right-left` (replaces), and homebrew classification applied. In Phase 4 the compendium will substitute this for `tov:grapple` when building a view.

### 1.8 — Mixed: tags + commentary following

```rpg rule.content
tags: [combat, optional]
---
**Two-weapon fighting.** When you take the Attack action and hit with a light melee weapon in one hand, you can use a bonus action to attack with a light melee weapon in the other hand.
```

```rpg rule.side
kind: commentary
type: note
---
I usually let dual-wielders skip the bonus action requirement if both weapons are daggers — a small buff that makes dagger-rogues viable without the Two-Weapon Fighting style.
```

Tags-tagged rule followed by commentary (now via `rpg rule.side` with `kind: commentary`) — demonstrates visually distinct treatment of each.

---

## Section 2 · `rpg rule.side`

### 2.1 — All presets (no direction = right)

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

```rpg rule.side
type: rules
---
**Rules preset** — scroll icon, sepia accent. Good for tagged rule asides standing apart from prose.
```

Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Curabitur pretium tincidunt lacus. Nulla gravida orci a odio.

```rpg rule.side
type: note
---
**Note preset** — pencil icon, blue accent. Neutral annotation.
```

Nullam varius, turpis et commodo pharetra, est eros bibendum elit, nec luctus magna felis sollicitudin mauris. Integer in mauris eu nibh euismod gravida. Duis ac tellus et risus vulputate vehicula.

```rpg rule.side
type: info
---
**Info preset** — info icon, cyan accent.
```

Donec eu libero sit amet quam egestas semper. Aenean ultricies mi vitae est. Mauris placerat eleifend leo. Quisque sit amet est et sapien ullamcorper pharetra. Vestibulum erat wisi, condimentum sed, commodo vitae, ornare sit amet, wisi.

```rpg rule.side
type: tip
---
**Tip preset** — lightbulb, yellow.
```

Aenean fermentum, elit eget tincidunt condimentum, eros ipsum rutrum orci, sagittis tempus lacus enim ac dui. Donec non enim in turpis pulvinar facilisis. Ut felis. Praesent dapibus, neque id cursus faucibus, tortor neque egestas augue.

```rpg rule.side
type: success
---
**Success preset** — check, green.
```

Eu commodo magna eros quis urna. Nunc viverra imperdiet enim. Fusce est. Vivamus a tellus. Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. Proin pharetra nonummy pede.

```rpg rule.side
type: question
---
**Question preset** — help-circle, purple.
```

Mauris et orci. Aenean nec lorem. In porttitor. Donec laoreet nonummy augue. Suspendisse dui purus, scelerisque at, vulputate vitae, pretium mattis, nunc. Mauris eget neque at sem venenatis eleifend. Ut nonummy.

```rpg rule.side
type: warning
---
**Warning preset** — alert-triangle, orange.
```

Fusce aliquet pede non pede. Suspendisse dapibus lorem pellentesque magna. Integer nulla. Donec blandit feugiat ligula. Donec hendrerit, felis et imperdiet euismod, purus ipsum pretium metus, in lacinia nulla nisl eget sapien.

```rpg rule.side
type: danger
---
**Danger preset** — alert-octagon, red.
```

Donec ut est in lectus consequat consequat. Etiam eget dui. Aliquam erat volutpat. Sed at lorem in nunc porta tristique. Proin nec augue. Quisque aliquam tempor magna. Pellentesque habitant morbi tristique senectus et netus.

```rpg rule.side
type: example
---
**Example preset** — list, teal.
```

Et malesuada fames ac turpis egestas. Nunc ac magna. Maecenas odio dolor, vulputate vel, auctor ac, accumsan id, felis. Pellentesque cursus sagittis felis. Pellentesque porttitor, velit lacinia egestas auctor, diam eros tempus arcu.

```rpg rule.side
type: quote
---
**Quote preset** — quote, gray.
```

Nec dignissim quam metus in elit. Maecenas malesuada. Praesent congue erat at massa. Sed cursus turpis vitae tortor. Donec posuere vulputate arcu. Phasellus accumsan cursus velit. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia Curae.

### 2.2 — Direction control

Sed nec nisl ut quam consequat hendrerit. Vivamus tincidunt risus quis enim. Phasellus dolor. Maecenas vestibulum mollis diam. Pellentesque ut neque. Pellentesque habitant morbi tristique senectus et netus et malesuada fames.

```rpg rule.side
direction: left
type: tip
title: Left-floated
---
This one hugs the **left** pane edge. Main text wraps on the right.
```

Ac turpis egestas. In dui magna, posuere eget, vestibulum et, tempor auctor, justo. In ac felis quis tortor malesuada pretium. Pellentesque auctor neque nec urna. Proin sapien ipsum, porta a, auctor quis, euismod ut, mi.

```rpg rule.side
direction: right
type: warning
title: Right-floated
---
This one hugs the **right** pane edge. Main text wraps on the left. Default when `direction` is omitted.
```

Aenean viverra rhoncus pede. Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. Sed lectus. Donec mollis hendrerit risus. Phasellus nec sem in justo pellentesque facilisis.

### 2.3 — Custom color

Etiam imperdiet imperdiet orci. Nunc nec neque. Phasellus leo dolor, tempus non, auctor et, hendrerit quis, nisi. Curabitur ligula sapien, tincidunt non, euismod vitae, posuere imperdiet, leo. Maecenas malesuada. Praesent congue erat at massa.

```rpg rule.side
type: tip
color: "#8e44ad"
title: Purple tip
---
Preset sets icon + title; `color:` overrides to violet.
```

Sed cursus turpis vitae tortor. Donec posuere vulputate arcu. Phasellus accumsan cursus velit. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia Curae; Sed aliquam, nisi quis porttitor congue.

```rpg rule.side
color: var(--color-pink)
icon: heart
title: Theme pink
---
Uses Obsidian's `--color-pink` var. No preset.
```

Eros enim consequat ante, quis tempus turpis sapien id mi. Etiam quis sem. Etiam massa. Donec sed lectus. Praesent placerat risus quis eros. Fusce pellentesque suscipit nibh. Integer vitae libero ac risus egestas placerat.

```rpg rule.side
color: crimson
icon: flame
title: Named CSS color
---
`crimson` is a plain CSS named color. Flame icon.
```

Vestibulum commodo felis quis tortor. Ut aliquam sollicitudin leo. Cras iaculis ultricies nulla. Donec quis dui at dolor tempor interdum. Vivamus molestie gravida turpis. Fusce lobortis lorem at ipsum semper sagittis.

### 2.4 — Custom icon

Nam convallis pellentesque nisl. Integer malesuada commodo nulla. Cras pellentesque. Sed augue. Curabitur sed ante. Aenean sit amet sapien. Ut malesuada lectus quis lectus. Maecenas porttitor, ipsum et accumsan facilisis, libero arcu sodales lectus.

```rpg rule.side
color: "#2c5f8d"
icon: swords
title: Lucide — swords
---
Lucide icon names render as SVG via Obsidian's `setIcon()`.
```

A pellentesque metus magna et tellus. Suspendisse potenti. In hac habitasse platea dictumst. Cras nec felis. Nam sit amet quam. Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas.

```rpg rule.side
color: "#16a085"
icon: "⚔️"
title: Emoji — crossed swords
---
A single emoji renders literally.
```

Nullam pulvinar elit at suscipit feugiat. Aliquam erat volutpat. Pellentesque luctus mi vitae mi. Nullam dignissim, lectus et tristique iaculis, dolor lacus volutpat tortor, eget faucibus dui mi non lectus.

### 2.5 — Side with custom source override

```rpg rule.side
type: rules
title: Player Advice (variant)
source:
  system: dnd5e
  company: Wizards of the Coast
---
Side blocks always get the dashed accent outline as part of their base look — homebrew classification doesn't change side-block styling. The `source:` field is still parsed and available to future tooling (e.g., compendium filtering) but doesn't add any visual flag here.
```

### 2.6 — Callout variant (in-flow certificate)

```rpg rule.side
kind: callout
type: warning
---
This is the new `kind: callout` — an in-flow box with top + bottom accent bars. Lives inside the readable column, no float, no escape into the gutter. Useful when a `> [!warning]` callout would create awkward quote-nesting in the source markdown.
```

```rpg rule.side
kind: callout
type: rules
title: Optional Rule
---
Same callout variant with the `rules` preset — sepia bars and scroll icon in the title.
```

```rpg rule.side
kind: callout
color: "#9b59b6"
icon: sparkles
title: Custom-colored callout
---
Override color and icon directly without a preset. The `direction:` field is ignored here (callouts are in-flow, not floated).
```

---

## Section 2.7 · `rpg rule.related` (Phase 2)

A `rule.related` block lists transclusions that supplement the current rule when reading the file directly. Strip-on-import is deferred to Phase 3 (the `@[[file]].fn()` call processor will pre-strip these so they don't double up when the file is imported elsewhere). Only `![[file]]` (with the `!`) is accepted — bare `[[link]]` is rejected.

### Flat list (default heading level = 3)

```rpg rule.related
- "![[ammunition|no-h1 no-title clean]]"
- "See also": "![[shoving]]"
- Prerequisite: "![[bow]]"
```

The first entry renders as a bare embed; the next two get an `<h3>` heading above the embed.

### Object form with explicit `level:`

```rpg rule.related
level: 4
entries:
  - "![[ammunition|no-h1 no-title clean]]"
  - Combat reference: "![[grappling-test]]"
```

Same content but headings render as `<h4>` — useful when the file already uses an h3 outline and you want related entries to nest under it.

(If the embed targets don't exist in your vault, Obsidian renders the standard "missing file" placeholder — that's expected for the demo.)

---

## Section 3 · Mixed flow

Regular paragraph before a wide right-floated aside.

```rpg rule.side
type: rules
direction: right
---
**Grappling.** Make a special melee attack to restrain a target. On success, the grappled creature's speed becomes 0.
```

Prose wrapping to the narrow left column. This paragraph should be ~25% of the reading column because the aside takes 75% plus its escape into the right gutter. Keep typing so you can see the wrapping clearly — another sentence, and another.

```rpg rule.content
A plain rule block after the aside. The float should clear here because content blocks are block-level and the aside uses `clear: right`.
```

```rpg rule.side
type: warning
direction: left
---
Left-floated aside. Prose wraps on the right.
```

Paragraph to the right of the left-floated aside, demonstrating both directions work symmetrically. More text for wrap visibility. Another sentence. And one more.

---

## What's NOT yet implemented (heads-up)

- **Tags/tier filtering UI** — badges render today; filtering lands with Phase 4 compendium settings.
- **`id`/`name` selective import** — Phase 3 call processor will honor `@[[file]].view(name)`.
- **`replaces` chain resolution** — Phase 4 compendium does substitution.
- **`revision` / `original` diff view** — later phase, needs UI design.
- **`rule.related`** — Phase 2.
- **`rule.compendium`** — Phase 4.
- **`@[[file]].fn()` import syntax** — Phase 3.

All the forward-looking YAML is safely parseable — when the features land, the data is already there.
