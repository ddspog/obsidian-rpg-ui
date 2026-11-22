/**
 * Applying a creature template (monster-template.ts) to a `stat.monster` block's
 * data: its Statistics lines carried out where the book's words are plain (a type
 * that changes, hit points reduced by a percentage, resistances, darkvision,
 * ability modifiers, speeds…), its features added as refs to the template
 * features note with their formulas worked out for this creature. What needs a
 * person (a choice not made, a feature it changes, a rule of play) comes back in
 * `manual`. Pure: no Obsidian and no I/O.
 */

import {
  CONDITIONS,
  CREATURE_TYPES,
  DAMAGE_TYPES,
  evaluateFormula,
  plainText,
  templateFeatureId,
  type FormulaContext,
  type MonsterTemplate,
  type TemplateChoice,
} from "./monster-template";

export interface ApplyTemplateOptions {
  /** The option chosen ("fire", "summer", "air:thunder", a damage type). */
  choice?: string;
  /** Features to choose (the list ones: "Stench", "Spider Climb"). */
  picks?: string[];
  /** The features note's link path, without `.md`. */
  featureNote: string;
  /** The creature's own feature names and texts (for DCs, and what it may lose). */
  baseFeatures: Array<{ name: string; text: string }>;
  /** Its CR as a number. */
  cr: number;
}

export interface ApplyTemplateResult {
  data: Record<string, unknown>;
  /** What was changed, in words. */
  applied: string[];
  /** What is left to a person. */
  manual: string[];
  /** The features added. */
  added: string[];
  /** The option it was made with. */
  choice?: { key: string; damage: string };
}

type Abilities = Record<string, number>;

/** The proficiency bonus of a CR. */
export function pbOfCr(cr: number): number {
  return cr < 5 ? 2 : cr < 9 ? 3 : cr < 13 ? 4 : cr < 17 ? 5 : cr < 21 ? 6 : cr < 25 ? 7 : cr < 29 ? 8 : 9;
}

/** A defence line ("fire, cold | charmed | Undead Resilience") in its three parts. */
export interface Defences {
  damage: string[];
  conditions: string[];
  other: string[];
}

export function parseDefences(line: unknown): Defences {
  const out: Defences = { damage: [], conditions: [], other: [] };
  const text = String(line ?? "").trim();
  if (!text || text === "—" || text === "-") return out;
  for (const part of text.split("|")) {
    for (const raw of part.split(/,\s*(?![^()]*\))/)) {
      const item = raw.trim().replace(/^and\s+/, "");
      if (!item) continue;
      const low = item.toLowerCase();
      if ((DAMAGE_TYPES as readonly string[]).includes(low) || /damage from nonmagical/.test(low)) out.damage.push(low);
      else if ((CONDITIONS as readonly string[]).includes(low)) out.conditions.push(low);
      else out.other.push(item);
    }
  }
  return out;
}

export function formatDefences(d: Defences): string {
  const parts = [d.damage, d.conditions, d.other].filter((p) => p.length).map((p) => [...new Set(p)].join(", "));
  return parts.join(" | ");
}

/** Damage types and conditions a clause names ("cold, fire, and lightning damage and the charmed condition"). */
function defenceWords(clause: string): Defences {
  const low = clause.toLowerCase();
  const out: Defences = { damage: [], conditions: [], other: [] };
  const nonmagical = low.match(/((?:(?:bludgeoning|piercing|slashing),? (?:and )?)+damage from nonmagical attacks)/);
  if (nonmagical) out.damage.push(nonmagical[1].replace(/,? and /g, ", ").replace(/ damage from/, " damage from"));
  const rest = nonmagical ? low.replace(nonmagical[1], "") : low;
  for (const d of DAMAGE_TYPES) if (new RegExp(`\\b${d}\\b`).test(rest)) out.damage.push(d);
  for (const c of CONDITIONS) if (new RegExp(`\\b${c}\\b`).test(rest)) out.conditions.push(c);
  return out;
}

