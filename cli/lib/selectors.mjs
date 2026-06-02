import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";

const DEFAULT_STRIP = [
  "-webkit-*",
  "animation-*",
  "transition-*",
  "font-family",
];

export function parseSelectorsFile(filePath) {
  const raw = readFileSync(filePath, "utf8");
  const lines = raw.split("\n");

  let header = {};
  let selectorLines = lines;

  const firstDash = lines.findIndex((l) => l.trim() === "---");
  if (firstDash !== -1) {
    const secondDash = lines.findIndex(
      (l, i) => i > firstDash && l.trim() === "---",
    );
    if (secondDash !== -1) {
      const yamlBlock = lines.slice(firstDash + 1, secondDash).join("\n");
      header = parseYaml(yamlBlock) || {};
      selectorLines = lines.slice(secondDash + 1);
    }
  }

  const selectors = selectorLines
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));

  const strip = header.strip || DEFAULT_STRIP;

  return { selectors, strip, description: header.description || "" };
}

export function shouldStripProperty(prop, stripPatterns) {
  for (const pattern of stripPatterns) {
    if (pattern.endsWith("*")) {
      const prefix = pattern.slice(0, -1);
      if (prop.startsWith(prefix)) return true;
    } else if (prop === pattern) {
      return true;
    }
  }
  return false;
}

export function isNoiseValue(value) {
  if (!value) return true;
  const noise = ["auto", "none", "normal", "inherit", "initial", "unset", ""];
  return noise.includes(value);
}

export { DEFAULT_STRIP };
