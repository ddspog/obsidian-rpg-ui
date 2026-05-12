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
export { parseSourceDoc, parseSourceDocs } from "../domains/features/parse-source-doc";
export { resolveFeatures, normalizeTraitValue, stripWikilink } from "../domains/features/resolver";
export { buildCompendiumIndex, expandOptionRefs } from "../domains/features/index-builder";
export { PendingChoiceRow } from "../components/pending-choice-row";
export { Markdown } from "../components/markdown";
export { parseTableBlock } from "../domains/tables/parse-table-block";
export { substituteExpressions } from "../domains/tables/expressions";
export { extractSpellBlocks } from "../blocks/spell-card";
export { classifySpellCircle, stripWikilinkToName } from "../domains/features/spellcasting";
export { resolveInventory } from "../domains/inventory";
export { InventoryBlock } from "../components/inventory/InventoryBlock";
export {
  extractItemElementBlocks,
  parseItemElement,
  parseItemWeight,
  itemKindFromType,
  extractItemMagicBlocks,
  parseItemMagic,
  extractItemPersonalBlocks,
  parseItemPersonal,
  extractItemContainerBlocks,
  parseItemContainer,
  resolvePersonalItem,
  resolveContainer,
  deriveWeaponRoll,
  deriveWeaponRolls,
  deriveWeaponForm,
  parseWeaponDamage,
  parseWeaponBonus,
  signed,
} from "../domains/items";
export { ItemElementCard } from "../components/item/ItemElementCard";
export { ItemMagicCard } from "../components/item/ItemMagicCard";
export { ItemPersonalCard } from "../components/item/ItemPersonalCard";
export { ItemContainerCard } from "../components/item/ItemContainerCard";
