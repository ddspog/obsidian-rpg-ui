/**
 * System Markdown Parser
 *
 * Parses markdown files containing `rpg system*` code blocks into RPGSystem objects.
 * Supports two formats:
 *   - Inline: all definitions in a single markdown file
 *   - Split: main `rpg system` block references external files for skills, expressions, conditions
 *
 * This parser is intentionally pure (no vault I/O): it operates on string content
 * and exposes a `FileReader` callback for resolving external references, making it
 * fully testable without an Obsidian vault.
 */

import { parse as parseYaml } from "yaml";
import * as Handlebars from "handlebars";
import { extractCodeBlocks, extractFirstCodeBlock } from "lib/utils/codeblock-extractor";
import { CreateSystem } from "./create-system";
import type {
  AttributeDefinition,
  SkillDefinition,
  ConditionDefinition,
  ExpressionDef,
  RPGSystem,
} from "./types";

// ─── Private helpers ──────────────────────────────────────────────────────────

/** Ensure basic math helpers required by system expression formulas are available. */
function ensureMathHelpers(): void {
  if (!Handlebars.helpers["floor"]) {
    Handlebars.registerHelper("add", (...args: unknown[]) => {
      const nums = (args.slice(0, -1) as number[]).map(Number).filter((n) => !isNaN(n));
      return nums.reduce((s, n) => s + n, 0);
    });
    Handlebars.registerHelper("subtract", (a: number, b: number) => Number(a) - Number(b));
    Handlebars.registerHelper("multiply", (a: number, b: number) => Number(a) * Number(b));
    Handlebars.registerHelper("divide", (a: number, b: number) => Number(a) / Number(b));
    Handlebars.registerHelper("floor", (a: number) => Math.floor(Number(a)));
    Handlebars.registerHelper("ceil", (a: number) => Math.ceil(Number(a)));
    Handlebars.registerHelper("round", (a: number) => Math.round(Number(a)));
  }
}

/** Compile a Handlebars formula string into an ExpressionDef. */
function buildExpressionDef(id: string, params: string[], formula: string): ExpressionDef {
  ensureMathHelpers();
  let compiled: Handlebars.TemplateDelegate | null = null;
  return {
    id,
    params,
    formula,
    evaluate: (context: Record<string, unknown>) => {
      try {
        if (!compiled) compiled = Handlebars.compile(formula);
        const result = compiled(context);
        const num = Number(result);
        return isNaN(num) ? result : num;
      } catch {
        return 0;
      }
    },
  };
}

// ─── Block parsers ────────────────────────────────────────────────────────────

/**
 * Parse all `rpg system.attributes` blocks in `content`.
 * Normalises `name`/`description` keys into `$name`/`$contents`.
 */
export function parseAttributeBlocks(content: string): AttributeDefinition[] {
  const blocks = extractCodeBlocks(content, "rpg system.attributes");
  const result: AttributeDefinition[] = [];
  for (const block of blocks) {
    try {
      const data = parseYaml(block);
      if (!Array.isArray(data)) continue;
      for (const item of data) {
        if (!item || typeof item !== "object") continue;
        const { name, $name, alias, subtitle, description, $contents, ...rest } = item as Record<string, unknown>;
        result.push({
          $name: (($name ?? name) as string) ?? "",
          alias: alias as string | undefined,
          subtitle: subtitle as string | undefined,
          $contents: (($contents ?? description) as string) ?? undefined,
          ...rest,
        });
      }
    } catch {
      // Skip malformed blocks
    }
  }
  return result;
}

/**
 * Parse all `rpg system.skills` blocks in `content`.
 * Normalises `label`/`description` keys into `$name`/`$contents`.
 */
export function parseSkillBlocks(content: string): SkillDefinition[] {
  const blocks = extractCodeBlocks(content, "rpg system.skills");
  const result: SkillDefinition[] = [];
  for (const block of blocks) {
    try {
      const data = parseYaml(block);
      if (!Array.isArray(data)) continue;
      for (const item of data) {
        if (!item || typeof item !== "object") continue;
        const { label, $name, name, attribute, subtitle, description, $contents, ...rest } = item as Record<
          string,
          unknown
        >;
        result.push({
          $name: (($name ?? label ?? name) as string) ?? "",
          attribute: (attribute as string) ?? "",
          subtitle: subtitle as string | undefined,
          $contents: (($contents ?? description) as string) ?? undefined,
          ...rest,
        });
      }
    } catch {
      // Skip malformed blocks
    }
  }
  return result;
}

/**
 * Parse all `rpg system.expressions` blocks in `content`.
 * Compiles Handlebars formula strings into evaluate functions.
 */
export function parseExpressionBlocks(content: string): ExpressionDef[] {
  const blocks = extractCodeBlocks(content, "rpg system.expressions");
  const result: ExpressionDef[] = [];
  for (const block of blocks) {
    try {
      const data = parseYaml(block);
      if (!Array.isArray(data)) continue;
      for (const item of data) {
        if (!item || typeof item !== "object") continue;
        const { id, params, formula } = item as Record<string, unknown>;
        if (typeof id !== "string" || typeof formula !== "string") continue;
        const paramList: string[] = Array.isArray(params) ? (params as string[]) : [];
        result.push(buildExpressionDef(id, paramList, formula));
      }
    } catch {
      // Skip malformed blocks
    }
  }
  return result;
}

/**
 * Parse all `rpg system.conditions` blocks in `content`.
 * Normalises `name`/`description` keys into `$name`/`$contents`.
 */
