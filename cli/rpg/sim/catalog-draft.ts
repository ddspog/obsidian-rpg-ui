/**
 * `rpg sim catalog draft`: the random-encounter table rows of vault notes read
 * into draft catalog entries. Pure of writes: it finds the creatures each row
 * names (against an index of the bestiary), drops the rows that are no fight,
 * and hands the drafts back for a person (or a model) to review.
 */

import { areasOfNote } from "lib/domains/encounter-catalog/area-source";
import { mapsOfNote } from "lib/domains/encounter-catalog/map-source";
import type { CatalogEntry, CatalogMonster } from "lib/domains/encounter-catalog/catalog";
import {
  extractEncounter,
  type CombatLikelihood,
  type Confidence,
  type ExtractedEncounter,
} from "lib/domains/encounter-catalog/extract-row";
import {
  buildMonsterIndex,
  findMentions,
  type MonsterEntry,
  type MonsterIndex,
} from "lib/domains/encounter-catalog/monster-index";
import { tablesOfNote } from "lib/domains/encounter-catalog/table-source";
import { normaliseTags } from "lib/domains/encounter-catalog/words";
import type { Ctx } from "../app";
import { bestiaryAliases, bestiaryNoteNamed } from "./aliases";
import { UsageError } from "./flags";
import { loadTemplates, templateNamed, type LoadedTemplate } from "./templates";
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
    index: buildMonsterIndex(entries, bestiaryAliases(ctx).aliases),
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

/**
 * Prose that bolds the creatures it means (an adventure's keyed area) keeps only those: "the Honey Queen"
 * named in passing, or "Ghost Knights" as a band's name, is not in the fight.
 */
export function keepNamed(
  found: ExtractedEncounter,
  named: string[] | undefined,
  index: MonsterIndex
): ExtractedEncounter {
  if (!named) return found;
  const notes = new Set(named.flatMap((phrase) => findMentions(index, phrase).map((m) => m.note)));
  const kept = found.monsters.filter((m) => notes.has(m.note));
  const dropped = found.monsters.filter((m) => !notes.has(m.note)).map((m) => m.name);
  if (!dropped.length) return found;
  return {
    ...found,
    monsters: kept,
    reasons: [...found.reasons, `not in bold, so named in passing: ${dropped.join(", ")}`],
  };
}

/** A map's linked tokens as an encounter: each link a bestiary note, a link to anything else left unresolved. */
function tokensEncounter(ctx: Ctx, linked: Array<{ name: string; count: number }>): ExtractedEncounter {
  const monsters: ExtractedEncounter["monsters"] = [];
  const unresolved: string[] = [];
  const paths = bestiaryPaths(ctx);
  for (const l of linked) {
    // A link names its note: the bestiary note of that name, else whatever the name stands for.
    const note =
      paths.find((p) => p === `${l.name}.md` || p.endsWith(`/${l.name}.md`)) ?? bestiaryNoteNamed(ctx, l.name);
    if (note) monsters.push({ note, name: l.name, count: l.count, matchedText: `[[${l.name}]]`, inferred: false });
    else unresolved.push(l.name);
  }
  return {
    monsters,
    unresolved,
    combat: "likely",
    confidence: unresolved.length ? "medium" : "high",
    reasons: [
      "the map's tokens, each link a bestiary note",
      ...(unresolved.length ? [`linked tokens not in the bestiary: ${unresolved.join(", ")}`] : []),
    ],
  };
}

/** Reads the encounter tables of the given notes into drafts. */
export function scanForDrafts(ctx: Ctx, notes: string[]): DraftScan {
  const bestiary = bestiaryOf(ctx);
  const { index, habitat } = bestiary;
  let loaded: LoadedTemplate[] | undefined;
  const templates = () => (loaded ??= loadTemplates(ctx));
  const scan: DraftScan = { considered: 0, tables: 0, drafts: [], skipped: { "no-monster": 0, "combat-unlikely": 0 } };
  for (const path of notes) {
    const file = ctx.note(path);
    const text = ctx.vault.readSync(file);
    // Random-encounter tables, and an adventure's keyed areas (`*Creatures.*` paragraphs).
    for (const table of [
      ...tablesOfNote(file.path, text),
      ...areasOfNote(file.path, text),
      ...mapsOfNote(file.path, text),
    ]) {
      scan.tables += 1;
      for (const row of table.rows) {
        scan.considered += 1;
        const found = row.linked
          ? tokensEncounter(ctx, row.linked)
          : keepNamed(
              extractEncounter(row.text, index, row.named ? { prose: { named: row.named } } : {}),
              row.named,
              index
            );
        if (found.monsters.length === 0) {
          scan.skipped["no-monster"] += 1;
          continue;
        }
        if (found.combat === "unlikely") {
          scan.skipped["combat-unlikely"] += 1;
          continue;
        }
        // A template the text names ("with the void template") is applied when the vault has its note.
        let confidence = found.confidence;
        const monsters: CatalogMonster[] = found.monsters.map((m) => {
          const template = m.template ? templateNamed(ctx, m.template, templates())?.name : undefined;
          if (m.template && !template) {
            found.reasons.push(
              `no template note "${m.template}" (or name for one under \`templates:\` in Bestiary aliases): ${m.name} simulated without it`
            );
            if (confidence === "high") confidence = "medium";
          }
          return {
            note: m.note,
            count: Math.max(1, Math.round(m.count)),
            ...(m.dice ? { dice: m.dice } : {}),
            ...(template ? { template } : {}),
          };
        });
        const label = [table.environment ? titleCase(table.environment) : table.title, tierLabel(table.tags)]
          .filter(Boolean)
          .join(" ");
        const name = `${label} #${row.roll}: ${monstersText(
          found.monsters.map((m, i) => ({
            name: monsters[i].template ? `${spokenName(m.name)} (${monsters[i].template})` : spokenName(m.name),
            count: monsters[i].count,
          }))
        )}`;
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
          confidence,
          combat: found.combat,
          reasons: found.reasons,
          unresolved: found.unresolved,
        });
      }
    }
  }
  return scan;
}
