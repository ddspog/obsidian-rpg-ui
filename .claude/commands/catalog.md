---
description: Build or maintain a party's encounter catalog with the rpg CLI (init, draft, review drafts, confirm, check). Invoke when asked to build, seed or update an encounter catalog.
argument-hint: "<party name or catalog>"
---

# /catalog — keep a party's encounter catalog

You drive `rpg sim catalog` against the vault; it does the reading and the
writing. Do not edit the catalog note directly.

If the vault already has catalogs, `rpg sim catalog list` (a party name or
`--catalog` picks one when there are several) shows what is in them.

1. Find the CLI. In the vault: `./rpg` (it builds itself). In the plugin's
   checkout: `npm run build:cli`, then `node cli/dist/rpg.cjs --vault <vault>`.
2. **Start from the session.** `rpg sim catalog session --catalog <party>` —
   the party's number is counted from the vault, so fits know when they age
   out.
3. **No catalog yet:** `rpg sim catalog init --party-name "<name>"` (its party
   is the stock party; `--pc` names another), then draft:
   `rpg sim catalog draft <note-or-folder>` is a dry run — read each draft's
   `scene` and `reasons` and judge them as encounters, not as extractions.
   `rpg sim catalog draft <folder> --accept` keeps the high-confidence ones;
   `--accept --min-confidence medium --limit 400` lists the rest, and
   `--accept --only <id>…` writes the ones a review kept.
4. **Already drafted:** a catalog built for another difficulty or an older
   party is stale the day the sheet changes. `rpg sim catalog check` re-fights
   what needs it (borderline entries re-run at more trials and say so);
   `catalog adjust <id>…` proposes counts, swaps and reinforcements for entries
   that do not fit, and `--accept [--pick N]` keeps one as a new draft.
5. **Confirm what you keep.** `rpg sim catalog confirm <id>…` flips drafts a
   person has read; `plan` offers confirmed entries before drafts. Unconfirmed
   drafts are guesses — read them before they are offered at the table.
6. **At the table:** `rpg sim plan [<theme words>]` is the one call; a swept
   group that should be kept goes in with `rpg sim catalog add --name "<name>"
--monster "<note>[:<count>]"…` (or `suggest --accept` when it came from a
   sweep), a run is recorded with `catalog use <id>…` (it is held back for
   `reuseAfterSessions`), and the next session's `catalog session` + `check`
   keeps the fits honest. `rpg sim catalog suggest --brief` is the read at the
   table.

The catalog is a vault note a person can read and edit by hand; the CLI's
writes only touch the entry blocks. The details worth knowing (fit states,
staleness, the board in Obsidian) are in `docs/encounter-catalog.md`.
