/**
 * Split a fence body on the first standalone `---` line into a YAML
 * head and a markdown body. If no separator is found, the entire body
 * is treated as YAML (backwards compatible).
 *
 * The markdown body (if any) is stored under a standard `text` key in
 * the returned object so all rpg blocks share the same convention.
 */

export interface FenceSplit {
  yaml: string;
  text: string | undefined;
}

export function splitFenceBody(source: string): FenceSplit {
  const lines = source.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      return {
        yaml: lines.slice(0, i).join("\n"),
        text: lines.slice(i + 1).join("\n").replace(/^\n+/, "").replace(/\n+$/, "") || undefined,
      };
    }
  }
  return { yaml: source, text: undefined };
}

/**
 * Strip all `rpg <entity>.<block>` fences from a markdown body.
 * Fences that have a `---` separator get their body text (after `---`)
 * preserved inline; fences without a separator are removed entirely.
 *
 * Handles nested fences by matching opening/closing backtick counts
 * (a closing fence must have >= the same number of backticks as its opener).
 */
export function stripRpgFences(source: string): string {
  const openRe = /^(`{3,})\s*rpg\s+[A-Za-z_][\w-]*\.[A-Za-z_][\w-]*\s*$/gm;
  const replacements: Array<{ start: number; end: number; body: string }> = [];

  let m: RegExpExecArray | null;
  while ((m = openRe.exec(source)) !== null) {
    const minLen = m[1].length;
    const bodyStart = m.index + m[0].length + 1;
    const closeRe = new RegExp(`^\`{${minLen},}\\s*$`, "m");
    const rest = source.slice(bodyStart);
    const closeMatch = closeRe.exec(rest);
    if (!closeMatch) continue;

    const rawBody = rest.slice(0, closeMatch.index);
    const fenceEnd = bodyStart + closeMatch.index + closeMatch[0].length;

    const sepIdx = rawBody.indexOf("\n---\n");
    let body = "";
    if (sepIdx >= 0) {
      body = rawBody.slice(sepIdx + 5).replace(/^\n+/, "").replace(/\n+$/, "");
    }
    replacements.push({ start: m.index, end: fenceEnd, body });

    openRe.lastIndex = fenceEnd;
  }

  if (replacements.length === 0) return source;

  let result = "";
  let cursor = 0;
  for (const r of replacements) {
    result += source.slice(cursor, r.start);
    if (r.body) result += r.body;
    cursor = r.end;
    if (source[cursor] === "\n") cursor++;
    if (r.body && cursor < source.length) result += "\n";
  }
  result += source.slice(cursor);
  return result;
}
