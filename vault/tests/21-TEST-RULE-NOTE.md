# Rule.side `kind: note` — Aged Letter

Smoke-test for the new `note` variant: an in-flow parchment card styled as
in-world correspondence (aged paper, folded dog-ear corner, serif italic
body, optional script-style title). Open in reading view.

## Titled note (with default quill)

A title is present, so the header shows with a default `feather` quill icon.

```rpg rule.side
kind: note
title: A Letter from the Archmage
---
Dearest traveler — the road ahead is fraught with peril. Trust the woman
in the red cloak; she alone knows the way through the Mistwood. Burn this
once you have read it.
```

Body text continues here after the letter, confirming the note sits in-flow
within the readable column rather than floating into the gutter.

## Untitled note (the common case)

No `title:` — the header disappears entirely, leaving a bare letter. This is
the primary case the variant is built for.

```rpg rule.side
kind: note
---
The shipment arrives at the third bell. Come alone. Tell no one — _especially_
not the captain.
```

## Note with a preset accent (`type: danger`)

The `type:` preset still drives the accent color (header + dog-ear edge),
exactly as with the other side variants.

```rpg rule.side
kind: note
type: danger
title: Warning
---
Do not open the eastern vault. Whatever the merchant told you, the seal is
there for a reason.
```

## Note with an explicit icon + long title

A long title should wrap clear of the folded corner (the header reserves
dog-ear width on its trailing edge).

```rpg rule.side
kind: note
icon: scroll
title: On the Matter of the Disputed Inheritance and Sundry Debts
---
Per the late baron's wishes, the orchard passes to his niece, the mill to the
guild, and the debts — all of them — to whoever is foolish enough to claim
the title.
```

## Contrast: callout and float (unchanged)

```rpg rule.side
kind: callout
type: rules
title: Callout (for comparison)
---
The in-flow certificate-style callout — unchanged by this work.
```

```rpg rule.side
kind: float
title: Float (for comparison)
---
The gutter banner float — unchanged by this work.
```

Filler paragraph so the float has body text to wrap against. Lorem ipsum dolor
sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut
labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud.
