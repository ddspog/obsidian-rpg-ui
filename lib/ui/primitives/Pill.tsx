import * as React from "react";
import type { App } from "obsidian";
import { MarkdownRenderer, Component } from "obsidian";

export interface PillProps extends React.HTMLAttributes<HTMLSpanElement> {
  link?: string; // wiki-style file reference (e.g. "Poisoned" or "folder/Note")
  children?: React.ReactNode;
}

/**
 * Pill
 * Renders a small clickable pill. If `link` is provided the pill will try to
 * resolve it to a vault path and open the file when clicked (honours cmd/ctrl
 * to open in new tab).
 */
function Link({ link, children, className, ...rest }: PillProps) {
  const app = (globalThis as any).app as App | undefined;
  const containerRef = React.useRef<HTMLSpanElement | null>(null);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.innerHTML = "";

    // If no link or no app available, just render the children as text so
    // consumers can style via the outer span's aria-label selector.
    if (!link || !app) {
      el.innerHTML = "";
      const child = document.createElement("span");
      child.textContent = children != null ? String(children) : "";
      el.appendChild(child);
      return;
    }

    const comp = new Component();
    // If children is a simple string, use it as an alias (wiki link alias)
    const alias = typeof children === "string" && children.trim().length > 0 ? `|${children}` : "";
    const md = `[[${String(link)}${alias}]]`;
    const sourcePath = app.workspace.getActiveFile()?.path ?? "";

    // Render the wikilink via Obsidian's MarkdownRenderer so the produced
    // anchor gets Obsidian's internal-link behavior (hover preview, etc).
    void MarkdownRenderer.renderMarkdown(md, el, sourcePath, comp)
      .then(() => {
        // Prefer Obsidian's internal-link anchor, fall back to any anchor.
        const anchor = el.querySelector("a.internal-link") || el.querySelector("a");
        if (anchor instanceof HTMLElement) {
          const parent = anchor.parentElement;
          // If anchor is wrapped in a paragraph or other wrapper, unwrap it so
          // the anchor becomes the direct child of our outer span.
          if (parent && parent !== el) {
            // Remove existing contents and append the anchor directly.
            el.innerHTML = "";
            el.appendChild(anchor);
            // If the original parent is now empty, remove it.
            try {
              if (parent.parentElement) parent.remove();
            } catch {}
          }
        } else {
          // No anchor produced; render fallback child with content class.
          el.innerHTML = "";
          const child = document.createElement("span");
          child.textContent = children != null ? String(children) : String(link);
          el.appendChild(child);
        }
      })
      .catch(() => {
        // Fallback: render plain text
        el.innerHTML = "";
        const child = document.createElement("span");
        child.textContent = children != null ? String(children) : String(link);
        el.appendChild(child);
      });

    return () => {
      try {
        comp.onunload?.();
      } catch {}
    };
  }, [link, children, app]);

  // We no longer rely on specific classes. Render an outer span with an
  // aria-details for styling/selection and forward any provided className.
  const classes = [className].filter(Boolean).join(" ");
  return <span ref={containerRef} className={classes || undefined} aria-details="Link Pill" {...rest} />;
}

// Export a Pill object that exposes the Link implementation as `Pill.Link`.
// We no longer provide a callable/component-compatible `Pill` — consumers
// should use `Pill.Link` (or import `Link` directly).
export const Pill = { Link } as const;

export { Link };
export default Pill;
