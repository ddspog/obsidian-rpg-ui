---
.metadata:
  cssclasses: [note-lineage, rpg-ui]
.LINEAGE:
  size: medium
  speed: 30
---

# Human

Versatile and adaptable. The most numerous and widespread lineage.

```rpg feature.details
name: Speed
text: |
  Your base walking speed is 30 feet.
traits:
  Speed: "30 ft."
```

```rpg feature.details
name: Skill Versatility
pick: 1
text: |
  Choose one additional skill you have proficiency in.
```

```rpg feature.choice
parent: Skill Versatility
name: Acrobatics
text: |
  **_Acrobatics._** You gain proficiency in [[Acrobatics]].
traits:
  Skill Proficiency: "+Acrobatics"
```

```rpg feature.choice
parent: Skill Versatility
name: Insight
text: |
  **_Insight._** You gain proficiency in [[Insight]].
traits:
  Skill Proficiency: "+Insight"
```

```rpg feature.choice
parent: Skill Versatility
name: Perception
text: |
  **_Perception._** You gain proficiency in [[Perception]].
traits:
  Skill Proficiency: "+Perception"
```

```rpg feature.choice
parent: Skill Versatility
name: Stealth
text: |
  **_Stealth._** You gain proficiency in [[Stealth]].
traits:
  Skill Proficiency: "+Stealth"
```
