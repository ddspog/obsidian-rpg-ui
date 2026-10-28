/**
 * A stand-in for the `obsidian` module, so the plugin's own code runs in a plain browser.
 * Only what the Log and its cards reach is more than a stub: files, components, markdown
 * rendering and YAML. Everything else is inert.
 */
import { parse as parseYamlText, stringify as stringifyYamlText } from "yaml";

export class Component {
  private cleanups: Array<() => void> = [];
  private children = new Set<Component>();
  load(): void {
    void this.onload();
  }
  onload(): void | Promise<void> {}
  onunload(): void {}
  unload(): void {
    for (const c of this.children) c.unload();
    this.children.clear();
    for (const fn of this.cleanups.splice(0)) fn();
    this.onunload();
  }
  addChild<T extends Component>(c: T): T {
    this.children.add(c);
    c.load();
    return c;
  }
  removeChild<T extends Component>(c: T): T {
    this.children.delete(c);
    c.unload();
    return c;
  }
  register(cb: () => void): void {
    this.cleanups.push(cb);
  }
  registerEvent(ref: { off?: () => void } | undefined): void {
    if (ref?.off) this.cleanups.push(() => ref.off?.());
  }
  registerDomEvent(el: EventTarget, type: string, cb: EventListener): void {
    el.addEventListener(type, cb);
    this.cleanups.push(() => el.removeEventListener(type, cb));
  }
  registerInterval(id: number): number {
    this.cleanups.push(() => window.clearInterval(id));
    return id;
  }
}

export class MarkdownRenderChild extends Component {
  containerEl: HTMLElement;
  constructor(containerEl: HTMLElement) {
    super();
    this.containerEl = containerEl;
  }
}

export class TAbstractFile {
  path = "";
  name = "";
  parent: TFolder | null = null;
}
export class TFile extends TAbstractFile {
  basename = "";
  extension = "md";
  stat = { ctime: 0, mtime: 0, size: 0 };
  constructor(path: string) {
    super();
    this.path = path;
    this.name = path.split("/").pop() ?? path;
    const dot = this.name.lastIndexOf(".");
    this.basename = dot > 0 ? this.name.slice(0, dot) : this.name;
    this.extension = dot > 0 ? this.name.slice(dot + 1) : "";
  }
}
export class TFolder extends TAbstractFile {
  children: TAbstractFile[] = [];
}

export class Vault {}
export class App {}
export class MarkdownView {}
export class Modal {
  constructor(public app?: unknown) {}
  open(): void {}
  close(): void {}
}
/** The note picker's base: the simulators have no hex-map picking, so it only has to exist. */
export class FuzzySuggestModal<T> extends Modal {
  setPlaceholder(_text: string): void {}
  getItems(): T[] {
    return [];
  }
  getItemText(_item: T): string {
    return "";
  }
  onChooseItem(_item: T): void {}
}
export class Setting {}
export class PluginSettingTab {}
export class DropdownComponent {}
export class ExtraButtonComponent {}

/** A toast in the corner of the page. */
export class Notice {
  constructor(message: string | DocumentFragment, timeout = 3500) {
    const host = document.querySelector(".sim-toasts");
    if (!host) return;
    const el = document.createElement("div");
    el.className = "sim-toast";
    if (typeof message === "string") el.textContent = message;
    else el.appendChild(message);
    host.appendChild(el);
    window.setTimeout(() => el.remove(), timeout);
  }
  setMessage(): this {
    return this;
  }
  hide(): void {}
}

/** A small floating menu: what a long-press or right-click opens in Obsidian. */
type MenuItem = { title: string; onClick: () => void };
export class Menu {
  private items: MenuItem[] = [];
  addItem(cb: (item: Record<string, unknown>) => void): this {
    const entry: MenuItem = { title: "", onClick: () => {} };
    const item: Record<string, unknown> = {
      setTitle: (t: string) => ((entry.title = t), item),
      setIcon: () => item,
      setSection: () => item,
      setChecked: () => item,
      setDisabled: () => item,
      onClick: (fn: () => void) => ((entry.onClick = fn), item),
    };
    cb(item);
    this.items.push(entry);
    return this;
  }
  addSeparator(): this {
    return this;
  }
  showAtMouseEvent(e: MouseEvent): void {
    this.showAt(e.clientX, e.clientY);
  }
  showAtPosition(p: { x: number; y: number }): void {
    this.showAt(p.x, p.y);
  }
  private showAt(x: number, y: number): void {
    const box = document.createElement("div");
    box.className = "sim-menu";
    box.style.left = `${Math.min(x, window.innerWidth - 180)}px`;
    box.style.top = `${Math.min(y, window.innerHeight - 40 * this.items.length - 16)}px`;
    for (const it of this.items) {
      const b = document.createElement("button");
      b.textContent = it.title;
      b.onclick = () => {
        box.remove();
        it.onClick();
      };
      box.appendChild(b);
    }
    const close = () => {
      box.remove();
      document.removeEventListener("pointerdown", away, true);
    };
    const away = (ev: Event) => {
      if (!box.contains(ev.target as Node)) close();
    };
    document.addEventListener("pointerdown", away, true);
    document.body.appendChild(box);
  }
}

export function setIcon(el: HTMLElement, name: string): void {
  el.setAttribute("data-icon", name);
  el.classList.add("sim-icon");
}

export function parseYaml(text: string): unknown {
  return parseYamlText(text);
}

export function stringifyYaml(value: unknown): string {
  return stringifyYamlText(value);
}

export async function requestUrl(): Promise<never> {
  throw new Error("Network requests are not available in the simulator.");
}
export async function loadMathJax(): Promise<void> {}
export function renderMath(source: string): HTMLElement {
  const el = document.createElement("span");
  el.textContent = source;
  return el;
}
export async function finishRenderMath(): Promise<void> {}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Markdown as far as the Log's text needs it: links, emphasis, code, paragraphs. */
function toHtml(md: string): string {
  const inline = (s: string) =>
    esc(s)
      .replace(/!\[\[[^\]]*\]\]/g, "")
      .replace(
        /\[\[([^\]|#]*)(?:#[^\]|]*)?(?:\|([^\]]*))?\]\]/g,
        (_m, target: string, alias?: string) =>
          `<a class="internal-link" data-href="${target}">${alias || target.split("/").pop()}</a>`
      )
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");
  return md
    .split(/\n{2,}/)
    .map((p) => `<p>${inline(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export const MarkdownRenderer = {
  async render(_app: unknown, markdown: string, el: HTMLElement): Promise<void> {
    el.innerHTML = toHtml(markdown);
  },
  async renderMarkdown(markdown: string, el: HTMLElement): Promise<void> {
    el.innerHTML = toHtml(markdown);
  },
};