/** The creature's type line with its type changed: "Large [[Beast]]" → "Large [[Undead]]". */
export function withType(line: string, type: string): string {
  const re = new RegExp(`(\\[\\[)?\\b(${CREATURE_TYPES.join("|")})\\b(\\]\\])?`, "i");
  if (!re.test(line)) return `${line} ${type}`.trim();
  return line.replace(re, (_, open?: string, _t?: string, close?: string) => (open && close ? `[[${type}]]` : type));
}

/** A tag added to (or taken from) the type line's parentheses. */
export function withTag(line: string, tag: string, remove = false): string {
  const m = line.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  const tags = m
    ? m[2]
        .split(/,\s*/)
        .map((t) => t.trim())
        .filter(Boolean)
    : [];
  const bare = (t: string) => t.replace(/^\[\[|\]\]$/g, "").toLowerCase();
  const kept = remove ? tags.filter((t) => bare(t) !== tag.toLowerCase()) : tags;
  if (!remove && !kept.some((t) => bare(t) === tag.toLowerCase())) kept.push(tag);
  const head = m ? m[1] : line;
  return kept.length ? `${head} (${kept.join(", ")})` : head;
}

/** Speeds moved: every one by `delta`, or only `only` ("fly"); never under `floor`. */
export function withSpeeds(line: string, delta: number, only?: string, floor = 10): string {
  return line.replace(/(\b[a-z]+ )?(\d+) ft\./gi, (all, mode: string | undefined, n: string) => {
    const kind = (mode ?? "").trim().toLowerCase();
    if (only && kind !== only) return all;
    const v = Number(n);
    if (v === 0) return all;
    const next = delta < 0 ? Math.max(Math.min(v, floor), v + delta) : v + delta;
    return `${mode ?? ""}${next} ft.`;
  });
}

function pickChoice(
  template: MonsterTemplate,
  choice?: string
): { key: string; damage: string; option: TemplateChoice } | undefined {
  if (!choice || template.choices.length === 0) return undefined;
  const [a, b] = choice
    .toLowerCase()
    .split(":")
    .map((s) => s.trim());
  const byKey = template.choices.find((c) => c.key === a || c.key.startsWith(a));
  if (byKey) {
    const damage = b && byKey.damage.includes(b) ? b : byKey.damage[0];
    return { key: byKey.key, damage, option: byKey };
  }
  const byDamage = template.choices.find((c) => c.damage.includes(a));
  return byDamage ? { key: byDamage.key, damage: a, option: byDamage } : undefined;
}

