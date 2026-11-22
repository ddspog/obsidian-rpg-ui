/**
 * Lineages as templates: what a "Humanoid (Any Lineage)" NPC statblock gains to
 * be of a lineage (a guard becomes a dwarf guard, a mage apprentice a goblin
 * mage apprentice), as a `stat.template` block of kind `lineage`.
 *
 * Two sources, the book's first:
 * - the Monster Vault's **NPC Features** table: a row a humanoid (its traits,
 *   senses, speeds and resistances, and the actions taken from its own
 *   statblock), read by {@link lineageFromNpcRow};
 * - a lineage note's **Lineage Traits** (the Player's Guide's `*Size.*`,
 *   `*Speed.*`, `*Darkvision.*` … paragraphs), read by {@link lineageFromNote},
 *   its traits reworded from the player's "you" to a statblock's "the dwarf"
 *   ({@link toStatblockVoice}); a trait only a player character uses (levels,
 *   skills, talents) is listed, not added.
 *
 * Pure: no Obsidian and no I/O.
 */

import { CONDITIONS, DAMAGE_TYPES, plainText, type TemplateFeatureType } from "./monster-template";
import type { TemplateBlock, TemplateBlockFeature, TemplateChange } from "./template-block";

/** A feature of a humanoid's statblock: its name, its ref, its kind. */
export interface StatblockFeatureRef {
  name: string;
  ref: string;
  type?: string;
}

const strip = (s: string) =>
  plainText(s)
    .replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, "$2")
    .replace(/\s+/g, " ")
    .trim();

function defences(text: string): { damage: string[]; conditions: string[] } {
  const low = text.toLowerCase();
  return {
    damage: DAMAGE_TYPES.filter((d) => new RegExp(`\\b${d}\\b`).test(low)),
    conditions: CONDITIONS.filter((c) => new RegExp(`\\b${c}\\b`).test(low)),
  };
}

const SPEEDS: Record<string, string> = {
  walking: "walk",
  climbing: "climb",
  swimming: "swim",
  burrowing: "burrow",
  flying: "fly",
};

