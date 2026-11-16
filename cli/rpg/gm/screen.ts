/**
 * The session's GM Screen, loaded as the log block loads it: its features, the
 * step context their generators roll against, and its cards.
 */

import { buildGMStacksFromFeatures } from "lib/domains/session-log/gm-cards";
import type { GMFeature } from "lib/domains/features/types";
import type { GMStepContext } from "lib/domains/gm/example";
import { GMLoader } from "lib/services/gm-loader";
import type { Ctx } from "../app";
import type { TFile } from "../obsidian-node";

export interface ScreenCard {
  name: string;
  /** The stack (or group) it sits under in the drawer. */
  stack: string;
  summary?: string;
  template: string;
  kind?: string;
}

export interface Screen {
  note: string;
  features: GMFeature[];
  ctx: GMStepContext;
  cards: ScreenCard[];
}

interface Note {
  name: string;
  file: TFile;
}

/** The GM Screen a session names in `gm:` (or a GM Screen note itself). */
export async function loadScreen(ctx: Ctx, session: TFile): Promise<Screen | null> {
  const fm = ctx.metadataCache.frontmatterOf(session) ?? {};
  const ref = typeof fm.gm === "string" ? fm.gm : fm["gm-tools"] ? session.path : null;
  if (!ref) return null;
  const resolve = (r: string) =>
    ctx.vault.resolveLink(
      r
        .replace(/^@?\[\[|\]\]$/g, "")
        .split("|")[0]
        .split("#")[0]
        .trim(),
      session.path
    );
  const loader = new GMLoader<Note>({
    resolve: (r) => {
      const file = resolve(r);
      return file ? { name: file.basename, file } : null;
    },
    read: async (n) => ctx.vault.readSync(n.file),
    frontmatter: (n) => ctx.metadataCache.frontmatterOf(n.file) ?? undefined,
  });
  const file = resolve(ref);
  if (!file) return null;
  const features = await loader.loadGMScreen(ref);
  const stepCtx = await loader.loadStepCtx(features);
  const cards: ScreenCard[] = [];
  for (const stack of buildGMStacksFromFeatures(features))
    for (const card of stack.cards)
      cards.push({
        name: card.name,
        stack: stack.label ?? String(stack.bucket ?? ""),
        summary: card.summary,
        template: card.logTemplate,
        ...(card.kind ? { kind: card.kind } : {}),
      });
  return { note: file.path, features, ctx: stepCtx, cards };
}
