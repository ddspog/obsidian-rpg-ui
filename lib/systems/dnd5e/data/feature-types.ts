/**
 * D&D 5e Feature Types
 * Categories for organizing features (actions, bonus actions, reactions, etc.)
 */

import type { FeatureTypeDefinition } from "../../types";

export default [
  { id: "action", label: "Action", icon: "⚔️" },
  { id: "bonus_action", label: "Bonus Action", icon: "⚡" },
  { id: "reaction", label: "Reaction", icon: "🛡️" },
  { id: "passive", label: "Passive", icon: "👁️" },
  { id: "active", label: "Active", icon: "✨" },
] as FeatureTypeDefinition[];
