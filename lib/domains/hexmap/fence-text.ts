/**
 * Finding an `rpg map` block (or any `rpg <entity>` block) in its note by the
 * text Obsidian gave the renderer, and swapping that text: how paint mode
 * writes back. Pure, on the note's text. Fences inside callouts or quotes
 * (`> ```rpg map`) count too, their `> ` kept on every line.
 */

const openFor = (entity: string) =>
  new RegExp(`^((?:\\s*>)*\\s*)(\`{3,}|~{3,})\\s*rpg\\s+${entity.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b.*$`);

interface Fence {
  /** 0-based line of the opening fence and of the closing one. */
  open: number;
  close: number;
  /** What every line of the block starts with (`> ` in a callout). */
  prefix: string;
  body: string;
}

function strip(line: string, prefix: string): string {
  if (line.startsWith(prefix)) return line.slice(prefix.length);
  // A blank line inside a callout may have lost its trailing space.
  return line.trimEnd() === prefix.trimEnd() ? "" : line;
}

export function findMapFences(text: string): Fence[] {
  return findRpgFences(text, "map");
}

/** Every `rpg <entity>` block in a note's text, in order. */
export function findRpgFences(text: string, entity: string): Fence[] {
  const OPEN = openFor(entity);
  const lines = text.split("\n");
  const fences: Fence[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(OPEN);
    if (!m) continue;
    const quote = m[1].replace(/[^>]/g, "").length;
    const prefix = quote ? m[1].replace(/\s+$/, "") + " " : "";
    const marker = m[2];
    const close = new RegExp(`^\\s*${marker[0] === "`" ? "`" : "~"}{${marker.length},}\\s*$`);
    let j = i + 1;
    while (j < lines.length && !close.test(strip(lines[j], prefix))) j++;
    if (j >= lines.length) break;
    const body = lines
      .slice(i + 1, j)
      .map((l) => strip(l, prefix))
      .join("\n");
    fences.push({ open: i, close: j, prefix: quote ? prefix : m[1], body });
    i = j;
  }
  return fences;
}

const same = (a: string, b: string) => a.replace(/\s+$/, "") === b.replace(/\s+$/, "");

/** The note with the map block whose text is `oldBody` now holding `newBody`;
 *  null when no block has that text. Several with the same text: the one
 *  nearest `hintLine` (0-based), else the first. */
export function replaceMapBody(text: string, oldBody: string, newBody: string, hintLine?: number): string | null {
  return replaceRpgBody(text, "map", oldBody, newBody, hintLine);
}

/** As `replaceMapBody`, for an `rpg <entity>` block. */
export function replaceRpgBody(
  text: string,
  entity: string,
  oldBody: string,
  newBody: string,
  hintLine?: number
): string | null {
  const matches = findRpgFences(text, entity).filter((f) => same(f.body, oldBody));
  if (matches.length === 0) return null;
  const fence =
    hintLine === undefined
      ? matches[0]
      : matches.reduce((a, b) => (Math.abs(b.open - hintLine) < Math.abs(a.open - hintLine) ? b : a));
  const lines = text.split("\n");
  const body = newBody
    .replace(/\n+$/, "")
    .split("\n")
    .map((l) => fence.prefix + l);
  lines.splice(fence.open + 1, fence.close - fence.open - 1, ...body);
  return lines.join("\n");
}
