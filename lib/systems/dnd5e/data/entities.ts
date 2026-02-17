/**
 * D&D 5e Entity Types
 * Definitions for character, class, subclass, race, and monster entities
 */

import type { EntityTypeDef } from "../../types";

export default {
	character: {
		frontmatter: [
			{ name: "proficiency_bonus", type: "number", default: 2 },
			{ name: "level", type: "number", default: 1 },
		],
		features: [
			{
				name: "Dash",
				type: "action",
				description:
					"Double your speed for the current turn.",
			},
			{
				name: "Disengage",
				type: "action",
				description:
					"Your movement doesn't provoke opportunity attacks for the rest of the turn.",
			},
			{
				name: "Dodge",
				type: "action",
				description:
					"Attack rolls against you have disadvantage until your next turn.",
			},
			{
				name: "Help",
				type: "action",
				description:
					"Give an ally advantage on their next ability check or attack roll.",
			},
			{
				name: "Hide",
				type: "action",
				description: "Make a Dexterity (Stealth) check to hide.",
			},
			{
				name: "Ready",
				type: "action",
				description:
					"Prepare an action to trigger in response to a specified circumstance.",
			},
			{
				name: "Search",
				type: "action",
				description:
					"Make a Wisdom (Perception) or Intelligence (Investigation) check to find something.",
			},
			{
				name: "Use an Object",
				type: "action",
				description: "Interact with an object or the environment.",
			},
			{
				name: "Opportunity Attack",
				type: "reaction",
				description:
					"Make a melee attack against a creature that leaves your reach.",
			},
		],
	} as EntityTypeDef,
	class: {
		frontmatter: [{ name: "hit_die", type: "string", default: "d8" }],
	} as EntityTypeDef,
	subclass: {
		frontmatter: [
			{ name: "parent_class", type: "string", default: "" },
		],
	} as EntityTypeDef,
	race: {
		frontmatter: [
			{ name: "size", type: "string", default: "medium" },
			{ name: "speed", type: "number", default: 30 },
		],
	} as EntityTypeDef,
	monster: {
		frontmatter: [{ name: "cr", type: "number", default: 0 }],
		features: [
			{
				name: "Opportunity Attack",
				type: "reaction",
				description:
					"Make a melee attack against a creature that leaves your reach.",
			},
		],
	} as EntityTypeDef,
} as Record<string, EntityTypeDef>;
