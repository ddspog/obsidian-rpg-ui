import { parse as parseYAML } from "yaml";
import type { AbilityScores, StatFeatureRef, StatVehicleData } from "./types";

function splitOnSeparator(raw: string): [string, string] {
  const lines = raw.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      return [lines.slice(0, i).join("\n"), lines.slice(i + 1).join("\n")];
    }
  }
  return [raw, ""];
}

function normalizeAbilities(raw: unknown): AbilityScores {
  const defaults: AbilityScores = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
  if (!raw || typeof raw !== "object") return defaults;
  const obj = raw as Record<string, unknown>;
  for (const key of Object.keys(defaults) as (keyof AbilityScores)[]) {
    const v = obj[key];
    if (typeof v === "number") defaults[key] = v;
    else if (typeof v === "string") {
      const n = parseInt(v, 10);
      if (Number.isFinite(n)) defaults[key] = n;
    }
  }
  return defaults;
}

function normalizeFeatures(raw: unknown): StatFeatureRef[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => {
    if (typeof entry === "string") return { ref: entry };
    if (entry && typeof entry === "object" && "ref" in entry) return entry as StatFeatureRef;
    // Handle YAML-parsed [[Name]] → nested array
    if (Array.isArray(entry) && entry.length === 1 && Array.isArray(entry[0])) {
      return { ref: `[[${entry[0][0]}]]` };
    }
    return null;
  }).filter((x): x is StatFeatureRef => x !== null);
}

function normalizeStats(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    out[key] = stringifyValue(value);
  }
  return out;
}

function stringifyValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  // YAML parses [[Name]] as nested array [["Name"]]
  if (Array.isArray(value)) {
    if (value.length === 1 && Array.isArray(value[0]) && value[0].length === 1 && typeof value[0][0] === "string") {
      return `[[${value[0][0]}]]`;
    }
    return value.map(stringifyValue).join(", ");
  }
  return String(value);
}

export function parseStatVehicleBlock(source: string): StatVehicleData {
  const [yamlText, bodyText] = splitOnSeparator(source);
  let parsed: Record<string, unknown> = {};
  if (yamlText.trim()) {
    try {
      const result = parseYAML(yamlText);
      if (result && typeof result === "object" && !Array.isArray(result)) {
        parsed = result as Record<string, unknown>;
      }
    } catch {
      // leave parsed empty
    }
  }

  return {
    name: typeof parsed.name === "string" ? parsed.name : "",
    size: typeof parsed.size === "string" ? parsed.size : "",
    type: typeof parsed.type === "string" ? parsed.type : "",
    dimensions: typeof parsed.dimensions === "string" ? parsed.dimensions : undefined,
    stats: normalizeStats(parsed.stats),
    abilities: normalizeAbilities(parsed.abilities),
    features: normalizeFeatures(parsed.features),
    text: bodyText.trim() || undefined,
    view: typeof parsed.view === "string" ? parsed.view : undefined,
  };
}
