import { test, expect } from "obsidian-testing-framework/fixture";

/**
 * E2E tests for System Definition visual rendering
 * Tests run against local Obsidian installation
 */

test.describe("System Definition - Visual Rendering", () => {
  test("should render system info card", async ({ obsidian, page }) => {
    const content = `\`\`\`rpg system
name: "Test System"
attributes: [strength, dexterity, constitution]
\`\`\``;

    const file = await obsidian.vault.create("test-system.md", content);
    await obsidian.workspace.openFile(file);
    await page.keyboard.press("Control+e");

    // Verify system info card renders
    await expect(page.locator(".system-info-card")).toBeVisible();
    await expect(page.locator(".system-info-card")).toContainText("Test System");

    // Verify attributes display as pills
    await expect(page.locator(".attribute-pill")).toHaveCount(3);
    await expect(page.locator(".attribute-pill").first()).toContainText("strength");

    await obsidian.vault.delete(file);
  });

  test("should render skills grid", async ({ obsidian, page }) => {
    const content = `\`\`\`rpg system.skills
- label: "Acrobatics"
  attribute: dexterity
- label: "Athletics"
  attribute: strength
- label: "Stealth"
  attribute: dexterity
\`\`\``;

    const file = await obsidian.vault.create("test-skills.md", content);
    await obsidian.workspace.openFile(file);
    await page.keyboard.press("Control+e");

    // Verify skills display component
    await expect(page.locator(".skills-display")).toBeVisible();

    // Verify skills are shown in grid
    await expect(page.locator(".skill-card")).toHaveCount(3);

    // Verify skill has label and attribute
    const firstSkill = page.locator(".skill-card").first();
    await expect(firstSkill).toContainText("Acrobatics");
    await expect(firstSkill.locator(".attribute-badge")).toContainText("dexterity");

    // Verify grouping summary
    await expect(page.locator(".skills-summary")).toBeVisible();
    await expect(page.locator(".skills-summary")).toContainText("dexterity: 2");
    await expect(page.locator(".skills-summary")).toContainText("strength: 1");

    await obsidian.vault.delete(file);
  });

  test("should render expressions as cards", async ({ obsidian, page }) => {
    const content = `\`\`\`rpg system.expressions
- id: modifier
  params: [score]
  formula: "{{floor (divide (subtract score 10) 2)}}"
- id: attack_bonus
  params: [modifier, proficiency]
  formula: "{{add modifier proficiency}}"
\`\`\``;

    const file = await obsidian.vault.create("test-expressions.md", content);
    await obsidian.workspace.openFile(file);
    await page.keyboard.press("Control+e");

    // Verify expressions display component
    await expect(page.locator(".expressions-display")).toBeVisible();

    // Verify expression cards
    await expect(page.locator(".expression-card")).toHaveCount(2);

    // Verify first expression
    const firstExpr = page.locator(".expression-card").first();
    await expect(firstExpr.locator(".expression-id")).toContainText("modifier");
    await expect(firstExpr.locator(".expression-params")).toContainText("score");
    await expect(firstExpr.locator(".expression-formula")).toContainText("floor");

    await obsidian.vault.delete(file);
  });

  test("should render file references in system block", async ({ obsidian, page }) => {
    const content = `\`\`\`rpg system
name: "D&D 5e"
skills: "Skills/DnD5e-Skills.md"
expressions:
  - "Expressions/Core.md"
  - "Expressions/Combat.md"
\`\`\``;

    const file = await obsidian.vault.create("test-system-refs.md", content);
    await obsidian.workspace.openFile(file);
    await page.keyboard.press("Control+e");

    // Verify system info card
    await expect(page.locator(".system-info-card")).toBeVisible();

    // Verify file references are displayed
    await expect(page.locator(".file-reference")).toHaveCount(3); // 1 for skills, 2 for expressions
    await expect(page.locator(".file-reference").first()).toContainText("Skills/DnD5e-Skills.md");

    await obsidian.vault.delete(file);
  });
});

test.describe("System Definition - Features and Spellcasting", () => {
  test("should render features list", async ({ obsidian, page }) => {
    const content = `\`\`\`rpg system.features
- id: sneak_attack
  label: "Sneak Attack"
  description: "Deal extra damage when you have advantage"
  level: 1
- id: evasion
  label: "Evasion"
  description: "Dodge area effects"
  level: 7
\`\`\``;

    const file = await obsidian.vault.create("test-features.md", content);
    await obsidian.workspace.openFile(file);
    await page.keyboard.press("Control+e");

    // Verify features display
    await expect(page.locator(".features-display")).toBeVisible();
    await expect(page.locator(".feature-item")).toHaveCount(2);

    // Verify first feature
    const firstFeature = page.locator(".feature-item").first();
    await expect(firstFeature).toContainText("Sneak Attack");
    await expect(firstFeature).toContainText("Deal extra damage");
    await expect(firstFeature).toContainText("Level 1");

    await obsidian.vault.delete(file);
  });

  test("should render spellcasting configuration", async ({ obsidian, page }) => {
    const content = `\`\`\`rpg system.spellcasting
ability: intelligence
spell_slots:
  - level: 1
    slots: 4
  - level: 2
    slots: 3
\`\`\``;

    const file = await obsidian.vault.create("test-spellcasting.md", content);
    await obsidian.workspace.openFile(file);
    await page.keyboard.press("Control+e");

    // Verify spellcasting display
    await expect(page.locator(".spellcasting-display")).toBeVisible();
    await expect(page.locator(".spellcasting-display")).toContainText("intelligence");

    // Verify spell slots
    await expect(page.locator(".spell-slot-level")).toHaveCount(2);

    await obsidian.vault.delete(file);
  });
});
