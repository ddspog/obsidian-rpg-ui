import * as React from "react";
import type { App } from "obsidian";
import { TFile } from "obsidian";

export interface PortraitThumbProps {
  /** Vault file reference — plain filename, wikilink syntax, or path */
  src?: unknown;
  /** Alt text for the image */
  alt?: string;
  /** Forwarded by SectionRow.distribution via cloneElement */
  style?: React.CSSProperties;
}

/** Extract a usable linkpath from any format frontmatter might give us.
 *  Handles: plain string, "[[name]]" string, {link/path/file} object,
 *  and nested arrays produced by YAML parsing [[name]] as [["name"]].
 */
function extractLinkpath(val: unknown): string | null {
  // YAML parses [[file.webp]] as a nested array [["file.webp"]] — recurse in
  if (Array.isArray(val)) {
    for (const item of val) {
      const result = extractLinkpath(item);
      if (result) return result;
    }
    return null;
  }

  let str: string | null = null;
  if (typeof val === "string") {
    str = val.trim();
  } else if (val && typeof val === "object") {
    // Obsidian may parse [[wikilinks]] in frontmatter as link objects
    const obj = val as Record<string, unknown>;
    const raw = obj.link ?? obj.path ?? obj.file ?? obj.src;
    if (typeof raw === "string") str = raw.trim();
  }

  if (!str) return null;

  // Strip wikilink / embed syntax: [[name]], ![[name]], [[name|alias]]
  const m = str.match(/^!?\[\[([^\]|]+?)(?:\|[^\]]+)?\]\]$/);
  if (m) return m[1].trim();

  return str;
}

export function PortraitThumb({ src, alt = "Character portrait", style }: PortraitThumbProps) {
  const containerRef = React.useRef<HTMLElement | null>(null);
  const linkpath = extractLinkpath(src);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el || !linkpath) return;
    el.innerHTML = "";

    const app = (globalThis as any).app as App | undefined;
    if (!app) return;

    const sourcePath = app.workspace.getActiveFile()?.path ?? "";
    const file = app.metadataCache.getFirstLinkpathDest(linkpath, sourcePath);
    if (!(file instanceof TFile)) return;

    const resourcePath = app.vault.getResourcePath(file);
    const img = document.createElement("img");
    img.src = resourcePath;
    img.alt = alt;
    el.appendChild(img);
  }, [linkpath, alt]);

  return <figure aria-details="Portrait Thumb" ref={containerRef} style={style} data-empty={!linkpath || undefined} />;
}
