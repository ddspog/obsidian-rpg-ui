import { execFileSync } from "node:child_process";

const OBSIDIAN_BIN = "/Applications/Obsidian.app/Contents/MacOS/obsidian";
const DEFAULT_VAULT = "testing-vault";

export function obsidian(args, { vault = DEFAULT_VAULT, timeout = 15000 } = {}) {
  const fullArgs = [`vault=${vault}`, ...args];
  try {
    const result = execFileSync(OBSIDIAN_BIN, fullArgs, {
      encoding: "utf8",
      timeout,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return result.trim();
  } catch (err) {
    if (err.stdout) return err.stdout.trim();
    throw new Error(`obsidian ${fullArgs.join(" ")} failed: ${err.message}`);
  }
}

export function evalCode(code, vault = DEFAULT_VAULT) {
  const raw = obsidian(["eval", `code=${code}`], { vault, timeout: 30000 });
  const marker = raw.indexOf("\n=> ");
  if (marker !== -1) return raw.slice(marker + 4);
  if (raw.startsWith("=> ")) return raw.slice(3);
  return raw;
}

export function openFile(path, vault = DEFAULT_VAULT) {
  return obsidian(["open", `path=${path}`], { vault });
}

export function reload(vault = DEFAULT_VAULT) {
  return obsidian(["command", "id=app:reload"], { vault });
}

export function reloadPlugin(vault = DEFAULT_VAULT) {
  return obsidian(["command", "id=dnd-ui-toolkit:rpg-ui-reload"], { vault });
}

export function command(id, vault = DEFAULT_VAULT) {
  return obsidian(["command", `id=${id}`], { vault });
}

export function devDebug(on, vault = DEFAULT_VAULT) {
  return obsidian(["dev:debug", on ? "on" : "off"], { vault });
}

export function devConsole(vault = DEFAULT_VAULT, { clear, limit, level } = {}) {
  const args = ["dev:console"];
  if (clear) args.push("clear");
  if (limit) args.push(`limit=${limit}`);
  if (level) args.push(`level=${level}`);
  return obsidian(args, { vault });
}

export function devCss(selector, vault = DEFAULT_VAULT) {
  return obsidian(["dev:css", `selector=${selector}`], { vault });
}

export function devDom(selector, vault = DEFAULT_VAULT, { all, text, inner } = {}) {
  const args = ["dev:dom", `selector=${selector}`];
  if (all) args.push("all");
  if (text) args.push("text");
  if (inner) args.push("inner");
  return obsidian(args, { vault });
}

export function screenshot(path, vault = DEFAULT_VAULT) {
  return obsidian(["dev:screenshot", `path=${path}`], { vault });
}
