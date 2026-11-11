/**
 * PDF import: the shapes that travel between its steps. A page is read into
 * runs of text, pictures and filled boxes (extract.ts); laid out into lines in
 * reading order (layout.ts); typed into blocks (blocks.ts); gathered into
 * chapters and sections (structure.ts); and written as notes (emit.ts).
 *
 * All positions are in PDF points with the origin at the page's top left.
 */

/** A piece of text in one font, as the PDF draws it. `y` is its baseline. */
export interface TextRun {
  str: string;
  x: number;
  y: number;
  w: number;
  size: number;
  /** The font's own name with the subset prefix dropped (`Verdigris-Bd`). */
  font: string;
  bold: boolean;
  italic: boolean;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A picture placed on a page. `file` is where its bytes were written, if they were. */
export interface PageImage extends Rect {
  /** Same for every placement of the same picture (a page background, a divider). */
  key: string;
  pxW: number;
  pxH: number;
  file?: string;
}

/** A filled rectangle: the shading behind a table, a sidebar, a heading bar. */
export interface FillRect extends Rect {
  /** A dark fill (white text on it): a table's header row, a heading bar. */
  dark: boolean;
}

export interface RawPage {
  /** 1-based page number in the file. */
  num: number;
  width: number;
  height: number;
  runs: TextRun[];
  images: PageImage[];
  rects: FillRect[];
  /** True when the text came from OCR of the page's picture. */
  ocr?: boolean;
}

export interface OutlineEntry {
  title: string;
  /** 1-based page the bookmark lands on. */
  page: number;
  depth: number;
}

/** Text with its emphasis, before it is written as markdown. */
export interface Span {
  text: string;
  bold: boolean;
  italic: boolean;
}

/** Text between two wide gaps on one baseline: a table cell, or a whole line of prose. */
export interface Seg extends Rect {
  spans: Span[];
  size: number;
  font: string;
  /** Baseline. */
  base: number;
}

/** The segments on one baseline within one column (or one box). */
export interface Line {
  cells: Seg[];
  x: number;
  /** Right edge. */
  r: number;
  base: number;
  size: number;
  font: string;
  page: number;
  /** The column's (or box's) left and right edges, to judge indents and short lines. */
  colL: number;
  colR: number;
  /** Sits on a dark bar the width of the column: a heading. */
  barred?: boolean;
}

export interface Box extends Rect {
  lines: Line[];
  /** Bottom of the dark rectangle at its top, when there is one: a table's header rows. */
  headBottom?: number;
  page: number;
}

/** What a page holds, in reading order. */
export type Element =
  | { kind: "line"; line: Line }
  | { kind: "box"; box: Box }
  | { kind: "image"; image: PageImage; page: number; colW: number };

export type Block =
  | { type: "heading"; level: number; text: string; page: number; style: string }
  | { type: "para"; spans: Span[]; page: number }
  | { type: "list"; ordered: boolean; items: Span[][]; page: number }
  | { type: "table"; caption?: string; rows: string[][]; page: number }
  | { type: "side"; title?: string; blocks: Block[]; page: number }
  | { type: "image"; file: string; page: number; wide: boolean; pxW: number; pxH: number };

/** A heading and what is under it. The root of a chapter has level 0. */
export interface Section {
  title: string;
  level: number;
  style: string;
  page: number;
  /** A short tag the heading carried at its far end, taken off the title: a creature's `CR 1/4`. */
  tag?: string;
  /** Blocks before the first subsection. */
  blocks: Block[];
  children: Section[];
}

export interface Chapter {
  title: string;
  /** `01`, `02`… or empty for an appendix, which keeps its own name. */
  number: string;
  firstPage: number;
  lastPage: number;
  root: Section;
  banner?: string;
}

/** A note or picture to write, with its path below the book's folder. */
export interface OutFile {
  path: string;
  text: string;
  /** The path is from the vault's root, not from the book's folder. */
  outside?: boolean;
}

export interface TabLook {
  icon: string;
  color: string;
}

export interface ImportOptions {
  /** The book's name: its folder, and the `source` its notes carry. */
  title: string;
  /** A note longer than this many lines is split into tabs in a folder. */
  maxLines: number;
  /** This many like sections under one heading become a folder of notes. */
  catalogMin: number;
  /** Keep pictures. */
  images: boolean;
  /** Read pages that have no text with OCR. */
  ocr: boolean;
  /** Write spells, creatures, items, classes and the like as the plugin's blocks for them. */
  entities: boolean;
  /**
   * A system's folder (the one with `compendium/` and `worldbuilding/`): the book goes into its
   * compendium and each entity into the folder its kind is kept in there. Empty: all in one folder.
   */
  system?: string;
  /** The `source` line the notes carry; without one, `From **<title>**.` */
  source?: string;
  /**
   * A mark put after the name of each entity filed into a system, saying where it comes from (in the
   * vault: `ᴰ` a D&D book, `ᴷ` a Kobold Press book outside the core, `º` another publisher's).
   */
  marker?: string;
  /** Folder for chapter banners (from the vault's root); the book's `_assets` without one. */
  bannerFolder?: string;
  /** Folder for the book's other pictures (from the vault's root); the book's `_assets` without one. */
  pictureFolder?: string;
  /**
   * Folders for the pictures of entities, by kind (`creature`, `vehicle`, `spell`, `magic item`),
   * from the vault's root; a kind without one keeps its pictures with the book's.
   */
  portraitFolders?: Record<string, string>;
  /** Rule views the system has (`spell`, …): used to list entities the way the system shows them. */
  views?: string[];
  /** First and last page to read (1-based, inclusive); the whole file when absent. */
  from?: number;
  to?: number;
}

export const DEFAULT_OPTIONS: ImportOptions = {
  title: "",
  maxLines: 300,
  catalogMin: 8,
  images: true,
  ocr: true,
  entities: true,
};
