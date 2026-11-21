/**
 * Shared fixture helpers for the sim specs: a self-contained "fixture" system, a
 * `boot` whose system loader works under vitest, and note builders. Test-only.
 *
 *   initSystemLoader()   call once in a top-level `beforeAll` (bundles the system loader)
 *   makeCtx(root)        boots `root` as the CLI does, then swaps `ctx.systemFor` for a loader
 *                        that works under vitest
 *   FIXTURE_SYSTEM       written to `fixture/config/index.ts` of a temp vault
 *   pcNote / spellNote / put   markdown builders and a file writer
 */
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { build } from "esbuild";
import type { RPGSystem } from "lib/systems/types";
import { boot, type Ctx } from "../app";

/** What `ts-loader` exports, bundled for Node: its own `require`s only resolve inside a bundle. */
interface SystemLoader {
  loadSystemFromTypeScript(vault: unknown, folder: string): Promise<RPGSystem | null>;
}

let systemLoader: SystemLoader;

/** Call once, in a top-level `beforeAll` (it bundles the system loader; allow 120 s). */
export async function initSystemLoader(): Promise<void> {
  systemLoader = await bundleSystemLoader();
}

/** Bundle `lib/systems/ts-loader.ts` the way `npm run build:cli` does, and evaluate it. */
async function bundleSystemLoader(): Promise<SystemLoader> {
  const result = await build({
    entryPoints: [resolve(__dirname, "../../../lib/systems/ts-loader.ts")],
    bundle: true,
    platform: "node",
    format: "cjs",
    write: false,
    alias: { obsidian: resolve(__dirname, "../obsidian-node.ts") },
    loader: { ".css": "empty", ".md": "text" },
    external: ["esbuild", "esbuild-wasm"],
    logLevel: "silent",
  });
  const mod = { exports: {} as unknown };
  const require = createRequire(resolve(__dirname, "test-support.ts"));
  new Function("module", "exports", "require", "__dirname", result.outputFiles[0].text)(
    mod,
    mod.exports,
    require,
    __dirname
  );
  return mod.exports as SystemLoader;
}

/** `boot(root)` with a system loader that works in vitest (the registry's own cannot `require` the toolkit's .ts). */
export function makeCtx(root: string): Ctx {
  const ctx = boot(root);
  const loaded = new Map<string, RPGSystem | null>();
  ctx.systemFor = async (path: string) => {
    const folder = ctx.registry.findSystemFolderForFile(path);
    if (!folder) return null;
    if (!loaded.has(folder)) loaded.set(folder, await systemLoader.loadSystemFromTypeScript(ctx.vault, folder));
    return loaded.get(folder) ?? null;
  };
  return ctx;
}
export const FIXTURE_SYSTEM = `
import { CreateSystem } from "rpg-ui-toolkit";
const none = () => null;
export const system = CreateSystem({
  name: "Fixture",
  attributes: ["STR", "DEX", "CON", "INT", "WIS", "CHA"],
  entities: {
    character: {
      lookup: { $features: (header) => ({ sources: [], traits: {}, pendingChoices: [], casters: header?.casters ?? [] }) },
      blocks: { header: none, health: none, stats: none, spells: none },
      expressions: {
        CharacterLevel: (_, { blocks }) => blocks.header?.level ?? 1,
        ProficiencyBonus: (_, { expressions }) => Math.floor((expressions.CharacterLevel() - 1) / 4) + 2,
        Modifier: ([name], { blocks }) => {
          const score = blocks.stats?.[name === "Initiative" ? "DEX" : name];
          return typeof score === "number" ? Math.floor((score - 10) / 2) : undefined;
        },
        ModifierTotal: ([{ attribute, proficiency, bonus }], { expressions }) =>
          expressions.Modifier(attribute) + expressions.ProficiencyBonus() * proficiency + bonus,
        ArmorClass: (_, { blocks }) => blocks.health?.ac,
        HitPoints: (_, { blocks }) =>
          blocks.health?.max_hp === undefined ? undefined : { current: blocks.health.max_hp, max: blocks.health.max_hp },
        SpellSlots: ([source], { blocks }) => (blocks.header?.casters ?? []).find((c) => c.source === source)?.slots ?? [],
        SessionActions: (_, { blocks }) => blocks.header?.actions ?? [],
      },
    },
  },
});
`;

export interface FixturePc {
  name: string;
  level?: number;
  ac?: number;
  hp?: number;
  stats?: Record<string, number>;
  actions?: Array<Record<string, unknown>>;
  casters?: Array<{ source: string; ability: string; level: number; slots: number[] }>;
  /** The body of the `rpg character.spells` fence; undefined leaves the fence out. */
  spells?: string;
}

export const STATS = { STR: 10, DEX: 12, CON: 14, INT: 8, WIS: 16, CHA: 10 };

export function pcNote(pc: FixturePc): string {
  const header = { name: pc.name, level: pc.level ?? 1, actions: pc.actions ?? [], casters: pc.casters ?? [] };
  const health = { ...(pc.ac !== undefined ? { ac: pc.ac } : {}), ...(pc.hp !== undefined ? { max_hp: pc.hp } : {}) };
  const fence = (meta: string, body: string) => `\`\`\`rpg ${meta}\n${body}\n\`\`\`\n`;
  return [
    `# ${pc.name}\n`,
    fence("character.header", JSON.stringify(header)),
    fence("character.health", JSON.stringify(health)),
    fence("character.stats", JSON.stringify(pc.stats ?? STATS)),
    ...(pc.spells !== undefined ? [`\`\`\`rpg character.spells\n${pc.spells}${pc.spells ? "\n" : ""}\`\`\`\n`] : []),
  ].join("\n");
}

/** A spell note: the `rpg spell` fence (YAML, then `---`, then the text). */
export function spellNote(name: string, circle: string, roll: unknown, text: string, summary = "A spell."): string {
  const yaml = [`circle: ${circle}`, `summary: ${summary}`, ...(roll ? [`roll: ${JSON.stringify(roll)}`] : [])];
  return `# ${name}\n\n\`\`\`rpg spell\n${yaml.join("\n")}\n\n---\n${text}\n\`\`\`\n`;
}
export const weapon = (name: string, hit: string, damage: string) => ({
  name,
  origin: "weapon",
  bucket: "attack",
  hit,
  attackForm: "melee",
  damage,
});
export const basic = (name: string) => ({ name, origin: "basic", bucket: "action" });
export function put(root: string, path: string, text: string): void {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
}

/**
 * A copy of the real vault's system folder (images left out), for specs that run over the real
 * PCs and bestiary: the vault is never touched, and the PCs' class links are written by stem. The
 * vault's notes link `[[tales-of-the-valiant/.../Druid]]` by path, which the vault's own
 * character.tsx `linkStem` does not reduce to the class name, so the sheet loses its class and
 * casters; the stem form is what the sheet resolves.
 */
export function copyVaultWithClassStems(vault: string, systemDir: string, pcRefs: string[]): string {
  const root = mkdtempSync(join(tmpdir(), "rpg-sim-vault-"));
  cpSync(join(vault, systemDir), join(root, systemDir), {
    recursive: true,
    filter: (src) => !/\.(webp|png|jpe?g|gif|svg|pdf|mp3|mp4)$/i.test(src),
  });
  for (const ref of pcRefs) {
    const path = join(root, ref);
    writeFileSync(
      path,
      readFileSync(path, "utf8").replace(/\[\[tales-of-the-valiant\/[^\]]*\/([^/\]]+)\]\]/g, "[[$1]]")
    );
  }
  return root;
}
