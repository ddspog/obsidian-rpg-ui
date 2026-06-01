---
name: RPG UI Toolkit
description: Arcane craftsman interface for D&D management inside Obsidian
colors:
  indigo-slate: "#262a36"
  slate-mid: "#323748"
  slate-light: "#3a4055"
  slate-hover: "#363b4a"
  deep-border: "#383e54"
  periwinkle-active: "#6d7cba"
  pale-silver: "#e0e0e0"
  lavender-mist: "#a0a0d0"
  frost-teal: "#a0c7d0"
  pure-white: "#ffffff"
  muted-lilac: "#b8b8d0"
  arcane-teal: "#64d8cb"
  ember-red: "#e57373"
  soft-amethyst: "#b39ddb"
  signal-gold: "#FFD400"
  warm-earth-bg: "#2a2724"
  warm-earth-border: "#5a5450"
  warm-parchment: "#e3dcce"
  faded-amber: "#a09880"
typography:
  label:
    fontSize: "0.8rem"
    fontWeight: 700
    letterSpacing: "1px"
    lineHeight: 1.2
  label-small:
    fontSize: "0.7rem"
    fontWeight: 600
    letterSpacing: "0.04em"
    lineHeight: 1.2
  value:
    fontSize: "1.2rem"
    fontWeight: 700
    lineHeight: 1
  value-small:
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1
  body:
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
  sublabel:
    fontSize: "0.65rem"
    fontWeight: 600
    lineHeight: 1.1
rounded:
  card: "0.4rem"
  secondary: "0.25rem"
  stat: "6px"
  trigger: "8px"
  pill: "999px"
  checkbox: "0.2rem"
spacing:
  xs: "0.3rem"
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1.25rem"
components:
  button-base:
    rounded: "{rounded.secondary}"
    padding: "0.3rem 0.4rem"
    textColor: "{colors.pale-silver}"
  button-base-hover:
    backgroundColor: "{colors.slate-hover}"
  card-primary:
    backgroundColor: "{colors.indigo-slate}"
    textColor: "{colors.pale-silver}"
    rounded: "{rounded.card}"
    padding: "0.75rem"
  card-secondary:
    backgroundColor: "{colors.slate-mid}"
    rounded: "{rounded.secondary}"
    padding: "0.5rem"
  input-field:
    backgroundColor: "{colors.slate-mid}"
    textColor: "{colors.pale-silver}"
    rounded: "{rounded.secondary}"
    padding: "0.3rem"
  badge:
    backgroundColor: "{colors.slate-mid}"
    textColor: "{colors.pale-silver}"
    rounded: "{rounded.secondary}"
    padding: "0.25rem 0.5rem"
  progress-bar:
    backgroundColor: "{colors.signal-gold}"
    height: "0.5rem"
  stat-diamond:
    backgroundColor: "{colors.warm-earth-bg}"
    textColor: "{colors.warm-parchment}"
    size: "94px"
    height: "52px"
---

# Design System: RPG UI Toolkit

## 1. Overview

**Creative North Star: "The Artificer's Workshop"**

A craftsman's workspace where every tool has its place, warm lamplight reveals precise details, and nothing exists without purpose. The system is dense with information but never cluttered; hierarchy does the heavy lifting while chrome stays minimal. Fantasy warmth emerges through color temperature and typographic weight, not through ornamentation or texture.

This system explicitly rejects SaaS blandness (white/blue corporate neutrality, hero metrics, identical card grids), gamer visual noise (neon competing panels, aggressive borders), and skeletal unstyled defaults. It also rejects the obvious path of full fantasy kitsch (heavy parchment textures, ye olde borders), choosing instead the confidence of a well-made artifact.

The system is designed to blend seamlessly with Obsidian's native UI and the companion Ribbons theme. It defers to Obsidian's theming conventions (dark/light, font stacks, spacing variables) while carrying its own identity through color temperature, density, and interaction design.

**Key Characteristics:**
- Information density managed through typographic hierarchy, not separators
- Flat surfaces with tonal layering instead of shadows
- Warm amber/earth tones for game-world content; cool indigo-slate for structural UI
- Interactive elements invisible at rest, responsive on engagement
- Two parallel palettes: structural (plugin tokens) and thematic (Obsidian vars + light-dark)

## 2. Colors

The palette splits between a cool structural layer (indigo-slates for backgrounds and borders) and warm thematic accents (amber/earth for game content, teal/red/purple for semantic state). Two full themes exist: Default Dark is the primary design target.

### Primary

