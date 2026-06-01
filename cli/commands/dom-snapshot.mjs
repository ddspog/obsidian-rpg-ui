import { parseArgs } from "node:util";
import { readdirSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import { join, relative, basename } from "node:path";
import { evalCode } from "../lib/obsidian.mjs";
import { prepareFile } from "../lib/renderer.mjs";
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

const DOM_TREE_SCRIPT = (selector, maxDepth) => `(() => {
  function walk(el, depth) {
    if (depth > ${maxDepth}) return null;
    const tag = el.tagName.toLowerCase();
    const classes = el.className && typeof el.className === 'string'
      ? '.' + el.className.trim().split(/\\s+/).join('.')
      : '';
    const label = tag + classes;
    const children = [];
    for (const child of el.children) {
      const node = walk(child, depth + 1);
      if (node) children.push(node);
    }
    const text = el.children.length === 0 ? el.textContent.trim().slice(0, 80) : '';
    return { label, text: text || undefined, children: children.length ? children : undefined };
  }
  const root = document.querySelector("${selector}");
  if (!root) return JSON.stringify({ error: 'selector not found' });
  return JSON.stringify(walk(root, 0));
})()`;

function toYaml(node, indent = 0) {
  const prefix = "  ".repeat(indent);
  let line = `${prefix}- ${node.label}`;
  if (node.text) line += `: "${node.text}"`;
  let result = line + "\n";
  if (node.children) {
    for (const child of node.children) {
      result += toYaml(child, indent + 1);
    }
  }
  return result;
}

export default async function domSnapshot(args, global) {
  const { values } = parseArgs({
    args,
    options: {
      input: { type: "string", short: "i" },
      output: { type: "string", short: "o" },
      selector: { type: "string", short: "s", default: ".markdown-reading-view" },
      depth: { type: "string", short: "d", default: "15" },
      help: { type: "boolean", short: "h", default: false },
    },
    strict: false,
    allowPositionals: true,
  });

  if (values.help) {
    console.log(`rpg-dev dom-snapshot — Capture structural DOM tree as YAML

Usage: rpg-dev dom-snapshot --input <path> [options]

Options:
  --input, -i <path>      File or directory of .md files
  --output, -o <path>     Output directory (default: tmp/rpg-dev/dom/)
  --selector, -s <css>    Root selector to snapshot (default: ".markdown-reading-view")
  --depth, -d <n>         Max tree depth (default: 15)`);
    return;
  }

  if (!values.input) {
    console.error("Error: --input is required");
    process.exit(1);
  }

  const inputPath = resolveInput(values.input);
  const outDir = values.output ? resolveInput(values.output) : outputDir("dom");
  const maxDepth = parseInt(values.depth, 10);
  const files = collectMdFiles(inputPath);
  const base = inputBase(inputPath);

  if (files.length === 0) {
    console.error(`No .md files found in ${values.input}`);
    process.exit(1);
  }

  console.log(`Capturing DOM snapshots for ${files.length} file(s)...`);

  let success = 0;
  let failed = 0;

  for (const file of files) {
    const relPath = relative(base, file).replace(/\.md$/, ".dom.yml");
    const outFile = join(outDir, relPath);
    const outFileDir = join(outFile, "..");

    try {
      if (global.verbose) console.log(`  → ${vaultRelative(file)}`);

      await prepareFile(file, global.vault, { mode: "reading", wait: global.wait });

      const raw = evalCode(DOM_TREE_SCRIPT(values.selector, maxDepth), global.vault);
      const tree = JSON.parse(raw);

      if (tree.error) {
        console.warn(`  ⚠ ${basename(file)}: ${tree.error}`);
        failed++;
        continue;
      }

      const yaml = toYaml(tree);

      mkdirSync(outFileDir, { recursive: true });
      writeFileSync(outFile, yaml, "utf8");
      success++;

      if (global.verbose) console.log(`  ✓ ${relPath}`);
    } catch (err) {
      console.error(`  ✗ ${basename(file)}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone: ${success} captured, ${failed} failed → ${relative(process.cwd(), outDir)}`);
}
