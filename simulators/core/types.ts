import type { App } from "obsidian";
import type { KeyValueStore } from "lib/services/kv/kv";
import type { MemoryVault } from "./fake-app";

/** A small, namespaced key-value store in the browser (a no-op where storage is blocked). */
export interface Store {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

/** What a simulator is handed when its page starts. */
export interface SimulatorContext {
  /** The manifest's `id`, `title` and `about`. */
  id: string;
  title: string;
  about: string;
  /** The page's `<body>`: a simulator builds its UI here (usually through `mountShell`). */
  root: HTMLElement;
  /** A stand-in for Obsidian's `App`, backed by the vault copy. */
  app: App;
  vault: MemoryVault;
  /** The vault copy's notes by path, as the build included them. */
  notes: Record<string, string>;
  /** The plugin's state store, in memory. */
  kv: KeyValueStore;
  /** This simulator's saved settings (what was last in the editor, say). */
  store: Store;
  toast(message: string): void;
  /** Copies text to the clipboard, or selects it for copying where that is blocked. */
  copy(text: string): Promise<void>;
}

export interface Simulator {
  start(ctx: SimulatorContext): void | Promise<void>;
}

/** The one thing a simulator's `index.ts` exports as default. */
export function defineSimulator(sim: Simulator): Simulator {
  return sim;
}

/** Lonelog, a table block, a card: a ready-made input to try. */
export interface Sample {
  title: string;
  about: string;
  text: string;
}

/** What the build writes into the page beside the code. */
export interface Manifest {
  id: string;
  title: string;
  about: string;
}
