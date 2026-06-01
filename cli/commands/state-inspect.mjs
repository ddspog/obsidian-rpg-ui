import { parseArgs } from "node:util";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, relative, basename, dirname } from "node:path";
import { evalCode } from "../lib/obsidian.mjs";
import { prepareFile } from "../lib/renderer.mjs";
import { resolveInput, outputDir, vaultRelative } from "../lib/paths.mjs";

const STATE_SCRIPT = (keyFilter) => `(() => {
  const plugin = app.plugins.plugins['dnd-ui-toolkit'];
  if (!plugin) return JSON.stringify({ error: 'plugin not loaded' });

  const state = {};

  // KV store
  if (plugin.store) {
    const all = plugin.store.getAll ? plugin.store.getAll() : {};
    state.kvStore = all;
  }

  // Frontmatter
  const file = app.workspace.getActiveFile();
  if (file) {
    const cache = app.metadataCache.getFileCache(file);
    state.frontmatter = cache?.frontmatter || {};
    state.file = { path: file.path, name: file.name };
  }

  // Filter by key pattern
  const filter = "${keyFilter}";
  if (filter && state.kvStore) {
    const filtered = {};
    const regex = new RegExp(filter.replace(/\\*/g, '.*'));
    for (const [k, v] of Object.entries(state.kvStore)) {
      if (regex.test(k)) filtered[k] = v;
    }
    state.kvStore = filtered;
  }

  return JSON.stringify(state);
})()`;

export default async function stateInspect(args, global) {
  const { values } = parseArgs({
    args,
    options: {
      input: { type: "string", short: "i" },
      output: { type: "string", short: "o" },
      key: { type: "string", short: "k", default: "" },
      help: { type: "boolean", short: "h", default: false },
    },
    strict: false,
    allowPositionals: true,
  });

  if (values.help) {
    console.log(`rpg-dev state-inspect — Dump KV store state and frontmatter

Usage: rpg-dev state-inspect --input <path> [options]

Options:
  --input, -i <path>      Single .md file or directory
  --output, -o <path>     Output file or directory (default: stdout for single, tmp/rpg-dev/state/ for dir)
  --key, -k <pattern>     Filter state keys by glob (e.g., "skills.*")`);
    return;
  }

  if (!values.input) {
    console.error("Error: --input is required");
    process.exit(1);
  }

  const inputPath = resolveInput(values.input);

  if (global.verbose) console.log(`  → ${vaultRelative(inputPath)}`);

  await prepareFile(inputPath, global.vault, { mode: "reading", wait: global.wait });

  const raw = evalCode(STATE_SCRIPT(values.key), global.vault);
  const state = JSON.parse(raw);

  if (state.error) {
    console.error(`Error: ${state.error}`);
    process.exit(1);
  }

  const output = JSON.stringify(state, null, 2);

  if (values.output) {
    const outFile = resolveInput(values.output);
    mkdirSync(dirname(outFile), { recursive: true });
    writeFileSync(outFile, output, "utf8");
    console.log(`State written to ${relative(process.cwd(), outFile)}`);
  } else {
    console.log(output);
  }
}
