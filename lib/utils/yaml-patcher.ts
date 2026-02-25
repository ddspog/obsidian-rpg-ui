import { App, parseYaml, stringifyYaml, TFile } from "obsidian";

/**
 * Patches a single top-level key in a YAML code block inside a vault file.
 *
 * @param app         Obsidian App instance
 * @param sourcePath  Vault-relative path to the file
 * @param lineStart   0-based line of the opening code fence (``` rpg ...)
 * @param lineEnd     0-based line of the closing code fence (```)
 * @param key         Top-level YAML key to update
 * @param value       New value for that key
 */
export async function patchYamlBlock(
  app: App,
  sourcePath: string,
  lineStart: number,
  lineEnd: number,
  key: string,
  value: unknown,
): Promise<void> {
  const file = app.vault.getAbstractFileByPath(sourcePath);
  if (!(file instanceof TFile)) return;

  await (app.vault as any).process(file, (content: string) => {
    const lines = content.split("\n");
    // lines[lineStart] is the opening fence; lines[lineEnd] is the closing fence
    const bodyLines = lines.slice(lineStart + 1, lineEnd);
    const yamlSource = bodyLines.join("\n");

    // We will update only the single top-level key in the YAML source to
    // avoid reserializing the whole block and thereby losing wikilink or
    // formatting nuances in other keys.
    let parsed: Record<string, unknown> = {};
    try {
      parsed = (parseYaml(yamlSource) as Record<string, unknown>) ?? {};
    } catch {
      parsed = {};
    }

    // Helper to serialize the new value into YAML fragment for the key
    const serializeForKey = (k: string, v: unknown): string[] => {
      // For objects/arrays, stringifyYaml(v) returns a multi-line block;
      // we indent its lines under `k:` to produce a valid YAML fragment.
      if (v !== null && typeof v === "object") {
        const serialized = stringifyYaml(v).replace(/\n$/, "");
        const indented = serialized.split("\n").map((l) => `  ${l}`);
        return [`${k}:`, ...indented];
      }
      // Primitive values can be rendered inline
      const prim = stringifyYaml(v).replace(/\n$/, "");
      const firstLine = prim.split("\n")[0] ?? "";
      return [`${k}: ${firstLine}`];
    };

    // Find the index of the top-level key within the body lines (allow optional
    // leading whitespace). Escape the key for use in the RegExp.
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const keyRegex = new RegExp(`^\\s*${escapedKey}\\s*:`);
    let start = -1;
    for (let i = 0; i < bodyLines.length; i++) {
      if (keyRegex.test(bodyLines[i])) {
        start = i;
        break;
      }
    }

    const replacementLines = serializeForKey(key, value);

    if (start === -1) {
      // Key not present — append to the end of the YAML body
      const newBody = bodyLines.concat(replacementLines);
      const newLines = [...lines.slice(0, lineStart + 1), ...newBody, ...lines.slice(lineEnd)];
      return newLines.join("\n");
    }

    // Find the end of this key's block: next top-level line (no leading space) or end
    let end = bodyLines.length;
    for (let j = start + 1; j < bodyLines.length; j++) {
      if (/^\S/.test(bodyLines[j])) {
        end = j;
        break;
      }
    }

    const newBodyLines = [...bodyLines.slice(0, start), ...replacementLines, ...bodyLines.slice(end)];
    const newLines = [...lines.slice(0, lineStart + 1), ...newBodyLines, ...lines.slice(lineEnd)];
    return newLines.join("\n");
  });
}
