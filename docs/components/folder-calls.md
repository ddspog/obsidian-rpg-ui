# Folder calls

A call on a folder shows each note in it through a view, and sweeps its subfolders too:

```md
`@[[worldbuilding/enchantments/]].magic()`
`@[[bestiary/creatures/druid-forms/]].filter(B prefix name).highlight().stat()`
```

| Chain step      | What it does                                                                                                           |
| --------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `.filter(expr)` | Keeps the notes whose data match: `rarity == Rare`, `cr like /^(1\/4\|1\/2)$/`, `B prefix name`, `tags contains Fire`. |
| `.shallow()`    | Keeps to the folder's own notes, not its subfolders'.                                                                  |
| `.highlight()`  | Marks notes from another source than the calling note's.                                                               |
| `.paginate(n)`  | Shows `n` notes a page. `.paginate(0)` shows them all at once.                                                         |
| `.facets(a, b)` | The fields offered as selects to narrow the list (`rarity`, `type`, `cr`, `circle`, `school`…).                        |

## Pages and filters

A folder can hold hundreds of notes, and drawing them all at once makes a note slow to open. A call that
shows notes as blocks (`.stat()`, `.magic()`, `.spell()`, `.bare()` and the like) shows **12 a page** when it
finds more than that, with:

- a search box, matching the words of the note's name;
- a select for each field the view's notes are usually told apart by: `.magic()` rarity and type, `.spell()`
  circle and school, `.stat()` and `.bare()` type and CR (a field with a single value across the notes is left
  out);
- the count of notes shown, and arrows between pages.

`.paginate(n)` sets another page size, `.paginate(0)` turns paging off, and `.facets(…)` chooses the fields. These options (and `.shallow()`, `.highlight()`) can also come after the view: `.stat().paginate(4)`.
Calls that list notes as lines (rows of a list) are not paged unless they ask with `.paginate(n)`.
