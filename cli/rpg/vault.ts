/**
 * The vault on disk, as the plugin's code expects `app.vault` and
 * `app.metadataCache` to behave: files and folders, reads, link resolution
 * (`[[Note]]` → the nearest, else shortest, matching path) and frontmatter.
 * Read-only: every write throws, so the CLI can never change the vault.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { getFrontMatterInfo, parseYaml, type TAbstractFile, TFile, TFolder } from "./obsidian-node";

const SKIP = new Set([".obsidian", ".git", ".trash", "node_modules", ".DS_Store"]);

const readOnly = (what: string) => () => {
  throw new Error(`rpg CLI is read-only: refused to ${what}`);
};

export class FsVault {
  readonly root: string;
  private files = new Map<string, TFile>();
  private folders = new Map<string, TFolder>();
  private byBasename = new Map<string, TFile[]>();
  private byName = new Map<string, TFile[]>();
  private texts = new Map<string, string>();
  readonly adapter: Record<string, unknown>;

  constructor(root: string) {
    this.root = root;
    const top = new TFolder("");
    this.folders.set("", top);
    this.walk(top);
    this.adapter = {
      basePath: root,
      exists: async (p: string) => this.files.has(p) || this.folders.has(p),
      read: async (p: string) => readFileSync(join(root, p), "utf8"),
      readBinary: async (p: string) => readFileSync(join(root, p)).buffer,
      getResourcePath: (p: string) => `file://${join(root, p)}`,
      write: readOnly("write a file"),
      writeBinary: readOnly("write a file"),
      mkdir: readOnly("make a folder"),
      remove: readOnly("remove a file"),
    };
  }

  private walk(folder: TFolder): void {
    const dir = join(this.root, folder.path);
    for (const name of readdirSync(dir)) {
      // Obsidian leaves dot-folders out (.obsidian, .trash, backups like .rpg-backups).
      if (SKIP.has(name) || name.startsWith(".")) continue;
      const path = folder.path ? `${folder.path}/${name}` : name;
      let s;
      try {
        s = statSync(join(this.root, path));
      } catch {
        continue;
      }
      if (s.isDirectory()) {
        const sub = new TFolder(path);
        sub.parent = folder;
        sub.vault = this;
        folder.children.push(sub);
        this.folders.set(path, sub);
        this.walk(sub);
      } else {
        const f = new TFile(path);
        f.parent = folder;
        f.vault = this;
        f.stat = { ctime: s.ctimeMs, mtime: s.mtimeMs, size: s.size };
        folder.children.push(f);
        this.files.set(path, f);
        const add = (m: Map<string, TFile[]>, k: string) => m.set(k, [...(m.get(k) ?? []), f]);
        if (f.extension === "md") add(this.byBasename, f.basename.toLowerCase());
        add(this.byName, f.name.toLowerCase());
      }
    }
  }

  getRoot(): TFolder {
    return this.folders.get("")!;
  }
  getAbstractFileByPath(path: string): TAbstractFile | null {
    const clean = path.replace(/^\/+|\/+$/g, "");
    return this.files.get(clean) ?? this.folders.get(clean) ?? null;
  }
  getFileByPath(path: string): TFile | null {
    return this.files.get(path) ?? null;
  }
  getFiles(): TFile[] {
    return [...this.files.values()];
  }
  getMarkdownFiles(): TFile[] {
    return this.getFiles().filter((f) => f.extension === "md");
  }
  getAllLoadedFiles(): TAbstractFile[] {
    return [...this.folders.values(), ...this.files.values()];
  }
  async read(file: TFile): Promise<string> {
    return this.readSync(file);
  }
  async cachedRead(file: TFile): Promise<string> {
    return this.readSync(file);
  }
  readSync(file: TFile): string {
    let t = this.texts.get(file.path);
    if (t === undefined) {
      t = readFileSync(join(this.root, file.path), "utf8");
      this.texts.set(file.path, t);
    }
    return t;
  }
  async readBinary(file: TFile): Promise<ArrayBuffer> {
    const b = readFileSync(join(this.root, file.path));
    return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
  }
  getResourcePath(file: TFile): string {
    return `file://${join(this.root, file.path)}`;
  }
  on(): { off: () => void } {
    return { off: () => {} };
  }
  offref(): void {}
  process = readOnly("change a note");
  modify = readOnly("change a note");
  create = readOnly("create a note");
  createBinary = readOnly("create a file");
  modifyBinary = readOnly("change a file");
  createFolder = readOnly("make a folder");
  delete = readOnly("delete a file");
  rename = readOnly("rename a file");

  /** `[[Link]]` text → a file: an exact path, a path ending, else a name — the one in the
   *  same folder as `from`, else the shortest path. */
  resolveLink(link: string, from = ""): TFile | null {
    const target = link
      .replace(/^!?\[\[/, "")
      .replace(/\]\]$/, "")
      .split("|")[0]
      .split("#")[0]
      .trim();
    if (!target) return null;
    const exact = this.files.get(target) ?? this.files.get(`${target}.md`);
    if (exact) return exact;
    let candidates: TFile[];
    if (target.includes("/")) {
      const t = target.toLowerCase();
      candidates = this.getFiles().filter((f) => {
        const p = f.path.toLowerCase();
        return p.endsWith(`/${t}.md`) || p.endsWith(`/${t}`) || p === `${t}.md`;
      });
    } else {
      const k = target.toLowerCase();
      candidates = this.byBasename.get(k) ?? this.byName.get(k) ?? [];
    }
    if (candidates.length <= 1) return candidates[0] ?? null;
    const dir = from.includes("/") ? from.slice(0, from.lastIndexOf("/")) : "";
    const near = candidates.find((f) => f.parent?.path === dir);
    return near ?? [...candidates].sort((a, b) => a.path.length - b.path.length)[0];
  }
}

/** `app.metadataCache`, over an FsVault. */
export class FsMetadataCache {
  private fm = new Map<string, Record<string, unknown> | undefined>();
  constructor(private vault: FsVault) {}

  frontmatterOf(file: TFile): Record<string, unknown> | undefined {
    if (this.fm.has(file.path)) return this.fm.get(file.path);
    let out: Record<string, unknown> | undefined;
    if (file.extension === "md") {
      const info = getFrontMatterInfo(this.vault.readSync(file));
      if (info.exists) {
        try {
          const parsed = parseYaml(info.frontmatter);
          if (parsed && typeof parsed === "object") out = parsed as Record<string, unknown>;
        } catch {
          out = undefined;
        }
      }
    }
    this.fm.set(file.path, out);
    return out;
  }
  getFileCache(file: TFile): { frontmatter?: Record<string, unknown> } | null {
    return { frontmatter: this.frontmatterOf(file) };
  }
  getCache(path: string): { frontmatter?: Record<string, unknown> } | null {
    const f = this.vault.getFileByPath(path);
    return f ? this.getFileCache(f) : null;
  }
  getFirstLinkpathDest(link: string, from: string): TFile | null {
    return this.vault.resolveLink(link, from);
  }
  fileToLinktext(file: TFile): string {
    return file.basename;
  }
  on(): { off: () => void } {
    return { off: () => {} };
  }
  offref(): void {}
}
