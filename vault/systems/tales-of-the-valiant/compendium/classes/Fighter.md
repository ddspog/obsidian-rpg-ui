---
.metadata:
  cssclasses: [note-class, rpg-ui]
.CLASS:
  hit_die: d10
  caster: none
---

# Fighter

Martial class focused on weapon mastery and combat versatility.

## Class Features

```rpg feature.details
name: Hit Points
level: 1
text: |
  **Hit Dice:** 1d10 per fighter level

  **Hit Points at 1st Level:** 10 + your CON modifier

  **Hit Points at Higher Levels:** 1d10 (or 6) + your CON modifier per fighter level after 1st
traits:
  Hit Dice: "+10 +CON mod +[LV - 1][CON mod + 1d10]"
```

```rpg feature.details
name: Proficiencies
level: 1
text: |
  **Armor:** [[Light Armor]], [[Medium Armor]], [[Heavy Armor]], and [[Shields]]

  **Weapons:** [[Simple]] and [[Martial]] weapons

  **Saves:** STR, CON
traits:
  Armor Proficiency: "Light Armor, Medium Armor, Heavy Armor, Shields"
  Weapon Proficiency: "Simple, Martial"
  Saving Throws: "STR, CON"
```

```rpg feature.details
name: Fighting Style
level: 1
pick: 1
text: |
  Choose a combat specialization that defines how you fight.
```

```rpg feature.choice
parent: Fighting Style
name: Defense
text: |
  **_Defense._** While you are wearing armor, you gain a +1 bonus to AC.
traits:
  AC: "+1 (while wearing armor)"
```

```rpg feature.choice
parent: Fighting Style
name: Dueling
text: |
  **_Dueling._** When you are wielding a melee weapon in one hand and no other weapons, you gain a +2 bonus to damage rolls with that weapon.
traits:
  Damage: "+2 melee one-handed when no other weapon"
```

```rpg feature.choice
parent: Fighting Style
name: Great Weapon Fighting
text: |
  **_Great Weapon Fighting._** When you roll a 1 or 2 on a damage die for an attack with a melee weapon you wield with two hands, you can reroll the die and must use the new roll.
traits:
  Damage: "Reroll 1s and 2s on two-handed melee weapon damage"
```

```rpg feature.details
name: Action Surge
subtitle: "2nd-Level Fighter Feature"
type: free_action
level: 2
uses: 1
text: |
  Once on your turn, you can take one additional action on top of your regular action and a possible bonus action. Once you use this feature, you must finish a short or long rest before you can use it again.
traits:
  Action Surge: "1 extra action / short rest (Lv 2)"
```

```rpg feature.details
name: Fighter Subclass
subtitle: "3rd-Level Fighter Feature"
level: 3
text: |
  Choose a martial archetype that reflects your combat style.
```

```rpg feature.unlock
kind: subclass
level: 3
```
