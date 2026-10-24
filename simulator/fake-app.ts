/** An in-memory vault with just enough of Obsidian's `App` for the plugin's views. */
import { parse as parseYamlText } from "yaml";
import { TFile } from "./obsidian-stub";

type Handler = (file: TFile) => void;

function frontmatterOf(text: string): Record<string, unknown> | undefined {
  const m = text.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  if (!m) return undefined;
  try {
    const v = parseYamlText(m[1]);
    return v && typeof v === "object" ? (v as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

export class MemoryVault {
  private text = new Map<string, string>();
  private files = new Map<string, TFile>();
  private handlers: Handler[] = [];
  /** Called after a view writes a note (Save, a card's lines), as Obsidian would re-render it. */
  onWrite: (file: TFile) => void = () => {};

  constructor(initial: Record<string, string>) {
    for (const [path, text] of Object.entries(initial)) this.put(path, text);
  }

  put(path: string, text: string): TFile {
    this.text.set(path, text);
    let f = this.files.get(path);
    if (!f) {
      f = new TFile(path);
      this.files.set(path, f);
    }
    return f;
  }

  /** A note's text, now. */
  peek(path: string): string {
    return this.text.get(path) ?? "";
  }

  getAbstractFileByPath(path: string): TFile | null {
    return this.files.get(path) ?? this.files.get(`${path}.md`) ?? null;
  }
  getMarkdownFiles(): TFile[] {
    return [...this.files.values()];
  }
  getFiles(): TFile[] {
    return this.getMarkdownFiles();
  }
  async read(file: TFile): Promise<string> {
    return this.text.get(file.path) ?? "";
  }
  async cachedRead(file: TFile): Promise<string> {
    return this.read(file);
  }
  async modify(file: TFile, data: string): Promise<void> {
    this.text.set(file.path, data);
    for (const h of this.handlers) h(file);
    this.onWrite(file);
  }
  async create(path: string, data: string): Promise<TFile> {
    const f = this.put(path, data);
    this.onWrite(f);
    return f;
  }
  on(_event: string, cb: Handler): { off: () => void } {
    this.handlers.push(cb);
    return { off: () => (this.handlers = this.handlers.filter((h) => h !== cb)) };
  }
  getResourcePath(): string {
    return "";
  }
  adapter = {
    exists: async (p: string) => this.files.has(p),
    read: async (p: string) => this.text.get(p) ?? "",
    write: async () => {},
    getResourcePath: () => "",
  };
}

export class MemoryMetadataCache {
  constructor(private vault: MemoryVault) {}

  /** Obsidian's link resolution: a path, else a file name; the nearest one wins. */
  getFirstLinkpathDest(linktext: string, sourcePath: string): TFile | null {
    const link = linktext.split("#")[0].split("|")[0].trim().replace(/\.md$/, "");
    if (!link) return this.vault.getAbstractFileByPath(sourcePath);
    const files = this.vault.getMarkdownFiles();
    const exact = files.find((f) => f.path === `${link}.md` || f.path === link);
    if (exact) return exact;
    const tail = `/${link}.md`;
    const found = files.filter((f) => `/${f.path}`.endsWith(tail) || f.basename === link);
    if (found.length === 0) return null;
    const near = (p: string) => {
      const a = p.split("/");
      const b = sourcePath.split("/");
      let n = 0;
      while (n < a.length - 1 && a[n] === b[n]) n++;
      return n;
    };
    return found.sort((x, y) => near(y.path) - near(x.path) || x.path.length - y.path.length)[0];
  }
  getFileCache(file: TFile) {
    return this.getCache(file.path);
  }
  getCache(path: string) {
    const f = this.vault.getAbstractFileByPath(path);
    if (!f) return null;
    const text = this.vault.peek(f.path);
    return { frontmatter: frontmatterOf(text), headings: [], links: [], sections: [], listItems: [] };
  }
  fileToLinktext(file: TFile): string {
    return file.basename;
  }
}

export function makeApp(initial: Record<string, string>) {
  const vault = new MemoryVault(initial);
  const metadataCache = new MemoryMetadataCache(vault);
  const app = {
    vault,
    metadataCache,
    workspace: {
      openLinkText: async (link: string) => {
        const toast = document.querySelector(".sim-toasts");
        if (toast) {
          const el = document.createElement("div");
          el.className = "sim-toast";
          el.textContent = `Opens “${link.split("|")[0]}” in Obsidian`;
          toast.appendChild(el);
          window.setTimeout(() => el.remove(), 2500);
        }
      },
      getActiveFile: () => null,
      on: () => ({ off() {} }),
    },
    fileManager: {},
  };
  return { app, vault };
}
