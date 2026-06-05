import { parse as parseYaml } from "yaml";
import type { EntityData } from "./entity-resolver";
import type { CharacterDecl, CompendiumLib, ResolvedSource, ResolvedView } from "lib/domains/features/types";
import { resolveFeatures } from "lib/domains/features/resolver";
import { extractCards } from "lib/domains/session-log/extract-cards";
import type { SessionFeatureCard } from "lib/domains/session-log/card-types";
import type { AspectBucket } from "lib/domains/session-log/card-types";
import { DEFAULT_LOG_TEMPLATE } from "lib/domains/session-log/card-types";
import { SystemRegistry } from "lib/systems/registry";

interface HeaderBlock {
  classes?: Array<{ name: unknown; level: number; subclass?: unknown; sub?: unknown }>;
  lineage?: { file?: unknown };
  heritage?: { file?: unknown };
  background?: { file?: unknown };
}

function linkStem(raw: unknown): string | undefined {
  let v: unknown = raw;
  while (Array.isArray(v)) v = v[0];
  if (typeof v !== "string") return undefined;
  const stem = v
    .replace(/^\[\[/, "")
    .replace(/\]\]$/, "")
    .replace(/\.md$/, "")
    .split("|")[0]
    .trim();
  return stem || undefined;
}

function pillStem(p: { file?: unknown } | unknown): string | undefined {
  if (!p || typeof p !== "object") return undefined;
  const file = (p as { file?: unknown }).file;
  if (!file) return undefined;
  return linkStem(file);
}

function buildDeclFromHeader(
  header: HeaderBlock,
  featuresData: Record<string, unknown>,
): CharacterDecl {
  return {
    classes: (header.classes ?? []).map((c) => ({
      name: linkStem(c.name) ?? "",
      level: c.level,
      subclass: linkStem((c as any).sub) ?? linkStem(c.subclass),
    })),
    lineage: pillStem(header.lineage),
    heritage: pillStem(header.heritage),
    background: pillStem(header.background),
    choices: featuresData.choices as CharacterDecl["choices"],
    additional: featuresData.additional as CharacterDecl["additional"],
  };
}

function bareStem(ref: string): string {
  return ref.replace(/^\[\[/, "").replace(/\]\]$/, "").split("|")[0].trim();
}

function castingTimeBucket(casting: string | undefined): AspectBucket {
  if (!casting) return "action";
  const lower = casting.toLowerCase();
  if (lower.includes("bonus")) return "bonus";
  if (lower.includes("reaction")) return "reaction";
  return "action";
}

function extractSpellCards(
  resolved: ResolvedView,
  spellsYaml: Record<string, unknown> | undefined,
  spellLibrary: Record<string, Record<string, unknown>>,
  actorName: string,
): SessionFeatureCard[] {
  const cards: SessionFeatureCard[] = [];
  if (!resolved.casters || resolved.casters.length === 0) return cards;

  const casters = spellsYaml?.casters as Record<string, Record<string, unknown>> | undefined;

  for (const caster of resolved.casters) {
    const casterState = casters?.[caster.source] as Record<string, unknown> | undefined;

    const allSpellStems = new Set<string>();

    // Cantrips (granted + picked)
    for (const stems of Object.values(caster.granted.cantrips)) {
      for (const s of stems) allSpellStems.add(bareStem(s));
    }
    if (casterState?.cantrips && Array.isArray(casterState.cantrips)) {
      for (const s of casterState.cantrips) allSpellStems.add(bareStem(s));
    }

    // Prepared/known (granted + picked)
    for (const stems of Object.values(caster.granted.prepared)) {
      for (const s of stems) allSpellStems.add(bareStem(s));
    }
    const preparedOrKnown = casterState?.prepared ?? casterState?.known;
    if (preparedOrKnown && typeof preparedOrKnown === "object") {
      for (const refs of Object.values(preparedOrKnown as Record<string, unknown[]>)) {
        if (Array.isArray(refs)) {
          for (const s of refs) allSpellStems.add(bareStem(String(s)));
        }
      }
    }

    // Rituals (granted + picked)
    for (const stems of Object.values(caster.granted.rituals)) {
      for (const s of stems) allSpellStems.add(bareStem(s));
    }
    if (casterState?.rituals && typeof casterState.rituals === "object") {
      for (const refs of Object.values(casterState.rituals as Record<string, unknown[]>)) {
        if (Array.isArray(refs)) {
          for (const s of refs) allSpellStems.add(bareStem(String(s)));
        }
      }
    }

    for (const stem of allSpellStems) {
      const doc = spellLibrary[stem];
      const circle = doc?.circle as string | undefined;
      const isCantrip = circle?.toLowerCase() === "cantrip";
      const casting = doc?.casting as string | undefined;
      const bucket = castingTimeBucket(casting);
      const summary = doc?.summary as string | undefined;

      cards.push({
        id: `spell:${caster.source}:${stem}:${bucket}`,
        name: stem,
        bucket,
        logTemplate: `@({{actor}}) casts ${stem}` + (isCantrip ? "" : ` on {{target}}`),
        text: summary ?? (doc?.text as string | undefined),
        resourceRef: isCantrip ? undefined : `spell-slot-${circle}`,
        maxUses: undefined,
        recovery: isCantrip ? undefined : "long rest",
        recharge: undefined,
        source: caster.source,
        actor: actorName,
      });
    }
  }

  return cards;
}

