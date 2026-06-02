import { parseArgs } from "node:util";
import { readdirSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import { join, relative, basename } from "node:path";
import { evalCode, reloadPlugin, openFile } from "../lib/obsidian.mjs";
import { prepareFile, sleep } from "../lib/renderer.mjs";
import { resolveInput, outputDir, vaultRelative } from "../lib/paths.mjs";

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

const INJECT_MARK_SCRIPT = `(() => {
  performance.clearMarks();
  performance.clearMeasures();
  performance.mark('rpg-before');
  return 'marked';
})()`;

const MEASURE_SCRIPT = `(() => {
  performance.mark('rpg-after');
  performance.measure('rpg-render', 'rpg-before', 'rpg-after');
  const entries = performance.getEntriesByName('rpg-render');
  if (entries.length === 0) return JSON.stringify({ error: 'no measure' });
  return JSON.stringify({ duration: entries[0].duration });
})()`;

export default async function perfTiming(args, global) {
  const { values } = parseArgs({
    args,
    options: {
      input: { type: "string", short: "i" },
      output: { type: "string", short: "o" },
      iterations: { type: "string", short: "n", default: "3" },
      help: { type: "boolean", short: "h", default: false },
    },
    strict: false,
    allowPositionals: true,
  });

  if (values.help) {
    console.log(`rpg-dev perf-timing — Measure post-processor render timing

Usage: rpg-dev perf-timing --input <path> [options]

Options:
  --input, -i <path>       File or directory of .md files
  --output, -o <path>      Output directory (default: tmp/rpg-dev/perf/)
  --iterations, -n <num>   Number of reload cycles (default: 3)`);
    return;
  }

  if (!values.input) {
    console.error("Error: --input is required");
    process.exit(1);
  }

  const inputPath = resolveInput(values.input);
  const outDir = values.output ? resolveInput(values.output) : outputDir("perf");
  const iterations = parseInt(values.iterations, 10);
  const files = collectMdFiles(inputPath);

  if (files.length === 0) {
    console.error(`No .md files found in ${values.input}`);
    process.exit(1);
  }

  console.log(`Measuring render timing for ${files.length} file(s), ${iterations} iterations each...`);

  const results = {};
  let success = 0;
  let failed = 0;

  for (const file of files) {
    const name = basename(file, ".md");

    try {
      if (global.verbose) console.log(`  → ${vaultRelative(file)}`);

      const timings = [];

      for (let i = 0; i < iterations; i++) {
        evalCode(INJECT_MARK_SCRIPT, global.vault);

        reloadPlugin(global.vault);
        const vaultPath = vaultRelative(file);
        await sleep(500);
        openFile(vaultPath, global.vault);

        await sleep(global.wait);

        const raw = evalCode(MEASURE_SCRIPT, global.vault);
        const parsed = JSON.parse(raw);

        if (parsed.error) {
          if (global.verbose) console.log(`    iter ${i + 1}: error - ${parsed.error}`);
          continue;
        }

        timings.push(parsed.duration);
        if (global.verbose) console.log(`    iter ${i + 1}: ${parsed.duration.toFixed(1)}ms`);
      }

      if (timings.length > 0) {
        timings.sort((a, b) => a - b);
        results[name] = {
          min: timings[0],
          max: timings[timings.length - 1],
          avg: timings.reduce((a, b) => a + b, 0) / timings.length,
          p95: timings[Math.floor(timings.length * 0.95)],
          samples: timings.length,
        };
        success++;
      } else {
        failed++;
      }
    } catch (err) {
      console.error(`  ✗ ${name}: ${err.message}`);
      failed++;
    }
  }

  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, "perf-report.json");
  writeFileSync(outFile, JSON.stringify(results, null, 2), "utf8");

  console.log(`\nResults:`);
  for (const [name, stats] of Object.entries(results)) {
    console.log(`  ${name}: avg=${stats.avg.toFixed(1)}ms min=${stats.min.toFixed(1)}ms max=${stats.max.toFixed(1)}ms`);
  }

  console.log(`\nDone: ${success} measured, ${failed} failed → ${relative(process.cwd(), outDir)}`);
}
