# Import a PDF as a compendium book

The command **Import PDF as compendium book** reads a PDF and writes it into the vault as a book:
one note a chapter, sections as tabs, tables as `rpg table` blocks, sidebars as `rpg rule.side`, entries of
one kind (spells, magic items, creatures) as a folder of notes, and the book's art beside them.

Almost all of the work is done by code. A model is optional, and is asked one thing only (see below).

## Using it

Run the command, then:

| Field                                                  | What it does                                                                                                                                                                                                                                   |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PDF**                                                | A PDF in the vault, or **Choose file…** for one anywhere on the device. The file is read in pieces as its pages are needed, so a book of hundreds of megabytes is never held in memory whole.                                                  |
| **Book name**                                          | Names the book's folder and the `source` its notes carry.                                                                                                                                                                                      |
| **Folder**                                             | Where the book's folder is made.                                                                                                                                                                                                               |
| **Pictures**                                           | Keeps the art as WebP in the book's `_assets` folder.                                                                                                                                                                                          |
| **OCR**                                                | Reads pages that are only a scan (no text of their own) with Tesseract. The first use downloads the reader (about 15 MB) into the plugin's `ocr` folder; after that it works offline. The language is a Tesseract code (`eng`, `por`, `spa`…). |
| **Game entities**                                      | Writes spells, creatures, items, classes and the like as the plugin's own blocks (see below).                                                                                                                                                  |
| **File into a system**                                 | Shown when the vault has a folder with both `compendium` and `worldbuilding` in it. The book goes to that system's compendium and each entity to the folder its kind is kept in (see below).                                                   |
| **Name mark**, **Pictures in the vault's own folders** | With a system chosen: see Filing into a system's folders.                                                                                                                                                                                      |
| **Game line and publisher**                            | Make the `source` line every note carries (`From **Tales of the Valiant** "Player's Guide" by **Kobold Press**.`) and name the shelf the book's pictures are kept on.                                                                          |
| **Note length**                                        | A chapter or section longer than this many lines (300) is split into tabs, each a note in a folder.                                                                                                                                            |
| **Ask the model for tab icons**                        | Shown when an Anthropic link is set in the image studio's settings.                                                                                                                                                                            |

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

| Entity                       | Recognised by                                                                                                                          | Written as                                                                                                                                                          |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Spell                        | a line under the name such as `2nd-Circle Arcane (Evocation)` or `3rd-level evocation`, then Casting Time, Range, Components, Duration | `rpg spell` with `circle`, `source`, `school`, `casting`, `range`, `components`, `duration`, `summary`                                                              |
| Creature                     | Armor Class and Hit Points lines, the six abilities, a `CR` on the heading or a Challenge line                                         | `rpg stat.monster`; each trait, action, bonus action and reaction as an `rpg feature.details` in `Creature Traits/<Name> Traits.md`, which the stat block refers to |
| Vehicle                      | a stat block whose type line says Vehicle (`Large Land Vehicle (10 ft. by 5 ft.)`)                                                     | `rpg stat.vehicle` with `size`, `type`, `dimensions`, crew, passengers and cargo                                                                                    |
| Magic item                   | an italic line such as `Wondrous Item, Uncommon 1,000 gp (Requires Attunement)`                                                        | `rpg item.magic` with `type`, `rarity`, `cost`, `attunement`, `applies_to.kinds`                                                                                    |
| Weapon, armor, gear          | a row of a table with a Cost column and a Damage, Armor Class or Weight column                                                         | `rpg item.element` (one note a row, in a folder named for the table) with `weapon` or `armor` filled in                                                             |
| Class                        | a section with Class Features whose features come at stated levels                                                                     | one note; each feature an `rpg feature.details` with `subtitle` and `level`                                                                                         |
| Subclass                     | the sections after a class's Subclasses heading                                                                                        | a note in the class's folder, with `.SUBCLASS: parent_class`                                                                                                        |
| Lineage                      | a section with an `… Lineage Traits` heading                                                                                           | the traits as one `rpg feature.details`                                                                                                                             |
| Heritage, background, talent | their place in the book (under Heritage, Backgrounds, … Talents) and their run-in traits                                               | an `rpg feature.details` under the flavour text                                                                                                                     |

