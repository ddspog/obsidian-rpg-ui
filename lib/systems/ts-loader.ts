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
import type * as EsbuildWasm from "esbuild-wasm";
import { resolveWikiFile, resolveWikiFolder } from "../utils/wiki-file";
import * as UIModule from "../ui";
import {
  getSystemSourceMaxMtime,
  readBundleCache,
  writeBundleCache,
} from "./bundle-cache";

/** Plugin metadata used by the bundle cache to invalidate on plugin upgrade. */
let cacheContext: { pluginDir: string; pluginVersion: string } | null = null;

/** Set by main.ts onload so the bundle cache can be addressed by plugin id. */
export function setBundleCacheContext(ctx: { pluginDir: string; pluginVersion: string }): void {
  cacheContext = ctx;
}

// Lazy esbuild-wasm initialisation — module-level promise so init runs once.
let esbuildInitialized: Promise<void> | null = null;
let esbuildModule: typeof EsbuildWasm | null = null;

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
    // In a Node.js environment (e.g. local scripts), prefer the native esbuild
    // package which doesn't require WASM initialisation.
    if (typeof process !== "undefined" && process.versions?.node) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
        const native = require("esbuild") as typeof EsbuildWasm;
        esbuildModule = native;
        return;
      } catch {
        // fall through to esbuild-wasm
      }
    }
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
export async function loadSystemFromTypeScript(vault: Vault, systemFolderPath: string): Promise<RPGSystem | null> {
  try {
    // Bundle cache fast-path: if we have a cached bundle whose meta matches
    // the current source mtime + plugin version, eval it directly without
    // touching esbuild-wasm. Saves ~0.5–2s on cold start after the first
    // bundle. Misses fall through to the normal esbuild path below, which
    // also writes the cache on success.
    if (cacheContext) {
      const sourceMaxMtime = await getSystemSourceMaxMtime(vault, systemFolderPath);
      if (sourceMaxMtime > 0) {
        const cached = await readBundleCache(
          vault,
          cacheContext.pluginDir,
          systemFolderPath,
          cacheContext.pluginVersion,
          sourceMaxMtime
        );
        if (cached) {
          const evaluated = await evaluateSystemBundle(cached, systemFolderPath, vault);
          if (evaluated) return evaluated;
          // Fall through: cache exists but eval failed — re-bundle to recover.
        }
      }
    }

    await initEsbuild();
    if (!esbuildModule) {
      console.error("esbuild-wasm failed to initialize");
      return null;
    }

    const entryPoint = `${systemFolderPath}/index.ts`.replace(/\/\/+/g, "/");

    // Virtual filesystem plugin: intercepts all `.ts` file reads and serves
    // them from the Obsidian vault via `vault.cachedRead()`.
    const vaultPlugin: EsbuildWasm.Plugin = {
      name: "obsidian-vault",
      setup(build: EsbuildWasm.PluginBuild) {
        // Resolve relative imports against the system folder
        build.onResolve({ filter: /.*/ }, (args: EsbuildWasm.OnResolveArgs) => {
          if (args.kind === "entry-point") {
            // Normalize entry-point path to remove leading './' which can
            // confuse vault lookups. Keep the full normalized path so that
            // Obsidian's Vault API can resolve files correctly.
            // Use POSIX normalization to keep paths consistent across platforms.
            // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
            const pathPosix = require("path").posix;
            const normalized = pathPosix.normalize(args.path).replace(/^\.\//, "");
            return { path: normalized, namespace: "vault" };
          }
          // Resolve relative paths robustly using posix normalization
          if (args.path.startsWith(".")) {
            // Use posix path operations to avoid Windows backslash issues
            // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
            const pathPosix = require("path").posix;
            const importerDir = pathPosix.dirname(args.importer || "");

            // Preserve known extensions (.ts, .tsx, .js, .jsx) if present; otherwise
            // default to `.ts` so plain imports like `./foo` resolve to `./foo.ts`.
            const extMatch = args.path.match(/\.(tsx|ts|jsx|js)$/);
            const hasExt = !!extMatch;
            const base = hasExt ? args.path.replace(/\.(tsx|ts|jsx|js)$/, "") : args.path;
            const joined = pathPosix.join(importerDir, base);
            const normalized = pathPosix.normalize(joined);
            // If the import included an extension, use it. Otherwise try a set of
            // common extensions and prefer the first one that exists in the vault.
            if (hasExt) {
              const finalPath = `${normalized}${extMatch![0]}`;
              return { path: finalPath, namespace: "vault" };
            }

            const candidates = [".ts", ".tsx", ".js", ".jsx"];
            for (const ext of candidates) {
              const candidate = `${normalized}${ext}`;
              try {
                // vault is available in the outer scope; check for existence
                const f = vault.getAbstractFileByPath(candidate);
                if (f) return { path: candidate, namespace: "vault" };
              } catch (e) {
                // ignore and try next
              }
            }

            // Fallback to .ts when none of the candidates exist
            return { path: `${normalized}.ts`, namespace: "vault" };
          }
          // External modules (e.g., node built-ins) — mark as external
          return { external: true };
        });

        // Load vault files
        build.onLoad({ filter: /.*/, namespace: "vault" }, async (args: EsbuildWasm.OnLoadArgs) => {
          try {
            let file = vault.getAbstractFileByPath(args.path);
            // Compatibility fallback: some test shims expect the path to be
            // relative to the provided systemFolderPath (e.g., 'index.ts')
            // whereas Obsidian's Vault expects full paths. If the direct
            // lookup fails and the args.path contains the systemFolderPath
            // prefix, try the suffix as a fallback.
            if (!file) {
              try {
                const prefix = (systemFolderPath || "").replace(/\\/g, "/");
                if (prefix && args.path.startsWith(prefix + "/")) {
                  const alt = args.path.slice(prefix.length + 1);
                  file = vault.getAbstractFileByPath(alt);
                }
              } catch (e) {
                // ignore fallback errors
              }
            }
            if (!file) {
              return { errors: [{ text: `File not found in vault: ${args.path}` }] };
            }
            const contents = await vault.cachedRead(file as TFile);
            // Choose esbuild loader based on file extension so that TSX files
            // are parsed correctly.
            const loader = args.path.endsWith(".tsx")
              ? "tsx"
              : args.path.endsWith(".ts")
                ? "ts"
                : args.path.endsWith(".jsx")
                  ? "jsx"
                  : "js";
            return { contents, loader };
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

    // Write the freshly-bundled JS to the disk cache for next reload.
    if (cacheContext) {
      const sourceMaxMtime = await getSystemSourceMaxMtime(vault, systemFolderPath);
      if (sourceMaxMtime > 0) {
        void writeBundleCache(
          vault,
          cacheContext.pluginDir,
          systemFolderPath,
          cacheContext.pluginVersion,
          sourceMaxMtime,
          bundleText
        );
      }
    }

    const evaluated = await evaluateSystemBundle(bundleText, systemFolderPath, vault);
    return evaluated;
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
export async function evaluateSystemBundle(
  bundleText: string,
  systemFolderPath: string,
  vault?: Vault
): Promise<RPGSystem | null> {
  try {
    // Create a minimal global-like scope for the IIFE
    const scope: Record<string, unknown> = {};
    // The IIFE assigns to `__system_module` on `globalThis` / the outer scope.
    // We wrap execution so that `__system_module` is intercepted.
    const wrappedBundle = `var __system_module;\n${bundleText}\nreturn __system_module;`;

    // Provide a small `require` shim to resolve known internal imports used by
    // user-authored system bundles (e.g., `rpg-ui-toolkit`). This avoids the
    // runtime `Cannot find module 'rpg-ui-toolkit'` error by mapping that
    // specifier to our local implementation.
    const requireShim = (name: string) => {
      try {
        if (name === "rpg-ui-toolkit") {
          // Expose the runtime surface expected by in-vault system bundles.
          // Merge the system factory exports with the UI/runtime helpers so
          // that imports like `import { CreateEntity, TitleAnchor } from "rpg-ui-toolkit"`
          // resolve at runtime.
          // The features module (resolver, parseSourceDocs, FeatureDetails type, …)
          // and PendingChoiceRow component are also bundled in so vault-root
          // system files can import them without crossing the vault boundary
          // via relative paths into the plugin's `lib/`.
          // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
          const core = require("./create-system");
          // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
          const valueResolverApi = require("../domains/rules/value-resolver-api");
          // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
          const imageResolverApi = require("../domains/rules/image-resolver-api");
          // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
          const ruleRender = require("../domains/rules/render-rule-block");
          // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
          const parseSourceDocMod = require("../domains/features/parse-source-doc");
          // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
          const resolverMod = require("../domains/features/resolver");
          // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
          const indexBuilderMod = require("../domains/features/index-builder");
          // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
          const pendingChoiceRow = require("../components/pending-choice-row");
          // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
          const markdown = require("../components/markdown");
          // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
          const tableParser = require("../domains/tables/parse-table-block");
          // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
          const tableExpr = require("../domains/tables/expressions");
          // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
          const spellCard = require("../blocks/spell-card");
          // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
          const spellcasting = require("../domains/features/spellcasting");
          // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
          const inventoryDomain = require("../domains/inventory");
          // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
          const inventoryComponent = require("../components/inventory/InventoryBlock");
          // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
          const itemsDomain = require("../domains/items");
          // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
          const itemElementCard = require("../components/item/ItemElementCard");
          // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
          const itemMagicCard = require("../components/item/ItemMagicCard");
          // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
          const itemPersonalCard = require("../components/item/ItemPersonalCard");
          // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
          const itemContainerCard = require("../components/item/ItemContainerCard");
          // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
          const statblockComponent = require("../components/statblock-vehicle");
          // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
          const statblockResolver = require("../domains/statblocks/resolve-features");
          // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
          const fenceSplit = require("../utils/fence-split");
          return Object.assign({}, core, UIModule, {
            parseSourceDoc: parseSourceDocMod.parseSourceDoc,
            parseSourceDocs: parseSourceDocMod.parseSourceDocs,
            resolveFeatures: resolverMod.resolveFeatures,
            buildCompendiumIndex: indexBuilderMod.buildCompendiumIndex,
            expandOptionRefs: indexBuilderMod.expandOptionRefs,
            PendingChoiceRow: pendingChoiceRow.PendingChoiceRow,
            Markdown: markdown.Markdown,
            parseTableBlock: tableParser.parseTableBlock,
            substituteExpressions: tableExpr.substituteExpressions,
            extractSpellBlocks: spellCard.extractSpellBlocks,
            SpellCard: spellCard.SpellCard,
            classifySpellCircle: spellcasting.classifySpellCircle,
            stripWikilinkToName: spellcasting.stripWikilinkToName,
            resolveInventory: inventoryDomain.resolveInventory,
            InventoryBlock: inventoryComponent.InventoryBlock,
            extractItemElementBlocks: itemsDomain.extractItemElementBlocks,
            parseItemElement: itemsDomain.parseItemElement,
            parseItemWeight: itemsDomain.parseItemWeight,
            itemKindFromType: itemsDomain.itemKindFromType,
            extractItemMagicBlocks: itemsDomain.extractItemMagicBlocks,
            parseItemMagic: itemsDomain.parseItemMagic,
            extractItemPersonalBlocks: itemsDomain.extractItemPersonalBlocks,
            parseItemPersonal: itemsDomain.parseItemPersonal,
            extractItemContainerBlocks: itemsDomain.extractItemContainerBlocks,
            parseItemContainer: itemsDomain.parseItemContainer,
            resolvePersonalItem: itemsDomain.resolvePersonalItem,
            resolveContainer: itemsDomain.resolveContainer,
            deriveWeaponRoll: itemsDomain.deriveWeaponRoll,
            deriveWeaponRolls: itemsDomain.deriveWeaponRolls,
            deriveWeaponForm: itemsDomain.deriveWeaponForm,
            parseWeaponDamage: itemsDomain.parseWeaponDamage,
            parseWeaponBonus: itemsDomain.parseWeaponBonus,
            signed: itemsDomain.signed,
            ItemElementCard: itemElementCard.ItemElementCard,
            ItemMagicCard: itemMagicCard.ItemMagicCard,
            ItemPersonalCard: itemPersonalCard.ItemPersonalCard,
            ItemContainerCard: itemContainerCard.ItemContainerCard,
            // Rule-value resolver: source-of-truth for runtime config
            // values, sourced from `rule.content` frontmatter `values:` maps.
            getRuleValue: valueResolverApi.getRuleValue,
            getRuleValuesById: valueResolverApi.getRuleValuesById,
            listRuleValues: valueResolverApi.listRuleValues,
            // Vault image resolver: turns frontmatter image paths into URLs.
            resolveVaultImage: imageResolverApi.resolveVaultImage,
            // Rule side wrapper component — view authors compose it freely.
            RuleSide: ruleRender.RuleSide,
            // Statblock components and helpers.
            StatblockVehicle: statblockComponent.StatblockVehicle,
            resolveStatFeatures: statblockResolver.resolveStatFeatures,
            // Fence utilities.
            stripRpgFences: fenceSplit.stripRpgFences,
          });
        }
        // Provide React and ReactDOM from the plugin runtime if available.
        if (name === "react") {
          // Prefer globalThis.React (set by plugin runtime), fall back to require.
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          return (globalThis as any).React ?? require("react");
        }
        if (name === "react-dom" || name === "react-dom/client") {
          return (
            (globalThis as any).ReactDOM ??
            (() => {
              try {
                return require("react-dom/client");
              } catch {
                return require("react-dom");
              }
            })()
          );
        }
        // Fallback to normal require for other modules (may throw)
        // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
        return require(name);
      } catch (e) {
        // Return an empty object for unresolved externals to avoid crashes
        return {};
      }
    };

    // Provide a wiki fixture available to system definitions via
    // `globalThis.__rpg_wiki`. Helpers are async and read from the vault
    // when available; frontmatter is parsed and merged onto the descriptor.
    const wikiFixture = {
      file: (name: string) => resolveWikiFile(vault, name),
      folder: (folderPath: string) => resolveWikiFolder(vault, folderPath),
    };

    try {
      (globalThis as any).__rpg_wiki = wikiFixture;
    } catch {}

    // eslint-disable-next-line no-new-func
    const factory = new Function("require", "React", "ReactDOM", wrappedBundle);
    const reactRuntime =
      (globalThis as any).React ??
      (() => {
        try {
          return require("react");
        } catch {
          return undefined;
        }
      })();
    const reactDomRuntime =
      (globalThis as any).ReactDOM ??
      (() => {
        try {
          return require("react-dom/client");
        } catch {
          try {
            return require("react-dom");
          } catch {
            return undefined;
          }
        }
      })();
    const mod = factory.call(scope, requireShim as any, reactRuntime, reactDomRuntime);

    // Clean up the wiki fixture after evaluation
    try {
      delete (globalThis as any).__rpg_wiki;
    } catch {}

    if (!mod) {
      console.error(`System bundle for ${systemFolderPath} did not export __system_module`);
      return null;
    }
    // The user exports `export const system = CreateSystem({...})`.
    // After IIFE bundling, this becomes `__system_module.system`.
    let system = (mod as Record<string, unknown>).system as unknown;
    // If CreateSystem returned a Promise (async factory), await it.
    if (system && typeof (system as any).then === "function") {
      try {
        system = await (system as Promise<unknown>);
      } catch (e) {
        console.error(`System factory promise rejected for ${systemFolderPath}:`, e);
        return null;
      }
    }

    if (!system || typeof system !== "object") {
      console.error(
        `System bundle for ${systemFolderPath} does not export a 'system' object. ` +
          `Make sure your index.ts contains: export const system = CreateSystem({...})`
      );
      return null;
    }

    // Optional second export: per-system rule view registry.
    // The user writes either:
    //   export { ruleViews } from "./rule-views";
    //   // or
    //   export const ruleViews: RuleViewMap = { ... };
    // and the call processor picks them up via system.ruleViews.
    const ruleViews = (mod as Record<string, unknown>).ruleViews;
    if (ruleViews && typeof ruleViews === "object") {
      (system as RPGSystem).ruleViews = ruleViews as RPGSystem["ruleViews"];
    }

    return system as RPGSystem;
  } catch (error) {
    console.error(`Failed to evaluate system bundle for ${systemFolderPath}:`, error);
    return null;
  }
}
