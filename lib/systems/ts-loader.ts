/**
 * TypeScript System Loader
 *
 * Bundles and evaluates user-authored TypeScript system definitions using
 * esbuild-wasm. Given a folder in the Obsidian vault (e.g., `systems/dnd5e/`)
 * containing an `index.ts` entry point, this loader:
 *
 * 1. Initializes esbuild-wasm on first use
 * 2. Uses a virtual-filesystem plugin to read `.ts` files from the vault
 * 3. Bundles all imports into a single IIFE string
 * 4. Evaluates the bundle to extract the exported `system` object
 *
 * The `system` export must be the result of calling `CreateSystem({...})`.
 */

import type { Vault, TFile } from "obsidian";
import type { RPGSystem } from "./types";

// Lazy esbuild-wasm initialisation — module-level promise so init runs once.
let esbuildInitialized: Promise<void> | null = null;
let esbuildModule: typeof import("esbuild-wasm") | null = null;

/**
 * Initialize esbuild-wasm.  Safe to call multiple times — subsequent calls
 * return the cached promise.
 *
 * Prefers loading the WASM binary from a URL provided by the caller (which
 * should point to the bundled `esbuild.wasm` file in the plugin output
 * directory). Falls back to the CDN for convenience in development.
 */
export async function initEsbuild(wasmURL?: string): Promise<void> {
  if (esbuildInitialized) return esbuildInitialized;

  esbuildInitialized = (async () => {
    const esbuild = await import("esbuild-wasm");
    await esbuild.initialize({
      // Use the provided URL (production: .obsidian/plugins/obsidian-rpg-ui/esbuild.wasm)
      // or fall back to the CDN for development / first-time setup.
      wasmURL: wasmURL ?? "https://cdn.jsdelivr.net/npm/esbuild-wasm@0.27.3/esbuild.wasm",
    });
    esbuildModule = esbuild;
  })();

  return esbuildInitialized;
}

/**
 * Load and evaluate a TypeScript system from a vault folder.
 *
 * @param vault - Obsidian vault instance
 * @param systemFolderPath - Path to the folder containing `index.ts`
 * @returns The RPGSystem exported as `system` from the TypeScript file, or null on failure
 */
export async function loadSystemFromTypeScript(
  vault: Vault,
  systemFolderPath: string,
): Promise<RPGSystem | null> {
  try {
    await initEsbuild();
    if (!esbuildModule) {
      console.error("esbuild-wasm failed to initialize");
      return null;
    }

    const entryPoint = `${systemFolderPath}/index.ts`.replace(/\/\/+/g, "/");

    // Virtual filesystem plugin: intercepts all `.ts` file reads and serves
    // them from the Obsidian vault via `vault.cachedRead()`.
    const vaultPlugin: import("esbuild-wasm").Plugin = {
      name: "obsidian-vault",
      setup(build) {
        // Resolve relative imports against the system folder
        build.onResolve({ filter: /.*/ }, (args) => {
          if (args.kind === "entry-point") {
            return { path: args.path, namespace: "vault" };
          }
          // Resolve relative paths
          if (args.path.startsWith(".")) {
            const baseParts = args.importer.split("/");
            baseParts.pop(); // remove filename
            const relative = args.path.replace(/\.(ts|js)$/, "");
            const resolved = [...baseParts, relative].join("/");
            return { path: `${resolved}.ts`, namespace: "vault" };
          }
          // External modules (e.g., node built-ins) — mark as external
          return { external: true };
        });

        // Load vault files
        build.onLoad({ filter: /.*/, namespace: "vault" }, async (args) => {
          try {
            const file = vault.getAbstractFileByPath(args.path);
            if (!file) {
              return { errors: [{ text: `File not found in vault: ${args.path}` }] };
            }
            const contents = await vault.cachedRead(file as TFile);
            return { contents, loader: "ts" };
          } catch (error) {
            return {
              errors: [{ text: `Failed to read ${args.path}: ${String(error)}` }],
            };
          }
        });
      },
    };

    const result = await esbuildModule.build({
      entryPoints: [entryPoint],
      bundle: true,
      write: false,
      format: "iife",
      globalName: "__system_module",
      platform: "browser",
      target: "es2018",
      plugins: [vaultPlugin],
      // Suppress banner/footer so we get clean JS
      logLevel: "silent",
    });

    if (result.errors.length > 0) {
      console.error("TypeScript system bundle errors:", result.errors);
      return null;
    }

    const bundleText = result.outputFiles?.[0]?.text;
    if (!bundleText) {
      console.error("Empty bundle output for system:", systemFolderPath);
      return null;
    }

    return evaluateSystemBundle(bundleText, systemFolderPath);
  } catch (error) {
    console.error(`Failed to load TypeScript system from ${systemFolderPath}:`, error);
    return null;
  }
}

/**
 * Evaluate a bundled IIFE and extract the exported `system` object.
 *
 * The IIFE sets `__system_module` on a scope object.  We use `new Function()`
 * (consistent with the existing `function-expressions.ts` pattern) to evaluate
 * the bundle in a sandboxed scope and extract the `system` export.
 *
 * Exported for unit testing.
 */
export function evaluateSystemBundle(bundleText: string, systemFolderPath: string): RPGSystem | null {
  try {
    // Create a minimal global-like scope for the IIFE
    const scope: Record<string, unknown> = {};
    // The IIFE assigns to `__system_module` on `globalThis` / the outer scope.
    // We wrap execution so that `__system_module` is intercepted.
    const wrappedBundle = `
var __system_module;
${bundleText}
return __system_module;
    `;
    // eslint-disable-next-line no-new-func
    const factory = new Function(wrappedBundle);
    const mod = factory.call(scope);

    if (!mod) {
      console.error(`System bundle for ${systemFolderPath} did not export __system_module`);
      return null;
    }

    // The user exports `export const system = CreateSystem({...})`.
    // After IIFE bundling, this becomes `__system_module.system`.
    const system = (mod as Record<string, unknown>).system;
    if (!system || typeof system !== "object") {
      console.error(
        `System bundle for ${systemFolderPath} does not export a 'system' object. ` +
          `Make sure your index.ts contains: export const system = CreateSystem({...})`,
      );
      return null;
    }

    return system as RPGSystem;
  } catch (error) {
    console.error(`Failed to evaluate system bundle for ${systemFolderPath}:`, error);
    return null;
  }
}
