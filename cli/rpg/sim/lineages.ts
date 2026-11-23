/**
 * `rpg sim lineages [--write [--force]]`: lineages as templates for
 * "Humanoid (Any Lineage)" NPC statblocks (lib/domains/statblocks/lineage-template.ts).
 * The Monster Vault's NPC Features table gives a row a humanoid (its features
 * taken from its own statblock); the other lineage notes give their traits,
 * reworded for a statblock. `--write` writes each one's `rpg stat.template`
 * block (kind `lineage`, `id: npc`) at the end of its lineage note, so one
 * record holds both and a list of lineages leaves the NPC part out with
 * `.omit(npc)`; a humanoid with no lineage note gets a note in
 * `<system>/worldbuilding/bestiary/templates/lineages/`. Also the features
 * note of the reworded traits (`Lineage NPC Traits`).
 */

import {
  lineageFeaturesNote,
  lineageFromNote,
  lineageFromNpcRow,
  npcFeatureRows,
  type NoteLineage,
} from "lib/domains/statblocks/lineage-template";
import { resolveStatFeatures } from "lib/domains/statblocks/resolve-features";
import type { TemplateBlock } from "lib/domains/statblocks/template-block";
import type { StatFeatureRef } from "lib/domains/statblocks/types";
import type { Ctx } from "../app";
import { fencesOf } from "../fences";
import { readNote, writeNote } from "../write";
import type { SimHandler } from "./dispatch";
import { UsageError, type SimOptions } from "./flags";
import { readStatblock } from "./homebrew";
import { BESTIARY_PREFIX, crNumber } from "./monsters";
import { TEMPLATES_FOLDER, templateFence } from "./templates";

const SYSTEM = BESTIARY_PREFIX.split("/")[0];
export const LINEAGES_FOLDER = `${SYSTEM}/worldbuilding/traits/lineages/`;
export const LINEAGE_FEATURES_NOTE = `${SYSTEM}/worldbuilding/traits/features/Lineage NPC Traits`;
const NPC_APPENDIX = `${SYSTEM}/compendium/rules/monster-vault/Appendix, NPCs.md`;
const SOURCE = "From the lineages of **Tales of the Valiant** books by **Kobold Press**, reworded for statblocks.";

