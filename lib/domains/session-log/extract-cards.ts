import { readModifiers } from "./modifiers";
import { parseMoveGrant } from "lib/domains/battlemap/movement-rules";
import { FeatureAspect, FeatureDetails, ResourceDecl } from "../features/types";
import {
  ASPECT_BUCKETS,
  AspectBucket,
  BUCKET_LABELS,
  CARD_BUCKETS,
  CardStack,
  DEFAULT_LOG_TEMPLATE,
  SessionFeatureCard,
} from "./card-types";

export interface ResolvedSourceSlice {
  source: string;
  /** Its kind — class, subclass, lineage, heritage, background, talent, item. */
  kind?: string;
  level?: number;
  features: FeatureDetails[];
}

export function resolveMaxCount(max: FeatureAspect["max"], characterLevel?: number): number | undefined {
  if (max == null) return undefined;
  if (typeof max === "number") return max;
  if (typeof max === "string") {
    const n = Number(max);
    return Number.isFinite(n) ? n : undefined;
  }
  const entries = Object.entries(max)
    .map(([lv, n]) => [Number(lv), n] as const)
    .sort((a, b) => a[0] - b[0]);
  if (entries.length === 0) return undefined;
  if (characterLevel == null) return entries[entries.length - 1][1];
  let chosen: number | undefined;
  for (const [lv, n] of entries) {
    if (lv <= characterLevel) chosen = n;
    else break;
  }
  return chosen;
}

