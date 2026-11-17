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

/** Why a rewording was not taken, in words for the writer. */
const REFUSED: Record<string, string> = {
  "it holds a tag": "the rewording added a [tag], which a passage cannot hold",
  "its links changed": "the rewording changed or dropped a [[link]]",
  "it starts like a log line": "the rewording began like a log line",
  "more than one line": "the rewording ran to more than one line",
  "far longer than the original": "the rewording was far longer than the passage",
  empty: "no rewording came back for it",
  "no answer for it": "no rewording came back for it",
};

export class RewordModal extends Modal {
  private body = "";
  private passages: Passage[] = [];
  private picked = new Set<number>();
  private boxes = new Map<number, HTMLInputElement>();
  private counts = new Map<string, HTMLElement>();
  private wish = "";
  private results: Array<{ passage: Passage; text: string; refused?: string; keep: boolean }> | null = null;
  private go: { setButtonText(t: string): unknown; setDisabled(d: boolean): unknown } | null = null;
  private limit: HTMLElement | null = null;

  constructor(
    app: App,
    private file: TFile,
    private endpoint: AnthropicEndpoint,
    private pluginId?: string
  ) {
    super(app);
  }

  async onOpen(): Promise<void> {
    this.titleEl.setText("Improve the wording");
    this.modalEl.addClass("rpg-reword");
    if (!hasAnthropic(this.endpoint)) return this.drawNoModel();
    const log = splitLog(await this.app.vault.read(this.file));
    if (!log) {
      this.contentEl.createEl("p", { text: "This note has no rpg log block." });
      return;
    }
    this.body = log.body;
    this.passages = passagesOf(log.body);
    if (this.passages.length === 0) {
      this.contentEl.createEl("p", { text: "This log has no prose yet: nothing to reword." });
      return;
    }
    this.drawPick();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  /** With no model set: what is needed, and the way to it. */
  private drawNoModel(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("p", { text: "Rewording needs a model. Set one under Settings › Image studio › Anthropic." });
    contentEl.createEl("p", {
      text: "It uses the Anthropic link, key and model there, the same ones that draft image prompts.",
      cls: "rpg-reword-about",
    });
    new Setting(contentEl)
      .addButton((b) => b.setButtonText("Cancel").onClick(() => this.close()))
      .addButton((b) =>
        b
          .setButtonText("Open settings")
          .setCta()
          .onClick(() => {
            this.close();
            const setting = (this.app as unknown as { setting?: { open(): void; openTabById(id: string): void } })
              .setting;
            setting?.open();
            if (this.pluginId) setting?.openTabById(this.pluginId);
          })
      );
  }

  /** The picks shown as they are: the boxes, each scene's count, the button. */
  private paint(): void {
    for (const [line, box] of this.boxes) box.checked = this.picked.has(line);
    for (const [scene, el] of this.counts) {
      const n = this.passages.filter((p) => (p.scene ?? "") === scene && this.picked.has(p.line)).length;
      el.setText(n ? `${n} picked` : "");
    }
    const n = this.picked.size;
    this.go?.setButtonText(n ? `Reword ${n}` : "Reword");
    this.go?.setDisabled(n === 0 || n > MOST);
    if (this.limit) {
      this.limit.setText(n > MOST ? `${MOST} passages at most at a time: untick ${n - MOST}.` : "");
      this.limit.toggle(n > MOST);
    }
  }

  private pick(lines: number[], replace: boolean): void {
    if (replace) this.picked = new Set(lines);
    else for (const l of lines) this.picked.add(l);
    this.paint();
    // What was picked is shown: the first of it scrolled into view.
    const first = this.passages.find((p) => this.picked.has(p.line));
    if (first) this.boxes.get(first.line)?.closest(".rpg-reword-row")?.scrollIntoView({ block: "center" });
  }

  private drawPick(): void {
    const { contentEl } = this;
    contentEl.empty();
    this.boxes.clear();
    this.counts.clear();
    contentEl.createEl("p", {
      text: "Pick what to reword. Only the words of each passage change: rolls, tags, links and every other line of the log stay as they are. You see each rewording before it is written.",
      cls: "rpg-reword-about",
    });

    const scenes = [...new Set(this.passages.map((p) => p.scene ?? ""))];
    const quick = contentEl.createDiv({
      cls: "rpg-reword-quick",
      attr: { role: "group", "aria-label": "Quick picks" },
    });
    const chip = (text: string, run: () => void) => {
      const b = quick.createEl("button", { text, cls: "rpg-reword-chip" });
      b.addEventListener("click", run);
    };
    chip("Last scene", () =>
      this.pick(
        this.passages.filter((p) => (p.scene ?? "") === scenes[scenes.length - 1]).map((p) => p.line),
        true
      )
    );
    chip("Last 5", () =>
      this.pick(
        this.passages.slice(-5).map((p) => p.line),
        true
      )
    );
    chip("Clear", () => this.pick([], true));

    const list = contentEl.createDiv({ cls: "rpg-reword-list" });
    // Newest scene first: what was just played is what is most often reworded.
    for (const scene of [...scenes].reverse()) {
      const inScene = this.passages.filter((p) => (p.scene ?? "") === scene);
      const head = list.createDiv({ cls: "rpg-reword-scene" });
      head.createSpan({ text: scene || "Before the first scene" });
      this.counts.set(scene, head.createSpan({ cls: "rpg-reword-count" }));
      const all = head.createEl("button", { text: "All", cls: "rpg-reword-all" });
      all.setAttr("aria-label", `Pick all of ${scene || "before the first scene"}`);
      all.addEventListener("click", () => {
        const every = inScene.every((p) => this.picked.has(p.line));
        for (const p of inScene) every ? this.picked.delete(p.line) : this.picked.add(p.line);
        this.paint();
      });
      for (const p of inScene) {
        const row = list.createEl("label", { cls: `rpg-reword-row is-${p.kind}` });
        const box = row.createEl("input", { type: "checkbox" });
        this.boxes.set(p.line, box);
        box.addEventListener("change", () => {
          if (box.checked) this.picked.add(p.line);
          else this.picked.delete(p.line);
          this.paint();
        });
        const text = row.createSpan();
        if (p.speaker) text.createEl("strong", { text: `${p.speaker}: ` });
        text.appendText(p.text);
      }
    }

    const ask = contentEl.createDiv({ cls: "rpg-reword-ask" });
    ask.createEl("label", { text: "Ask for", attr: { for: "rpg-reword-wish" } });
    const wish = ask.createEl("input", {
      type: "text",
      cls: "rpg-reword-wish",
      attr: { id: "rpg-reword-wish", placeholder: "more tense, shorter…" },
    });
    wish.value = this.wish;
    wish.addEventListener("input", () => (this.wish = wish.value));

    this.limit = contentEl.createEl("p", { cls: "rpg-reword-limit", attr: { role: "status" } });
    const foot = new Setting(contentEl);
    foot.addButton((b) => b.setButtonText("Cancel").onClick(() => this.close()));
    foot.addButton((b) => {
      this.go = b;
      b.setCta().onClick(() => void this.ask(b));
    });
    this.paint();
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
      new Notice(
        `The rewording did not come back (${e instanceof Error ? e.message : String(e)}). Your picks are kept: try again.`,
        10000
      );
      this.paint();
    }
  }

