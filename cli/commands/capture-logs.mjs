import { parseArgs } from "node:util";
import { readdirSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import { join, relative, basename } from "node:path";
import { devConsole, devDebug } from "../lib/obsidian.mjs";
import { prepareFile, sleep } from "../lib/renderer.mjs";
import { resolveInput, outputDir, vaultRelative, inputBase } from "../lib/paths.mjs";

function collectMdFiles(inputPath) {
  const stat = statSync(inputPath);
  if (stat.isFile() && inputPath.endsWith(".md")) return [inputPath];
  if (!stat.isDirectory()) return [];

  const files = [];
  for (const entry of readdirSync(inputPath, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(join(inputPath, entry.name));
    } else if (entry.isDirectory()) {
      files.push(...collectMdFiles(join(inputPath, entry.name)));
    }
  }
  return files;
}

export default async function captureLogs(args, global) {
  const { values } = parseArgs({
    args,
    options: {
      input: { type: "string", short: "i" },
      output: { type: "string", short: "o" },
      duration: { type: "string", short: "d", default: "5000" },
      filter: { type: "string", short: "f" },
      help: { type: "boolean", short: "h", default: false },
    },
    strict: false,
    allowPositionals: true,
  });

  if (values.help) {
    console.log(`rpg-dev capture-logs — Capture console output after rendering

Usage: rpg-dev capture-logs --input <path> [options]

Options:
  --input, -i <path>      File or directory of .md files
  --output, -o <path>     Output directory (default: tmp/rpg-dev/logs/)
  --duration, -d <ms>     How long to capture after render (default: 5000)
  --filter, -f <prefix>   Only keep lines matching this prefix`);
    return;
  }

  if (!values.input) {
    console.error("Error: --input is required");
    process.exit(1);
  }

  const inputPath = resolveInput(values.input);
  const outDir = values.output ? resolveInput(values.output) : outputDir("logs");
  const duration = parseInt(values.duration, 10);
  const files = collectMdFiles(inputPath);
  const base = inputBase(inputPath);

  if (files.length === 0) {
    console.error(`No .md files found in ${values.input}`);
    process.exit(1);
  }

  console.log(`Capturing logs for ${files.length} file(s) (${duration}ms window)...`);

  devDebug(true, global.vault);

  let success = 0;
  let failed = 0;

  for (const file of files) {
    const relPath = relative(base, file).replace(/\.md$/, ".log");
    const outFile = join(outDir, relPath);
    const outFileDir = join(outFile, "..");

    try {
      if (global.verbose) console.log(`  → ${vaultRelative(file)}`);

      devConsole(global.vault, { clear: true });
      await prepareFile(file, global.vault, { mode: "reading", wait: global.wait });
      await sleep(duration);

      let logs = devConsole(global.vault, { limit: 500 });

      if (values.filter) {
        logs = logs
          .split("\n")
          .filter((line) => line.includes(values.filter))
          .join("\n");
      }

      mkdirSync(outFileDir, { recursive: true });
      writeFileSync(outFile, logs, "utf8");
      success++;

      if (global.verbose) console.log(`  ✓ ${relPath} (${logs.split("\n").length} lines)`);
    } catch (err) {
      console.error(`  ✗ ${basename(file)}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone: ${success} captured, ${failed} failed → ${relative(process.cwd(), outDir)}`);

  devDebug(false, global.vault);
}
