/**
 * Writing a battle map's `tokens:` back into its block: the editor on a map
 * note moves, adds and removes tokens, and this is the text it leaves.
 *
 *   tokens:
 *     Talon: J14
 *     "[[Kobold, Elite]]": N5
 *
 * Only the `tokens:` entry of the header (above the `---`) is touched; every
 * other line, and the grid below, stays as written. Pure, on the block's text.
 */

import { squareName, type Square } from "./square-map";

export interface TokenEntry {
  name: string;
  at: Square;
}

/** A name as a YAML key: bare when it reads safely, else in double quotes. */
function yamlKey(name: string): string {
  const plain =
    /^[A-Za-z0-9][A-Za-z0-9 .'_-]*$/.test(name) &&
    !/^(?:true|false|yes|no|on|off|null|~)$/i.test(name) &&
    !/\s$/.test(name);
  return plain ? name : JSON.stringify(name);
}

/** The block with its `tokens:` entry now listing `tokens` (removed when empty). */
export function writeTokens(source: string, tokens: TokenEntry[]): string {
  const lines = source.split("\n");
  const sep = lines.findIndex((l) => l.trim() === "---");
  const headEnd = sep >= 0 ? sep : lines.length;
  const start = lines.findIndex((l, i) => i < headEnd && /^tokens\s*:/.test(l));
  let end = start;
  if (start >= 0) {
    end = start + 1;
    // The entry runs over its indented lines (and blank ones between them).
    while (end < headEnd && (/^\s+\S/.test(lines[end]) || lines[end].trim() === "")) end++;
    // Blank lines at the end belong to what follows.
    while (end > start + 1 && lines[end - 1].trim() === "") end--;
  }
  const block = tokens.length ? ["tokens:", ...tokens.map((t) => `  ${yamlKey(t.name)}: ${squareName(t.at)}`)] : [];
  if (start >= 0) {
    lines.splice(start, end - start, ...block);
  } else if (block.length) {
    // New: at the end of the header, before the `---` (or after the last header line).
    let at = headEnd;
    while (at > 0 && lines[at - 1].trim() === "") at--;
    lines.splice(at, 0, ...block);
  }
  return lines.join("\n");
}

/** The first free square from `from`, searching outward — where a new token is put down. */
export function freeSquare(from: Square, taken: Square[], cols: number, rows: number): Square {
  const used = new Set(taken.map((s) => `${s.col},${s.row}`));
  const inside = (c: number, r: number) => c >= 0 && r >= 0 && c < cols && r < rows;
  for (let d = 0; d <= Math.max(cols, rows); d++) {
    for (let dr = -d; dr <= d; dr++) {
      for (let dc = -d; dc <= d; dc++) {
        if (Math.max(Math.abs(dc), Math.abs(dr)) !== d) continue;
        const c = from.col + dc;
        const r = from.row + dr;
        if (inside(c, r) && !used.has(`${c},${r}`)) return { col: c, row: r };
      }
    }
  }
  return from;
}
