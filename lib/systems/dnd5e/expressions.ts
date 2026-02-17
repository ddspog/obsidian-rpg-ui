/**
 * D&D 5e Expression Evaluators
 * Contains expression logic for ability modifiers, saving throws, and skill checks
 */

import type { ExpressionDef } from "../types";

/**
 * D&D 5e ability modifier expression
 * Formula: floor((score - 10) / 2)
 */
export const modifierExpression: ExpressionDef = {
	id: "modifier",
	params: ["score"],
	formula: "{{floor (divide (subtract score 10) 2)}}",
	evaluate: (context) => {
		const score = Number(context.score) || 0;
		return Math.floor((score - 10) / 2);
	},
};

/**
 * D&D 5e saving throw expression
 * Formula: modifier + proficiency_bonus (if proficient)
 */
export const savingThrowExpression: ExpressionDef = {
	id: "saving_throw",
	params: ["score", "proficiency_bonus", "is_proficient"],
	formula: "{{add (modifier score) (if is_proficient proficiency_bonus 0)}}",
	evaluate: (context) => {
		const score = Number(context.score) || 0;
		const proficiencyBonus = Number(context.proficiency_bonus) || 0;
		const isProficient = Boolean(context.is_proficient);

		const modifier = Math.floor((score - 10) / 2);
		return modifier + (isProficient ? proficiencyBonus : 0);
	},
};

/**
 * D&D 5e skill check expression
 * Formula: modifier + proficiency_bonus (based on proficiency level)
 */
export const skillModifierExpression: ExpressionDef = {
	id: "skill_modifier",
	params: ["score", "proficiency_bonus", "proficiency_level"],
	formula: "{{add (modifier score) (multiply proficiency_bonus proficiency_level)}}",
	evaluate: (context) => {
		const score = Number(context.score) || 0;
		const proficiencyBonus = Number(context.proficiency_bonus) || 0;
		const proficiencyLevel = Number(context.proficiency_level) || 0;

		const modifier = Math.floor((score - 10) / 2);
		return modifier + proficiencyBonus * proficiencyLevel;
	},
};