  private drawReview(): void {
    const { contentEl } = this;
    const results = this.results ?? [];
    contentEl.empty();
    const changed = results.filter((r) => !r.refused && r.text !== r.passage.text).length;
    contentEl.createEl("p", {
      text: changed
        ? "Each passage as it was, and reworded. Edit a rewording if you like, or untick it to keep the passage as it was."
        : "Nothing was changed: the passages were left as they are.",
      cls: "rpg-reword-about",
    });
    const list = contentEl.createDiv({ cls: "rpg-reword-list is-review" });
    const fit = (area: HTMLTextAreaElement) => {
      area.style.height = "auto";
      area.style.height = `${area.scrollHeight + 2}px`;
    };
    for (const r of results) {
      const same = r.text === r.passage.text;
      const item = list.createDiv({ cls: `rpg-reword-result${same || r.refused ? " is-same" : ""}` });
      if (r.refused || same) {
        item.createDiv({
          cls: "rpg-reword-why",
          text: r.refused
            ? `Kept as it was: ${REFUSED[r.refused] ?? r.refused}.`
            : "Kept as it was: it already reads well.",
        });
        item.createDiv({
          cls: "rpg-reword-was",
          text: `${r.passage.speaker ? `${r.passage.speaker}: ` : ""}${r.passage.text}`,
        });
        continue;
      }
      const head = item.createEl("label", { cls: "rpg-reword-keep" });
      const box = head.createEl("input", { type: "checkbox" });
      box.checked = r.keep;
      box.addEventListener("change", () => (r.keep = box.checked));
      head.createSpan({ text: "Use this rewording" });
      item.createDiv({
        cls: "rpg-reword-was",
        text: `${r.passage.speaker ? `${r.passage.speaker}: ` : ""}${r.passage.text}`,
      });
      const area = item.createEl("textarea", { cls: "rpg-reword-now", attr: { "aria-label": "The rewording" } });
      area.value = r.text;
      area.rows = 1;
      area.addEventListener("input", () => {
        r.text = area.value.replace(/\n+/g, " ");
        fit(area);
      });
      // Sized to its words once it is on screen.
      window.requestAnimationFrame(() => fit(area));
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
export function openReword(app: App, path: string | undefined, endpoint: AnthropicEndpoint, pluginId?: string): void {
  const file = path ? app.vault.getAbstractFileByPath(path) : null;
  if (!(file instanceof TFile)) {
    new Notice("Open a session's note first.");
    return;
  }
  new RewordModal(app, file, endpoint, pluginId).open();
}
