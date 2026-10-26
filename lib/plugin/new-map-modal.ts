/**
 * "New battle map note": ask for a title, a picture (its grid is found for
 * you) and a folder, and write the note from the template (map-note.ts) —
 * the entry a log's `[COMBAT: [[Map]]]` and a hex map's place can point at.
 */

import { App, Modal, Notice, Setting, TFile, normalizePath } from "obsidian";
import { mapNoteName, mapNoteText } from "lib/domains/battlemap/map-note";
import { detectPictureGrid } from "lib/services/map-picture-grid";

const IMAGE = /^(png|jpe?g|webp|gif|avif)$/i;

/** Where maps are kept: a folder called `maps` if there is one (the atlas's first), else the open note's folder. */
function defaultFolder(app: App): string {
  const folders = app.vault
    .getAllFolders()
    .filter((f) => f.name.toLowerCase() === "maps")
    .sort((a, b) => Number(/atlas/i.test(b.path)) - Number(/atlas/i.test(a.path)) || a.path.length - b.path.length);
  return folders[0]?.path ?? app.workspace.getActiveFile()?.parent?.path ?? "";
}

export class NewMapModal extends Modal {
  private title = "";
  private picture = "";
  private folder = defaultFolder(this.app);

  constructor(app: App) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    this.setTitle("New battle map note");

    const images = this.app.vault.getFiles().filter((f) => IMAGE.test(f.extension));
    const folders = this.app.vault.getAllFolders();

    new Setting(contentEl).setName("Title").addText((t) => {
      t.setPlaceholder("Kobold Ambush").onChange((v) => (this.title = v));
      window.setTimeout(() => t.inputEl.focus(), 0);
    });

    const picture = new Setting(contentEl)
      .setName("Picture")
      .setDesc("The map's picture; its grid is found for you. Empty: a small board to draw by hand.");
    picture.addText((t) => {
      t.setPlaceholder("ambush.webp").onChange((v) => (this.picture = v));
      const list = contentEl.createEl("datalist", { attr: { id: "rpg-new-map-images" } });
      for (const f of images) list.createEl("option", { value: f.path });
      t.inputEl.setAttribute("list", "rpg-new-map-images");
    });

    new Setting(contentEl).setName("Folder").addText((t) => {
      t.setValue(this.folder).onChange((v) => (this.folder = v));
      const list = contentEl.createEl("datalist", { attr: { id: "rpg-new-map-folders" } });
      for (const f of folders) list.createEl("option", { value: f.path });
      t.inputEl.setAttribute("list", "rpg-new-map-folders");
    });

    new Setting(contentEl).addButton((b) =>
      b
        .setButtonText("Create")
        .setCta()
        .onClick(() => void this.create())
    );
    contentEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") {
        e.preventDefault();
        void this.create();
      }
    });
  }

  private async create(): Promise<void> {
    const name = mapNoteName(this.title);
    if (!name) {
      new Notice("Give the map a title.");
      return;
    }
    const folder = this.folder.replace(/^\/+|\/+$/g, "");
    const path = normalizePath(`${folder ? `${folder}/` : ""}${name}.md`);
    if (this.app.vault.getAbstractFileByPath(path)) {
      new Notice(`${path} already exists.`);
      return;
    }
    let image: { link: string; grid: Awaited<ReturnType<typeof detectPictureGrid>> } | undefined;
    const pic = this.picture.trim();
    if (pic) {
      const file =
        this.app.vault.getAbstractFileByPath(pic) ??
        this.app.metadataCache.getFirstLinkpathDest(pic.replace(/^!?\[\[|\]\]$/g, ""), "");
      if (!(file instanceof TFile) || !IMAGE.test(file.extension)) {
        new Notice(`No picture called ${pic} in the vault.`);
        return;
      }
      const grid = await detectPictureGrid(this.app, file);
      image = { link: `[[${file.name}]]`, grid };
      if (!grid) new Notice("Couldn't find the grid in that picture: set cell and offset in the block.");
    }
    if (folder && !this.app.vault.getAbstractFileByPath(folder)) await this.app.vault.createFolder(folder);
    const file = await this.app.vault.create(path, mapNoteText({ title: name, ...(image ? { image } : {}) }));
    this.close();
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.openFile(file, { state: { mode: "preview" } });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
