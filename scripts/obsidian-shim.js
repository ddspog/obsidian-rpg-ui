/**
 * Minimal Obsidian API shim for use in Node.js bundled scripts.
 * Provides the same `FrontMatterInfo` shape as the real Obsidian API.
 *
 * FrontMatterInfo:
 *   exists       — whether a frontmatter block was found
 *   frontmatter  — the raw YAML string between the --- delimiters
 *   from         — start index of the YAML content (after opening ---)
 *   to           — end index of the YAML content (before closing ---)
 *   contentStart — index where the document body starts (after closing ---)
 */
export function getFrontMatterInfo(content) {
  if (!content || !content.startsWith("---")) {
    return { exists: false, frontmatter: "", from: 0, to: 0, contentStart: 0 };
  }

  const openEnd = content.indexOf("\n");
  if (openEnd === -1) {
    return { exists: false, frontmatter: "", from: 0, to: 0, contentStart: 0 };
  }

  const closeStart = content.indexOf("\n---", openEnd);
  if (closeStart === -1) {
    return { exists: false, frontmatter: "", from: 0, to: 0, contentStart: 0 };
  }

  const from = openEnd + 1;
  const to = closeStart;
  const closeLineEnd = content.indexOf("\n", closeStart + 1);
  const contentStart = closeLineEnd === -1 ? content.length : closeLineEnd + 1;

  return {
    exists: true,
    frontmatter: content.slice(from, to),
    from,
    to,
    contentStart,
  };
}

/** Minimal Vault stub. */
export class Vault {}

/** Obsidian Component base class stub – lifecycle methods are no-ops. */
export class Component {
  onload() {}
  onunload() {}
  load() {}
  unload() {}
  addChild(child) {
    return child;
  }
  removeChild(child) {
    return child;
  }
  register(_cb) {}
  registerEvent(_e) {}
  registerDomEvent(..._args) {}
}

/** TFile stub – instanceof checks in PortraitThumb need this to exist. */
export class TFile {
  constructor(path = "") {
    this.path = path;
    this.name = path.split("/").pop() ?? "";
    this.extension = this.name.includes(".") ? this.name.split(".").pop() : "";
    this.basename = this.name.replace(/\.[^.]+$/, "");
  }
}

/** MarkdownRenderer stub — renders a subset of markdown inline for Storybook.
 *  Obsidian's real renderer handles far more, but this stub covers the
 *  patterns feature-card descriptions actually use: paragraphs, line breaks,
 *  wikilinks (`[[X]]` / `[[X|Y]]`), bold (`**x**`), italic (`*x*` / `_x_`),
 *  inline code (`` `x` ``), unordered lists (`- …`), and h1–h6 headings.
 *  Everything else comes through as plain text. */
const escapeHtml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function renderInline(text) {
  // Wikilinks first — they're greedy brackets and shouldn't be turned into
  // other constructs. Followed by emphasis and inline code.
  let out = escapeHtml(text);
  out = out.replace(
    /\[\[([^\]|]+?)(?:\|([^\]]+))?\]\]/g,
    (_, link, alias) => `<a class="internal-link" href="${link}">${alias || link}</a>`
  );
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(/\*\*([^*]+?)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[^*])\*([^*\n][^*]*?)\*(?!\*)/g, "$1<em>$2</em>");
  out = out.replace(/(^|[^_])_([^_\n][^_]*?)_(?!_)/g, "$1<em>$2</em>");
  return out;
}

function renderMarkdownToHtml(md) {
  const blocks = [];
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // Blank — skip, acts as paragraph separator.
    if (!line.trim()) {
      i++;
      continue;
    }

    // Heading
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      blocks.push(`<h${h[1].length}>${renderInline(h[2])}</h${h[1].length}>`);
      i++;
      continue;
    }

    // Unordered list — a run of lines starting with `- ` or `* `.
    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(`<li>${renderInline(lines[i].replace(/^\s*[-*]\s+/, ""))}</li>`);
        i++;
      }
      blocks.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    // Paragraph — collect until a blank line or a block marker.
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^#{1,6}\s+/.test(lines[i]) && !/^\s*[-*]\s+/.test(lines[i])) {
      para.push(lines[i]);
      i++;
    }
    blocks.push(`<p>${renderInline(para.join("\n")).replace(/\n/g, "<br>")}</p>`);
  }
  return blocks.join("");
}

export const MarkdownRenderer = {
  render: async (_app, md, el) => {
    el.innerHTML = renderMarkdownToHtml(String(md ?? ""));
  },
  renderMarkdown: async (md, el, _sourcePath, _comp) => {
    el.innerHTML = renderMarkdownToHtml(String(md ?? ""));
  },
};
