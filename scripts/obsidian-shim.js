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
  addChild(child) { return child; }
  removeChild(child) { return child; }
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

/** MarkdownRenderer stub — parses [[link|alias]] and creates a real internal-link anchor.
 *  Pill.Link unwraps the first a.internal-link it finds; plain DOM is enough here.
 */
export const MarkdownRenderer = {
  render: async () => {},
  renderMarkdown: async (md, el, _sourcePath, _comp) => {
    const match = md.match(/\[\[([^\]|]+?)(?:\|([^\]]+))?\]\]/);
    if (!match) return;
    const [, link, alias] = match;
    const a = document.createElement("a");
    a.className = "internal-link";
    a.setAttribute("href", link);
    a.textContent = alias || link;
    a.addEventListener("click", (e) => {
      e.preventDefault();
      console.log(`[Story] Navigate → ${link}`);
    });
    el.appendChild(a);
  },
};

