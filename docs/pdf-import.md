# Import a PDF as a compendium book

The command **Import PDF as compendium book** reads a PDF and writes it into the vault as a book:
one note a chapter, sections as tabs, tables as `rpg table` blocks, sidebars as `rpg rule.side`, entries of
one kind (spells, magic items, creatures) as a folder of notes, and the book's art beside them.

Almost all of the work is done by code. A model is optional, and is asked one thing only (see below).

## Using it

Run the command, then:

| Field | What it does |
| --- | --- |
| **PDF** | A PDF in the vault, or **Choose file…** for one anywhere on the device. The file is read in pieces as its pages are needed, so a book of hundreds of megabytes is never held in memory whole. |
| **Book name** | Names the book's folder and the `source` its notes carry. |
| **Folder** | Where the book's folder is made. |
| **Pictures** | Keeps the art as WebP in the book's `_assets` folder. |
| **OCR** | Reads pages that are only a scan (no text of their own) with Tesseract. The first use downloads the reader (about 15 MB) into the plugin's `ocr` folder; after that it works offline. The language is a Tesseract code (`eng`, `por`, `spa`…). |
| **Note length** | A chapter or section longer than this many lines (300) is split into tabs, each a note in a folder. |
| **Ask the model for tab icons** | Shown when an Anthropic link is set in the image studio's settings. |

## What it writes

```
Player's Guide/
  Player's Guide.md                    the book's contents, linking each chapter
  00. Introduction.md                  a short chapter: one note, its sections as rpg rule.tab blocks
  02. Character Classes.md             a long chapter: its opening text, then its sections as tabs…
  02. Character Classes/
    03. Barbarian.md                   …each a note in the chapter's folder (`@[[…/]].shallow().tab()`)
    03. Barbarian/                     a section that is itself too long is split the same way, once more
  07. Spellcasting/
    04. Spell Descriptions.md          entries of a kind: tabs by letter, each listing its entries
    04. Spell Descriptions/
      Acid Arrow.md …                  one note an entry
  _assets/
    players-guide-barbarian.webp …     pictures, named for the heading they sit under
```

Folder calls name the book's folder and the path below it, so the book's folder can be moved or renamed
(Obsidian's rename does not rewrite them: rename the folder, then search and replace its old name in the book).

## Game entities

With **Game entities** on (the default), sections that are things of the game are written as the blocks the
plugin reads them from, so they show as stat blocks, spell cards and items instead of plain text. They are
recognised by the way rulebooks of the 5e family write them:

| Entity | Recognised by | Written as |
| --- | --- | --- |
| Spell | a line under the name such as `2nd-Circle Arcane (Evocation)` or `3rd-level evocation`, then Casting Time, Range, Components, Duration | `rpg spell` with `circle`, `source`, `school`, `casting`, `range`, `components`, `duration`, `summary` |
| Creature | Armor Class and Hit Points lines, the six abilities, a `CR` on the heading or a Challenge line | `rpg stat.monster`; each trait, action, bonus action and reaction as an `rpg feature.details` in `Creature Traits/<Name> Traits.md`, which the stat block refers to |
| Magic item | an italic line such as `Wondrous Item, Uncommon 1,000 gp (Requires Attunement)` | `rpg item.magic` with `type`, `rarity`, `cost`, `attunement`, `applies_to.kinds` |
| Weapon, armor, gear | a row of a table with a Cost column and a Damage, Armor Class or Weight column | `rpg item.element` (one note a row, in a folder named for the table) with `weapon` or `armor` filled in |
| Class | a section with Class Features whose features come at stated levels | one note; each feature an `rpg feature.details` with `subtitle` and `level` |
| Subclass | the sections after a class's Subclasses heading | a note in the class's folder, with `.SUBCLASS: parent_class` |
| Lineage | a section with an `… Lineage Traits` heading | the traits as one `rpg feature.details` |
| Heritage, background, talent | their place in the book (under Heritage, Backgrounds, … Talents) and their run-in traits | an `rpg feature.details` under the flavour text |

Only what the page states is filled in: a spell's range, a creature's hit points, a weapon's damage. What
takes reading the rules text is left as text in the block's body, for a later pass (by hand or with a model):
what a feature grants or lets you choose (`traits`, `choose`, `passive`, `action`), how a spell rolls (`roll`),
a magic item's bonuses, and links to the vault's own notes (`[[Light Armor]]`). The book's contents note ends
with a count of the entities written.

Other rule systems are not recognised; their books still import as text, tabs and tables.

## How a page is read

1. **Text, pictures and shading** come from the PDF with pdf.js (Obsidian's own copy). A page with no text and a
   picture over most of it goes to OCR, and its words then take the same path.
2. **Furniture is dropped**: running heads and page numbers (text in the margins that repeats down the book),
   and pictures that repeat (page backgrounds, rules). Tables of contents and the index are skipped.
3. **Columns** are found from the empty strips that run down a page; the book's usual columns settle pages that
   are unclear on their own. What lies across columns (a wide heading, a wide table) splits the columns under it
   into bands; a column nothing crosses reads top to bottom.
4. **Shaded boxes** are tables when their lines are aligned cells (a dark strip on top is the header), and
   sidebars when they hold prose. Rows of aligned cells with no shading are tables too.
5. **Headings** are the looks (font, weight, size) that differ from the body text, ranked by size; a bar behind
   a line marks an entry's name. Paragraphs are cut at indents, wider gaps and changes of type, and run on
   across columns and pages; a word broken at a line's end is mended from the book's own words.
6. **Chapters** follow the PDF's bookmarks, else its biggest headings. A section whose parts are in
   alphabetical order under headings of one look is a list of entries, and becomes a folder.
7. **Pictures** sit where they were on the page, after the paragraph they interrupt; the first wide picture of a
   chapter is its banner.

## What the model is asked

Only when the toggle is on: one request with the titles of the chapters and their sections (no book text), to
pick an icon and a colour for each tab. For a 400-page book that is a few thousand tokens in and out. Anything
it gets wrong is ignored, and without it icons come from the words in the title.

## From a terminal

The same code runs outside Obsidian, for trying changes on a book and for very large files:

```
node scripts/pdf-import.mjs book.pdf out-folder --title "Player's Guide" [--from 9 --to 60] [--max-lines 300]
     [--catalog-min 8] [--no-images] [--no-ocr] [--no-entities]
```

`PDF_IMPORT_DEBUG=1` prints the heading looks found and every block with its page. `OCR_LANG=por` picks the
OCR language.

## What to check after an import

The import is a first draft of the book, not a finished transcription:

- **Heading ranks** come from type size. A book that sets one heading of a kind smaller than its fellows files
  it under the one before; a section that repeats its parent's parts is lifted back out, others are not.
- **Entities** are found by the patterns above. One written another way stays text; check the count against
  the book. A stat block's facts beyond the usual lines (a 5e block's Saving Throws, Skills) are kept under
  `stats` by name.
- **Scans** give no bold or italic, and headings only where the type is clearly bigger; pictures inside a
  scanned page are not cut out.
- **Tables** that span columns with merged cells, and tables with cells that wrap in every row, may need their
  rows joined by hand.
- Links to other notes (`[[Advantage]]`) and references between chapters are not made.
