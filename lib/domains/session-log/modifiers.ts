/**
 * What passive and toggled features do to the other cards. A feature says so
 * with `modifies:` —
 *
 *   active:
 *     name: Rage
 *     modifies:
 *       - { on: melee attack, damage: +2 }
 *       - { on: save, advantage: STR }
 *
 * — and, while it applies (a passive: always; an active: while it's on), each
 * card it touches gets its numbers written into its rolls (`1d8+4` → `1d8+6`),
 * advantage handed to the roll advice, and a line saying who changed what.
 * An active is on or off by a switch kept in the plugin's state (under the
 * log's state key) — not by anything written in the log — so any card can
 * read it.
 */

import type { AspectModifier } from "../features/types";
import type { SessionFeatureCard } from "./card-types";

/** A `modifies:` as a list; entries with nothing to say or touch are dropped. */
export function readModifiers(raw: unknown): AspectModifier[] {
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.flatMap((m): AspectModifier[] => {
    if (!m || typeof m !== "object") return [];
    const o = m as Record<string, unknown>;
    if (typeof o.on !== "string" || !o.on.trim()) return [];
    return [
      {
        on: o.on.trim(),
        ...(typeof o.damage === "number" || typeof o.damage === "string" ? { damage: o.damage } : {}),
        ...(typeof o.to_hit === "number" || typeof o.to_hit === "string" ? { to_hit: o.to_hit } : {}),
        ...(o.advantage === true || typeof o.advantage === "string" ? { advantage: o.advantage } : {}),
        ...(o.disadvantage === true || typeof o.disadvantage === "string" ? { disadvantage: o.disadvantage } : {}),
        ...(typeof o.note === "string" ? { note: o.note } : {}),
      },
    ];
  });
}

const norm = (s: string) =>
  s
    .replace(/[ᴬᴮᴰᴴᴷᴺº]/gu, "")
    .trim()
    .toLowerCase();

/** Whether a modifier's `on` names this card. */
export function touches(card: SessionFeatureCard, on: string): boolean {
  const what = norm(on);
  const attacks = card.bucket === "attack" || /^d(?:\([^)]*\))?:\s*attack\b/im.test(card.logTemplate);
  const spell = card.origin === "spell" || !!card.cast;
  switch (what) {
    case "attack":
    case "attacks":
    case "weapon attack":
      return attacks && (what !== "weapon attack" || card.origin === "weapon");
    case "melee attack":
    case "melee":
      return attacks && card.attackForm === "melee";
    case "ranged attack":
    case "ranged":
      return attacks && card.attackForm === "ranged";
    case "spell attack":
      return attacks && (spell || card.attackForm === "spell");
    case "spell":
    case "spells":
      return spell;
    case "save":
    case "saves":
      return /^d(?:\([^)]*\))?:\s*(?:STR|DEX|CON|INT|WIS|CHA)\s+save\b/im.test(card.logTemplate);
    default:
      return norm(card.name) === what;
  }
}

const signed = (n: number) => (n < 0 ? `${n}` : `+${n}`);

/** An expression with `add` added: a number folds into its flat bonus, dice are appended. */
export function addToExpression(expr: string, add: number | string): string {
  const e = expr.trim();
  if (typeof add === "string" && /d\d/i.test(add))
    return `${e}${/^[+-]/.test(add.trim()) ? add.trim() : `+${add.trim()}`}`;
  const n = typeof add === "number" ? add : Number(String(add).replace(/\s+/g, ""));
  if (!Number.isFinite(n) || n === 0) return e;
  const m = e.match(/^(.*?)([+-]\d+)$/);
  if (m) return `${m[1]}${signed(Number(m[2]) + n).replace(/^\+0$/, "")}`;
  return `${e}${signed(n)}`;
}

