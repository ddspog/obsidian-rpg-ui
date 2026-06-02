---
cssclasses: ["note-item"]
source: From **Tales of the Valiant** "Player's Guide" by **Kobold Press**.
---
# Quiver
```rpg item.element
name: Quiver
type: "[[Adventuring Gear]] (Container)"
cost: 1 gp
weight: 1 lb.
image: "![[quiver.webp|384]]"
container:
  volume_cap: 20 arrows or 20 crossbow bolts
  ammo_cap: 20
  for_ammo:
    - "[[Arrows]]"
    - "[[Crossbow Bolts]]"
shop:
  cheap: 7 sp
  expensive: 2 gp
  availability:
    - "[[Limited]]"
    - "[[Rural]]"
    - "[[Urbane]]"
    - "[[Premium]]"
---
A quiver can hold up to [[arrows|20 arrows]] or [[crossbow bolts|20 crossbow bolts]].
```
```rpg rule.related
view: footer
entries:
  - `@[[Container Capacity]].bare()`
```