/**
 * Dice Expression Parser
 * Extracts structured data from dice notation strings (Lonelog Dice Notation Add-on v1.0.0)
 * Does NOT evaluate/roll — only parses for display and annotation purposes.
 */

export interface ParsedDiceExpression {
  label?: string;
  expression: string;
  total?: number;
  breakdown?: string;
  description?: string;
}

export interface ParsedRollField {
  expressions: ParsedDiceExpression[];
  vsTarget?: string;
  outcome?: string;
}

export function parseRollField(rollText: string): ParsedRollField {
  const result: ParsedRollField = { expressions: [] };

  // Split on -> to separate roll from outcome
  const arrowParts = rollText.split("->").map((p) => p.trim());
  const beforeArrow = arrowParts[0];
  result.outcome = arrowParts.length > 1 ? arrowParts.slice(1).join("->").trim() : undefined;

  // Handle "vs" target (e.g., "vs DC 15", "vs AC 12")
  const vsParts = beforeArrow.split(/\s+vs\s+/i);
  if (vsParts.length > 1) {
    result.vsTarget = vsParts.slice(1).join(" vs ");
  }
  const expressionPart = vsParts[0];

  // Split comma-separated expressions (e.g., "4d6dl1 // STR=14, 4d6dl1 // DEX=12")
  // Only split on commas that are followed by dice-like patterns
  const exprSegments = expressionPart.split(/,\s*(?=\S*\d*d[\d%F])/i);

  for (const segment of exprSegments) {
    result.expressions.push(parseSingleExpression(segment.trim()));
  }

  return result;
}

function parseSingleExpression(text: string): ParsedDiceExpression {
  const expr: ParsedDiceExpression = { expression: text };

  let working = text;

  // Extract inline description first: "// label" or "# label" (before the =N)
  const descMatch = working.match(/\s*(?:\/\/|#)\s*(.+)$/);
  if (descMatch) {
    const descContent = descMatch[1].trim();
    working = working.slice(0, working.length - descMatch[0].length);

    // The description might contain =N at the end for the total
    const descTotal = descContent.match(/^(.+?)=(\d+)\s*$/);
    if (descTotal) {
      expr.description = descTotal[1].trim();
      expr.total = parseInt(descTotal[2], 10);
    } else {
      expr.description = descContent;
    }
  }

  // Extract total: "=14" or " =14" (space before = for exploding dice)
  if (expr.total == null) {
    const totalMatch = working.match(/\s*=(\d+)\s*$/);
    if (totalMatch) {
      expr.total = parseInt(totalMatch[1], 10);
      working = working.slice(0, working.length - totalMatch[0].length);
    }
  }

  // Extract breakdown: "[4, 3, 6!, 2d]"
  const breakdownMatch = working.match(/\[([^\]]+)\]/);
  if (breakdownMatch) {
    expr.breakdown = breakdownMatch[1];
    working = working.replace(breakdownMatch[0], "").replace(/\s{2,}/g, " ").trim();
  }

  // Extract leading label (capitalized word(s) before dice notation)
  const labelMatch = working.match(/^([A-Z][A-Za-z\s]*?)\s+(\d*d[\d%F])/i);
  if (labelMatch && labelMatch[1].length > 0) {
    expr.label = labelMatch[1].trim();
    working = working.slice(labelMatch[1].length).trim();
  }

  expr.expression = working.trim();
  return expr;
}

export function isDiceExpression(text: string): boolean {
  return /\d*d[\d%F]/i.test(text);
}

export function highlightDiceNotation(expression: string): { text: string; type: "dice" | "modifier" | "operator" | "number" | "text" }[] {
  const tokens: { text: string; type: "dice" | "modifier" | "operator" | "number" | "text" }[] = [];
  const re = /(\d*d(?:\d+|%|F(?:\.\d)?))|(!{1,2}p?|kh\d*|kl\d*|dl\d*|dh\d*|ro?|uo?|min\d+|max\d+|s[ad]?|cs|cf)|([+\-*/^%])|(\d+)|([^\s]+)/gi;

  let match;
  while ((match = re.exec(expression)) !== null) {
    if (match[1]) tokens.push({ text: match[1], type: "dice" });
    else if (match[2]) tokens.push({ text: match[2], type: "modifier" });
    else if (match[3]) tokens.push({ text: match[3], type: "operator" });
    else if (match[4]) tokens.push({ text: match[4], type: "number" });
    else if (match[5]) tokens.push({ text: match[5], type: "text" });
  }

  return tokens;
}
