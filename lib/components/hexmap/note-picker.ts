/**
 * A note picked from the vault, the way Obsidian's own pickers do it: type to
 * narrow the list, Enter to choose. For extracting part of a hex map into
 * another note.
 */

import { type App, FuzzySuggestModal, type TFile } from "obsidian";

class NoteModal extends FuzzySuggestModal<TFile> {
  constructor(
    app: App,
    placeholder: string,
    private except: string,
    private onPick: (f: TFile) => void
  ) {
    super(app);
    this.setPlaceholder(placeholder);
  }
  getItems(): TFile[] {
    return this.app.vault.getMarkdownFiles().filter((f) => f.path !== this.except);
  }
  getItemText(f: TFile): string {
    return f.path.replace(/\.md$/, "");
  }
  onChooseItem(f: TFile): void {
    this.onPick(f);
  }
}

/** Opens the picker; `onPick` gets the note chosen (never `except`, the note the map is in). */
export function pickNote(app: App, placeholder: string, except: string, onPick: (f: TFile) => void): void {
  new NoteModal(app, placeholder, except, onPick).open();
}
