/** The helpers Obsidian adds to every element, which the plugin's components call. */
type ElOpts = string | { cls?: string | string[]; text?: string; attr?: Record<string, string>; title?: string };

function apply(el: HTMLElement, o?: ElOpts): void {
  if (!o) return;
  if (typeof o === "string") {
    el.className = o;
    return;
  }
  if (o.cls) el.className = Array.isArray(o.cls) ? o.cls.join(" ") : o.cls;
  if (o.text) el.textContent = o.text;
  if (o.title) el.title = o.title;
  for (const [k, v] of Object.entries(o.attr ?? {})) el.setAttribute(k, v);
}

export function installDomHelpers(): void {
  const P = HTMLElement.prototype as unknown as Record<string, unknown>;
  const defs: Record<string, unknown> = {
    createEl(this: HTMLElement, tag: string, o?: ElOpts) {
      const el = document.createElement(tag);
      apply(el, o);
      this.appendChild(el);
      return el;
    },
    createDiv(this: HTMLElement, o?: ElOpts) {
      return (this as unknown as { createEl: (t: string, o?: ElOpts) => HTMLElement }).createEl("div", o);
    },
    createSpan(this: HTMLElement, o?: ElOpts) {
      return (this as unknown as { createEl: (t: string, o?: ElOpts) => HTMLElement }).createEl("span", o);
    },
    empty(this: HTMLElement) {
      this.replaceChildren();
    },
    addClass(this: HTMLElement, ...c: string[]) {
      this.classList.add(...c);
    },
    removeClass(this: HTMLElement, ...c: string[]) {
      this.classList.remove(...c);
    },
    toggleClass(this: HTMLElement, c: string, on: boolean) {
      this.classList.toggle(c, on);
    },
    hasClass(this: HTMLElement, c: string) {
      return this.classList.contains(c);
    },
    setText(this: HTMLElement, t: string) {
      this.textContent = t;
    },
    appendText(this: HTMLElement, t: string) {
      this.appendChild(document.createTextNode(t));
    },
  };
  for (const [k, v] of Object.entries(defs))
    if (!(k in P)) Object.defineProperty(P, k, { value: v, configurable: true });
}
