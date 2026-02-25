import { expect, test } from 'vitest';
import { loadSystemFromTypeScript } from '../lib/systems/ts-loader';
import { join } from 'path';

const fixturePath = 'test/fixtures/simple-system';

const makeVaultShim = (root: string) => ({
  getAbstractFileByPath(path: string) {
    const clean = path.replace(/^\/+/g, '');
    const full = join(process.cwd(), root, clean);
    const fs = require('fs');
    if (fs.existsSync(full)) return { path: clean, name: full.split('/').pop(), fullPath: full };
    return null;
  },
  async cachedRead(file: any) {
    const full = file.fullPath ?? join(process.cwd(), root, file.path);
    return require('fs').readFileSync(full, 'utf8');
  },
  getFiles() { return []; },
});

test('loadSystemFromTypeScript loads a simple fixture', async () => {
  const vault = makeVaultShim(fixturePath);
  const system = await loadSystemFromTypeScript(vault as any, fixturePath);
  expect(system).toBeTruthy();
  // fixture exports simple object with name
  // @ts-ignore
  expect(system.name).toBe('fixture-system');
});
