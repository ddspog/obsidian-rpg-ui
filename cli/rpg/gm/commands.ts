/**
 * `rpg gm …` — what an LLM needs to run a session as its Game Master: where
 * play stands, the GM Screen's cards played with dice rolled here, the books
 * consulted, prep and reasoning kept in a notebook of `rpg draft` blocks, and
 * lines added to the session's log.
 */

import { readdirSync, readFileSync, rmdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseSessionLogBlock } from "lib/domains/session-log";
import type { Ctx } from "../app";
import { logState, renderLog } from "../commands/log";
import { fencesOf } from "../fences";
import type { TFile } from "../obsidian-node";
import { appendToFence, readNote, setFrontmatter, writeNote } from "../write";
import {
  type GmMode,
  modeOf,
  notebookPath,
  type PrepChange,
  prepBody,
  readNotebook,
  upsertPrep,
  writeNotebook,
} from "./notebook";
import { findCard, playCard, rollDice, slotsOf } from "./play";
import { loadScreen, type Screen } from "./screen";
import { finishLines, gmState } from "./state";

export interface GmOptions {
  set: string[];
  pick: string[];
  into?: string;
  dry: boolean;
  nth: number;
  label?: string;
  when?: string;
  status?: string;
  attach: string[];
  ask?: string;
  map?: string;
  level?: string;
  hex: string[];
  note: string[];
  file?: string;
  dice: boolean;
  all: boolean;
}

interface Session {
  file: TFile;
  screen: Screen | null;
  body: string;
  gmRef?: string;
  mode: GmMode;
}

async function open(ctx: Ctx, ref: string, nth: number): Promise<Session> {
  const file = ctx.note(ref);
  const logs = fencesOf(ctx.vault.readSync(file), "log");
  if (logs.length === 0) throw new Error(`${file.path} has no rpg log block.`);
  const body = parseSessionLogBlock(logs[Math.min(Math.max(1, nth), logs.length) - 1]).body;
  const fm = ctx.metadataCache.frontmatterOf(file) ?? {};
  return {
    file,
    screen: await loadScreen(ctx, file),
    body,
    gmRef: typeof fm.gm === "string" ? fm.gm : undefined,
    mode: modeOf(ctx, file),
  };
}

function needScreen(s: Session): Screen {
  if (!s.screen) throw new Error(`${s.file.path} names no GM Screen (gm: "[[…]]" in its frontmatter).`);
  return s.screen;
}

/** Where rolled lines go: the session's log, or a prep draft of the notebook. Never nowhere. */
function destination(into: string | undefined): { log: true } | { draft: string } {
  if (!into)
    throw new Error(
      'Say where the lines go: --into log (the session\'s log, the player sees it) or --into "<prep title>" (a draft in the GM notebook). A roll is always written down.'
    );
  return into.trim().toLowerCase() === "log" ? { log: true } : { draft: into.trim() };
}

function stamp(_ctx: Ctx, s: Session): string {
  const scenes = [...s.body.matchAll(/^(?:=>\s*)?(S\d+[a-z]?)\b/gm)];
  return [scenes[scenes.length - 1]?.[1] ?? "", new Date().toISOString().slice(0, 10)].filter(Boolean).join(" · ");
}

function write(
  ctx: Ctx,
  s: Session,
  nth: number,
  into: string | undefined,
  lines: string[],
  change: PrepChange = {}
): string {
  const to = destination(into);
  if ("log" in to) {
    const text = ctx.vault.readSync(s.file);
    writeNote(ctx.root, s.file.path, appendToFence(text, "log", nth, lines));
    return `Written to the log of ${s.file.path}.`;
  }
  const nb = readNotebook(ctx, s.file, s.mode);
  const prep = upsertPrep(nb, s.gmRef, to.draft, { ...change, lines, made: stamp(ctx, s) });
  writeNotebook(ctx, s.file, nb);
  return `Written to the draft "${prep.title}" (${prep.status}) in ${nb.path}.`;
}

/** The lines a draft holds, so what is played into it reads the dials it moved. */
function context(ctx: Ctx, s: Session, into: string | undefined): string {
  if (!into || into.trim().toLowerCase() === "log") return s.body;
  const prep = readNotebook(ctx, s.file, s.mode).prep.find((p) => p.title.toLowerCase() === into.trim().toLowerCase());
  return prep ? `${s.body}\n${prepBody(prep)}` : s.body;
}

const pairs = (set: string[]): Record<string, string> =>
  Object.fromEntries(
    set.map((kv) => {
      const at = kv.indexOf("=");
      if (at < 1) throw new Error(`--set takes name=value (got "${kv}").`);
      return [kv.slice(0, at).trim(), kv.slice(at + 1).trim()];
    })
  );

