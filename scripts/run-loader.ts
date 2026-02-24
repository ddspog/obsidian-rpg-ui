#!/usr/bin/env ts-node
// Dynamic import (with explicit .ts extension) so ts-node resolves the module
// in both CommonJS and ESM loader modes.
// We'll import the loader inside the async IIFE below.
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const vaultRoot = join(process.cwd(), 'vault');

function walkFiles(dir: string, out: any[] = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walkFiles(p, out);
    else out.push({ path: relative(vaultRoot, p).replace(/\\\\/g, '/'), name });
  }
  return out;
}

const vaultShim = {
  getAbstractFileByPath(path: string) {
    const clean = path.replace(/^\/+/, '');
    const full = join(vaultRoot, clean);
    if (existsSync(full)) return { path: clean, name: full.split('/').pop(), fullPath: full };
    return null;
  },
  async cachedRead(file: any) {
    const full = file.fullPath ?? join(vaultRoot, file.path);
    return readFileSync(full, 'utf8');
  },
  getFiles() {
    if (!existsSync(vaultRoot)) return [];
    return walkFiles(vaultRoot);
  },
};

(async () => {
  try {
    // Use dynamic import; ts-node/register should allow resolving the TS module.
    const mod = await import('../lib/systems/ts-loader');
    const loadSystemFromTypeScript = (mod as any).loadSystemFromTypeScript as (
      vault: any,
      systemFolderPath: string,
    ) => Promise<any>;

    const system = await loadSystemFromTypeScript(vaultShim as any, 'systems/tales-of-the-valiant');
    if (!system) {
      console.error('No system returned');
      process.exitCode = 2;
      return;
    }
    console.log(JSON.stringify(system, null, 2));
  } catch (err) {
    console.error('Error while loading system:', err);
    process.exitCode = 2;
  }
})();
