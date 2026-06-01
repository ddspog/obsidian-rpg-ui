import { parseArgs } from "node:util";
import { readdirSync, statSync, mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join, relative, basename, dirname } from "node:path";
import { evalCode } from "../lib/obsidian.mjs";
import { prepareFile } from "../lib/renderer.mjs";
import { resolveInput, outputDir, vaultRelative, inputBase, PLUGIN_ROOT } from "../lib/paths.mjs";
import { parseSelectorsFile, shouldStripProperty, isNoiseValue, DEFAULT_STRIP } from "../lib/selectors.mjs";

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

function findSelectorsFile(mdFile) {
  const companion = mdFile.replace(/\.md$/, ".selectors");
  if (existsSync(companion)) return companion;

  const defaultFile = join(PLUGIN_ROOT, "cli", "default.selectors");
  if (existsSync(defaultFile)) return defaultFile;

  return null;
}

const GET_STYLES_SCRIPT = (selector, stripPatterns) => `(() => {
  const el = document.querySelector("${selector}");
  if (!el) return JSON.stringify({ error: 'not found', selector: "${selector}" });
  const computed = window.getComputedStyle(el);
  const styles = {};
  const strip = ${JSON.stringify(stripPatterns)};
  for (let i = 0; i < computed.length; i++) {
    const prop = computed[i];
    const value = computed.getPropertyValue(prop);
    let skip = false;
    for (const pat of strip) {
      if (pat.endsWith('*')) { if (prop.startsWith(pat.slice(0,-1))) skip = true; }
      else if (prop === pat) skip = true;
    }
    if (skip) continue;
    const noise = ['auto','none','normal','inherit','initial','unset',''];
    if (noise.includes(value)) continue;
    if (value.startsWith('var(')) continue;
    styles[prop] = value;
  }
  return JSON.stringify(styles);
})()`;

export default async function cssReport(args, global) {
  const { values } = parseArgs({
    args,
    options: {
      input: { type: "string", short: "i" },
      output: { type: "string", short: "o" },
      selectors: { type: "string", short: "s" },
      diff: { type: "string" },
      help: { type: "boolean", short: "h", default: false },
    },
    strict: false,
    allowPositionals: true,
  });

  if (values.help) {
    console.log(`rpg-dev css-report — Generate computed CSS style reports

Usage: rpg-dev css-report --input <path> [options]

Options:
  --input, -i <path>       File or directory of .md files
  --output, -o <path>      Output directory (default: tmp/rpg-dev/css/)
  --selectors, -s <file>   Override selectors file (default: companion .selectors or cli/default.selectors)
  --diff <path>            Compare against baseline and show changes`);
    return;
  }

  if (!values.input) {
    console.error("Error: --input is required");
    process.exit(1);
  }

  const inputPath = resolveInput(values.input);
  const outDir = values.output ? resolveInput(values.output) : outputDir("css");
  const files = collectMdFiles(inputPath);
  const base = inputBase(inputPath);

  if (files.length === 0) {
    console.error(`No .md files found in ${values.input}`);
    process.exit(1);
  }

  console.log(`Generating CSS reports for ${files.length} file(s)...`);

  let success = 0;
  let failed = 0;

  for (const file of files) {
    const relPath = relative(base, file).replace(/\.md$/, ".css-report.json");
    const outFile = join(outDir, relPath);
    const outFileDir = dirname(outFile);

    try {
      const selectorsPath = values.selectors
        ? resolveInput(values.selectors)
        : findSelectorsFile(file);

      if (!selectorsPath) {
        console.warn(`  ⚠ ${basename(file)}: no .selectors file found, skipping`);
        failed++;
        continue;
      }

      const { selectors, strip } = parseSelectorsFile(selectorsPath);

      if (global.verbose) console.log(`  → ${vaultRelative(file)} (${selectors.length} selectors)`);

      await prepareFile(file, global.vault, { mode: "reading", wait: global.wait });

      const report = {};
      for (const selector of selectors) {
        const raw = evalCode(GET_STYLES_SCRIPT(selector, strip), global.vault);
        try {
          const parsed = JSON.parse(raw);
          if (parsed.error) {
            report[selector] = { _error: parsed.error };
          } else {
            report[selector] = parsed;
          }
        } catch {
          report[selector] = { _error: "parse failed", _raw: raw.slice(0, 200) };
        }
      }

      mkdirSync(outFileDir, { recursive: true });
      writeFileSync(outFile, JSON.stringify(report, null, 2), "utf8");
      success++;

      if (global.verbose) console.log(`  ✓ ${relPath}`);
    } catch (err) {
      console.error(`  ✗ ${basename(file)}: ${err.message}`);
      failed++;
    }
  }

  if (values.diff) {
    console.log("\nDiff mode:");
    diffReports(outDir, resolveInput(values.diff));
  }

  console.log(`\nDone: ${success} reported, ${failed} failed → ${relative(process.cwd(), outDir)}`);
}

function diffReports(currentDir, baselineDir) {
  if (!existsSync(baselineDir)) {
    console.error(`  Baseline directory not found: ${baselineDir}`);
    return;
  }

  const currentFiles = readdirSync(currentDir, { recursive: true }).filter((f) =>
    f.endsWith(".css-report.json"),
  );

  for (const file of currentFiles) {
    const currentPath = join(currentDir, file);
    const baselinePath = join(baselineDir, file);

    if (!existsSync(baselinePath)) {
      console.log(`  + ${file} (new)`);
      continue;
    }

    const current = JSON.parse(readFileSync(currentPath, "utf8"));
    const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));

    const changes = [];
    for (const selector of Object.keys(current)) {
      if (!baseline[selector]) {
        changes.push(`  + ${selector} (new selector)`);
        continue;
      }
      const cur = current[selector];
      const base = baseline[selector];
      for (const prop of Object.keys(cur)) {
        if (prop.startsWith("_")) continue;
        if (cur[prop] !== base[prop]) {
          changes.push(`  Δ ${selector} → ${prop}: ${base[prop] || "(none)"} → ${cur[prop]}`);
        }
      }
    }

    if (changes.length > 0) {
      console.log(`  ${file}:`);
      changes.forEach((c) => console.log(`    ${c}`));
    }
  }
}
