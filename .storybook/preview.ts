import type { Preview } from "@storybook/react";
import { TFile } from "obsidian";
import "../styles.css";
import {
  skills,
  conditions,
  classes,
  subclasses,
  lineages,
  heritages,
  backgrounds,
  tools,
  martial,
  simple,
  cantrips,
  languages,
  actions,
  reactions,
  bonusActions,
  talents,
} from "../stories/lib/wiki-fixtures";

// Portrait assets bundled with Storybook. Copy your vault's character
// portrait files into `stories/assets/portraits/` and they'll be served by
// filename, so `portrait: [[foo.webp]]` in a story's YAML resolves to the
// bundled image instead of the generic placehold.co fallback.
const portraitUrls = import.meta.glob("../stories/assets/portraits/*.{webp,png,jpg,jpeg,gif}", {
  eager: true,
  import: "default",
  query: "?url",
}) as Record<string, string>;
const portraitByName: Record<string, string> = {};
for (const [path, url] of Object.entries(portraitUrls)) {
  const name = path.split("/").pop();
  if (!name) continue;
  portraitByName[name] = url;
  // Also index without extension so wikilinks like `[[cleric-harold-davies]]`
  // (no `.webp` suffix) still resolve.
  portraitByName[name.replace(/\.[^.]+$/, "")] = url;
}

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
    if (path.includes("compendium/skills")) return skills;
    if (path.includes("compendium/conditions")) return conditions;
    if (path.includes("compendium/classes")) return classes;
    if (path.includes("compendium/subclasses")) return subclasses;
    if (path.includes("compendium/lineages")) return lineages;
    if (path.includes("compendium/heritages")) return heritages;
    if (path.includes("compendium/backgrounds")) return backgrounds;
    if (path.includes("worldbuilding/tools")) return tools;
    if (path.includes("worldbuilding/martial")) return martial;
    if (path.includes("worldbuilding/simple")) return simple;
    if (path.includes("worldbuilding/cantrips")) return cantrips;
    if (path.includes("compendium/languages")) return languages;
    if (path.includes("compendium/bonus-actions")) return bonusActions;
    if (path.includes("compendium/actions")) return actions;
    if (path.includes("compendium/reactions")) return reactions;
    if (path.includes("compendium/talents")) return talents;
    return [];
  },
  file: async (_path: string) => null,
};

// App API used by Pill.Link, PortraitThumb, ConditionPill, and Title.
// Without this, all four silently degrade (plain text / empty figure / no-op).
(globalThis as any).app = {
  workspace: {
    getActiveFile: () => ({ path: "stories/sample-character.md", basename: "Sample Character" }),
    openLinkText: (link: string, _source: string) => console.log(`[Story] Navigate → ${link}`),
  },
  metadataCache: {
    // Return a real TFile stub so PortraitThumb passes the instanceof check.
    getFirstLinkpathDest: (linkpath: string, _source: string) => (linkpath ? new TFile(linkpath) : null),
  },
  vault: {
    // Map the linkpath (stored as `file.path` by our TFile stub) to a
    // bundled portrait URL; fall back to a placeholder so unknown
    // references still render something.
    getResourcePath: (file: unknown) => {
      const path = (file as any)?.path ?? (file as any)?.name ?? "";
      const name = typeof path === "string" ? (path.split("/").pop() ?? path) : "";
      return (
        portraitByName[name] ??
        portraitByName[name.replace(/\.[^.]+$/, "")] ??
        "https://placehold.co/120x160/2a2520/e0ac00?text=Portrait"
      );
    },
  },
};

const preview: Preview = {
  parameters: {
    backgrounds: {
      options: {
        dark: { name: "dark", value: "#1a1816" },
        light: { name: "light", value: "#f5f0eb" },
      },
    },
    a11y: {
      // Run accessibility checks automatically on all stories
      manual: false,
    },
  },

  initialGlobals: {
    backgrounds: {
      value: "dark",
    },
  },
};

export default preview;
