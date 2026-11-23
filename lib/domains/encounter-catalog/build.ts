/**
 * Building a new encounter from the Monster Vault's encounter models ("Combat
 * Encounter Models"): a single big monster, double trouble, a boss and
 * lieutenants, a matched set of foes, a horde of minions. Each model is filled
 * from monsters with roles (monster-role.ts) and CRs, sized to the party's
 * challenging benchmark the way the book describes; the simulator then judges
 * which fit. This file only proposes. Pure: no Obsidian and no I/O.
 */

import type { MonsterRole, MonsterTag, Subrole } from "../encounter-sim/monster-role";
import type { CatalogMonster } from "./catalog";

export const ENCOUNTER_MODELS = ["single", "double", "boss", "matched", "horde"] as const;
export type EncounterModel = (typeof ENCOUNTER_MODELS)[number];

export const MODEL_LABEL: Record<EncounterModel, string> = {
  single: "Single big monster",
  double: "Double trouble",
  boss: "Boss and lieutenants",
  matched: "Matched set of foes",
  horde: "Horde of minions",
};

/** A monster the builder may use. */
export interface BuildMonster {
  note: string;
  name: string;
  cr: number;
  role: MonsterRole;
  subrole: Subrole;
  tags: MonsterTag[];
}

export interface BuildParty {
  size: number;
  averageLevel: number;
  /** The challenging benchmark (total CR) as a number. */
  benchmark: number;
  /** The CR above which one monster is more than the party can take on alone. */
  maxSingleCr: number;
}

export interface BuildCandidate {
  model: EncounterModel;
  monsters: CatalogMonster[];
  /** Who is in it, for the GM: "Hobgoblin Captain (leader) and 3 Hobgoblin (soldier)". */
  label: string;
}

const near = (cr: number, aim: number) => Math.abs(Math.log((cr || 0.01) / (aim || 0.01)));
const closest = (list: BuildMonster[], aim: number, n: number) =>
  [...list].sort((a, b) => near(a.cr, aim) - near(b.cr, aim) || a.name.localeCompare(b.name)).slice(0, n);
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const group = (m: BuildMonster, count: number) => (count === 1 ? m.name : `${count} ${m.name}`);

/**
 * The encounters each model makes from the pool for this party, before any simulation: a few per
 * model (`perModel`), the monsters nearest the CR the book gives that model first.
 */
export function buildCandidates(
  models: readonly EncounterModel[],
  pool: BuildMonster[],
  party: BuildParty,
  perModel = 4
): BuildCandidate[] {
  const b = party.benchmark;
  const usable = pool.filter((m) => m.cr > 0);
  const fighters = usable.filter((m) => m.role === "soldier" || m.role === "striker");
  const out: BuildCandidate[] = [];
  if (b <= 0) return out;

  for (const model of models) {
    if (model === "single") {
      // One monster with a CR near the benchmark; a legendary one first (the book's advice from 5th level).
      const big = usable.filter((m) => m.cr >= b * 0.6 && m.cr <= b * 1.6);
      const ranked = [
        ...closest(
          big.filter((m) => m.tags.includes("legendary") || m.subrole === "solo"),
          b,
          perModel
        ),
        ...closest(big, b, perModel),
      ];
      for (const m of unique(ranked).slice(0, perModel)) {
        out.push({ model, monsters: [{ note: m.note, count: 1 }], label: `${m.name} (${m.role})` });
      }
    } else if (model === "double") {
      // Two of a kind, each about half the benchmark.
      for (const m of closest(
        usable.filter((x) => x.role !== "leader"),
        b / 2,
        perModel
      )) {
        out.push({ model, monsters: [{ note: m.note, count: 2 }], label: `2 ${m.name} (${m.role})` });
      }
    } else if (model === "boss") {
      // A boss of about half the benchmark, lieutenants sharing the other half.
      const bosses = closest(
        usable.filter((m) => m.role === "leader" || m.role === "controller" || m.subrole === "solo"),
        b / 2,
        Math.max(2, Math.ceil(perModel / 2))
      );
      const lieutenants = closest(
        fighters.filter((m) => m.cr <= b / 4),
        b / 8,
        2
      );
      for (const boss of bosses) {
        for (const lt of lieutenants) {
          if (lt.note === boss.note) continue;
          const count = clamp(Math.round(b / 2 / lt.cr), 2, 6);
          out.push({
            model,
            monsters: [
              { note: boss.note, count: 1 },
              { note: lt.note, count },
            ],
            label: `${boss.name} (${boss.role}) and ${group(lt, count)} (${lt.role})`,
          });
        }
      }
    } else if (model === "matched") {
      // As many foes as PCs, each about a quarter of the PCs' level (half from 5th level).
      const aim = party.averageLevel <= 4 ? party.averageLevel / 4 : party.averageLevel / 2;
      for (const m of closest(
        fighters.filter((x) => x.cr <= party.maxSingleCr),
        aim,
        perModel
      )) {
        out.push({
          model,
          monsters: [{ note: m.note, count: party.size }],
          label: `${group(m, party.size)} (${m.role})`,
        });
      }
    } else if (model === "horde") {
      // Many weak rank and file, adding up to the benchmark.
      const minions = usable.filter((m) => m.subrole === "rank-and-file" && m.cr <= Math.max(b / 6, 0.125));
      for (const m of closest(minions, b / 10, perModel)) {
        const count = clamp(Math.round(b / m.cr), 6, 30);
        out.push({ model, monsters: [{ note: m.note, count }], label: `${group(m, count)} (rank and file)` });
      }
    }
  }
  return out;
}

function unique(list: BuildMonster[]): BuildMonster[] {
  const seen = new Set<string>();
  return list.filter((m) => (seen.has(m.note) ? false : (seen.add(m.note), true)));
}

/** The same encounter with its largest group one fewer and one more: a model's sizing is a starting point. */
export function sizeVariants(candidate: BuildCandidate, maxCount: number): BuildCandidate[] {
  // A single big monster is one; double trouble is two.
  if (candidate.model === "single" || candidate.model === "double") return [candidate];
  const i = candidate.monsters.reduce((best, m, j, all) => (m.count > all[best].count ? j : best), 0);
  const m = candidate.monsters[i];
  if (m.count < 2) return [candidate];
  const at = (count: number) => ({
    ...candidate,
    monsters: candidate.monsters.map((g, j) => (j === i ? { ...g, count } : g)),
    label: candidate.label.replace(new RegExp(`\\b${m.count} `), `${count} `),
  });
  return [candidate, ...[m.count - 1, m.count + 1].filter((c) => c >= 1 && c <= maxCount).map(at)];
}
