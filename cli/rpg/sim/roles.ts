/**
 * `rpg sim roles` and `rpg sim equivalents`: the Monster Vault roles of the
 * bestiary (controller, leader, soldier, striker), as written in a statblock's
 * `role:` or guessed from it (`lib/domains/encounter-sim/monster-role.ts`), and
 * the monsters of the same role near a monster's CR, to swap it for another.
 * `roles` writes nothing unless `--write` (the guesses at or above
 * --min-confidence, never over a written role) or `--set "<note>=<role>"`.
 */

import {
  bestSubrole,
  equivalentsOf,
  guessRole,
  MONSTER_ROLES,
  parseRole,
  parseSubrole,
  roleOfSubrole,
  SUBROLES,
  type MonsterRole,
  type Subrole,
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
  /** Its subrole: the written one, else the guess's within its role. */
  subrole: Subrole;
  /** The statblock as the guess read it (for `--features`). */
  stats: { ac: number; hp: number; speed: string };
  features: LoadedMonster["features"];
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
    type: monster.monsterType,
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
    subrole:
      monster.subrole && (!monster.role || roleOfSubrole(monster.subrole) === monster.role)
        ? monster.subrole
        : monster.role
          ? bestSubrole(guess, monster.role)
          : guess.subrole,
    from: monster.role ? "written" : "guess",
    guess,
    stats: { ac: monster.actor.armorClass, hp: monster.actor.maxHp, speed: monster.speedText },
    features: monster.features,
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

/**
 * A note's text with `role:` and `subrole:` set in its first `rpg stat.monster` fence (after `cr:`,
 * replacing any written); null when it has none.
 */
export function withRole(text: string, role: MonsterRole, subrole?: Subrole): string | null {
  const lines = text.split("\n");
  const open = lines.findIndex((l) => /^`{3,}\s*rpg\s+stat\.monster\b/.test(l));
  if (open < 0) return null;
  const fence = /^(`{3,})/.exec(lines[open])![1];
  let close = open + 1;
  while (close < lines.length && !new RegExp(`^${fence}\\s*$`).test(lines[close])) close++;
  if (close >= lines.length) return null;
  const body = lines.slice(open + 1, close).filter((l) => !/^(role|subrole)\s*:/.test(l));
  let at = -1;
  body.forEach((l, i) => {
    if (/^cr\s*:/.test(l)) at = i;
  });
  if (at < 0)
    body.forEach((l, i) => {
      if (at < 0 && /^(name|type)\s*:/.test(l)) at = i;
    });
  body.splice(at + 1, 0, `role: "${role}"`, ...(subrole ? [`subrole: "${subrole}"`] : []));
  return [...lines.slice(0, open + 1), ...body, ...lines.slice(close)].join("\n");
}

/** A feature as a dossier line: its name, kind and prose, cut short. */
function featureLine(f: RoledMonster["features"][number]): string {
  const text = f.text.replace(/[*_]+/g, "").replace(/\s+/g, " ").trim();
  return `${f.name}${f.type ? ` (${f.type})` : ""}: ${text.length > 320 ? `${text.slice(0, 317)}...` : text}`;
}

function entry(ctx: Ctx, m: RoledMonster, features = false) {
  return {
    monster: noteRef(ctx, m.note),
    cr: m.cr,
    role: m.role,
    subrole: m.subrole,
    ...(m.from === "written" ? { written: true } : {}),
    ...(m.from === "written" && (m.guess.role !== m.role || m.guess.subrole !== m.subrole)
      ? { guessed: `${m.guess.role}/${m.guess.subrole}` }
      : {}),
    confidence: m.guess.confidence,
    ...(m.guess.alt ? { alt: m.guess.alt } : {}),
    ...(m.guess.rule ? { rule: m.guess.rule } : {}),
    tags: m.guess.tags,
    why: m.guess.reasons,
    vsCr: m.guess.ratios,
    scores: m.guess.scores,
    ...(features
      ? { type: m.type, ...m.stats, features: m.features.filter((f) => f.text.trim()).map(featureLine) }
      : {}),
  };
}

/**
 * `--set "<note>=<role>[/<subrole>]"` (or `=<subrole>`, its role implied) → the note, role and subrole;
 * a usage error names a bad one.
 */
function parseSet(raw: string): { note: string; role: MonsterRole; subrole?: Subrole } {
  const at = raw.lastIndexOf("=");
  const note = at >= 0 ? raw.slice(0, at).trim() : "";
  const [first, second] = (at >= 0 ? raw.slice(at + 1) : "").split("/");
  const alone = parseSubrole(first);
  const role = parseRole(first) ?? (alone ? roleOfSubrole(alone) : undefined);
  const subrole = second !== undefined ? parseSubrole(second) : alone;
  const fits = !subrole || (role !== undefined && roleOfSubrole(subrole) === role);
  if (!note || !role || (second !== undefined && !subrole) || !fits) {
    throw new UsageError(
      `--set "${raw}": write "<note>=<role>/<subrole>" (or just the role or the subrole); roles: ${MONSTER_ROLES.join(", ")}; subroles: ${SUBROLES.join(", ")}, each under its own role.`
    );
  }
  return { note, role, ...(subrole ? { subrole } : {}) };
}

function writeRoles(ctx: Ctx, writes: Array<{ note: string; role: MonsterRole; subrole?: Subrole }>): string[] {
  const written: string[] = [];
  for (const w of writes) {
    const text = readNote(ctx.root, w.note);
    const next = text === null ? null : withRole(text, w.role, w.subrole);
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
    const resolved = sets.map((s) => ({ ...s, note: noteOf(ctx, s.note) }));
    const written = writeRoles(ctx, resolved);
    return { doc: { written: written.length, notes: written.map((n) => noteRef(ctx, n)) } };
  }
  const only = options.args.length ? options.args.map((a) => noteOf(ctx, a)) : undefined;
  const { monsters, unreadable } = await roledBestiary(ctx, options, only);
  const wanted = new Set<string>(options.roles);
  const kept = monsters
    .filter((m) => wanted.size === 0 || wanted.has(m.role) || wanted.has(m.subrole))
    .filter(
      (m) =>
        options.confidences.length === 0 || (m.from === "guess" && options.confidences.includes(m.guess.confidence))
    )
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
      bySubrole: count((m) => `${m.role}/${m.subrole}`),
      byConfidence: count((m) => (m.from === "written" ? "written" : m.guess.confidence)),
      ...(unreadable ? { unreadable } : {}),
      ...(written ? { written: written.length } : {}),
      // Least sure first: what a person should look at.
      list: kept.slice(0, limit).map((m) => entry(ctx, m, options.features)),
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
    subrole: m.subrole,
    tags: m.guess.tags,
    ratios: m.guess.ratios,
    type: m.type,
    habitat: m.habitat,
    family: familyOf(m.note),
  });
  // --role names a role (its best subrole for this monster) or a subrole to look for instead.
  const asked = options.roles[0];
  const askedSub = parseSubrole(asked);
  const role = askedSub ? roleOfSubrole(askedSub) : (parseRole(asked) ?? target.role);
  const subrole = askedSub ?? (role === target.role ? target.subrole : bestSubrole(target.guess, role));
  const found = equivalentsOf({ ...profile(target), role, subrole }, monsters.map(profile), {
    maxSteps: options.steps,
    limit: options.limitSet ? options.limit : 10,
  });
  return {
    doc: {
      monster: noteRef(ctx, target.note),
      cr: target.cr,
      role,
      subrole,
      ...(target.from === "guess" ? { roleFrom: `guess (${target.guess.confidence})` } : {}),
      tags: target.guess.tags,
      equivalents: found.map((e) => {
        const m = monsters.find((x) => x.note === e.note)!;
        return {
          monster: noteRef(ctx, e.note),
          cr: m.cr,
          ...(e.crSteps ? { crSteps: e.crSteps } : {}),
          type: m.type,
          ...(m.habitat.length ? { habitat: m.habitat } : {}),
          subrole: e.subrole,
          ...(e.tags.length ? { tags: e.tags } : {}),
          ...(m.from === "guess" ? { roleFrom: `guess (${m.guess.confidence})` } : {}),
        };
      }),
    },
  };
}
