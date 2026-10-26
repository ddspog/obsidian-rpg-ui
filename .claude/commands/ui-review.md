---
description: Review the plugin's UI on a phone and on a desktop with the Impeccable skill, toward a goal (mobile fit, consistency, accessibility, typography…); presents every analysis Impeccable can run to choose from, then a before/after board to rate and answer.
argument-hint: "[goal] [scope: a block family, a block, a note path, or 'all']"
---

# /ui-review — review the UI with Impeccable, phone and desktop

You review the interface of this plugin the way the owner likes it reviewed: **the real blocks on the real notes, phone first and then desktop, by an Impeccable design review and a measured one that run independently, ending in a board of findings with before and after pictures that the owner rates and answers.** Arguments: `$ARGUMENTS`.

Read `CLAUDE.md` ("Working with the repository owner", "Cloud Obsidian screenshots") first. The owner prefers questions as artifacts with real screenshots over questions in prose.

## 0. The goal and the scope

The first word of the arguments is the **goal**; the rest is the **scope**.

| Goal       | What it asks                                                                                  | Impeccable analyses it starts from                     |
| ---------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `mobile`   | Does it fit, read and work under a thumb on a 390px phone?                                    | `adapt`, `audit` (responsive), `critique` on the phone |
| `desktop`  | Is it dense, clear and finished at 1200px?                                                    | `critique`, `layout`, `polish`                         |
| `match`    | Do phone and desktop, light and dark, and the blocks beside each other look like one product? | `critique` (both sizes), `document`, `extract`         |
| `a11y`     | Contrast, focus, names, targets, motion                                                       | `audit`                                                |
| `type`     | Hierarchy, sizes, fonts                                                                       | `typeset`                                              |
| `layout`   | Spacing, rhythm, hierarchy                                                                    | `layout`                                               |
| `color`    | Palette, themes, light and dark                                                               | `colorize`, `quieter`                                  |
| `copy`     | Labels, hints, empty and error text                                                           | `clarify`                                              |
| `states`   | Empty, error, loading, missing-image, long-text cases                                         | `harden`, `onboard`                                    |
| `motion`   | Transitions, feedback, reduced motion                                                         | `animate`                                              |
| `speed`    | Render time, scroll, big notes                                                                | `optimize`                                             |
| `simplify` | Less chrome, fewer controls                                                                   | `distill`                                              |
| `tone`     | Too plain, too loud, too generic                                                              | `bolder`, `quieter`, `delight`, `overdrive`            |

**No goal, or "what can you do"?** Do not guess. Show the whole menu: every command in Impeccable's table (`~/.claude/skills/impeccable/SKILL.md`, "Commands"; install with the line in `CLAUDE.md` if it is missing), each with the one thing it tells the owner and what it would mean for this plugin, and your recommended picks for what the owner has said they care about. Let them choose one or several, with an artifact of checkboxes and a "Copy picks" summary. (Four or fewer, ask directly instead.) Run nothing until they pick.

**No scope?** Propose one from the census (§1) and say why: the least reviewed family, or the one the goal touches most. `all` means one pass per family, sampled at its best example, not every note.

## 1. Find real examples

- Read `docs/ui-review/README.md` (the curated example notes, and which areas are reviewed on which size) and `docs/ui-review/block-census.md` (every block type, its source, its stylesheet, and its best real examples).
- Refresh the census when the vault or the plugin changed: `node scripts/block-census.mjs --vault vault --vault "$RPG_VAULT_ROOT" --md docs/ui-review/block-census.md`.
- Pick the notes for the scope: **real content over test notes**, a note with the family in company, and the **hard cases** (a long note, a note with nothing in a block, a note with an image that is missing). Aim for 3 to 8 notes. Say which and why.
- The surfaces with no fence (settings, the card form, the drawer, modals, the map editors) are at the end of the census. Include them when the goal touches them.

## 2. Set up the app

```
npm run build
THEME_DIR=<theme checkout, e.g. /home/user/obsidian-ribbons-theme> RPG_VAULT_ROOT=<the owner's vault> node scripts/cloud-obsidian.mjs start
```

- The vault is **copied** (`~/.cache/rpg-obsidian/work/vault`); the owner's is never written to. After a rebuild copy `styles.css main.js` to `…/work/vault/.obsidian/plugins/dnd-ui-toolkit/` and reload the plugin (`app.plugins.disablePlugin("dnd-ui-toolkit")` then `enablePlugin`). A system config change (`vault/**/config/**`) needs copying into the work vault too.
- If the vault has hex maps, its packs folder is a plugin setting (`hexPacksFolder`); set it through the app or the maps draw plain.
- The vault may be ahead of the plugin (a config that imports a component this build lacks). A note that crashes with a React error is that, not a bug of yours: say which branch has the missing piece.
- Use the vault's own theme. A theme changes the result: Ribbons indents `h4`, restyles `button`, and so on.

