/**
 * A card's name as its hotbar tile shows it: without the word its group already says, so the tile
 * has room for the words that tell cards apart. "Name Generator" reads "Name" under GENERATOR;
 * "Roll on Threads" reads "Threads" under LIST. The full name stays in the tile's tooltip.
 */
export function tileName(name: string, groupLabel?: string): string {
  // a source's small-caps mark (ᴬ, ᴰ…) after the name
  let out = name.replace(/\s*[ᴬᴮᴰᴴᴷᴺº]+$/u, "").trim();
  const word = groupLabel?.trim();
  if (word) {
    const stem = word.replace(/s$/i, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const shorter = out.replace(new RegExp(`\\s+${stem}s?$`, "i"), "");
    if (shorter && shorter !== out) out = shorter;
  }
  // Under a group's own name (Names, Worldbuilding), "Generator" is what every tile in it is
  if (word && !/generator/i.test(word)) out = out.replace(/\s+Generator$/i, "") || out;
  // "Roll on" is what every tile does
  const rolled = out.replace(/^Roll on\s+(?:the\s+)?/i, "");
  return rolled || out;
}
