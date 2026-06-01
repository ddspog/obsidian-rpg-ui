---
cssclasses: ["note-item"]
source: From **Tales of the Valiant** "Player's Guide" by **Kobold Press**.
---
# Pouch
```rpg item.element
name: Pouch
type: "[[Adventuring Gear]] (Container)"
cost: 5 sp
weight: 1 lb.
image: "![[pouch.webp|384]]"
container:
  volume_cap: 1/5 cubic foot
  weight_cap: 6 lb.
  for_ammo:
    - "[[Sling Bullets]]"
    - "[[Blowgun Needles]]"
  ammo_cap:
    Sling Bullets: 20
    Blowgun Needles: 50
shop:
  cheap: 3 sp
  expensive: 8 sp
  availability:
    - "[[Rural]]"
    - "[[Urbane]]"
    - "[[Premium]]"
---
A cloth or leather pouch can hold up to [[Sling bullets|20 sling bullets]] or 50 blowgun needles, among other things. A compartmentalized pouch for holding spell components is called a [[component pouch]] (described earlier in this section). 
```
```rpg rule.related
view: footer
entries:
  - `@[[Container Capacity]].bare()`
```