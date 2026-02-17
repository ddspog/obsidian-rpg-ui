/**
 * D&D 5e Spell Circles
 * Spell levels/circles from cantrips through 9th level spells
 */

import type { SpellCircleDefinition } from "../../types";

export default [
	{ id: "cantrip", label: "Cantrip", icon: "✨" },
	{ id: "1", label: "1st Level", icon: "1️⃣" },
	{ id: "2", label: "2nd Level", icon: "2️⃣" },
	{ id: "3", label: "3rd Level", icon: "3️⃣" },
	{ id: "4", label: "4th Level", icon: "4️⃣" },
	{ id: "5", label: "5th Level", icon: "5️⃣" },
	{ id: "6", label: "6th Level", icon: "6️⃣" },
	{ id: "7", label: "7th Level", icon: "7️⃣" },
	{ id: "8", label: "8th Level", icon: "8️⃣" },
	{ id: "9", label: "9th Level", icon: "9️⃣" },
] as SpellCircleDefinition[];
