/**
 * Function Expression Parser
 *
 * Parses JavaScript function definitions from `rpg system.expressions` code blocks.
 * These functions can reference `this` to access character/monster context data,
 * call each other, and support async operations (e.g., dice rolling).
 *
 * Syntax example:
 * ```
 * function PB(this) {
 *   return 2 + Math.floor((this.level - 1) / 4);
 * }
 *
 * function Modifier(ability) {
 *   return AttributeMod(ability) + ProficiencyMod(ability);
 * }
 *
 * async function Check(ability) {
 *   return await D20() + Modifier(ability);
 * }
 * ```
 *
 * `this` in parameter list is a convention meaning "this function needs context".
 * It is stripped from the actual parameter list and instead bound via the
 * enclosing scope when the functions are compiled.
 */

import { ExpressionDef } from "../types";

/** Parsed representation of a single function definition */
export interface ParsedFunction {
  /** Function name (used as expression ID) */
  name: string;
  /** Parameter names (excluding 'this') */
  params: string[];
  /** Whether the function uses 'this' context */
  usesContext: boolean;
  /** Whether the function is async */
  isAsync: boolean;
  /** Raw function body (code between braces) */
  body: string;
}

/**
 * Check if a code block contains JavaScript function definitions
 * rather than YAML expression definitions.
 *
 * Detects `function` or `async function` keywords at the start of lines.
 */
export function isFunctionExpressionBlock(source: string): boolean {
  const trimmed = source.trim();
  // Check for function or async function at the start of lines
  return /^(async\s+)?function\s+\w+/m.test(trimmed);
}

/**
 * Parse JavaScript function definitions from a code block.
 *
 * Supports:
 * - `function Name(params) { body }`
 * - `async function Name(params) { body }`
 * - `this` as first parameter (stripped, indicates context binding)
 * - Multi-line function bodies with nested braces
 */
export function parseFunctionBlock(source: string): ParsedFunction[] {
  const functions: ParsedFunction[] = [];
  const text = source.trim();

  // Match function declarations including async
  // We need to handle nested braces, so we can't just use a simple regex for the body
  const funcStartPattern = /^(async\s+)?function\s+(\w+)\s*\(([^)]*)\)\s*\{/gm;

  let match: RegExpExecArray | null;
  while ((match = funcStartPattern.exec(text)) !== null) {
    const isAsync = !!match[1];
    const name = match[2];
    const rawParams = match[3].trim();
    const bodyStart = match.index + match[0].length;

    // Extract body by counting braces (starting after the opening brace)
    const body = extractFunctionBody(text, bodyStart);
    if (body === null) {
      console.warn(`Failed to parse function body for '${name}'`);
      continue;
    }

    // Parse parameters, stripping 'this'
    const allParams = rawParams
      ? rawParams.split(",").map((p) => p.trim()).filter(Boolean)
      : [];
    const usesContext = allParams.length > 0 && allParams[0] === "this";
    const params = usesContext ? allParams.slice(1) : allParams;

    functions.push({
      name,
      params,
      usesContext,
      isAsync,
      body: body.trim(),
    });
  }

  return functions;
}

/**
 * Extract function body by counting matching braces.
 * Starts after the opening brace has already been consumed.
 */