export function applyTemplate(
  input: Record<string, unknown>,
  template: MonsterTemplate,
  options: ApplyTemplateOptions
): ApplyTemplateResult {
  const data: Record<string, unknown> = { ...input };
  const stats: Record<string, unknown> = { ...((input.stats as Record<string, unknown>) ?? {}) };
  const abilities: Abilities = { ...((input.abilities as Abilities) ?? {}) };
  const applied: string[] = [];
  const manual: string[] = [];
  const added: string[] = [];
  let type = String(data.type ?? "");
  let cr = options.cr;
  const pb = () => pbOfCr(cr);
  const chosen = pickChoice(template, options.choice);
  if (template.choices.length && !chosen) {
    manual.push(
      `Choose with --choose: ${template.choices.map((c) => `${c.key} (${c.damage.join(" or ")})`).join(", ")}${options.choice ? ` ("${options.choice}" is none of them)` : ""}.`
    );
  } else if (template.choiceText && !template.choices.length) {
    manual.push(template.choiceText);
  }

  const defence = (key: "resistant" | "immune" | "vulnerable") => parseDefences(stats[key]);
  const setDefence = (key: "resistant" | "immune" | "vulnerable", d: Defences) => {
    const text = formatDefences(d);
    if (text) stats[key] = text;
    else delete stats[key];
  };
  const addDefence = (key: "resistant" | "immune" | "vulnerable", words: Defences) => {
    const d = defence(key);
    d.damage.push(...words.damage);
    d.conditions.push(...words.conditions);
    d.other.push(...words.other);
    setDefence(key, d);
  };
  const dexBefore = abilities.dex ?? 0;
  let acFromDex = false;
  let naturalAc: number | undefined;

  for (const line of template.stats) {
    const label = plainText(line.label).toLowerCase();
    const text = plainText(line.text);
    const low = text.toLowerCase();
    let done = false;

    if (/type/.test(label)) {
      const to = text.match(/type changes to ([A-Z][a-z]+)/);
      if (to) {
        type = withType(type, to[1]);
        applied.push(`type: ${to[1]}`);
        done = true;
      }
      for (const tag of text.matchAll(/gains the ([A-Z][a-z]+) tag/g)) {
        type = withTag(type, tag[1]);
        applied.push(`tag: ${tag[1]}`);
        done = true;
      }
      if (/\bsize\b/.test(label)) manual.push(`Size: ${text}`);
    } else if (label === "tag") {
      for (const tag of text.matchAll(/gains the ([A-Z][a-z]+) tag/g)) {
        type = withTag(type, tag[1]);
        applied.push(`tag: ${tag[1]}`);
      }
      const lose = text.match(/If it has the ([A-Z][a-z]+) tag, it loses that tag/);
      if (lose) type = withTag(type, lose[1], true);
      done = true;
      if (/home plane/.test(low)) manual.push(`Tag: ${text}`);
    } else if (label === "hit points") {
      const cap = low.match(/if the creature's cr is (\d+) or lower/);
      const hp = parseInt(String(stats.hp ?? ""), 10);
      const pct = low.match(/(reduced|increased) by (\d+) percent/);
      const flat = low.match(/increased by (\d+)\.?$/) ?? low.match(/increased by (\d+)(?! percent)/);
      if (cap && cr > Number(cap[1])) {
        applied.push(`HP unchanged (CR above ${cap[1]})`);
        done = true;
      } else if (Number.isFinite(hp) && pct) {
        const change = Math.ceil((hp * Number(pct[2])) / 100);
        const next = pct[1] === "reduced" ? Math.max(1, hp - change) : hp + change;
        stats.hp = String(next);
        applied.push(`HP ${hp} → ${next} (${pct[1]} by ${pct[2]}%)`);
        done = true;
      } else if (Number.isFinite(hp) && flat) {
        stats.hp = String(hp + Number(flat[1]));
        applied.push(`HP ${hp} → ${hp + Number(flat[1])}`);
        done = true;
      }
    } else if (label === "armor class") {
      const plus = low.match(/increases by (\d+)/);
      const nat = low.match(/natural armor class of (\d+) \+ dex modifier/);
      if (plus) {
        stats.ac = withLeadingNumber(stats.ac, (n) => n + Number(plus[1]));
        applied.push(`AC +${plus[1]}`);
        done = true;
      } else if (nat) {
        naturalAc = Number(nat[1]);
        done = true;
      } else if (/dex reduces/.test(low)) {
        acFromDex = true;
        done = true;
      }
    } else if (label === "cr") {
      const m = low.match(/increases by (\d+)(?:, up to cr (\d+))?/);
      if (m) {
        cr = Math.min(Number(m[2] ?? 30), cr + Number(m[1]));
        data.cr = String(cr);
        applied.push(`CR ${options.cr} → ${cr}`);
        done = true;
      }
    } else if (/resist|immune|vulnerab/.test(label)) {
      done = true;
      for (const clause of text.split(/,? and it is |\. In addition, it is |\.\s+/)) {
        const m = clause.match(/\b(resistant|immune|vulnerable) to (.*)$/i);
        if (!m) continue;
        const key = m[1].toLowerCase() as "resistant" | "immune" | "vulnerable";
        let words: Defences;
        if (/you didn't choose/.test(m[2])) {
          if (!chosen) {
            done = false;
            continue;
          }
          words = { damage: chosen.option.damage.filter((d) => d !== chosen.damage), conditions: [], other: [] };
        } else if (/you chose|associated with/.test(m[2])) {
          if (!chosen) {
            done = false;
            continue;
          }
          words = { damage: [chosen.damage], conditions: defenceWords(m[2]).conditions, other: [] };
        } else words = defenceWords(m[2]);
        addDefence(key, words);
        applied.push(`${key}: ${formatDefences(words)}`);
        if (key === "vulnerable" && /replaces that with this vulnerability/.test(low)) {
          for (const k of ["resistant", "immune"] as const) {
            const d = defence(k);
            d.damage = d.damage.filter((x) => !words.damage.includes(x));
            setDefence(k, d);
          }
        }
      }
    } else if (label === "senses") {
      let senses = String(stats.senses ?? "").trim();
      if (senses === "—" || senses === "-") senses = "";
      const dark = low.match(/has darkvision (?:out )?to (?:a range of )?(\d+) feet/);
      const truesight = /darkvision changes to truesight/.test(low);
      const ranges = [
        ...low.matchAll(/(darkvision|keensense|truesight|tremorsense|blindsight) range increases to (\d+) feet/g),
      ];
      if (dark && !/darkvision/.test(senses)) {
        senses = [`darkvision ${dark[1]} ft.`, senses].filter(Boolean).join(", ");
        applied.push(`darkvision ${dark[1]} ft.`);
        done = true;
      } else if (dark) done = true;
      if (truesight) {
        senses = senses.replace(/darkvision/, "truesight");
        applied.push("darkvision → truesight");
        done = true;
      }
      for (const r of ranges) {
        const re = new RegExp(`${r[1]} (\\d+) ft\\.`);
        const had = senses.match(re);
        if (had) senses = senses.replace(re, `${r[1]} ${Math.max(Number(had[1]), Number(r[2]))} ft.`);
        else senses = [senses, `${r[1]} ${r[2]} ft.`].filter(Boolean).join(", ");
        done = true;
      }
      stats.senses = senses || "—";
    } else if (label === "languages") {
      const had = String(stats.languages ?? "").trim();
      const none = !had || had === "—" || had === "-";
      const mute = /can['’]t speak/i.test(had);
      if (/understands (?:all )?(?:the )?languages it knew in life/.test(low) && /can't speak/.test(low)) {
        stats.languages = none ? "—" : mute ? had : `understands ${had} but can't speak`;
        done = true;
      } else if (/understands the languages of its creator but can't speak/.test(low)) {
        stats.languages = "understands the languages of its creator but can't speak";
        done = true;
      } else {
        const knows = text.match(/knows ([A-Z][\w ]+?), but it can't speak the language unless/);
        if (knows) {
          stats.languages = none ? `understands ${knows[1]} but can't speak` : `${had}, ${knows[1]}`;
          done = true;
        }
      }
      const tele = low.match(/telepathy to a range of (\d+) feet/);
      if (tele && !/^if /.test(low)) {
        stats.languages = [String(stats.languages ?? ""), `telepathy ${tele[1]} ft.`]
          .filter((s) => s && s !== "—")
          .join(", ");
      } else if (tele && !none) {
        stats.languages = `${String(stats.languages)}, telepathy ${tele[1]} ft.`;
      }
      if (done) applied.push(`languages: ${String(stats.languages)}`);
      if (/learns one language|chosen humanoid/.test(low)) {
        manual.push(`Languages: ${text}`);
        done = true;
      }
    } else if (label === "abilities") {
      const head = text.split(/\.\s+If /)[0];
      const atLeast = /already higher|is higher than/.test(low);
      const atMost = /already lower/.test(low);
      if (atLeast !== atMost && !/chosen humanoid/.test(low)) {
        for (const m of head.matchAll(/\b(STR|DEX|CON|INT|WIS|CHA) (?:to )?([+-]\d+)/g)) {
          const k = m[1].toLowerCase();
          const v = Number(m[2]);
          const was = abilities[k] ?? 0;
          abilities[k] = atLeast ? Math.max(was, v) : Math.min(was, v);
          if (abilities[k] !== was) applied.push(`${m[1]} ${fmt(was)} → ${fmt(abilities[k])}`);
        }
        const single = head.match(/existing (STR|DEX|CON|INT|WIS|CHA) modifier with ([+-]\d+)/);
        if (single) {
          const k = single[1].toLowerCase();
          const was = abilities[k] ?? 0;
          abilities[k] = atLeast ? Math.max(was, Number(single[2])) : Math.min(was, Number(single[2]));
          if (abilities[k] !== was) applied.push(`${single[1]} ${fmt(was)} → ${fmt(abilities[k])}`);
        }
        done = true;
      }
    } else if (label === "speed") {
      const speed = String(stats.speed ?? "");
      const cond = low.match(/^if the [a-z' -]+?'s season is (\w+), increase all its movement speeds by (\d+) feet/);
      const all = low.match(/all (?:the [a-z' -]+?'s |its )?movement speeds (increase|are reduced) by (\d+) feet/);
      const fly = low.match(/if the creature has a flying speed, that speed increases by (\d+) feet/);
      if (cond) {
        done = !!chosen || template.choices.length === 0;
        if (chosen?.key === cond[1]) {
          stats.speed = withSpeeds(speed, Number(cond[2]));
          applied.push(`speeds +${cond[2]} ft.`);
        }
      } else if (all) {
        const d = (all[1] === "increase" ? 1 : -1) * Number(all[2]);
        stats.speed = withSpeeds(speed, d);
        applied.push(`speeds ${d > 0 ? "+" : ""}${d} ft.`);
        done = true;
      } else if (fly) {
        stats.speed = withSpeeds(speed, Number(fly[1]), "fly");
        if (stats.speed !== speed) applied.push(`fly +${fly[1]} ft.`);
        done = true;
      }
    } else if (label === "stealth" || label === "perception") {
      const key = label === "stealth" ? "pas_stealth" : "pas_perception";
      const n = Number(stats[key]);
      if (/increases by an amount equal to its pb/.test(low) && Number.isFinite(n)) {
        stats[key] = n + pb();
        applied.push(`${label} ${n} → ${n + pb()}`);
        done = true;
      }
    }
    if (!done) manual.push(`${line.label}: ${line.text}`);
  }

  // Perception and Stealth follow WIS and DEX.
  const wisBefore = Number((input.abilities as Abilities | undefined)?.wis ?? 0);
  for (const [key, delta] of [
    ["pas_perception", (abilities.wis ?? 0) - wisBefore],
    ["pas_stealth", (abilities.dex ?? 0) - dexBefore],
  ] as const) {
    const n = Number(stats[key]);
    if (delta !== 0 && Number.isFinite(n) && stats[key] !== undefined) stats[key] = n + delta;
  }

  // AC follows the abilities: a lower DEX lowers it; a natural armor floor raises it.
  const dexNow = abilities.dex ?? 0;
  if (acFromDex && dexNow !== dexBefore) {
    stats.ac = withLeadingNumber(stats.ac, (n) => n + (dexNow - dexBefore));
    applied.push(`AC ${fmt(dexNow - dexBefore)} (DEX)`);
  }
  if (naturalAc !== undefined) {
    const floor = naturalAc + dexNow;
    const ac = parseInt(String(stats.ac ?? ""), 10);
    if (!Number.isFinite(ac) || ac < floor) {
      stats.ac = `${floor} (natural armor)`;
      applied.push(`AC ${floor} (natural armor)`);
    }
  }

  // Features: the template's, refs to the features note with their numbers for this creature.
  const picks = (options.picks ?? []).map((p) => p.toLowerCase());
  const texts = options.baseFeatures.map((f) => f.text);
  const dcs = texts.flatMap((t) => [...t.matchAll(/\bDC (\d+)/g)].map((m) => Number(m[1])));
  const hpNow = parseInt(String(stats.hp ?? ""), 10) || 0;
  const ctx: FormulaContext = {
    cr,
    pb: pbOfCr(cr),
    hp: hpNow,
    abilities,
    dcs,
    dcOf: (word) => {
      const f = options.baseFeatures.find((x) => new RegExp(word, "i").test(x.name));
      const m = f?.text.match(/\bDC (\d+)/);
      return m ? Number(m[1]) : undefined;
    },
    perception: Number.isFinite(Number(stats.pas_perception)) ? Number(stats.pas_perception) : undefined,
  };
  const optional = template.features.filter((f) => f.optional);
  for (const p of picks) {
    if (!optional.some((f) => f.key.toLowerCase() === p))
      manual.push(
        `No feature "${p}" to choose${optional.length ? ` (${optional.map((f) => f.key).join(", ")})` : ""}.`
      );
  }
  const refs: Array<Record<string, unknown>> = [];
  const baseNames = new Set(options.baseFeatures.map((f) => f.name.toLowerCase()));
  for (const f of template.features) {
    if (f.alters) {
      manual.push(`${f.key} (changes a feature it has): ${f.text.replace(/\{\{ self\.name\(\) \}\}/g, "creature")}`);
      continue;
    }
    if (f.optional && !picks.includes(f.key.toLowerCase())) continue;
    if (f.choice && (!chosen || chosen.key !== f.choice)) continue;
    if (baseNames.has(f.key.toLowerCase())) {
      applied.push(`${f.key}: it has it already`);
      continue;
    }
    const params: Record<string, unknown> = {};
    for (const [k, formula] of Object.entries(f.formulas)) {
      const v = evaluateFormula(formula, ctx);
      if (v !== undefined) params[k] = v;
      else manual.push(`${f.key}: fill in "${formula}" (the ref's ${k}).`);
    }
    refs.push({ ref: `@[[${options.featureNote}]]#${templateFeatureId(template.name, f)}`, ...params });
    added.push(f.key);
    // A Resilience trait is named on the defence line it grants, as the book's statblocks do.
    if (/resilience$/i.test(f.key)) {
      const key = /\bis immune\b/i.test(f.text) ? "immune" : "resistant";
      addDefence(key, { damage: [], conditions: [], other: [f.key] });
    }
  }
  if (optional.length && picks.length === 0) {
    manual.push(`Choose features with --pick: ${optional.map((f) => f.key).join(", ")}.`);
  }
  // The rules that only say which choice gives which feature are carried out when a choice is made.
  const gated = template.features.filter((f) => f.choice).map((f) => f.key);
  for (const rule of template.rules) {
    if (chosen && gated.some((k) => rule.includes(k))) continue;
    manual.push(rule);
  }

  // What it may lose (the book's "loses all traits and actions that assume it has a living body…").
  const loses = (template.losesText ?? "").toLowerCase();
  const lose = options.baseFeatures
    .map((f) => f.name)
    .filter(
      (n) =>
        (/living body/.test(loses) && /^amphibious\b/i.test(n)) ||
        (/complex knowledge|spellcasting/.test(loses) && /spellcasting/i.test(n)) ||
        (/change its shape|shape/.test(loses) && /^(change shape|shapechanger)\b/i.test(n)) ||
        (/breath weapons? it has|loses any breath/.test(loses) && /breath/i.test(n)) ||
        (/related to its breath/.test(loses) && /\b(scales|chill|breath)\b/i.test(n) && !/^.*breath \(/i.test(n)) ||
        (/shed light/.test(loses) && /illumination|light/i.test(n))
    );
  if (lose.length)
    manual.push(`It loses ${[...new Set(lose)].join(", ")} (${template.losesText}): remove them by hand.`);

  data.type = type;
  data.stats = Object.fromEntries(Object.entries(stats).sort(([a], [b]) => statOrder(a) - statOrder(b)));
  data.abilities = abilities;
  data.features = [...((input.features as unknown[]) ?? []), ...refs];
  return { data, applied, manual, added, ...(chosen ? { choice: { key: chosen.key, damage: chosen.damage } } : {}) };
}

const STAT_ORDER = [
  "ac",
  "hp",
  "speed",
  "pas_perception",
  "pas_stealth",
  "vulnerable",
  "resistant",
  "immune",
  "senses",
  "languages",
];
const statOrder = (k: string) => (STAT_ORDER.includes(k) ? STAT_ORDER.indexOf(k) : STAT_ORDER.length);

function fmt(n: number): string {
  return n >= 0 ? `+${n}` : String(n);
}

function withLeadingNumber(line: unknown, f: (n: number) => number): string {
  const text = String(line ?? "");
  const m = text.match(/^\s*(\d+)/);
  return m ? text.replace(/^\s*\d+/, String(f(Number(m[1])))) : text;
}
