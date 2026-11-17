/**
 * How the Game Master runs the linked session, set from a dialog and kept in
 * the session note's frontmatter (lib/domains/gm-link/prefs.ts), where the GM
 * reads it at every turn.
 */

import { type App, Modal, Notice, Setting, TFile } from "obsidian";
import {
  ASK_FIRST,
  AUTONOMY,
  type GmPrefs,
  prefsFrontmatter,
  PROFILE_TEMPLATE,
  readPrefs,
} from "lib/domains/gm-link/prefs";

export class GmPrefsModal extends Modal {
  private prefs: GmPrefs;
  private own = "";

  constructor(
    app: App,
    private session: TFile
  ) {
    super(app);
    this.prefs = readPrefs(app.metadataCache.getFileCache(session)?.frontmatter);
    // The player's own ask-first sentences, apart from the listed ones.
    this.own = this.prefs.askFirst.filter((a) => !ASK_FIRST.some((k) => k.id === a)).join("\n");
  }

  onOpen(): void {
    this.titleEl.setText("How the GM runs this session");
    this.modalEl.addClass("rpg-gm-prefs");
    this.draw();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  /** Notes marked `gm-profile: true`, to pick from. */
  private profiles(): TFile[] {
    return this.app.vault
      .getMarkdownFiles()
      .filter((f) => this.app.metadataCache.getFileCache(f)?.frontmatter?.["gm-profile"] === true);
  }

  private draw(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("p", {
      text: `${this.session.basename}. These are written in the session note's properties and reach the GM with your next hand-over.`,
      cls: "setting-item-description",
    });

    new Setting(contentEl)
      .setName("Prep and hidden rolls")
      .setDesc(
        "Secret: kept out of your sight until revealed. Open: in a notebook beside the session, to read as you play."
      )
      .addDropdown((d) =>
        d
          .addOption("secret", "Secret")
          .addOption("open", "Open")
          .setValue(this.prefs.mode)
          .onChange((v) => (this.prefs.mode = v === "open" ? "open" : "secret"))
      );

    new Setting(contentEl)
      .setName("How far a GM's turn goes")
      .setDesc("How much the GM plays before giving the turn back.")
      .addDropdown((d) => {
        for (const a of AUTONOMY) d.addOption(a.value, a.label);
        d.setValue(this.prefs.autonomy).onChange((v) => (this.prefs.autonomy = v as GmPrefs["autonomy"]));
      });

    contentEl.createEl("h4", { text: "Ask me first" });
    contentEl.createEl("p", {
      text: "The GM stops and asks before any of these happens.",
      cls: "setting-item-description",
    });
    for (const k of ASK_FIRST)
      new Setting(contentEl).setName(k.label).addToggle((t) =>
        t.setValue(this.prefs.askFirst.includes(k.id)).onChange((on) => {
          this.prefs.askFirst = this.prefs.askFirst.filter((a) => a !== k.id);
          if (on) this.prefs.askFirst.push(k.id);
        })
      );
    // Sentences need room: the box takes the dialog's width under its label.
    const own = new Setting(contentEl).setName("Anything else").setDesc("One per line, in your words.");
    own.settingEl.addClass("rpg-gm-own");
    const area = contentEl.createEl("textarea", {
      cls: "rpg-gm-own-text",
      attr: { rows: "3", "aria-label": "Anything else to ask about first", placeholder: "Before a fight starts" },
    });
    area.value = this.own;
    area.addEventListener("input", () => (this.own = area.value));

    contentEl.createEl("h4", { text: "GM profile" });
    const profiles = this.profiles();
    const current = this.prefs.profile?.replace(/^\[\[|\]\]$/g, "").split("|")[0] ?? "";
    new Setting(contentEl)
      .setName("Profile note")
      .setDesc(
        current
          ? "A note of tone, difficulty, pacing, content limits, house rules and language, in your words. The GM follows it."
          : "A note of tone, difficulty, pacing, content limits, house rules and language, in your words. The GM follows it. Creating one saves these choices and opens the note."
      )
      .addDropdown((d) => {
        d.addOption("", "None");
        for (const f of profiles) d.addOption(f.basename, f.basename);
        if (current && !profiles.some((f) => f.basename === current)) d.addOption(current, current);
        d.setValue(current).onChange((v) => (this.prefs.profile = v ? `[[${v}]]` : undefined));
      })
      .addButton((b) =>
        b.setButtonText(current ? "Save and open" : "Create profile note").onClick(async () => {
          if (current) {
            await this.save(false);
            void this.app.workspace.openLinkText(current, this.session.path);
            this.close();
            return;
          }
          const dir = this.session.parent?.path ?? "";
          const path = `${dir && dir !== "/" ? `${dir}/` : ""}GM profile.md`;
          if (!this.app.vault.getAbstractFileByPath(path)) await this.app.vault.create(path, PROFILE_TEMPLATE);
          this.prefs.profile = "[[GM profile]]";
          await this.save(false);
          void this.app.workspace.openLinkText(path, "");
          this.close();
        })
      );

    new Setting(contentEl)
      .addButton((b) => b.setButtonText("Cancel").onClick(() => this.close()))
      .addButton((b) =>
        b
          .setButtonText("Save")
          .setCta()
          .onClick(async () => {
            await this.save(true);
            this.close();
          })
      );
  }

  private async save(say: boolean): Promise<void> {
    const listed = this.prefs.askFirst.filter((a) => ASK_FIRST.some((k) => k.id === a));
    const own = this.own
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const next = prefsFrontmatter({ ...this.prefs, askFirst: [...listed, ...own] });
    await this.app.fileManager.processFrontMatter(this.session, (fm: Record<string, unknown>) => {
      for (const [key, value] of Object.entries(next)) {
        if (value === undefined) delete fm[key];
        else fm[key] = value;
      }
    });
    if (say) new Notice("Saved. The GM reads it with your next hand-over.");
  }
}