/** `[[Weapon Option]]` (or YAML's nested-array reading of it) → `Weapon Option`. */
function linkName(item: unknown): string | undefined {
  let v = item;
  while (Array.isArray(v) && v.length === 1) v = v[0];
  if (typeof v !== "string") return undefined;
  const m = v.match(/^\[\[([^\]|#]+)(?:[^\]]*)\]\]$/) ?? v.match(/^([^[\]]+)$/);
  return Array.isArray(item) || /^\[\[/.test(v) ? m?.[1]?.trim() : undefined;
}

function buildCardId(source: string, featureName: string, bucket: string): string {
  return `${source}:${featureName}:${bucket}`;
}

function extractAspectCard(
  feature: FeatureDetails,
  aspect: FeatureAspect,
  bucket: AspectBucket,
  source: string,
  actor: string,
  characterLevel?: number,
  /** The note it names, when the aspect is a `[[link]]` — where it's described. */
  link?: string,
  sourceKind?: string
): SessionFeatureCard {
  const name = aspect.name || feature.name;
  const logTemplate = aspect.log || DEFAULT_LOG_TEMPLATE;
  const resourceRef = aspect.resource || feature.uses_resource;
  const max = aspect.max ?? feature.max;
  const maxUses = resolveMaxCount(max, characterLevel);
  const recovery = aspect.recovery || feature.recovery;
  const recharge = aspect.recharge;

  return {
    id: buildCardId(source, name, bucket),
    name,
    bucket,
    logTemplate,
    text: aspect.text || feature.text,
    resourceRef,
    maxUses,
    // A count only the character's sheet knows (`PB`), for it to resolve.
    ...(maxUses == null && typeof max === "string" ? { maxExpr: max } : {}),
    recovery,
    recharge,
    source,
    ...(sourceKind ? { sourceKind } : {}),
    actor,
    ...(link ? { link } : {}),
    ...(aspect.rider ? { ridesWith: aspect.rider } : {}),
    // What it does to other cards, and that an active switches on and off.
    ...(readModifiers(aspect.modifies).length > 0 ? { modifies: readModifiers(aspect.modifies) } : {}),
    ...(bucket === "active" && (aspect.toggle || readModifiers(aspect.modifies).length > 0) ? { toggle: true } : {}),
    // A move its text grants ("…you move up to half your speed").
    ...(parseMoveGrant(name, aspect.text || feature.text)
      ? { grantsMove: parseMoveGrant(name, aspect.text || feature.text) }
      : {}),
  };
}

export function extractCards(sources: ResolvedSourceSlice[], actor: string): SessionFeatureCard[] {
  const cards: SessionFeatureCard[] = [];

  for (const src of sources) {
    for (const feature of src.features) {
      for (const bucket of ASPECT_BUCKETS) {
        const aspect = feature[bucket];
        if (!aspect) continue;
        // A list — Martial Action's martial actions — is a card each: a named
        // aspect as itself, a `[[link]]` as the note it names (Weapon Option).
        for (const item of Array.isArray(aspect) ? aspect : [aspect]) {
          const linked = linkName(item);
          if (linked) {
            cards.push(
              extractAspectCard(feature, { name: linked }, bucket, src.source, actor, src.level, linked, src.kind)
            );
          } else if (item && typeof item === "object" && !Array.isArray(item)) {
            cards.push(
              extractAspectCard(
                feature,
                item as FeatureAspect,
                bucket,
                src.source,
                actor,
                src.level,
                undefined,
                src.kind
              )
            );
          }
        }
      }

      if (
        !ASPECT_BUCKETS.some((b) => feature[b]) &&
        feature.type &&
        ASPECT_BUCKETS.includes(feature.type as AspectBucket)
      ) {
        const bucket = feature.type as AspectBucket;
        const syntheticAspect: FeatureAspect = {
          name: feature.name,
          text: feature.text,
          resource: feature.uses_resource,
          max: feature.max,
          recovery: feature.recovery,
        };
        cards.push(extractAspectCard(feature, syntheticAspect, bucket, src.source, actor, src.level));
      }
    }
  }

  return cards;
}

/**
 * Extract the unified resource declarations a character's features grant, so a
 * lonelog PC op (`[Talon/Mystic Mark-1]`) resolves against the sheet-declared
 * bounds/default. Two sources per feature:
 *   - the new `resources:` list (shared lonelog vocabulary), passed through; and
 *   - the legacy `type: resource` + `max`/`recovery` form, mapped to a `charges`
 *     resource (its `max` resolved for the character's level).
 * Pure; the loader supplies already-resolved feature slices.
 */
export function extractResourceDecls(sources: ResolvedSourceSlice[]): ResourceDecl[] {
  const out: ResourceDecl[] = [];
  for (const src of sources) {
    for (const feature of src.features) {
      for (const r of feature.resources ?? []) out.push(r);
      if (feature.type === "resource") {
        const max = resolveMaxCount(feature.max, src.level);
        if (max != null) out.push({ charges: { name: feature.name, max, recovery: feature.recovery } });
      }
    }
  }
  return out;
}

/** How many cards a stack holds before it's split — a hand you can still read. */
export const STACK_LIMIT = 8;

/**
 * An actor's cards in stacks, one per kind of action (Attack, Action, Bonus
 * Action, …). A stack grown past {@link STACK_LIMIT} is split: its spells go to
 * a stack of their own (`Action · Spells`), beside the rest — features,
 * weapons, the basic actions.
 */
export function buildCardStacks(cards: SessionFeatureCard[], actor: string): CardStack[] {
  const stacks: CardStack[] = [];

  for (const bucket of CARD_BUCKETS) {
    const bucketCards = cards.filter((c) => c.bucket === bucket);
    if (bucketCards.length === 0) continue;
    const spells = bucketCards.filter((c) => c.origin === "spell");
    const rest = bucketCards.filter((c) => c.origin !== "spell");
    if (bucketCards.length > STACK_LIMIT && spells.length > 0 && rest.length > 0) {
      stacks.push({ actor, actorType: "pc", bucket, label: BUCKET_LABELS[bucket], cards: rest });
      stacks.push({
        actor,
        actorType: "pc",
        bucket: `${bucket}:spells`,
        label: `${BUCKET_LABELS[bucket]} · Spells`,
        cards: spells,
      });
      continue;
    }
    stacks.push({
      actor,
      actorType: "pc",
      bucket,
      label: BUCKET_LABELS[bucket],
      cards: bucketCards,
    });
  }

  return stacks;
}
