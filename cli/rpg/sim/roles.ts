/**
 * `rpg sim roles` and `rpg sim equivalents`: the Monster Vault roles of the
 * bestiary (controller, leader, soldier, striker), as written in a statblock's
 * `role:` or guessed from it (`lib/domains/encounter-sim/monster-role.ts`), and
 * the monsters of the same role near a monster's CR, to swap it for another.
 * `roles` writes nothing unless `--write` (the guesses at or above
 * --min-confidence, never over a written role) or `--set "<note>=<role>"`.
 */

import {
  equivalentsOf,
  guessRole,
  MONSTER_ROLES,
  parseRole,
  type MonsterRole,
  type RoleConfidence,
  type RoleGuess,
  type RoleProfile,
} from "lib/domains/encounter-sim/monster-role";
import type { Ctx } from "../app";
import { readNote, writeNote } from "../write";
import { noteRef, wordKey, yieldToEventLoop } from "./brief";
import { UsageError, type SimOptions } from "./flags";
import {
  BESTIARY_PREFIX,
  bestiaryPaths,
  categoryHabitat,
  crNumber,
  linkNames,
  loadMonster,
  readMonsterNote,
  type LoadedMonster,
} from "./monsters";

export interface RoledMonster {
  note: string;
  name: string;
  cr: string;
  type: string;
  habitat: string[];
  /** The role it plays: the written one, else the guess. */
  role: MonsterRole;
  /** Where the role comes from. */
  from: "written" | "guess";
  guess: RoleGuess;
}

const CONFIDENCE_ORDER: Record<RoleConfidence, number> = { high: 0, medium: 1, low: 2 };

/** A note the words name (as `--monster` does), or a usage error. */
function noteOf(ctx: Ctx, ref: string): string {
  try {
    return ctx.note(ref).path;
  } catch {
    throw new UsageError(`No monster note "${ref}".`);
  }
}

/** The bestiary folder a note is filed under, its family ("families/humanoids"). */
function familyOf(note: string): string {
  return note.slice(BESTIARY_PREFIX.length).split("/").slice(0, -1).join("/");
}

function roled(monster: LoadedMonster): RoledMonster {
  const guess = guessRole({
    name: monster.name,
    cr: crNumber(monster.cr),
    ac: monster.actor.armorClass,
    hp: monster.actor.maxHp,
    speed: monster.speedText,
    features: monster.features,
    actions: monster.actor.actions,
  });
  return {
    note: monster.note,
    name: monster.name,
    cr: monster.cr,
    type: monster.monsterType,
    habitat: monster.habitat,
    role: monster.role ?? guess.role,
    from: monster.role ? "written" : "guess",
    guess,
  };
}

/** Every bestiary monster the filters keep, with its role; the notes that could not be read are counted. */
export async function roledBestiary(
  ctx: Ctx,
  options: Pick<SimOptions, "habitat" | "type" | "cr">,
  only?: string[]
): Promise<{ monsters: RoledMonster[]; unreadable: number }> {
  const habitat = options.habitat !== undefined ? wordKey(options.habitat) : undefined;
  const type = options.type?.toLowerCase();
  const paths = only ?? bestiaryPaths(ctx);
  const monsters: RoledMonster[] = [];
  let unreadable = 0;
  for (const path of paths) {
    await yieldToEventLoop();
    const state = readMonsterNote(ctx, path);
    if (state.kind === "non-monster") continue;
    if (state.kind === "unresolvable") {
      if (only) throw new Error(`"${path}" cannot be read as a monster: ${state.why}`);
      unreadable++;
      continue;
    }
    if (options.cr !== undefined && crNumber(state.data.cr ?? "") !== crNumber(options.cr)) continue;
    if (type && !state.data.type.toLowerCase().includes(type)) continue;
    if (habitat) {
      const where = linkNames(state.data.habitat ?? categoryHabitat(ctx, state.data.category, state.file.path));
      if (!where.some((h) => wordKey(h) === habitat)) continue;
    }
    try {
      monsters.push(roled(await loadMonster(ctx, state.file.path)));
    } catch (e) {
      if (only) throw e;
      unreadable++;
    }
  }
  return { monsters, unreadable };
}

/** A note's text with `role:` set in its first `rpg stat.monster` fence (after `cr:`); null when it has none. */
export function withRole(text: string, role: MonsterRole): string | null {
  const lines = text.split("\n");
  const open = lines.findIndex((l) => /^`{3,}\s*rpg\s+stat\.monster\b/.test(l));
  if (open < 0) return null;
  const fence = /^(`{3,})/.exec(lines[open])![1];
  let close = open + 1;
  while (close < lines.length && !new RegExp(`^${fence}\\s*$`).test(lines[close])) close++;
  if (close >= lines.length) return null;
  const line = `role: "${role}"`;
  for (let i = open + 1; i < close; i++) {
    if (/^role\s*:/.test(lines[i])) {
      lines[i] = line;
      return lines.join("\n");
    }
  }
  let at = -1;
  for (let i = open + 1; i < close; i++) if (/^cr\s*:/.test(lines[i])) at = i;
  if (at < 0) for (let i = open + 1; i < close; i++) if (/^(name|type)\s*:/.test(lines[i])) at = i;
  lines.splice(at < 0 ? open + 1 : at + 1, 0, line);
  return lines.join("\n");
}

