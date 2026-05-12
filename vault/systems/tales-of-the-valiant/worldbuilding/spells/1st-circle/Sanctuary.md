---
cssclasses:
  - note-spell
---
# Sanctuary

```rpg spell
circle: 1st-Circle
source:
  - "[[Divine]]"
school: Abjuration
casting: 1 bonus action
range: 30 ft.
components:
  - V
  - S
  - M (a small silver mirror)
duration: 1 minute
style:
  - Portal
summary: Ward a creature against attacks.
text: |-
  You ward a creature within range against attack. Until the spell ends, any creature who targets the warded creature with an attack or a harmful spell must first make a WIS save. On a failed save, the creature must choose a new target or lose the attack or spell. This spell doesn’t protect the warded creature from area effects, such as the explosion of a _fireball_. <br/> <br/>

  If the warded creature makes an attack or casts a spell that affects an enemy creature, this spell ends.
image: "![[sanctuary.webp|384]]"
roll:
  form: save
  circle: 1
  range: 30 ft.
  save:
    ability: WIS
    on_success: "attack proceeds"
  notes: ward target; attackers WIS save or lose attack/harmful effect
```



**Source**: *From **Tales of the Valiant** "Player's Guide" book by **Kobold Press***
