const { writeFileSync } = require('fs');

(async () => {
  try {
    const mod = require('./tmp-ts-loader');
    const loadSystemFromTypeScript = mod.loadSystemFromTypeScript;
    const requested = process.argv[2] || process.env.SYSTEM_PATH || 'systems/tales-of-the-valiant';
    const vaultRoot = require('path').join(process.cwd(), 'vault');
    const vaultShim = {
      getAbstractFileByPath(path) {
        const clean = path.replace(/^\/+/, '');
        const full = require('path').join(vaultRoot, clean);
        const fs = require('fs');
        if (fs.existsSync(full)) return { path: clean, name: full.split('/').pop(), fullPath: full };
        return null;
      },
      async cachedRead(file) {
        const full = file.fullPath ?? require('path').join(vaultRoot, file.path);
        return require('fs').readFileSync(full, 'utf8');
      },
      getFiles() { return []; },
    };

    const system = await loadSystemFromTypeScript(vaultShim, requested);
    if (!system) {
      console.error('No system returned');
      process.exitCode = 2;
      return;
    }
    writeFileSync('last-system.json', JSON.stringify(system, null, 2), 'utf8');
  } catch (err) {
    console.error('Error while loading system (direct):', err);
    process.exitCode = 2;
  }
})();
