/**
 * View Registry
 * Instantiates all views and builds the dispatch registry.
 */

import { App } from "obsidian";
import { BaseView } from "lib/views/BaseView";
import { InitiativeView } from "lib/views/InitiativeView";
import { InventoryView } from "lib/views/InventoryView";
import { FeaturesView } from "lib/views/FeaturesView";
import { DraftView } from "lib/views/DraftView";
import { FeatureGMView } from "lib/views/FeatureGMView";
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

/** Plain (non-`rpg`) fence names → rpg meta key, so an old ```initiative block still renders. */
export const LEGACY_MAPPINGS: Record<string, string> = {
  initiative: "initiative",
};

/** Instantiate all views. */
export function createViews(app: App, kv: KeyValueStore): BaseView[] {
  return [
    // Dynamic/Stateful
    new InitiativeView(app, kv),
    new SessionLogView(app, kv),

    // New blocks
    new InventoryView(app),
    new FeaturesView(app),
    new FeatureGMView(app),
    new DraftView(app),
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
