/**
 * A note that opens on its one `rpg` block (a statblock, say), with at most a
 * title heading before it: the block names itself, so the plugin hides the
 * title. Lore after the block is fine; an introduction before it, or a second
 * `rpg` block anywhere, and the title stays. Pure.
 */

export interface SingleBlock {
  single: boolean;
  /** The block's kind (`stat.monster`), when single. */
  meta?: string;
  /** The heading before the block, as written (without the `#`s), when there is one. */
  heading?: string;
}

/** Whether a note's text is a title heading (optional), then its only `rpg` block, then anything but another. */
export function singleBlockNote(text: string): SingleBlock {
  const body = text.replace(/^---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/, "");
  const lines = body.split(/\r?\n/);
  let i = 0;
  const skipBlank = () => {
    while (i < lines.length && lines[i].trim() === "") i++;
  };
  skipBlank();
  let heading: string | undefined;
  const h = /^#{1,6}\s+(.+?)\s*#*\s*$/.exec(lines[i] ?? "");
  if (h) {
    heading = h[1];
    i++;
    skipBlank();
  }
  const open = /^(`{3,}|~{3,})\s*rpg\b\s*([\w.-]*)/.exec(lines[i] ?? "");
  if (!open) return { single: false };
  const fence = open[1];
  i++;
  while (i < lines.length && !(lines[i].startsWith(fence[0].repeat(fence.length)) && lines[i].trim().replace(/[`~]/g, "") === "")) i++;
  if (i >= lines.length) return { single: false };
  i++;
  const another = lines.slice(i).some((l) => /^(`{3,}|~{3,})\s*rpg\b/.test(l));
  if (another) return { single: false };
  return { single: true, ...(open[2] ? { meta: open[2] } : {}), ...(heading ? { heading } : {}) };
}

/** Blocks that print their own name at their top (statblocks, items, spells, features): a title over them repeats it. */
export function namesItself(meta: string | undefined): boolean {
  return !!meta && /^(stat|item|spell|feature)\b/.test(meta);
}
