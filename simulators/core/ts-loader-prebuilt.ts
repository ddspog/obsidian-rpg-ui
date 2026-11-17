/**
 * The system loader for a page that carries its systems already bundled (the build does what
 * esbuild-wasm does in Obsidian): a system is read from the page and evaluated by the plugin's own
 * evaluator, so character sheets and their cards work.
 */
import type { Vault } from "obsidian";
// The build sends every other import of the loader here, and lets this one through.
import { evaluateSystemBundle as evaluate } from "../../lib/systems/ts-loader";
import type { RPGSystem } from "lib/systems/types";

let bundles: Record<string, string> | null = null;
function bundleOf(folder: string): string | undefined {
  bundles ??= JSON.parse(document.getElementById("system-bundles")?.textContent ?? "{}") as Record<string, string>;
  return bundles[folder.replace(/\/+$/, "")];
}

export function setBundleCacheContext(): void {}
export async function initEsbuild(): Promise<void> {}
export async function loadSystemFromTypeScript(vault: Vault, systemFolderPath: string): Promise<RPGSystem | null> {
  const text = bundleOf(systemFolderPath);
  return text ? evaluate(text, systemFolderPath, vault) : null;
}
export const evaluateSystemBundle = evaluate;

/** The folders this page carries a system for (`tales-of-the-valiant/config`). */
export function systemFolders(): string[] {
  bundleOf("");
  return Object.keys(bundles ?? {});
}
