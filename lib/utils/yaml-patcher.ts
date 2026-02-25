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

    let parsed: Record<string, unknown>;
    try {
      parsed = (parseYaml(yamlSource) as Record<string, unknown>) ?? {};
    } catch {
      parsed = {};
    }

    parsed[key] = value;

    const newYaml = stringifyYaml(parsed).replace(/\n$/, "");
    const newLines = [
      ...lines.slice(0, lineStart + 1),
      ...newYaml.split("\n"),
      ...lines.slice(lineEnd),
    ];
    return newLines.join("\n");
  });
}
