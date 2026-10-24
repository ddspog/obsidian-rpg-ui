#!/usr/bin/env node
// Runs real Obsidian headless (Xvfb + Electron) so the built plugin can be
// screenshotted in cloud sessions where no desktop Obsidian exists.
//
//   node scripts/cloud-obsidian.mjs prepare   (optional: pre-download Obsidian + fonts)
//   node scripts/cloud-obsidian.mjs start
//   node scripts/cloud-obsidian.mjs screenshot "Sandbox/Tests/03-TEST-SKILLS.md" out.png ["Heading to scroll to"]
//   node scripts/cloud-obsidian.mjs stop
//
// `start` copies the vault ($RPG_VAULT_ROOT) into ~/.cache/rpg-obsidian/work so the
// real vault is never touched, and installs main.js/manifest.json/styles.css/esbuild.wasm
// from the plugin root, plus the theme in $THEME_DIR if set (the vault's
// appearance.json picks which theme is active; open fonts stand in for the
// theme's macOS fonts, see FONT_ROLES). Run `npm run build` first to test current code.
import { spawn, execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OBSIDIAN_VERSION = process.env.OBSIDIAN_VERSION ?? "1.8.10";
const CDP_PORT = process.env.CDP_PORT ?? "9222";
const PLUGIN_ID = "dnd-ui-toolkit";
// Optional checkout of an Obsidian theme repo (needs manifest.json + theme.css).
const THEME_DIR = process.env.THEME_DIR;
// The cloud has none of the macOS fonts the theme asks for (New York, SF Compact).
// The theme tries "My <role> font" first, so those names are mapped to open fonts
// from @fontsource (npm). Override with FONT_SERIF / FONT_SANS / FONT_ROUNDED.
const FONT_ROLES = [
  {
    id: process.env.FONT_SERIF ?? "source-serif-4",
    names: ["Text", "Headings", "Letter", "Quote"],
    weights: [400, 600, 700],
    italic: [400, 700],
  },
  { id: process.env.FONT_SANS ?? "inter", names: ["Title"], weights: [400, 500, 600, 700], italic: [] },
  { id: process.env.FONT_ROUNDED ?? "nunito", names: ["Table"], weights: [400, 600, 700], italic: [400] },
];

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vaultRoot = process.env.RPG_VAULT_ROOT ?? path.resolve(pluginRoot, "../..");
const cache = path.join(os.homedir(), ".cache", "rpg-obsidian");
const work = path.join(cache, "work");
const appDir = path.join(cache, `obsidian-${OBSIDIAN_VERSION}`);
const vaultCopy = path.join(work, "vault");
const pidFile = path.join(work, "obsidian.pid");

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  for (const p of ["playwright", "/opt/node-tools/node_modules/playwright"]) {
    try {
      return require(p);
    } catch {
      // try next location
    }
  }
  throw new Error("playwright not found (expected in the cloud image)");
}

async function connect() {
  const browser = await loadPlaywright().chromium.connectOverCDP(`http://localhost:${CDP_PORT}`);
  return { browser, page: browser.contexts()[0].pages()[0] };
}

function ensureObsidian() {
  const bin = path.join(appDir, "squashfs-root", "obsidian");
  if (fs.existsSync(bin)) return bin;
  fs.mkdirSync(appDir, { recursive: true });
  const url = `https://github.com/obsidianmd/obsidian-releases/releases/download/v${OBSIDIAN_VERSION}/Obsidian-${OBSIDIAN_VERSION}.AppImage`;
  const image = path.join(appDir, "Obsidian.AppImage");
  console.log(`Downloading ${url}`);
  execFileSync("curl", ["-sSfL", "-o", image, url], { stdio: "inherit" });
  fs.chmodSync(image, 0o755);
  // Extract instead of mounting: FUSE is not available in the container.
  execFileSync(image, ["--appimage-extract"], { cwd: appDir, stdio: "ignore" });
  return bin;
}

