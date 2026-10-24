import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { chromium } from "playwright-core";

export interface ScreenshotOptions {
  width?: number;
  /** "dark" matches Obsidian's `.theme-dark`; default is light. */
  theme?: "light" | "dark";
  /** Chromium binary; defaults to PLAYWRIGHT_CHROMIUM_PATH, the sandbox one, or Playwright's own. */
  executablePath?: string;
}

const DEFAULT_CHROMIUM = "/opt/pw-browsers/chromium";

/**
 * Renders HTML produced by a render test with the plugin's styles.css in headless Chromium
 * and writes a PNG. Obsidian's own theme variables are not available, so colours fall back
 * to whatever styles.css defines; this is for layout checks, not pixel-exact theming.
 */
export async function screenshotHtml(html: string, outPath: string, options: ScreenshotOptions = {}): Promise<string> {
  const css = readFileSync(resolve(process.cwd(), "styles.css"), "utf8");
  const theme = options.theme ?? "light";
  const page = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head>
<body class="theme-${theme}" style="margin:16px;font-family:sans-serif"><div class="markdown-rendered">${html}</div></body></html>`;

  const browser = await chromium.launch({
    executablePath: options.executablePath ?? process.env.PLAYWRIGHT_CHROMIUM_PATH ?? preinstalledChromium(),
  });
  try {
    const tab = await browser.newPage({ viewport: { width: options.width ?? 800, height: 600 } });
    await tab.setContent(page);
    const target = resolve(process.cwd(), outPath);
    mkdirSync(dirname(target), { recursive: true });
    await tab.screenshot({ path: target, fullPage: true });
    return target;
  } finally {
    await browser.close();
  }
}

/** The cloud sandbox's Chromium; undefined lets Playwright use its own downloaded browser. */
function preinstalledChromium(): string | undefined {
  return existsSync(DEFAULT_CHROMIUM) ? DEFAULT_CHROMIUM : undefined;
}
