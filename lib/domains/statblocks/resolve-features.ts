import { parse as parseYAML } from "yaml";
import type { ResolvedStatFeature, StatFeatureRef } from "./types";

interface FeatureDetailsBody {
  id?: string;
  name?: string;
  type?: string;
  text?: string;
  tiers?: Record<string, Record<string, unknown>>;
}

function parseFeatureDetailsBlock(raw: string): FeatureDetailsBody | null {
  const sepIdx = raw.indexOf("\n---\n");
  const sepEnd = raw.indexOf("\n---");
  const effectiveSep =
    sepIdx >= 0 ? sepIdx : sepEnd >= 0 && sepEnd + 4 >= raw.length ? sepEnd : -1;

  let yamlText: string;
  let bodyText: string | undefined;
  if (effectiveSep >= 0) {
    yamlText = raw.slice(0, effectiveSep);
    bodyText = raw.slice(effectiveSep + 4).replace(/^\n+/, "").replace(/\n+$/, "") || undefined;
  } else {
    yamlText = raw;
  }

  try {
    const parsed = parseYAML(yamlText);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const obj = parsed as Record<string, unknown>;
    const result: FeatureDetailsBody = {};
    if (typeof obj.id === "string") result.id = obj.id;
    if (typeof obj.name === "string") result.name = obj.name;
    if (typeof obj.type === "string") result.type = obj.type;
    if (typeof obj.text === "string") result.text = obj.text;
    else if (bodyText) result.text = bodyText;
    if (obj.tiers && typeof obj.tiers === "object" && !Array.isArray(obj.tiers)) {
      result.tiers = obj.tiers as Record<string, Record<string, unknown>>;
    }
    return result;
  } catch {
    return null;
  }
}

function extractFirstFeatureDetails(contents: string): FeatureDetailsBody | null {
  const re = /```+\s*rpg\s+feature\.details\s*\n([\s\S]*?)```+/;
  const m = contents.match(re);
  if (!m) return null;
  return parseFeatureDetailsBlock(m[1]);
}

function extractFeatureByName(contents: string, blockName: string): FeatureDetailsBody | null {
  const re = /```+\s*rpg\s+feature\.details\s*\n([\s\S]*?)```+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(contents)) !== null) {
    const feature = parseFeatureDetailsBlock(m[1]);
    if (feature?.name === blockName || feature?.id === blockName) return feature;
  }
  return null;
}

/** Parse `@[[File]]#BlockName` or `@[[File]]` or `[[File#Heading]]` or `[[File]]`. */
function parseRef(ref: string): { file: string; blockName?: string } {
  const atRef = ref.match(/^@\[\[([^\]]+)\]\](?:#(.+))?$/);
  if (atRef) {
    return { file: atRef[1].split("|")[0].trim(), blockName: atRef[2]?.trim() };
  }
  const wikiRef = ref.match(/^\[\[([^\]]+)\]\]$/);
  if (wikiRef) {
    const inner = wikiRef[1].split("|")[0].trim();
    const hashIdx = inner.indexOf("#");
    if (hashIdx >= 0) {
      return { file: inner.slice(0, hashIdx).trim(), blockName: inner.slice(hashIdx + 1).trim() };
    }
    return { file: inner };
  }
  return { file: ref };
}

function substituteText(
  text: string,
  params: Record<string, unknown>,
  selfProps: Record<string, unknown>
): string {
  let result = text;
  // {{self.property}} — resolved from the caller stat block
  result = result.replace(/\{\{self\.(\w+)\}\}/g, (_, key) => {
    const val = selfProps[key];
    return val != null ? String(val) : "";
  });
  // {{param}} — resolved from passed params
  for (const [key, value] of Object.entries(params)) {
    if (key === "ref" || key === "tier") continue;
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), String(value));
  }
  return result;
}

export async function resolveStatFeatures(
  refs: StatFeatureRef[],
  sourcePath: string,
  selfPropsOrName?: Record<string, unknown> | string
): Promise<ResolvedStatFeature[]> {
  const selfProps: Record<string, unknown> =
    typeof selfPropsOrName === "string"
      ? { name: selfPropsOrName.toLowerCase() }
      : selfPropsOrName && typeof selfPropsOrName === "object"
        ? selfPropsOrName
        : {};
  const app = (
    globalThis as unknown as {
      app?: {
        metadataCache?: { getFirstLinkpathDest?: (path: string, source: string) => unknown };
        vault?: { cachedRead?: (file: unknown) => Promise<string> };
      };
    }
  ).app;
  if (!app?.metadataCache?.getFirstLinkpathDest || !app?.vault?.cachedRead) return [];

  const contentCache = new Map<string, string>();

  const results: ResolvedStatFeature[] = [];
  for (const ref of refs) {
    const { file: fileStem, blockName } = parseRef(ref.ref);
    const vaultFile = app.metadataCache.getFirstLinkpathDest(fileStem, sourcePath);
    if (!vaultFile) {
      results.push({ name: blockName ?? fileStem, text: "" });
      continue;
    }

    let content = contentCache.get(fileStem);
    if (content === undefined) {
      content = await app.vault.cachedRead(vaultFile);
      contentCache.set(fileStem, content);
    }

    const feature = blockName
      ? extractFeatureByName(content, blockName)
      : extractFirstFeatureDetails(content);

    if (!feature) {
      results.push({ name: blockName ?? fileStem, text: "" });
      continue;
    }

    // Merge tier values into params
    const tierKey = ref.tier != null ? String(ref.tier) : undefined;
    let mergedParams: Record<string, unknown> = { ...ref };
    if (tierKey && feature.tiers) {
      const tierValues = feature.tiers[tierKey];
      if (tierValues && typeof tierValues === "object") {
        mergedParams = { ...tierValues, ...ref };
      }
    }

    const text = substituteText(feature.text ?? "", mergedParams, selfProps);

    results.push({
      name: feature.name,
      type: feature.type,
      text,
    });
  }
  return results;
}
