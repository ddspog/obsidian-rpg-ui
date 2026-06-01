---
cssclasses: ["note-item"]
source: From **Tales of the Valiant** "Player's Guide" by **Kobold Press**.
---
# Sack
```rpg item.element
name: Sack
type: "[[Adventuring Gear]] (Container)"
cost: 1 cp
weight: 1/2 lb.
image: "![[sack.webp|384]]"
container:
  volume_cap: 1 cubic foot
  weight_cap: 30 lb.
shop:
  cheap: 1 cp
  expensive: 2 cp
  availability:
    - "[[Limited]]"
    - "[[Rural]]"
    - "[[Urbane]]"
    - "[[Premium]]"
---
A Sack holds up to 30 pounds within 1 cubic foot.
```
```rpg rule.related
view: footer
entries:
  - `@[[Container Capacity]].bare()`
```