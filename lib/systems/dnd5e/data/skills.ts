/**
 * D&D 5e Skills
 * 18 standard D&D 5e skills, each associated with an ability
 */

import type { SkillDefinition } from "../../types";

export default [
	{ label: "Acrobatics", attribute: "dexterity" },
	{ label: "Animal Handling", attribute: "wisdom" },
	{ label: "Arcana", attribute: "intelligence" },
	{ label: "Athletics", attribute: "strength" },
	{ label: "Deception", attribute: "charisma" },
	{ label: "History", attribute: "intelligence" },
	{ label: "Insight", attribute: "wisdom" },
	{ label: "Intimidation", attribute: "charisma" },
	{ label: "Investigation", attribute: "intelligence" },
	{ label: "Medicine", attribute: "wisdom" },
	{ label: "Nature", attribute: "intelligence" },
	{ label: "Perception", attribute: "wisdom" },
	{ label: "Performance", attribute: "charisma" },
	{ label: "Persuasion", attribute: "charisma" },
	{ label: "Religion", attribute: "intelligence" },
	{ label: "Sleight of Hand", attribute: "dexterity" },
	{ label: "Stealth", attribute: "dexterity" },
	{ label: "Survival", attribute: "wisdom" },
] as SkillDefinition[];