Only what the page states is filled in: a spell's range, a creature's hit points, a weapon's damage. What
takes reading the rules text is left as text in the block's body, for a later pass (by hand or with a model):
what a feature grants or lets you choose (`traits`, `choose`, `passive`, `action`), how a spell rolls (`roll`),
a magic item's bonuses, and links to the vault's own notes (`[[Light Armor]]`). The book's contents note ends
with a count of the entities written.

### Books set in another style

The same rules are printed very differently from book to book, so entities are told by what their lines say,
not by how they are set:

- **A name is known by the line under it.** The line that opens a spell's facts (`2nd-Circle Arcane
(Evocation)`, `3rd-level evocation (ritual)`, `Evocation cantrip`), a magic item's (`Wondrous item, rare
(requires attunement)`) or a creature's (`Large Beast`, `Medium humanoid (any race), any alignment`, then
  Armor Class) makes the line above it a heading, whatever type it is in.
- **Facts stand alone.** `Armor Class 12`, `Casting Time: 1 action` and the like are lines of their own and
  never headings, even where a book sets them bold in a second typeface.
- **Stat blocks** are read in both forms: modifiers alone (`+2 +1 −4 …`) or scores with modifiers
  (`8 (−1) 14 (+2) …`), `CR` on the heading or a `Challenge` line, and whatever other facts the block has.
- **A class's levels** come from a line under each feature (`3rd-Level Barbarian Feature`) where the book
  prints one, else from the class's own table (its Level and Features columns), else from the feature's first
  sentence (`Starting at 3rd level…`). A class may be a chapter of its own; its subclass may sit among its
  features or in a section after them, under any name (`Martial Archetypes`).
- **Tables** are found whether a book shades whole tables, stripes, or single cells, and where the header and
  the first column are left unshaded.

Tried on two books set quite unlike each other: the Tales of the Valiant Player's Guide and the 5e System
Reference Document 5.1. Rule systems outside the 5e family are not recognised; their books still import as
text, tabs and tables.

### Filing into a system's folders

With **File into a system** set to a folder laid out like `tales-of-the-valiant`:

| What                                                  | Where                                                                                                                                                                         |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ----------------------------- |
| The book's chapters                                   | `compendium/<book-name>/` (a new folder; if one of that name has notes, `<book-name>-2`)                                                                                      |
| Spells                                                | `worldbuilding/spells/cantrips`, `1st-circle`, `1st-circle-ritual`, …                                                                                                         |
| Creatures the book prices as mounts                   | `worldbuilding/bestiary/creatures/steeds/`                                                                                                                                    |
| What a druid may turn into                            | `worldbuilding/bestiary/animals/`: a creature with the Animal tag, or one in a section the book lists for druids' forms; in a book given a name mark, also a Beast below CR 6 |
| The book's own nonplayer characters                   | `worldbuilding/bestiary/npcs/`: creatures under a heading that says NPCs or nonplayer characters                                                                              |
| Other creatures                                       | `worldbuilding/bestiary/monsters/<creature type>/` (`beast`, `humanoid`, `fiend`…), the type as the stat block gives it                                                       |
| Vehicles                                              | `worldbuilding/bestiary/vehicles/<land                                                                                                                                        | water   | air>/`, as `rpg stat.vehicle` |
| Creatures' traits and actions                         | one note a creature type, `worldbuilding/traits/features/<Book> <Type> Traits`                                                                                                |
| Magic items                                           | `worldbuilding/enchantments/`                                                                                                                                                 |
| Weapons, armor, gear, tools                           | `worldbuilding/items/weapons/<simple-melee…>/`, `items/armor/<light…>/`, `items/adventuring-gear/…`, `items/tools/`                                                           |
| Classes, subclasses, lineages, heritages, backgrounds | `worldbuilding/traits/classes`, `subclasses`, `lineages`, `heritages`, `backgrounds`                                                                                          |
| Talents                                               | `worldbuilding/traits/talents/<magic                                                                                                                                          | martial | technical>/`                  |

- **A note the vault already has is never written over.** The book links to the one that is there, and
  the contents note lists which were left alone.
- **The book's pages list entities the way the system's own pages do**: a section of entries becomes one
  call a folder and a letter (`@[[…/spells/cantrips/]].shallow().filter(C prefix name).spell()`), which shows
  every note in that folder, this book's and any other's. The system's `spell` view is used where it has one.
- **Traits shared by a type.** Creatures of one type share a traits note. A trait two creatures have word for
  word is written once; one of the same name with other words is kept under the creature's name (its `id`)
  and still shown by its own name.
- **Price lists.** A table that prices things which are not carried (mounts, vehicles: a Cost column and no
  Weight, Damage or Armor Class) is a summary of stat blocks found elsewhere. Its cost and other columns are
  written into the stat block of the same name (`cost`, `travel_speed`, `carrying_capacity`), and a creature it
  prices as a mount is filed with the steeds.
- **Name mark.** A mark may be put after each entity's name to say where it comes from, as the vault does:
  `ᴰ` a D&D book, `ᴷ` a Kobold Press book outside the core, `º` another publisher's.
- **Pictures.** Where the vault has top-level folders named `… Banners` and `… Reference`, pictures are kept
  as its others are: chapter banners in `<Banners>/<Game line>/`, the book's pictures in
  `<Reference>/Compendium/<Game line>/<Book>/`, and the picture set with a creature, a magic item or a spell
  in `<Reference>/Bestiary`, `Items` or `Spells`, where it also becomes the block's `image`. Names are plain
  (`riding-horse.webp`); a picture the vault already has under that name is kept.
- **Source.** With a game line and a publisher given, every note carries
  `From **Game line** "Book" by **Publisher**.`

### Books of tables

Books that are mostly tables to roll on (name generators, adventure and world builders, solo toolboxes) are
read for what such books share:

- **A table's caption** (`Table 2-3: Creator Deity Epithet`, bold on a line of its own) stays in the text as a
  small heading and names the table under it, with the lines of how to use it left between the two. The
  table's id is the caption without its number (`creator-deity-epithet`). A table set straight under a
  heading, with no caption, is named for the heading.
- **A table that goes on** in the next column or on the next page is one table: its header repeated, its
  caption repeated with `continued`, or its numbers counting on from the last row's. A row cut by the page's
  end is mended.
- **A table rolled on a die** is written to be rolled: its first column counts from 1 to a die's top with no
  gap and its header names a die or a roll (`d20`, `1d100`, `Die Roll`). The header becomes `d20*` and the
  table ends with a roll row (`|= {{ roll }} =|`). Where the lines under the caption say the columns are
  rolled independently, the row is `{{ roll each }}`, with `join=''` when the cells are parts of a name. A
  table of more than twenty rows opens with `@paginate 10 pages`. A book's misprint (a number skipped) leaves
  the table as it is printed, not rollable; mend the row and add the roll row by hand.
- **Rows taller than a line.** A number set against the middle of a cell of two or three lines, a range broken
  in a narrow column (`45-` over `50`), a header on several lines, rows left unshaded between stripes, cells
  set centred: each is read as one row.
- **A wide table of a number and a long description** is a table, not a sidebar, and so is one stripe
  of a striped table that holds a single wrapped row.
- **Two halves side by side.** A table that ends one column and goes on at the foot of the next, a
  caption or a heading between, is joined by its numbers; one whose second half was read first is put
  back in order under its caption. A caption that says it continues, misspelt (`contined`, `continnued`)
  or cut short by its wrap, carries a table on; the book's header repeated in a column is dropped.
- **A header without a strip**: the bold, unnumbered lines at the top of a table are its header.
- **A page of two columns for part of its height** (a wide table above them) keeps the book's columns.
- **A grid drawn with rules**, of which only a title bar, a header band and the first column are shaded, is
  one table: the bar's words are its caption, and each of its rows is the run of lines set close together
  (cells of several lines, set against one another's middles).
- **Type of two sizes in one cell** (a big number between two small ones) is read left to right.
- **A dark strip down the page's outer edge**, and the words set on it (sample names, a chapter's label), is
  dressing and is left out.

**Once a chapter is read** its tables are looked at again, with all of the chapter at hand
(`repair.ts`). A table rolled on a die says by its numbers what belongs to it, so the pieces the
page-by-page reading left apart are put back: its rest further on (a table without a caption of its
own, or rows read as text such as `**4** A cult of the deity…`, the number at the start or against
the middle of the cell, references like `Tables 7-32 and 7-33` aside), its first part further back,
its rest read before it on the same page, its first rows read as short lines above it (`1 Goblin`,
`2 Kobold`), and lines of a wrapped cell read as rows of their own. A number the book skips, found
nowhere near the table, is covered by widening the row before it (`5-8` then `10` gives `5-9`), so
every roll lands on a row; the book's contents note says how many rows were widened, to check against
the book.

`node scripts/pdf-import-compare.mjs <import folder> <vault folders…> [-v]` measures an import against a book
already adapted by hand in a vault: captions found, tables with the same number of rows, tables rollable.
Tried on four books adapted in the testing vault (measured against the vault's tables):

| Book                          | Captions found | Same row count | Rollable   |
| ----------------------------- | -------------- | -------------- | ---------- |
| The Nomicon                   | 223 of 230     | 159 of 162     | 212 of 223 |
| Tome of World Building        | 392 of 404     | 355 of 379     | 360 of 392 |
| Tome of Adventure Design      | 369 of 379     | 315 of 344     | 340 of 369 |
| The Solo Adventurer's Toolbox | 17 of 94       | 14 of 17       | 5 of 13    |

The Toolbox prints no captions, so its tables were named by hand in the vault and few names match; its tables
themselves come through (its d100 lists as one table each across their pages). What the hand adaptation adds
beyond the import: tables moved to `gm-tools/tables`, links between tables, GM cards, misprints fixed.

### Scanned books

A page that is only a picture is read by OCR, and helped along so that entities can still be found:

- white text on dark bars (headings, table headers) is turned dark on light before it is read;
- bold words are told by their ink, since OCR does not say which are bold; that is what marks headings
  and the names that open a paragraph;
- names are also read from the words alone (`Bite. Melee Weapon Attack…`), and a stat block or spell whose
  numbers the scan lost is still written, with what could be read.

A book that is a scan throughout takes long (about seven seconds a page from a terminal) and, with no
bookmarks and headings set on coloured art, comes out as one chapter. One copy of Mythic Game Master
Emulator 2e (230 pages, every one a picture) is such a file, and is not usable as imported; the publisher's
own PDF of the same book, which has its text and bookmarks, imports in half a minute with its chapters and
sections as the book has them. **Where a book can be had with its text, use that file.** A page of art in
such a book gives OCR only stray letters, and is left a picture.

How much comes through depends on the scan. On clean 200 dpi pages of the two books above, about half of
the spells and creatures were recognised on the plainly set SRD pages and fewer on the Player's Guide's
textured, coloured pages; expect to fix names and numbers by hand.

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
   A drop capital is put back at the head of the paragraph it opens.
5. **Headings** are the looks (font, weight, size) that differ from the body text, ranked by size; a bar behind
   a line marks an entry's name. Paragraphs are cut at indents, wider gaps and changes of type, and run on
   across columns and pages; a word broken at a line's end is mended from the book's own words.
6. **Chapters** follow the PDF's bookmarks, else its biggest headings. Bookmarks are taken as they come:
   those that say `Chapter N` (in figures or words) are the chapters wherever they sit, a chapter named only
   by its number takes its name from its first page, bookmarks for every table, the file's own name and a
   word processor's marks are passed over, one with no place of its own starts where its first part does,
   and a bookmark around the whole book is looked under. A section whose parts are in
   alphabetical order under headings of one look is a list of entries, and becomes a folder.
7. **Pictures** sit where they were on the page, after the paragraph they interrupt; the first wide picture of a
   chapter is its banner.

## What the model is asked

Only when the toggle is on: one request with the titles of the chapters and their sections (no book text), to
pick an icon and a colour for each tab. For a 400-page book that is a few thousand tokens in and out. Anything
it gets wrong is ignored, and without it icons come from the words in the title.

## From a terminal

The same code runs outside Obsidian, for trying changes on a book, for very large files, and for a
model to drive (`.claude/commands/pdf-import.md` is the workflow for one). `node scripts/pdf-import.mjs help`
lists everything.

```
node scripts/pdf-import.mjs import book.pdf out-folder --title "Player's Guide" [--json] [--dry-run]
     [--report file.json] [--fail-on fix|check] [--from 9 --to 60] [--max-lines 300] [--catalog-min 8]
     [--no-images] [--no-ocr] [--no-entities]
     [--system tales-of-the-valiant] [--marker ᴰ] [--game "Tales of the Valiant"] [--publisher "Kobold Press"]
     [--views spell] [--portraits "z50. Reference"]
     [--banners "z51. Banners/Book"] [--pictures "z50. Reference/Compendium/Book"]
