/**
 * Storybook runtime shim for `rpg-ui-toolkit`
 *
 * Provides the same exports as api.d.ts (the vault-facing type surface) but
 * backed by real runtime implementations. Aliased in .storybook/main.ts so
 * vault system files (index.ts, block .tsx) resolve their imports correctly
 * when running in Storybook.
 */

export { CreateSystem, CreateEntity } from "./create-system";
export * from "../ui";
