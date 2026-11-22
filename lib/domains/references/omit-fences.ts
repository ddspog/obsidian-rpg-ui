/**
 * `.omit(<id>)` on an embed call (`@[[traits/lineages/]].omit(npc).tab()`): the
 * `rpg` blocks of each embedded note whose YAML has that `id:` are left out, so
 * one record can hold parts a list does not show (a lineage note's NPC block).
 * Pure: no Obsidian.
 */

/** The ids a call's chain omits: `.omit(npc)`, `.omit(npc, gm)`. */
export function omittedIds(chain: Array<{ fn: string; args: unknown[] }>): string[] {
  return chain.filter((s) => s.fn === "omit").flatMap((s) => s.args.map((a) => String(a).trim()).filter(Boolean));
}

const FENCE = /^(`{3,})\s*rpg\s+[^\n]*\n([\s\S]*?)\n\1[ \t]*(?:\n|$)/gm;

/** The text without the `rpg` blocks whose `id:` is one of `ids`. */
export function omitFences(text: string, ids: string[]): string {
  if (!ids.length) return text;
  const wanted = new Set(ids);
  return text.replace(FENCE, (whole, _ticks: string, body: string) => {
    const yaml = body.split(/\n---\s*(?:\n|$)/)[0];
    const id = yaml.match(/^id:\s*["']?([^"'\n]+?)["']?\s*$/m)?.[1];
    return id && wanted.has(id) ? "" : whole;
  });
}
