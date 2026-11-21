/**
 * `rpg` — a headless, read-only CLI over the plugin's own calculations, for an
 * LLM (or you) in a terminal with the vault but no Obsidian.
 *
 *   rpg character "Talon Pallton"          the sheet, calculated: abilities, saves, skills, AC, HP, features, attacks…
 *   rpg log "01. Journey to Wisdom's Path" a session log's state: scenes, PCs' HP and conditions, combat, travel
 *   rpg map "Pointy Woods" --level 2 --around 33,-51 --radius 2
 *                                           a hex map's hexes (terrain, regions, places, marks); a battle map's squares
 *   rpg lookup "Kobolds"                   a compendium note: its blocks and text
 *   rpg search kobold                      notes whose names match
 *   rpg gm …                               run a session as its Game Master (rpg gm guide)
 *   rpg session …                          a session's files, and its lines of play
 *   rpg sim run|suggest|plan|catalog …     encounter simulator, suggestions and a party's encounter catalog (rpg sim --help)
 *
 * Reading commands write nothing. `rpg gm` writes a session's log and its GM
 * notebook; `rpg session` its saved lines (and, on switch, its notes).
 *
 * Options: --vault <path> (else $RPG_VAULT, else the vault the plugin sits in), --json.
 */

import { parseArgs } from "node:util";
import { boot, type Ctx, findVault } from "./app";
import { characterSheet, renderCharacter } from "./commands/character";
import { logState, renderLog } from "./commands/log";
import { lookupNote, renderLookup, searchNotes } from "./commands/lookup";
import { mapState, renderMap } from "./commands/map";
import {
  gmBrief,
  gmCards,
  gmMode,
  gmNote,
  gmNotebook,
  type GmOptions,
  gmPlay,
  gmPrep,
  gmReveal,
  gmRoll,
  gmSay,
} from "./gm/commands";
import { consult, renderPassages, renderShelf, shelf, systemRoot } from "./gm/consult";
import GUIDE from "./gm/guide.md";
import { forkLine, listLines, listSessions, packSession, saveLine, switchLine, unpackSession } from "./session/lines";
import { manifest, renderManifest } from "./session/manifest";
import { simEntry } from "./sim";
import { giveTurn, tableLink, takeTurn } from "./session/table";

const HELP = `rpg — read your RPG vault as the plugin calculates it (read-only)

Usage:
  rpg character <note>                 the sheet, calculated
  rpg log <note> [--log N]             a session log's state (N: which log in the note, from 1)
  rpg map <note> [--level N] [--around q,r] [--radius N]
                                       a hex map's hexes, or a battle map's squares
  rpg lookup <note> [--full]           a note's blocks and text, as the compendium has it
  rpg search <words>                   notes whose names match

Game Master (the session's log and GM notebook are written; rpg gm guide explains):
  rpg gm guide                         how to run a session with these commands
  rpg gm brief <session>               where play stands, the GM's dials and lists, the notebook
  rpg gm cards <session> [words]       the GM Screen's cards, and their slots
  rpg gm play <session> <card> [--set name=value]… [--pick value]… --into log|"<prep title>"
                                       play a card: dice rolled here, lines written (--dry: its slots)
  rpg gm roll <session> <dice> [--label text] --into log|"<prep title>"
                                       2d6+3, d20+5 vs 14, 2d20kh1+6
  rpg gm say <session> <line> | --file <path>
                                       lines for the log (no dice in them)
  rpg gm consult <words> [--in folder]… [--limit N]
                                       passages of the books that hold the words
  rpg gm shelf <session>               what the vault holds, by folder
  rpg gm prep <session> <title> [--note text]… [--when text] [--status idea|ready|used|dropped]
               [--attach note]… [--ask encounter|npc|scene|…] [--map note --level N --hex q,r]
                                       a prep draft in the notebook, made or changed
  rpg gm note <session> <text>         a standing note
  rpg gm notebook <session>            the notebook
  rpg gm mode <session> [secret|open]  where the notebook is kept
  rpg gm reveal <session> <title>|--all  hidden prep moved into the open notebook

Encounter simulator (seedable Monte Carlo over party notes and bestiary notes; rpg sim --help):
  rpg sim plan [<theme words>] [--habitat H] [--tag T]… [--limit N]
                                       a few encounters that fit: the catalog first, then a sweep (start here)
  rpg sim run --monster "<note>:<count>"… [--pc <note>]… [--brief] [--seed N] [--trials N] [--rounds N]
  rpg sim suggest [--difficulty easy|challenging|deadly] [--rank cr|outcome] [--base "<note>:<n>"]…
                  [--habitat H] [--type T] [--cr C] [--limit N] [--brief]
  rpg sim catalog init|draft|add|confirm|remove|check|suggest|list …
                                       a party's catalog of ready encounters, each stamped fit, too-easy or
                                       too-hard for the party (docs/encounter-catalog.md)

Sessions:
  rpg session list                     notes that are sessions
  rpg session manifest <session> [--full]
                                       what the session is made of, and what git does not carry
  rpg session save <session> [--note text]
  rpg session fork <session> <name> [--note text]
                                       start a line of play from here
  rpg session switch <session> <line>  put another line back in the vault
  rpg session lines <session>
  rpg session pack <session> [--line name] [--full] [--out file.zip]
  rpg session unpack <file.zip> [--force]

GM link (the player in Obsidian, a phone too; turns over the vault's GitHub branch; docs/gm-link.md):
  rpg table link <session> [--pr N]    the link the player pastes in the plugin's settings
  rpg table take <session>             after a pull: what the player said and added
  rpg table give <session> --note "what the GM tells the player"
                                       the turn given back (then commit and push)

Options:
  --vault <path>   the vault (default: $RPG_VAULT, else the one this plugin is in)
  --json           JSON instead of Markdown
  -h, --help       this help
`;

