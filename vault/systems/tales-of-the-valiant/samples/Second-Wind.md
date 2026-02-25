---
source: Fighter
---

# Second Wind

A fighter's ability to push past physical limits and recover in the heat of battle.

## Feature Entry

```rpg feature.feature
name: Second Wind
type: bonus_action
source: Fighter
description: You have a limited well of stamina that you can draw on to protect yourself from harm. On your bonus action, you can regain hit points equal to 1d10 + your fighter level. Once you use this feature, you must finish a short or long rest before you can use it again.
```

## Aspects

```rpg feature.aspects
aspects:
  - name: Recover Hit Points
    type: bonus
    description: Roll 1d10 and add your fighter level. Regain that many hit points.
  - name: Short Rest Recovery
    type: passive
    description: You can use Second Wind once per short or long rest.
```
