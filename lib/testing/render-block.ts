import { App, MarkdownPostProcessorContext } from "obsidian";
import { App as MockApp } from "obsidian-test-mocks/obsidian";
import { BaseView } from "lib/views/BaseView";

export interface RenderBlockOptions {
  /** Frontmatter exposed through the metadata cache for `sourcePath`. */
  frontmatter?: Record<string, unknown>;
  sourcePath?: string;
  /** Extra vault files, as path -> content. */
  files?: Record<string, string>;
}

export interface RenderedBlock {
  el: HTMLElement;
  html: string;
}

type ViewCtor = new (app: App) => BaseView;

/** Let React effects and microtasks settle. */
async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

/**
 * Renders one code block through a real view, the way the markdown post-processor does,
 * and returns the resulting DOM. Children added through `ctx.addChild` are loaded.
 */
export async function renderBlock(
  View: ViewCtor,
  source: string,
  options: RenderBlockOptions = {}
): Promise<RenderedBlock> {
  const sourcePath = options.sourcePath ?? "test.md";
  const app = MockApp.createConfigured__({
    files: { [sourcePath]: "", ...options.files },
  }) as unknown as App;

  const frontmatter = options.frontmatter ?? {};
  app.metadataCache.getCache = (() => ({ frontmatter })) as typeof app.metadataCache.getCache;

  const ctx = {
    sourcePath,
    addChild: (child: { load: () => void }) => child.load(),
    getSectionInfo: () => null,
  } as unknown as MarkdownPostProcessorContext;

  const el = document.createElement("div");
  document.body.appendChild(el);
  new View(app).register(source, el, ctx);
  await settle();
  return { el, html: el.innerHTML };
}
