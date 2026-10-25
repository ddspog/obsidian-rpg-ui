# Phone, Rolling and the Sheet Legend

The character sheet is built to be used at the table, on a phone as well as a desktop. This page covers what changes by screen size and the things you can tap or click.

## Rolling

- **Skills.** Click or tap a skill row to roll a d20 with that skill's modifier. A sheet opens with the result; **Advantage** and **Disadvantage** roll two dice and keep the higher or lower, and **Roll again** rolls one. A skill that already has advantage or disadvantage from your features opens in that mode. The **ⓘ** at the end of the row opens the skill's note, which is what clicking the name used to do.
- **Attacks.** The **Roll** button on a row in the Attacks table rolls the d20 to hit (from the to-hit shown, for example `+5 (STR)`), then offers each damage roll. A natural 20 doubles the damage dice, not the bonus. A save-based spell has no attack roll, so it offers its damage rolls only.
- Rolls stay on the sheet. Nothing is written to the session log.

## What changes on a phone

On a window 600px wide or narrower:

- **Layout.** The banner wraps, the stat diamonds shrink, skills and proficiencies become one column, and the Attacks table becomes two-line cards: name and to-hit on the first line, damage and range on the second, with a large **Roll** button.
- **Play and Sheet.** A switch under the banner chooses between **Play** (the banner, vitals, ability and save hexes, and attacks) and **Sheet** (everything). The choice is remembered on that device.
- **Vitals strip.** Once the health block scrolls out of view, a strip with HP, AC and conditions stays pinned at the top. On a wide window it sits over the sheet column.
- **Session log drawer.** The Actions drawer starts folded the first time you open a log on a phone. Open it with the chevron; the choice is remembered.
- **Touch targets.** Controls that only appeared on hover (feature collapse, inventory sell and equip) are visible at rest.

## The legend

The **?** in the corner of the status panel opens a short list of what the sheet's marks mean: the gold ring on a save, the green **A** and red **D**, the proficiency dots, the dot after an in-use proficiency, the death-save circles, and the roll and info controls.

## Styling

The panels under the status panel (senses, skills, proficiencies, rolls) share one warm parchment surface at every width, in light and dark themes. Link colour inside them is a violet ink chosen to pass WCAG AA. The CSS lives in `lib/styles/sheet-surface.css` (all widths) and `lib/styles/mobile.css` (phones only).
