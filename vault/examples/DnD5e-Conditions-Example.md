# D&D 5e Conditions

This file contains the conditions system configuration for D&D 5e.

**Note:** This uses the `rpg system.conditions` dot notation format. Reference this file from your system definition with `conditions: "DnD5e-Conditions-Example.md"`.

```rpg system.conditions
- name: Blinded
  icon: "🙈"
  description: "A blinded creature can't see and automatically fails any ability check that requires sight. Attack rolls against the creature have advantage, and the creature's attack rolls have disadvantage."

- name: Charmed
  icon: "💖"
  description: "A charmed creature can't attack the charmer or target the charmer with harmful abilities or magical effects. The charmer has advantage on any ability check to interact socially with the creature."

- name: Deafened
  icon: "🔇"
  description: "A deafened creature can't hear and automatically fails any ability check that requires hearing."

- name: Frightened
  icon: "😨"
  description: "A frightened creature has disadvantage on ability checks and attack rolls while the source of its fear is within line of sight. The creature can't willingly move closer to the source of its fear."

- name: Grappled
  icon: "🤼"
  description: "A grappled creature's speed becomes 0, and it can't benefit from any bonus to its speed. The condition ends if the grappler is incapacitated or removed from reach."

- name: Incapacitated
  icon: "💫"
  description: "An incapacitated creature can't take actions or reactions."

- name: Invisible
  icon: "👻"
  description: "An invisible creature is impossible to see without magic or a special sense. Attack rolls against the creature have disadvantage, and the creature's attack rolls have advantage."

- name: Paralyzed
  icon: "⚡"
  description: "A paralyzed creature is incapacitated and can't move or speak. It automatically fails Strength and Dexterity saving throws. Attacks have advantage, and melee hits are critical."

- name: Petrified
  icon: "🪨"
  description: "A petrified creature is transformed into a solid inanimate substance. It is incapacitated, can't move or speak, and is unaware of its surroundings."

- name: Poisoned
  icon: "🤢"
  description: "A poisoned creature has disadvantage on attack rolls and ability checks."

- name: Prone
  icon: "🛌"
  description: "A prone creature can only crawl. It has disadvantage on attack rolls. Melee attacks against it have advantage; ranged attacks have disadvantage."

- name: Restrained
  icon: "⛓️"
  description: "A restrained creature's speed becomes 0. Attacks against it have advantage, its attacks have disadvantage, and it has disadvantage on Dexterity saving throws."

- name: Stunned
  icon: "😵"
  description: "A stunned creature is incapacitated, can't move, and can speak only falteringly. It automatically fails Strength and Dexterity saving throws. Attacks against it have advantage."

- name: Unconscious
  icon: "😴"
  description: "An unconscious creature is incapacitated, can't move or speak, and is unaware of its surroundings. It drops held items and falls prone. Melee hits are critical."

- name: Exhaustion
  icon: "😓"
  description: "Exhaustion is measured in six levels. Effects stack — at level 6, the creature dies. A long rest reduces exhaustion by one level."
```

## Usage

Reference this file in your system definition:

```yaml
rpg system
name: "D&D 5th Edition"
conditions: "DnD5e-Conditions-Example.md"
```

### Alternative: Wikilink Format

You can also define conditions as links to individual condition notes:

```yaml
rpg system.conditions
- [[Blinded]]
- [[Charmed]]
- [[Deafened]]
- [[Frightened]]
- [[Grappled]]
- [[Incapacitated]]
- [[Invisible]]
- [[Paralyzed]]
- [[Petrified]]
- [[Poisoned]]
- [[Prone]]
- [[Restrained]]
- [[Stunned]]
- [[Unconscious]]
- [[Exhaustion]]
```

This format is useful when each condition has its own detailed note in the vault.
