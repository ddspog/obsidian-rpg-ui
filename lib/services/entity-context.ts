/**
 * Entity context — the `{ blocks, lookup, expressions }` a system's entity
 * expressions evaluate against, built from an entity file's fences.
 *
 * A sheet block gets this context from its render child; anything else that
 * needs an entity's computed values (a session log asking "what is Insight for
 * Talon?") builds the same context here, so both read one implementation.
 */

import { parse as parseYaml } from "yaml";
import type { RPGSystem } from "lib/systems/types";
import { splitFenceBody } from "lib/utils/fence-split";

export interface EntityContext {
  blocks: Record<string, unknown>;
  lookup: Record<string, unknown>;
  expressions: Record<string, (...args: unknown[]) => unknown>;
}

/** Sub-blocks a merged `rpg character.sheet` fence stands in for. */
const SHEET_SUB_BLOCKS = ["header", "health", "stats", "senses", "skills", "rolls", "proficiencies"];

/**
 * Parse every declared block of `entityType` from the file's fences. A block
 * with no fence of its own is `{}` — or, when the author bundled everything in
 * one `rpg <entity>.sheet` fence, an alias of that sheet body, so cross-block
 * reads (`blocks.stats.STR`) find the real data instead of an empty placeholder.
 */
export function buildEntityBlocks(
  system: RPGSystem,
  entityType: string,
  codeBlocks: Map<string, string[]>
): Record<string, unknown> {
  const blocks: Record<string, unknown> = {};
  const blockNames = Object.keys(system.entities[entityType]?.blocks ?? {});
  const authored = new Set<string>();
  for (const bn of blockNames) {
    const raw = codeBlocks.get(`${entityType}.${bn}`)?.[0];
    if (!raw) {
      blocks[bn] = {};
      continue;
    }
    // A fence may carry prose after a `---` (a statblock's lore, a feature's
    // text): only the part above it is YAML. The prose rides along as `text`,
    // as it does for a block rendering its own fence.
    const { yaml, text } = splitFenceBody(raw);
    try {
      const parsed = parseYaml(yaml) ?? {};
      blocks[bn] =
        text !== undefined && parsed && typeof parsed === "object" && !Array.isArray(parsed) && !("text" in parsed)
          ? { ...parsed, text }
          : parsed;
    } catch {
      blocks[bn] = {};
    }
    authored.add(bn);
  }
  if (blockNames.includes("sheet") && authored.has("sheet")) {
    for (const bn of SHEET_SUB_BLOCKS) {
      if (blockNames.includes(bn) && !authored.has(bn)) blocks[bn] = blocks["sheet"];
    }
  }
  return blocks;
}

/**
 * Bind the system's expressions to one entity: each becomes a plain function
 * (`expressions.Modifier("Insight")`) evaluated against this entity's blocks,
 * lookup and frontmatter. A throwing expression yields `undefined` rather than
 * breaking its caller.
 */
export function bindExpressions(
  system: RPGSystem,
  ctx: { blocks: Record<string, unknown>; lookup: Record<string, unknown>; frontmatter: Record<string, unknown> },
  entityType?: string
): Record<string, (...args: unknown[]) => unknown> {
  const bound: Record<string, (...args: unknown[]) => unknown> = {};
  const systemCtx = {
    skills: system.skills,
    attributes: system.attributes,
    conditions: system.conditions ?? [],
    traits: system.traits,
  };
  // The entity's own expressions win over same-named ones from other entities.
  const defs = new Map(system.expressions ?? []);
  for (const [name, def] of system.entities[entityType ?? ""]?.expressions ?? []) defs.set(name, def);
  for (const [name, def] of defs) {
    bound[name] = (...callArgs: unknown[]) => {
      try {
        const args = callArgs.length === 1 && Array.isArray(callArgs[0]) ? callArgs[0] : callArgs;
        return def.evaluate({ args, ...ctx, expressions: bound, system: systemCtx });
      } catch (err) {
        console.error("RPG UI: expression evaluate failed:", err);
        return undefined;
      }
    };
  }
  return bound;
}

/** The full expression context for an entity file. */
export function buildEntityContext(
  system: RPGSystem,
  entityType: string,
  codeBlocks: Map<string, string[]>,
  frontmatter: Record<string, unknown>
): EntityContext {
  const blocks = buildEntityBlocks(system, entityType, codeBlocks);
  const lookup = (system.entities[entityType]?.lookup as Record<string, unknown> | undefined) ?? {};
  return { blocks, lookup, expressions: bindExpressions(system, { blocks, lookup, frontmatter }, entityType) };
}

/** The entity type a file's fences declare (`rpg character.sheet` → `character`). */
export function entityTypeOf(system: RPGSystem, codeBlocks: Map<string, string[]>): string | undefined {
  for (const meta of codeBlocks.keys()) {
    const type = meta.split(".")[0];
    if (system.entities[type]) return type;
  }
  return undefined;
}
