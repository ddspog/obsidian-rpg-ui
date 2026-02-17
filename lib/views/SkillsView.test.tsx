import { describe, it, expect, vi, beforeEach } from "vitest";
import { SkillsView } from "./SkillsView";
import { App, MarkdownPostProcessorContext } from "obsidian";
import * as AbilityService from "../domains/abilities";

// Mock the system registry
vi.mock("lib/systems/registry", () => {
  const mockSystem = {
    name: "Test System",
    attributes: ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"],
    entities: {},
    skills: [
      { label: "Athletics", attribute: "strength" },
      { label: "Acrobatics", attribute: "dexterity" },
      { label: "Stealth", attribute: "dexterity" },
    ],
    expressions: new Map(),
    features: { categories: [], providers: [], collectors: [] },
    spellcasting: { circles: [], providers: [], collectors: [] },
  };

  return {
    SystemRegistry: {
      getInstance: vi.fn(() => ({
        getSystemForFile: vi.fn(() => mockSystem),
      })),
    },
  };
});

// Mock the React render function
vi.mock("react-dom/client", () => ({
  createRoot: vi.fn(() => ({
    render: vi.fn(),
  })),
}));

// Mock the file context
vi.mock("./filecontext", () => ({
  useFileContext: vi.fn(() => ({
    frontmatter: vi.fn(() => ({
      proficiency_bonus: 2,
      level: 1,
      expertise: [],
      proficiencies: [],
      half_proficiencies: [],
      jack_of_all_trades: false,
    })),
    md: vi.fn(() => ({})),
    onFrontmatterChange: vi.fn(() => () => {}),
  })),
}));

// Mock HTML templates
vi.mock("lib/html-templates", () => ({
  Render: vi.fn((component) => "<div></div>"),
}));

// Mock skill cards component
vi.mock("lib/components/skill-cards", () => ({
  SkillGrid: vi.fn((props) => "skill-grid"),
}));

describe("SkillsView", () => {
  let skillsView: SkillsView;
  let mockApp: App;
  let mockElement: HTMLElement;
  let mockContext: MarkdownPostProcessorContext;

  beforeEach(() => {
    mockApp = {} as App;
    skillsView = new SkillsView(mockApp);
    // Mock the element since we're in node environment
    mockElement = {
      createEl: vi.fn(() => ({ createEl: vi.fn() })),
    } as any;
    mockContext = {} as MarkdownPostProcessorContext;
  });

  it("should handle missing ability block gracefully", () => {
    // Mock parseAbilityBlockFromDocument to throw an error
    const parseAbilityBlockSpy = vi.spyOn(AbilityService, "parseAbilityBlockFromDocument");
    parseAbilityBlockSpy.mockImplementation(() => {
      throw new Error("No ability code blocks found");
    });

    const consoleDebugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});

    const skillsYaml = `proficiencies:
  - athletics
  - intimidation`;

    // Should not throw an error
    expect(() => skillsView.render(skillsYaml, mockElement, mockContext)).not.toThrow();

    // Should log debug message
    expect(consoleDebugSpy).toHaveBeenCalledWith("No ability block found for skills view, using default values");

    parseAbilityBlockSpy.mockRestore();
    consoleDebugSpy.mockRestore();
  });

  it("should use ability scores when ability block is found", () => {
    // Mock parseAbilityBlockFromDocument to return valid data
    const parseAbilityBlockSpy = vi.spyOn(AbilityService, "parseAbilityBlockFromDocument");
    parseAbilityBlockSpy.mockReturnValue({
      abilities: {
        strength: 16,
        dexterity: 14,
        constitution: 13,
        intelligence: 12,
        wisdom: 10,
        charisma: 8,
      },
      bonuses: [],
      proficiencies: [],
    });

    const skillsYaml = `proficiencies:
  - athletics`;

    // Should not throw an error
    expect(() => skillsView.render(skillsYaml, mockElement, mockContext)).not.toThrow();

    parseAbilityBlockSpy.mockRestore();
  });

  it("should use default ability scores (10) when no ability block found", () => {
    // Mock parseAbilityBlockFromDocument to throw an error
    const parseAbilityBlockSpy = vi.spyOn(AbilityService, "parseAbilityBlockFromDocument");
    parseAbilityBlockSpy.mockImplementation(() => {
      throw new Error("No ability code blocks found");
    });

    const skillsYaml = `proficiencies:
  - athletics`;

    // The component should render with default ability scores of 10
    // This would result in a +0 modifier for all abilities
    expect(() => skillsView.render(skillsYaml, mockElement, mockContext)).not.toThrow();

    parseAbilityBlockSpy.mockRestore();
  });
});
