/**
 * `rpg sim spells [<note or folder>…] [--write]`: a `roll:` for each spell note
 * that has none, read from its prose (lib/domains/spells/derive-roll.ts), so
 * the character sheet's rolls, the session log's cards and the encounter
 * simulator see what the spell does. A dry run lists what it would write and
 * why the rest get none; `--write` puts each roll into its note's `rpg spell`
 * fence (before its `---`), under a comment saying it was read from the text.
 * A note with a `roll:` is never touched.
 */

import { parse, stringify } from "yaml";
import { deriveSpellRoll } from "lib/domains/spells/derive-roll";
import type { RollAspect } from "lib/domains/features/roll";
import { splitFenceBody } from "lib/utils/fence-split";
import type { Ctx } from "../app";
import { readNote, writeNote } from "../write";
import { notesOf } from "./catalog-draft";
import type { SimHandler } from "./dispatch";
import type { SimOptions } from "./flags";
import { BESTIARY_PREFIX } from "./monsters";

const SPELLS = `${BESTIARY_PREFIX.split("/")[0]}/worldbuilding/spells`;

const FENCE = /^((`{3,})\s*rpg\s+spell\b[^\n]*)\n([\s\S]*?)\n\2[ \t]*$/m;

/** A value as a YAML flow: `{ damage: { roll: 4d6, type: fire } }`. */
function flow(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(flow).join(", ")}]`;
  if (value && typeof value === "object")
    return `{ ${Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${flow(v)}`)
      .join(", ")} }`;
  const text = String(value);
  return /^[\w .+-]+$/.test(text) ? text : JSON.stringify(text);
}

/** A variant map (`upcast`, `leveled.at`) as the vault writes it: one flow line a key. */
function variantLines(map: Record<string, unknown>, indent: string): string[] {
  return Object.entries(map).map(([key, value]) => `${indent}${key}: ${flow(value)}`);
}

/** A roll as YAML lines for a spell fence, the vault's way (variants one flow line a circle or level). */
export function rollYaml(roll: RollAspect): string {
  const { upcast, leveled, ...rest } = roll;
  const lines = [
    "# roll: read from the spell's text by `rpg sim spells`; check it, then delete this line",
    stringify({ roll: rest }, { lineWidth: 0 }).trimEnd(),
  ];
  if (leveled) lines.push("  leveled:", "    at:", ...variantLines(leveled.at as Record<string, unknown>, "      "));
  if (upcast) lines.push("  upcast:", ...variantLines(upcast as Record<string, unknown>, "    "));
  return lines.join("\n");
}

/** The note with the roll put into its spell fence, before the fence's `---` (or at its end). */
export function withRoll(text: string, roll: RollAspect): string | null {
  const m = text.match(FENCE);
  if (!m) return null;
  const body = m[3];
  const sep = body.search(/^---\s*$/m);
  const yaml = rollYaml(roll);
  const next = sep >= 0 ? `${body.slice(0, sep).trimEnd()}\n${yaml}\n${body.slice(sep)}` : `${body.trimEnd()}\n${yaml}`;
  return text.replace(m[0], () => `${m[1]}\n${next}\n${m[2]}`);
}

export const simSpells: SimHandler = async (ctx: Ctx, options: SimOptions) => {
  const notes = (options.args.length ? options.args : [SPELLS]).flatMap((a) => notesOf(ctx, a));
  const byForm: Record<string, number> = {};
  const skipped: Record<string, number> = {};
  let hasRoll = 0;
  const derived: Array<{ note: string; roll: RollAspect }> = [];
  for (const path of notes) {
    const text = readNote(ctx.root, path);
    const m = text?.match(FENCE);
    if (!text || !m) continue;
    const { yaml, text: prose } = splitFenceBody(m[3]);
    let data: Record<string, unknown> = {};
    try {
      data = (parse(yaml) ?? {}) as Record<string, unknown>;
    } catch {
      skipped["fence YAML does not parse"] = (skipped["fence YAML does not parse"] ?? 0) + 1;
      continue;
    }
    if (data.roll !== undefined) {
      hasRoll += 1;
      continue;
    }
    const result = deriveSpellRoll({
      text: prose ?? "",
      circle: data.circle,
      range: typeof data.range === "string" ? data.range : undefined,
      duration: typeof data.duration === "string" ? data.duration : undefined,
    });
    if ("skip" in result) {
      skipped[result.skip] = (skipped[result.skip] ?? 0) + 1;
      continue;
    }
    byForm[result.roll.form] = (byForm[result.roll.form] ?? 0) + 1;
    derived.push({ note: path, roll: result.roll });
  }
  let written = 0;
  if (options.write) {
    for (const d of derived) {
      const text = readNote(ctx.root, d.note);
      const next = text ? withRoll(text, d.roll) : null;
      if (next && next !== text) {
        writeNote(ctx.root, d.note, next);
        written += 1;
      }
    }
  }
  const name = (p: string) => p.split("/").pop()!.replace(/\.md$/, "");
  return {
    doc: {
      spells: notes.length,
      hasRoll,
      derived: derived.length,
      byForm,
      skipped,
      ...(options.write
        ? { written }
        : {
            sample: derived
              .slice(0, options.limitSet ? options.limit : 12)
              .map((d) => ({ spell: name(d.note), roll: d.roll })),
          }),
      notes: [
        options.write
          ? `Wrote ${written} roll blocks, each under a comment to delete once checked.`
          : "A dry run: --write puts each roll into its note's spell fence (a note with a roll: is never touched).",
      ],
    },
  };
};
