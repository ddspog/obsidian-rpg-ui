/**
 * Resolve `${field}` template expressions in named parameter values
 * against a frontmatter record. Supports dot-path access (e.g. `${stats.hp}`).
 */

const TEMPLATE_RE = /\$\{([^}]+)\}/g;

export function interpolateParams(
  params: Record<string, unknown>,
  frontmatter: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && TEMPLATE_RE.test(value)) {
      TEMPLATE_RE.lastIndex = 0;
      out[key] = value.replace(TEMPLATE_RE, (_, path: string) => {
        const resolved = resolvePath(frontmatter, path.trim());
        return resolved != null ? String(resolved) : "";
      });
    } else {
      out[key] = value;
    }
  }
  return out;
}

function resolvePath(obj: Record<string, unknown>, path: string): unknown {
  let cur: unknown = obj;
  for (const key of path.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}
