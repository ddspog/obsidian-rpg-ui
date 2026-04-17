---
.metadata:
  cssclasses: [note-class, rpg-ui]
.CLASS:
  hit_die: d8
  caster: full
---

# Cleric

Full-caster divine class. Channels divine power through prepared spells and Channel Divinity.

## Level 1

```rpg feature.details
name: Hit Points
tag: hp
level: 1
value: "+8 +CON mod"
```

```rpg feature.details
name: Armor Proficiency
tag: armor
level: 1
values: [Light Armor, Medium Armor, Shields]
```

```rpg feature.details
name: Saving Throws
tag: save
level: 1
values: [WIS, CHA]
```

```rpg feature.details
name: Spellcasting
type: passive
level: 1
link: "[[Spellcasting]]"
description: "As a conduit for divine power, you can cast cleric spells."
```

```rpg feature.details
name: Skill Proficiencies
tag: skill_proficiency
level: 1
pick: 2
```

```rpg feature.choice
parent: Skill Proficiencies
value: History
```

```rpg feature.choice
parent: Skill Proficiencies
value: Insight
```

```rpg feature.choice
parent: Skill Proficiencies
value: Medicine
```

```rpg feature.choice
parent: Skill Proficiencies
value: Persuasion
```

```rpg feature.choice
parent: Skill Proficiencies
value: Religion
```

```rpg feature.details
name: Divine Order
level: 1
pick: 1
description: "Choose how your divine connection shapes your training."
```

```rpg feature.choice
parent: Divine Order
name: Protector
description: "Gain proficiency with martial weapons and heavy armor."
tag: armor
values: [Heavy Armor]
features:
  - { name: "Manifestation of Faith", link: "[[Manifestation of Faith]]", type: passive, description: "Faith made flesh." }
```

```rpg feature.choice
parent: Divine Order
name: Thaumaturge
description: "Gain an additional cantrip and a damaging spell."
features:
  - { name: "Extra Cantrip", type: passive, description: "Learn one additional cleric cantrip." }
```

## Level 2

```rpg feature.details
name: Hit Points
tag: hp
level: 2
value: "+1d8 +CON mod"
```

```rpg feature.details
name: Channel Divinity
type: free_action
level: 2
uses: 1
link: "[[Channel Divinity]]"
description: "Channel divine energy directly from your deity."
```

## Level 3

```rpg feature.details
name: Hit Points
tag: hp
level: 3
value: "+1d8 +CON mod"
```

```rpg feature.unlock
kind: subclass
level: 3
```
