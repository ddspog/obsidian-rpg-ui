---
.metadata:
  cssclasses: [note-background, rpg-ui]
.BACKGROUND: {}
---

# Adherent

Servant of a divine cause. Your life is shaped by faith and practice.

```rpg feature.details
name: Talent
text: |
  **_Devout._** You start with the Devout talent.
traits:
  Talent: "+Devout"
```

```rpg feature.details
name: Background Skills
pick: 2
text: |
  Pick two skills shaped by your faith study.
```

```rpg feature.choice
parent: Background Skills
name: Insight
text: |
  **_Insight._** You gain proficiency in [[Insight]].
traits:
  Skill Proficiency: "+Insight"
```

```rpg feature.choice
parent: Background Skills
name: Investigation
text: |
  **_Investigation._** You gain proficiency in [[Investigation]].
traits:
  Skill Proficiency: "+Investigation"
```

```rpg feature.choice
parent: Background Skills
name: Religion
text: |
  **_Religion._** You gain proficiency in [[Religion]].
traits:
  Skill Proficiency: "+Religion"
```

```rpg feature.choice
parent: Background Skills
name: Persuasion
text: |
  **_Persuasion._** You gain proficiency in [[Persuasion]].
traits:
  Skill Proficiency: "+Persuasion"
```

```rpg feature.details
name: Tool Proficiency
text: |
  You gain proficiency with [[Calligrapher's Supplies]].
traits:
  Tool Proficiency: "+Calligrapher's Supplies"
```
