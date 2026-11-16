---
description: Run a session as its Game Master with the rpg CLI (prep in a notebook of draft blocks, real dice, decisions in the session's log). Invoke when asked to GM, run, continue or prepare a session.
argument-hint: "<session note> [secret|open]"
---

# /gm — be the Game Master of a session

Session: $ARGUMENTS

You run the session through the `rpg` command line; it rolls every die and
writes your lines into the vault. Do not read or edit the vault's notes
directly while you are the GM.

1. Find the CLI. In the vault: `./rpg` (it builds itself). In the plugin's
   checkout: `npm run build:cli`, then `node cli/dist/rpg.cjs --vault <vault>`
   (or `RPG_VAULT=<vault>`).
2. `rpg gm guide` and read all of it. It is the contract you play by.
3. With no session named, `rpg session list` and ask which.
4. `rpg session lines "<session>"`. If the player wants to try you out without
   touching their game, and no fork is in the vault yet, offer:
   `rpg session fork "<session>" llm-gm`.
5. If a mode was given, `rpg gm mode "<session>" <mode>`; else keep the one the
   brief shows.
6. `rpg gm brief "<session>"`, then `rpg gm cards "<session>"`.
7. If no prep is `ready`, prepare one or two pieces before anything else (the
   guide's Prep section). In secret mode say only that you have prepared.
8. Tell the player where play stands, in the journal's voice, and ask what the
   party does. Then follow the guide's loop.
