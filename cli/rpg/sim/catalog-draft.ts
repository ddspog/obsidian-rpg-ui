/**
 * `rpg sim catalog draft`: the random-encounter table rows of vault notes read
 * into draft catalog entries. Pure of writes: it finds the creatures each row
 * names (against an index of the bestiary), drops the rows that are no fight,
 * and hands the drafts back for a person (or a model) to review.
 */

import type { CatalogEntry, CatalogMonster } from "lib/domains/encounter-catalog/catalog";
import { extractEncounter, type CombatLikelihood, type Confidence } from "lib/domains/encounter-catalog/extract-row";
import { buildMonsterIndex, type MonsterEntry, type MonsterIndex } from "lib/domains/encounter-catalog/monster-index";
import { tablesOfNote } from "lib/domains/encounter-catalog/table-source";
import { normaliseTags } from "lib/domains/encounter-catalog/words";
import type { Ctx } from "../app";
import { UsageError } from "./flags";
import { bestiaryPaths, categoryHabitat, linkNames, readMonsterNote } from "./monsters";

/** The bestiary as the draft reads it: the name index and each note's habitat names. */
interface Bestiary {
  index: MonsterIndex;
  habitat(note: string): string[];
  /** Every habitat the bestiary names, lower-cased: the spelling a tag is folded to. */
  habitats(): ReadonlySet<string>;
}

const bestiaries = new WeakMap<Ctx, Bestiary>();

/** The index of every monster note of the bestiary, built once per vault boot. */
export function bestiaryOf(ctx: Ctx): Bestiary {
  const cached = bestiaries.get(ctx);
  if (cached) return cached;
  const entries: MonsterEntry[] = [];
  for (const path of bestiaryPaths(ctx)) {
    const state = readMonsterNote(ctx, path);
    if (state.kind !== "monster") continue;
    entries.push({
      note: path,
      name: state.data.name || state.file.basename,
      ...(state.data.cr ? { cr: state.data.cr } : {}),
    });
  }
  const habitats = new Map<string, string[]>();
  let vocabulary: Set<string> | undefined;
  const bestiary: Bestiary = {
    index: buildMonsterIndex(entries),
    habitats() {
      vocabulary ??= new Set(entries.flatMap((e) => bestiary.habitat(e.note)));
      return vocabulary;
    },
    habitat(note) {
      let names = habitats.get(note);
      if (!names) {
        const state = readMonsterNote(ctx, note);
        names =
          state.kind === "monster"
            ? linkNames(state.data.habitat ?? categoryHabitat(ctx, state.data.category, state.file.path)).map((h) =>
                h.toLowerCase()
              )
            : [];
        habitats.set(note, names);
      }
      return names;
    },
  };
  bestiaries.set(ctx, bestiary);
  return bestiary;
}

/** The notes a path argument stands for: the note itself, or every markdown note under the folder. */
export function notesOf(ctx: Ctx, arg: string): string[] {
  const clean = arg.replace(/^\.?\/+/, "").replace(/\/+$/, "");
  const files = ctx.vault.getMarkdownFiles().map((f) => f.path);
  const exact = files.find((p) => p === clean || p === `${clean}.md`);
  if (exact) return [exact];
  const inside = files.filter((p) => p.startsWith(`${clean}/`)).sort();
  if (inside.length === 0) throw new UsageError(`No note or folder "${arg}" in the vault (a vault path is expected).`);
  return inside;
}

/** One drafted row: the entry and what the extraction said of it. */
export interface Draft {
  entry: CatalogEntry;
  confidence: Confidence;
  combat: CombatLikelihood;
  reasons: string[];
  unresolved: string[];
}

export interface DraftScan {
  /** The rows looked at. */
  considered: number;
  /** The encounter tables found. */
  tables: number;
  /** Drafts in note, table, row order; ids are not yet unique (see `assignIds`). */
  drafts: Draft[];
  skipped: { "no-monster": number; "combat-unlikely": number };
}

const titleCase = (kebab: string): string =>
  kebab
    .split("-")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");

/** "T1", "T3-4": the tiers a table's tags name, or "". */
function tierLabel(tags: string[]): string {
  const tiers = tags.flatMap((t) => (/^tier-(\d+)$/.exec(t) ? [Number(t.slice(5))] : []));
  if (tiers.length === 0) return "";
  const lo = Math.min(...tiers);
  const hi = Math.max(...tiers);
  return lo === hi ? `T${lo}` : `T${lo}-${hi}`;
}

const ARTICLES = new Set(["a", "an", "the"]);

/** A bestiary name as it is said: "Wolf, Dire" is "Dire Wolf", "Druid, A" is "Druid", "Rat, Swarm of Rats" is "Swarm of Rats". */
export function spokenName(name: string): string {
  const parts = name
    .replace(/\([^)]*\)/g, " ")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return name.trim();
  const tail = parts.slice(1);
  if (tail.every((p) => ARTICLES.has(p.toLowerCase()))) return parts[0];
  if (tail.some((p) => /\bof\b/i.test(p))) return tail.join(" ");
  return [...parts].reverse().join(" ");
}

/** "Bandit Captain + 2 Bandit": the monsters of an entry by name, a count before any but a lone one. */
function monstersText(monsters: Array<{ name: string; count: number }>): string {
  return monsters.map((m) => (m.count === 1 ? m.name : `${m.count} ${m.name}`)).join(" + ");
}

/** Reads the encounter tables of the given notes into drafts. */
export function scanForDrafts(ctx: Ctx, notes: string[]): DraftScan {
  const bestiary = bestiaryOf(ctx);
  const { index, habitat } = bestiary;
  const scan: DraftScan = { considered: 0, tables: 0, drafts: [], skipped: { "no-monster": 0, "combat-unlikely": 0 } };
  for (const path of notes) {
    const file = ctx.note(path);
    for (const table of tablesOfNote(file.path, ctx.vault.readSync(file))) {
      scan.tables += 1;
      for (const row of table.rows) {
        scan.considered += 1;
        const found = extractEncounter(row.text, index);
        if (found.monsters.length === 0) {
          scan.skipped["no-monster"] += 1;
          continue;
        }
        if (found.combat === "unlikely") {
          scan.skipped["combat-unlikely"] += 1;
          continue;
        }
        const monsters: CatalogMonster[] = found.monsters.map((m) => ({
          note: m.note,
          count: Math.max(1, Math.round(m.count)),
          ...(m.dice ? { dice: m.dice } : {}),
        }));
        const label = [table.environment ? titleCase(table.environment) : table.title, tierLabel(table.tags)]
          .filter(Boolean)
          .join(" ");
        const name = `${label} #${row.roll}: ${monstersText(found.monsters.map((m, i) => ({ name: spokenName(m.name), count: monsters[i].count })))}`;
        // One spelling per tag: a table's "forests" and a wolf's "forest" become "forest".
        const tags = normaliseTags([...table.tags, ...monsters.flatMap((m) => habitat(m.note))], bestiary.habitats());
        scan.drafts.push({
          entry: {
            id: "",
            name,
            monsters,
            tags,
            source: {
              note: table.path,
              table: table.slug,
              row: row.roll,
              ...(table.book ? { book: table.book } : {}),
              text: row.text,
            },
            review: "draft",
          },
          confidence: found.confidence,
          combat: found.combat,
          reasons: found.reasons,
          unresolved: found.unresolved,
        });
      }
    }
  }
  return scan;
}
