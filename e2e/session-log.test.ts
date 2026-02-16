import { test, expect } from "obsidian-testing-framework/fixture";

/**
 * E2E tests for Session Log (Lonelog) feature
 * Tests run against local Obsidian installation
 */

test.describe("Session Log - Basic Rendering", () => {
  test("should render session log with scene markers", async ({ obsidian, page }) => {
    // Create test file with session log
    const content = `\`\`\`rpg log
state_key: test-session
scene: "Test Scene"
---
S1 *A dark forest*
@ The hero moves forward
d: Stealth d20+5=18 vs DC 14 -> Success
=> Success!
\`\`\``;

    const file = await obsidian.vault.create("test-session-log.md", content);
    await obsidian.workspace.openFile(file);

    // Switch to Reading View
    await page.keyboard.press("Control+e"); // Toggle preview mode

    // Verify scene header renders
    await expect(page.locator(".session-log-scene-header")).toBeVisible();
    await expect(page.locator(".session-log-scene-header")).toContainText("S1");

    // Verify event list renders
    await expect(page.locator(".session-log-event-list")).toBeVisible();

    // Verify action event
    await expect(page.locator(".event-action")).toBeVisible();
    await expect(page.locator(".event-action")).toContainText("The hero moves forward");

    // Verify roll event
    await expect(page.locator(".event-roll")).toBeVisible();
    await expect(page.locator(".event-roll")).toContainText("Stealth");

    // Verify consequence event
    await expect(page.locator(".event-consequence")).toBeVisible();
    await expect(page.locator(".event-consequence")).toContainText("Success!");

    // Cleanup
    await obsidian.vault.delete(file);
  });

  test("should render NPC tags with state changes", async ({ obsidian, page }) => {
    const content = `\`\`\`rpg log
state_key: test-npc-tags
---
S1 Combat begins
@ Attack the goblin
=> [N:Goblin|HP-5|wounded]
\`\`\``;

    const file = await obsidian.vault.create("test-npc-tags.md", content);
    await obsidian.workspace.openFile(file);
    await page.keyboard.press("Control+e");

    // Verify NPC tag renders
    await expect(page.locator(".tag-pill-npc")).toBeVisible();
    await expect(page.locator(".tag-pill-npc")).toContainText("Goblin");

    // Verify HP delta badge
    await expect(page.locator(".tag-pill-npc .tag-delta")).toContainText("-5");

    // Verify status badge
    await expect(page.locator(".tag-pill-npc .tag-status")).toContainText("wounded");

    await obsidian.vault.delete(file);
  });

  test("should render progress trackers", async ({ obsidian, page }) => {
    const content = `\`\`\`rpg log
state_key: test-trackers
---
S1 Progress tracking
[Clock:Countdown 2/4]
[Track:Quest Progress 5/10]
[Timer:Escape 3]
\`\`\``;

    const file = await obsidian.vault.create("test-trackers.md", content);
    await obsidian.workspace.openFile(file);
    await page.keyboard.press("Control+e");

    // Verify clock tracker
    await expect(page.locator(".tag-pill-clock")).toBeVisible();
    await expect(page.locator(".tag-pill-clock")).toContainText("Countdown");
    await expect(page.locator(".tag-pill-clock .progress-bar")).toHaveAttribute(
      "style",
      expect.stringContaining("50%") // 2/4 = 50%
    );

    // Verify track tracker
    await expect(page.locator(".tag-pill-track")).toBeVisible();
    await expect(page.locator(".tag-pill-track")).toContainText("Quest Progress");

    // Verify timer
    await expect(page.locator(".tag-pill-timer")).toBeVisible();
    await expect(page.locator(".tag-pill-timer")).toContainText("Escape");

    await obsidian.vault.delete(file);
  });
});

test.describe("Session Log - Scene Variants", () => {
  test("should render flashback scenes", async ({ obsidian, page }) => {
    const content = `\`\`\`rpg log
state_key: test-flashback
---
S1a *Flashback: The past*
@ Memory of training
\`\`\``;

    const file = await obsidian.vault.create("test-flashback.md", content);
    await obsidian.workspace.openFile(file);
    await page.keyboard.press("Control+e");

    await expect(page.locator(".scene-flashback")).toBeVisible();
    await expect(page.locator(".scene-flashback")).toContainText("S1a");

    await obsidian.vault.delete(file);
  });

  test("should render parallel scenes", async ({ obsidian, page }) => {
    const content = `\`\`\`rpg log
state_key: test-parallel
---
T1-S1 *Meanwhile...*
@ Another timeline
\`\`\``;

    const file = await obsidian.vault.create("test-parallel.md", content);
    await obsidian.workspace.openFile(file);
    await page.keyboard.press("Control+e");

    await expect(page.locator(".scene-parallel")).toBeVisible();
    await expect(page.locator(".scene-parallel")).toContainText("T1-S1");

    await obsidian.vault.delete(file);
  });

  test("should render montage scenes", async ({ obsidian, page }) => {
    const content = `\`\`\`rpg log
state_key: test-montage
---
S1.1 *Quick cuts*
@ Training montage
\`\`\``;

    const file = await obsidian.vault.create("test-montage.md", content);
    await obsidian.workspace.openFile(file);
    await page.keyboard.press("Control+e");

    await expect(page.locator(".scene-montage")).toBeVisible();
    await expect(page.locator(".scene-montage")).toContainText("S1.1");

    await obsidian.vault.delete(file);
  });
});

test.describe("Session Log - Change Overview", () => {
  test("should display delta summary", async ({ obsidian, page }) => {
    const content = `\`\`\`rpg log
state_key: test-deltas
---
S1 Combat
@ Attack
=> [N:Enemy|HP-10|dead]
[PC:Hero|HP+5]
\`\`\``;

    const file = await obsidian.vault.create("test-deltas.md", content);
    await obsidian.workspace.openFile(file);
    await page.keyboard.press("Control+e");

    // Verify change overview component
    await expect(page.locator(".change-overview")).toBeVisible();

    // Should show NPC changes
    await expect(page.locator(".change-overview")).toContainText("Enemy");
    await expect(page.locator(".change-overview")).toContainText("HP");
    await expect(page.locator(".change-overview")).toContainText("dead");

    // Should show PC changes
    await expect(page.locator(".change-overview")).toContainText("Hero");

    await obsidian.vault.delete(file);
  });
});
