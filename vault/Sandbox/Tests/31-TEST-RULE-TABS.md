---
source:
  system: tov
  book: Player's Guide
  company: Kobold Press
---

# Phase 4 Demo — `rpg rule.tab`

Each `rpg rule.tab` block declares one tab. Consecutive blocks auto-merge into a single tablist. Selecting a tab loads its markdown content; inactive panels are DOM-removed.

## Basic example
```rpg rule.tab
name: Grappling
icon: swords
color: "#8b6f47"
---
**Grapple.** Using the Attack action, you can make a special melee attack to grab a creature within reach. The target must be no more than one size larger than you.

On success, the target is **grappled** and its speed becomes 0 until the grapple ends.

### Ending a Grapple

The grapple ends if:

- You are incapacitated
- The target is moved out of your reach by an effect (such as being hurled by *thunderwave*)
- The grappled creature uses its action to escape. To do so, it makes a Strength (Athletics) or Dexterity (Acrobatics) check contested by your Strength (Athletics) check

### Moving a Grappled Creature

When you move, you can drag or carry the grappled creature with you, but your speed is halved, unless the creature is two or more sizes smaller than you.

A grappled creature can be moved by other effects, such as being shoved. If an effect would move the grappled creature out of your reach, the grapple ends.

### Grappling Larger Creatures

You can only grapple a creature that is no more than one size larger than you. Some features allow you to grapple creatures of larger sizes. The check remains the same regardless of size difference.
```
```rpg rule.tab
name: Shoving
icon: shield
color: var(--color-blue)
---
**Shove.** Using the Attack action, you can shove a creature within reach to either knock it prone or push it away from you.

The target must be no more than one size larger than you. You make a Strength (Athletics) check contested by the target's Strength (Athletics) or Dexterity (Acrobatics) check (the target chooses the ability to use).

### Knocking Prone

If you win the contest, you either knock the target prone or push it 5 feet away from you.

A prone creature has disadvantage on attack rolls. An attack roll against the creature has advantage if the attacker is within 5 feet; otherwise the attack roll has disadvantage. The creature's only movement option is to crawl (costing double movement), unless it stands up, which costs half its total speed.

### Pushing Away

Instead of knocking the target prone, you can push it 5 feet away from you in a straight line. If there is an obstacle in the way (such as a wall or another creature), the shoved creature stops at that point.

### Shoving Larger Creatures

You can only shove a creature that is no more than one size larger than you. The Powerful Build trait and similar features can increase the size of creature you can shove.
```
```rpg rule.tab
name: Opportunity Attacks
icon: alert-triangle
color: var(--color-orange)
---
**Opportunity attack.** When a hostile creature you can see moves out of your reach, you can use your reaction to make one melee attack against it.

The attack occurs right before the creature leaves your reach. The attack interrupts the provoking creature's movement.

### Avoiding Opportunity Attacks

You can avoid provoking an opportunity attack by taking the Disengage action. You also don't provoke if you are moved without using your movement, action, or reaction — for example, if an explosion hurls you out of a foe's reach, or if gravity causes you to fall past an enemy.

You also don't provoke opportunity attacks when you teleport or when someone or something moves you without using your movement, action, or reaction.

### Creatures and Opportunity Attacks

Creatures with a reach of 0 feet can't make opportunity attacks because they have no reach to leave. Similarly, you can't make opportunity attacks against creatures that teleport or use special movement types like burrowing.

### Multiple Opportunity Attacks

You can only make one opportunity attack per turn (not per round). However, if you have features that grant additional reactions, you might be able to make more.
```
```rpg rule.tab
name: Luck
icon: clover
---
`@[[Luck]].bare()`
```
## With call imports inside tabs

Tab content supports the full call syntax:

```rpg rule.tab
name: Rules
icon: scroll
color: "#8b6f47"
---
`@[[combat]].h3()`
```

```rpg rule.tab
name: Grapple Details
icon: grip-horizontal
---
`@[[combat]].callout(grapple)`
```

```rpg rule.tab
name: Quick Reference
icon: list
---
`@[[combat]].item()`
```
