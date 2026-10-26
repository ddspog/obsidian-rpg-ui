/**
 * `rpg map <note>` — a map as text. A hex map: its levels, imports, and each
 * hex (terrain, base, paths, stacks, regions, places), merged with what it
 * imports at that level, optionally only those near a hex. A battle map: its
 * grid, legend and squares. Terrain specs read as the pack's tile folders
 * (`forest[lush][conifer-0]`: a lush conifer forest).
 */

import { parseSquareMap } from "lib/domains/battlemap/square-map";
import { axialDistance } from "./axial-distance";
import { loadImports, mergeImports } from "lib/domains/hexmap/imports";
import { importsAtLevel, levelScale, levelSections, levelView } from "lib/domains/hexmap/levels";
import { isHexMapSource, parseHexMap } from "lib/domains/hexmap/parse-hex-map";
import type { Ctx } from "../app";
import { fencesOf } from "../fences";

export interface HexRow {
  q: number;
  r: number;
  terrain?: string;
  height?: number;
  base?: string;
  paths: string[];
  stacks: string[];
  regions: string[];
  label?: string;
  link?: string;
  from?: string;
}

export interface MapState {
  note: string;
  kind: "hex" | "battle";
  title?: string;
  scale?: string;
  level?: number;
  levels?: number[];
  imports?: string[];
  regions?: Record<string, { label?: unknown; parent?: string; link?: string }>;
  hexes?: HexRow[];
  marks?: Array<{ at: [number, number]; text: string }>;
  battle?: unknown;
  problems: string[];
}

export async function mapState(
  ctx: Ctx,
  ref: string,
  opts: { level?: number; around?: [number, number]; radius?: number }
): Promise<MapState> {
  const file = ctx.note(ref);
  const text = ctx.vault.readSync(file);
  const bodies = fencesOf(text, "map");
  if (bodies.length === 0) throw new Error(`${file.path} has no rpg map block.`);
  const body = bodies.find(isHexMapSource) ?? bodies[0];
  if (!isHexMapSource(body)) {
    const battle = parseSquareMap(body);
    return { note: file.path, kind: "battle", battle, problems: [] };
  }
  const top = parseHexMap(body);
  const level = opts.level ?? 0;
  const read = async (link: string, from: string) => {
    const f = ctx.vault.resolveLink(link, from);
    if (!f) return null;
    const b = fencesOf(ctx.vault.readSync(f), "map").find(isHexMapSource);
    return b ? { path: f.path, body: b } : null;
  };
  const { imports, problems } = await loadImports(top, file.path, read);
  const view = levelView(body, level);
  const placed = importsAtLevel(imports, level);
  const map = mergeImports(parseHexMap(view), placed);
  const fromOf = (line: number) => (line < 0 ? "an import" : undefined);

  const rows = new Map<string, HexRow>();
  const row = (q: number, r: number) => {
    const k = `${q},${r}`;
    let x = rows.get(k);
    if (!x) rows.set(k, (x = { q, r, paths: [], stacks: [], regions: [] }));
    return x;
  };
  for (const c of map.cells) {
    if (c.faint) continue;
    const x = row(c.q, c.r);
    if (c.layer === "terrain") {
      if (!x.terrain || c.height >= (x.height ?? 0)) {
        x.terrain = c.spec;
        x.height = c.height;
        if (c.groupBase && !x.base) x.base = c.groupBase;
      }
      if (c.label) x.label = c.label;
      if (c.link) x.link = c.link;
    } else if (c.layer === "base" && c.spec) x.base = c.spec;
    else if (c.layer === "path" && c.spec) x.paths.push(c.spec);
    else if (c.layer === "stack" && c.spec) x.stacks.push(c.spec);
    for (const g of c.regions) if (!x.regions.includes(g)) x.regions.push(g);
    if (fromOf(c.line)) x.from = "import";
  }
  let hexes = [...rows.values()];
  if (opts.around) {
    const [cq, cr] = opts.around;
    const radius = opts.radius ?? 3;
    hexes = hexes.filter((h) => axialDistance(h.q, h.r, cq, cr) <= radius);
  }
  hexes.sort((a, b) => a.r - b.r || a.q - b.q);
  const marks = [
    ...map.markers.map((m) => ({
      at: [m.q, m.r] as [number, number],
      text: [m.text, m.spec, m.link && `[[${m.link}]]`].filter(Boolean).join(" "),
    })),
    ...map.labels.map((l) => ({ at: [l.q, l.r] as [number, number], text: `label "${l.text ?? l.link}"` })),
  ].filter(
    (m) =>
      !opts.around ||
      axialDistance(Math.round(m.at[0]), Math.round(m.at[1]), opts.around[0], opts.around[1]) <= (opts.radius ?? 3)
  );
  return {
    note: file.path,
    kind: "hex",
    title: top.title,
    scale: levelScale(top.scale, level),
    level,
    levels: [0, ...levelSections(body).map((s) => s.depth)],
    imports: imports.map((i) => `${i.path}${i.faint ? " (faint)" : ""}`),
    regions: Object.fromEntries(
      Object.values(map.regions).map((g) => [
        g.name,
        {
          ...(g.label !== undefined ? { label: g.label } : {}),
          ...(g.parent ? { parent: g.parent } : {}),
          ...(g.link ? { link: g.link } : {}),
        },
      ])
    ),
    hexes,
    marks,
    problems,
  };
}

export function renderMap(s: MapState): string {
  if (s.kind === "battle") return `# Battle map: ${s.note}\n\n\`\`\`json\n${JSON.stringify(s.battle, null, 1)}\n\`\`\``;
  const out: string[] = [`# Map: ${s.title ?? s.note}`, `(${s.note})`, ""];
  out.push(
    `Level ${s.level} of ${(s.levels ?? []).join(", ")} · 1 hex = ${s.scale ?? "?"} · axial coordinates (q,r): q runs east, r south-east; neighbours are (q±1,r), (q,r±1), (q+1,r−1), (q−1,r+1).`
  );
  if (s.imports?.length) out.push(`Imports: ${s.imports.join("; ")}`);
  out.push("");
  if (s.marks?.length) {
    out.push("## Marks and labels");
    for (const m of s.marks) out.push(`- (${m.at.map((n) => Math.round(n * 100) / 100).join(",")}) ${m.text}`);
    out.push("");
  }
  out.push(`## Hexes (${s.hexes?.length ?? 0})`);
  for (const h of s.hexes ?? []) {
    const bits = [
      h.terrain ?? "no terrain",
      h.height ? `${h.height} m up` : "",
      h.base ? `base ${h.base}` : "",
      h.paths.length ? `paths ${h.paths.join(", ")}` : "",
      h.stacks.length ? `with ${h.stacks.join(", ")}` : "",
      h.regions.length ? `in ${h.regions.join(", ")}` : "",
      h.label ? `"${h.label}"` : "",
      h.link ? `[[${h.link}]]` : "",
    ].filter(Boolean);
    out.push(`- (${h.q},${h.r}) ${bits.join(" · ")}`);
  }
  if (s.problems.length) out.push("", "## Problems", ...s.problems.map((p) => `- ${p}`));
  return out.join("\n");
}
