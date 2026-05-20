import { MarkdownRenderChild } from "obsidian";
import * as React from "react";
import * as ReactDOM from "react-dom/client";
import type { TableDef } from "./types";
import { RpgTable } from "lib/components/rpg-table";

export class RpgTableRenderChild extends MarkdownRenderChild {
  private root: ReactDOM.Root | null = null;

  constructor(
    el: HTMLElement,
    private readonly def: TableDef,
    private readonly sourcePath: string
  ) {
    super(el);
    // Use legacy synchronous render for the initial mount so the DOM is
    // populated BEFORE Obsidian's post-processors scan for @[[refs]].
    // eslint-disable-next-line react/no-deprecated
    (ReactDOM as any).render(
      <RpgTable def={this.def} filePath={this.sourcePath} sourcePath={this.sourcePath} />,
      el
    );
  }

  onunload(): void {
    // eslint-disable-next-line react/no-deprecated
    (ReactDOM as any).unmountComponentAtNode(this.containerEl);
  }
}
