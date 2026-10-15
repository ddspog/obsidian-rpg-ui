/**
 * What the conditions in play do to a card's rolls — read from the system's
 * own condition rules (`concepts/conditions/*`), so a homebrew condition says
 * its own piece:
 *
 *   Attack: advantage — Kobold, Elite is blinded
 *   DEX save: automatically fails — Kobold, Elite is stunned
 *   Attack: disadvantage — Talon is prone (and Kobold, Elite is blinded: they cancel)
 *
 * The card writes it into its rolls ({@link withAdvice}): `2d20kl1+6=` — both
 * dice rolled, one kept — and says why.
 */

import type { SessionFeatureCard } from "./card-types";

/** What a condition does to rolls, as its rules say. */
export interface ConditionEffects {
  /** Attacks against its bearer: advantage / disadvantage. */
  attackedWith?: "advantage" | "disadvantage";
  /** Its bearer's own attacks. */
  attacksWith?: "advantage" | "disadvantage";
  /** Attacks against it: advantage within 5 ft, disadvantage beyond (prone). */
  closeOnly?: boolean;
  /** Saves it fails without rolling (`STR`, `DEX`). */
  failsSaves?: string[];
  /** Saves it makes at disadvantage. */
  saveDisadvantage?: string[];
}

const ABILITY: Record<string, string> = {
  strength: "STR",
  dexterity: "DEX",
  constitution: "CON",
  intelligence: "INT",
  wisdom: "WIS",
  charisma: "CHA",
};

/** `[[Advantage|disadvantage]]` → `disadvantage`, `[[advantage]]` → `advantage`. */
const plain = (text: string) => text.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2").replace(/\[\[([^\]]+)\]\]/g, "$1");