## 3. Look: before pictures and measurements

Capture each note on a desktop window and on Obsidian's phone UI:

```
node scripts/ui-review-capture.mjs --out tmp/ui-review --label before \
  --note "<vault path>" --note "<vault path>" [--find "<css selector>"] [--max 6]
```

It writes `tmp/ui-review/before/{desktop,phone}/…png` and a `manifest.json` with, for each note and size, what overflows the pane, tap targets under 32px, text under 9px and console errors. Look at **every picture** (Read the PNGs, a contact sheet of the few that matter beats forty single views). The first phone run after a fresh start needs the notes rendered once on desktop; the script does desktop first for that reason.

## 4. Run the analyses: two reviewers who do not see each other

Per Impeccable's own method and the owner's rule, run these as **two isolated sub-agents** per size, then merge:

- **Design review** (Impeccable `critique`, or the chosen analysis): reads the screenshots and the source; heuristic scores, a "does it look like this product or like any product" verdict, P0 to P3 findings with where and why, the personas that fail, and questions. Phone first, then desktop. The picks from §0 decide which of Impeccable's references each agent loads (`~/.claude/skills/impeccable/reference/<command>.md`).
- **Detector and measurement**: `impeccable detect` on the live page (CDP port 9222; `--target` the page title) plus read-only measurement with Playwright (computed sizes, contrast, overflow), and the manifest from §3. Evidence, not opinion.

Merge their findings. **Verify any headline claim in the live app before you report it** (a colour, a size, "it overflows"): the earlier reviews of this repo had claims that did not survive a measurement. Respect Impeccable's craft floor (`reference/craft-floor.md`): no eyebrow labels over headings, no numbered sections for decoration, no nested cards, no accent side-borders, tokens declared once.

## 5. The board: findings with before and after

Write `tmp/ui-review/findings.json` (the format is at the top of `scripts/ui-review-board.mjs`): groups by block family or surface; each finding with a **title**, the **lens** (which Impeccable analysis found it), **severity** P0 to P3, a **description** (what, where, for whom), a **suggestion**, and the **before** pictures from §3. Findings that the goal or the owner's earlier decisions rule out are dropped, not listed.

```
node scripts/ui-review-board.mjs tmp/ui-review/findings.json tmp/ui-review/board.html
```

Publish `board.html` as a private artifact (Artifact tool; the page is self-contained). Tell the owner what is on it in a few lines: the goal, the notes, the count by severity, and the three findings that matter most. Do not fix anything yet unless the owner has already said to.

The board gives each finding a verdict (**Do it / Maybe / Skip**), 1 to 5 stars and a note, and a **Copy feedback** button; the owner pastes its text back.

## 6. Act on the feedback, then show the after

1. Do the **Do it** findings (and ask about **Maybe**s that change behaviour, as an artifact with mockups when they are visual). Keep each change small and in the family's own stylesheet (`lib/styles/components/`); phone rules go in `lib/styles/mobile.css`, shared sheet looks in `sheet-surface.css`.
2. Re-run the checks: `npm run typecheck`, `npm run lint`, `npx prettier@3.6.2 --check "**/*.{js,jsx,ts,tsx,json}"` (CI pins 3.6.2), `npm run test`, `npm run build`.
3. Capture again with `--label after` on the **same notes** (the pairs then line up), add `after` pictures to each finding in `findings.json`, rebuild the board, and **republish to the same artifact URL**.
4. Commit, push, and open or update the PR (a draft; end the body as `CLAUDE.md` and the session reminder say). Watch CI.

## Traps this repo has already hit

- Obsidian styles every `<button>` at specificity 0,1,1 (`button:not(.clickable-icon)`); a plugin button needs `button.my-class` or a `.markdown-rendered` prefix to win.
- A theme can indent or resize headings (`text-indent` on `h4`), so a flex heading needs `text-indent: 0` under its own selector.
- `backdrop-filter` makes `position: fixed` descendants clip to the filtered box: portal dialogs and full-screen views to `document.body`.
- `position: sticky` cannot leave its containing block; a "pinned" bar must be a child of the thing that scrolls.
- Tapping an `<img>` in reading view opens Obsidian's image viewer on a phone; images inside buttons get `pointer-events: none`.
- A two-finger pinch, a wheel and a drag on a map need `touch-action: none` on the map, and `preventDefault` on a non-passive wheel listener.
- Obsidian's phone UI stretches text inputs to the row; give small fields an explicit `flex` basis and width.
- Prettier here is 3.6.2 in CI. `npx prettier --version` may differ locally: use `npx prettier@3.6.2`.
