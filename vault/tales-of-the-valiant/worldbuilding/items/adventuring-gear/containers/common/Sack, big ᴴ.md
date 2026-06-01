---
cssclasses: ["note-item"]
source: Homebrew adapting [[Sack]] from **Tales of the Valiant** "Player's Guide" book by **Kobold Press**
---
# Sack, big ᴴ
```rpg item.element
name: Sack, big ᴴ
type: "[[Adventuring Gear]] (Container)"
cost: 2 cp
weight: 1 lb.
image: "![[big-sack.webp|384]]"
container:
  volume_cap: 2 cubic foot
  weight_cap: 60 lb.
shop:
  cheap: 1 cp
  expensive: 3 cp
  availability:
    - "[[Limited]]"
    - "[[Rural]]"
    - "[[Urbane]]"
    - "[[Premium]]"
---
A Sack holds up to 60 pounds within 2 cubic foot.
```
```rpg rule.related
view: footer
entries:
  - `@[[Container Capacity]].bare()`
```
