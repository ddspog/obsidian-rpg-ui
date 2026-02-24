/**
 * Minimal Obsidian API shim for use in Node.js bundled scripts.
 * Provides the same `FrontMatterInfo` shape as the real Obsidian API.
 *
 * FrontMatterInfo:
 *   exists       — whether a frontmatter block was found
 *   frontmatter  — the raw YAML string between the --- delimiters
 *   from         — start index of the YAML content (after opening ---)
 *   to           — end index of the YAML content (before closing ---)
 *   contentStart — index where the document body starts (after closing ---)
 */
function getFrontMatterInfo(content) {
  if (!content || !content.startsWith("---")) {
    return { exists: false, frontmatter: "", from: 0, to: 0, contentStart: 0 };
  }

  // Opening --- must be followed by a newline
  const openEnd = content.indexOf("\n");
  if (openEnd === -1) {
    return { exists: false, frontmatter: "", from: 0, to: 0, contentStart: 0 };
  }

  // Find the closing --- on its own line
  const closeStart = content.indexOf("\n---", openEnd);
  if (closeStart === -1) {
    return { exists: false, frontmatter: "", from: 0, to: 0, contentStart: 0 };
  }

  const from = openEnd + 1;                  // start of YAML body
  const to = closeStart;                     // end of YAML body
  const closeLineEnd = content.indexOf("\n", closeStart + 1);
  const contentStart = closeLineEnd === -1 ? content.length : closeLineEnd + 1;

  return {
    exists: true,
    frontmatter: content.slice(from, to),
    from,
    to,
    contentStart,
  };
}

/** Minimal Vault stub – only the methods used by wiki-file.ts need to exist. */
class Vault {}

module.exports = { getFrontMatterInfo, Vault };
