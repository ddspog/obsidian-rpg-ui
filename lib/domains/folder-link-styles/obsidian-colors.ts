/**
 * Obsidian's extended color palette, exposed as CSS custom properties
 * on the app root (documented at
 * https://docs.obsidian.md/Reference/CSS+variables/Foundations/Colors).
 *
 * Picking a preset stores the value as `var(--color-<name>)` so the
 * generated stylesheet inherits whatever the active theme (or
 * Obsidian's light/dark default) resolves for that token — links stay
 * readable when the user switches themes or color schemes.
 *
 * `fallback` is Obsidian's documented light-mode default for that
 * variable. It is only used to paint the `<input type="color">` swatch
 * in settings (that input takes hex, not `var(...)`); the generated
 * stylesheet always emits the CSS variable, never the fallback hex.
 */
export interface ObsidianColorPreset {
  id: string;
  label: string;
  cssVar: string;
  fallback: string;
  group?: "color" | "text";
}

export const OBSIDIAN_COLOR_PRESETS: readonly ObsidianColorPreset[] = [
  { id: "red", label: "Red", cssVar: "var(--color-red)", fallback: "#e93147", group: "color" },
  { id: "orange", label: "Orange", cssVar: "var(--color-orange)", fallback: "#ec7500", group: "color" },
  { id: "yellow", label: "Yellow", cssVar: "var(--color-yellow)", fallback: "#e0ac00", group: "color" },
  { id: "green", label: "Green", cssVar: "var(--color-green)", fallback: "#08b94e", group: "color" },
  { id: "cyan", label: "Cyan", cssVar: "var(--color-cyan)", fallback: "#00bfbc", group: "color" },
  { id: "blue", label: "Blue", cssVar: "var(--color-blue)", fallback: "#086ddd", group: "color" },
  { id: "purple", label: "Purple", cssVar: "var(--color-purple)", fallback: "#7852ee", group: "color" },
  { id: "pink", label: "Pink", cssVar: "var(--color-pink)", fallback: "#d53984", group: "color" },
  { id: "text", label: "Text", cssVar: "var(--text-normal)", fallback: "#1e1e1e", group: "text" },
  { id: "title", label: "Title", cssVar: "var(--text-title)", fallback: "#1e1e1e", group: "text" },
  { id: "muted", label: "Muted", cssVar: "var(--text-muted)", fallback: "#5c5c5c", group: "text" },
  { id: "faint", label: "Faint", cssVar: "var(--text-faint)", fallback: "#999999", group: "text" },
  { id: "subtitle", label: "Subtitle", cssVar: "var(--text-subtitle)", fallback: "#5c5c5c", group: "text" },
  { id: "selection", label: "Selection", cssVar: "var(--text-selection)", fallback: "#b3d7ff", group: "text" },
  { id: "group", label: "Group", cssVar: "var(--color-text-group)", fallback: "#5c5c5c", group: "text" },
  { id: "secondary", label: "Secondary", cssVar: "var(--color-text-secondary)", fallback: "#707070", group: "text" },
  { id: "sublabel", label: "SubLabel", cssVar: "var(--color-text-sublabel)", fallback: "#999999", group: "text" },
];

/** Match a stored value back to a preset entry, so the dropdown can
 *  reflect the current selection when the settings tab re-renders. */
export function findPresetForValue(value: string | undefined): ObsidianColorPreset | null {
  if (!value) return null;
  return OBSIDIAN_COLOR_PRESETS.find((p) => p.cssVar === value) ?? null;
}