/** A row of the NPC Features table as a lineage template. */
export function lineageFromNpcRow(args: {
  /** The table's name for it ("Goblin, Hobgoblin"); the lineage is the last part ("Hobgoblin"). */
  humanoid: string;
  traits: string;
  actions: string;
  /** The features of the humanoid's own statblock, to take its traits and actions from. */
  features: StatblockFeatureRef[];
  /** The lowest CR of the humanoid: an NPC made of it is at least that. */
  cr?: number;
  /** Where the row comes from, for the note. */
  source: string;
}): TemplateBlock {
  const lineage = args.humanoid.split(",").pop()!.trim();
  const changes: TemplateChange[] = [{ stat: "tag", remove: "Any Lineage", add: lineage }];
  const features: TemplateBlockFeature[] = [];
  const rules: string[] = [];
  const find = (name: string): StatblockFeatureRef | undefined => {
    const n = name.toLowerCase();
    return (
      args.features.find((f) => f.name.toLowerCase() === n) ??
      args.features.find((f) => f.name.toLowerCase().startsWith(n))
    );
  };
  const take = (name: string, type: TemplateFeatureType) => {
    const f = find(name);
    if (!f) {
      rules.push(`${name}: not found in the ${lineage} statblock; add it by hand.`);
      return;
    }
    features.push({ id: `${lineage}: ${f.name}`, name: f.name, type, ref: f.ref });
  };

  for (const raw of strip(args.traits).split(/,\s*(?![^(]*\))/)) {
    const seg = raw.trim();
    if (!seg || seg === "__") continue;
    const low = seg.toLowerCase();
    const def = low.match(/^(resistant|vulnerable|immune) to (.+)$/);
    const sense = low.match(/^(darkvision|keensense|tremorsense|truesight|blindsight) (\d+) ft\./);
    const speed = low.match(/^(walking|climbing|swimming|burrowing|flying) speed of (\d+) ft\./);
    // "Pack Tactics and Sunlight Sensitivity traits" is two; "Heightened Smell and Taste trait" is one.
    const trait = seg.match(/^(.+?) (traits?)$/);
    if (def) {
      // "Vulnerable to thunder damage and the deafened condition" — one clause, one key.
      const w = defences(def[2]);
      changes.push({
        stat: def[1] as "resistant" | "vulnerable" | "immune",
        ...(w.damage.length ? { damage: w.damage } : {}),
        ...(w.conditions.length ? { conditions: w.conditions } : {}),
      });
    } else if (sense) {
      changes.push({ stat: "senses", add: sense[1], range: Number(sense[2]), atLeast: true });
    } else if (speed) {
      const mode = SPEEDS[speed[1]];
      changes.push(
        mode === "walk"
          ? { stat: "speed", walk: Number(speed[2]) }
          : { stat: "speed", gain: mode, range: Number(speed[2]) }
      );
    } else if (trait) {
      for (const name of trait[2] === "traits" ? trait[1].split(/\s+and\s+(?=[A-Z])/) : [trait[1]])
        take(name.trim(), "trait");
    } else {
      changes.push({ stat: "note", label: "Traits", text: seg });
    }
  }
  for (const raw of strip(args.actions).split(/,\s*(?![^(]*\))/)) {
    const seg = raw.trim();
    if (!seg || seg === "__") continue;
    const m = seg.match(/^(.+?) (bonus action|reaction|attack|action)(?:\s*\((.+)\))?$/i);
    if (!m) {
      changes.push({ stat: "note", label: "Actions", text: seg });
      continue;
    }
    const kind = m[2].toLowerCase();
    take(m[1].trim(), kind === "bonus action" ? "bonus" : kind === "reaction" ? "reaction" : "action");
    if (m[3]) rules.push(`${m[1].trim()}: ${m[3]}.`);
  }
  if (args.cr !== undefined) changes.push({ stat: "cr", atLeast: args.cr });
  rules.push(
    `Increase any save DCs to match those in the ${lineage}'s own statblock, if they are higher (Monster Vault, NPC Features).`
  );
  return {
    name: lineage,
    kind: "lineage",
    appliesText: `This lineage can be applied to any Humanoid (Any Lineage) NPC, as the ${args.source} NPC Features table describes.`,
    applies: { types: ["humanoid"], other: [], anyLineage: true },
    changes,
    features,
    rules,
    featureNote: "",
  };
}

/** Verbs that follow "you" in the lineage traits; anything else after "you" is an object ("gives you traits"). */
const VERBS = new Set(
  (
    "have are do don't aren't haven't were can could must may might will would should can't cannot won't " +
    "gain take make deal move roll cast choose learn know add use regain become need fall die start end hit " +
    "succeed fail spend finish inherit inherited exhale increase reduce remain enter count see speak understand " +
    "breathe grow remove reattach revive ignore suffer stay return drop hold carry wear wield possess sense " +
    "teleport create expend lose land shift touch fly swim climb burrow leap jump retrace attack call bond " +
    "treat ready reroll emit glow shed live act get keep let fit squeeze"
  ).split(" ")
);

