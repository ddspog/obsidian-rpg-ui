/**
 * A note's `rpg <entity>.<block>` fences, as the plugin's entity resolver
 * collects them (`character.stats` → its bodies, in order).
 */

// The body is optional: an empty block (`rpg character.skills` then its close) must not run on into the next one.
const FENCE = /^(`{3,})\s*rpg\s+([A-Za-z_][\w-]*\.[A-Za-z_][\w-]*)[^\n]*\n(?:([\s\S]*?)\n)??\1\s*$/gm;

export function codeBlocksOf(text: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const m of text.matchAll(FENCE)) out.set(m[2], [...(out.get(m[2]) ?? []), m[3] ?? ""]);
  return out;
}

/** Every `rpg <meta>` fence (any meta, `log` and `map` too), with its body. */
export function fencesOf(text: string, meta: string): string[] {
  const re = new RegExp(
    `^(\`{3,})\\s*rpg\\s+${meta.replace(/\./g, "\\.")}\\b[^\\n]*\\n(?:([\\s\\S]*?)\\n)??\\1\\s*$`,
    "gm"
  );
  return [...text.matchAll(re)].map((m) => m[2] ?? "");
}
