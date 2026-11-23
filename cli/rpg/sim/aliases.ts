/**
 * The bestiary's other names, kept by a person in a vault note
 * (`<system>/gm-tools/encounter-catalog/Bestiary aliases.md`): a `yaml` block
 * of `aliases:` mapping the words a table or a person says to a bestiary note
 * ("warden robot: Robot Warden"). `catalog draft` reads rows with them, and
 * `--monster` takes them (and the spoken names of the notes: "Goblin" for
 * `Goblin, A`) where a note path is expected.
 */

import { parse as parseYaml } from "yaml";
import {
  buildMonsterIndex,
  lookupName,
  type MonsterAlias,
  type MonsterIndex,
} from "lib/domains/encounter-catalog/monster-index";
import type { Ctx } from "../app";

export const ALIASES_NOTE = "tales-of-the-valiant/gm-tools/encounter-catalog/Bestiary aliases.md";

const BESTIARY = "tales-of-the-valiant/worldbuilding/bestiary/";

const basename = (path: string) => path.split("/").pop()!.replace(/\.md$/, "");

/** The bestiary's notes by their file names (no note is read). */
function notePaths(ctx: Ctx): string[] {
  return ctx.vault
    .getMarkdownFiles()
    .map((f) => f.path)
    .filter(
      (p) => p.startsWith(BESTIARY) && !p.startsWith(`${BESTIARY}templates/`) && !p.startsWith(`${BESTIARY}categories/`)
    );
}

export interface AliasRead {
  aliases: MonsterAlias[];
  /** Other names for template notes (`templates:`), lower-cased: "bramble creature" → "Bramble Beast". */
  templates: Record<string, string>;
  /** Aliases whose note was not found, as written. */
  unknown: string[];
}

const reads = new WeakMap<Ctx, AliasRead>();

/** The aliases of the vault's note, their notes found among the bestiary's (by path, file name or spoken name). */
export function bestiaryAliases(ctx: Ctx): AliasRead {
  const cached = reads.get(ctx);
  if (cached) return cached;
  const out: AliasRead = { aliases: [], templates: {}, unknown: [] };
  reads.set(ctx, out);
  const file = ctx.vault.getMarkdownFiles().find((f) => f.path === ALIASES_NOTE);
  if (!file) return out;
  const text = ctx.vault.readSync(file);
  const paths = notePaths(ctx);
  const byName = buildMonsterIndex(paths.map((p) => ({ note: p, name: basename(p) })));
  for (const m of text.matchAll(/^(`{3,})\s*ya?ml\s*\n([\s\S]*?)\n\1\s*$/gm)) {
    let data: unknown;
    try {
      data = parseYaml(m[2]);
    } catch {
      continue;
    }
    // `templates:` names template notes the way a book does ("the bramble creature template").
    const named = (data as { templates?: unknown } | null)?.templates;
    if (named && typeof named === "object" && !Array.isArray(named)) {
      for (const [phrase, target] of Object.entries(named as Record<string, unknown>)) {
        const name = String(target ?? "")
          .replace(/^\[\[|\]\]$/g, "")
          .split("|")[0]
          .trim();
        if (name) out.templates[phrase.trim().toLowerCase()] = name;
      }
    }
    const map = (data as { aliases?: unknown } | null)?.aliases;
    if (!map || typeof map !== "object" || Array.isArray(map)) continue;
    for (const [phrase, target] of Object.entries(map as Record<string, unknown>)) {
      const name = String(target ?? "")
        .replace(/^\[\[|\]\]$/g, "")
        .split("|")[0]
        .trim();
      const note =
        paths.find((p) => p === name || p === `${name}.md` || basename(p) === name) ?? lookupName(byName, name)?.note;
      if (note) out.aliases.push({ phrase, note });
      else out.unknown.push(`${phrase}: ${name}`);
    }
  }
  return out;
}

const indexes = new WeakMap<Ctx, MonsterIndex>();

/**
 * The bestiary note a name stands for when it is not a note: "Goblin" is `Goblin, A`, "dire wolf" is
 * `Wolf, Dire`, an alias its note. Undefined when nothing answers.
 */
export function bestiaryNoteNamed(ctx: Ctx, name: string): string | undefined {
  let index = indexes.get(ctx);
  if (!index) {
    index = buildMonsterIndex(
      notePaths(ctx).map((p) => ({ note: p, name: basename(p) })),
      bestiaryAliases(ctx).aliases
    );
    indexes.set(ctx, index);
  }
  return lookupName(index, name)?.note;
}
