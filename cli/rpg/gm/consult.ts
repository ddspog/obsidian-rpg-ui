/**
 * Consulting the books. `shelf` is what the vault holds, by folder (books and
 * their chapters, rules, the bestiary, the GM's tools), so a reader knows where
 * a kind of answer lives; `consult` finds the passages that hold some words,
 * best first, under the heading they sit in.
 */

import type { Ctx } from "../app";

export interface ShelfFolder {
  path: string;
  notes: number;
  /** Its own notes' names (a book's chapters), when few enough to list. */
  names?: string[];
  folders: ShelfFolder[];
}

/** The folder a session's system lives in: the first folder of its path. */
export const systemRoot = (path: string): string => path.split("/")[0];

export function shelf(ctx: Ctx, root: string, depth = 2, list = 14): ShelfFolder {
  const files = ctx.vault.getMarkdownFiles().filter((f) => f.path.startsWith(`${root}/`));
  const build = (path: string, left: number): ShelfFolder => {
    const under = files.filter((f) => f.path.startsWith(`${path}/`));
    const own = under.filter((f) => !f.path.slice(path.length + 1).includes("/"));
    const subs = [
      ...new Set(
        under
          .map((f) => f.path.slice(path.length + 1).split("/"))
          .filter((p) => p.length > 1)
          .map((p) => p[0])
      ),
    ];
    return {
      path,
      notes: under.length,
      ...(own.length && own.length <= list ? { names: own.map((f) => f.basename).sort() } : {}),
      folders: left > 0 ? subs.sort().map((s) => build(`${path}/${s}`, left - 1)) : [],
    };
  };
  return build(root, depth);
}

export function renderShelf(s: ShelfFolder, indent = 0): string {
  const pad = "  ".repeat(indent);
  const name = indent === 0 ? s.path : s.path.split("/").pop();
  const lines = [`${pad}- ${name}/ (${s.notes})${s.names ? `: ${s.names.join("; ")}` : ""}`];
  for (const f of s.folders) lines.push(renderShelf(f, indent + 1));
  return lines.join("\n");
}

export interface Passage {
  note: string;
  heading?: string;
  score: number;
  excerpt: string;
}

const words = (s: string) =>
  s
    .toLowerCase()
    .split(/[^\p{L}\p{N}']+/u)
    .filter((w) => w.length > 1);

/** A word and its plain plural or singular. */
const forms = (w: string) => [...new Set([w, w.endsWith("s") ? w.slice(0, -1) : `${w}s`])];

/**
 * Passages holding the words: a note is cut at its headings, and each piece
 * scored by the words it holds (a word in the note's name or the heading
 * counts for more; a piece must hold every word, in itself, its heading or its
 * note's name).
 */
export function consult(ctx: Ctx, query: string, opts: { under?: string[]; limit?: number } = {}): Passage[] {
  const want = words(query).map(forms);
  if (want.length === 0) return [];
  const under = (opts.under ?? []).map((u) => u.toLowerCase());
  const out: Passage[] = [];
  for (const file of ctx.vault.getMarkdownFiles()) {
    const path = file.path.toLowerCase();
    if (under.length && !under.every((u) => path.includes(u))) continue;
    const text = ctx.vault.readSync(file);
    const low = text.toLowerCase();
    const name = file.basename.toLowerCase();
    if (!want.every((fs) => fs.some((f) => low.includes(f) || name.includes(f)))) continue;
    const pieces = text.replace(/^---\n[\s\S]*?\n---\n?/, "").split(/^(?=#{1,6} )/m);
    for (const piece of pieces) {
      const heading = piece.match(/^#{1,6} +(.+)$/m)?.[1].trim();
      const body = piece.toLowerCase();
      const head = (heading ?? "").toLowerCase();
      let score = 0;
      let all = true;
      for (const fs of want) {
        const inName = fs.some((f) => name.includes(f));
        const inHead = fs.some((f) => head.includes(f));
        const count = fs.reduce((n, f) => n + (body.split(f).length - 1), 0);
        if (!inName && !inHead && count === 0) {
          all = false;
          break;
        }
        score += (inName ? 6 : 0) + (inHead ? 4 : 0) + Math.min(count, 5);
      }
      if (!all) continue;
      // Where in the piece the first word shows, with what surrounds it.
      const first = Math.max(
        0,
        Math.min(...want.flatMap((fs) => fs.map((f) => body.indexOf(f)).filter((i) => i >= 0)), body.length)
      );
      const from = Math.max(0, first - 120);
      const excerpt = piece
        .slice(from, from + 420)
        .replace(/```[^\n]*\n?/g, "")
        .replace(/\s+/g, " ")
        .trim();
      out.push({
        note: file.path,
        ...(heading ? { heading } : {}),
        score: score / Math.sqrt(1 + piece.length / 4000),
        excerpt,
      });
    }
  }
  return out.sort((a, b) => b.score - a.score || a.note.length - b.note.length).slice(0, opts.limit ?? 12);
}

export function renderPassages(found: Passage[]): string {
  if (found.length === 0) return "Nothing holds those words. Try fewer, or other ones.";
  return found.map((p) => `- **${p.note}**${p.heading ? ` › ${p.heading}` : ""}\n  ${p.excerpt}`).join("\n");
}
