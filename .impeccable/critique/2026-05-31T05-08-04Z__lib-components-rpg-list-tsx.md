---
target: rpg list pills + pagination
total_score: 17
p0_count: 0
p1_count: 2
timestamp: 2026-05-31T05-08-04Z
slug: lib-components-rpg-list-tsx
---
# Critique — rpg list pills + pagination controls

Scoped to the two controls the user flagged: the list pills (`.rpg-list__chips`)
and the pagination footer (`.rpg-list__pagination`).

## Design Health (scoped to these two controls)

| # | Heuristic | Score | Key issue |
|---|-----------|-------|-----------|
| 1 | Visibility of system status | 2 | Active pill is a near-invisible 12% tint; can't tell the current list/page at a glance |
| 2 | Match system / real world | 3 | Pills-as-tabs + chevron pager are familiar patterns |
| 3 | User control and freedom | 3 | Jump + prev/next both exist; no arrow-key nav between tabs |
| 4 | Consistency and standards | 2 | Diverges from the plugin's own `rule.tab` tab bar AND the warm heading bars; pills and pager speak different visual languages |
| 5 | Error prevention | n/a | |
| 6 | Recognition rather than recall | 3 | Pills are labelled, but the active one isn't clearly "you are here" |
| 7 | Flexibility and efficiency | 2 | Pill-to-page jump is good; no keyboard nav; pills wrap with many lists |
| 8 | Aesthetic and minimalist | 2 | Reads generic and unfinished; emphasis is inverted (loud at rest, faint when active) |
| 9 | Error recovery | n/a | |
| 10 | Help and documentation | n/a | |
| **Total (scored)** | | **17/28** | **Competent but unfinished** |

## Anti-patterns verdict

Deterministic scan: clean (0 of 27 patterns; no side-stripes, gradients, or glass).

The slop here is the product kind, not the brand kind. By the product test ("would a
user fluent in Linear / Notion / Raycast trust this or pause at a subtly-off
component?"), they'd pause twice: at the selected pill (which barely reads as selected)
and at the realization that this plugin now has three navigation vocabularies (the
`rule.tab` tab strip, the warm heading bars, and these cool gray chips) that don't
reference each other. DESIGN.md calls inconsistent component vocabulary a ban.

## What's working

- The pill→page jump plus prev/next is a genuinely good two-speed model: scan by list, step by page.
- Uppercase + letter-spacing on the pills obeys the Uppercase Signpost Rule, and both bars use semantic `<menu>`. The bones are right.

## Priority issues

**[P1] The selected pill is invisible.** Active = `--rpg-list-bar-bg` (text-title at 12%)
on a gray pill. On a dim screen at arm's length it's indistinguishable from the rest, so
the pill bar fails its one job: telling you which list/page you're on. Fix: give it a
real active treatment from the system's own vocabulary (periwinkle-active fill, or better,
the warm heading-bar tint so the active pill visually rhymes with the section it lands on).

**[P1] Emphasis is inverted.** The pills are filled gray at rest (loud) and faint when
active (quiet), the opposite of DESIGN.md's "controls quiet at rest, responsive on
engagement." Fix: rest = transparent/ghost with a 1px border (the button-base spec);
active = the filled accent. This solves the visibility problem and aligns with the spec
in one move.

**[P2] Three navigation vocabularies, no relationship.** The pills are cool gray chips;
the section bars are warm shaded; the existing `rule.tab` strip is a third style. Pick one
language. The strongest move ties the cool structural pills to the warm content bars (the
Dual Temperature Rule) so selecting "SET 3" visibly echoes the SET 3 bar.

**[P2] The pager reads as an afterthought.** A lonely hairline rule, tiny ghost chevrons,
and a muted "1 / 4" with no relationship to the pills above. Fix: give it the same active/
border vocabulary as the (fixed) pills, a more legible position cue, and a real tap target
(the chevrons are well under the 44px the system uses elsewhere).

**[P3] Pills don't scale.** Eight fit; twenty wrap into stacked rows that eat the reserved
height. `rule.tab` already solves this with horizontal scroll. Reuse that, or cap/scroll.

## Persona red flags

**DM mid-session (the core power user):** glances at the bar to confirm "am I on SET 3?"
and can't tell, because the active pill matches the rest. Falls back to reading the heading,
which defeats the pill. Wants arrow keys between tabs (role=tab is set, but no key handler).

**First-time player:** sees pills at the top and chevrons at the bottom and isn't sure
they're the same navigation. The "1 / 4" glyph cluster doesn't announce "there's more below."

## Minor observations

- Active pill uses `font-weight: 700`, which reflows the pill width on selection (visible jiggle). Cue weight without changing layout, or reserve the bold width.
- Chevrons have `aria-label` (good); the active pill sets `aria-selected` (good). The gap is visual, not semantic.
