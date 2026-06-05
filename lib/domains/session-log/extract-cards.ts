import { FeatureAspect, FeatureDetails } from "../features/types";
import {
  ASPECT_BUCKETS,
  AspectBucket,
  BUCKET_LABELS,
  CardStack,
  DEFAULT_LOG_TEMPLATE,
  SessionFeatureCard,
} from "./card-types";

export interface ResolvedSourceSlice {
  source: string;
  level?: number;
  features: FeatureDetails[];
}

export function resolveMaxCount(
  max: FeatureAspect["max"],
  characterLevel?: number,
): number | undefined {
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
    recovery,
    recharge,
    source,
    actor,
  };
}

export function extractCards(
  sources: ResolvedSourceSlice[],
  actor: string,
): SessionFeatureCard[] {
  const cards: SessionFeatureCard[] = [];

  for (const src of sources) {
    for (const feature of src.features) {
      for (const bucket of ASPECT_BUCKETS) {
        const aspect = feature[bucket];
        if (!aspect) continue;
        cards.push(
          extractAspectCard(feature, aspect, bucket, src.source, actor, src.level),
        );
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
        cards.push(
          extractAspectCard(feature, syntheticAspect, bucket, src.source, actor, src.level),
        );
      }
    }
  }

  return cards;
}

export function buildCardStacks(cards: SessionFeatureCard[], actor: string): CardStack[] {
  const stacks: CardStack[] = [];

  for (const bucket of ASPECT_BUCKETS) {
    const bucketCards = cards.filter((c) => c.bucket === bucket);
    if (bucketCards.length === 0) continue;
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
