/**
 * character-yaml.ts
 *
 * Helpers for building YAML fixture strings used in vault character block stories.
 * These compute skill bonus totals from ability scores and proficiency settings so
 * story controls (ability scores, proficiency_bonus) automatically drive the YAML.
 */

/** D&D 5e ability modifier formula */
export function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

export interface AbilityScores {
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
}

/** Maps each skill to its governing ability score key */
const SKILL_ABILITY: Record<string, keyof AbilityScores> = {
  Acrobatics: "dexterity",
  "Animal Handling": "wisdom",
  Arcana: "intelligence",
  Athletics: "strength",
  Deception: "charisma",
  History: "intelligence",
  Insight: "wisdom",
  Intimidation: "charisma",
  Investigation: "intelligence",
  Medicine: "wisdom",
  Nature: "intelligence",
  Perception: "wisdom",
  Performance: "charisma",
  Persuasion: "charisma",
  Religion: "intelligence",
  "Sleight of Hand": "dexterity",
  Stealth: "dexterity",
  Survival: "wisdom",
};

export const ALL_SKILLS = Object.keys(SKILL_ABILITY);

/**
 * Build a YAML string for the skills block.
 *
 * Each skill entry has `proficiency` (0 = none, 1 = proficient, 2 = expert),
 * `vantage: 0`, and `bonus` = ability modifier + proficiency_bonus × proficiency.
 *
 * @param abilities - the six ability scores
 * @param proficiencyBonus - flat proficiency bonus (e.g. 3 for level 5)
 * @param proficient - skill names that are proficient (proficiency × 1)
 * @param expert - skill names that have expertise (proficiency × 2)
 */
export function buildSkillsYaml(
  abilities: AbilityScores,
  proficiencyBonus: number,
  proficient: string[] = [],
  expert: string[] = [],
): string {
  return ALL_SKILLS.map((skill) => {
    const ability = SKILL_ABILITY[skill];
    const mod = abilityMod(abilities[ability]);
    const profMult = expert.includes(skill) ? 2 : proficient.includes(skill) ? 1 : 0;
    const bonus = mod + proficiencyBonus * profMult;
    const key = skill.includes(" ") ? `"${skill}"` : skill;
    return `${key}:\n  proficiency: ${profMult}\n  vantage: 0\n  bonus: ${bonus}`;
  }).join("\n");
}

/**
 * Build a YAML string for the stats block from ability scores and optional
 * save proficiency multipliers (0 = none, 1 = proficient, 2 = expert).
 */
/** Attack entry used to build attacks YAML */
export interface AttackDef {
  name: string;
  to_hit: number;
  range: string;
  damage: { roll: string; type: string };
}

/** Build a YAML string for the attacks block */
export function buildAttacksYaml(attacks: AttackDef[]): string {
  return `attacks:\n${attacks
    .map(
      (a) =>
        `  - name: ${a.name}\n    to_hit: ${a.to_hit}\n    range: "${a.range}"\n    damage:\n      roll: "${a.damage.roll}"\n      type: ${a.damage.type}`,
    )
    .join("\n")}`;
}

/** Build a YAML string for the proficiencies block */
export function buildProficienciesYaml(profs: {
  armor?: string[];
  weapons?: string[];
  tools?: string[];
  languages?: string[];
}): string {
  const lines: string[] = [];
  const renderList = (key: string, items: string[]) => {
    if (items.length === 0) {
      lines.push(`${key}: []`);
    } else {
      lines.push(`${key}:`);
      items.forEach((item) => lines.push(`  - ${item}`));
    }
  };
  renderList("armor", profs.armor ?? []);
  renderList("weapons", profs.weapons ?? []);
  renderList("tools", profs.tools ?? []);
  renderList("languages", profs.languages ?? []);
  return lines.join("\n");
}

/** Feature entry for building features YAML */
export interface FeatureDef {
  name: string;
  level?: number;
  description?: string;
  type?: string;
  uses?: number;
  trivial?: boolean;
  image?: string;
  origin?: string;
  link?: string;
}

/** Feature category for building features YAML */
export interface FeatureCategoryDef {
  name: string;
  icon?: string;
  features: FeatureDef[];
}

/** Build a YAML string for the features block */
export function buildFeaturesYaml(categories: FeatureCategoryDef[]): string {
  const lines: string[] = ["categories:"];
  for (const cat of categories) {
    lines.push(`  - name: "${cat.name}"`);
    if (cat.icon) lines.push(`    icon: "${cat.icon}"`);
    lines.push("    features:");
    for (const f of cat.features) {
      lines.push(`      - name: "${f.name}"`);
      if (f.level != null) lines.push(`        level: ${f.level}`);
      if (f.type) lines.push(`        type: ${f.type}`);
      if (f.uses != null) lines.push(`        uses: ${f.uses}`);
      if (f.trivial) lines.push(`        trivial: true`);
      if (f.image) lines.push(`        image: "${f.image}"`);
      if (f.origin) lines.push(`        origin: "${f.origin}"`);
      if (f.link) lines.push(`        link: "${f.link}"`);
      if (f.description) lines.push(`        description: "${f.description}"`);
    }
  }
  return lines.join("\n");
}

export function buildStatsYaml(
  abilities: AbilityScores,
  saves: Partial<Record<"str" | "dex" | "con" | "int" | "wis" | "cha", number>> = {},
): string {
  const entries: [string, keyof AbilityScores, "str" | "dex" | "con" | "int" | "wis" | "cha"][] = [
    ["STR", "strength", "str"],
    ["DEX", "dexterity", "dex"],
    ["CON", "constitution", "con"],
    ["INT", "intelligence", "int"],
    ["WIS", "wisdom", "wis"],
    ["CHA", "charisma", "cha"],
  ];
  return entries
    .map(
      ([key, ability, saveKey]) => `${key}:
  value: ${abilities[ability]}
  save:
    proficiency: ${saves[saveKey] ?? 0}
    vantage: 0
    bonus: 0`,
    )
    .join("\n");
}
