/**
 * The few POSIX path operations the system loader needs, without Node's `path`: Obsidian's phone app has no
 * Node modules, so `require("path")` hands back nothing there.
 */

/** Collapse `.`, `..` and repeated slashes, as `path.posix.normalize` does. */
export function normalize(p: string): string {
  if (p === "") return ".";
  const absolute = p.startsWith("/");
  const out: string[] = [];
  for (const part of p.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (out.length > 0 && out[out.length - 1] !== "..") out.pop();
      else if (!absolute) out.push("..");
    } else out.push(part);
  }
  const body = out.join("/");
  const trailing = p.endsWith("/") && body !== "" ? "/" : "";
  if (absolute) return `/${body}${trailing}`;
  return body === "" ? "." : `${body}${trailing}`;
}

/** The folder part of a path, as `path.posix.dirname` does. */
export function dirname(p: string): string {
  if (/^\/+$/.test(p)) return "/";
  const trimmed = p.replace(/\/+$/, "");
  const at = trimmed.lastIndexOf("/");
  if (at < 0) return ".";
  if (at === 0) return "/";
  return trimmed.slice(0, at);
}

/** Join and normalise, as `path.posix.join` does. */
export function join(...parts: string[]): string {
  const kept = parts.filter((x) => x !== "");
  return kept.length === 0 ? "." : normalize(kept.join("/"));
}
