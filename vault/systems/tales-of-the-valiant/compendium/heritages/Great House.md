---
.metadata:
  cssclasses: [note-heritage, rpg-ui]
.HERITAGE: {}
---

# Great House

Born into a noble family with influence and obligations.

```rpg feature.details
name: Noble Connections
type: passive
text: |
  You are recognized by other nobles. They are inclined to be civil and grant audience.
traits:
  Social: "Recognized by nobles; grants audience by default"
```

```rpg feature.details
name: Language
pick: 1
text: |
  You speak one additional language reflecting your house's allies or trading partners.
```

```rpg feature.choice
parent: Language
name: Dwarvish
text: |
  **_Dwarvish._** You speak Dwarvish.
traits:
  Languages: "+Dwarvish"
```

```rpg feature.choice
parent: Language
name: Elvish
text: |
  **_Elvish._** You speak Elvish.
traits:
  Languages: "+Elvish"
```

```rpg feature.choice
parent: Language
name: Celestial
text: |
  **_Celestial._** You speak Celestial.
traits:
  Languages: "+Celestial"
```

```rpg feature.choice
parent: Language
name: Infernal
text: |
  **_Infernal._** You speak Infernal.
traits:
  Languages: "+Infernal"
```