/** A condition's rules, read for what they do to rolls. */
export function readConditionRules(rules: string[]): ConditionEffects {
  const text = plain(rules.join(" "));
  const out: ConditionEffects = {};
  if (/attack rolls? against (?:a|an) [\w-]+ creature has advantage if the attacker is within 5 feet/i.test(text))
    out.closeOnly = true;
  else {
    const against = text.match(/attack rolls? against (?:a|an) [\w-]+ creature ha(?:ve|s) (advantage|disadvantage)/i);
    if (against) out.attackedWith = against[1].toLowerCase() as "advantage" | "disadvantage";
  }
  const own =
    text.match(/creature['’]s attack rolls have (advantage|disadvantage)/i) ??
    text.match(/has (disadvantage) on (?:ability checks and )?attack rolls/i) ??
    text.match(/has (disadvantage) on attack rolls/i);
  if (own) out.attacksWith = own[1].toLowerCase() as "advantage" | "disadvantage";
  const fails = text.match(/automatically fails (\w+) and (\w+) saves/i);
  if (fails) out.failsSaves = [fails[1], fails[2]].map((a) => ABILITY[a.toLowerCase()] ?? a.toUpperCase());
  const dis = [...text.matchAll(/disadvantage on (\w+) saves/gi)].map(
    (m) => ABILITY[m[1].toLowerCase()] ?? m[1].toUpperCase()
  );
  if (dis.length > 0) out.saveDisadvantage = dis;
  return out;
}

/** One roll's advice: what to roll with, and why. */
export interface RollAdvice {
  roll: string;
  verdict: "advantage" | "disadvantage" | "fails" | "cancels";
  why: string;
}

/**
 * The advice for a card's rolls: its attack (the actor's conditions, its
 * target's — `within5` for prone), and the save its target makes (or the actor
 * makes, shaking off a status: `saveBy`).
 */
export function adviseRolls(opts: {
  attack: boolean;
  save?: { ability: string; by: string };
  actor: string;
  target?: string;
  conditionsOf: (name: string) => string[];
  effectsOf: (condition: string) => ConditionEffects | undefined;
  within5?: boolean;
  /** Advantage / disadvantage the actor's own features give (a toggled Rage). */
  granted?: SessionFeatureCard["grants"];
}): RollAdvice[] {
  const out: RollAdvice[] = [];
  if (opts.attack) {
    const adv: string[] = (opts.granted?.attack?.advantage ?? []).map((f) => `${opts.actor}'s ${f}`);
    const dis: string[] = (opts.granted?.attack?.disadvantage ?? []).map((f) => `${opts.actor}'s ${f}`);
    for (const c of opts.conditionsOf(opts.actor)) {
      const e = opts.effectsOf(c);
      if (e?.attacksWith === "advantage") adv.push(`${opts.actor} is ${c}`);
      if (e?.attacksWith === "disadvantage") dis.push(`${opts.actor} is ${c}`);
    }
    if (opts.target) {
      for (const c of opts.conditionsOf(opts.target)) {
        const e = opts.effectsOf(c);
        if (e?.closeOnly)
          (opts.within5 ? adv : dis).push(`${opts.target} is ${c}${opts.within5 ? "" : ", out past 5 ft"}`);
        else if (e?.attackedWith === "advantage") adv.push(`${opts.target} is ${c}`);
        else if (e?.attackedWith === "disadvantage") dis.push(`${opts.target} is ${c}`);
      }
    }
    if (adv.length > 0 && dis.length > 0)
      out.push({ roll: "Attack", verdict: "cancels", why: [...adv, ...dis].join(", ") });
    else if (adv.length > 0) out.push({ roll: "Attack", verdict: "advantage", why: adv.join(", ") });
    else if (dis.length > 0) out.push({ roll: "Attack", verdict: "disadvantage", why: dis.join(", ") });
  }
  if (opts.save) {
    const ability = opts.save.ability.toUpperCase();
    const fails: string[] = [];
    const dis: string[] = [];
    for (const c of opts.conditionsOf(opts.save.by)) {
      const e = opts.effectsOf(c);
      if (e?.failsSaves?.includes(ability)) fails.push(`${opts.save.by} is ${c}`);
      if (e?.saveDisadvantage?.includes(ability)) dis.push(`${opts.save.by} is ${c}`);
    }
    // A feature of the one saving: `Rage` giving advantage on STR saves.
    const adv =
      opts.save.by === opts.actor
        ? (opts.granted?.saves?.advantage?.[ability] ?? []).map((f) => `${opts.actor}'s ${f}`)
        : [];
    const grantedDis =
      opts.save.by === opts.actor
        ? (opts.granted?.saves?.disadvantage?.[ability] ?? []).map((f) => `${opts.actor}'s ${f}`)
        : [];
    dis.push(...grantedDis);
    if (fails.length > 0) out.push({ roll: `${ability} save`, verdict: "fails", why: fails.join(", ") });
    else if (adv.length > 0 && dis.length > 0)
      out.push({ roll: `${ability} save`, verdict: "cancels", why: [...adv, ...dis].join(", ") });
    else if (adv.length > 0) out.push({ roll: `${ability} save`, verdict: "advantage", why: adv.join(", ") });
    else if (dis.length > 0) out.push({ roll: `${ability} save`, verdict: "disadvantage", why: dis.join(", ") });
  }
  return out;
}

/** A condition's end its source says, when it says one: `until the end of its next turn`. */
export function durationOf(text: string | undefined): "end-of-next-turn" | undefined {
  return text && /until (?:the )?end of (?:its|their|your) next turn/i.test(text) ? "end-of-next-turn" : undefined;
}

/**
 * A card's lines with the advice written in, as the Log rolls it: advantage
 * `2d20kh1+6=`, disadvantage `2d20kl1+6=` (both dice rolled, one kept); a save
 * that fails without rolling, `-> Failure`. A cancel leaves the plain d20.
 */
export function withAdvice(template: string, advice: RollAdvice[]): string {
  if (advice.length === 0) return template;
  const lines = template.split("\n");
  for (const a of advice) {
    const label =
      a.roll === "Attack"
        ? /^d(?:\([^)]*\))?:\s*attack\b/i
        : new RegExp(`^d(?:\\([^)]*\\))?:\\s*${a.roll.split(" ")[0]}\\s+save\\b`, "i");
    const at = lines.findIndex((l) => label.test(l.trim()));
    if (at < 0) continue;
    if (a.verdict === "advantage" || a.verdict === "disadvantage") {
      const keep = a.verdict === "advantage" ? "kh1" : "kl1";
      lines[at] = lines[at].replace(/(\|\s*)1?d20(?![\d])/i, `$12d20${keep}`);
    } else if (a.verdict === "fails") {
      lines[at] = /(->|→)\s*\S/.test(lines[at]) ? lines[at] : lines[at].replace(/\s*(->|→)?\s*$/, " -> Failure");
    }
  }
  return lines.join("\n");
}
