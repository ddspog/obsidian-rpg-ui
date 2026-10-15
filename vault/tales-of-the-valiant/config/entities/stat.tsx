import { CreateEntity } from "rpg-ui-toolkit";
import type { AbilityScores, FeatureEntry, StatMonsterData } from "rpg-ui-toolkit";
import { basicSessionActions, loadBasicActions } from "./basic-actions";
import vehicle from "../blocks/stat/vehicle";
import monster from "../blocks/stat/monster";
import category from "../blocks/stat/category";

/** Attribute keys on a statblock's `abilities:` by their names (`Dexterity` → `dex`). */
const ABILITY_KEYS: Record<string, keyof AbilityScores> = {
  str: "str",
  strength: "str",
  dex: "dex",
  dexterity: "dex",
  con: "con",
  constitution: "con",
  int: "int",
  intelligence: "int",
  wis: "wis",
  wisdom: "wis",
  cha: "cha",
  charisma: "cha",
};

/**
 * Experience Points by Challenge Rating — the Monster Vault's table
 * (`glossary/rules/Experience Points`): what defeating a creature is worth.
 */
const XP_BY_CR: Record<string, number> = {
  "0": 10,
  "1/8": 25,
  "1/4": 50,
  "1/2": 100,
  "1": 200,
  "2": 450,
  "3": 700,
  "4": 1100,
  "5": 1800,
  "6": 2300,
  "7": 2900,
  "8": 3900,
  "9": 5000,
  "10": 5900,
  "11": 7200,
  "12": 8400,
  "13": 10000,
  "14": 11500,
  "15": 13000,
  "16": 15000,
  "17": 18000,
  "18": 20000,
  "19": 22000,
  "20": 25000,
  "21": 33000,
  "22": 41000,
  "23": 50000,
  "24": 62000,
  "25": 75000,
  "26": 90000,
  "27": 105000,
  "28": 120000,
  "29": 135000,
  "30": 155000,
};

const stat = CreateEntity(async ({ wiki }) => ({
  lookup: {
    // The basic actions any creature can take (Dash, Dodge, Opportunity
    // Attack, …) — the same notes a character's sheet uses.
    $defaultFeatures: await loadBasicActions(wiki),
  },
  blocks: {
    vehicle,
    monster,
    category,
    group: category,
  },
  expressions: {
    /**
     * What a creature can do in a session beyond its statblock: the basic
     * actions. Its statblock's own actions (Mining Pick, Sling, …) are read by
     * the session log from the statblock's feature refs and listed first.
     */
    SessionActions: (_args: unknown[], { lookup }: { lookup: { $defaultFeatures?: FeatureEntry[] } }) =>
      basicSessionActions(lookup.$defaultFeatures),
    /**
     * What a named roll term is worth for this creature — the statblock side of
     * a session log's `d20+[[Initiative]]`. Statblock `abilities:` are already
     * modifiers (`dex: 3`). Initiative is the DEX modifier unless the statblock
     * writes its own `initiative:` under `stats:`.
     */
    /** The statblock's `ac:` — its leading number (`14 (leather armor)` → 14). */
    ArmorClass: (_args: unknown[], { blocks }: { blocks: unknown }) => {
      const stats = (blocks as { monster?: { stats?: Record<string, unknown> } }).monster?.stats;
      const n = parseInt(String(stats?.ac ?? ""), 10);
      return Number.isFinite(n) ? n : undefined;
    },
    /** What defeating it is worth: its own `xp:`, else its `cr:` on the XP table (`1/2` → 100). */
    ExperiencePoints: (_args: unknown[], { blocks }: { blocks: unknown }) => {
      const data = (blocks as { monster?: StatMonsterData }).monster;
      const own = Number(
        String((data as Record<string, unknown> | undefined)?.xp ?? data?.stats?.xp ?? "").replace(/[,\s]/g, "")
      );
      if (Number.isFinite(own) && own > 0) return own;
      const cr = String(data?.cr ?? "").trim();
      return XP_BY_CR[cr];
    },
    /** The statblock's `hp:` — its leading number, full (`26 (4d8 + 8)` → 26 of 26). */
    HitPoints: (_args: unknown[], { blocks }: { blocks: unknown }) => {
      const stats = (blocks as { monster?: { stats?: Record<string, unknown> } }).monster?.stats;
      const n = parseInt(String(stats?.hp ?? ""), 10);
      return Number.isFinite(n) ? { current: n, max: n } : undefined;
    },
    Modifier: ([name], { blocks }) => {
      const data = (blocks as unknown as { monster?: StatMonsterData }).monster;
      if (!data) return undefined;
      const key = String(name ?? "")
        .replace(/^\[\[/, "")
        .replace(/\]\]$/, "")
        .split("|")[0]
        .trim()
        .toLowerCase();
      const read = (v: unknown): number | undefined => {
        const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v.replace(/^\+/, "")) : NaN;
        return Number.isFinite(n) ? n : undefined;
      };
      if (key === "initiative") {
        const stats = (data as unknown as { stats?: Record<string, unknown> }).stats;
        return read(stats?.initiative) ?? read(data.abilities?.dex);
      }
      const ability = ABILITY_KEYS[key];
      return ability ? read(data.abilities?.[ability]) : undefined;
    },
  },
}));

export default stat;
