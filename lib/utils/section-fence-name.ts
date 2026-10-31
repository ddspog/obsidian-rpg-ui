/**
 * Recover the `<name>` of an `rpg <kind>.<name>` fence from the section text
 * Obsidian hands a code block processor.
 *
 * `getSectionInfo(el).text` is the WHOLE note; only `lineStart`..`lineEnd`
 * belong to this block. Scanning the whole note named every block after the
 * first one in it, so blocks sharing state keyed by name (a table's roll
 * results) shared it.
 */

export interface SectionInfoLike {
  text: string;
  lineStart: number;
  lineEnd: number;
}

export function fenceNameFromSection(info: SectionInfoLike | null | undefined, kind: string): string {
  if (!info) return "";
  const re = new RegExp(`^\`\`\`rpg\\s+${kind}\\.([A-Za-z0-9_-]+)`);
  const lines = info.text.split("\n").slice(info.lineStart, info.lineEnd + 1);
  for (const line of lines) {
    const m = line.match(re);
    if (m) return m[1];
  }
  return "";
}

/** Small stable string hash (djb2) — identifies a block by its source text. */
export function hashSource(source: string): string {
  let h = 5381;
  for (let i = 0; i < source.length; i++) h = ((h << 5) + h + source.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
