import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    exclude: ["node_modules", "dist", "inspiration"],
    coverage: {
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "dist/",
        "coverage/",
        "**/*.config.*",
        "main.ts",
        "esbuild.config.mjs",
        "version-bump.mjs",
      ],
    },
  },
  resolve: {
    alias: {
      "@": "/lib",
      "@lib": "/lib",
      obsidian: new URL("./scripts/obsidian-shim.js", import.meta.url).pathname,
    },
  },
});
