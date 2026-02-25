const { readFileSync, existsSync, readdirSync, statSync } = require('fs');
const { join, relative } = require('path');

const vaultRoot = join(process.cwd(), 'vault');

function walkFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walkFiles(p, out);
    else out.push({ path: relative(vaultRoot, p).replace(/\\/g, '/'), name });
  }
  return out;
}

const vaultShim = {
  getAbstractFileByPath(path) {
    const clean = path.replace(/^\/+/, '');
    const full = join(vaultRoot, clean);
    if (existsSync(full)) return { path: clean, name: full.split('/').pop(), fullPath: full };
    return null;
  },
  async cachedRead(file) {
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
    console.log('[run-loader-bundled] require tmp-ts-loader');
    const mod = require('./tmp-ts-loader');
    const loadSystemFromTypeScript = mod.loadSystemFromTypeScript;
    const requested = process.argv[2] || process.env.SYSTEM_PATH || 'systems/tales-of-the-valiant';
    console.log('[run-loader-bundled] calling loadSystemFromTypeScript for', requested);
    const system = await loadSystemFromTypeScript(vaultShim, requested);
    console.log('[run-loader-bundled] loadSystemFromTypeScript returned');
    if (!system) {
      console.error('No system returned');
      process.exitCode = 2;
      return;
    }
    console.log(JSON.stringify(system, null, 2));
  } catch (err) {
    console.error('Error while loading system (bundled):', err);
    process.exitCode = 2;
  }
})();
