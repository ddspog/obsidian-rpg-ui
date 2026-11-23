/**
 * The note a homebrew creature is kept in: `<system>/worldbuilding/bestiary/
 * homebrew/<name>.md`, a draft based on a bestiary statblock with the templates
 * it was made with. Written by `rpg sim homebrew` and by the template sheet's
 * "Save as homebrew". Pure: no Obsidian and no I/O.
 */

import { stringify as stringifyYaml } from "yaml";

/** Where a homebrew creature of a system is kept. */
export function homebrewPath(system: string, name: string): string {
  return `${system}/worldbuilding/bestiary/homebrew/${name.replace(/[\\/:*?"<>|#^[\]]/g, "").trim()}.md`;
}

export function homebrewNoteText(args: {
  name: string;
  /** The base note's vault path. */
  basePath: string;
  baseName: string;
  /** The templates it was made with (a role, a creature template). */
  templates: string[];
  /** The new `stat.monster` block's data. */
  data: Record<string, unknown>;
  /** Prose after the base block's `---`, kept. */
  rest?: string;
}): string {
  const body = `${stringifyYaml(args.data, { lineWidth: 0 }).trimEnd()}${args.rest ? `\n${args.rest}` : ""}`;
  return [
    "---",
    "cssclasses:",
    "  - note-statblock",
    "homebrew: draft",
    `based-on: "[[${args.basePath.replace(/\.md$/, "")}|${args.baseName}]]"`,
    ...(args.templates.length ? ["templates:", ...args.templates.map((t) => `  - ${JSON.stringify(t)}`)] : []),
    "---",
    `# ${args.name}`,
    "```rpg stat.monster",
    body,
    "```",
    "",
  ].join("\n");
}
