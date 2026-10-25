/**
 * Part of a map moved into a map of its own (design §15): the hexes chosen
 * (a selection, a region) and everything on them — terrain, bases, edges,
 * paths, stacks, custom tiles, and the markers standing there — become a new
 * block for another note, and the map imports that note in their place, so
 * it looks as it did. Labels stay: they usually name the bigger area.
 *
 * The new map's (0,0) is the chosen hex nearest their middle; its `origin`
 * keeps it where it was, it declares the regions its hexes use, and it shows
 * the map it came from faint around it.
 */

import { hexKey } from "./axial";
import { parseHexMap } from "./parse-hex-map";

export interface Extracted {
  /** The map's block without those hexes, importing the new note. */
  remaining: string;
  /** The new map's block (the fence included), for the end of the other note. */
  block: string;
  /** How many hexes and markers went. */
  hexes: number;
  markers: number;
}

const num = (n: number) => String(Math.round(n * 100) / 100);

/**
 * @param source the map's block (header, `---`, body)
 * @param hexes the hexes to move (`q,r`), in the map's own coordinates
 * @param target link text of the note the new map goes in (`Worthallow Forest`)
 * @param from link text of the note the map is in, for the new map to import faint
 * @param title the new map's title
 */
export function extractHexes(
  source: string,
  hexes: Set<string>,
  target: string,
  from: string,
  title: string
): Extracted | null {
  const map = parseHexMap(source);
  const lines = source.split("\n");
  const sep = lines.findIndex((l) => l.trim() === "---");
  if (sep < 0) return null;
  const inside = (q: number, r: number) => hexes.has(hexKey(Math.round(q), Math.round(r)));
  const cells = map.cells.filter((c) => hexes.has(hexKey(c.q, c.r)));
  const stamps = (map.stamps ?? []).filter((s) => hexes.has(hexKey(s.q, s.r)));
  if (cells.length === 0 && stamps.length === 0) return null;
  const markers = map.markers.filter((m) => inside(m.q, m.r));

  // (0,0): the chosen hex nearest their middle.
  const keys = [...new Set([...cells, ...stamps].map((c) => hexKey(c.q, c.r)))].map((k) => k.split(",").map(Number));
  const mq = keys.reduce((a, [q]) => a + q, 0) / keys.length;
  const my = keys.reduce((a, [q, r]) => a + r + q / 2, 0) / keys.length;
  const [sq, sr] = keys.reduce((b, h) =>
    Math.hypot(h[0] - mq, h[1] + h[0] / 2 - my) < Math.hypot(b[0] - mq, b[1] + b[0] / 2 - my) ? h : b
  );
  const shiftCell = (text: string) =>
    text.replace(
      /^(\s*(?:\*\s*)?)([tpsebc]|stamp)\s*\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)/,
      (_, lead, k, q, r) => `${lead}${k}(${+q - sq},${+r - sr})`
    );
  const shiftPoint = (text: string) =>
    text.replace(
      /^(\s*(?:\*\s*)?)([ml])\s*\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)/,
      (_, lead, k, q, r) => `${lead}${k}(${num(+q - sq)},${num(+r - sr)})`
    );

  // Its lines, by height group, as the new map writes them.
  const moved = new Set<number>();
  const byHeight = new Map<number, string[]>();
  for (const c of [...cells, ...stamps]) {
    moved.add(c.line);
    const list = byHeight.get(c.height) ?? [];
    list.push(
      `  * ${shiftCell(lines[c.line - 1])
        .trim()
        .replace(/^\*\s*/, "")}`
    );
    byHeight.set(c.height, list);
  }
  const pointLines = markers.map((m) => {
    moved.add(m.line);
    return shiftPoint(lines[m.line - 1]).trim();
  });

  // The regions its hexes use, declared as the map declares them (the header's own lines).
  const header = lines.slice(0, sep);
  const used = new Set(cells.flatMap((c) => c.regions));
  const regionLines = [...used]
    .map((name) => header.find((l) => new RegExp(`^\\s+${name}\\s*:`).test(l))?.trim())
    .filter((l): l is string => !!l);
  const [oq, or] = map.origin ?? [0, 0];
  const block = [
    "```rpg map",
    "grid: hex",
    `title: ${title}`,
    ...(map.scale ? [`scale: ${map.scale}`] : []),
    ...(map.pack ? [`pack: ${map.pack}`] : []),
    `origin: [${oq + sq}, ${or + sr}]`,
    "import:",
    `  - map: "[[${from}]]"`,
    "    show: faint",
    ...(regionLines.length ? ["regions:", ...regionLines.map((l) => `  ${l}`)] : []),
    "---",
    ...[...byHeight.entries()].sort((a, b) => a[0] - b[0]).flatMap(([h, l]) => [`${h}m:`, ...l]),
    ...pointLines,
    "```",
  ].join("\n");

  // The map without them, importing the new note first among its imports.
  const rest = lines.filter((_, i) => !moved.has(i + 1));
  const restSep = rest.findIndex((l) => l.trim() === "---");
  const entry = `  - "[[${target}]]"`;
  const imp = rest.findIndex((l, i) => i < restSep && /^import:\s*$/.test(l));
  if (imp >= 0) rest.splice(imp + 1, 0, entry);
  else {
    const inline = rest.findIndex((l, i) => i < restSep && /^import:\s*\S/.test(l));
    if (inline >= 0) {
      // A one-line list: rewritten as a block, the new note first.
      const items = parseHexMap(rest.join("\n")).imports ?? [];
      const listed = items.map((i) =>
        i.faint || i.at || i.label
          ? `  - map: "[[${i.link}]]"${i.faint ? "\n    show: faint" : ""}`
          : `  - "[[${i.link}]]"`
      );
      rest.splice(inline, 1, "import:", entry, ...listed.flatMap((l) => l.split("\n")));
    } else rest.splice(restSep, 0, "import:", entry);
  }
  return { remaining: rest.join("\n"), block, hexes: keys.length, markers: markers.length };
}