function extractFunctionBody(text: string, startIndex: number): string | null {
  let depth = 1;
  let i = startIndex;
  let inString: string | null = null;
  let escaped = false;

  while (i < text.length && depth > 0) {
    const char = text[i];

    if (escaped) {
      escaped = false;
      i++;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      i++;
      continue;
    }

    // Track string literals
    if (inString) {
      if (char === inString) {
        inString = null;
      }
      i++;
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      inString = char;
      i++;
      continue;
    }

    // Skip line comments
    if (char === "/" && i + 1 < text.length && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i++;
      continue;
    }

    // Skip block comments
    if (char === "/" && i + 1 < text.length && text[i + 1] === "*") {
      i += 2;
      while (i + 1 < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++;
      i += 2;
      continue;
    }

    if (char === "{") depth++;
    if (char === "}") depth--;

    i++;
  }

  if (depth !== 0) return null;

  // Return content between the opening and closing braces (exclusive of closing brace)
  return text.substring(startIndex, i - 1);
}

/**
 * Compile parsed functions into ExpressionDef entries.
 *
 * All functions are compiled into a shared scope so they can call each other.
 * The `this` keyword inside function bodies refers to the expression context
 * (character/monster data), which is bound via `.call(context)` on the
 * enclosing factory function. Arrow functions are used to ensure `this`
 * propagates from the factory scope.
 *
 * Built-in helpers (like D20 for dice) can be injected via the helpers parameter.
 */
export function compileFunctionExpressions(
  functions: ParsedFunction[],
  helpers?: Record<string, Function>,
): Map<string, ExpressionDef> {
  const expressionMap = new Map<string, ExpressionDef>();

  if (functions.length === 0) return expressionMap;

  // Build the factory function body
  // Each user function becomes a const arrow function
  // Arrow functions inherit `this` from the enclosing scope (the factory)
  // All functions share the same closure, so they can call each other
  const helperNames = helpers ? Object.keys(helpers) : [];
  const helperDestructure = helperNames.length > 0
    ? `const { ${helperNames.join(", ")} } = __helpers;\n`
    : "";

  const functionDefs = functions.map((fn) => {
    const asyncPrefix = fn.isAsync ? "async " : "";
    const paramList = fn.params.join(", ");
    return `const ${fn.name} = ${asyncPrefix}(${paramList}) => {\n${fn.body}\n};`;
  }).join("\n\n");

  const returnObj = `{ ${functions.map((f) => f.name).join(", ")} }`;

  const factoryBody = `${helperDestructure}${functionDefs}\nreturn ${returnObj};`;

  // Create the factory function
  // When called with .call(context, helpers), `this` inside = context
  // Arrow functions inherit this `this`, so user code can use `this.level` etc.
  let factory: Function;
  try {
    factory = new Function("__helpers", factoryBody);
  } catch (error) {
    console.error("Failed to compile function expressions:", error);
    return expressionMap;
  }

  // For each function, create an ExpressionDef
  for (const fn of functions) {
    const expressionDef: ExpressionDef = {
      id: fn.name,
      params: fn.params,
      formula: buildFormulaDisplay(fn),
      ...(fn.isAsync ? { isAsync: true } : {}),
      body: fn.body,
      evaluate: createEvaluator(factory, fn.name, fn.params, fn.isAsync, helpers),
    };

    expressionMap.set(fn.name, expressionDef);
  }

  return expressionMap;
}

/**
 * Build a display-friendly formula string from a parsed function.
 */
function buildFormulaDisplay(fn: ParsedFunction): string {
  const asyncPrefix = fn.isAsync ? "async " : "";
  const thisParam = fn.usesContext ? "this" : "";
  const otherParams = fn.params.join(", ");
  const allParams = [thisParam, otherParams].filter(Boolean).join(", ");
  return `${asyncPrefix}function ${fn.name}(${allParams}) { ... }`;
}

/**
 * Create an evaluator function for a specific expression.
 *
 * The evaluator:
 * 1. Calls the factory with the context bound as `this`
 * 2. Gets the scope object with all compiled functions
 * 3. Calls the specific function with named arguments extracted from context
 *
 * The context object serves dual purposes:
 * - Bound as `this` so functions can access `this.level`, `this.attributes`, etc.
 * - Named keys matching function parameters are extracted as positional arguments
 *
 * Example:
 *   expr.evaluate({ ability: "dexterity", level: 5, attributes: { ... } })
 *   → function is called with ("dexterity") and `this` = full context
 */
function createEvaluator(
  factory: Function,
  funcName: string,
  funcParams: string[],
  isAsync: boolean,
  helpers?: Record<string, Function>,
): ExpressionDef["evaluate"] {
  return (context: Record<string, unknown>) => {
    try {
      // Build the scope with all functions, `this` = context
      const scope = factory.call(context, helpers || {});
      const fn = scope[funcName];

      if (typeof fn !== "function") {
        console.error(`Expression '${funcName}' is not a function after compilation`);
        return 0;
      }

      // Extract arguments by matching parameter names to context keys
      const args = funcParams.map((param) => context[param]);

      return fn(...args);
    } catch (error) {
      console.error(`Failed to evaluate expression '${funcName}':`, error);
      return 0;
    }
  };
}

/**
 * Parse and compile function expressions from a code block source.
 * This is the main entry point combining parsing and compilation.
 */
export function parseFunctionExpressions(
  source: string,
  helpers?: Record<string, Function>,
): Map<string, ExpressionDef> {
  const functions = parseFunctionBlock(source);
  return compileFunctionExpressions(functions, helpers);
}
