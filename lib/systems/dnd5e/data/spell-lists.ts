/**
 * D&D 5e Spell Lists
 * Spell sources by spellcasting class
 */

import type { SpellListDefinition } from "../../types";

export default [
	{ id: "artificer", label: "Artificer Spells", icon: "🔧" },
	{ id: "bard", label: "Bard Spells", icon: "🎵" },
	{ id: "cleric", label: "Cleric Spells", icon: "✝️" },
	{ id: "druid", label: "Druid Spells", icon: "🌿" },
	{ id: "paladin", label: "Paladin Spells", icon: "⚔️" },
	{ id: "ranger", label: "Ranger Spells", icon: "🏹" },
	{ id: "sorcerer", label: "Sorcerer Spells", icon: "🔮" },
	{ id: "warlock", label: "Warlock Spells", icon: "👁️" },
	{ id: "wizard", label: "Wizard Spells", icon: "📚" },
] as SpellListDefinition[];
