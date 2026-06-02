import { App, parseYaml, stringifyYaml, TFile } from "obsidian";

/**
 * Patches a single top-level key in a YAML code block inside a vault file.
 *
 * The fence is located dynamically by scanning the file for the opening
 * code fence whose info string matches `entity.block` (e.g.
 * `rpg character.features`). The previous version relied on cached line
 * numbers from `MarkdownSectionInformation`, which went stale the moment
 * a YAML patch grew the file — subsequent patches landed outside the
 * intended block. Locating the fence each call keeps every write
 * authoritative.
 *
 * Falls back to the supplied `lineStart` / `lineEnd` when the file
 * happens to have multiple matching fences and the caller's hints are
 * still inside one of them; that lets two character sheets in one file
 * (rare) keep working.
 *
 * @param app         Obsidian App instance
 * @param sourcePath  Vault-relative path to the file
 * @param entity      Entity prefix (e.g. `"character"`)
 * @param block       Block name (e.g. `"features"`)
 * @param key         Top-level YAML key to update
 * @param value       New value for that key
 * @param hint        Optional cached `{ lineStart, lineEnd }` from
 *                    `MarkdownSectionInformation` — used as a tiebreaker
 *                    when several fences in the same file share the tag.
 */
export async function patchYamlBlock(
  app: App,
  sourcePath: string,
  entity: string,
  block: string,
  key: string,
  value: unknown,
  hint?: { lineStart: number; lineEnd: number }
): Promise<void> {
  const file = app.vault.getAbstractFileByPath(sourcePath);
  if (!(file instanceof TFile)) return;

  await (app.vault as any).process(file, (content: string) => {
    const lines = content.split("\n");
    const fences = findFences(lines, `rpg ${entity}.${block}`);
    if (fences.length === 0) return content;

    // Prefer the fence whose bounds enclose the hint's lineStart (so a
    // file with two `rpg character.features` blocks targets the right
    // one). When no hint is supplied or no fence matches, default to the
    // first occurrence — character sheets typically have one block per
    // entity.
    let chosen = fences[0];
    if (hint) {
      const match = fences.find((f) => hint.lineStart >= f.openLine && hint.lineStart <= f.closeLine);
      if (match) chosen = match;
    }

    const { openLine, closeLine } = chosen;
    const bodyLines = lines.slice(openLine + 1, closeLine);
    const yamlSource = bodyLines.join("\n");

    let parsed: Record<string, unknown> = {};
    try {
      parsed = (parseYaml(yamlSource) as Record<string, unknown>) ?? {};
    } catch {
      parsed = {};
    }

    const serializeForKey = (k: string, v: unknown): string[] => {
      if (v !== null && typeof v === "object") {
        const serialized = stringifyYaml(v).replace(/\n$/, "");
        const indented = serialized.split("\n").map((l) => `  ${l}`);
        return [`${k}:`, ...indented];
      }
      const prim = stringifyYaml(v).replace(/\n$/, "");
      const firstLine = prim.split("\n")[0] ?? "";
      return [`${k}: ${firstLine}`];
    };

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
      const newBody = bodyLines.concat(replacementLines);
      const newLines = [...lines.slice(0, openLine + 1), ...newBody, ...lines.slice(closeLine)];
      return newLines.join("\n");
    }

    let end = bodyLines.length;
    for (let j = start + 1; j < bodyLines.length; j++) {
      if (/^\S/.test(bodyLines[j])) {
        end = j;
        break;
      }
    }

    const newBodyLines = [...bodyLines.slice(0, start), ...replacementLines, ...bodyLines.slice(end)];
    const newLines = [...lines.slice(0, openLine + 1), ...newBodyLines, ...lines.slice(closeLine)];
    return newLines.join("\n");
  });
}

/** Find every fenced code block whose info string matches `infoTag`
 *  (e.g. `rpg character.features`). Returns each as `{ openLine, closeLine }`
 *  with 0-based line indices for the opening and closing fences. */
function findFences(lines: string[], infoTag: string): Array<{ openLine: number; closeLine: number }> {
  const out: Array<{ openLine: number; closeLine: number }> = [];
  // The info string follows the opening backticks. Allow any number of
  // backticks ≥ 3, plus optional trailing whitespace after the tag.
  const openRe = new RegExp(`^\\s*\`{3,}${escapeRegExp(infoTag)}\\s*$`);
  for (let i = 0; i < lines.length; i++) {
    if (!openRe.test(lines[i])) continue;
    // Find the matching closing fence — first line after `i` that's just
    // backticks (≥ 3, optional trailing whitespace).
    for (let j = i + 1; j < lines.length; j++) {
      if (/^\s*`{3,}\s*$/.test(lines[j])) {
        out.push({ openLine: i, closeLine: j });
        i = j; // skip past this fence so we don't double-match
        break;
      }
    }
  }
  return out;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
