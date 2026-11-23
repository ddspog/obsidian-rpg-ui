/**
 * Where an encounter catalog lives and how it is read and written. A catalog is
 * a vault note kept on disk: it is read straight from the file (the boot's
 * `FsVault` caches texts and never sees a note this run writes) and written only
 * through `writeNote`, which backs the old text up first.
 */

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { CATALOG_TYPE, parseCatalog, serializeCatalog, type Catalog } from "lib/domains/encounter-catalog/catalog";
import { kebab } from "lib/domains/encounter-catalog/table-source";
import type { Ctx } from "../app";
import { readNote, writeNote } from "../write";
import { UsageError } from "./flags";

/** The folder, inside a system's folder, that holds its encounter catalogs. */
const CATALOG_SUBFOLDER = "gm-tools/encounter-catalog";

/** The first path segment of a vault path: the system folder ("tales-of-the-valiant"), or "" for a root note. */
export function systemFolderOf(path: string): string {
  const parts = path.split("/");
  return parts.length > 1 ? parts[0] : "";
}

/** The default folder of a system's catalogs. */
function catalogFolder(systemFolder: string): string {
  return systemFolder ? `${systemFolder}/${CATALOG_SUBFOLDER}` : CATALOG_SUBFOLDER;
}

/** The default catalog note of a party, e.g. `tales-of-the-valiant/gm-tools/encounter-catalog/the-ashen-four.md`. */
export function defaultCatalogPath(systemFolder: string, partyName: string): string {
  const stem = kebab(partyName);
  if (!stem) throw new UsageError(`The party name "${partyName}" has no letters or digits to name a file from.`);
  return `${catalogFolder(systemFolder)}/${stem}.md`;
}

const looksLikePath = (value: string): boolean => value.includes("/") || /\.md$/i.test(value);

/** A vault-relative note path as typed: no leading `./` or `/`, `.md` added. */
function normalisePath(value: string): string {
  const clean = value.replace(/^\.?\/+/, "").replace(/\\/g, "/");
  return /\.md$/i.test(clean) ? clean : `${clean}.md`;
}

/**
 * Every catalog note of the vault, as vault paths, sorted: the notes of type
 * `encounter-catalog` under any `<folder>/gm-tools/encounter-catalog/`. Read from disk.
 */
export function findCatalogs(root: string): string[] {
  const found: string[] = [];
  for (const top of readdirSync(root, { withFileTypes: true })) {
    if (!top.isDirectory() || top.name.startsWith(".")) continue;
    const folder = catalogFolder(top.name);
    if (!existsSync(join(root, folder))) continue;
    for (const name of readdirSync(join(root, folder))) {
      if (!/\.md$/i.test(name)) continue;
      const path = `${folder}/${name}`;
      const text = readNote(root, path);
      if (text !== null && new RegExp(`^type:\\s*${CATALOG_TYPE}\\s*$`, "m").test(text.slice(0, 2000)))
        found.push(path);
    }
  }
  return found.sort();
}

const stem = (path: string): string => (path.split("/").pop() ?? path).replace(/\.md$/i, "");

const NONE_FOUND =
  'No encounter catalog found. Make one with `rpg sim catalog init --party-name "<name>"`, or pass --catalog <path>.';

/**
 * The catalog note a command works on: `--catalog` as a vault path, or as a party
 * name (matched against the catalogs there are); without it, the one catalog the
 * vault has. Zero or several is a usage error that says what to pass.
 */
export function resolveCatalogPath(ctx: Ctx, flag: string | undefined): string {
  const found = findCatalogs(ctx.root);
  if (flag !== undefined) {
    if (looksLikePath(flag)) return normalisePath(flag);
    const wanted = kebab(flag);
    const match = found.filter((p) => stem(p) === wanted || stem(p).toLowerCase() === flag.toLowerCase());
    if (match.length === 1) return match[0];
    if (match.length > 1) {
      throw new UsageError(`--catalog "${flag}" is ambiguous (${match.join(", ")}); pass the path.`);
    }
    throw new UsageError(
      `--catalog "${flag}" names no catalog${found.length > 0 ? ` (there are: ${found.join(", ")})` : ""}. ${NONE_FOUND}`
    );
  }
  if (found.length === 1) return found[0];
  if (found.length === 0) throw new UsageError(NONE_FOUND);
  throw new UsageError(`The vault has several catalogs (${found.join(", ")}); pass --catalog <path or party name>.`);
}

/** Like `resolveCatalogPath`, but `undefined` instead of an error when no one catalog is meant (a dry run needs none). */
export function maybeCatalogPath(ctx: Ctx, flag: string | undefined): string | undefined {
  try {
    const path = resolveCatalogPath(ctx, flag);
    return readNote(ctx.root, path) === null ? undefined : path;
  } catch (error) {
    if (error instanceof UsageError) return undefined;
    throw error;
  }
}

/** The catalog at a vault path. A missing note is a usage error (run init); a malformed one throws naming it. */
export function loadCatalog(ctx: Ctx, path: string): Catalog {
  const text = readNote(ctx.root, path);
  if (text === null) {
    throw new UsageError(`No catalog at "${path}". Make one with \`rpg sim catalog init --party-name "<name>"\`.`);
  }
  try {
    return parseCatalog(text);
  } catch (error) {
    throw new Error(`Catalog "${path}": ${(error as Error).message}`);
  }
}

/** Writes the catalog note (the old text is backed up under `.rpg-backups/cli` first). */
export function saveCatalog(ctx: Ctx, path: string, catalog: Catalog): void {
  writeNote(ctx.root, path, serializeCatalog(catalog));
}

export const catalogExists = (ctx: Ctx, path: string): boolean => existsSync(join(ctx.root, path));
