/**
 * A battle map token's picture: kept in the creature's note — `token_image:` in
 * its frontmatter (the PC's sheet, the foe's statblock) — so every map it's on
 * shows it. Changed from the token's right-click menu: a picture made in the image
 * studio or uploaded (either saved to the token folder in the settings), one
 * already in the vault, or none.
 */

import { FuzzySuggestModal, Menu, Notice, TFile, type App } from "obsidian";
import { TOKEN_IMAGE_KEY } from "lib/domains/image-studio/targets";
import { openImageStudio } from "lib/plugin/image-studio-modal";
import { settingsStore } from "lib/services/settings-store";

const PICTURE = /^(png|jpe?g|webp|gif|avif|svg)$/i;

/** The link a `token_image:` value holds (`"[[x.webp]]"`, unquoted `[[x.webp]]`, a path). */
export function tokenImageLink(value: unknown): string | undefined {
  let flat: unknown = value;
  // (`token_image: [[x.webp]]`, unquoted, is read by YAML as a list holding a list.)
  while (Array.isArray(flat) && flat.length === 1) flat = flat[0];
  if (typeof flat !== "string" || !flat.trim()) return undefined;
  return (flat.match(/\[\[([^\]|#]+)/)?.[1] ?? flat).trim() || undefined;
}

/** A note's token picture, as a file. */
export function tokenImageFile(app: App, note: TFile): TFile | undefined {
  const link = tokenImageLink(app.metadataCache.getFileCache(note)?.frontmatter?.[TOKEN_IMAGE_KEY]);
  const f = link ? app.metadataCache.getFirstLinkpathDest(link, note.path) : null;
  return f instanceof TFile && PICTURE.test(f.extension) ? f : undefined;
}

/** Point a note's `token_image:` at a picture — or, given none, take it away. */
async function setTokenImage(app: App, note: TFile, picture: TFile | null): Promise<void> {
  await app.fileManager.processFrontMatter(note, (fm: Record<string, unknown>) => {
    if (picture) fm[TOKEN_IMAGE_KEY] = `[[${app.metadataCache.fileToLinktext(picture, note.path, true)}]]`;
    else delete fm[TOKEN_IMAGE_KEY];
  });
}

/** A path in the folder no file has yet: `Talon.webp`, else `Talon 1.webp`… */
function freePath(app: App, folder: string, base: string, ext: string): string {
  const at = (n: number) => `${folder ? `${folder}/` : ""}${base}${n ? ` ${n}` : ""}.${ext}`;
  let n = 0;
  while (app.vault.getAbstractFileByPath(at(n))) n++;
  return at(n);
}

/** Save a picture from the computer in the token folder, named after the note. */
async function savePicture(app: App, note: TFile, picked: File): Promise<TFile> {
  const folder = (settingsStore.getSettings()?.battleTokenFolder ?? "").trim().replace(/^\/+|\/+$/g, "");
  if (folder && !app.vault.getAbstractFileByPath(folder)) await app.vault.createFolder(folder);
  const ext = (picked.name.match(/\.([a-z0-9]+)$/i)?.[1] ?? picked.type.split("/")[1] ?? "png").toLowerCase();
  const base = note.basename.replace(/[\\/:*?"<>|#^[\]]/g, "").trim() || "Token";
  return app.vault.createBinary(freePath(app, folder, `${base} token`, ext), await picked.arrayBuffer());
}

/** Ask for a picture from the computer (the system's file picker). */
function pickFromComputer(): Promise<File | undefined> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.addEventListener("change", () => resolve(input.files?.[0] ?? undefined), { once: true });
    input.addEventListener("cancel", () => resolve(undefined), { once: true });
    input.click();
  });
}

/** The vault's pictures, to pick one by name. */
class PictureModal extends FuzzySuggestModal<TFile> {
  constructor(
    app: App,
    private onPick: (f: TFile) => void
  ) {
    super(app);
    this.setPlaceholder("A picture for the token…");
  }
  getItems(): TFile[] {
    return this.app.vault.getFiles().filter((f) => PICTURE.test(f.extension));
  }
  getItemText(f: TFile): string {
    return f.path;
  }
  onChooseItem(f: TFile): void {
    this.onPick(f);
  }
}

/**
 * The right-click menu on a token: generate a picture, upload one, choose one in
 * the vault, or remove it. `who` is the token's name as shown; with no `note` to keep the
 * picture in (a name that links nowhere), the menu only says so.
 */
export function openTokenImageMenu(app: App, event: MouseEvent, who: string, note: TFile | undefined): void {
  const menu = new Menu();
  if (!note) {
    menu.addItem((i) =>
      i.setTitle(`${who} has no note — link the name to give it a picture`).setIcon("image-off").setDisabled(true)
    );
    menu.showAtMouseEvent(event);
    return;
  }
  const done = (what: string) => new Notice(`${what} ${who}'s token (in ${note.basename}).`);
  const fail = (e: unknown) => new Notice(`Couldn't change the token picture: ${e instanceof Error ? e.message : e}`);
  menu.addItem((i) =>
    i
      .setTitle("Generate token image…")
      .setIcon("image-plus")
      .onClick(() => openImageStudio(app, { file: note, focus: TOKEN_IMAGE_KEY }))
  );
  menu.addItem((i) =>
    i
      .setTitle("Upload token image…")
      .setIcon("upload")
      .onClick(async () => {
        const picked = await pickFromComputer();
        if (!picked) return;
        try {
          await setTokenImage(app, note, await savePicture(app, note, picked));
          done("Picture set for");
        } catch (e) {
          fail(e);
        }
      })
  );
  menu.addItem((i) =>
    i
      .setTitle("Choose token image from vault…")
      .setIcon("image")
      .onClick(() =>
        new PictureModal(app, (f) => setTokenImage(app, note, f).then(() => done("Picture set for"), fail)).open()
      )
  );
  if (tokenImageFile(app, note)) {
    menu.addItem((i) =>
      i
        .setTitle("Remove token image")
        .setIcon("image-off")
        .onClick(() => setTokenImage(app, note, null).then(() => done("Picture taken off"), fail))
    );
  }
  menu.addSeparator();
  menu.addItem((i) =>
    i
      .setTitle(`Open ${note.basename}`)
      .setIcon("file-text")
      .onClick(() => app.workspace.getLeaf("tab").openFile(note))
  );
  menu.showAtMouseEvent(event);
}