export async function gmCards(
  ctx: Ctx,
  ref: string,
  words: string,
  o: GmOptions
): Promise<{ value: unknown; text: string }> {
  const s = await open(ctx, ref, o.nth);
  const screen = needScreen(s);
  const want = words.toLowerCase().split(/\s+/).filter(Boolean);
  const cards = screen.cards
    .filter((c) => !c.kind)
    .map((c) => ({ name: c.name, stack: c.stack, summary: c.summary, slots: slotsOf(c) }))
    .filter((c) => {
      const hay =
        `${c.name} ${c.stack} ${c.summary ?? ""} ${c.slots.flatMap((sl) => [...(sl.options ?? []), ...Object.values(sl.optionsBy ?? {}).flat()]).join(" ")}`.toLowerCase();
      return want.every((w) => hay.includes(w));
    });
  const slotText = (sl: (typeof cards)[number]["slots"][number]) => {
    const options = (sl.options ?? []).filter(
      (x) => !want.length || want.some((w) => x.toLowerCase().includes(w)) || (sl.options?.length ?? 0) <= 12
    );
    const shown = options.length
      ? `=<${options.slice(0, 24).join("|")}${options.length < (sl.options?.length ?? 0) || options.length > 24 ? "|…" : ""}>`
      : sl.options
        ? "=<…>"
        : "=…";
    return `${sl.optional ? "[" : ""}${sl.name}${shown}${sl.optional ? "]" : ""}`;
  };
  const text = cards.length
    ? cards
        .map(
          (c) =>
            `- **${c.name}** (${c.stack})${c.summary ? `: ${c.summary}` : ""}${c.slots.length ? `\n  slots: ${c.slots.map(slotText).join(" ")}` : ""}`
        )
        .join("\n")
    : "No card matches. Try fewer words, or none for all of them.";
  return { value: cards, text };
}

