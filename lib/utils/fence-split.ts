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
