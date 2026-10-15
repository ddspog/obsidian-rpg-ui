/**
 * Settings Sections
 * Collapsible `<details>` sections for the settings tab. The settings tab
 * rebuilds itself on most edits (`display()`), so which sections are open is
 * kept here, by key, and survives the rebuild.
 */

const openState = new Map<string, boolean>();

export interface SectionOptions {
  /** Open the first time it is drawn; after that the user's choice wins. */
  open?: boolean;
  /** Muted text after the title in the summary line (a count, a path). */
  note?: string;
  /** Description shown at the top of the body. */
  desc?: string;
  cls?: string;
}

export interface Section {
  details: HTMLDetailsElement;
  summary: HTMLElement;
  title: HTMLElement;
  note: HTMLElement;
  body: HTMLElement;
}

/** A collapsible section; returns its parts, the body for the settings. */
export function createSection(parent: HTMLElement, key: string, title: string, opts: SectionOptions = {}): Section {
  const details = parent.createEl("details", { cls: ["rpg-settings-section", opts.cls ?? ""].filter(Boolean) });
  details.open = openState.get(key) ?? opts.open ?? false;
  details.addEventListener("toggle", () => openState.set(key, details.open));
  const summary = details.createEl("summary", { cls: "rpg-settings-section-summary" });
  const titleEl = summary.createSpan({ cls: "rpg-settings-section-title", text: title });
  const note = summary.createSpan({ cls: "rpg-settings-section-note", text: opts.note ?? "" });
  const body = details.createDiv({ cls: "rpg-settings-section-body" });
  if (opts.desc) body.createEl("p", { text: opts.desc, cls: "setting-item-description" });
  return { details, summary, title: titleEl, note, body };
}

/** Open a section the next time it is drawn (e.g. an entry just added). */
export function openSection(key: string): void {
  openState.set(key, true);
}

/** Open or close every section under `root` (the toggle event records it). */
export function setSectionsOpen(root: HTMLElement, open: boolean): void {
  root.querySelectorAll<HTMLDetailsElement>("details.rpg-settings-section").forEach((d) => (d.open = open));
}
