import type { Vault } from "obsidian";

/** A name as the icon folder is searched by: no source mark (`Douse Light ᴷ`), any case. */
const iconKey = (n: string) =>
  n
    .replace(/[ᴬᴮᴰᴴᴷᴺº]/gu, "")
    .trim()
    .toLowerCase();

/**
 * Hotbar icon art: an image named for a card (`Longbow.webp`, `Mystic
 * Mark.png`, `Maul loadout.webp`) in any folder called `Icons`. Returns a
 * lookup from a name to the image's resource URL, built once from the vault.
 */
export function buildIconIndex(vault: Vault): (name: string) => string | undefined {
  const index = new Map<string, string>();
  for (const f of vault.getFiles()) {
    if (!/^(png|webp|jpe?g|svg|gif)$/i.test(f.extension)) continue;
    if (!/(^|\/)icons\//i.test(f.path)) continue;
    index.set(iconKey(f.basename), vault.getResourcePath(f));
  }
  return (name) => index.get(iconKey(name));
}