export function extractCardsFromEntity(entity: EntityData): SessionFeatureCard[] {
  const name = entity.name;

  const featuresRaw = entity.codeBlocks.get("character.features")?.[0];

  if (!featuresRaw) return [];

  let featuresData: Record<string, unknown>;
  try {
    featuresData = parseYaml(featuresRaw) ?? {};
  } catch {
    return [];
  }

  // Inline sources format (session test characters)
  if (featuresData.sources && Array.isArray(featuresData.sources)) {
    const sources = (featuresData.sources as any[]).map((s) => ({
      source: s.source || s.name || "Unknown",
      level: s.level,
      features: s.features || [],
    }));
    return extractCards(sources, name);
  }

  // System-backed format (ToV adventurers) — resolve via compendium
  const headerRaw = entity.codeBlocks.get("character.header")?.[0];
  if (!headerRaw) return [];

  let header: HeaderBlock;
  try {
    header = parseYaml(headerRaw) ?? {};
  } catch {
    return [];
  }

  const registry = SystemRegistry.getInstance();
  const system = registry.getSystemForFile(entity.filePath);
  const characterEntity = system.entities?.character as any;
  const compendium: CompendiumLib | undefined = characterEntity?.lookup?.$compendium;

  if (!compendium) return [];

  const decl = buildDeclFromHeader(header, featuresData);

  try {
    const resolved = resolveFeatures(decl, compendium);
    const slices = resolved.sources.map((src: ResolvedSource) => ({
      source: src.source,
      level: src.level,
      features: src.features,
    }));
    const featureCards = extractCards(slices, name);

    // Extract spell cards
    const spellsRaw = entity.codeBlocks.get("character.spells")?.[0];
    let spellsYaml: Record<string, unknown> | undefined;
    if (spellsRaw) {
      try {
        spellsYaml = parseYaml(spellsRaw) ?? undefined;
      } catch { /* ignore */ }
    }
    const spellLibrary = characterEntity?.lookup?.$spells as Record<string, Record<string, unknown>> ?? {};
    const spellCards = extractSpellCards(resolved, spellsYaml, spellLibrary, name);

    return [...featureCards, ...spellCards];
  } catch (error) {
    console.error(`[session-log] Failed to resolve features for ${name}:`, error);
    return [];
  }
}

export function getEntitySpentState(entity: EntityData): Record<string, number> {
  const featuresRaw = entity.codeBlocks.get("character.features")?.[0];
  if (!featuresRaw) return {};

  try {
    const parsed = parseYaml(featuresRaw);
    return parsed?.spent || {};
  } catch {
    return {};
  }
}