// Downloads the font packages once (cached under ~/.cache/rpg-obsidian/fonts).
function ensureFonts() {
  const fontsDir = path.join(cache, "fonts");
  fs.mkdirSync(fontsDir, { recursive: true });
  const pkgs = FONT_ROLES.map((r) => `@fontsource/${r.id}`);
  const missing = pkgs.filter((p) => !fs.existsSync(path.join(fontsDir, "node_modules", p)));
  if (missing.length) {
    console.log(`Installing fonts: ${missing.join(", ")}`);
    execFileSync("npm", ["install", "--prefix", fontsDir, "--no-audit", "--no-fund", "--no-save", ...missing], {
      stdio: "inherit",
    });
  }
  return fontsDir;
}

// Writes a CSS snippet (fonts embedded as data URIs) into the vault copy and enables it.
function installFonts() {
  const fontsDir = ensureFonts();
  let css = "";
  for (const { id, names, weights, italic } of FONT_ROLES) {
    const faces = [...weights.map((w) => [w, "normal"]), ...italic.map((w) => [w, "italic"])];
    for (const [weight, style] of faces) {
      const file = path.join(
        fontsDir,
        "node_modules",
        "@fontsource",
        id,
        "files",
        `${id}-latin-${weight}-${style}.woff2`
      );
      if (!fs.existsSync(file)) {
        console.warn(`Font file missing, skipped: ${path.basename(file)}`);
        continue;
      }
      const data = fs.readFileSync(file).toString("base64");
      for (const name of names) {
        css += `@font-face{font-family:"My ${name} font";font-weight:${weight};font-style:${style};src:url(data:font/woff2;base64,${data}) format("woff2");}\n`;
      }
    }
  }
  const obsidianDir = path.join(vaultCopy, ".obsidian");
  fs.mkdirSync(path.join(obsidianDir, "snippets"), { recursive: true });
  fs.writeFileSync(path.join(obsidianDir, "snippets", "cloud-fonts.css"), css);
  const appearanceFile = path.join(obsidianDir, "appearance.json");
  const appearance = fs.existsSync(appearanceFile) ? JSON.parse(fs.readFileSync(appearanceFile, "utf8")) : {};
  appearance.enabledCssSnippets = [...new Set([...(appearance.enabledCssSnippets ?? []), "cloud-fonts"])];
  fs.writeFileSync(appearanceFile, JSON.stringify(appearance, null, 2));
}

function prepareVault() {
  fs.rmSync(vaultCopy, { recursive: true, force: true });
  fs.mkdirSync(vaultCopy, { recursive: true });
  execFileSync(
    "sh",
    [
      "-c",
      'tar --exclude=.git --exclude=.obsidian/plugins/obsidian-rpg-ui -cf - . | tar -xf - -C "$1"',
      "sh",
      vaultCopy,
    ],
    { cwd: vaultRoot, stdio: "inherit" }
  );
  // Obsidian loads plugins by manifest id, so install under that folder name.
  const dest = path.join(vaultCopy, ".obsidian", "plugins", PLUGIN_ID);
  fs.mkdirSync(dest, { recursive: true });
  // esbuild.wasm compiles the TypeScript system configs; without it rule views
  // such as `.tab()` are "not registered".
  for (const f of ["main.js", "manifest.json", "styles.css", "esbuild.wasm"]) {
    fs.copyFileSync(path.join(pluginRoot, f), path.join(dest, f));
  }
  // The real vault keeps its folder -> system mappings in the plugin's (gitignored)
  // data.json. Seed one per top-level folder with a config/index.ts, so rule views
  // such as `.tab()` resolve in the copy.
  const dataJson = path.join(dest, "data.json");
  if (!fs.existsSync(dataJson)) {
    const systemMappings = fs
      .readdirSync(vaultCopy, { withFileTypes: true })
      .filter((d) => d.isDirectory() && fs.existsSync(path.join(vaultCopy, d.name, "config", "index.ts")))
      .map((d) => ({ folderPaths: [d.name], systemFolderPath: `${d.name}/config` }));
    fs.writeFileSync(dataJson, JSON.stringify({ systemMappings }));
  }
  if (THEME_DIR) {
    const { name } = JSON.parse(fs.readFileSync(path.join(THEME_DIR, "manifest.json"), "utf8"));
    const themeDest = path.join(vaultCopy, ".obsidian", "themes", name);
    fs.mkdirSync(themeDest, { recursive: true });
    for (const f of ["manifest.json", "theme.css"]) {
      fs.copyFileSync(path.join(THEME_DIR, f), path.join(themeDest, f));
    }
    if (process.env.CLOUD_FONTS !== "0") installFonts();
  }
}

