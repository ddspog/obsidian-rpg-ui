/**
 * Parser for `rpg figure.mermaid` fences — a floatable diagram figure.
 *
 * Body shape (the `---` separator is optional):
 *
 *   align: right                       ← optional YAML-ish config head
 *   width: 40%
 *   caption: First Scene — 4W Strategy
 *   ---
 *   flowchart TD                       ← mermaid diagram source
 *     A --> B
 *
 * With no `---`, the entire body is treated as the diagram source and the
 * defaults apply (align: right). Config keys:
 *   - align:   right | left | center | full   (default right; `centre` ok)
 *   - width:   any CSS length; a bare number is read as a percentage
 *   - caption: optional markdown caption rendered as a <figcaption>
 *
 * Alignment lives in the config head (NOT the fence info string) on purpose:
 * Obsidian preserves only the first info-string token, so anything after
 * `figure.mermaid` (e.g. a `right`) is dropped before the block ever reaches
 * the plugin. The head is parsed by hand rather than with `parseYaml` so this
 * module stays free of the `obsidian` runtime and is trivially unit-testable.
 */

import { splitFenceBody } from "lib/utils/fence-split";

export type FigureAlign = "right" | "left" | "center" | "full";

export interface FigureBlock {
  /** Diagram engine. Only `mermaid` is supported today. */
  engine: "mermaid";
  /** Float / placement of the figure relative to the body prose. */
  align: FigureAlign;
  /** Optional CSS width (e.g. "40%", "320px") driving the float column width. */
  width?: string;
  /** Optional markdown caption rendered as a <figcaption>. */
  caption?: string;
  /** The diagram source fed to the mermaid renderer. */
  source: string;
}

const VALID_ALIGN: readonly FigureAlign[] = ["right", "left", "center", "full"];

/** Parse the small `key: value` config head into a flat string map. */
function parseConfigHead(head: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of head.split("\n")) {
    const m = line.match(/^([A-Za-z][\w-]*)\s*:\s*(.*)$/);
    if (!m) continue;
    let value = m[2].trim();
    // Strip a single layer of matching surrounding quotes.
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    out[m[1].toLowerCase()] = value;
  }
  return out;
}

/** Normalise a width value: a bare number → percentage; otherwise pass through. */
function normalizeWidth(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  const t = raw.trim();
  if (!t) return undefined;
  if (/^\d+(?:\.\d+)?$/.test(t)) return `${t}%`;
  return t;
}

export function parseFigureBlock(source: string): FigureBlock {
  const { yaml, text } = splitFenceBody(source);

  // No `---` separator → the whole body is the diagram, with no config head.
  const hasConfig = text !== undefined;
  const diagram = (hasConfig ? text : yaml) ?? "";
  const cfg = hasConfig ? parseConfigHead(yaml) : {};

  const rawAlign = (cfg.align ?? "right").toLowerCase();
  const normalizedAlign = rawAlign === "centre" ? "center" : rawAlign;
  const align: FigureAlign = (VALID_ALIGN as readonly string[]).includes(normalizedAlign)
    ? (normalizedAlign as FigureAlign)
    : "right";

  const width = normalizeWidth(cfg.width);
  const caption = cfg.caption && cfg.caption.trim() ? cfg.caption.trim() : undefined;

  return { engine: "mermaid", align, width, caption, source: diagram.trim() };
}
