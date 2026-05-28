# Spread Layout Test

## Case 1: Spread blocks at page level (direct in markdown)

### Strength

````rpg rule.side
kind: spread
title: STRENGTH (STR)
subtitle: "Associated Skills: Athletics"
---
Strength measures bodily power, athletic aptitude, and the extent to which you can exert raw physical force. STR is used to:
- Calculate attack rolls and damage with melee weapons
- Determine how much weight can be lifted or carried
````

### Dexterity

````rpg rule.side
kind: spread
title: DEXTERITY (DEX)
subtitle: "Associated Skills: Acrobatics, Sleight of Hand, Stealth"
---
Dexterity measures agility, reflexes, and balance. DEX is used to:
- Calculate attack rolls and damage with ranged weapons
- Calculate Armor Class
- Determine initiative order
````

### Constitution

````rpg rule.side
kind: spread
title: CONSTITUTION (CON)
subtitle: "Associated Skills: None"
---
Constitution measures health, stamina, and vital force. CON is used to:
- Determine hit points
- Resist poison and disease
````

### Intelligence

````rpg rule.side
kind: spread
title: INTELLIGENCE (INT)
subtitle: "Associated Skills: Arcana, History, Investigation, Nature, Religion"
---
Intelligence measures mental acuity, accuracy of recall, and the ability to reason. INT is used to:
- Calculate certain class spellcasting abilities
- Communicate without using words
- Estimate the value of a precious item
````

---

## Case 2: Spread blocks inside a callout

````rpg rule.side
kind: callout
title: Ability Summary
---
### Strength

````rpg rule.side
kind: spread
title: STRENGTH (STR)
subtitle: "Associated Skills: Athletics"
---
Strength measures bodily power and athletic aptitude.
````

### Dexterity

````rpg rule.side
kind: spread
title: DEXTERITY (DEX)
subtitle: "Associated Skills: Acrobatics, Sleight of Hand, Stealth"
---
Dexterity measures agility, reflexes, and balance.
````

### Constitution

````rpg rule.side
kind: spread
title: CONSTITUTION (CON)
subtitle: "Associated Skills: None"
---
Constitution measures health, stamina, and vital force.
````

### Intelligence

````rpg rule.side
kind: spread
title: INTELLIGENCE (INT)
subtitle: "Associated Skills: Arcana, History, Investigation, Nature, Religion"
---
Intelligence measures mental acuity and the ability to reason.
````
````

---

## Case 3: Standalone spread (single, should NOT column)

````rpg rule.side
kind: spread
title: CHARISMA (CHA)
subtitle: "Associated Skills: Deception, Intimidation, Performance, Persuasion"
---
Charisma measures your ability to interact effectively with others. It includes factors like confidence and eloquence.
````
