/**
 * React renderer for `rpg figure.mermaid` — a floatable diagram figure.
 *
 * Mounted into a `MarkdownRenderChild` by the plugin's code-block dispatcher
 * (both the primary `rpg` processor in main.ts and the sub-render dispatcher
 * in process-rpg-fences.ts, so it renders identically inside `@[[file]].bare()`
 * embeds).
 *
 * The diagram source is re-wrapped as a ```mermaid fenced block and handed to
 * the shared `<Markdown>` component, which renders it through Obsidian's own
 * `MarkdownRenderer` — the same path every other body uses, so mermaid's SVG
 * is produced exactly as it would be for a top-level fence. This wrapper only
 * owns placement: the `<figure>` floats per the `align` config (see
 * figure-block.css), and the surrounding body prose wraps around it the way an
 * `![[image|right]]` embed does.
 */

import { MarkdownRenderChild } from "obsidian";
import * as React from "react";
import * as ReactDOM from "react-dom/client";
import { Markdown } from "lib/components/markdown";
import type { FigureBlock } from "./parse-figure-block";

function FigureView({ block, sourcePath }: { block: FigureBlock; sourcePath: string }) {
  const cls = ["rpg-figure", `rpg-figure--${block.align}`];
  const style: React.CSSProperties = {};
  if (block.width) (style as Record<string, string>)["--rpg-figure-w"] = block.width;

  if (!block.source.trim()) {
    return (
      <figure className={cls.join(" ")} data-rpg-figure={block.engine} style={style}>
        <div className="notice">rpg figure: empty diagram</div>
      </figure>
    );
  }

  // Re-fence the diagram so Obsidian's mermaid handler turns it into an SVG.
  const fenced = "```mermaid\n" + block.source + "\n```";

  return (
    <figure className={cls.join(" ")} data-rpg-figure={block.engine} style={style}>
      <Markdown source={fenced} sourcePath={sourcePath} className="rpg-figure__diagram" />
      {block.caption ? (
        <figcaption className="rpg-figure__caption">
          <Markdown source={block.caption} sourcePath={sourcePath} />
        </figcaption>
      ) : null}
    </figure>
  );
}

export class FigureRenderChild extends MarkdownRenderChild {
  private root: ReactDOM.Root | null = null;

  constructor(
    el: HTMLElement,
    private readonly block: FigureBlock,
    private readonly sourcePath: string
  ) {
    super(el);
  }

  onload(): void {
    this.root = ReactDOM.createRoot(this.containerEl);
    this.root.render(<FigureView block={this.block} sourcePath={this.sourcePath} />);
  }

  onunload(): void {
    if (this.root) {
      try {
        this.root.unmount();
      } catch (e) {
        console.error("rpg figure.*: unmount failed", e);
      }
      this.root = null;
    }
  }
}
