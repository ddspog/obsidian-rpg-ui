// This file has been automatically migrated to valid ESM format by Storybook.
import type { StorybookConfig } from "@storybook/react-vite";
import { mergeConfig } from "vite";
import path, { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
  stories: ["../stories/**/*.stories.@(ts|tsx)"],
  addons: [
    "@storybook/addon-docs",
    "@storybook/addon-a11y",
    "@whitespace/storybook-addon-html",
    "@storybook/addon-mcp",
  ],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  viteFinal: async (viteConfig) => {
    const merged = mergeConfig(viteConfig, {
      resolve: {
        alias: {
          "rpg-ui-toolkit": path.resolve(__dirname, "../lib/systems/storybook-shim.ts"),
          obsidian: path.resolve(__dirname, "../scripts/obsidian-shim.js"),
        },
      },
      plugins: [
        {
          name: "skip-dts-for-docgen",
          enforce: "pre" as const,
          load(id: string) {
            if (id.endsWith(".d.ts")) return { code: "export {};" };
          },
        },
      ],
    });

    // react-docgen uses its own fs importer that bypasses Vite's load hooks.
    // It follows vault system imports → rpg-ui-toolkit tsconfig path → api.d.ts,
    // which has declare-only syntax Babel can't parse.
    // Wrap the docgen plugin to skip vault/system files so the chain is never followed.
    merged.plugins = (merged.plugins ?? []).map((p: any) => {
      if (Array.isArray(p) || !p || p.name !== "storybook:react-docgen-plugin") return p;
      const orig = p.transform?.bind(p) ?? (() => null);
      return {
        ...p,
        transform(code: string, id: string, options?: any) {
          if (id.includes("/vault/") || id.includes("api.d.ts")) return null;
          return orig(code, id, options);
        },
      };
    });

    return merged;
  },
};

export default config;
