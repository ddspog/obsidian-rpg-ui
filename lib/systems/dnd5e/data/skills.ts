/**
 * D&D 5e Skills
 * 18 standard D&D 5e skills, each associated with an ability
 */

import type { SkillDefinition } from "../../types";

export default [
	{
		name: "Acrobatics",
		attribute: "dexterity",
		subtitle: "Associated Ability: DEX",
		description: "Your DEX (Acrobatics) check covers your attempt to stay on your feet in a tricky situation, such as running across a sheet of ice, balancing on a tightrope, or staying upright on a rocking ship's deck. The GM might also call for a DEX (Acrobatics) check to see if you can perform acrobatic stunts, including dives, rolls, somersaults, and flips.\n\n###### Avoid or Escape a Grapple\nEscaping a grapple is a unique way that a PC can use the Acrobatics skill. When a creature attempts to grapple you in combat, you can use the Acrobatics skill to attempt to avoid or escape it.",
	},
	{
		name: "Animal Handling",
		attribute: "wisdom",
		subtitle: "Associated Ability: WIS",
		description: "When you want to calm a domesticated animal, keep a mount from getting spooked, or intuit an animal's intentions, the GM might call for a WIS (Animal Handling) check. You also make a WIS (Animal Handling) check to control your mount when you try something risky.",
	},
	{
		name: "Arcana",
		attribute: "intelligence",
		subtitle: "Associated Ability: INT",
		description: "Your INT (Arcana) check measures your ability to recall lore about matters such as spells, magic items, eldritch symbols, magical traditions, the planes of existence, and inhabitants of those planes.",
	},
	{
		name: "Athletics",
		attribute: "strength",
		subtitle: "Associated Ability: STR",
		description: "Your STR (Athletics) check covers difficult situations you encounter while climbing, jumping, or swimming. Examples include scaling a rain-slicked cliff, avoiding hazards on a climb, jumping unusually far, pulling off a stunt while jumping, swimming in treacherous currents, or staying afloat when a creature tries to pull you underwater.\n\n###### Grappling and Shoving\nGrappling and shoving are unique ways that a PC can use the Athletics skill.",
	},
	{
		name: "Deception",
		attribute: "charisma",
		subtitle: "Associated Ability: CHA",
		description: "Your CHA (Deception) check determines whether you can convincingly hide the truth, verbally or through actions. Deception ranges from misleading through ambiguity to telling outright lies. Typical situations include trying to fast-talk a guard, con a merchant, cheat at gambling, or wear a convincing disguise.",
	},
	{
		name: "History",
		attribute: "intelligence",
		subtitle: "Associated Ability: INT",
		description: "Your INT (History) check measures your ability to recall lore about matters such as legendary people, ancient kingdoms, past disputes, recent wars, and lost civilizations.",
	},
	{
		name: "Insight",
		attribute: "wisdom",
		subtitle: "Associated Ability: WIS",
		description: "Your WIS (Insight) check decides whether you can determine the true intentions of a creature, such as when searching out a lie or predicting someone's next move. This involves gleaning clues from body language, speech habits, and changes in mannerisms.",
	},
	{
		name: "Intimidation",
		attribute: "charisma",
		subtitle: "Associated Ability: CHA",
		description: "An attempt to influence someone through threats, hostility, and physical violence requires a CHA (Intimidation) check. Examples include prying information out of a prisoner, convincing street thugs to back down, or using a broken bottle to suggest that a sneering vizier reconsider.",
	},
	{
		name: "Investigation",
		attribute: "intelligence",
		subtitle: "Associated Ability: INT",
		description: "Looking around for clues and making deductions based on those clues involves an INT (Investigation) check. You might deduce the location of a hidden object, discern from a wound what kind of weapon dealt it, or determine the weakest point in a tunnel that could cause it to collapse.",
	},
	{
		name: "Medicine",
		attribute: "wisdom",
		subtitle: "Associated Ability: WIS",
		description: "A WIS (Medicine) check lets you try to stabilize an unconscious companion at 0 HP or diagnose an illness.\n\n###### Stabilize\nStabilizing a creature is a unique way that a PC can use the Medicine skill. When a PC is reduced to 0 HP during encounter gameplay, you can make a Medicine check to try to stabilize the fallen character.",
	},
	{
		name: "Nature",
		attribute: "intelligence",
		subtitle: "Associated Ability: INT",
		description: "Your INT (Nature) check measures your ability to recall lore about matters such as terrain, plants and animals, weather, and natural cycles.",
	},
	{
		name: "Perception",
		attribute: "wisdom",
		subtitle: "Associated Ability: WIS",
		description: "Your WIS (Perception) check lets you spot, hear, or otherwise detect the presence of something. It measures your general awareness of surroundings and keenness of senses. For example, you might try to overhear a conversation through a closed door, eavesdrop under an open window, or catch the scent of monsters skulking through the forest.",
	},
	{
		name: "Performance",
		attribute: "charisma",
		subtitle: "Associated Ability: CHA",
		description: "Your CHA (Performance) check determines how well you delight an audience with music, dance, acting, storytelling, or other forms of entertainment.",
	},
	{
		name: "Persuasion",
		attribute: "charisma",
		subtitle: "Associated Ability: CHA",
		description: "When you attempt to influence someone or a group of people with tact, social graces, or good nature, the GM might ask for a CHA (Persuasion) check. You use Persuasion when acting in good faith, to foster friendships, make cordial requests, or exhibit proper etiquette.",
	},
	{
		name: "Religion",
		attribute: "intelligence",
		subtitle: "Associated Ability: INT",
		description: "Your INT (Religion) check measures your ability to recall lore about matters such as deities, rites and prayers, religious hierarchies, holy symbols, and secret cults.",
	},
	{
		name: "Sleight of Hand",
		attribute: "dexterity",
		subtitle: "Associated Ability: DEX",
		description: "An act of legerdemain or manual trickery, such as planting an item on someone else or concealing an object on your person, calls for a DEX (Sleight of Hand) check. The GM might also call for a DEX (Sleight of Hand) check to determine whether you lift a coin purse off another person.",
	},
	{
		name: "Stealth",
		attribute: "dexterity",
		subtitle: "Associated Ability: DEX",
		description: "Make a DEX (Stealth) check when you attempt to conceal yourself from enemies, slink past guards, slip away without being noticed, or sneak up on someone.\n\n###### Hiding\nHiding is a unique way that a PC can use the Stealth skill. It's tied to taking the Hide action in combat encounters.",
	},
	{
		name: "Survival",
		attribute: "wisdom",
		subtitle: "Associated Ability: WIS",
		description: "The GM might ask you to make a WIS (Survival) check to follow tracks, hunt wild game, guide your group through frozen wastelands, identify signs that owlbears live nearby, predict the weather, or avoid quicksand and other natural hazards.\n\n###### Tracking\nTracking is a unique way that a PC can use the Survival skill.",
	},
] as SkillDefinition[];
