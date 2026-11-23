/**
 * `--map <note>`: a battle map for `rpg sim run`, from the note's `rpg map` block (a square grid). The legend's
 * terrain becomes the grid's rules (`blocks`: no walking through it and no sight across it, `difficult`: double
 * cost, `cover`: half +2, three-quarters +5, total as blocking sight), and the tokens become start squares:
 * a PC's by its name (`Talon` for Talon Pallton), a monster's by the bestiary note its `[[link]]` names (as many
 * tokens of a note, as many of that monster). A map drawn as a picture with no grid is open ground as large as
 * its tokens need. With no `--monster`, the fight is the map's linked tokens.
 */

import { parseSquareMap, type SquareMap } from "lib/domains/battlemap/square-map";
import { linkedTokens } from "lib/domains/encounter-catalog/map-source";
import type { BattleGrid, CombatActor } from "lib/domains/encounter-sim/types";
import type { Ctx } from "../app";
import { fencesOf } from "../fences";
import { bestiaryNoteNamed } from "./aliases";
import { UsageError, type MonsterGroup } from "./flags";
import { bestiaryPaths } from "./monsters";

export interface LoadedMap {
  note: string;
  title: string;
  map: SquareMap;
}

/** The note's first `rpg map` block, parsed. */
export function loadBattleMap(ctx: Ctx, ref: string): LoadedMap {
  let file;
  try {
    file = ctx.note(ref);
  } catch {
    throw new UsageError(`--map: no note "${ref}" in the vault.`);
  }
  const body = fencesOf(ctx.vault.readSync(file), "map")[0];
  if (body === undefined) throw new UsageError(`--map: "${file.path}" has no rpg map block.`);
  const map = parseSquareMap(body);
  if (Object.keys(map.tokens).length === 0 && map.cols === 0)
    throw new UsageError(`--map: the map of "${file.path}" has no grid and no tokens to place anyone by.`);
  return { note: file.path, title: map.title ?? file.basename, map };
}

/** A token's link, resolved to its bestiary note (a link names a note: that note, else what the name stands for). */
function bestiaryNote(ctx: Ctx, name: string): string | undefined {
  return bestiaryPaths(ctx).find((p) => p.endsWith(`/${name}.md`)) ?? bestiaryNoteNamed(ctx, name);
}

/** The monsters the map's tokens link, as `--monster` groups. */
export function monstersOfMap(ctx: Ctx, loaded: LoadedMap): MonsterGroup[] {
  const groups: MonsterGroup[] = [];
  for (const { name, count } of linkedTokens(loaded.map.tokens)) {
    const note = bestiaryNote(ctx, name);
    if (!note) throw new UsageError(`--map: the token [[${name}]] names no bestiary note.`);
    groups.push({ note, count });
  }
  if (groups.length === 0)
    throw new UsageError(`--map: "${loaded.note}" links no monster token; name the monsters with --monster.`);
  return groups;
}

const COVER: Record<string, number> = { half: 2, "three-quarters": 5, "three quarters": 5 };

/**
 * The grid the engine plays on, with each creature's start square: PCs by their token's name (its first word, or
 * the whole), monsters by the note their token links.
 */
export function battleGrid(
  ctx: Ctx,
  loaded: LoadedMap,
  party: CombatActor[],
  monsters: Array<{ note: string }>
): BattleGrid {
  const { map } = loaded;
  const squares = Object.values(map.tokens);
  const cols = map.cols || Math.max(1, ...squares.map((q) => q.col + 1)) + 4;
  const rows = map.rows || Math.max(1, ...squares.map((q) => q.row + 1)) + 4;
  const blocked: boolean[] = [];
  const difficult: boolean[] = [];
  const cover: number[] = [];
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < cols; col++) {
      const t = map.legend[map.cells[row]?.[col] ?? ""];
      const total = t?.cover?.toLowerCase() === "total" || t?.cover?.toLowerCase() === "full";
      blocked.push(!!t?.blocks || total);
      difficult.push(!!t?.difficult);
      cover.push(COVER[t?.cover?.toLowerCase() ?? ""] ?? 0);
    }
  const starts: BattleGrid["starts"] = {};
  const add = (key: string, q: { col: number; row: number }) => (starts[key] ??= []).push(q);
  const wordsOf = (s: string) => s.toLowerCase().split(/\s+/);
  for (const [token, square] of Object.entries(map.tokens)) {
    const link = token.match(/\[\[([^\]|#]+)/)?.[1]?.trim();
    if (link) {
      const note = bestiaryNote(ctx, link);
      const monster = note ? monsters.find((m) => m.note === note) : undefined;
      if (monster) add(monster.note, square);
      continue;
    }
    // A PC's token: its name, or its first word ("Talon" for Talon Pallton).
    const pc = party.find(
      (p) => p.name.toLowerCase() === token.toLowerCase() || wordsOf(p.name)[0] === wordsOf(token)[0]
    );
    if (pc) add(pc.key, square);
  }
  return { scale: map.scale || 5, cols, rows, blocked, difficult, cover, starts };
}
