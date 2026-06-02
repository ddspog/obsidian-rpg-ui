/**
 * RPG UI Toolkit — lib/ui
 *
 * Placeholder React components for upcoming `rpg` code block types.
 * These are the building blocks for the new multi-system RPG UI.
 */

export { Health } from "./blocks/Health";
export type { HealthProps } from "./blocks/Health";

export { Features } from "./features/Features";
export type { FeaturesProps } from "./features/Features";

export { Spells, getSlotsForLevel } from "./spells/Spells";
export type { SpellsProps, SpellEntry } from "./spells/Spells";

export { Statblock } from "./statblock/Statblock";
export type { StatblockProps } from "./statblock/Statblock";

// ─── Entity Block Components ──────────────────────────────────────────────────

export { CharacterHeaderBlock } from "./blocks/CharacterHeaderBlock";
export { HealthBlock } from "./blocks/HealthBlock";
export { FeaturesCollectorBlock } from "./features/FeaturesCollectorBlock";
export { SpellsCollectorBlock } from "./spells/SpellsCollectorBlock";
export { ClassFeaturesBlock } from "./features/ClassFeaturesBlock";
export { SpellInfoBlock } from "./spells/SpellInfoBlock";
export { SpellEffectsBlock } from "./spells/SpellEffectsBlock";
export { FeatureEntryBlock } from "./features/FeatureEntryBlock";
export { FeatureAspectsBlock } from "./features/FeatureAspectsBlock";
export { StatblockHeaderBlock } from "./statblock/StatblockHeaderBlock";
export { StatblockTraitsBlock } from "./statblock/StatblockTraitsBlock";
export { StatblockAttributesBlock } from "./statblock/StatblockAttributesBlock";
export { StatblockFeaturesBlock } from "./statblock/StatblockFeaturesBlock";
export { Title } from "./primitives/Title";
export { Pill } from "./primitives/Pill";
export { Progress } from "./Progress/Progress";
export type { ProgressBarProps } from "./Progress/ProgressBar";
export type { ProgressHealthProps } from "./Progress/ProgressHealth";
export { TriggerButton } from "./primitives/TriggerButton";
export type { TriggerButtonProps } from "./primitives/TriggerButton";
export { Button } from "./primitives/TriggerButton";
export { Level } from "./Level/Level";
export type { InspirationalLevelProps } from "./Level/InspirationalLevel";
export { Header } from "./Header/Header";
export type { HeaderType } from "./Header/Header";
export { BannerHeader } from "./Header/BannerHeader";
export type { BannerHeaderProps } from "./Header/BannerHeader";
export { Line } from "./Line/Line";
export type { LineType } from "./Line/Line";
export { Pills } from "./Line/Line";
export type { LinePillsProps } from "./Line/Line";
export { BigElements } from "./Line/Line";
export type { LineBigElementsProps } from "./Line/Line";
export { Buttons } from "./Line/Line";
export type { LineButtonsProps } from "./Line/Line";
export { Control } from "./Line/Line";
export type { LineControlProps } from "./Line/Line";
export { Stats } from "./Line/Line";
export type { LineStatsProps } from "./Line/Line";
export { Lucide } from "./primitives/Lucide";

import { Stat as _Stat } from "./Stat/Stat";
import { StatDiamond } from "./Stat/StatDiamond";
export const Stat = Object.assign(_Stat, { Diamond: StatDiamond });
export type { StatProps } from "./Stat/Stat";
export type { StatDiamondProps } from "./Stat/StatDiamond";
export { StatUL } from "./Stat/StatUL";
export type { StatULProps } from "./Stat/StatUL";
export { SkillLI } from "./Stat/SkillLI";
export type { SkillLIProps } from "./Stat/SkillLI";

export { Section } from "./Section/Section";
export type { SectionType } from "./Section/Section";
export { Badge } from "./Badge/Badge";
export type { BadgeType } from "./Badge/Badge";
export { BadgeShield } from "./Badge/BadgeShield";
export type { BadgeShieldProps } from "./Badge/BadgeShield";
export { DeathSaveDots } from "./character/DeathSaveDots";
export type { DeathSaveDotsProps } from "./character/DeathSaveDots";
export { DiceTray } from "./dice/DiceTray";
export type { DiceTrayProps } from "./dice/DiceTray";
export { DiceRollModal } from "./dice/DiceRollModal";
export type { DiceRollModalProps } from "./dice/DiceRollModal";
export { PortraitThumb } from "./character/PortraitThumb";
export type { PortraitThumbProps } from "./character/PortraitThumb";
export { ExhaustionBar } from "./Progress/ExhaustionBar";
export type { ExhaustionBarProps } from "./Progress/ExhaustionBar";
export { ProgressNumbered } from "./Progress/ProgressNumbered";
export type { ProgressNumberedProps } from "./Progress/ProgressNumbered";
export { ConditionPill } from "./character/ConditionPill";
export type { ConditionPillProps } from "./character/ConditionPill";
export { StatusPanel } from "./Panel/StatusPanel";
export type { StatusPanelProps } from "./Panel/StatusPanel";
export { Panel } from "./Panel/Panel";
export type { PanelType } from "./Panel/Panel";
export { Article } from "./Article/Article";
export type { ArticleType } from "./Article/Article";
export { ArticleColumn } from "./Article/ArticleColumn";
export type { ArticleColumnProps } from "./Article/ArticleColumn";
export { HGroup } from "./HGroup/HGroup";
export type { HGroupType } from "./HGroup/HGroup";
export { HGroupRow } from "./HGroup/HGroupRow";
export type { HGroupRowProps } from "./HGroup/HGroupRow";
export { Figure } from "./Figure/Figure";
export type { FigureType } from "./Figure/Figure";
export { FigureColumn } from "./Figure/FigureColumn";
export type { FigureColumnProps } from "./Figure/FigureColumn";
export { Fieldset } from "./Fieldset/Fieldset";
export type { FieldsetType } from "./Fieldset/Fieldset";
export { FieldsetHealth } from "./Fieldset/FieldsetHealth";
export type { FieldsetHealthProps } from "./Fieldset/FieldsetHealth";
