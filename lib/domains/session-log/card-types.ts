export const ASPECT_BUCKETS = ["action", "bonus", "reaction", "active", "passive", "resource"] as const;

export type AspectBucket = (typeof ASPECT_BUCKETS)[number];

export interface SessionFeatureCard {
  id: string;
  name: string;
  bucket: AspectBucket;
  logTemplate: string;
  text?: string;
  resourceRef?: string;
  maxUses?: number;
  recovery?: string;
  recharge?: string;
  source: string;
  actor: string;
}

export interface CardStack {
  actor: string;
  actorType: "pc" | "gm";
  bucket: string;
  label: string;
  cards: SessionFeatureCard[];
}

export const DEFAULT_LOG_TEMPLATE = "@({{actor}}) uses {{name}}";

export const BUCKET_LABELS: Record<AspectBucket, string> = {
  action: "Action",
  bonus: "Bonus Action",
  reaction: "Reaction",
  active: "Active",
  passive: "Passive",
  resource: "Resource",
};
