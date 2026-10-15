/**
 * The places a note keeps an image — what the image studio can replace or
 * add: a frontmatter key (`banner:`), a key inside one of its `rpg` blocks
 * (an item's `image:`, a card's `icon:`), or a hotbar icon for a card it
 * names (an image named for it in the icons folder).
 */

/** Frontmatter keys that hold a picture. */
const FRONTMATTER_IMAGE_KEYS = /^(image|banner|cover|art|portrait|picture|reference_img|token_image|thumbnail)$/i;
/** Keys inside a block that hold a picture. */
const FENCE_IMAGE_KEYS = ["image", "icon", "art", "portrait", "src"];

export type ImageTarget =
  | { kind: "frontmatter"; key: string; value?: string; label: string }
  | { kind: "fence"; fence: number; meta: string; key: string; value?: string; owner?: string; label: string }
  | { kind: "icon"; name: string; label: string };

interface Fence {
  meta: string;
  /** Line indexes of its opener and closer. */
  open: number;
  close: number;
}

/** The note's `rpg` fences, outermost only — their info string and lines. */
export function rpgFences(text: string): Fence[] {
  const lines = text.split("\n");
  const out: Fence[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(`{3,}|~{3,})\s*rpg\s+(\S+)/);
    if (!m) continue;
    const close = new RegExp(`^${m[1][0] === "`" ? "`" : "~"}{${m[1].length},}\\s*$`);
    let end = lines.length - 1;
    for (let j = i + 1; j < lines.length; j++) {
      if (close.test(lines[j])) {
        end = j;
        break;
      }
    }
    out.push({ meta: m[2], open: i, close: end });
    i = end;
  }
  return out;
}

/** A fence's head — its lines before `---` (or all of it). */
function headRange(lines: string[], f: Fence): [number, number] {
  for (let j = f.open + 1; j < f.close; j++) if (lines[j].trim() === "---") return [f.open + 1, j];
  return [f.open + 1, f.close];
}

const unquote = (v: string) => v.trim().replace(/^["']|["']$/g, "");

/** Every image the note keeps, and the ones it could add. */
export function imageTargets(text: string, basename: string): ImageTarget[] {
  const lines = text.split("\n");
  const out: ImageTarget[] = [];
  // Frontmatter: its picture keys.
  if (lines[0]?.trim() === "---") {
    for (let i = 1; i < lines.length && lines[i].trim() !== "---"; i++) {
      const m = lines[i].match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
      if (m && FRONTMATTER_IMAGE_KEYS.test(m[1]))
        out.push({ kind: "frontmatter", key: m[1], value: unquote(m[2]), label: `Frontmatter · ${m[1]}` });
    }
  }
  const names = new Set<string>();
  rpgFences(text).forEach((f, fence) => {
    const [from, to] = headRange(lines, f);
    let owner: string | undefined;
    const present = new Set<string>();
    for (let i = from; i < to; i++) {
      const m = lines[i].match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
      if (!m) continue;
      if (m[1] === "name") owner = unquote(m[2]);
      if (FENCE_IMAGE_KEYS.includes(m[1])) {
        present.add(m[1]);
        out.push({ kind: "fence", fence, meta: f.meta, key: m[1], value: unquote(m[2]), label: "" });
      }
    }
    // Its own label, now its name is known; and an image it could add.
    for (const t of out)
      if (t.kind === "fence" && t.fence === fence) t.label = `${f.meta}${owner ? ` "${owner}"` : ""} · ${t.key}`;
    const addable = /^item\./.test(f.meta) ? "image" : /^(feature|stat)\./.test(f.meta) ? "icon" : undefined;
    if (addable && !present.has(addable)) {
      out.push({
        kind: "fence",
        fence,
        meta: f.meta,
        key: addable,
        ...(owner ? { owner } : {}),
        label: `${f.meta}${owner ? ` "${owner}"` : ""} · add ${addable}`,
      });
    }
    // A character's sheet can hold a portrait, even before it has one.
    if (
      /^character\.(health|sheet)$/.test(f.meta) &&
      !present.has("portrait") &&
      !out.some((t) => t.kind === "fence" && t.key === "portrait")
    ) {
      out.push({ kind: "fence", fence, meta: f.meta, key: "portrait", label: `${f.meta} · add portrait` });
    }
    if (owner) names.add(owner);
  });
  // A hotbar icon for the note, and for each card it names — at any depth
  // (a class's features sit inside its tabs), and the actions a statblock
  // refers to (`ref: "[[Humanoid Traits#Mining Pick]]"`).
  for (const n of cardNames(text)) names.add(n);
  for (const name of new Set([basename, ...names])) out.push({ kind: "icon", name, label: `Hotbar icon · ${name}` });
  return out;
}

/** Every card a note names: each `rpg feature.*` / `item.*` / `spell` /
 *  `stat.*` block's `name:`, however deep, and a statblock's referred actions. */
export function cardNames(text: string): string[] {
  const lines = text.split("\n");
  const out = new Set<string>();
  for (let i = 0; i < lines.length; i++) {
    if (!/^\s*(`{3,}|~{3,})\s*rpg\s+(feature\.|item\.|spell|stat\.)/.test(lines[i])) continue;
    // Its head, to the first `---` or fence.
    for (let j = i + 1; j < lines.length && !/^\s*(`{3,}|~{3,}|---\s*$)/.test(lines[j]); j++) {
      const m = lines[j].match(/^\s*name:\s*(.+)$/);
      if (m) {
        out.add(unquote(m[1]));
        break;
      }
    }
  }
  // `ref: "@[[Humanoid Traits]]#Pack Tactics"` (or `[[Humanoid Traits#Pack Tactics]]`).
  for (const m of text.matchAll(/ref:\s*["']?@?\[\[[^\]|#]*(?:\]\])?#([^\]|"'\n]+)/g))
    out.add(m[1].replace(/\s*\([^)]*\)\s*$/, "").trim());
  return [...out];
}

/** The link an image value names: `![[hematite.webp|384]]` → `hematite.webp`. */
export function imageLink(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const m = value.match(/!?\[\[([^\]|#]+)/);
  if (m) return m[1].trim();
  const md = value.match(/\]\(([^)]+)\)/);
  if (md) return decodeURIComponent(md[1].trim());
  return /\.(png|webp|jpe?g|gif|svg)$/i.test(value.trim()) ? value.trim() : undefined;
}

/** A new image's value, written as the old one was — its embed, its size. */
export function imageValue(file: string, old: string | undefined): string {
  const size = old?.match(/\|(\d+(?:x\d+)?)\]\]/)?.[1];
  if (old && /^\[\[/.test(old.trim())) return `[[${file}]]`;
  return `![[${file}${size ? `|${size}` : ""}]]`;
}

/** The note with a block's key set to `value` — replaced where it is, else added after `name:`. */
export function setFenceKey(text: string, fence: number, key: string, value: string): string {
  const lines = text.split("\n");
  const f = rpgFences(text)[fence];
  if (!f) return text;
  const [from, to] = headRange(lines, f);
  const line = `${key}: "${value.replace(/"/g, '\\"')}"`;
  for (let i = from; i < to; i++) {
    if (new RegExp(`^${key}:`).test(lines[i])) {
      lines[i] = line;
      return lines.join("\n");
    }
  }
  const after = lines.slice(from, to).findIndex((l) => /^name:/.test(l));
  lines.splice(after >= 0 ? from + after + 1 : from, 0, line);
  return lines.join("\n");
}

/** The note with a block's boolean key set (`framed: true`) — added after its picture's key, if it isn't there. */
export function setFenceFlag(text: string, fence: number, key: string, value: boolean): string {
  const lines = text.split("\n");
  const f = rpgFences(text)[fence];
  if (!f) return text;
  const [from, to] = headRange(lines, f);
  const line = `${key}: ${value}`;
  for (let i = from; i < to; i++) {
    if (new RegExp(`^${key}:`).test(lines[i])) {
      lines[i] = line;
      return lines.join("\n");
    }
  }
  // After the picture's own line, so the two read together.
  const at = lines.slice(from, to).findIndex((l) => /^(image|portrait|art|src|icon):/.test(l));
  lines.splice(at >= 0 ? from + at + 1 : to, 0, line);
  return lines.join("\n");
}

/** A file name for a new image: the thing it's for, plain (`Kowyn's Bag icon`). */
export function imageFileName(base: string, suffix?: string): string {
  const clean = base.replace(/[\\/:*?"<>|#^[\]]/g, "").trim() || "image";
  return suffix ? `${clean} ${suffix}` : clean;
}