export async function gmPlay(
  ctx: Ctx,
  ref: string,
  cardName: string,
  o: GmOptions
): Promise<{ value: unknown; text: string }> {
  const s = await open(ctx, ref, o.nth);
  const screen = needScreen(s);
  const card = findCard(screen, cardName);
  if (o.dry) {
    const slots = slotsOf(card);
    return {
      value: { card: card.name, slots, template: card.template },
      text: [
        `# ${card.name} (${card.stack})`,
        card.summary ?? "",
        "",
        "Slots:",
        ...slots.map(
          (sl) => `- ${sl.name}${sl.optional ? " (optional)" : ""}${sl.options ? `: ${sl.options.join(" | ")}` : ""}`
        ),
        "",
        "Writes:",
        "```",
        card.template,
        "```",
      ].join("\n"),
    };
  }
  destination(o.into);
  const before = context(ctx, s, o.into);
  const played = playCard(screen, card, before, pairs(o.set), o.pick);
  if (played.lines.every((l) => !l.trim()))
    throw new Error(`"${card.name}" writes nothing with what was given. See its slots: rpg gm play … --dry`);
  if (played.waiting.length)
    return {
      value: { ...played, written: false },
      text: [
        `"${card.name}" waits for a pick; nothing is written yet. Play it again with the same --set and:`,
        ...played.waiting.map((w) => `  --pick <${w.options.join(" | ")}>     (for: ${w.line.split("[")[0].trim()})`),
        "Picks are taken in order, one --pick for each dropdown as it comes up.",
      ].join("\n"),
    };
  const done = finishLines(screen, before, played.lines);
  // A draft does not hold the session's log: its questions say the Chaos Factor they were asked at.
  if (!("log" in destination(o.into))) {
    const cf = gmState(screen, before).dials.find((d) => d.key === "CF")?.current;
    if (cf !== undefined)
      done.lines = done.lines.map((l) => (/^\? (?!\[CF)/.test(l) ? `? [CF:${cf}] ${l.slice(2)}` : l));
  }
  const where = write(ctx, s, o.nth, o.into, done.lines);
  return {
    value: { card: played.card, lines: done.lines, reads: done.notes, written: where, conclude: played.conclusions },
    text: [
      "```",
      ...done.lines,
      "```",
      ...done.notes.map((n) => `Reads: ${n}`),
      where,
      ...(played.conclusions.length
        ? [
            "",
            "Now read the rolls in the scene's context and write what they come to (rpg gm say, or --note on the draft):",
            ...played.conclusions.map((c) => `  ${c}`),
          ]
        : []),
    ].join("\n"),
  };
}

export async function gmRoll(
  ctx: Ctx,
  ref: string,
  expr: string,
  o: GmOptions
): Promise<{ value: unknown; text: string }> {
  const s = await open(ctx, ref, o.nth);
  destination(o.into);
  const line = rollDice(expr, o.label);
  const where = write(ctx, s, o.nth, o.into, [line]);
  return { value: { line, written: where }, text: `\`${line}\`\n${where}` };
}

/** Lines a GM may write by hand: no dice, no oracle, no table: those are played, so they are rolled here. */
function checkSaid(lines: string[], dice: boolean): void {
  for (const l of lines) {
    const t = l.trim();
    if (!dice && (/^(d(\([^)]*\))?:|o:|tbl:|gen:)/.test(t) || /\b\d*d\d+[a-z\d+-]*=\s*\[?\d/i.test(t)))
      throw new Error(
        `A line holds a roll: "${t.slice(0, 80)}"\nDice are rolled by: rpg gm roll / rpg gm play. (Dice the player rolled at the table and told you: add --dice.)`
      );
    if (/^`{3,}/.test(t)) throw new Error("A line would close the log block.");
  }
}

export async function gmSay(
  ctx: Ctx,
  ref: string,
  text: string,
  o: GmOptions
): Promise<{ value: unknown; text: string }> {
  const s = await open(ctx, ref, o.nth);
  const raw = o.file ? readFileSync(o.file === "-" ? 0 : o.file, "utf8") : text;
  const lines = String(raw).replace(/\s+$/, "").split("\n");
  if (lines.every((l) => !l.trim()))
    throw new Error("Nothing to write. Give the lines, or --file <path> (or --file - for stdin).");
  checkSaid(lines, o.dice);
  const where = write(ctx, s, o.nth, o.into ?? "log", lines);
  return { value: { lines, written: where }, text: `${lines.length} line${lines.length === 1 ? "" : "s"}. ${where}` };
}

export async function gmPrep(
  ctx: Ctx,
  ref: string,
  title: string,
  o: GmOptions
): Promise<{ value: unknown; text: string }> {
  const s = await open(ctx, ref, o.nth);
  if (!title)
    throw new Error(
      'Give the prep a title: rpg gm prep "<session>" "<title>" [--note …] [--when …] [--status idea|ready|used|dropped] [--attach <note>] [--ask encounter|npc|scene|…]'
    );
  const hexes = o.hex
    .map((h) => h.split(",").map((n) => parseInt(n, 10)) as [number, number])
    .filter((h) => h.length === 2 && h.every(Number.isFinite));
  for (const a of o.attach) ctx.note(a.replace(/^\[\[|\]\]$/g, ""));
  const nb = readNotebook(ctx, s.file, s.mode);
  const prep = upsertPrep(nb, s.gmRef, title, {
    status: o.status,
    when: o.when,
    attach: o.attach,
    ask: o.ask,
    map: o.map,
    level: o.level !== undefined ? Number(o.level) : undefined,
    hexes,
    // A thought is a note line: the draft's log shows it apart from what was rolled.
    lines: o.note.map((n) =>
      /^(\(|=>|\?|@|N\(|PC\()/.test(n.trim()) ? n.trim() : `(note: ${n.trim().replace(/[()]/g, "")})`
    ),
    made: stamp(ctx, s),
  });
  writeNotebook(ctx, s.file, nb);
  return {
    value: prep,
    text: `Draft "${prep.title}" (${prep.status}${prep.when ? `, when: ${prep.when}` : ""}) in ${nb.path}.`,
  };
}

export async function gmNote(
  ctx: Ctx,
  ref: string,
  text: string,
  o: GmOptions
): Promise<{ value: unknown; text: string }> {
  const s = await open(ctx, ref, o.nth);
  if (!text.trim()) throw new Error("Give the note's text.");
  const nb = readNotebook(ctx, s.file, s.mode);
  nb.standing = [nb.standing, `- ${text.trim()}`].filter(Boolean).join("\n");
  writeNotebook(ctx, s.file, nb);
  return { value: { standing: nb.standing }, text: `Standing note kept in ${nb.path}.` };
}

export async function gmNotebook(ctx: Ctx, ref: string, o: GmOptions): Promise<{ value: unknown; text: string }> {
  const s = await open(ctx, ref, o.nth);
  const nb = readNotebook(ctx, s.file, s.mode);
  const text = readNote(ctx.root, nb.path);
  return {
    value: nb,
    text:
      text ??
      `No notebook yet (${nb.path}). It is made by the first: rpg gm prep / rpg gm note / rpg gm play --into "<title>".`,
  };
}

export async function gmMode(ctx: Ctx, ref: string, mode: string): Promise<{ value: unknown; text: string }> {
  const file = ctx.note(ref);
  const now = modeOf(ctx, file);
  if (!mode) return { value: { mode: now }, text: `${now} (${notebookPath(file, now)})` };
  if (mode !== "secret" && mode !== "open") throw new Error("The mode is secret or open.");
  if (mode === now) return { value: { mode: now }, text: `Already ${now}.` };
  writeNote(ctx.root, file.path, setFrontmatter(ctx.vault.readSync(file), "gm-mode", mode));
  // The notebook follows: what was kept in one place moves to the other.
  const from = readNotebook(ctx, file, now);
  let moved = "";
  if (from.exists) {
    const to = readNotebook(ctx, file, mode);
    to.standing = [to.standing, from.standing].filter(Boolean).join("\n");
    to.prep.push(...from.prep.filter((p) => !to.prep.some((q) => q.title === p.title)));
    writeNotebook(ctx, file, to);
    rmSync(join(ctx.root, from.path));
    // The hidden folder goes with its last notebook.
    const dir = dirname(join(ctx.root, from.path));
    if (now === "secret" && readdirSync(dir).length === 0) rmdirSync(dir);
    moved = ` The notebook moved to ${to.path}.`;
  }
  return { value: { mode }, text: `GM mode: ${mode}.${moved}` };
}

/** Prep shown to the player: moved from the hidden notebook into the open one (the session stays secret). */
export async function gmReveal(
  ctx: Ctx,
  ref: string,
  title: string,
  o: GmOptions
): Promise<{ value: unknown; text: string }> {
  const s = await open(ctx, ref, o.nth);
  if (s.mode === "open") return { value: {}, text: "The session is open: the notebook is in sight already." };
  const hidden = readNotebook(ctx, s.file, "secret");
  const picked = hidden.prep.filter((p) => (o.all ? true : p.title.toLowerCase() === title.trim().toLowerCase()));
  if (picked.length === 0)
    throw new Error(
      `No such prep. Hidden drafts: ${hidden.prep.map((p) => `"${p.title}"`).join(", ") || "none"}. (--all for every one.)`
    );
  const shown = readNotebook(ctx, s.file, "open");
  for (const p of picked) {
    shown.prep = shown.prep.filter((q) => q.title !== p.title);
    shown.prep.push(p);
  }
  hidden.prep = hidden.prep.filter((p) => !picked.includes(p));
  writeNotebook(ctx, s.file, shown);
  writeNotebook(ctx, s.file, hidden);
  return {
    value: { revealed: picked.map((p) => p.title) },
    text: `Revealed ${picked.map((p) => `"${p.title}"`).join(", ")} in ${shown.path}.`,
  };
}

export async function gmBrief(ctx: Ctx, ref: string, o: GmOptions): Promise<{ value: unknown; text: string }> {
  const s = await open(ctx, ref, o.nth);
  const state = await logState(ctx, ref, o.nth);
  const tools = s.screen ? gmState(s.screen, s.body) : { dials: [], lists: [] };
  const nb = readNotebook(ctx, s.file, s.mode);
  const fm = ctx.metadataCache.frontmatterOf(s.file) ?? {};
  const out = [
    `# GM brief: ${s.file.basename}`,
    "",
    `${fm.title ? `Campaign: ${fm.title}. ` : ""}${fm.ruleset ? `Rules: ${fm.ruleset}. ` : ""}${fm.genre ? `Genre: ${fm.genre}.` : ""}`.trim(),
    `Mode: **${s.mode}** — ${
      s.mode === "secret"
        ? `prep, reasoning and hidden rolls go to ${nb.path} (out of the player's sight); the log holds only what the table sees.`
        : `prep and reasoning go to ${nb.path}, which the player may read as play goes.`
    }`,
    "",
    "## The GM's tools",
    ...tools.dials.map((d) => `- ${d.name} (${d.key}): ${d.current}${d.max !== undefined ? `/${d.max}` : ""}`),
    ...tools.lists.map((l) => `- ${l.name} (${l.entries.length}): ${l.entries.join("; ") || "empty"}`),
    ...(s.screen
      ? [`- ${s.screen.cards.filter((c) => !c.kind).length} cards on ${s.screen.note} (rpg gm cards)`]
      : ["- No GM Screen."]),
    "",
    "## Notebook",
    nb.standing ? nb.standing : "No standing notes yet.",
    "",
    nb.prep.length ? "Prep:" : "No prep yet.",
    ...nb.prep.map(
      (p) => `- [${p.status}] ${p.title}${p.when ? ` — when: ${p.when}` : ""}${p.made ? ` (${p.made})` : ""}`
    ),
    "",
    renderLog(state).replace(/^# /, "## Play: "),
  ];
  return { value: { mode: s.mode, notebook: nb, tools, state }, text: out.join("\n") };
}
