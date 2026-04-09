import type { Preview } from "@storybook/react";
import { TFile } from "obsidian";
import "../styles.css";
import { skills, conditions } from "../stories/lib/wiki-fixtures";

// ── Obsidian theme CSS variables ───────────────────────────────────────────
// Obsidian's theme sets these on :root. Without them, components fall back to
// their hardcoded defaults. Injecting them here gives Storybook a close match
// to a real Obsidian vault with the default purple accent theme.
const style = document.createElement("style");
style.textContent = `
  :root {
    --accent-h: 258;
    --accent-s: 88%;
    --accent-l: 66%;
    --interactive-accent: hsl(258, 88%, 66%);
    --color-yellow: #e0ac00;
    --link-color-hover: hsl(258, 88%, 66%);
    --text-on-accent: #ffffff;
    --interactive-accent-hover: hsl(258, 88%, 72%);
    --background-modifier-border: rgba(255, 255, 255, 0.95);
    --p-spacing: 0px;
  }
`;
document.head.appendChild(style);

// ── Obsidian globalThis stubs ──────────────────────────────────────────────
// The real plugin sets these on load. In Storybook there is no Obsidian
// runtime, so we provide minimal stubs that let components render correctly.

// Wiki API used by CreateSystem factory functions at module-init time.
// Path-aware routing serves real compendium data loaded via import.meta.glob.
(globalThis as any).__rpg_wiki = {
  folder: async (path: string) => {
    if (path.includes("skills")) return skills;
    if (path.includes("conditions")) return conditions;
    return [];
  },
  file: async (_path: string) => null,
};

// App API used by Pill.Link, PortraitThumb, ConditionPill, and Title.
// Without this, all four silently degrade (plain text / empty figure / no-op).
(globalThis as any).app = {
  workspace: {
    getActiveFile: () => ({ path: "stories/sample-character.md", basename: "Sample Character" }),
    openLinkText: (link: string, _source: string) =>
      console.log(`[Story] Navigate → ${link}`),
  },
  metadataCache: {
    // Return a real TFile stub so PortraitThumb passes the instanceof check.
    getFirstLinkpathDest: (linkpath: string, _source: string) =>
      linkpath ? new TFile(linkpath) : null,
  },
  vault: {
    // Return a placeholder portrait image for any vault file reference.
    getResourcePath: (_file: unknown) =>
      "https://placehold.co/120x160/2a2520/e0ac00?text=Portrait",
  },
};

const preview: Preview = {
  parameters: {
    backgrounds: {
      options: {
        dark: { name: "dark", value: "#1a1816" },
        light: { name: "light", value: "#f5f0eb" }
      }
    },
    a11y: {
      // Run accessibility checks automatically on all stories
      manual: false,
    },
  },

  initialGlobals: {
    backgrounds: {
      value: "dark"
    }
  }
};

export default preview;
