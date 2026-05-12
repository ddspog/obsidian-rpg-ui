import type { FolderLinkStyle } from "settings";

/** Escape a string so it can appear inside a CSS `content: "…"` declaration
 *  without breaking out of the quoted value. Only characters that the CSS
 *  string tokenizer actually cares about need escaping — backslashes (which
 *  start an escape sequence), double quotes (which terminate the string),
 *  and newlines (which are disallowed in single-line strings). */
function escapeCssString(input: string): string {
  return input.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\A ");
}

/** Minimum CSS identifier-safe normalization — defense-in-depth in case
 *  persisted settings contain ids written by a previous schema or hand-
 *  edited JSON. Matches the output space of `slugifyFolderPath`. */
function sanitizeId(id: string): string {
  return id.replace(/[^a-z0-9-]/gi, "").toLowerCase();
}

/**
 * Generate the stylesheet body for a list of folder link styles.
 *
 * Each entry yields a single rule block targeting
 * `a.rpg-folder-link.rpg-folder-link--<id>` plus an optional `::before`
 * rule when the entry has an `iconPrefix`. Rules without any visual
 * declarations are skipped so the stylesheet stays compact.
 *
 * `borderStyle: "underline"` translates to `text-decoration` instead of
 * a border so it doesn't fight the pill-style padding; all other values
 * render as a `border-bottom`.
 *
 * Declarations are emitted WITHOUT `!important` — the expectation is
 * that block stylesheets don't paint `color` / `text-decoration` /
 * `font-weight` / `font-style` / `background` onto `.internal-link`
 * themselves, so our two-class selector (`a.rpg-folder-link.rpg-…`) is
 * specific enough to win on its own.
 */
export function generateFolderLinkCss(styles: readonly FolderLinkStyle[]): string {
  const blocks: string[] = [];
  for (const style of styles) {
    const id = sanitizeId(style.id);
    if (!id) continue;
    const selector = `a.rpg-folder-link.rpg-folder-link--${id}`;
    const decls: string[] = [];
    if (style.color) decls.push(`color: ${style.color}`);
    if (style.bold) decls.push("font-weight: bold");
    if (style.italic) decls.push("font-style: italic");
    if (style.background) {
      // Pill treatment: padding + rounded corners read as a chip when
      // combined with a background.
      decls.push(`background-color: ${style.background}`);
      decls.push("padding: 0 0.35em");
      decls.push("border-radius: 0.4em");
    }
    if (style.borderStyle && style.borderStyle !== "none") {
      const borderColor = style.borderColor || "currentColor";
      if (style.borderStyle === "underline") {
        decls.push(`text-decoration: underline ${borderColor}`);
      } else {
        decls.push(`border-bottom: 1px ${style.borderStyle} ${borderColor}`);
        decls.push("text-decoration: none");
      }
    } else if (style.borderStyle === "none") {
      // Explicit "no border" overrides the default internal-link
      // underline. Our selector (two classes + element) beats the
      // default `.internal-link` (one class + element), so no
      // !important needed as long as block stylesheets stay out of
      // link colors / decorations.
      decls.push("text-decoration: none");
      decls.push("border-bottom: none");
    }
    if (decls.length > 0) {
      blocks.push(`${selector} {\n  ${decls.join(";\n  ")};\n}`);
    }
    if (style.iconPrefix) {
      const content = escapeCssString(style.iconPrefix);
      blocks.push(`${selector}::before {\n  content: "${content} ";\n}`);
    }
  }
  return blocks.join("\n\n");
}
