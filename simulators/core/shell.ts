/** The frame every simulator shares: a header with tabs, panels, and a samples list. */
import type { Sample, SimulatorContext } from "./types";

export interface PanelDef {
  id: string;
  label: string;
  /** A line above the panel's content. */
  note?: string;
  /** Fills the panel once, when the page starts. */
  build(el: HTMLElement): void;
  /** Runs each time the panel is shown. */
  onShow?(el: HTMLElement): void;
}

export interface Shell {
  show(id: string): void;
  panel(id: string): HTMLElement;
}

/** Builds the header and one panel per entry; the first is shown. Phone-first, one column. */
export function mountShell(ctx: SimulatorContext, panels: PanelDef[]): Shell {
  const { root } = ctx;
  root.innerHTML = `
    <div class="sim">
      <div class="sim-bar">
        <span class="sim-title"></span>
        <div class="sim-tabs"></div>
      </div>
      <div class="sim-panels"></div>
      <div class="sim-toasts"></div>
    </div>`;
  root.querySelector(".sim-title")!.textContent = ctx.title;
  const tabs = root.querySelector(".sim-tabs")!;
  const host = root.querySelector(".sim-panels")!;
  const els = new Map<string, HTMLElement>();

  for (const p of panels) {
    const b = document.createElement("button");
    b.textContent = p.label;
    b.dataset.tab = p.id;
    b.setAttribute("aria-pressed", "false");
    b.addEventListener("click", () => shell.show(p.id));
    tabs.appendChild(b);

    const el = document.createElement("section");
    el.className = "sim-panel";
    el.dataset.panel = p.id;
    el.hidden = true;
    if (p.note) {
      const n = document.createElement("p");
      n.className = "sim-note";
      n.innerHTML = p.note;
      el.appendChild(n);
    }
    const body = document.createElement("div");
    body.className = "sim-body";
    el.appendChild(body);
    host.appendChild(el);
    els.set(p.id, body);
    p.build(body);
  }

  const shell: Shell = {
    show(id) {
      for (const p of panels) {
        const section = els.get(p.id)!.parentElement!;
        section.hidden = p.id !== id;
        tabs.querySelector(`[data-tab="${p.id}"]`)!.setAttribute("aria-pressed", String(p.id === id));
        if (p.id === id) p.onShow?.(els.get(p.id)!);
      }
    },
    panel: (id) => els.get(id)!,
  };
  shell.show(panels[0].id);
  return shell;
}

/** A list of samples, each with Load and Copy. */
export function samplesList(
  ctx: SimulatorContext,
  el: HTMLElement,
  samples: Sample[],
  onLoad: (sample: Sample) => void
): void {
  samples.forEach((s) => {
    const d = document.createElement("div");
    d.className = "sim-sample";
    d.innerHTML = `<h3></h3><p></p><pre></pre><div class="sim-actions"><button data-do="load">Load</button><button data-do="copy">Copy</button></div>`;
    d.querySelector("h3")!.textContent = s.title;
    d.querySelector("p")!.textContent = s.about;
    d.querySelector("pre")!.textContent = s.text.length > 900 ? `${s.text.slice(0, 900)}…` : s.text;
    d.querySelector('[data-do="load"]')!.addEventListener("click", () => onLoad(s));
    d.querySelector('[data-do="copy"]')!.addEventListener("click", () => void ctx.copy(s.text));
    el.appendChild(d);
  });
}

/** A text box with Apply, Copy and Reset: what a simulator's input is typed or pasted into. */
export function textEditor(
  ctx: SimulatorContext,
  el: HTMLElement,
  opts: { onApply(text: string): void; onReset?(): void }
): { get(): string; set(text: string): void } {
  el.innerHTML = `
    <textarea class="sim-source" spellcheck="false" autocapitalize="off" autocomplete="off"></textarea>
    <div class="sim-actions">
      <button data-do="apply">Apply</button>
      <button data-do="copy">Copy</button>
      ${opts.onReset ? '<button data-do="reset">Reset</button>' : ""}
    </div>`;
  const ta = el.querySelector("textarea")!;
  el.querySelector('[data-do="apply"]')!.addEventListener("click", () => opts.onApply(ta.value));
  el.querySelector('[data-do="copy"]')!.addEventListener("click", () => void ctx.copy(ta.value));
  el.querySelector('[data-do="reset"]')?.addEventListener("click", () => opts.onReset?.());
  return {
    get: () => ta.value,
    set: (text) => {
      ta.value = text;
    },
  };
}
