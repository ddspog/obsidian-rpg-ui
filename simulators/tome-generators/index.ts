/**
 * The Log and its cards: the plugin's own Log view, run against the vault copy.
 * Edit lonelog, play the cards, roll, pick and Save as in Obsidian.
 */
import type { App, MarkdownPostProcessorContext } from "obsidian";
import { SessionLogView } from "lib/views/SessionLogView";
import { mountShell, samplesList, textEditor } from "../core/shell";
import { defineSimulator } from "../core/types";
import { makeSamples } from "./samples";

const SESSION = "Simulator/Session.md";

const noteOf = (block: string) => `---\ngm: "[[00. GM Screen]]"\n---\n# Simulator\n\n\`\`\`rpg log\n${block}\n\`\`\`\n`;
const blockOf = (note: string) => note.match(/```rpg log\n([\s\S]*?)\n?```/)?.[1] ?? "";

export default defineSimulator({
  start(ctx) {
    const samples = makeSamples(ctx.notes);
    let block = ctx.store.get("block") || samples[0].text;
    let child: { unload(): void } | null = null;
    let host!: HTMLElement;
    let editor!: ReturnType<typeof textEditor>;

    function mount(): void {
      child?.unload();
      host.replaceChildren();
      const el = document.createElement("div");
      host.appendChild(el);
      ctx.vault.put(SESSION, noteOf(block));
      const pctx = {
        sourcePath: SESSION,
        docId: ctx.id,
        getSectionInfo: () => null,
        addChild: (c: { load(): void; unload(): void }) => {
          child = c;
          c.load();
        },
      };
      new SessionLogView(ctx.app as App, ctx.kv).render(block, el, pctx as unknown as MarkdownPostProcessorContext);
    }

    function setBlock(next: string, remount: boolean): void {
      block = next;
      editor.set(block);
      ctx.store.set("block", block);
      if (remount) mount();
    }

    const shell = mountShell(ctx, [
      {
        id: "log",
        label: "Log",
        note: `The Tome of Worldbuilding's generators on the plugin's own Log (${Object.keys(ctx.notes).length} notes from the vault). Open the Actions bar at the bottom, pick a card in the <b>Generator</b> group, choose a kind and Append, tap each die to roll it, then Save. The text is in <b>Lonelog</b>.`,
        build(el) {
          // The wrappers Obsidian's reading view puts around a code block, which the theme styles by.
          el.innerHTML = `<div class="workspace-leaf-content" data-type="markdown"><div class="view-content"><div class="markdown-reading-view"><div class="markdown-preview-view markdown-rendered is-readable-line-width"><div class="markdown-preview-sizer markdown-preview-section"><div class="el-pre"><div class="block-language-rpg sim-log"></div></div></div></div></div></div></div>`;
          host = el.querySelector(".sim-log")!;
        },
      },
      {
        id: "lonelog",
        label: "Lonelog",
        note: "The log block's text: a header, <code>---</code>, then the entries. Change it and press <b>Apply</b>; what the cards write shows up here too.",
        build(el) {
          editor = textEditor(ctx, el, {
            onApply(text) {
              setBlock(text, true);
              shell.show("log");
            },
            onReset() {
              setBlock(samples[0].text, true);
              ctx.toast("Back to a blank scene");
            },
          });
        },
        onShow: () => editor.set(block),
      },
      {
        id: "samples",
        label: "Samples",
        note: "Lonelog for the cards under work. Load one into the log, or copy it.",
        build(el) {
          samplesList(ctx, el, samples, (s) => {
            setBlock(s.text, true);
            shell.show("log");
          });
        },
      },
    ]);

    // A card's lines, a pick or Save write the note; Obsidian would draw the block again, so do the same.
    ctx.vault.onWrite = (file) => {
      if (file.path !== SESSION) return;
      setBlock(blockOf(ctx.vault.peek(SESSION)), false);
      window.setTimeout(mount, 60);
    };
    setBlock(block, true);
  },
});
