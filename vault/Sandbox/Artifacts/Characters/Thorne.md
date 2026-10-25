---
proficiency_bonus: 3
level: 5
class: Cleric
---

# Thorne - Dwarf Cleric

A stalwart cleric of the forge domain, equally comfortable in battle and at the anvil.

```rpg character.header
classes:
  - name: "Cleric"
    level: 5
    subclass: "Forge Domain"
lineage: "Dwarf"
background: "Acolyte"
```

```rpg character.health
state_key: thorne-hp
label: "Hit Points"
max: 42
hitdice:
  - dice: "d8"
    value: 5
```

```rpg character.features
sources:
  - source: "Cleric"
    level: 5
    features:
      - name: "Sacred Flame"
        action:
          text: "Cantrip. Dex save or 2d8 radiant. Range 60 ft."
          log: "@({{actor}}) casts Sacred Flame on {{target}}\nd: Save DC 14 vs Dex -> {{result}}"

      - name: "Warhammer Attack"
        action:
          text: "Melee attack. +5 to hit, 1d8+2 bludgeoning."
          log: "@({{actor}}) swings Warhammer at {{target}}\nd: Attack d20+5={{roll}} vs AC -> {{result}}"

      - name: "Guiding Bolt"
        action:
          text: "Spell (1st). 4d6 radiant, next attack has advantage."
          max: 4
          recovery: "long rest"
          log: "@({{actor}}) casts Guiding Bolt on {{target}}\nd: Spell Attack d20+6={{roll}} -> {{result}}"

      - name: "Healing Word"
        bonus:
          text: "Spell (1st). Heal 1d4+3 HP at range 60 ft."
          max: 4
          recovery: "long rest"
          log: "@({{actor}}) casts Healing Word on {{target}}\nd: Heal 1d4+3={{roll}}\n=> [PC:{{target}}|HP+{{roll}}]"

      - name: "Spiritual Weapon"
        bonus:
          text: "Spell (2nd). Summon spectral weapon, attack as bonus action."
          max: 3
          recovery: "long rest"
          log: "@({{actor}}) commands Spiritual Weapon to strike {{target}}\nd: Attack d20+6={{roll}} vs AC -> {{result}}"

      - name: "Shield of Faith"
        bonus:
          text: "Spell (1st). Grant +2 AC to a creature for 10 minutes."
          max: 4
          recovery: "long rest"
          log: "@({{actor}}) casts Shield of Faith on {{target}}\n=> [PC:{{target}}|AC+2]"

      - name: "Channel Divinity"
        action:
          text: "Turn Undead or use Artisan's Blessing."
          max: 1
          recovery: "short rest"
          log: "@({{actor}}) channels divinity against {{target}}\n=> [N:{{target}}|turned]"

      - name: "Destroy Undead"
        passive:
          text: "Channel Divinity destroys undead of CR 1/2 or lower."

  - source: "Forge Domain"
    level: 5
    features:
      - name: "Blessing of the Forge"
        active:
          text: "Grant +1 AC to armor or +1 attack/damage to weapon until next long rest."
          max: 1
          recovery: "long rest"
          log: "@({{actor}}) bestows Blessing of the Forge on {{target}}'s equipment"
```

```rpg character.description
Thorne comes from a long line of forge clerics, dedicated to both the craft of smithing and the protection of the innocent.
```
