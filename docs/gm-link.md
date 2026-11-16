# The GM link

A session played in Obsidian, a phone included, with its Game Master somewhere
else: a Claude Code session in the cloud (`docs/game-master.md`), or anyone
with a checkout of the vault. Turns travel over a branch of the vault's GitHub
repository. Nothing else is run: no server, no page.

## Setting it up

The GM, on a checkout of the branch it plays on:

```sh
rpg table link "<session>" --pr 21
# rpg-gm://owner/vault?branch=…&session=…&pr=21
```

The player, in the plugin's settings, General › GM link:

- **Link**: that line.
- **GitHub token**: a fine-grained token for that one repository, with
  Contents and Pull requests set to read and write. It stays on the device
  (the settings' Copy leaves it out).

## A turn

1. The player plays as always, then **Hand over** (in the Log's controls, the
   settings, or the command "GM link: hand over to the Game Master"), with a
   line to the GM if wanted. The plugin commits the session's play notes (the
   session's note, the party's sheets, every note under the party's folder) to
   the branch in one commit, with `.rpg-sessions/<session>/table.json` saying
   the turn is the GM's and what the player said. With a pull request in the
   link, it comments there: that is what wakes a Claude session watching it.
2. The GM pulls, and `rpg table take "<session>"` prints the player's message
   and what they added to the log. It plays with `rpg gm …`.
3. `rpg table give "<session>" --note "<what the player reads first>"` sets
   `table.json` back to the player; the GM commits and pushes.
4. The plugin looks for the turn every 45 seconds while one is out and
   Obsidian is in front (or on **GM's turn?** / "GM link: check for the GM's
   turn"). When it has come, a dialog shows what the GM says and which notes
   it changed; **Write it to my notes** writes them.

What the plugin writes back is only notes (`.md`) outside dot-folders: the
GM's hidden notebook (`.gm/`) and the saved lines (`.rpg-sessions/`) stay on
the branch and never reach the player's vault.

If the player changes a note after handing over, the dialog says so before
the GM's turn replaces it. "GM link: take the turn back" stops the waiting.

## Where the code is

- `lib/domains/gm-link/link.ts`: the link, `table.json`, which notes go and
  which come back. `turn.ts`: hand over, check, apply, over a relay and a
  vault given as plain functions.
- `lib/services/github-relay.ts`: GitHub's API through Obsidian's
  `requestUrl` (one commit through the git data API, raw file reads, compare,
  a pull request comment).
- `lib/plugin/gm-link.ts`: the controller, its two dialogs, the commands.
- `cli/rpg/session/table.ts`: `rpg table link | take | give`.

## Not yet

- The Log does not lock while the turn is with the GM; the dialog guards the
  overwrite instead.
- The plugin's state file (the log's bookkeeping baseline) does not travel.
- One link at a time: one session, one GM.
- Pictures and other files that are not notes are not sent or taken.
