/**
 * D&D 5e Conditions
 *
 * Standard conditions from the D&D 5e SRD.
 */

import type { ConditionDefinition } from "../../types";

const conditions: ConditionDefinition[] = [
  {
    $name: "Blinded",
    icon: "🙈",
    $contents:
      "A blinded creature can't see and automatically fails any ability check that requires sight. Attack rolls against the creature have advantage, and the creature's attack rolls have disadvantage.",
  },
  {
    $name: "Charmed",
    icon: "💖",
    $contents:
      "A charmed creature can't attack the charmer or target the charmer with harmful abilities or magical effects. The charmer has advantage on any ability check to interact socially with the creature.",
  },
  {
    $name: "Deafened",
    icon: "🔇",
    $contents:
      "A deafened creature can't hear and automatically fails any ability check that requires hearing.",
  },
  {
    $name: "Frightened",
    icon: "😨",
    $contents:
      "A frightened creature has disadvantage on ability checks and attack rolls while the source of its fear is within line of sight. The creature can't willingly move closer to the source of its fear.",
  },
  {
    $name: "Grappled",
    icon: "🤼",
    $contents:
      "A grappled creature's speed becomes 0, and it can't benefit from any bonus to its speed. The condition ends if the grappler is incapacitated or if an effect removes the grappled creature from the grappler's reach.",
  },
  {
    $name: "Incapacitated",
    icon: "💫",
    $contents: "An incapacitated creature can't take actions or reactions.",
  },
  {
    $name: "Invisible",
    icon: "👻",
    $contents:
      "An invisible creature is impossible to see without the aid of magic or a special sense. The creature's attack rolls have advantage, and attack rolls against the creature have disadvantage.",
  },
  {
    $name: "Paralyzed",
    icon: "⚡",
    $contents:
      "A paralyzed creature is incapacitated and can't move or speak. The creature automatically fails Strength and Dexterity saving throws. Attack rolls against the creature have advantage, and any attack that hits is a critical hit if the attacker is within 5 feet.",
  },
  {
    $name: "Petrified",
    icon: "🪨",
    $contents:
      "A petrified creature is transformed, along with any nonmagical objects it is wearing or carrying, into a solid inanimate substance. The creature is incapacitated, can't move or speak, and is unaware of its surroundings.",
  },
  {
    $name: "Poisoned",
    icon: "🤢",
    $contents:
      "A poisoned creature has disadvantage on attack rolls and ability checks.",
  },
  {
    $name: "Prone",
    icon: "🛌",
    $contents:
      "A prone creature's only movement option is to crawl. The creature has disadvantage on attack rolls. An attack roll against the creature has advantage if the attacker is within 5 feet; otherwise, the attack roll has disadvantage.",
  },
  {
    $name: "Restrained",
    icon: "⛓️",
    $contents:
      "A restrained creature's speed becomes 0. Attack rolls against the creature have advantage, and the creature's attack rolls have disadvantage. The creature has disadvantage on Dexterity saving throws.",
  },
  {
    $name: "Stunned",
    icon: "😵",
    $contents:
      "A stunned creature is incapacitated, can't move, and can speak only falteringly. The creature automatically fails Strength and Dexterity saving throws. Attack rolls against the creature have advantage.",
  },
  {
    $name: "Unconscious",
    icon: "😴",
    $contents:
      "An unconscious creature is incapacitated, can't move or speak, and is unaware of its surroundings. The creature drops whatever it's holding and falls prone. Attack rolls against the creature have advantage, and any attack that hits is a critical hit if the attacker is within 5 feet.",
  },
  {
    $name: "Exhaustion",
    icon: "😓",
    $contents:
      "Exhaustion is measured in six levels. An effect can give a creature one or more levels of exhaustion. If an already exhausted creature suffers another effect that causes exhaustion, its current level increases by the amount specified.",
  },
];

export default conditions;