- **Arcane Teal** (#64d8cb): Primary success state and positive accent. Proficiency indicators, healing, advantage markers. Used sparingly as text and border color for semantic emphasis.
- **Signal Gold** (#FFD400): Progress and XP. The only saturated fill color in the system; used exclusively in progress bars against a black track. Its rarity is its power.

### Secondary

- **Ember Red** (#e57373): Danger, damage, loss. HP reduction, death saves, disadvantage markers.
- **Soft Amethyst** (#b39ddb): Magic, arcane, special. Spell slots, supernatural features, purple-tagged content.

### Neutral

- **Indigo Slate** (#262a36): Primary surface background. Slightly blue-shifted from pure dark to carry warmth without heaviness.
- **Slate Mid** (#323748): Secondary surfaces, input backgrounds. One step lighter for card layering.
- **Deep Border** (#383e54): Structural borders. Low contrast against surfaces; present but not competing.
- **Periwinkle Active** (#6d7cba): Active borders and focus indicators. The one structural color that carries noticeable chroma.
- **Pale Silver** (#e0e0e0): Primary body text. Not pure white; slightly warm.
- **Lavender Mist** (#a0a0d0): Secondary text. Labels, sublabels on the structural layer. Faintly purple-tinted.
- **Muted Lilac** (#b8b8d0): Muted text. De-emphasized content that's present but not calling attention.
- **Warm Parchment** (#e3dcce): Stat values and game-world content text. Amber-warm against earth backgrounds.
- **Faded Amber** (#a09880): Captions, source lines, secondary game-world text. The quiet voice of lore.

### Named Rules

**The Dual Temperature Rule.** Structural UI (backgrounds, borders, generic text) lives in cool indigo-slate. Game-world content (stats, spells, rules, lore) lives in warm amber-earth. The temperature shift tells the reader whether they're looking at interface or content without any other signal.

**The Gold Scarcity Rule.** Signal Gold (#FFD400) appears only in progress bars and trigger button rings. It is never used for text, backgrounds, or generic accent. Its visual weight comes from being the single saturated fill in an otherwise muted system.

## 3. Typography

**Display Font:** Inherits from Obsidian (`--font-text`, `--font-interface`)
**Body Font:** Inherits from Obsidian (`--font-text`)
**Label Font:** Same family, distinguished by size + weight + case + tracking

**Character:** The type system is utilitarian and dense. It relies entirely on weight contrast, scale jumps, and uppercase tracking to create hierarchy, never on decorative faces or display fonts. This keeps it theme-agnostic and blends with any Obsidian font configuration.

### Hierarchy

- **Value** (700, 1.2rem, line-height 1): Stat numbers, HP values, modifier displays. The largest and heaviest text in any component.
- **Value Small** (700, 1rem, line-height 1): Dense variant for compact grids and secondary stats.
- **Label** (700, 0.8rem, uppercase, 1px letter-spacing, line-height 1.2): Component headers, stat names, section titles within blocks.
- **Label Small** (600, 0.7rem, uppercase, 0.04em letter-spacing, line-height 1.2): Sublabels, metadata keys in definition lists.
- **Body** (400, 1rem, line-height 1.55): Description prose, spell text, rule content. Capped at comfortable reading width by container constraints.
- **Sublabel** (600, 0.65rem, line-height 1.1): Smallest text tier. Captions inside tight shapes (diamond stats, hex pairs).

### Named Rules

**The Uppercase Signpost Rule.** Every label is uppercase with positive letter-spacing (0.04em-1px). This is the single strongest signal that distinguishes navigational text from content text. Never use uppercase for body or value tiers.

## 4. Elevation

This system is flat by default. Depth is conveyed through tonal stepping (indigo-slate → slate-mid → slate-light) and border presence, not through box-shadows. This is a deliberate choice to blend with Obsidian's own flat surface model and the companion Ribbons theme.

### Shadow Vocabulary

- **Stat Press** (`0 2px 0 rgba(0,0,0,0.15)`): The single production shadow. Applied only to stat value chips to give them a subtle "pressed into surface" feel. Structural, not decorative.
- **Focus Ring** (`0 0 0 2px var(--color-border-focus)`): Not a shadow for depth; a state indicator for keyboard focus. Uses the same inset-ring pattern as Obsidian native.
- **Trigger Glow** (`0 0 0 3px rgba(255, 212, 0, 0.12)`): Ambient glow around trigger buttons. Communicates interactivity through light emission, not elevation.

### Named Rules

**The Flat-by-Default Rule.** Surfaces do not float. Cards sit flush with their background; the only depth signal is the background color step between nesting levels. If it looks lifted, it's wrong. The stat-press shadow is the single carved exception.

## 5. Components

### Buttons

Quiet at rest, responsive on touch. Controls do not compete with content.

- **Shape:** Softly rounded (4px / 0.25rem)
- **Base:** Transparent background, 1px border in deep-border color, pale-silver text. Padding 0.3rem 0.4rem.
- **Hover:** Background fills to slate-hover. No other change.
- **Focus:** 2px ring in periwinkle-active (via box-shadow, not outline).
- **Accent variants:** Border and text color shift to teal/red/purple. Background stays transparent.
- **Trigger variant:** 44px square, 8px radius, yellow border ring with ambient glow. Hover lifts 2px (translateY). The only button with visible presence at rest.

### Cards / Containers

Two tiers: primary and secondary. No elevation difference between them; tonal step only.

- **Primary:** Indigo-slate background, 1px deep-border, 0.4rem radius, 0.75rem padding. Min-height 80px.
- **Secondary:** Slate-mid background, 1px deep-border, 0.25rem radius, 0.5rem padding.
- **Dense variant:** Tighter padding (0.5rem primary, reduced font sizes). Used in compact grids.
- **Chrome-free variant:** No background, no border, no padding. Used for spell cards and feature cards where content flows as prose.

### Stat Diamond

The signature component. A hexagonal clip-path shape that holds stat values.

- **Shape:** Horizontal hexagon via `polygon(14% 0%, 86% 0%, 100% 50%, 86% 100%, 14% 100%, 0% 50%)`. 94px wide, 52px tall (lg: 110x64).
- **Layers:** Outer border fill (warm-earth-border #5a5450), inner fill (warm-earth-bg #2a2724) inset 1.5px.
- **Text:** Value in warm-parchment, caption in faded-amber uppercase.
- **Vantage pill:** 14px circle, positioned top-right. Green for advantage, red for disadvantage.

### Inputs / Fields

- **Style:** Slate-mid background, 1px periwinkle-active border, 0.25rem radius. Centered text, 0.3rem padding, 5rem default width.
- **Focus:** 2px box-shadow ring in semi-transparent periwinkle.
- **Disabled:** Not explicitly styled; inherits Obsidian's disabled treatment.

### Checkboxes / Toggles

- **Style:** Slate-mid background, 1px periwinkle-active border, 0.2rem radius. No label text inside.
- **Checked (aria-pressed=true):** Background fills to periwinkle-active color.
- **Focus:** 2px box-shadow ring in semi-transparent periwinkle.

### Progress Bar

- **Track:** Pure black (#000), no radius, 0.5rem height. Inset shadow for subtle inner edge.
- **Fill:** Signal Gold (#FFD400), no radius. Width transitions over 0.3s ease.
- **Philosophy:** The black/gold pairing is the most visually distinctive element in the system. It appears nowhere else.

### Badges

- **Shape:** Slate-mid background, 1px deep-border, 0.25rem radius. Inline-flex with 0.3rem gap.
- **Dense variant:** Tighter padding (0.15rem 0.3rem), smaller text (0.7rem).
- **Function:** Status indicators, proficiency tags, condition markers.

## 6. Do's and Don'ts

### Do:

- **Do** use tonal stepping (indigo-slate → slate-mid → slate-light) for depth hierarchy instead of shadows.
- **Do** keep interactive elements visually quiet at rest. Borders present but low-contrast; backgrounds transparent or matching surface.
- **Do** separate structural UI (cool indigo-slate) from game content (warm amber-earth) by color temperature.
- **Do** use uppercase + letter-spacing exclusively for labels and navigation, never for body text or values.
- **Do** inherit Obsidian's font stacks and sizing vars (`--font-text`, `--font-interface`, `--size-*`) wherever possible.
- **Do** use `light-dark()` for game-world content colors that need both theme variants in a single declaration.
- **Do** honor `prefers-reduced-motion` for all transitions (progress fills, hover lifts, focus rings).

### Don't:

- **Don't** add box-shadows for depth or layering. The system is flat. The stat-press and trigger-glow are the only sanctioned shadows.
- **Don't** use SaaS patterns: white/blue blandness, rounded card grids with hero metrics, corporate neutrality. This is not a dashboard.
- **Don't** compete for visual attention with neon colors, aggressive borders, or multiple saturated accents on the same surface. Density is not clutter.
- **Don't** leave elements unstyled or skeletal. Every component earns its visual presence through deliberate choices, even when those choices are minimal.
- **Don't** use Signal Gold (#FFD400) outside of progress bars and trigger button rings. Its scarcity is load-bearing.
- **Don't** use border-left or border-right greater than 1px as a colored accent stripe on cards or containers.
- **Don't** introduce glassmorphism, gradient text, or gradient backgrounds. The system's warmth comes from color temperature, not effects.
- **Don't** override Obsidian's native theme variables for structural elements (backgrounds, borders) outside the plugin's scoped containers.
