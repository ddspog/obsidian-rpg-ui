---
proficiency_bonus: 3
level: 5
class: Rogue
---

# Elara - Half-Elf Rogue

A nimble and cunning rogue specializing in stealth and precision strikes.

```rpg character.header
classes:
  - name: "Rogue"
    level: 5
lineage: "Half-Elf"
background: "Criminal"
```

```rpg character.health
state_key: elara-hp
label: "Hit Points"
max: 38
hitdice:
  - dice: "d8"
    value: 5
```

```rpg character.features
sources:
  - source: "Rogue"
    level: 5
    features:
      - name: "Sneak Attack"
        passive:
          text: "Deal extra 3d6 damage when you have advantage or an ally is within 5 ft."

      - name: "Cunning Action"
        bonus:
          text: "Dash, Disengage, or Hide as a bonus action."
          log: "@({{actor}}) uses Cunning Action to {{target}}"

      - name: "Uncanny Dodge"
        reaction:
          text: "Halve damage from an attack you can see."
          max: 1
          recovery: "short rest"
          log: "@({{actor}}) uses Uncanny Dodge against {{target}}'s attack\n=> [PC:{{actor}}|damage halved]"

      - name: "Shortsword Attack"
        action:
          text: "Melee attack. +7 to hit, 1d6+5 piercing."
          log: "@({{actor}}) attacks {{target}} with Shortsword\nd: Attack d20+7={{roll}} vs AC -> {{result}}"

      - name: "Shortbow Attack"
        action:
          text: "Ranged attack. +7 to hit, 1d8+4 piercing. Range 80/320."
          log: "@({{actor}}) shoots {{target}} with Shortbow\nd: Attack d20+7={{roll}} vs AC -> {{result}}"

      - name: "Throw Dagger"
        action:
          text: "Ranged attack. +7 to hit, 1d4+4 piercing. Range 20/60."
          log: "@({{actor}}) throws a dagger at {{target}}\nd: Attack d20+7={{roll}} vs AC -> {{result}}"

      - name: "Stealth"
        action:
          text: "Hide in shadows. +10 Stealth check."
          log: "@({{actor}}) hides\nd: Stealth d20+10={{roll}} -> {{result}}"

      - name: "Potion of Healing"
        bonus:
          text: "Drink a potion to heal 2d4+2 HP."
          max: 2
          log: "@({{actor}}) drinks a Potion of Healing\nd: Heal 2d4+2={{roll}}\n=> [PC:{{actor}}|HP+{{roll}}]"
```

```rpg character.description
Elara grew up on the streets, using her quick wits and nimble fingers to survive. Now she uses her skills to help those who can't help themselves.
```
