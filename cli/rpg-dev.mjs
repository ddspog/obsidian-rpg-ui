#!/usr/bin/env node

import { parseArgs } from "node:util";

const COMMANDS = {
  "compile-html": () => import("./commands/compile-html.mjs"),
  "capture-logs": () => import("./commands/capture-logs.mjs"),
  "css-report": () => import("./commands/css-report.mjs"),
  "dom-snapshot": () => import("./commands/dom-snapshot.mjs"),
  "perf-timing": () => import("./commands/perf-timing.mjs"),
  "state-inspect": () => import("./commands/state-inspect.mjs"),
};

function printHelp() {
  console.log(`rpg-dev — Obsidian DevTools automation for RPG UI plugin

Usage: rpg-dev <command> [options]

Commands:
  compile-html    Compile markdown files to rendered HTML fragments via Obsidian
  capture-logs    Open files and capture console output after render
  css-report      Generate computed CSS style reports per selector
  dom-snapshot    Capture structural DOM tree as YAML
  perf-timing     Measure post-processor render timing
  state-inspect   Dump KV store state and frontmatter for a page

Global Options:
  --vault <name>     Vault name (default: "testing-vault")
  --wait <ms>        Wait time after page open for rendering (default: 3000)
  --verbose          Verbose output
  --help             Show help`);
}

const args = process.argv.slice(2);
const commandName = args[0];

if (!commandName || commandName === "--help" || commandName === "-h") {
  printHelp();
  process.exit(0);
}

if (!COMMANDS[commandName]) {
  console.error(`Unknown command: ${commandName}`);
  console.error(`Run 'rpg-dev --help' for available commands.`);
  process.exit(1);
}

const commandArgs = args.slice(1);
const { values: globalOpts } = parseArgs({
  args: commandArgs,
  options: {
    vault: { type: "string", default: "testing-vault" },
    wait: { type: "string", default: "3000" },
    verbose: { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
  strict: false,
  allowPositionals: true,
});

const mod = await COMMANDS[commandName]();
await mod.default(commandArgs, {
  vault: globalOpts.vault,
  wait: parseInt(globalOpts.wait, 10),
  verbose: globalOpts.verbose,
});