/** Player's words to a statblock's: "You have resistance" → "The {{ self.name() }} has resistance". */
export function toStatblockVoice(text: string): string {
  const conj = (v: string): string => {
    const low = v.toLowerCase();
    const irregular: Record<string, string> = {
      have: "has",
      are: "is",
      do: "does",
      "don't": "doesn't",
      "aren't": "isn't",
      "haven't": "hasn't",
      were: "was",
    };
    if (irregular[low]) return irregular[low];
    if (/^(can|could|must|may|might|will|would|should|can't|cannot|won't|inherited)$/.test(low)) return v;
    if (/(s|sh|ch|x|z|o)$/.test(low)) return `${v}es`;
    if (/[^aeiou]y$/.test(low)) return `${v.slice(0, -1)}ies`;
    return `${v}s`;
  };
  // "you (adverb)? verb" → its subject form; "you" as an object → "it".
  const subject = (lead: string, adverb: string | undefined, verb: string) =>
    VERBS.has(verb.toLowerCase()) ? `${lead} ${adverb ? `${adverb} ` : ""}${conj(verb)}` : null;
  return plainText(text)
    .replace(
      /(^|[.!?]\s+|\n)You ((?:\w+ly|also|always|instead|still|then|never|only|even) )?(\w[\w']*)/g,
      (all, pre: string, adv: string | undefined, verb: string) => {
        const s = subject("The {{ self.name() }}", adv?.trim(), verb);
        return s ? `${pre}${s}` : `${pre}It ${adv ?? ""}${verb}`;
      }
    )
    .replace(
      /\byou ((?:\w+ly|also|always|instead|still|then|never|only|even) )?(\w[\w']*)/g,
      (all, adv: string | undefined, verb: string) => {
        const s = subject("it", adv?.trim(), verb);
        return s ?? `it ${adv ?? ""}${verb}`;
      }
    )
    .replace(/\bYour\b/g, "Its")
    .replace(/\byour\b/g, "its")
    .replace(/\byourself\b/g, "itself")
    .replace(/\bYou\b/g, "It")
    .replace(/\byou\b/g, "it");
}

/** A trait only a player character uses: a level's progression, skills, talents, ability scores. */
const PC_ONLY =
  /\b(?:when you reach|at \d+(?:st|nd|rd|th) level|every time you gain a level|each level|talent|skill proficiency|proficiency (?:with|in)|ability score|hit point maximum increases|feat)\b/i;

export interface NoteLineage {
  block: TemplateBlock;
  /** Its features in a statblock's words, for the features note. */
  features: Array<{ id: string; name: string; type: TemplateFeatureType; text: string }>;
}

/**
 * A lineage note's traits (its `*Name.* text` paragraphs) as a lineage template.
 * `featureNote` is where its reworded features are written.
 */
export function lineageFromNote(name: string, noteText: string, featureNote: string): NoteLineage | null {
  // "Dwarf Lineage Variant, Midnight Dwarf" → "Midnight Dwarf"; "Drow (Elf Variant)" → "Drow"; the tag drops "ᴷ".
  const display = name
    .replace(/\s*\((.+?) Variant\)$/, "")
    .replace(/^.+ Lineage Variant,\s*/, "")
    .trim();
  const lineage = display.replace(/\s*ᴷ$/, "").trim();
  // A trait written under a small heading ("###### Trance" then its text) reads as "*Trance.* text".
  const body = plainText(noteText.replace(/^---\n[\s\S]*?\n---\n/, "")).replace(/^#{4,6}\s+(.+?)\s*\n/gm, "\n*$1.* ");
  // The traits: the paragraphs after "has the following (hereditary )?traits".
  const start = body.search(/has the following (?:hereditary )?traits\./i);
  if (start < 0) return null;
  const paras = body
    .slice(start)
    .split(/\n\s*\n/)
    .slice(1)
    .map((p) => p.trim())
    .filter((p) => p && !/^!\[\[/.test(p) && !/^```/.test(p) && !/^\|/.test(p) && !/^\[/.test(p));

  const changes: TemplateChange[] = [{ stat: "tag", remove: "Any Lineage", add: lineage }];
  const features: NoteLineage["features"] = [];
  const blockFeatures: TemplateBlockFeature[] = [];
  const rules: string[] = [];
  let last: NoteLineage["features"][number] | null = null;
  for (const p of paras) {
    if (/^#{1,3}\s|^`{3,}/.test(p)) break;
    const m = p.match(/^[*_]{1,3}([^*_\n]+?)\.?[*_]{1,3}\.?\s*([\s\S]*)$/);
    if (!m) {
      if (last) last.text += `\n\n${toStatblockVoice(p)}`;
      continue;
    }
    const tname = m[1].trim();
    const text = m[2].trim();
    const low = text.toLowerCase();
    last = null;
    if (/^age$/i.test(tname)) continue;
    if (/^size$/i.test(tname)) {
      const one = text.match(/^Your size is (Tiny|Small|Medium|Large)\b/);
      if (one) changes.push({ stat: "size", to: one[1] });
      else changes.push({ stat: "note", label: "Size", text });
      continue;
    }
    if (/^speed$/i.test(tname)) {
      const walk = low.match(/walking speed is (\d+) feet/);
      if (walk) changes.push({ stat: "speed", walk: Number(walk[1]) });
      for (const g of low.matchAll(/(climbing|swimming|flying|burrowing) speed (?:of|equal to) (\d+) feet/g))
        changes.push({ stat: "speed", gain: SPEEDS[g[1]], range: Number(g[2]) });
      continue;
    }
    // A sense: "You have darkvision to a range of 60 feet (and keensense to a range of 10 feet)."
    const senses = [
      ...low.matchAll(/(darkvision|keensense|tremorsense|truesight|blindsight) (?:out )?to a range of (\d+) feet/g),
    ];
    for (const s of senses) changes.push({ stat: "senses", add: s[1], range: Number(s[2]), atLeast: true });
    if (senses.length && text.split(/(?<=\.)\s+/).length <= 1) continue;
    if (PC_ONLY.test(text)) {
      rules.push(`${tname} is a player character's trait; it is not added to a statblock.`);
      continue;
    }
    // Resistances the trait grants go on the defence line too.
    const res = low.match(/(?:resistan(?:ce|t)) to ([a-z, ]+?) damage/);
    if (res) {
      const w = defences(res[1]);
      if (w.damage.length) changes.push({ stat: "resistant", damage: w.damage });
    }
    const type: TemplateFeatureType = /\bas a bonus action\b/i.test(text)
      ? "bonus"
      : /\bas a reaction\b|\buse your reaction\b/i.test(text)
        ? "reaction"
        : /\bas an action\b|\buse your action\b/i.test(text)
          ? "action"
          : "trait";
    const id = `${display}: ${tname}`;
    const f = { id, name: tname, type, text: toStatblockVoice(text) };
    features.push(f);
    blockFeatures.push({ id, name: tname, type });
    last = f;
  }
  return {
    block: {
      name: display,
      kind: "lineage",
      appliesText: `This lineage can be applied to any Humanoid (Any Lineage) NPC: its traits, reworded for a statblock.`,
      applies: { types: ["humanoid"], other: [], anyLineage: true },
      changes,
      features: blockFeatures,
      ...(rules.length ? { rules } : {}),
      featureNote,
    },
    features,
  };
}

/** The features note of the lineages' reworded traits, as `rpg feature.details` blocks. */
export function lineageFeaturesNote(lineages: NoteLineage[], source: string): string {
  const q = (s: string) => JSON.stringify(s);
  const out = [
    "---",
    "cssclasses:",
    "  - note-feature",
    `source: ${source}`,
    "---",
    "# Lineage NPC Traits",
    "The lineages' traits in a statblock's words, for a Humanoid (Any Lineage) NPC made of that lineage: written by `rpg sim lineages --write` from the lineage notes (their player's words reworded), and used by their `stat.template` blocks.",
  ];
  for (const l of lineages) {
    if (!l.features.length) continue;
    out.push(`## ${l.block.name}`);
    for (const f of l.features) {
      out.push(
        "```rpg feature.details",
        `name: ${q(f.name)}`,
        `id: ${q(f.id)}`,
        `type: ${f.type}`,
        "example:",
        `  self: { name: ${q(l.block.name.replace(/\s*ᴷ$/, ""))} }`,
        "heading: p",
        "---",
        f.text,
        "```"
      );
    }
  }
  return `${out.join("\n")}\n`;
}

/** The rows of the NPC Features table (`| Humanoid | Traits | Actions |`) in a note. */
export function npcFeatureRows(noteText: string): Array<{ humanoid: string; traits: string; actions: string }> {
  const out: Array<{ humanoid: string; traits: string; actions: string }> = [];
  for (const line of noteText.split("\n")) {
    const m = line.match(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*$/);
    if (!m || /^humanoid$/i.test(m[1]) || /^-+$/.test(m[1])) continue;
    out.push({ humanoid: m[1], traits: m[2], actions: m[3] });
  }
  return out;
}
