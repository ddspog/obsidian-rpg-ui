import { defineConfig } from "vitest/config";

// Render tests run real views against obsidian-test-mocks in jsdom.
// `obsidian` is aliased to obsidian-test-mocks instead of the node shim used by vitest.config.ts.
export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["lib/**/*.render.test.{ts,tsx}"],
    setupFiles: ["obsidian-test-mocks/vitest-setup"],
  },
  resolve: {
    alias: {
      "@": "/lib",
      "@lib": "/lib",
      obsidian: "obsidian-test-mocks/obsidian",
      lib: new URL("./lib", import.meta.url).pathname,
    },
  },
});
