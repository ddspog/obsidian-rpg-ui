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
 *
 * Options: --vault <path> (else $RPG_VAULT, else the vault the plugin sits in), --json.
 */

import { parseArgs } from "node:util";
import { boot, type Ctx, findVault } from "./app";
import { characterSheet, renderCharacter } from "./commands/character";
import { logState, renderLog } from "./commands/log";
import { lookupNote, renderLookup, searchNotes } from "./commands/lookup";
import { mapState, renderMap } from "./commands/map";

const HELP = `rpg — read your RPG vault as the plugin calculates it (read-only)

Usage:
  rpg character <note>                 the sheet, calculated
  rpg log <note> [--log N]             a session log's state (N: which log in the note, from 1)
  rpg map <note> [--level N] [--around q,r] [--radius N]
                                       a hex map's hexes, or a battle map's squares
  rpg lookup <note> [--full]           a note's blocks and text, as the compendium has it
  rpg search <words>                   notes whose names match

Options:
  --vault <path>   the vault (default: $RPG_VAULT, else the one this plugin is in)
  --json           JSON instead of Markdown
  -h, --help       this help
`;

async function main(): Promise<number> {
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

  const ctx: Ctx = boot(findVault(values.vault));
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
  (code) => process.exit(code),
  (err) => {
    process.stderr.write(`rpg: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(2);
  }
);