/** The lineage's NPC block, with the id a list of lineages omits (`.omit(npc)`). */
function npcFence(block: TemplateBlock): string {
  return templateFence(block).replace(/^```rpg stat\.template\n/, "```rpg stat.template\nid: npc\n");
}

/** A lineage note with its NPC block in place of the one it has, or at its end. */
function withNpcBlock(text: string, fence: string): string {
  const existing = /^```+\s*rpg\s+stat\.template\b[^\n]*\n[\s\S]*?\n```+[ \t]*$/m;
  if (existing.test(text)) return text.replace(existing, () => fence);
  return `${text.trimEnd()}\n${fence}\n`;
}

/** A humanoid's statblock note by the table's name ("Goblin, Hobgoblin" → "Hobgoblin"). */
function statblockOf(ctx: Ctx, humanoid: string): string | undefined {
  const parts = humanoid.split(",").map((s) => s.trim());
  const tries = [
    humanoid,
    parts[parts.length - 1],
    `${parts[0]}, A`,
    `${parts[parts.length - 1]}, A`,
    parts.reverse().join(" "),
  ];
  for (const t of tries) {
    for (const path of [
      `${BESTIARY_PREFIX}families/humanoids/${t}.md`,
      `${BESTIARY_PREFIX}families/humanoids/${t} ᴷ.md`,
    ]) {
      if (readNote(ctx.root, path) !== null && fencesOf(readNote(ctx.root, path)!, "stat.monster").length) return path;
    }
  }
  return undefined;
}

export interface LineageEntry {
  name: string;
  /** The note its block goes into. */
  path: string;
  /** Its lineage note, when it has one. */
  lineageNote?: string;
  /** Its humanoid's statblock, when it comes from the NPC Features table. */
  statblock?: string;
  source: string;
  block: TemplateBlock;
  from: "npc-features" | "lineage-note";
  noteLineage?: NoteLineage;
}

/** Every lineage, from the NPC Features table first, then the lineage notes. */
async function loadLineages(ctx: Ctx): Promise<LineageEntry[]> {
  const out: LineageEntry[] = [];
  const lineageNotes = ctx.vault
    .getMarkdownFiles()
    .map((f) => f.path)
    .filter((p) => p.startsWith(LINEAGES_FOLDER))
    .sort();
  const noteFor = (lineage: string) =>
    lineageNotes.find((p) => {
      const base = p.slice(LINEAGES_FOLDER.length).replace(/\.md$/, "");
      const display = base
        .replace(/\s*\((.+?) Variant\)$/, "")
        .replace(/^.+ Lineage Variant,\s*/, "")
        .replace(/\s*ᴷ$/, "");
      return display.toLowerCase() === lineage.toLowerCase();
    });

  const appendix = readNote(ctx.root, NPC_APPENDIX) ?? "";
  const done = new Set<string>();
  for (const row of npcFeatureRows(appendix)) {
    const path = statblockOf(ctx, row.humanoid);
    let features: Array<{ name: string; ref: string; type?: string }> = [];
    let cr: number | undefined;
    let dc: number | undefined;
    if (path) {
      const { data } = readStatblock(ctx, path);
      const refs = Array.isArray(data.features) ? (data.features as StatFeatureRef[]) : [];
      const resolved = await resolveStatFeatures(refs, path, { name: String(data.name ?? "").toLowerCase() });
      features = refs.map((r, i) => ({ name: resolved[i]?.name ?? "", ref: r.ref, type: resolved[i]?.type }));
      const dcs = resolved.flatMap((f) => [...(f.text ?? "").matchAll(/\bDC (\d+)/g)].map((m) => Number(m[1])));
      if (dcs.length) dc = Math.max(...dcs);
      cr = data.cr !== undefined ? crNumber(String(data.cr)) : undefined;
    }
    const block = lineageFromNpcRow({
      humanoid: row.humanoid,
      traits: row.traits,
      actions: row.actions,
      features,
      cr,
      dc,
      source: "Monster Vault",
    });
    if (!path) block.rules = [...(block.rules ?? []), `No ${row.humanoid} statblock found to take its features from.`];
    const own = noteFor(block.name);
    out.push({
      name: block.name,
      path: own ?? `${TEMPLATES_FOLDER}lineages/${block.name}.md`,
      ...(own ? { lineageNote: own } : {}),
      ...(path ? { statblock: path } : {}),
      source: 'From **Tales of the Valiant** "Monster Vault" (Appendix, NPCs: NPC Features) by **Kobold Press**.',
      block,
      from: "npc-features",
    });
    if (own) done.add(own);
  }
  for (const p of lineageNotes) {
    if (done.has(p)) continue;
    const nl = lineageFromNote(
      p.slice(LINEAGES_FOLDER.length).replace(/\.md$/, ""),
      readNote(ctx.root, p) ?? "",
      LINEAGE_FEATURES_NOTE
    );
    if (!nl || (nl.block.changes.length <= 1 && !nl.features.length)) continue;
    const source = (readNote(ctx.root, p) ?? "").match(/^source: (.+)$/m)?.[1] ?? SOURCE;
    out.push({
      name: nl.block.name,
      path: p,
      lineageNote: p,
      source,
      block: nl.block,
      from: "lineage-note",
      noteLineage: nl,
    });
  }
  return out;
}

export const simLineages: SimHandler = async (ctx: Ctx, options: SimOptions) => {
  const lineages = await loadLineages(ctx);
  if (!lineages.length) throw new UsageError(`No lineages found (${NPC_APPENDIX}, ${LINEAGES_FOLDER}).`);
  const notes: string[] = [];
  const written: string[] = [];
  let kept = 0;
  if (options.write) {
    const featuresText = lineageFeaturesNote(
      lineages.flatMap((l) => (l.noteLineage ? [l.noteLineage] : [])),
      SOURCE
    );
    if (readNote(ctx.root, `${LINEAGE_FEATURES_NOTE}.md`) !== featuresText)
      writeNote(ctx.root, `${LINEAGE_FEATURES_NOTE}.md`, featuresText);
    for (const l of lineages) {
      const text = readNote(ctx.root, l.path);
      if (text !== null && fencesOf(text, "stat.template").length && !options.force) {
        kept++;
        continue;
      }
      // In the lineage's own note: its NPC block (id npc), which a list of lineages leaves out with `.omit(npc)`.
      const fence = npcFence(l.block);
      const next =
        text !== null
          ? withNpcBlock(text, fence)
          : [
              "---",
              `source: ${l.source}`,
              "npc-lineage: true",
              "---",
              `# ${l.name}`,
              `What a Humanoid (Any Lineage) NPC statblock gains to be ${/^[aeiou]/i.test(l.name) ? "an" : "a"} ${l.name.replace(/\s*ᴷ$/, "").toLowerCase()}, as the Monster Vault's NPC Features table gives it${l.statblock ? `, its traits and actions the [[${l.statblock.replace(/\.md$/, "")}|${l.name}]] statblock's own` : ""}. Try it on an NPC, or save the result as a new one.`,
              fence,
              "",
            ].join("\n");
      if (next !== text) {
        writeNote(ctx.root, l.path, next);
        written.push(l.name);
      }
    }
    notes.push(
      written.length ? `Wrote the lineage block of ${written.join(", ")}.` : "Every lineage block is up to date."
    );
    if (kept) notes.push(`Kept the block ${kept} notes already have (--force writes them again).`);
  } else {
    notes.push("A dry run: --write writes each lineage's stat.template block and the Lineage NPC Traits note.");
  }
  return {
    doc: {
      lineages: lineages.map((l) => ({
        lineage: l.name,
        from: l.from,
        note: l.path,
        changes: l.block.changes.length - 1,
        features: l.block.features.map((f) => f.name),
        ...(l.block.rules?.length ? { byHand: l.block.rules } : {}),
      })),
      notes,
    },
  };
};
