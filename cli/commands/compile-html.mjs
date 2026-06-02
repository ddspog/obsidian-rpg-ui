import { parseArgs } from "node:util";
import { readdirSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import { join, relative, basename } from "node:path";
import { evalCode } from "../lib/obsidian.mjs";
import { prepareFile } from "../lib/renderer.mjs";
import { resolveInput, outputDir, vaultRelative, inputBase, VAULT_ROOT } from "../lib/paths.mjs";

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

const EXTRACT_SCRIPT = (selector) => `(() => {
  const els = document.querySelectorAll("${selector}");
  if (!els.length) return JSON.stringify({ error: 'selector not found' });
  let html = '';
  els.forEach(el => { html += el.innerHTML; });
  html = html.replace(/ data-[a-z-]+="[^"]*"/g, '');
  html = html.replace(/ id="react-root-[^"]*"/g, '');
  return html;
})()`;

export default async function compileHtml(args, global) {
  const { values } = parseArgs({
    args,
    options: {
      input: { type: "string", short: "i" },
      output: { type: "string", short: "o" },
      selector: { type: "string", short: "s", default: ".markdown-reading-view .markdown-preview-section" },
      "live-preview": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
    strict: false,
    allowPositionals: true,
  });

  if (values.help) {
    console.log(`rpg-dev compile-html — Compile markdown to rendered HTML fragments

Usage: rpg-dev compile-html --input <path> [options]

Options:
  --input, -i <path>      File or directory of .md files
  --output, -o <path>     Output directory (default: tmp/rpg-dev/html/)
  --selector, -s <css>    DOM selector to extract
  --live-preview          Use live-preview mode instead of reading mode`);
    return;
  }

  if (!values.input) {
    console.error("Error: --input is required");
    process.exit(1);
  }

  const inputPath = resolveInput(values.input);
  const outDir = values.output ? resolveInput(values.output) : outputDir("html");
  const mode = values["live-preview"] ? "live-preview" : "reading";
  const files = collectMdFiles(inputPath);
  const base = inputBase(inputPath);

  if (files.length === 0) {
    console.error(`No .md files found in ${values.input}`);
    process.exit(1);
  }

  console.log(`Compiling ${files.length} file(s) to HTML (${mode} mode)...`);

  let success = 0;
  let failed = 0;

  for (const file of files) {
    const relPath = relative(base, file).replace(/\.md$/, ".html");
    const outFile = join(outDir, relPath);
    const outFileDir = join(outFile, "..");

    try {
      if (global.verbose) console.log(`  → ${vaultRelative(file)}`);

      await prepareFile(file, global.vault, { mode, wait: global.wait });

      const html = evalCode(EXTRACT_SCRIPT(values.selector), global.vault);

      if (html.startsWith("{")) {
        const parsed = JSON.parse(html);
        if (parsed.error) {
          console.warn(`  ⚠ ${basename(file)}: ${parsed.error}`);
          failed++;
          continue;
        }
      }

      mkdirSync(outFileDir, { recursive: true });
      writeFileSync(outFile, html, "utf8");
      success++;

      if (global.verbose) console.log(`  ✓ ${relPath}`);
    } catch (err) {
      console.error(`  ✗ ${basename(file)}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone: ${success} compiled, ${failed} failed → ${relative(process.cwd(), outDir)}`);
}