// First runs leave a settings modal and an "Indexing vault" toast over the note.
async function clearOverlays(page) {
  for (let i = 0; i < 5 && (await page.locator(".modal-container").count()) > 0; i++) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }
  await page
    .locator(".notice", { hasText: /Indexing vault/i })
    .waitFor({ state: "hidden", timeout: 30000 })
    .catch(() => {});
}

async function start() {
  const bin = ensureObsidian();
  fs.mkdirSync(work, { recursive: true });
  prepareVault();
  const config = path.join(work, "config");
  fs.mkdirSync(path.join(config, "obsidian"), { recursive: true });
  fs.writeFileSync(
    path.join(config, "obsidian", "obsidian.json"),
    JSON.stringify({ vaults: { rpgcloud0001: { path: vaultCopy, ts: 1, open: true } } })
  );
  const log = fs.openSync(path.join(work, "obsidian.log"), "w");
  const child = spawn(
    "xvfb-run",
    ["-a", "-s", "-screen 0 1600x1400x24", bin, "--no-sandbox", "--disable-gpu", `--remote-debugging-port=${CDP_PORT}`],
    {
      detached: true,
      stdio: ["ignore", log, log],
      env: { ...process.env, XDG_CONFIG_HOME: config, HOME: path.join(work, "home") },
    }
  );
  child.unref();
  fs.writeFileSync(pidFile, String(child.pid));

  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://localhost:${CDP_PORT}/json/version`);
      if (r.ok) break;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  const { browser, page } = await connect();

  // A vault's first open (per config dir) asks whether to trust its plugins.
  await page
    .getByRole("button", { name: /Trust author/i })
    .click({ timeout: 10000 })
    .catch(() => {});
  await page.waitForFunction(() => globalThis.app?.plugins?.plugins?.["dnd-ui-toolkit"], null, { timeout: 30000 });
  await clearOverlays(page);
  await browser.close();
  console.log(`Obsidian ready (CDP :${CDP_PORT}, vault copy ${vaultCopy})`);
}

async function screenshot(note, out, scrollTo) {
  if (!note || !out) throw new Error("usage: screenshot <note path in vault> <out.png> [text to scroll to]");
  const { browser, page } = await connect();
  const [vw, vh] = (process.env.VIEWPORT ?? "1600x1400").split("x").map(Number);
  await page.setViewportSize({ width: vw, height: vh });
  // The file explorer takes a fifth of the width; screenshots are of the note.
  // KEEP_SIDEBAR=1 leaves it open.
  if (process.env.KEEP_SIDEBAR !== "1") await page.evaluate(() => globalThis.app.workspace.leftSplit?.collapse());
  const found = await page.evaluate(async (f) => {
    const file = globalThis.app.vault.getAbstractFileByPath(f);
    if (file) await globalThis.app.workspace.getLeaf(false).openFile(file, { state: { mode: "preview" } });
    return !!file;
  }, note);
  if (!found) throw new Error(`Note not found in vault: ${note}`);
  await clearOverlays(page);
  await page.waitForTimeout(Number(process.env.WAIT_MS ?? 5000));
  if (scrollTo)
    await page.locator(".markdown-preview-view:visible").getByText(scrollTo).first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: out });
  await browser.close();
  console.log(`Saved ${out}`);
}

function stop() {
  if (!fs.existsSync(pidFile)) return console.log("Not running");
  try {
    process.kill(-Number(fs.readFileSync(pidFile, "utf8")), "SIGTERM");
  } catch {
    // already gone
  }
  fs.rmSync(pidFile);
  console.log("Stopped");
}

const [cmd, ...rest] = process.argv.slice(2);
// Downloads everything `start` needs, without launching Obsidian.
function prepare() {
  ensureObsidian();
  if (THEME_DIR && process.env.CLOUD_FONTS !== "0") ensureFonts();
  console.log("cloud-obsidian ready: run `start`");
}

const commands = { prepare, start, screenshot: () => screenshot(...rest), stop };
if (!commands[cmd]) {
  console.log("usage: cloud-obsidian.mjs <prepare | start | screenshot <note> <out.png> | stop>");
  process.exit(cmd ? 1 : 0);
}
await commands[cmd]();
