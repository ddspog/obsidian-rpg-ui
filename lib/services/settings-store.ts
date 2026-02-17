import type { DndUIToolkitSettings } from "settings";

class SettingsStore {
  private static instance: SettingsStore | null = null;
  private settings: DndUIToolkitSettings | null = null;

  static getInstance(): SettingsStore {
    if (!SettingsStore.instance) {
      SettingsStore.instance = new SettingsStore();
    }
    return SettingsStore.instance;
  }

  setSettings(settings: DndUIToolkitSettings): void {
    this.settings = settings;
  }

  getSettings(): DndUIToolkitSettings | null {
    return this.settings;
  }
}

export const settingsStore = SettingsStore.getInstance();
