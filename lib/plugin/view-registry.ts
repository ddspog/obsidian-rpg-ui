/**
 * View Registry
 * Instantiates all views and builds the dispatch registry.
 */

import { App } from "obsidian";
import { AbilityScoreView } from "lib/views/AbilityScoreView";
import { BaseView } from "lib/views/BaseView";
import { SkillsView } from "lib/views/SkillsView";
import { HealthView } from "lib/views/HealthView";
import { ConsumableView } from "lib/views/ConsumableView";
import { BadgesView, StatsView } from "lib/views/BadgesView";
import { InitiativeView } from "lib/views/InitiativeView";
import { SpellComponentsView } from "lib/views/SpellComponentsView";
import { EventButtonsView } from "lib/views/EventButtonsView";
import { InventoryView } from "lib/views/InventoryView";
import { FeaturesView } from "lib/views/FeaturesView";
import { SessionLogView } from "lib/views/SessionLogView";
import { ShowView } from "lib/views/ShowView";
import {
  SystemView,
  SystemAttributesView,
  SystemSkillsView,
  SystemExpressionsView,
  SystemConditionsView,
} from "lib/views/SystemViews";
import { KeyValueStore } from "lib/services/kv/kv";

/** Legacy block type → rpg meta key mappings for backward compatibility. */
export const LEGACY_MAPPINGS: Record<string, string> = {
  ability: "attributes",
  skills: "skills",
  healthpoints: "healthpoints",
  stats: "stats",
  badges: "badges",
  consumable: "consumable",
  initiative: "initiative",
  "spell-components": "spell",
  "event-btns": "events",
};

/** Instantiate all views. */
export function createViews(app: App, kv: KeyValueStore): BaseView[] {
  return [
    // Static
    new StatsView(app),
    new AbilityScoreView(app),
    new SkillsView(app),
    new BadgesView(app),
    new SpellComponentsView(app),
    new EventButtonsView(app),

    // Dynamic/Stateful
    new HealthView(app, kv),
    new ConsumableView(app, kv),
    new InitiativeView(app, kv),
    new SessionLogView(app, kv),

    // New blocks
    new InventoryView(app),
    new FeaturesView(app),
    new ShowView(app),

    // System definition blocks (read-only display)
    new SystemView(app),
    new SystemAttributesView(app),
    new SystemSkillsView(app),
    new SystemExpressionsView(app),
    new SystemConditionsView(app),
  ];
}

/** Build a meta → view dispatch map. */
export function createViewRegistry(views: BaseView[]): Map<string, BaseView> {
  const registry = new Map<string, BaseView>();
  for (const view of views) {
    registry.set(view.codeblock, view);
  }
  return registry;
}
