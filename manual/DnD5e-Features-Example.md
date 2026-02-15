# D&D 5e Features Configuration

This file contains the features system configuration for D&D 5e.

```rpg system-features
categories:
  - id: action
    label: Action
    icon: ⚔️
  - id: bonus_action
    label: Bonus Action
    icon: ⚡
  - id: reaction
    label: Reaction
    icon: 🛡️
  - id: passive
    label: Passive
    icon: ✨

providers:
  - class
  - race
  - background
  - feat

collectors:
  - character
  - monster
```

## Usage

Reference this file in your system definition:

```yaml
rpg system
name: "My D&D System"
features: "Systems/DnD5e-Features.md"
```
