import { dirname, join, relative, resolve } from "node:path";
import { statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const PLUGIN_ROOT = resolve(__dirname, "../..");
export const VAULT_ROOT = resolve(PLUGIN_ROOT, "../../..");
const PLUGIN_VAULT = join(PLUGIN_ROOT, "vault");

export function vaultRelative(absPath) {
  const abs = resolve(absPath);
  if (abs.startsWith(PLUGIN_VAULT + "/")) {
    return relative(PLUGIN_VAULT, abs);
  }
  return relative(VAULT_ROOT, abs);
}

export function outputDir(command) {
  return join(PLUGIN_ROOT, "tmp", "rpg-dev", command);
}

export function resolveInput(input) {
  if (input.startsWith("/")) return input;
  return resolve(PLUGIN_ROOT, input);
}

export function inputBase(inputPath) {
  const stat = statSync(inputPath);
  if (stat.isFile()) return dirname(inputPath);
  return inputPath;
}
