/**
 * Public surface of the inventory domain.
 *
 * Re-exports the new schema / resolver / routing / encumbrance helpers and
 * keeps the legacy `InventoryBlock` + parser under `legacy` so the old
 * read-only YAML shape still renders via the fallback renderer.
 */

export * as legacy from "./legacy";
export * from "./schema";
export * from "./item-frontmatter";
export * from "./routing";
export * from "./encumbrance";
export * from "./resolver";
