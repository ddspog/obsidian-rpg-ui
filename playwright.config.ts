import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for E2E testing with Obsidian
 * Uses obsidian-testing-framework for Obsidian app lifecycle management
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // Run tests serially to avoid vault conflicts
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker to avoid concurrent Obsidian instances
  reporter: "html",
  timeout: 60000, // 60s timeout for Obsidian app startup

  use: {
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "obsidian-e2e",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
