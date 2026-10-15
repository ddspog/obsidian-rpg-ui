/**
 * What an action is, as the creature taking it has it — the text a log's
 * `@[[Kobold, Elite]].action("Mining Pick")` shows on hover.
 *
 * Read from the actor's own page: a statblock's feature, its text filled with
 * that creature's numbers ("+5 to hit, 6 (1d6 + 3) piercing"); or, for anyone
 * else, the action its system offers in a session (a sheet's weapon roll, a
 * basic action) — its numbers, then the note that describes it.
 */

import { parseYaml, TFile, type App } from "obsidian";
import { EntityResolver } from "./entity-resolver";
import { buildEntityContext, entityTypeOf } from "./entity-context";
import { SystemRegistry } from "lib/systems/registry";
import { resolveStatFeatures } from "lib/domains/statblocks/resolve-features";
import type { StatFeatureRef } from "lib/domains/statblocks/types";
import { splitFenceBody } from "lib/utils/fence-split";
import type { SessionAction } from "lib/domains/session-log/session-actions";
import { extractCardsFromEntity } from "./session-feature-loader";

const appOf = (): App | undefined => (globalThis as unknown as { app?: App }).app;

let resolver: EntityResolver | null = null;
const cache = new Map<string, Promise<string | null>>();

/** A name compared loosely: case, and a trailing `(Recharge 5-6)`, aside. */
const loose = (name: string) =>
  name
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim()
    .toLowerCase();
const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase() || loose(a) === loose(b);

/**
 * The prose a note gives — a feature fence's body when it has one, else its
 * text. A section names a heading, or a feature among the note's fences
 * (`Ranger#Mystic Mark`: the fence whose `name:` is Mystic Mark).
 */
function noteText(content: string, section?: string): string {
  let text = content.replace(/^---\n[\s\S]*?\n---\n/, "");
  if (section) {
    const named = [...text.matchAll(/```rpg feature\.details\n([\s\S]*?)\n---\n([\s\S]*?)\n```/g)].find((m) => {
      const name = m[1].match(/^name:\s*["']?(.+?)["']?\s*$/m)?.[1];
      return !!name && sameName(name, section);
    });
    if (named) return named[2].trim();
    const at = text.search(new RegExp(`^#+\\s+${section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "mi"));
    if (at >= 0) {
      const rest = text.slice(at).split("\n").slice(1).join("\n");
      const next = rest.search(/^#+\s/m);
      text = next >= 0 ? rest.slice(0, next) : rest;
    }
  }
  const fence = text.match(/```rpg feature\.details\n[\s\S]*?\n---\n([\s\S]*?)\n```/);
  if (fence) return fence[1].trim();
  return text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^#+\s.*$/gm, "")
    .trim();
}

/** `{{ leveled: { 1: 1d4, 6: 1d6, 13: 1d8 } }}` as it stands at a level: `1d4` at 1st. */
export function atLevel(text: string, level: number): string {
  return text.replace(/\{\{\s*leveled:\s*\{([^}]*)\}\s*\}\}/g, (whole, body: string) => {
    const steps = [...body.matchAll(/(\d+)\s*:\s*([^,]+)/g)]
      .map((m) => [Number(m[1]), m[2].trim()] as const)
      .sort((a, b) => a[0] - b[0]);
    const at = steps.filter(([lv]) => lv <= level).pop() ?? steps[0];
    return at ? at[1] : whole;
  });
}

/** The numbers an action rolls with, as a line: `+6 to hit · 1d6+4 piercing · range 80/320`. */
function numbers(a: SessionAction): string {
  return [
    a.hit ? `**${/^[+-]/.test(a.hit) ? a.hit : `+${a.hit}`}** to hit` : "",
    a.save ? `**${a.save}** save` : "",
    a.damage ? `**${a.damage}**` : "",
    a.range ? a.range : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

async function describe(app: App, page: string, name: string, sourcePath: string): Promise<string | null> {
  const file = app.metadataCache.getFirstLinkpathDest(page, sourcePath);
  if (!(file instanceof TFile)) return null;
  resolver ??= new EntityResolver(app);
  const entity = await resolver.resolveEntity({ file: file.path });

  // A statblock's own feature, filled with its numbers.
  const raw = entity.codeBlocks.get("stat.monster")?.[0];
  if (raw) {
    const monster = (parseYaml(splitFenceBody(raw).yaml) ?? {}) as Record<string, unknown>;
    const refs = Array.isArray(monster.features) ? (monster.features as StatFeatureRef[]) : [];
    const feature = (await resolveStatFeatures(refs, file.path, monster)).find((f) => f.name && sameName(f.name, name));
    if (feature?.text) return `**${feature.name}.** ${feature.text}`;
  }

  // What its system offers in a session: its numbers, then its note.
  const system = SystemRegistry.getInstance().getSystemForFile(file.path);
  const type = entityTypeOf(system, entity.codeBlocks);
  if (!type) return null;
  const actions = buildEntityContext(
    system,
    type,
    entity.codeBlocks,
    entity.frontmatter as Record<string, unknown>
  ).expressions.SessionActions?.() as SessionAction[] | undefined;
  const action = (Array.isArray(actions) ? actions : []).find((a) => sameName(a.name, name));
  const level = Number(
    (
      buildEntityContext(system, type, entity.codeBlocks, entity.frontmatter as Record<string, unknown>)
        .expressions as Record<string, ((...a: unknown[]) => unknown) | undefined>
    ).CharacterLevel?.()
  );
  const lv = Number.isFinite(level) ? level : 1;
  if (!action) {
    // A feature with nothing to roll (Wind Up, a martial action): its own text,
    // or the note it names (Weapon Option).
    const card = extractCardsFromEntity(entity).find((c) => sameName(c.name, name));
    if (!card) return null;
    let text = card.text ?? "";
    if (card.link) {
      const note = app.metadataCache.getFirstLinkpathDest(card.link, file.path);
      if (note instanceof TFile) text = noteText(await app.vault.cachedRead(note)) || text;
    }
    return [`**${card.name}.**`, atLevel(text, lv)].filter(Boolean).join(" ");
  }
  const parts = [`**${action.name}.**`, numbers(action)].filter(Boolean).join(" ");
  let described = action.summary ?? "";
  if (action.link) {
    const [notePath, section] = action.link.split("#");
    const note = app.metadataCache.getFirstLinkpathDest(notePath, file.path);
    if (note instanceof TFile) described = noteText(await app.vault.cachedRead(note), section) || described;
  }
  // A value that grows with level (`{{ leveled: { 1: 1d4, 6: 1d6 } }}`), as it is for them now.
  described = atLevel(described, lv);
  return [parts, described].filter(Boolean).join("\n\n");
}

/**
 * The description of an action, as the creature on `page` has it — markdown,
 * or null when the page names no such action.
 */
export function describeAction(page: string, name: string, sourcePath: string): Promise<string | null> {
  const app = appOf();
  if (!app) return Promise.resolve(null);
  const file = app.metadataCache.getFirstLinkpathDest(page, sourcePath);
  const key = `${file instanceof TFile ? `${file.path}@${file.stat.mtime}` : page}\u0000${name}`;
  let found = cache.get(key);
  if (!found) {
    found = describe(app, page, name, sourcePath).catch(() => null);
    cache.set(key, found);
  }
  return found;
}