export function parseConditionBlocks(content: string): ConditionDefinition[] {
  const blocks = extractCodeBlocks(content, "rpg system.conditions");
  const result: ConditionDefinition[] = [];
  for (const block of blocks) {
    try {
      const data = parseYaml(block);
      if (!Array.isArray(data)) continue;
      for (const item of data) {
        if (!item || typeof item !== "object") continue;
        const { name, $name, icon, description, $contents, ...rest } = item as Record<string, unknown>;
        result.push({
          $name: (($name ?? name) as string) ?? "",
          icon: icon as string | undefined,
          $contents: (($contents ?? description) as string) ?? undefined,
          ...rest,
        });
      }
    } catch {
      // Skip malformed blocks
    }
  }
  return result;
}

// ─── System block shape ───────────────────────────────────────────────────────

interface RawSystemBlock {
  name?: string;
  version?: string;
  attributes?: Array<string | Record<string, unknown>>;
  /** Path(s) to external skill definition files */
  skills?: string | string[];
  /** Path(s) to external expression definition files */
  expressions?: string | string[];
  /** Path(s) to external condition definition files */
  conditions?: string | string[];
}

// ─── Single-file parse (no I/O) ───────────────────────────────────────────────

/**
 * Partial parse result from a single markdown string.
 * External file references are captured in `refs` for the caller to resolve.
 */
export interface ParsedMarkdownSystem {
  name: string;
  attributes: AttributeDefinition[];
  skills: SkillDefinition[];
  expressions: ExpressionDef[];
  conditions: ConditionDefinition[];
  /** External file paths referenced by the system block */
  refs: {
    skills?: string[];
    expressions?: string[];
    conditions?: string[];
  };
}

/**
 * Parse a markdown string that contains `rpg system*` code blocks.
 *
 * - Reads inline attribute/skill/expression/condition blocks from the same file
 * - Reads the `rpg system` block for name, inline attribute list, and external references
 * - Does **not** perform any file I/O — external references are returned in `refs`
 *
 * Returns `null` if no valid `rpg system` block with a `name` field is found.
 */
export function parseMarkdownSystemFile(content: string): ParsedMarkdownSystem | null {
  // 1. Extract the main system block
  const raw = extractFirstCodeBlock(content, "rpg system");
  if (!raw) return null;

  let systemBlock: RawSystemBlock;
  try {
    systemBlock = parseYaml(raw) as RawSystemBlock;
  } catch {
    return null;
  }

  if (!systemBlock?.name) return null;

  // 2. Parse inline component blocks
  const attributes: AttributeDefinition[] = (() => {
    const inlineAttrs = parseAttributeBlocks(content);
    if (inlineAttrs.length > 0) return inlineAttrs;
    // Fall back to the `attributes` array in the system block
    if (!Array.isArray(systemBlock.attributes)) return [];
    return systemBlock.attributes.map((attr) => {
      if (typeof attr === "string") return { $name: attr };
      const { name, $name, alias, subtitle, description, $contents, ...rest } = attr as Record<string, unknown>;
      return {
        $name: (($name ?? name) as string) ?? "",
        alias: alias as string | undefined,
        subtitle: subtitle as string | undefined,
        $contents: (($contents ?? description) as string) ?? undefined,
        ...rest,
      };
    });
  })();

  const skills = parseSkillBlocks(content);
  const expressions = parseExpressionBlocks(content);
  const conditions = parseConditionBlocks(content);

  // 3. Collect external references
  const toArray = (v: string | string[] | undefined): string[] | undefined => {
    if (!v) return undefined;
    return Array.isArray(v) ? v : [v];
  };

  const refs: ParsedMarkdownSystem["refs"] = {
    skills: toArray(systemBlock.skills as string | string[] | undefined),
    expressions: toArray(systemBlock.expressions as string | string[] | undefined),
    conditions: toArray(systemBlock.conditions as string | string[] | undefined),
  };

  return { name: systemBlock.name, attributes, skills, expressions, conditions, refs };
}

// ─── Vault-aware async loader ─────────────────────────────────────────────────

/**
 * Callback that reads a vault file by path, returning its text content or null.
 * Abstracted so the parser is testable without an Obsidian vault instance.
 */
export type FileReader = (path: string) => Promise<string | null>;

/**
 * Load a complete RPGSystem by parsing a main markdown file and resolving any
 * external file references it contains.
 *
 * @param mainContent - Text of the primary system markdown file
 * @param readFile    - Async function to read referenced vault files by path
 * @returns A fully-built RPGSystem, or null if the main content is not a valid system file
 */
export async function loadMarkdownSystem(mainContent: string, readFile: FileReader): Promise<RPGSystem | null> {
  const parsed = parseMarkdownSystemFile(mainContent);
  if (!parsed) return null;

  let { attributes, skills, expressions, conditions } = parsed;
  const { refs } = parsed;

  // Resolve external skill files
  if (refs.skills) {
    for (const path of refs.skills) {
      const fileContent = await readFile(path);
      if (fileContent) skills = [...skills, ...parseSkillBlocks(fileContent)];
    }
  }

  // Resolve external expression files
  if (refs.expressions) {
    for (const path of refs.expressions) {
      const fileContent = await readFile(path);
      if (fileContent) expressions = [...expressions, ...parseExpressionBlocks(fileContent)];
    }
  }

  // Resolve external condition files
  if (refs.conditions) {
    for (const path of refs.conditions) {
      const fileContent = await readFile(path);
      if (fileContent) conditions = [...conditions, ...parseConditionBlocks(fileContent)];
    }
  }

  // Build the RPGSystem via CreateSystem for validation and normalisation
  const system = CreateSystem({
    name: parsed.name,
    attributes,
    skills,
    conditions,
  });

  // Inject the Handlebars-compiled expressions (CreateSystem only handles JS functions)
  for (const expr of expressions) {
    system.expressions.set(expr.id, expr);
  }

  return system;
}
