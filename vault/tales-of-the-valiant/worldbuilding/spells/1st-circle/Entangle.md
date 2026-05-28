---
cssclasses:
  - note-spell
source: From **Tales of the Valiant** "Player's Guide" by **Kobold Press**.
---
# Entangle

```rpg spell
circle: 1st-Circle
source:
  - "[[Primordial]]"
school: Conjuration
casting: 1 action
range: 90 feet
components:
  - V
  - S
duration: Concentration, up to 1 minute
style:
  - Ritual
summary: Restrains targets in 20-ft. square.
image: "![[entangle.webp|384]]"
roll:
  form: save
  circle: 1
  range: 90 ft.
  save:
    ability: STR
    on_success: "negates restrained"
  effects:
    - restrained
  notes: 20-ft square of grasping weeds; restrained on fail

---
Grasping weeds and vines sprout from the ground in a 20-foot square starting from a point within range. For the duration, these plants turn the ground in the area into difficult terrain. A creature in the area when you cast the spell must succeed on a STR save or be [[restrained]] by the entangling plants until the spell ends. A creature restrained by the plants can use its action to make a STR check against your spell save DC. On a success, it frees itself. When the spell ends, the conjured plants wilt away.
```