function entry(ctx: Ctx, m: RoledMonster) {
  return {
    monster: noteRef(ctx, m.note),
    cr: m.cr,
    role: m.role,
    ...(m.from === "written" ? { written: true } : {}),
    ...(m.from === "written" && m.guess.role !== m.role ? { guessed: m.guess.role } : {}),
    confidence: m.guess.confidence,
    ...(m.guess.alt ? { alt: m.guess.alt } : {}),
    subroles: m.guess.subroles,
    why: m.guess.reasons,
    vsCr: m.guess.ratios,
    scores: m.guess.scores,
  };
}

/** `--set "<note>=<role>"` → the note and role; a usage error names a bad one. */
function parseSet(raw: string): { note: string; role: MonsterRole } {
  const at = raw.lastIndexOf("=");
  const role = at >= 0 ? parseRole(raw.slice(at + 1)) : undefined;
  const note = at >= 0 ? raw.slice(0, at).trim() : "";
  if (!note || !role) {
    throw new UsageError(`--set "${raw}": write "<note>=<role>", the role one of ${MONSTER_ROLES.join(", ")}.`);
  }
  return { note, role };
}

function writeRoles(ctx: Ctx, writes: Array<{ note: string; role: MonsterRole }>): string[] {
  const written: string[] = [];
  for (const w of writes) {
    const text = readNote(ctx.root, w.note);
    const next = text === null ? null : withRole(text, w.role);
    if (next === null || next === text) continue;
    writeNote(ctx.root, w.note, next);
    written.push(w.note);
  }
  return written;
}

/** `rpg sim roles [<note>…]`: every monster's role, guessed or written, with how sure and why. */
export async function simRoles(ctx: Ctx, options: SimOptions): Promise<{ doc: unknown }> {
  const sets = options.set.map(parseSet);
  if (sets.length) {
    const resolved = sets.map((s) => ({ note: noteOf(ctx, s.note), role: s.role }));
    const written = writeRoles(ctx, resolved);
    return { doc: { written: written.length, notes: written.map((n) => noteRef(ctx, n)) } };
  }
  const only = options.args.length ? options.args.map((a) => noteOf(ctx, a)) : undefined;
  const { monsters, unreadable } = await roledBestiary(ctx, options, only);
  const wanted = new Set(options.roles);
  const kept = monsters
    .filter((m) => wanted.size === 0 || wanted.has(m.role))
    .sort(
      (a, b) =>
        CONFIDENCE_ORDER[b.guess.confidence] - CONFIDENCE_ORDER[a.guess.confidence] ||
        crNumber(a.cr) - crNumber(b.cr) ||
        a.name.localeCompare(b.name)
    );
  const count = (pick: (m: RoledMonster) => string) =>
    kept.reduce<Record<string, number>>((acc, m) => ({ ...acc, [pick(m)]: (acc[pick(m)] ?? 0) + 1 }), {});

  let written: string[] | undefined;
  if (options.write) {
    const floor = CONFIDENCE_ORDER[options.minConfidence];
    written = writeRoles(
      ctx,
      kept.filter((m) => m.from === "guess" && CONFIDENCE_ORDER[m.guess.confidence] <= floor)
    );
  }
  const limit = options.limitSet ? options.limit : kept.length;
  return {
    doc: {
      monsters: kept.length,
      byRole: count((m) => m.role),
      byConfidence: count((m) => (m.from === "written" ? "written" : m.guess.confidence)),
      ...(unreadable ? { unreadable } : {}),
      ...(written ? { written: written.length } : {}),
      // Least sure first: what a person should look at.
      list: kept.slice(0, limit).map((m) => entry(ctx, m)),
      ...(limit < kept.length ? { more: kept.length - limit } : {}),
    },
  };
}

/** `rpg sim equivalents <note>`: monsters of its role near its CR, closest first, another family preferred. */
export async function simEquivalents(ctx: Ctx, options: SimOptions): Promise<{ doc: unknown }> {
  const ref = options.args[0];
  const [target] = (await roledBestiary(ctx, {}, [noteOf(ctx, ref)])).monsters;
  if (!target) throw new UsageError(`"${ref}" is not a monster note.`);
  const { monsters } = await roledBestiary(ctx, options);
  const profile = (m: RoledMonster): RoleProfile => ({
    note: m.note,
    name: m.name,
    cr: crNumber(m.cr),
    role: m.role,
    subroles: m.guess.subroles,
    ratios: m.guess.ratios,
    type: m.type,
    habitat: m.habitat,
    family: familyOf(m.note),
  });
  const role = options.roles[0] ?? target.role;
  const found = equivalentsOf({ ...profile(target), role }, monsters.map(profile), {
    maxSteps: options.steps,
    limit: options.limitSet ? options.limit : 10,
  });
  return {
    doc: {
      monster: noteRef(ctx, target.note),
      cr: target.cr,
      role,
      ...(target.from === "guess" ? { roleFrom: `guess (${target.guess.confidence})` } : {}),
      subroles: target.guess.subroles,
      equivalents: found.map((e) => {
        const m = monsters.find((x) => x.note === e.note)!;
        return {
          monster: noteRef(ctx, e.note),
          cr: m.cr,
          ...(e.crSteps ? { crSteps: e.crSteps } : {}),
          type: m.type,
          ...(m.habitat.length ? { habitat: m.habitat } : {}),
          subroles: e.subroles,
          ...(m.from === "guess" ? { roleFrom: `guess (${m.guess.confidence})` } : {}),
        };
      }),
    },
  };
}
