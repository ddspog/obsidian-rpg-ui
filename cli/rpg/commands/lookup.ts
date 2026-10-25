/**
 * `rpg lookup <note>` — a compendium note as the plugin reads it: its
 * frontmatter, its `rpg` blocks (statblocks, items, features, spells) as data,
 * and its prose. `rpg search <words>` finds notes by name.
 */

import { parse as parseYaml } from "yaml";
import type { Ctx } from "../app";

export interface LookupResult {
  note: string;
  frontmatter?: Record<string, unknown>;
  blocks: Array<{ meta: string; data: unknown; text?: string }>;
  prose: string;
}

const FENCE = /^(`{3,})\s*rpg\s+([\w.-]+)[^\n]*\n(?:([\s\S]*?)\n)??\1\s*$/gm;

export function lookupNote(ctx: Ctx, ref: string, full = false): LookupResult {
  const file = ctx.note(ref);
  const raw = ctx.vault.readSync(file).replace(/^---\n[\s\S]*?\n---\n?/, "");
  const blocks: LookupResult["blocks"] = [];
  for (const m of raw.matchAll(FENCE)) {
    const body = m[3] ?? "";
    const sep = body.split("\n").findIndex((l) => l.trim() === "---");
    const yaml = sep >= 0 ? body.split("\n").slice(0, sep).join("\n") : body;
    const text =
      sep >= 0
        ? body
            .split("\n")
            .slice(sep + 1)
            .join("\n")
            .trim()
        : undefined;
    let data: unknown = yaml;
    try {
      data = parseYaml(yaml) ?? {};
    } catch {
      data = yaml;
    }
    blocks.push({ meta: m[2], data, ...(text ? { text } : {}) });
  }
  let prose = raw
    .replace(FENCE, "")
    .replace(/!\[\[[^\]]*\]\]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!full && prose.length > 6000) prose = `${prose.slice(0, 6000)} … (more with --full)`;
  return { note: file.path, frontmatter: ctx.metadataCache.frontmatterOf(file), blocks, prose };
}

export function renderLookup(r: LookupResult): string {
  const out: string[] = [`# ${r.note.split("/").pop()?.replace(/\.md$/, "")}`, `(${r.note})`, ""];
  if (r.frontmatter && Object.keys(r.frontmatter).length)
    out.push("## Frontmatter", "```yaml", JSON.stringify(r.frontmatter, null, 1), "```", "");
  for (const b of r.blocks) {
    out.push(`## rpg ${b.meta}`, "```json", JSON.stringify(b.data, null, 1), "```");
    if (b.text) out.push(b.text);
    out.push("");
  }
  if (r.prose) out.push("## Text", r.prose);
  return out.join("\n");
}

export function searchNotes(ctx: Ctx, words: string): string[] {
  const parts = words.toLowerCase().split(/\s+/).filter(Boolean);
  return ctx.vault
    .getMarkdownFiles()
    .filter((f) => parts.every((p) => f.path.toLowerCase().includes(p)))
    .map((f) => f.path)
    .sort((a, b) => a.length - b.length)
    .slice(0, 50);
}