/** `sim` as the first token past the leading `--vault <v>` / `--vault=<v>` / `--json` globals, or -1. */
function simTokenIndex(argv: string[]): number {
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === "--json" || t.startsWith("--vault=")) continue;
    if (t === "--vault") {
      i++;
      continue;
    }
    return t === "sim" ? i : -1;
  }
  return -1;
}

async function main(): Promise<number> {
  // `rpg sim …` has its own strict flag parse (its usage errors exit 1): hand it every token but `sim`.
  const argv = process.argv.slice(2);
  const simAt = simTokenIndex(argv);
  if (simAt >= 0) {
    const log = console.log;
    console.log = console.debug = console.info = console.warn = () => {};
    return simEntry([...argv.slice(0, simAt), ...argv.slice(simAt + 1)], {
      out: (s) => log(s),
      err: (s) => process.stderr.write(s.endsWith("\n") ? s : s + "\n"),
    });
  }
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      vault: { type: "string" },
      json: { type: "boolean", default: false },
      level: { type: "string" },
      around: { type: "string" },
      radius: { type: "string" },
      log: { type: "string" },
      full: { type: "boolean", default: false },
      set: { type: "string", multiple: true },
      pick: { type: "string", multiple: true },
      into: { type: "string" },
      dry: { type: "boolean", default: false },
      label: { type: "string" },
      when: { type: "string" },
      status: { type: "string" },
      attach: { type: "string", multiple: true },
      ask: { type: "string" },
      map: { type: "string" },
      hex: { type: "string", multiple: true },
      note: { type: "string", multiple: true },
      file: { type: "string" },
      dice: { type: "boolean", default: false },
      all: { type: "boolean", default: false },
      in: { type: "string", multiple: true },
      limit: { type: "string" },
      line: { type: "string" },
      out: { type: "string" },
      force: { type: "boolean", default: false },
      pr: { type: "string" },
      help: { type: "boolean", short: "h", default: false },
    },
  });
  const [command, ...rest] = positionals;
  if (values.help || !command) {
    process.stdout.write(HELP);
    return command || values.help ? 0 : 1;
  }
  const target = rest.join(" ").trim();
  // The plugin's code logs as it works: keep stdout for the answer.
  const log = console.log;
  console.log = console.debug = console.info = console.warn = () => {};
  const out = (value: unknown, md: () => string) => {
    log(values.json ? JSON.stringify(value, null, 2) : md());
  };

  if (command === "gm" && (rest[0] === "guide" || rest[0] === "help")) {
    log(GUIDE);
    return 0;
  }
  const ctx: Ctx = boot(findVault(values.vault));
  if (command === "gm") {
    const [sub, a = "", ...more] = rest;
    const b = more.join(" ").trim();
    const o: GmOptions = {
      set: values.set ?? [],
      pick: values.pick ?? [],
      into: values.into,
      dry: values.dry,
      nth: Number(values.log ?? 1),
      label: values.label,
      when: values.when,
      status: values.status,
      attach: values.attach ?? [],
      ask: values.ask,
      map: values.map,
      level: values.level,
      hex: values.hex ?? [],
      note: values.note ?? [],
      file: values.file,
      dice: values.dice,
      all: values.all,
    };
    const session = () => need(a, "the session's note");
    let r: { value: unknown; text: string };
    switch (sub) {
      case "brief":
        r = await gmBrief(ctx, session(), o);
        break;
      case "cards":
        r = await gmCards(ctx, session(), b, o);
        break;
      case "play":
        r = await gmPlay(ctx, session(), need(b, "a card's name"), o);
        break;
      case "roll":
        r = await gmRoll(ctx, session(), need(b, "the dice (2d6+3)"), o);
        break;
      case "say":
        r = await gmSay(ctx, session(), b, o);
        break;
      case "prep":
        r = await gmPrep(ctx, session(), b, o);
        break;
      case "note":
        r = await gmNote(ctx, session(), b, o);
        break;
      case "notebook":
        r = await gmNotebook(ctx, session(), o);
        break;
      case "mode":
        r = await gmMode(ctx, session(), b);
        break;
      case "reveal":
        r = await gmReveal(ctx, session(), b, o);
        break;
      case "consult": {
        const found = consult(ctx, need(rest.slice(1).join(" "), "words to look for"), {
          under: values.in,
          limit: values.limit ? Number(values.limit) : undefined,
        });
        r = { value: found, text: renderPassages(found) };
        break;
      }
      case "shelf": {
        const tree = shelf(ctx, systemRoot(ctx.note(session()).path));
        r = { value: tree, text: renderShelf(tree) };
        break;
      }
      default:
        process.stderr.write(`Unknown: rpg gm ${sub ?? ""}\n\n${HELP}`);
        return 1;
    }
    out(r.value, () => r.text);
    return 0;
  }
  if (command === "table") {
    const [sub, ...more] = rest;
    const ref = need(more.join(" ").trim(), "the session's note");
    let r: { value: unknown; text: string };
    if (sub === "link") r = tableLink(ctx, ref, values.pr ? Number(values.pr) : undefined);
    else if (sub === "take") r = takeTurn(ctx, ref);
    else if (sub === "give") r = giveTurn(ctx, ref, (values.note ?? []).join("\n\n"));
    else {
      process.stderr.write(`Unknown: rpg table ${sub ?? ""}\n\n${HELP}`);
      return 1;
    }
    out(r.value, () => r.text);
    return 0;
  }
  if (command === "session" || command === "sessions") {
    const [sub = "list", a = "", ...more] = rest;
    const b = more.join(" ").trim();
    const note = values.note?.[0];
    switch (sub) {
      case "list": {
        const found = listSessions(ctx);
        out(found, () => (found.length ? found.map((f) => `- ${f}`).join("\n") : "No session in this vault."));
        return 0;
      }
      case "manifest": {
        const m = manifest(ctx, need(a, "the session's note"));
        out(m, () => renderManifest(m, values.full));
        return 0;
      }
      case "save":
        log(saveLine(ctx, need(a, "the session's note"), note));
        return 0;
      case "fork":
        log(forkLine(ctx, need(a, "the session's note"), need(b, "a name for the new line"), note));
        return 0;
      case "switch":
        log(switchLine(ctx, need(a, "the session's note"), need(b, "the line to switch to")));
        return 0;
      case "lines":
        log(listLines(ctx, need(a, "the session's note")));
        return 0;
      case "pack":
        log(packSession(ctx, need(a, "the session's note"), { line: values.line, full: values.full, out: values.out }));
        return 0;
      case "unpack":
        log(unpackSession(ctx, need(a, "the zip"), values.force));
        return 0;
      default:
        process.stderr.write(`Unknown: rpg session ${sub}\n\n${HELP}`);
        return 1;
    }
  }
  switch (command) {
    case "character":
    case "char":
    case "sheet": {
      const sheet = await characterSheet(ctx, need(target, "a character note"));
      out(sheet, () => renderCharacter(sheet));
      return 0;
    }
    case "log":
    case "session": {
      const state = await logState(ctx, need(target, "a note with an rpg log"), Number(values.log ?? 1));
      out(state, () => renderLog(state));
      return 0;
    }
    case "map": {
      const around = values.around?.split(",").map((n) => parseInt(n, 10)) as [number, number] | undefined;
      const state = await mapState(ctx, need(target, "a note with a map"), {
        level: values.level !== undefined ? Number(values.level) : undefined,
        around: around && around.length === 2 && around.every(Number.isFinite) ? around : undefined,
        radius: values.radius !== undefined ? Number(values.radius) : undefined,
      });
      out(state, () => renderMap(state));
      return 0;
    }
    case "lookup":
    case "show": {
      const note = lookupNote(ctx, need(target, "a note"), values.full);
      out(note, () => renderLookup(note));
      return 0;
    }
    case "search": {
      const found = searchNotes(ctx, need(target, "words to search for"));
      out(found, () => (found.length ? found.map((f) => `- ${f}`).join("\n") : "Nothing matches."));
      return 0;
    }
    default:
      process.stderr.write(`Unknown command "${command}".\n\n${HELP}`);
      return 1;
  }
}

function need(value: string, what: string): string {
  if (!value) throw new Error(`Give ${what}.`);
  return value;
}

main().then(
  // Exit once stdout has drained: a pipe takes writes asynchronously, and a large document (a run's
  // per-trial arrays) would otherwise be cut off at the pipe's buffer size.
  (code) => process.stdout.write("", () => process.exit(code)),
  (err) => {
    process.stderr.write(`rpg: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(2);
  }
);
