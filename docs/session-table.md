# The session table

A session played in a browser, with a Game Master somewhere else. The page is
the plugin's own Log running on the session's note (`simulators/session-table`):
the party's sheets and cards, the GM's cards, bookkeeping, links that open
their note in the page. It collects what the player does; **Hand over to the
GM** sends it. Made for a Claude Code session in the cloud as the GM
(`docs/game-master.md`), with the page published as an artifact.

```sh
npm run build                      # styles.css
node scripts/cloud-obsidian.mjs prepare   # once: Obsidian's app.css
THEME_DIR=../obsidian-ribbons-theme RPG_VAULT_ROOT=../testing-vault \
  node simulators/build.mjs session-table --session "01. Journey to Wisdom's Path" \
  --notify <the GM's Claude Code session id>
# → simulators/dist/session-table.html
```

Publish that file as an artifact with the capabilities
`{db: {}, user: {}, mcp: {servers: [{server: "Claude Code Remote", tools: ["send_message"]}]}}`.

## A turn

1. The player plays in the page: cards, rolls, picks, Save. The notes change
   in the page only (kept in the browser, so a reload does not lose them).
2. **Hand over to the GM**: a line to the GM if wanted, then _Send my turn_.
   The page writes `table/turn` (`{ rev, files, message, at }`: every note the
   player changed, whole) to its database, and tells the GM's session through
   the Claude Code Remote connector. Where that connector is not allowed, it
   says so and copies "My turn is in." to paste in the chat.
3. The GM's session reads `table/turn` from the artifact's database
   (`ArtifactData get`, saved to a file) and runs
   `rpg table take "<session>" --file turn.json`: the notes go into the vault
   (only the session's play notes are accepted; each is backed up), and the
   new log lines and the message are printed. The GM plays its part with
   `rpg gm …`.
4. `rpg table state "<session>" --rev <turn's rev + 1> --note "<what the GM tells the player>"`
   prints the document to write to `table/state` (`ArtifactData set`). The
   page hears it, draws the Log again with the GM's lines, shows the GM's
   words above it, and it is the player's turn.

The page shows whose turn it is: a turn sent on top of the state shown is
"with the Game Master" until a newer state arrives.

## What is in the page

- The vault's Markdown notes, less what `simulator.json` leaves out (the
  books under `compendium`, `Sandbox`, GM notebooks): about 14 MB with the
  code. A hidden notebook (`.gm/`) is never copied; `rpg table state` leaves
  an open one (`… (GM).md`) out too.
- The vault's systems, bundled by the build as the plugin bundles them in
  Obsidian (`<folder>/config/index.ts`), and evaluated by the plugin's own
  evaluator (`simulators/core/ts-loader-prebuilt.ts`). Any simulator gets
  them with `"system": true` in its `simulator.json`.

## Not yet

- Pictures: battle maps, tokens and portraits are not in the page, so a fight
  on a battle map cannot be played there.
- A linked note opens as its prose with its `rpg` blocks shown as text, not
  rendered.
- One log block (the note's first). One player: a second viewer's unsent work
  is their own until they hand over, and the last hand-over wins.
- The page is built once: a note the GM changes outside the session's play
  notes (a new statblock) needs a rebuild and a republish.
