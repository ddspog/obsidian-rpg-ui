/**
 * "Improve the wording": pick passages of a session's log, ask the model for
 * better words, read each before and after, keep the ones wanted. Only the
 * words of a passage change (lib/domains/session-log/reword.ts).
 */

import { type App, Modal, Notice, Setting, TFile } from "obsidian";
import {
  applyRewording,
  type Passage,
  passagesOf,
  readRewording,
  REWORD_SYSTEM,
  rewordPrompt,
} from "lib/domains/session-log/reword";
import { type AnthropicEndpoint, anthropicText, hasAnthropic } from "lib/services/anthropic-text";

/** The first `rpg log` block of a note: the text before its body, the body, the text after. */
function splitLog(note: string): { before: string; body: string; after: string } | null {
  const m = note.match(/^(`{3,})\s*rpg\s+log\b[^\n]*\n/m);
  if (!m || m.index === undefined) return null;
  const open = m.index + m[0].length;
  const close = note.slice(open).search(new RegExp(`^${m[1]}\\s*$`, "m"));
  if (close < 0) return null;
  const block = note.slice(open, open + close);
  // The block's head ends at its `---` line; with none, all of it is the body.
  const sep = block.match(/^---[ \t]*\n/m);
  const head = sep && sep.index !== undefined ? sep.index + sep[0].length : 0;
  return { before: note.slice(0, open + head), body: block.slice(head), after: note.slice(open + close) };
}

const MOST = 40;

export class RewordModal extends Modal {
  private body = "";
  private passages: Passage[] = [];
  private picked = new Set<number>();
  private wish = "";
  private results: Array<{ passage: Passage; text: string; refused?: string; keep: boolean }> | null = null;

  constructor(
    app: App,
    private file: TFile,
    private endpoint: AnthropicEndpoint
  ) {
    super(app);
  }

  async onOpen(): Promise<void> {
    this.titleEl.setText("Improve the wording");
    this.modalEl.addClass("rpg-reword");
    const log = splitLog(await this.app.vault.read(this.file));
    if (!log) {
      this.contentEl.createEl("p", { text: "This note has no rpg log block." });
      return;
    }
    this.body = log.body;
    this.passages = passagesOf(log.body);
    this.drawPick();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private drawPick(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("p", {
      text: "Pick what to reword. Only the words of each passage change: rolls, tags, links and every other line of the log stay as they are. You see each rewording before it is written.",
      cls: "rpg-reword-about",
    });
    if (!hasAnthropic(this.endpoint))
      contentEl.createEl("p", {
        text: "No Anthropic link is set: add one in the plugin's settings (Images › Anthropic) to use this.",
        cls: "mod-warning",
      });

    const scenes = [...new Set(this.passages.map((p) => p.scene ?? ""))];
    const quick = new Setting(contentEl).setName("Pick").setClass("rpg-reword-quick");
    const pickAll = (which: Passage[]) => {
      this.picked = new Set(which.slice(-MOST).map((p) => p.line));
      this.drawPick();
    };
    quick.addButton((b) =>
      b
        .setButtonText("Last scene")
        .onClick(() => pickAll(this.passages.filter((p) => (p.scene ?? "") === scenes[scenes.length - 1])))
    );
    quick.addButton((b) => b.setButtonText("Last 5").onClick(() => pickAll(this.passages.slice(-5))));
    quick.addButton((b) => b.setButtonText("None").onClick(() => pickAll([])));

    const list = contentEl.createDiv({ cls: "rpg-reword-list" });
    // Newest scene first: what was just played is what is most often reworded.
    for (const scene of [...scenes].reverse()) {
      const inScene = this.passages.filter((p) => (p.scene ?? "") === scene);
      const head = list.createDiv({ cls: "rpg-reword-scene" });
      head.createSpan({ text: scene || "Before the first scene" });
      const all = head.createEl("button", { text: "all", cls: "rpg-reword-all" });
      all.addEventListener("click", () => {
        const every = inScene.every((p) => this.picked.has(p.line));
        for (const p of inScene) every ? this.picked.delete(p.line) : this.picked.add(p.line);
        this.drawPick();
      });
      for (const p of inScene) {
        const row = list.createEl("label", { cls: `rpg-reword-row is-${p.kind}` });
        const box = row.createEl("input", { type: "checkbox" });
        box.checked = this.picked.has(p.line);
        box.addEventListener("change", () => {
          if (box.checked) this.picked.add(p.line);
          else this.picked.delete(p.line);
          count();
        });
        const text = row.createSpan();
        if (p.speaker) text.createEl("strong", { text: `${p.speaker}: ` });
        text.appendText(p.text);
      }
    }

    const wish = contentEl.createEl("input", {
      type: "text",
      cls: "rpg-reword-wish",
      attr: { placeholder: "Anything in particular? (more tense, shorter, less formal…)" },
    });
    wish.value = this.wish;
    wish.addEventListener("input", () => (this.wish = wish.value));

    const foot = new Setting(contentEl);
    let go: { setButtonText(t: string): unknown; setDisabled(d: boolean): unknown } | null = null;
    foot.addButton((b) => b.setButtonText("Cancel").onClick(() => this.close()));
    foot.addButton((b) => {
      go = b;
      b.setCta().onClick(() => void this.ask(b));
    });
    const count = () => {
      go?.setButtonText(this.picked.size ? `Reword ${this.picked.size}` : "Reword");
      go?.setDisabled(this.picked.size === 0 || this.picked.size > MOST || !hasAnthropic(this.endpoint));
    };
    count();
  }

  private async ask(button: { setButtonText(t: string): unknown; setDisabled(d: boolean): unknown }): Promise<void> {
    const chosen = this.passages.filter((p) => this.picked.has(p.line));
    button.setButtonText("Rewording…");
    button.setDisabled(true);
    try {
      const answer = await anthropicText(
        this.endpoint,
        REWORD_SYSTEM,
        rewordPrompt(this.body, chosen, this.wish),
        6000
      );
      this.results = readRewording(answer, chosen).map((r) => ({
        ...r,
        keep: !r.refused && r.text !== r.passage.text,
      }));
      this.drawReview();
    } catch (e) {
      new Notice(`Rewording: ${e instanceof Error ? e.message : String(e)}`, 10000);
      this.drawPick();
    }
  }

  private drawReview(): void {
    const { contentEl } = this;
    const results = this.results ?? [];
    contentEl.empty();
    const changed = results.filter((r) => !r.refused && r.text !== r.passage.text).length;
    contentEl.createEl("p", {
      text: changed
        ? "Each passage as it was, and reworded. Edit a rewording if you like, untick what you would rather keep as it was."
        : "Nothing was changed: the passages were left as they are.",
      cls: "rpg-reword-about",
    });
    const list = contentEl.createDiv({ cls: "rpg-reword-list" });
    for (const r of results) {
      const same = r.text === r.passage.text;
      const item = list.createDiv({ cls: `rpg-reword-result${same ? " is-same" : ""}` });
      const head = item.createEl("label", { cls: "rpg-reword-keep" });
      const box = head.createEl("input", { type: "checkbox" });
      box.checked = r.keep;
      box.disabled = same;
      box.addEventListener("change", () => (r.keep = box.checked));
      head.createSpan({
        text: r.refused ? `Left as it was (${r.refused})` : same ? "Left as it was" : "Use this rewording",
      });
      item.createDiv({
        cls: "rpg-reword-was",
        text: `${r.passage.speaker ? `${r.passage.speaker}: ` : ""}${r.passage.text}`,
      });
      if (!same) {
        const area = item.createEl("textarea", { cls: "rpg-reword-now" });
        area.value = r.text;
        area.rows = Math.max(2, Math.ceil(r.text.length / 70));
        area.addEventListener("input", () => (r.text = area.value.replace(/\n+/g, " ")));
      }
    }
    new Setting(contentEl)
      .addButton((b) => b.setButtonText("Back").onClick(() => this.drawPick()))
      .addButton((b) =>
        b
          .setButtonText("Write to the log")
          .setCta()
          .setDisabled(changed === 0)
          .onClick(() => void this.write())
      );
  }

  private async write(): Promise<void> {
    const edits = (this.results ?? []).filter((r) => r.keep).map((r) => ({ passage: r.passage, text: r.text }));
    let applied = 0;
    await this.app.vault.process(this.file, (note) => {
      const log = splitLog(note);
      if (!log) return note;
      const out = applyRewording(log.body, edits);
      applied = out.applied;
      return `${log.before}${out.body}${log.after}`;
    });
    new Notice(
      applied === edits.length
        ? `${applied} passage${applied === 1 ? "" : "s"} reworded.`
        : `${applied} of ${edits.length} reworded: the others changed in the note meanwhile, or held something a passage may not.`
    );
    this.close();
  }
}

/** Opens the rewording for a note, when it is one with a log. */
export function openReword(app: App, path: string | undefined, endpoint: AnthropicEndpoint): void {
  const file = path ? app.vault.getAbstractFileByPath(path) : null;
  if (!(file instanceof TFile)) {
    new Notice("Open a session's note first.");
    return;
  }
  new RewordModal(app, file, endpoint).open();
}
