#!/usr/bin/env node
/** Scaffolds a simulator:  node simulators/new.mjs <id> ["Title"]  (or `npm run sim:new <id>`). */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const [id, ...rest] = process.argv.slice(2);
if (!id || !/^[a-z][a-z0-9-]*$/.test(id) || id === "core" || id === "dist") {
  console.error('usage: sim:new <id> ["Title"]   (id: lowercase letters, digits and dashes)');
  process.exit(1);
}
const target = path.join(here, id);
if (fs.existsSync(target)) {
  console.error(`simulators/${id} already exists`);
  process.exit(1);
}
const title = rest.join(" ") || id.replace(/(^|-)([a-z])/g, (_m, d, c) => (d ? " " : "") + c.toUpperCase());
fs.mkdirSync(target);
for (const f of fs.readdirSync(path.join(here, "_template"))) {
  const text = fs
    .readFileSync(path.join(here, "_template", f), "utf8")
    .replaceAll("__ID__", id)
    .replaceAll("__TITLE__", title);
  fs.writeFileSync(path.join(target, f), text);
}
console.log(
  `Created simulators/${id}. Edit simulators/${id}/index.ts, then:\n  npm run sim:build ${id}\n  npm run sim:check ${id}`
);
