# E2E Tests with Obsidian Testing Framework

This directory contains end-to-end tests for the Obsidian RPG UI plugin using Playwright and the `obsidian-testing-framework`.

## Prerequisites

- **Local Obsidian installation** - Tests run against your installed Obsidian app
- **Plugin built** - Run `npm run build` before testing
- **Node.js 18+** - Required for Playwright

## Setup

1. **Install dependencies** (if not already done):
   ```bash
   npm install
   ```

2. **Install Playwright browsers** (first time only):
   ```bash
   npx playwright install
   ```

## Running Tests

### Run all E2E tests locally:
```bash
npm run test:e2e
```

### Run specific test file:
```bash
npx playwright test e2e/session-log.test.ts
```

### Run tests in UI mode (interactive):
```bash
npx playwright test --ui
```

### Run tests with debug mode:
```bash
npx playwright test --debug
```

### Run tests in headed mode (see browser):
```bash
npx playwright test --headed
```

## Test Structure

```
e2e/
├── session-log.test.ts         # Tests for Lonelog session log rendering
├── system-definition.test.ts   # Tests for system definition visual rendering
└── README.md                   # This file
```

## Writing Tests

The tests use the `obsidian-testing-framework` which provides:

- **Obsidian app lifecycle management** - Automatically starts/stops Obsidian
- **Vault management** - Create/delete test files in a temporary vault
- **Playwright integration** - Full browser automation capabilities

### Basic test structure:

```typescript
import { test, expect } from "obsidian-testing-framework/fixture";

test("test name", async ({ obsidian, page }) => {
  // Create test file
  const file = await obsidian.vault.create("test.md", "content");
  
  // Open file in Obsidian
  await obsidian.workspace.openFile(file);
  
  // Switch to Reading View (preview mode)
  await page.keyboard.press("Control+e");
  
  // Test UI elements
  await expect(page.locator(".some-class")).toBeVisible();
  
  // Cleanup
  await obsidian.vault.delete(file);
});
```

## Test Coverage

### Session Log Tests (`session-log.test.ts`)
- ✅ Basic scene rendering with markers (S1, S1a, T1-S1, S1.1)
- ✅ Event list rendering (actions, rolls, consequences)
- ✅ NPC/PC tag rendering with state changes
- ✅ Progress trackers (clocks, tracks, timers)
- ✅ Change overview and delta summary

### System Definition Tests (`system-definition.test.ts`)
- ✅ System info card rendering
- ✅ Skills grid with attribute badges
- ✅ Expression cards with formulas
- ✅ File reference display
- ✅ Features list rendering
- ✅ Spellcasting configuration display

## Debugging

### View test traces:
```bash
npx playwright show-report
```

### Screenshot on failure:
Screenshots are automatically saved to `test-results/` on test failure.

### Video recording:
Videos are recorded on failure and saved to `test-results/`.

## Configuration

Tests are configured in `playwright.config.ts`:
- Single worker (avoid concurrent Obsidian instances)
- 60s timeout (Obsidian startup can be slow)
- HTML reporter
- Screenshots and videos on failure

## Notes

- **Tests are NOT run in CI** - These are for local development only
- **Tests use your local Obsidian** - Make sure it's installed and up to date
- **Plugin must be built** - Run `npm run build` before testing
- **Tests run serially** - Only one Obsidian instance at a time
- **Cleanup is automatic** - Test files are deleted after each test

## Troubleshooting

### Obsidian doesn't start
- Check that Obsidian is installed on your system
- Try running with `--headed` to see what's happening

### Plugin not loading
- Ensure `npm run build` has been run
- Check that the plugin is enabled in Obsidian settings

### Tests timeout
- Increase timeout in `playwright.config.ts`
- Your system might need more time to start Obsidian

### Selector not found
- Run with `--headed` to inspect the actual UI
- Use Playwright Inspector: `npx playwright test --debug`
