/**
 * The Lonelog simulator: the plugin's own Log view, run in a plain browser against an
 * in-memory copy of the vault. Edit lonelog, play the cards, and Save as in Obsidian.
 */
import type { App, MarkdownPostProcessorContext } from "obsidian";
import { SessionLogView } from "lib/views/SessionLogView";
import { KeyValueStore } from "lib/services/kv/kv";
import { installDomHelpers } from "./dom";
import { makeApp } from "./fake-app";
import { makeSamples } from "./samples";

installDomHelpers();

const SESSION = "Simulator/Session.md";
const KEY = "lonelog-simulator:block";

let vaultData: Record<string, string> = {};
let app: ReturnType<typeof makeApp>["app"];
let vault: ReturnType<typeof makeApp>["vault"];
let samples: ReturnType<typeof makeSamples> = [];
const kv = new KeyValueStore({ loadData: async () => ({ state: {} }), saveData: async () => {} });

const noteOf = (block: string) => `---\ngm: "[[00. GM Screen]]"\n---\n# Simulator\n\n\`\`\`rpg log\n${block}\n\`\`\`\n`;
const blockOf = (note: string) => note.match(/```rpg log\n([\s\S]*?)\n?```/)?.[1] ?? "";

let block = "";

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;
const toast = (msg: string) => {
  const el = document.createElement("div");
  el.className = "sim-toast";
  el.textContent = msg;
  $(".sim-toasts").appendChild(el);
  window.setTimeout(() => el.remove(), 2500);
};

let child: { unload(): void } | null = null;
function mount(): void {
  child?.unload();
  const host = $(".sim-log");
  host.replaceChildren();
  const el = document.createElement("div");
  host.appendChild(el);
  vault.put(SESSION, noteOf(block));
  const ctx = {
    sourcePath: SESSION,
    docId: "simulator",
    getSectionInfo: () => null,
    addChild: (c: { load(): void; unload(): void }) => {
      child = c;
      c.load();
    },
  };
  new SessionLogView(app as unknown as App, kv).render(block, el, ctx as unknown as MarkdownPostProcessorContext);
}

function setBlock(next: string, remount: boolean): void {
  block = next;
  $<HTMLTextAreaElement>(".sim-source").value = block;
  try {
    localStorage.setItem(KEY, block);
  } catch {
    /* ignore */
  }
  if (remount) mount();
}

async function copy(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast("Copied");
  } catch {
    const ta = $<HTMLTextAreaElement>(".sim-source");
    ta.value = text;
    ta.select();
    toast("Select all and copy");
  }
}

function tab(name: "log" | "source" | "samples"): void {
  for (const t of ["log", "source", "samples"]) {
    $(`.sim-panel[data-panel="${t}"]`).hidden = t !== name;
    $(`button[data-tab="${t}"]`).setAttribute("aria-pressed", String(t === name));
  }
  if (name === "source") $<HTMLTextAreaElement>(".sim-source").value = block;
}

function build(): void {
  const noteCount = Object.keys(vaultData).length;
  document.body.innerHTML = `
  <div class="sim">
    <div class="sim-bar">
      <span class="sim-title">Lonelog simulator</span>
      <div class="sim-tabs">
        <button data-tab="log" aria-pressed="true">Log</button>
        <button data-tab="source" aria-pressed="false">Lonelog</button>
        <button data-tab="samples" aria-pressed="false">Samples</button>
      </div>
    </div>
    <section class="sim-panel" data-panel="log">
      <p class="sim-note">The plugin's Log, running on ${noteCount} notes from the vault. Play the cards at the bottom, tap a die to roll it, pick from the dropdowns, then Save. Edit the text in <b>Lonelog</b>.</p>
      <div class="markdown-preview-view"><div class="sim-log"></div></div>
    </section>
    <section class="sim-panel" data-panel="source" hidden>
      <p class="sim-note">The log block's text: a header, <code>---</code>, then the entries. Change it and press <b>Apply</b>; what the cards write shows up here too.</p>
      <textarea class="sim-source" spellcheck="false" autocapitalize="off" autocomplete="off"></textarea>
      <div class="sim-actions">
        <button data-act="apply">Apply</button>
        <button data-act="copy">Copy lonelog</button>
        <button data-act="reset">Reset</button>
      </div>
    </section>
    <section class="sim-panel" data-panel="samples" hidden></section>
    <div class="sim-toasts"></div>
  </div>`;

  const list = $(".sim-panel[data-panel='samples']");
  list.innerHTML = `<p class="sim-note">Lonelog for the cards under work. Load one into the log, or copy it.</p>`;
  samples.forEach((s, i) => {
    const d = document.createElement("div");
    d.className = "sim-sample";
    d.innerHTML = `<h3></h3><p></p><pre></pre><div class="sim-actions"><button data-load="${i}">Load</button><button data-copy="${i}">Copy</button></div>`;
    d.querySelector("h3")!.textContent = s.title;
    d.querySelector("p")!.textContent = s.about;
    d.querySelector("pre")!.textContent = s.block.length > 900 ? `${s.block.slice(0, 900)}…` : s.block;
    list.appendChild(d);
  });

  document.body.addEventListener("click", (e) => {
    const t = (e.target as HTMLElement).closest("button") as HTMLButtonElement | null;
    if (!t) return;
    if (t.dataset.tab) tab(t.dataset.tab as "log" | "source" | "samples");
    else if (t.dataset.load) {
      setBlock(samples[Number(t.dataset.load)].block, true);
      tab("log");
    } else if (t.dataset.copy) void copy(samples[Number(t.dataset.copy)].block);
    else if (t.dataset.act === "apply") {
      setBlock($<HTMLTextAreaElement>(".sim-source").value, true);
      tab("log");
    } else if (t.dataset.act === "copy") void copy($<HTMLTextAreaElement>(".sim-source").value || block);
    else if (t.dataset.act === "reset") {
      setBlock(samples[1].block, true);
      toast("Back to the first sample");
    }
  });
}

function start(): void {
  vaultData = JSON.parse(document.getElementById("vault-data")?.textContent ?? "{}");
  ({ app, vault } = makeApp(vaultData));
  samples = makeSamples(vaultData);
  block = samples[1].block;
  try {
    block = localStorage.getItem(KEY) || block;
  } catch {
    /* no storage: start from the sample */
  }
  // A card's lines, a pick or Save write the note; Obsidian would draw the block again, so do the same.
  vault.onWrite = (file) => {
    if (file.path !== SESSION) return;
    setBlock(blockOf(vault.peek(SESSION)), false);
    window.setTimeout(mount, 60);
  };
  build();
  setBlock(block, true);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
else start();
