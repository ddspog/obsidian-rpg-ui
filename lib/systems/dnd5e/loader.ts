/**
 * D&D 5e System Loader
 * Assembles D&D 5e system from data modules and expression evaluators
 */

import type { RPGSystem, EntityTypeDef, SkillDefinition } from "../types";
import {
	modifierExpression,
	savingThrowExpression,
	skillModifierExpression,
} from "./expressions";

// Import data modules
import * as attributes from "./data/attributes";
import * as skills from "./data/skills";
import * as featureTypes from "./data/feature-types";
import * as spellCircles from "./data/spell-circles";
import * as spellLists from "./data/spell-lists";
import * as entities from "./data/entities";

/**
 * Build the D&D 5e system from data files and logic
 */
export function buildDND5ESystem(): RPGSystem {
	return {
		name: "D&D 5e",
		attributes: attributes.default,
		entities: entities.default,
		skills: skills.default as SkillDefinition[],
		expressions: new Map([
			["modifier", modifierExpression],
			["saving_throw", savingThrowExpression],
			["skill_modifier", skillModifierExpression],
		]),
		features: {
			categories: featureTypes.default,
			providers: ["class", "race"],
			collectors: ["character", "monster"],
		},
		spellcasting: {
			circles: spellCircles.default,
			lists: spellLists.default,
			providers: ["class", "subclass"],
			collectors: ["character", "monster"],
		},
	};
}
