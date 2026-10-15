/**
 * The basic actions every creature can take — Dash, Dodge, Help, Hide, the
 * Opportunity Attack reaction, … — read from the vault's `concepts/` notes.
 *
 * Shared by the character entity (its features block lists them, and its
 * session cards offer them) and the stat entity (a foe or NPC in a session
 * offers them too), so every creature draws on the same notes.
 */

import type { FeatureEntry, SessionAction } from "rpg-ui-toolkit";

/** Folders of basic actions, each holding one action type. */
const FOLDERS: Array<{ folder: string; type: "action" | "bonus" | "reaction" }> = [
  { folder: "concepts/actions", type: "action" },
  { folder: "concepts/bonus-actions", type: "bonus" },
  { folder: "concepts/reactions", type: "reaction" },
];

/** Load the basic actions as feature entries, tagged with their type. */
export async function loadBasicActions(wiki: { folder: (path: string) => Promise<unknown> }): Promise<FeatureEntry[]> {
  const docs = await Promise.all(FOLDERS.map((f) => wiki.folder(f.folder) as Promise<any[]>));
  return FOLDERS.flatMap(({ type }, i) =>
    (docs[i] ?? []).map((d: any) => ({ $name: d?.$name ?? "", $contents: d?.$contents ?? "", type }) as FeatureEntry)
  );
}

/** The YAML part of a basic action's `rpg feature.details` fence (above any `---`). */
function fenceHeader(contents: string | undefined): string | undefined {
  return contents?.match(/```rpg feature\.details\n([\s\S]*?)(?:\n---\n|\n```)/)?.[1];
}

/** A scalar field on a fence header line (`icon: "🏃"` → `🏃`). */
function scalar(header: string | undefined, key: string): string | undefined {
  const raw = header?.match(new RegExp(`^${key}:\\s*(.+?)\\s*$`, "m"))?.[1];
  const value = raw?.replace(/^["']|["']$/g, "");
  return value || undefined;
}

/** A flow-list field (`skills: [Arcana, History]` → `["Arcana", "History"]`). */
function list(header: string | undefined, key: string): string[] | undefined {
  const raw = header?.match(new RegExp(`^${key}:\\s*\\[(.*)\\]\\s*$`, "m"))?.[1];
  const items = raw
    ?.split(",")
    .map((v) => v.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
  return items && items.length > 0 ? items : undefined;
}

/** The `icon:` a basic action's note gives its card. */
export function noteIcon(contents: string | undefined): string | undefined {
  return scalar(fenceHeader(contents), "icon");
}

/**
 * The basic actions as session cards, each with what its note declares: an
 * `icon`, a `summary`, the `skills` it checks with (one picked when played —
 * Study, Search, Influence), whether it has a `target`, whether it is
 * `freeform` (Improvise), and a `rank` within its stack.
 * Attack and Cast a Spell are left out: a creature's own attacks (its weapons,
 * its statblock strikes) and spells are cards of their own already, with their
 * rolls.
 */
export function basicSessionActions(basics: FeatureEntry[] | undefined): SessionAction[] {
  const skip = new Set(["attack", "cast a spell"]);
  return (basics ?? [])
    .filter((f) => f.$name && !skip.has(f.$name.toLowerCase()))
    .map((f) => {
      const header = fenceHeader(f.$contents);
      const icon = scalar(header, "icon");
      const summary = scalar(header, "summary");
      const skills = list(header, "skills");
      const target = scalar(header, "target") === "true";
      const freeform = scalar(header, "freeform") === "true";
      const rank = Number(scalar(header, "rank"));
      return {
        name: f.$name,
        // Its own note describes it — the card links there.
        link: f.$name,
        origin: "basic" as const,
        bucket: (f as { type?: string }).type ?? "action",
        ...(icon ? { icon } : {}),
        ...(summary ? { summary } : {}),
        ...(skills ? { skills } : {}),
        ...(target ? { target } : {}),
        ...(freeform ? { freeform } : {}),
        ...(Number.isFinite(rank) && rank > 0 ? { rank } : {}),
      };
    });
}
