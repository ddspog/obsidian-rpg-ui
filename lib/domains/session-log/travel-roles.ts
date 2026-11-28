/**
 * A journey's roles as Uncharted Journeys gives them ("Roles", the Group Travel Check): the checks each may
 * make, and its Role Ability. The Travel card offers only a role's own skills, says the rest (tools, an
 * instrument) and the ability under the row, and links the rules.
 */

/** The rules notes the Travel card links (and previews on hover). */
export const ROLES_NOTE = "tales-of-the-valiant/compendium/rules/uncharted-journeys/01. Roles";
export const TRAVEL_CHECK_NOTE = "tales-of-the-valiant/topics/journey-rules/03. Stage 3, Make the Journey";

/** One role: the skills it may roll for the Group Travel Check, the other checks it may make, its ability. */
export interface TravelRoleRule {
  role: string;
  /** In the order the rules list them: the first is the role's default. */
  skills: string[];
  /** Checks that aren't skills (tools, an instrument), said but not offered. */
  other: string[];
  /** The Role Ability, once per Journey. */
  ability: string;
}

export const TRAVEL_ROLE_RULES: TravelRoleRule[] = [
  {
    role: "Leader",
    skills: ["Persuasion", "Insight", "Performance"],
    other: ["a Musical Instrument"],
    ability: "Inspirational Resolve",
  },
  { role: "Outrider", skills: ["Survival", "Nature"], other: ["Cartographer's Tools"], ability: "Find the Path" },
  {
    role: "Quartermaster",
    skills: ["Athletics"],
    other: ["Blacksmith's Tools", "Leatherworker's Tools", "Cook's Utensils", "Brewer's Supplies"],
    ability: "Well Prepared",
  },
  { role: "Sentry", skills: ["Perception", "Stealth"], other: ["a Disguise Kit"], ability: "Ever Vigilant" },
];

/** The rules for a role by its name (as typed: any case, spaces trimmed); none for a role the rules don't name. */
export function roleRule(role: string): TravelRoleRule | undefined {
  const key = role.trim().toLowerCase();
  return TRAVEL_ROLE_RULES.find((r) => r.role.toLowerCase() === key);
}

/** The skills a role may roll; undefined for a role the rules don't name (any skill goes). */
export function checksOf(role: string): string[] | undefined {
  return roleRule(role)?.skills;
}

/** A skill the role may roll: the one given when the role allows it (or the rules don't name the role),
 *  else the role's first. */
export function fitSkill(role: string, skill: string): string {
  const allowed = checksOf(role);
  return !allowed || allowed.includes(skill) ? skill : allowed[0];
}

/** "a, b or c". */
const list = (items: string[]) =>
  items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} or ${items[items.length - 1]}`;

/** The line under a role's row: `Checks: Persuasion, Insight or Performance, or a Musical Instrument. Ability: Inspirational Resolve.` */
export function checksHint(rule: TravelRoleRule): string {
  const checks = rule.other.length > 0 ? `${list(rule.skills)}, or ${list(rule.other)}` : list(rule.skills);
  return `Checks: ${checks}. Ability: ${rule.ability}.`;
}
