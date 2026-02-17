/**
 * Folder Suggest Component
 * Provides autocomplete for folder paths in text inputs
 */

import { App, TFolder } from "obsidian";
import { TextComponent } from "obsidian";

type FolderSelectHandler = (path: string) => void;

export class FolderSuggest {
  private app: App;
  private textComponent: TextComponent;
  private suggestEl: HTMLElement | null = null;
  private suggestions: string[] = [];
  private selectedIndex: number = -1;
  private onSelect?: FolderSelectHandler;

  constructor(app: App, textComponent: TextComponent, onSelect?: FolderSelectHandler) {
    this.app = app;
    this.textComponent = textComponent;
    this.onSelect = onSelect;
    this.setupEventListeners();
  }

  private setupEventListeners() {
    const inputEl = this.textComponent.inputEl;

    inputEl.addEventListener("input", () => {
      this.updateSuggestions();
    });

    inputEl.addEventListener("focus", () => {
      this.updateSuggestions();
    });

    inputEl.addEventListener("blur", () => {
      setTimeout(() => {
        this.hideSuggestions();
      }, 200);
    });

    inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
      if (!this.suggestEl || this.suggestions.length === 0) {
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        this.selectedIndex = Math.min(this.selectedIndex + 1, this.suggestions.length - 1);
        this.highlightSuggestion();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
        this.highlightSuggestion();
      } else if (e.key === "Enter") {
        if (this.selectedIndex >= 0) {
          e.preventDefault();
          this.selectSuggestion(this.suggestions[this.selectedIndex]);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        this.hideSuggestions();
      }
    });
  }

  private updateSuggestions() {
    const value = this.textComponent.inputEl.value;

    const folders: string[] = [];
    const allFiles = this.app.vault.getAllLoadedFiles();

    for (const file of allFiles) {
      if (file instanceof TFolder) {
        folders.push(file.path);
      }
    }

    this.suggestions = folders.filter((path) =>
      path.toLowerCase().includes(value.toLowerCase())
    );

    this.suggestions.sort((a, b) => {
      const aLower = a.toLowerCase();
      const bLower = b.toLowerCase();
      const valueLower = value.toLowerCase();

      if (aLower.startsWith(valueLower) && !bLower.startsWith(valueLower)) {
        return -1;
      }
      if (!aLower.startsWith(valueLower) && bLower.startsWith(valueLower)) {
        return 1;
      }

      return a.length - b.length;
    });

    this.suggestions = this.suggestions.slice(0, 10);

    this.showSuggestions();
  }

  private showSuggestions() {
    if (this.suggestions.length === 0) {
      this.hideSuggestions();
      return;
    }

    if (!this.suggestEl) {
      this.suggestEl = document.createElement("div");
      this.suggestEl.addClass("file-suggest-dropdown");
      document.body.appendChild(this.suggestEl);
    }

    this.suggestEl.empty();

    const inputRect = this.textComponent.inputEl.getBoundingClientRect();
    this.suggestEl.style.position = "absolute";
    this.suggestEl.style.left = `${inputRect.left}px`;
    this.suggestEl.style.top = `${inputRect.bottom + 2}px`;
    this.suggestEl.style.width = `${inputRect.width}px`;

    this.suggestions.forEach((suggestion, index) => {
      const item = this.suggestEl!.createDiv({
        cls: "file-suggest-item",
        text: suggestion,
      });

      item.addEventListener("click", () => {
        this.selectSuggestion(suggestion);
      });

      item.addEventListener("mouseenter", () => {
        this.selectedIndex = index;
        this.highlightSuggestion();
      });
    });

    this.selectedIndex = 0;
    this.highlightSuggestion();
  }

  private highlightSuggestion() {
    if (!this.suggestEl) {
      return;
    }

    const items = this.suggestEl.querySelectorAll(".file-suggest-item");
    items.forEach((item, index) => {
      if (index === this.selectedIndex) {
        item.addClass("is-selected");
      } else {
        item.removeClass("is-selected");
      }
    });
  }

  private selectSuggestion(path: string) {
    this.textComponent.setValue(path);
    this.textComponent.inputEl.dispatchEvent(new Event("input"));
    if (this.onSelect) {
      this.onSelect(path);
    }
    this.hideSuggestions();
  }

  private hideSuggestions() {
    if (this.suggestEl) {
      this.suggestEl.remove();
      this.suggestEl = null;
    }
    this.selectedIndex = -1;
  }

  public destroy() {
    this.hideSuggestions();
  }
}
