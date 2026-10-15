/**
 * The image studio in a modal — opened from the plugin's settings, or the
 * "Open image studio" command (on the note that's open).
 */

import * as React from "react";
import * as ReactDOM from "react-dom/client";
import { App, Modal, TFile } from "obsidian";
import type { ImageStudioSettings } from "settings";
import { ImageStudio } from "lib/components/image-studio/ImageStudio";
import type { IconTone } from "lib/domains/image-studio/kinds";

/** A card to make a hotbar icon for straight away (from the hotbar's tile). */
export interface IconCard {
  name: string;
  /** The name as the card is written (`Icicle Javelin º`) — to find its note. */
  noteName?: string;
  /** What it does — the prompt's context. */
  text?: string;
  /** Its type, as the hotbar colours it — the icon's stone and glow. */
  tone?: IconTone;
}

/** The plugin's image studio settings, as `main.ts` registers them — so a view can open it. */
let studioSettings: (() => ImageStudioSettings) | null = null;
export function setImageStudioSettings(get: () => ImageStudioSettings): void {
  studioSettings = get;
}

/** Open the studio on a note, or on a card's hotbar icon. */
export function openImageStudio(
  app: App,
  opts: { file?: TFile; card?: IconCard; onSaved?: () => void; focus?: string } = {}
): void {
  if (!studioSettings) return;
  new ImageStudioModal(app, studioSettings(), opts.file, opts.card, opts.onSaved, opts.focus).open();
}

export class ImageStudioModal extends Modal {
  private root: ReactDOM.Root | null = null;

  constructor(
    app: App,
    private settings: ImageStudioSettings,
    private initial?: TFile,
    private card?: IconCard,
    private onSaved?: () => void,
    private focus?: string
  ) {
    super(app);
  }

  onOpen(): void {
    this.modalEl.addClass("rpg-image-studio-modal");
    this.titleEl.setText("Image studio");
    this.root = ReactDOM.createRoot(this.contentEl);
    this.root.render(
      <ImageStudio
        app={this.app}
        settings={this.settings}
        {...(this.initial ? { initial: this.initial } : {})}
        {...(this.card ? { card: this.card } : {})}
        {...(this.onSaved ? { onSaved: this.onSaved } : {})}
        {...(this.focus ? { focus: this.focus } : {})}
        onClose={() => this.close()}
      />
    );
  }

  onClose(): void {
    this.root?.unmount();
    this.root = null;
    this.contentEl.empty();
  }
}
