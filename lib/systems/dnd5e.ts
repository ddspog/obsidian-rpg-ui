/**
 * Built-in D&D 5e system
 *
 * Data-driven system using modular components:
 * - Data files in lib/systems/dnd5e/data/ for system definition
 * - Expressions in lib/systems/dnd5e/expressions.ts for calculation logic
 * - Loader in lib/systems/dnd5e/loader.ts for system assembly
 */

import { buildDND5ESystem } from "./dnd5e/loader";

/**
 * Built-in D&D 5e system
 */
export const DND5E_SYSTEM = buildDND5ESystem();