node scripts/pdf-import.mjs pages book.pdf 30,31 [--json]
node scripts/pdf-import.mjs review out-folder/.pdf-import/book.json [--severity fix] [--kind table-numbers] [--json]
```

- **`import`** (the default command) writes the notes, the review note, and a report of the whole
  result in `<out>/.pdf-import/<book>.json` (a dot folder, which Obsidian does not show; `--report`
  puts it elsewhere). `--dry-run` writes only the report.
- **`--json`** prints one JSON object a line: `start`; `progress` a few times a stage (reading pages,
  OCR, laying out, finding chapters, mending tables, checking the result, writing notes); `stage`
  with what a stage found (`pages`, `chapters` and whether they came from the bookmarks, `tables
mended`, `review` counts); and last `result` (with the first fix items and the report's path) or
  `error` (with the stage it failed in). Without it, the same in plain words on stderr and a summary
  on stdout.
- **Exit codes**: 0 done, 1 failed, 2 bad arguments, and 3 when `--fail-on` was given and the review
  has items that severe.
- **`pages`** prints what the layout made of those pages (lines with their place and size, boxes read
  as tables or sidebars and their rows, in reading order), after reading the whole book so the
  columns and running heads are the import's own.
- **`review`** pages through a report's items, worst first.

`PDF_IMPORT_DEBUG=1` prints the heading looks found and every block with its page. `OCR_LANG=por` picks
the OCR language.

## The import review

Every import writes a note **Import review** in the book's folder (linked from the book's contents
note), and the same list in the report. It holds what the import could not settle on its own, each
item with its note, its `rpg table` id and the PDF's page, as a checklist:

| Kind                               | Severity    | What it is                                                                             |
| ---------------------------------- | ----------- | -------------------------------------------------------------------------------------- |
| Tables that cannot be rolled       | fix         | A dice table whose numbers skip or stop short, as written.                             |
| Pieces of tables                   | fix         | A few numbered rows with no caption, not starting at 1.                                |
| Columns nearly empty               | check       | A column filled in only a row or two: a cell that slipped sideways.                    |
| Rows widened over a skipped number | check       | The repair covered a number found nowhere; right for a misprint, wrong for a lost row. |
| Rows put back                      | note        | Pieces joined from elsewhere in the chapter.                                           |
| Text that reads like a table       | check       | Lines in a row that open with numbers counting up.                                     |
| Headings that open with a number   | check       | Perhaps a table's row.                                                                 |
| Contents entries not found         | check       | An entry of the book's contents with no heading or caption of that name.               |
| Pages read by OCR                  | check       | Words and digits may be wrong.                                                         |
| Chapters                           | check / fix | The book was cut by its headings, or not at all.                                       |
| Notes left as they were            | note        | Entity notes the vault already had.                                                    |

The plugin's command writes the same note, and its notice says how many items there are.

## What to check after an import

The import is a first draft of the book, not a finished transcription:

- **Heading ranks** come from type size. A book that sets one heading of a kind smaller than its fellows files
  it under the one before; a section that repeats its parent's parts is lifted back out, others are not.
- **Entities** are found by the patterns above. One written another way stays text; check the count against
  the book. A stat block's facts beyond the usual lines (a 5e block's Saving Throws, Skills) are kept under
  `stats` by name.
- **Scans** lose words and digits, and with them entities (see Scanned books); pictures inside a scanned
  page are not cut out.
- **Tables** that span columns with merged cells, and tables with cells that wrap in every row, may need their
  rows joined by hand.
- Links to other notes (`[[Advantage]]`) and references between chapters are not made.
