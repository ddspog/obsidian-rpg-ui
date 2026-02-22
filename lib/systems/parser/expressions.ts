/**
 * Expression Parser
 * 
 * Handles parsing and loading of mathematical expressions with Handlebars templates
 * and JavaScript function definitions.
 */

import { parse as parseYaml } from "yaml";
import * as Handlebars from "handlebars";
import { ExpressionDef } from "../types";
import { extractCodeBlocks } from "../../utils/codeblock-extractor";
import { isFunctionExpressionBlock, parseFunctionExpressions } from "./function-expressions";

export type FileLoader = (filePath: string) => Promise<string | null>;

/**
 * Parse all rpg expression or rpg system.expressions blocks from markdown content.
 * 
 * Supports two formats:
 * 1. YAML with Handlebars formulas (original format)
 * 2. JavaScript function definitions (new format)
 * 
 * @param fileContent - Markdown content containing expression blocks
 * @returns Map of expression ID to expression definition
 */
export function parseExpressions(fileContent: string): Map<string, ExpressionDef> {
  const expressionMap = new Map<string, ExpressionDef>();
  
  // Try both rpg expression and rpg system.expressions (new format)
  let expressionBlocks = extractCodeBlocks(fileContent, "rpg system.expressions");
  if (expressionBlocks.length === 0) {
    // Fall back to rpg expression (backward compatibility)
    expressionBlocks = extractCodeBlocks(fileContent, "rpg expression");
  }

  for (const block of expressionBlocks) {
    // Detect if this block contains JS function definitions
    if (isFunctionExpressionBlock(block)) {
      const funcExpressions = parseFunctionExpressions(block);
      for (const [id, expr] of funcExpressions.entries()) {
        expressionMap.set(id, expr);
      }
      continue;
    }

    // Original YAML-based expression parsing
    const exprYaml = parseYaml(block);
    if (!exprYaml || typeof exprYaml !== "object") {
      continue;
    }

    // Support both array of expressions (new format without wrapper)
    // and single expression or expressions wrapped in 'expressions:' field (old format)
    let expressions: any[];
    if (Array.isArray(exprYaml)) {
      // Direct array (new format): [{id: "modifier", ...}, {id: "saving_throw", ...}]
      expressions = exprYaml;
    } else if (Array.isArray(exprYaml.expressions)) {
      // Array in 'expressions' field (old format): {expressions: [{...}, {...}]}
      expressions = exprYaml.expressions;
    } else {
      // Single expression object: {id: "modifier", ...}
      expressions = [exprYaml];
    }

    for (const expr of expressions) {
      const id = expr.id;
      const params = expr.params || [];
      const formula = expr.formula || "";

      if (!id) {
        console.warn("Expression missing 'id' field");
        continue;
      }

      // Compile the Handlebars template
      let compiledTemplate: HandlebarsTemplateDelegate;
      try {
        compiledTemplate = Handlebars.compile(formula);
      } catch (error) {
        console.error(`Failed to compile expression '${id}':`, error);
        continue;
      }

      // Create evaluate function
      const evaluate = (context: Record<string, unknown>): unknown => {
        try {
          const result = compiledTemplate(context);
          // Try to parse as number if possible
          const numResult = parseFloat(result);
          if (!isNaN(numResult)) {
            return numResult;
          }
          // Return as boolean if it's a boolean string
          if (result === "true") return true;
          if (result === "false") return false;
          return result;
        } catch (error) {
          console.error(`Failed to evaluate expression '${id}':`, error);
          return 0;
        }
      };

      const expressionDef: ExpressionDef = {
        id,
        params,
        formula,
        evaluate,
      };

      expressionMap.set(id, expressionDef);
    }
  }

  return expressionMap;
}

/**
 * Load expressions from external file
 * 
 * @param filePath - Path to file containing rpg expression or rpg system.expressions blocks
 * @param fileLoader - Function to load file content
 * @returns Map of expression definitions
 */
export async function loadExpressionsFromFile(
  filePath: string,
  fileLoader: FileLoader
): Promise<Map<string, ExpressionDef>> {
  try {
    const content = await fileLoader(filePath);
    if (!content) {
      console.error(`Failed to load expressions file: ${filePath}`);
      return new Map();
    }

    return parseExpressions(content);
  } catch (error) {
    console.error(`Error loading expressions from ${filePath}:`, error);
    return new Map();
  }
}

/**
 * Load expressions from multiple external files
 * 
 * @param filePaths - Array of paths to files containing expression definitions
 * @param fileLoader - Function to load file content
 * @returns Map with merged expression definitions (later files override earlier ones)
 */
export async function loadExpressionsFromFiles(
  filePaths: string[],
  fileLoader: FileLoader
): Promise<Map<string, ExpressionDef>> {
  const allExpressions = new Map<string, ExpressionDef>();

  for (const filePath of filePaths) {
    const expressions = await loadExpressionsFromFile(filePath, fileLoader);
    // Merge expressions (later files override earlier ones if same id)
    for (const [id, expr] of expressions.entries()) {
      allExpressions.set(id, expr);
    }
  }

  return allExpressions;
}
