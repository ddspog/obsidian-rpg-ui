# Defining Skills

This file demonstrates how to define, configure, and inspect system skills using the `rpg system.skills` block and the `rpg show` entries visualization.
These descriptions include different ways you can use a skill.

## Filling system.skills

```rpg system.skills
skills:
  - name: "Acrobatics"
    attribute: dexterity
    subtitle: "Associated Ability: DEX"
    description: |
      Your DEX (Acrobatics) check covers your attempt to stay on your feet in a tricky situation, such as running across a sheet of ice, balancing on a tightrope, or staying upright on a rocking ship's deck. The GM might also call for a DEX (Acrobatics) check to see if you can perform acrobatic stunts, including dives, rolls, somersaults, and flips.

      ###### Avoid or Escape a Grapple
      Escaping a grapple is a unique way that a PC can use the Acrobatics skill. When a creature attempts to grapple you in combat, you can use the Acrobatics skill to attempt to avoid or escape it. See the Special Melee Attacks section in this chapter for more detail.
  - name: "Animal Handling"
    attribute: wisdom
    subtitle: "Associated Ability: Wisdom (WIS)"
    description: |
      When you want to calm a domesticated animal, keep a mount from getting spooked, or intuit an animal's intentions, the GM might call for a WIS (Animal Handling) check. You also make a WIS (Animal Handling) check to control your mount when you try something risky.
  - name: "Arcana"
    attribute: intelligence
    subtitle: "Associated Ability: Intelligence (INT)"
    description: |
      Your INT (Arcana) check measures your ability to recall lore about matters such as spells, magic items, eldritch symbols, magical traditions, the planes of existence, and inhabitants of those planes.
  - name: "Athletics"
    attribute: strength
    subtitle: "Associated Ability: Strength (STR)"
    description: |
      Your STR (Athletics) check covers difficult situations you encounter while climbing, jumping, or swimming. Examples include scaling a rain-slicked cliff, avoiding hazards on a climb, jumping unusually far, pulling off a stunt while jumping, swimming in treacherous currents, or staying afloat when a creature tries to pull you underwater.

      ###### Grappling and Shoving
      Grappling and shoving are unique ways that a PC can use the Athletics skill. See the Special Melee Attacks section in this chapter for more detail.
  - name: "Deception"
    attribute: charisma
    subtitle: "Associated Ability: Charisma (CHA)"
    description: |
      Your CHA (Deception) check determines whether you can convincingly hide the truth, verbally or through actions. Deception ranges from misleading through ambiguity to telling outright lies. Typical situations include trying to fast-talk a guard, con a merchant, cheat at gambling, or wear a convincing disguise.
  - name: "History"
    attribute: intelligence
    subtitle: "Associated Ability: Intelligence (INT)"
    description: |
      Your INT (History) check measures your ability to recall lore about matters such as legendary people, ancient kingdoms, past disputes, recent wars, and lost civilizations.
  - name: "Insight"
    attribute: wisdom
    subtitle: "Associated Ability: Wisdom (WIS)"
    description: |
      Your WIS (Insight) check decides whether you can determine the true intentions of a creature, such as when searching out a lie or predicting someone's next move. This involves gleaning clues from body language, speech habits, and changes in mannerisms.
  - name: "Intimidation"
    attribute: charisma
    subtitle: "Associated Ability: Charisma (CHA)"
    description: |
      An attempt to influence someone through threats, hostility, and physical violence requires a CHA (Intimidation) check. Examples include prying information out of a prisoner, convincing street thugs to back down, or using a broken bottle to suggest that a sneering vizier reconsider.
  - name: "Investigation"
    attribute: intelligence
    subtitle: "Associated Ability: Intelligence (INT)"
    description: |
      Looking around for clues and making deductions based on those clues involves an INT (Investigation) check. You might deduce the location of a hidden object, discern from a wound what kind of weapon dealt it, or determine the weakest point in a tunnel that could cause it to collapse. Poring through ancient scrolls for a fragment of hidden knowledge might also call for an INT (Investigation) check.
  - name: "Medicine"
    attribute: wisdom
    subtitle: "Associated Ability: Wisdom (WIS)"
    description: |
      A WIS (Medicine) check lets you try to stabilize an unconscious companion at 0 HP or diagnose an illness.

      ###### Stabilize
      Stabilizing a creature is a unique way that a PC can use the Medicine skill. When a PC is reduced to 0 HP during encounter gameplay, you can make a Medicine check to try to stabilize the fallen character so that they stop having to make death saves and risk death (see Stabilizing a Creature under Death Saves in this chapter).
  - name: "Nature"
    attribute: intelligence
    subtitle: "Associated Ability: Intelligence (INT)"
    description: |
      Your INT (Nature) check measures your ability to recall lore about matters such as terrain, plants and animals, weather, and natural cycles.
  - name: "Perception"
    attribute: wisdom
    subtitle: "Associated Ability: Wisdom (WIS)"
    description: |
      Your WIS (Perception) check lets you spot, hear, or otherwise detect the presence of something. It measures your general awareness of surroundings and keenness of senses. For example, you might try to overhear a conversation through a closed door, eavesdrop under an open window, or catch the scent of monsters skulking through the forest. You might also try to spot things that are obscured or easy to miss, such as orcs lying in ambush, thugs hiding in the shadows of an alley, or candlelight under a closed secret door.

      ###### Passive Perception
      Passive Perception is a unique way that a PC can use the Perception skill. Calculating passive Perception works the same as calculating any passive check (see Passive Checks in this chapter). Passive Perception gives you a chance to spot hidden threats, such as ambushes, even when you are not looking for them and lets you discover hazards or traps before you trigger them.
  - name: "Performance"
    attribute: charisma
    subtitle: "Associated Ability: Charisma (CHA)"
    description: |
      Your CHA (Performance) check determines how well you delight an audience with music, dance, acting, storytelling, or other forms of entertainment.
  - name: "Persuasion"
    attribute: charisma
    subtitle: "Associated Ability: Charisma (CHA)"
    description: |
      When you attempt to influence someone or a group of people with tact, social graces, or good nature, the GM might ask for a CHA (Persuasion) check. You use Persuasion when acting in good faith, to foster friendships, make cordial requests, or exhibit proper etiquette. Examples include convincing a chamberlain to let your party see the king, negotiating peace between warring tribes, or inspiring a crowd.
  - name: "Religion"
    attribute: intelligence
    subtitle: "Associated Ability: Intelligence (INT)"
    description: |
      Your INT (Religion) check measures your ability to recall lore about matters such as deities, rites and prayers, religious hierarchies, holy symbols, and secret cults.
  - name: "Sleight of Hand"
    attribute: dexterity
    subtitle: "Associated Ability: Dexterity (DEX)"
    description: |
      An act of legerdemain or manual trickery, such as planting an item on someone else or concealing an object on your person, calls for a DEX (Sleight of Hand) check. The GM might also call for a DEX (Sleight of Hand) check to determine whether you lift a coin purse off another person or slip something out of another person's pocket.
  - name: "Stealth"
    attribute: dexterity
    subtitle: "Associated Ability: Dexterity (DEX)"
    description: |
      Make a DEX (Stealth) check when you attempt to conceal yourself from enemies, slink past guards, slip away without being noticed, or sneak up on someone.

      ###### Hiding
      Hiding is a unique way that a PC can use the Stealth skill. It's tied to taking the Hide action in combat encounters (see Actions in Combat in this chapter). Any character can attempt to hide, even if they don't have proficiency in the Stealth skill.

      The GM decides when circumstances are appropriate for hiding. When you attempt to hide, make a DEX (Stealth) check. Until you are discovered or stop hiding, that check result is contested by the Perception score of a creature that might discover you.

      You can't attempt to hide from a creature that can sense you clearly, and you give away your position if you make noise, such as shouting a warning or knocking over a vase.

      A creature with the invisible condition (see Appendix A: Conditions) can always attempt to hide and has advantage on DEX (Stealth) checks to do so.

      In combat, most creatures stay alert for signs of danger, so if you come out of hiding and approach a creature, it typically detects you. However, under certain circumstances, the GM might allow you to stay hidden as you approach a distracted creature, granting you advantage on an attack roll (see Unseen Attackers and Targets under Making an Attack in this chapter).

      **Perception Score**. In a monster or NPC stat block, each creature has a Perception score. Whether a monster is actively searching for you or just going about their business, the GM compares your DEX (Stealth) check result to the creature's Perception score to see whether they notice you.
  - name: "Survival"
    attribute: wisdom
    subtitle: "Associated Ability: Wisdom (WIS)"
    description: |
      The GM might ask you to make a WIS (Survival) check to follow tracks, hunt wild game, guide your group through frozen wastelands, identify signs that owlbears live nearby, predict the weather, or avoid quicksand and other natural hazards.

      ###### Tracking
      Tracking is a unique way that a PC can use the Survival skill. It involves detecting and following signs of a creature's passage through an area. Any character can attempt to track, even if they don't have proficiency in the Survival skill.

      A PC who wants to track a creature declares their intention to do so. Then the GM determines whether tracking is possible. For example, a GM could rule it is impossible to track a creature that moved through an area weeks ago because too much time has passed.

      If a GM determines tracking is possible, they decide whether a check is necessary. For example, clear signs of passage, such as muddy footprints on a wooden floor, might mean tracking automatically succeeds.

      If a GM determines a check is necessary, the tracking PC must succeed on a WIS (Survival) check. The DC for this check is set by the GM.
```

## Visualizing Skills Data
### Entries
```rpg show
entries:
  data: skills
  properties:
    - name
    - subtitle
    - description
```

## Integration with System Definition

Reference this file in your complete system definition:

```yaml (rpg system)
name: "My Custom RPG System"

skills: "examples/skills.md"
# ... other system definitions
```

Or include it inline:

```yaml (rpg system)
name: "D&D 5th Edition"

skills:
  - label: "Acrobatics"
    attribute: dexterity
  - label: "Animal Handling"
    attribute: wisdom
```
