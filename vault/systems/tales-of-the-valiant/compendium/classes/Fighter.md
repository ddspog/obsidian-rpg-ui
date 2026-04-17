---
.metadata:
  cssclasses: [note-class, rpg-ui]
.CLASS:
  hit_die: d10
  caster: none
---

# Fighter

Martial class focused on weapon mastery and combat versatility.

## Level 1

```rpg feature.details
name: Hit Points
tag: hp
level: 1
value: "+10 +CON mod"
```

```rpg feature.details
name: Armor Proficiency
tag: armor
level: 1
values: [Light Armor, Medium Armor, Heavy Armor, Shields]
```

```rpg feature.details
name: Saving Throws
tag: save
level: 1
values: [STR, CON]
```

```rpg feature.details
name: Fighting Style
level: 1
pick: 1
description: "Choose a combat specialization."
```

```rpg feature.choice
parent: Fighting Style
name: Defense
description: "+1 AC while wearing armor."
```

```rpg feature.choice
parent: Fighting Style
name: Dueling
description: "+2 damage with one-handed melee weapons when no other weapon is held."
```

```rpg feature.choice
parent: Fighting Style
name: Great Weapon Fighting
description: "Reroll 1s and 2s on damage with two-handed weapons."
```

## Level 2

```rpg feature.details
name: Hit Points
tag: hp
level: 2
value: "+1d10 +CON mod"
```

```rpg feature.details
name: Action Surge
type: free_action
level: 2
uses: 1
description: "Take one additional action on your turn."
```

## Level 3

```rpg feature.details
name: Hit Points
tag: hp
level: 3
value: "+1d10 +CON mod"
```

```rpg feature.unlock
kind: subclass
level: 3
```
