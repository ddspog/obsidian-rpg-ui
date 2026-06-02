import { evalCode, openFile, command } from "./obsidian.mjs";
import { vaultRelative } from "./paths.mjs";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const UNFOLD_SCRIPT = `(() => {
  document.querySelectorAll('.callout.is-collapsed .callout-title')
    .forEach(el => el.click());
  document.querySelectorAll('.is-collapsed > .heading-collapse-indicator')
    .forEach(el => el.click());
  document.querySelectorAll('.is-collapsed > .list-collapse-indicator')
    .forEach(el => el.click());
  return 'unfolded';
})()`;

const SCROLL_ALL_SCRIPT = `(() => {
  const view = document.querySelector('.markdown-reading-view');
  if (!view) return 'no-view';
  const scroller = view.querySelector('.markdown-preview-view');
  if (!scroller) return 'no-scroller';
  scroller.scrollTop = scroller.scrollHeight;
  return 'scrolled';
})()`;

async function waitForRender(vault, { selector = ".language-rpg.is-loaded", timeout = 5000 } = {}) {
  const start = Date.now();
  const checkScript = `(() => {
    const el = document.querySelector("${selector}");
    return el ? 'ready' : 'waiting';
  })()`;

  while (Date.now() - start < timeout) {
    const result = evalCode(checkScript, vault);
    if (result === "ready") return true;
    await sleep(300);
  }
  return false;
}

export async function prepareFile(filePath, vault, { mode = "reading", wait = 3000 } = {}) {
  const vaultPath = vaultRelative(filePath);
  openFile(vaultPath, vault);
  await sleep(500);

  if (mode === "reading") {
    const modeScript = `(() => {
      const leaf = app.workspace.activeLeaf;
      if (leaf && leaf.view && leaf.view.getMode && leaf.view.getMode() !== 'preview') {
        leaf.view.setState({ mode: 'preview' }, { history: false });
      }
      return 'ok';
    })()`;
    evalCode(modeScript, vault);
    await sleep(300);
  } else if (mode === "live-preview") {
    const modeScript = `(() => {
      const leaf = app.workspace.activeLeaf;
      if (leaf && leaf.view && leaf.view.getMode && leaf.view.getMode() !== 'source') {
        leaf.view.setState({ mode: 'source' }, { history: false });
      }
      return 'ok';
    })()`;
    evalCode(modeScript, vault);
    await sleep(300);
  }

  evalCode(UNFOLD_SCRIPT, vault);
  await sleep(300);

  // Scroll to bottom to force Obsidian to render all virtualized sections
  evalCode(SCROLL_ALL_SCRIPT, vault);
  await sleep(500);
  // Scroll back to top
  evalCode(`(() => { const v = document.querySelector('.markdown-preview-view'); if (v) v.scrollTop = 0; return 'ok'; })()`);
  await sleep(300);

  const found = await waitForRender(vault, { timeout: wait });
  if (!found) {
    await sleep(500);
  }
}

export { sleep };
