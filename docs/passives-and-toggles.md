# Passives, toggles, and what they change

A feature's `passive:` is always on; an `active:` that **toggles** is switched on and off in the log. Either can say what it does to other cards with `modifies:`.

```yaml
passive:
  name: Archery Style
  modifies:
    - { on: ranged attack, to_hit: +2 }

active:
  name: Rage
  toggle: true            # optional when `modifies:` is there
  modifies:
    - { on: melee attack, damage: +2 }
    - { on: save, advantage: STR }
```

## `on` — which cards

`attack` · `weapon attack` · `melee attack` · `ranged attack` · `spell attack` · `spell` · `save` · or a card's own name (`Longbow`).

## What a modifier can do

| Key | Effect on the touched card |
|---|---|
| `damage: +2` / `"1d4"` | added to the first damage roll (`1d8+4` → `1d8+6`; dice are appended) |
| `to_hit: +2` | added to the attack roll (`d20+6` → `d20+8`) |
| `advantage: true` / `STR, CON` | the roll advice writes `2d20kh1` (an attack), or advantage on those saves; it cancels against disadvantage |
| `disadvantage` | the same, `2d20kl1` |
| `note: "…"` | said on the card, nothing rewritten (`speed +10 ft.`) |

A card changed this way shows a small diamond on its tile, lists what changed in its tooltip, and in its confirmation (`Rage +2 damage`).

## Toggling

Click a toggle's tile to switch it on or off — at once, no popup, nothing written to the log. The switch is kept in the plugin's state under the log's own state key (`<log>:toggles`), so it survives a reload and every card reads it: a lit tile and a pill show it, and the cards it touches change (and flip back when it's off). A new log starts with everything off.

## Passives

A passive card is read, not played: clicking it shows what it is and what it changes. **Note in the log** writes `@(Talon) Heightened Senses applies` for the moment it matters. Passives sit last in the bar, behind their own pill.
