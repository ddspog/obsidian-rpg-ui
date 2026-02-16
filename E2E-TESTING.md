# Obsidian RPG UI - E2E Testing Setup

This directory contains end-to-end tests using Playwright and the `obsidian-testing-framework`.

## Quick Start

1. **Install Playwright browsers** (first time only):
   ```bash
   npx playwright install
   ```

2. **Build the plugin**:
   ```bash
   npm run build
   ```

3. **Run E2E tests**:
   ```bash
   npm run test:e2e
   ```

## What's Included

- **Playwright configuration** (`playwright.config.ts`) - Optimized for Obsidian plugin testing
- **Session Log tests** (`e2e/session-log.test.ts`) - 10 tests covering all Lonelog features
- **System Definition tests** (`e2e/system-definition.test.ts`) - 7 tests for visual rendering
- **Comprehensive documentation** (`e2e/README.md`) - Full guide for writing and running tests

## Features

✅ **Local testing only** - Run against your installed Obsidian  
✅ **No CI overhead** - For development workflow only  
✅ **Automatic cleanup** - Test files deleted after each test  
✅ **Visual debugging** - Screenshots and videos on failure  
✅ **Interactive mode** - Use `--ui` flag for step-by-step testing  

## Test Commands

| Command | Description |
|---------|-------------|
| `npm run test:e2e` | Run all E2E tests |
| `npm run test:e2e:ui` | Run tests in interactive UI mode |
| `npm run test:e2e:debug` | Run tests with Playwright Inspector |
| `npx playwright test --headed` | Run tests with visible browser |
| `npx playwright show-report` | View HTML test report |

## Test Coverage

### Session Log (`e2e/session-log.test.ts`)
- Scene markers and variants (S1, S1a, T1-S1, S1.1)
- Event rendering (actions, rolls, consequences)
- Tag pills (NPC, PC, Location, Equipment)
- Progress trackers (Clock, Track, Timer, Thread)
- Change overview and delta summary

### System Definition (`e2e/system-definition.test.ts`)
- System info cards
- Skills grid with attribute badges
- Expression cards with formulas
- File reference display
- Features and spellcasting rendering

## Requirements

- **Node.js 18+** 
- **Local Obsidian installation**
- **Plugin built** (run `npm run build`)

## Documentation

See `e2e/README.md` for:
- Writing new tests
- Debugging tips
- Troubleshooting common issues
- Test best practices

## Cost Analysis

**Setup time**: ~5 minutes (install Playwright, first build)  
**Dependencies**: 2 packages (`obsidian-testing-framework`, `@playwright/test`)  
**Maintenance**: Low - framework handles Obsidian lifecycle  
**Benefits**: Visual validation, faster iteration, confidence in UI changes
