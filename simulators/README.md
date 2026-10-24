# Simulators

A sub-project for trying single pieces of the plugin in a browser, a phone included, without Obsidian.
Each simulator is one HTML file: the plugin code it exercises, the plugin's `styles.css`, and a copy of
your vault's notes. The plugin's real code runs; only `obsidian` is replaced.

```
simulators/
  core/             what every simulator shares
    obsidian-stub.ts   the `obsidian` module: files, components, markdown, YAML, a toast, a menu
    fake-app.ts        an in-memory vault, link resolution and frontmatter (Obsidian's `App`)
    shell.ts           the page frame: header, tabs, samples list, text editor
    boot.ts            starts a page: stubs, vault copy, the simulator
    types.ts           `defineSimulator`, `SimulatorContext`, `Sample`
    base.css           Obsidian's variables and the frame's styles (light and dark)
  lonelog-log/      the Log and its cards (lonelog in, cards played, Save)
  rpg-table/        an `rpg table` block: edit it, see it render, load any table from the vault
  _template/        what `sim:new` copies
  build.mjs  new.mjs  check.mjs  glob.mjs
```

## Use

```
npm run build                              # the plugin's styles.css
RPG_VAULT_ROOT=/path/to/vault npm run sim:build             # every simulator → simulators/dist/<id>.html
RPG_VAULT_ROOT=/path/to/vault npm run sim:build lonelog-log # one
npm run sim:build -- --watch rpg-table     # rebuild on change
npm run sim:check                          # open each in headless Chromium at phone size
npm run sim:new my-piece "My Piece"        # scaffold simulators/my-piece
```

Open `simulators/dist/<id>.html` in a browser, or publish it as an artifact to open it on a phone.

## A simulator

A folder with a `simulator.json` and an `index.ts`.

```json
{
  "id": "my-piece",
  "title": "My Piece",
  "about": "…",
  "entry": "index.ts",
  "vault": { "include": ["tales-of-the-valiant/**"], "exclude": [] }
}
```

`vault.include` / `exclude` pick which notes are copied in (globs: `*` within a folder, `**` across);
fewer notes is a smaller page. An optional `style.css` beside `index.ts` is added after `base.css`.

```ts
import { mountShell, samplesList } from "../core/shell";
import { defineSimulator } from "../core/types";

export default defineSimulator({
  start(ctx) {
    mountShell(ctx, [
      {
        id: "try",
        label: "Try it",
        build: (el) => {
          /* draw the piece into el */
        },
      },
    ]);
  },
});
```

`ctx` gives `app`, `vault` (`put`, `peek`, `modify`, and `onWrite` to hear a write), `notes`, `kv`, `store`
(settings kept in the browser), `toast` and `copy`. To run a view that rewrites its note, give it a path in
`ctx.vault` and re-draw it from `vault.onWrite`, as `lonelog-log` does.

## What is not here

- Obsidian itself: panes, the file explorer, the editor, plugins other than this one. `MarkdownRenderer` is a
  small stand-in (links, bold, italics, code), `Menu` a small popup, `setIcon` a placeholder.
- The system loader, which compiles a vault's TypeScript with esbuild. Everything runs with the default
  system, so character sheets and their cards are not available; GM-side features are.
- Images and other non-note files: only `.md` notes are copied.
- Dice Roller and other community plugins' blocks.

## Looking like Obsidian

The plugin's styles rely on Obsidian's own `app.css`, so the build puts it first in the page. It is not kept in the repo: it is read from the Obsidian that `node scripts/cloud-obsidian.mjs prepare` caches (or from `$OBSIDIAN_APP_CSS`). Set `THEME_DIR` to a theme checkout with a built `theme.css` to add the theme too; the page gets `theme-light`/`theme-dark` (by the device) and `is-mobile` on a phone, as Obsidian does. Fonts are the device's: the theme's macOS fonts exist on an iPhone.

    THEME_DIR=/path/to/obsidian-ribbons-theme RPG_VAULT_ROOT=/path/to/vault npm run sim:build
