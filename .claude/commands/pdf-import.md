---
description: Import a PDF into the vault as a compendium book with scripts/pdf-import.mjs, follow it stage by stage, read its review of what needs judgement, and fix what can be fixed. Invoke when asked to import, convert or adapt a PDF book, or to look into how one was imported.
---

# Importing a PDF book

`scripts/pdf-import.mjs` runs the same import as the plugin's command "Import PDF as compendium book",
from a terminal. It is made to be driven by a model: it reports each stage as JSON, and every run
leaves a review of what it could not settle on its own. `node scripts/pdf-import.mjs help` is the
reference; this is the workflow.

Arguments: $ARGUMENTS

## 1. Run it and follow it

```
node scripts/pdf-import.mjs import book.pdf <out> --title "Book Name" --json [--system tales-of-the-valiant]
```

- With `--system`, `<out>` is the vault (`../testing-vault`, or `RPG_VAULT_ROOT`); the book goes to
  `<system>/compendium/<book>` and nothing that exists is written over. Without it, try in a scratch
  folder first. `--dry-run` reads and checks everything and writes only the report.
- Each stdout line is one JSON object. `progress` lines come a few times a stage (`Reading pages`,
  `Reading pages (OCR)`, `Laying out`, `Finding chapters`, `Mending tables`, `Checking the result`,
  `Writing notes`); `stage` lines say what each stage found:
  - `pages`: how many, and how many were read by OCR. Many OCR pages means a scanned book: ask for a
    copy with its text before going on (a scan of Mythic GME took 26 minutes and came out unusable;
    the publisher's PDF took 30 seconds).
  - `chapters`: the chapters and their pages, and `from`: `bookmarks` (good), `headings`, or `one`
    (the whole book is one chapter: check the bookmarks with `pages`, or cut with `--from`/`--to`).
  - `tables mended`: pieces of tables put back, wrapped lines folded, rows widened.
  - `review`: how many items to `fix`, to `check`, and `note`.
- The last line is `result` (folder, notes, tables, entities, chapters, review counts with the first
  20 `fix` items, and the path of the `report`), or `error` with the stage it failed in.
  Exit code 0 done, 1 failed, 2 bad arguments; `--fail-on fix` exits 3 while fix items remain.
- A large book takes a while (~30 s for 350 pages with text; OCR is ~7 s a page). Run it in the
  background and read the stream, rather than waiting blind.

## 2. Read the review

```
node scripts/pdf-import.mjs review <report.json> --severity fix --json
node scripts/pdf-import.mjs review <report.json> --kind row-widened
```

Each item is `{kind, severity, note, table, page, message}`: the note (vault path without `.md`), the
`rpg table` block's id, and the PDF page. The same list is in the book's note `Import review`, as a
checklist the owner can tick. Kinds:

| kind               | severity  | what to do                                                                                                                                                                                                                             |
| ------------------ | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `table-numbers`    | fix       | The table's numbers skip or stop short. Look at its page (`pages`) and the next: the rows are often in a sidebar, a paragraph or another table nearby. Move them in, or, if the book itself skips the number, widen the row before it. |
| `table-fragment`   | fix       | A few numbered rows with no caption: join them to the table before or after.                                                                                                                                                           |
| `table-column`     | check     | A column nearly empty: a cell or a number slipped sideways; move it back.                                                                                                                                                              |
| `row-widened`      | check     | The import widened a row over a number found nowhere. Right if the book skips it (a misprint); wrong if a row was lost. Check the page.                                                                                                |
| `rows-joined`      | note      | Rows put back from elsewhere; glance at the order.                                                                                                                                                                                     |
| `text-like-table`  | check     | Lines that count up: perhaps a table read as text.                                                                                                                                                                                     |
| `row-as-heading`   | check     | A heading that opens with a number: perhaps a row.                                                                                                                                                                                     |
| `contents-missing` | check     | A contents entry with no heading or caption of that name. Often a spelling or split difference; sometimes a lost section.                                                                                                              |
| `ocr-page`         | check     | Words and digits may be wrong.                                                                                                                                                                                                         |
| `chapters`         | check/fix | How the book was cut, when not from bookmarks.                                                                                                                                                                                         |
| `kept`             | note      | An entity note that already existed; the book links to it.                                                                                                                                                                             |

Do not tick or delete items for the owner. Fix what is plainly wrong in the notes, say what you
fixed, and leave the judgement calls (misprints, a table the vault adapted differently) to them.

## 3. Look at a page

```
node scripts/pdf-import.mjs pages book.pdf 30,31 [--json]
```

What the layout made of those pages, in reading order: each line with its position (`x`, `y`) and
size, each box read as a table (with its header) or a sidebar, and its rows. The whole book is read
first, so columns and running heads are the ones the import used. Rendering the page to a PNG
(pdf.js with @napi-rs/canvas) and looking at it beside this shows what went wrong.

## 4. Measure a change to the importer

For a change to `lib/domains/pdf-import/`, compare before and after on books already adapted by hand:

```
node scripts/pdf-import-compare.mjs <out>/<book> ../testing-vault/tales-of-the-valiant/compendium/<book> \
  ../testing-vault/tales-of-the-valiant/gm-tools/tables/<book> [-v]
```

The figures to beat are in `docs/pdf-import.md`; also run the 5e SRD 5.1 and check its entity counts
do not change. See `CLAUDE.md` (PDF import) for the books used.