/** The damage lines (`d: Piercing damage | 1d8+4=`) with `add` on the first one. */
function addDamage(template: string, add: number | string): string {
  const lines = template.split("\n");
  const at = lines.findIndex((l) => /^d(?:\([^)]*\))?:\s*[\w' -]*damage\s*\|/i.test(l.trim()));
  if (at < 0) return template;
  lines[at] = lines[at].replace(
    /(\|\s*)([^=|]+?)(\s*=)/,
    (_m, a: string, expr: string, b: string) => `${a}${addToExpression(expr, add)}${b}`
  );
  return lines.join("\n");
}

/** The attack line (`d: Attack | d20+6=`) with `add` to the roll. */
function addToHit(template: string, add: number | string): string {
  const lines = template.split("\n");
  const at = lines.findIndex((l) => /^d(?:\([^)]*\))?:\s*attack\b/i.test(l.trim()));
  if (at < 0) return template;
  lines[at] = lines[at].replace(
    /(\|\s*)([^=|]+?)(\s*=)/,
    (_m, a: string, expr: string, b: string) => `${a}${addToExpression(expr, add)}${b}`
  );
  return lines.join("\n");
}

/** The abilities a save modifier names (`STR, CON` → both); all of them when it just says `true`. */
const abilitiesOf = (v: boolean | string): string[] =>
  v === true
    ? ["STR", "DEX", "CON", "INT", "WIS", "CHA"]
    : (String(v)
        .toUpperCase()
        .match(/STR|DEX|CON|INT|WIS|CHA/g) ?? []);

/** What a modifier does, in words — for the card to say. */
export function describeModifier(m: AspectModifier): string {
  const bits = [
    m.damage != null &&
      `${typeof m.damage === "number" ? signed(m.damage) : /^[+-]/.test(m.damage.trim()) ? m.damage.trim() : `+${m.damage.trim()}`} damage`,
    m.to_hit != null &&
      `${typeof m.to_hit === "number" ? signed(m.to_hit) : /^[+-]/.test(m.to_hit.trim()) ? m.to_hit.trim() : `+${m.to_hit.trim()}`} to hit`,
    m.advantage && `advantage${typeof m.advantage === "string" ? ` on ${m.advantage} saves` : ""}`,
    m.disadvantage && `disadvantage${typeof m.disadvantage === "string" ? ` on ${m.disadvantage} saves` : ""}`,
    m.note,
  ].filter(Boolean);
  return bits.join(", ");
}

/**
 * The card with what applies to it written in. `applying` is each feature that
 * applies now (a passive; an active that's on), by name.
 */
export function modifyCard(
  card: SessionFeatureCard,
  applying: Array<{ from: string; modifies: AspectModifier[] }>
): SessionFeatureCard {
  let out = card;
  const by: Array<{ from: string; text: string }> = [];
  const grants: NonNullable<SessionFeatureCard["grants"]> = {};
  for (const { from, modifies } of applying) {
    if (norm(from) === norm(card.name)) continue; // a feature doesn't modify itself
    for (const m of modifies) {
      if (!touches(card, m.on)) continue;
      let template = out.logTemplate;
      if (m.damage != null) template = addDamage(template, m.damage);
      if (m.to_hit != null) template = addToHit(template, m.to_hit);
      out = { ...out, logTemplate: template };
      const isSave = /^(save|saves)$/i.test(m.on.trim());
      for (const kind of ["advantage", "disadvantage"] as const) {
        const v = m[kind];
        if (!v) continue;
        if (isSave || (typeof v === "string" && abilitiesOf(v).length > 0 && !/attack/i.test(m.on))) {
          const saves = (grants.saves ??= {});
          const map = (saves[kind] ??= {});
          for (const ab of abilitiesOf(v)) (map[ab] ??= []).push(from);
        } else {
          const attack = (grants.attack ??= {});
          (attack[kind] ??= []).push(from);
        }
      }
      by.push({ from, text: describeModifier(m) || m.on });
    }
  }
  if (by.length === 0) return card;
  return { ...out, modifiedBy: [...(card.modifiedBy ?? []), ...by], ...(Object.keys(grants).length ? { grants } : {}) };
}

/** A toggle's key in the state: `kowyn|rage`. */
export const toggleKey = (actor: string, name: string) => `${norm(actor)}|${norm(name)}`;
