console.log('[debug-run] start');
try {
  console.log('[debug-run] requiring tmp-ts-loader');
  const mod = require('./tmp-ts-loader');
  console.log('[debug-run] required tmp-ts-loader');
  const { loadSystemFromTypeScript } = mod;
  console.log('[debug-run] calling loadSystemFromTypeScript');
  const vaultShim = {
    getAbstractFileByPath(name) {
      const { join } = require('path');
      const { existsSync } = require('fs');
      const full = join(process.cwd(), 'vault', name.replace(/^\/+/, ''));
      if (existsSync(full)) return { path: name, fullPath: full, name: full.split('/').pop() };
      return null;
    },
    cachedRead(file) {
      const { readFileSync } = require('fs');
      return readFileSync(file.fullPath ?? file.path, 'utf8');
    },
    getFiles() { return []; }
  };
  (async () => {
    const sys = await loadSystemFromTypeScript(vaultShim, process.argv[2] || 'systems/tales-of-the-valiant/config');
    console.log('[debug-run] load returned', !!sys);
    if (sys) console.log(JSON.stringify(sys, null, 2));
  })();
} catch (err) {
  console.error('[debug-run] caught', err);
}
