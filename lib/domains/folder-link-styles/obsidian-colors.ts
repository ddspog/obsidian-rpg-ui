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
}

export const OBSIDIAN_COLOR_PRESETS: readonly ObsidianColorPreset[] = [
  { id: "red", label: "Red", cssVar: "var(--color-red)", fallback: "#e93147" },
  { id: "orange", label: "Orange", cssVar: "var(--color-orange)", fallback: "#ec7500" },
  { id: "yellow", label: "Yellow", cssVar: "var(--color-yellow)", fallback: "#e0ac00" },
  { id: "green", label: "Green", cssVar: "var(--color-green)", fallback: "#08b94e" },
  { id: "cyan", label: "Cyan", cssVar: "var(--color-cyan)", fallback: "#00bfbc" },
  { id: "blue", label: "Blue", cssVar: "var(--color-blue)", fallback: "#086ddd" },
  { id: "purple", label: "Purple", cssVar: "var(--color-purple)", fallback: "#7852ee" },
  { id: "pink", label: "Pink", cssVar: "var(--color-pink)", fallback: "#d53984" },
];

/** Match a stored value back to a preset entry, so the dropdown can
 *  reflect the current selection when the settings tab re-renders. */
export function findPresetForValue(value: string | undefined): ObsidianColorPreset | null {
  if (!value) return null;
  return OBSIDIAN_COLOR_PRESETS.find((p) => p.cssVar === value) ?? null;
}
