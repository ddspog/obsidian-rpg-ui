import {
  CreateEntity,
  CharacterDecl,
  FeatureEntry,
  parseSourceDocs,
  CompendiumLib,
  buildCompendiumIndex,
  resolveFeatures,
  ResolvedView,
  extractSpellBlocks,
  classifySpellCircle,
  extractItemElementBlocks,
} from "rpg-ui-toolkit";
import { xpTable as xp } from './character.lookup';
import type { CharacterEntity } from "./character.types";
import header from '../blocks/character/header';
import health from '../blocks/character/health';
import stats from '../blocks/character/stats';
import senses from '../blocks/character/senses';
import skills from '../blocks/character/skills';
import attacks from '../blocks/character/attacks';
import proficiencies from '../blocks/character/proficiencies';
import features from '../blocks/character/features';
import spells from '../blocks/character/spells';
import inventory from '../blocks/character/inventory';
import sheet from '../blocks/character/sheet';
import type { HeaderProps } from "../blocks/character/header.types";
import type { StatsProps } from "../blocks/character/stats.types";
import type { FeaturesBlockData } from "../blocks/character/features.types";

const character = CreateEntity<CharacterEntity>(async ({ wiki }) => {
    const [
        classDocs,
        subclassDocs,
        lineageDocs,
        heritageDocs,
        backgroundDocs,
        skillDocs,
        languageDocs,
        actionDocs,
        reactionDocs,
        bonusActionDocs,
        talentDocs,
    ] = await Promise.all([
        wiki.folder("worldbuilding/traits/classes") as Promise<any[]>,
        wiki.folder("worldbuilding/traits/subclasses") as Promise<any[]>,
        wiki.folder("worldbuilding/traits/lineages") as Promise<any[]>,
        wiki.folder("worldbuilding/traits/heritages") as Promise<any[]>,
        wiki.folder("worldbuilding/traits/backgrounds") as Promise<any[]>,
        wiki.folder("glossary/skills") as Promise<any[]>,
        wiki.folder("worldbuilding/traits/languages") as Promise<any[]>,
        wiki.folder("glossary/actions") as Promise<any[]>,
        wiki.folder("glossary/reactions") as Promise<any[]>,
        wiki.folder("glossary/bonus-actions") as Promise<any[]>,
        wiki.folder("worldbuilding/traits/talents") as Promise<any[]>,
    ]);

    // Auto-discover every `@folder/path` referenced inside a compendium
    // doc's text. Compendium authors can add new folders (homebrew
    // weapons, tool categories, spell pools, …) just by typing
    // `@path/to/folder` in a feature's `choose.options` or caster's
    // `pool:` — the entity resolves and indexes those folders on the fly,
    // so the plugin / system-level code needn't enumerate them here.
    const refPaths = new Set<string>();
    // `@` followed by a path segment. Keep the match greedy enough to
    // catch multi-level paths (`items/weapons/martial`) but stop before
    // quotes / whitespace / YAML punctuation.
    const refRe = /@([A-Za-z0-9][A-Za-z0-9/_\-]*)/g;
    const scanForRefs = (text: string) => {
        if (!text) return;
        for (const m of text.matchAll(refRe)) {
            const p = m[1].replace(/\/+$/, "");
            if (p) refPaths.add(p);
        }
    };
    for (const d of [
        ...(classDocs ?? []),
        ...(subclassDocs ?? []),
        ...(lineageDocs ?? []),
        ...(heritageDocs ?? []),
        ...(backgroundDocs ?? []),
        ...(talentDocs ?? []),
    ]) {
        scanForRefs(typeof (d as any)?.$contents === "string" ? (d as any).$contents : "");
    }

    // Always load the spell library regardless of whether any feature YAML
    // references it. The resolver auto-derives `cantrip_pool` / `ritual_pool`
    // from a class's `pool:` magic, which means classes no longer need to
    // spell out `@worldbuilding/cantrips` — but the spell docs still have
    // to be in the index for those auto-derived pools to resolve. One ref
    // covers cantrips + leveled spells + rituals in one sweep because
    // `wiki.folder()` descends recursively into subfolders.
    refPaths.add("worldbuilding/spells");
    // Same story for items — the character inventory block looks up
    // item frontmatter via `lookup.$items`, which is built from every
    // `.md` under `worldbuilding/items/**`. No user ref needed.
    refPaths.add("worldbuilding/items");

    // Load each referenced folder in parallel. A missing / stale path
    // resolves to [] so a typo doesn't break bundle loading — it just
    // means that `@folder/path` ref won't expand until the author fixes
    // the path (or creates the folder).
    const refLoads = await Promise.all(
        [...refPaths].map(async (p) => {
            try {
                const docs = (await (wiki.folder(p) as Promise<any[]>)) ?? [];
                return { path: p, docs };
            } catch {
                return { path: p, docs: [] as any[] };
            }
        }),
    );

    // Second pass: auto-load the immediate parent directory of every
    // resolved ref so sibling content gets indexed too. E.g.,
    // `@worldbuilding/cantrips` resolves to `worldbuilding/spells/cantrips/*`;
    // we then also index `worldbuilding/spells/*` so a tag-filtered pool
    // like `pool: "#Divine"` can match spells living outside the
    // cantrips sub-tree without the author having to list every sibling
    // folder. One level of ascension is enough to cover "pool + cantrip
    // subset" patterns without pulling in the entire vault.
    const parentPaths = new Set<string>();
    for (const { docs } of refLoads) {
        if (!docs || docs.length === 0) continue;
        // Derive the deepest common directory of the loaded docs.
        const dirs = docs
            .map((d: any) => {
                const p = (d?.$path ?? "") as string;
                return p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "";
            })
            .filter(Boolean) as string[];
        if (dirs.length === 0) continue;
        let common = dirs[0];
        for (const d of dirs) {
            while (d !== common && !d.startsWith(common + "/")) {
                const s = common.lastIndexOf("/");
                if (s < 0) { common = ""; break; }
                common = common.slice(0, s);
            }
            if (!common) break;
        }
        if (!common) continue;
        const parent = common.includes("/") ? common.slice(0, common.lastIndexOf("/")) : "";
        if (parent && !refPaths.has(parent)) parentPaths.add(parent);
    }
    const parentLoads = await Promise.all(
        [...parentPaths].map(async (p) => {
            try {
                const docs = (await (wiki.folder(p) as Promise<any[]>)) ?? [];
                return { path: p, docs };
            } catch {
                return { path: p, docs: [] as any[] };
            }
        }),
    );
    const refDocs = [
        ...refLoads.flatMap((r) => r.docs ?? []),
        ...parentLoads.flatMap((r) => r.docs ?? []),
    ];

    // Build `@folder/path` and `[[Tag]]` indexes off every worldbuilding doc
    // so compendium authors can write `@worldbuilding/items/weapons/martial`
    // or `[[Martial]]` inside `choose.options` arrays and have them expand
    // to concrete wikilinks. Each doc is registered under every
    // progressively-shorter folder suffix of its path so authors can
    // abbreviate (e.g. `@cantrips` still resolves when the file lives at
    // `worldbuilding/spells/cantrips/Foo.md`).
    const indexDocs: { $name: string; folder: string; tags: string[] }[] = [];
    // Spell docs carry their magic source and circle inside their
    // `rpg spell` fence body (not frontmatter). Scan each doc's
    // `$contents` for every spell fence, parse the YAML, and expose
    // `source` + `circle` as synthetic tags. `Divine` / `Primordial` /
    // `Arcane` / `Wyrd` then resolve to every spell whose `source`
    // includes that magic; `Cantrip` / `1st-Circle` / etc. resolve
    // by circle. Composite tags `Divine-Cantrip`, `Divine-Ritual`,
    // `Divine-Leveled` combine both axes so the resolver can auto-
    // derive cantrip_pool / ritual_pool from just the class `pool:`.
    const extraTagsFor = (d: any): string[] => {
        if (!d || typeof d !== "object") return [];
        const out: string[] = [];
        const contents = typeof d.$contents === "string" ? d.$contents : "";
        if (!contents) return out;
        const blocks = extractSpellBlocks(contents);
        for (const block of blocks) {
            const magics: string[] = [];
            const sources = Array.isArray(block.source) ? block.source : [];
            for (const raw of sources) {
                let v: unknown = raw;
                while (Array.isArray(v)) v = v[0];
                if (typeof v !== "string") continue;
                const stem = v.replace(/^\[\[/, "").replace(/\]\]$/, "").split("|")[0].trim();
                if (stem) {
                    out.push(stem);
                    magics.push(stem);
                }
            }
            let circle = "";
            if (typeof block.circle === "string" && block.circle.trim()) {
                circle = block.circle.trim();
                out.push(circle);
            }
            // Classify the spell for composite tags so the resolver can
            // pair the class's `pool:` magic with the right circle band.
            const kind = classifySpellCircle(circle);
            if (kind) {
                out.push(kind); // "Cantrip" | "Ritual" | "Leveled" (generic)
                for (const magic of magics) {
                    out.push(`${magic}-${kind}`);
                }
            }
        }
        return out;
    };
    // Dedupe by $path so a doc reachable through multiple `@folder` refs
    // (e.g. a spell in both `worldbuilding/spells` and
    // `worldbuilding/spells/cantrips`) only indexes once — its suffix
    // walk registers every ancestor folder anyway.
    const indexedPaths = new Set<string>();
    const pushIndexDoc = (d: any) => {
        const $path: string = d?.$path ?? "";
        if (!$path || indexedPaths.has($path)) return;
        indexedPaths.add($path);
        const frontmatterTags: string[] = Array.isArray(d?.$tags)
            ? d.$tags.map((t: string) => t.replace(/^#/, ""))
            : [];
        const tags = [...frontmatterTags, ...extraTagsFor(d)];
        let parentDir = $path.includes("/") ? $path.slice(0, $path.lastIndexOf("/")) : "";
        while (parentDir) {
            let suffix = parentDir;
            while (suffix) {
                indexDocs.push({ $name: d?.$name ?? "", folder: suffix, tags });
                const slash = suffix.indexOf("/");
                if (slash < 0) break;
                suffix = suffix.slice(slash + 1);
            }
            const lastSlash = parentDir.lastIndexOf("/");
            if (lastSlash < 0) break;
            parentDir = parentDir.slice(0, lastSlash);
        }
    };
    for (const d of [
        ...(skillDocs ?? []),
        ...(languageDocs ?? []),
        ...(talentDocs ?? []),
        ...refDocs,
    ]) {
        pushIndexDoc(d);
    }
    const { tagIndex, folderIndex } = buildCompendiumIndex(indexDocs);

    // Parse each `rpg spell` fence inside the discovered docs up front so
    // the character sheet can surface full spell content (range, duration,
    // components, description, …) without re-scanning the file every
    // render. Keyed by the doc's `$name` (bare wikilink stem), matching
    // how user picks arrive in the state. Any doc containing a spell
    // fence qualifies — doesn't matter which folder ref brought it in.
    const spellLibrary: Record<string, Record<string, unknown>> = {};
    for (const d of refDocs) {
        const name = (d as any)?.$name;
        const contents = typeof (d as any)?.$contents === "string" ? (d as any).$contents : "";
        if (!name || !contents) continue;
        const blocks = extractSpellBlocks(contents);
        // One spell per doc is the canonical shape; take the first fence.
        if (blocks.length > 0 && !spellLibrary[name]) {
            spellLibrary[name] = blocks[0] as Record<string, unknown>;
        }
    }

    // Item library — every doc under `worldbuilding/items/**` gets its
    // first `rpg item.element` fence parsed and keyed by basename. The
    // inventory resolver reads `.weight`, `.weapon.damage`,
    // `.armor.ac`, `.container.weight_cap`, etc. straight off this map.
    // Pre-migration files that haven't been rewritten drop out silently
    // (no fence → no entry); the inventory picker renders them with
    // weight 0 so missed migrations surface immediately.
    const itemLibrary: Record<string, Record<string, unknown>> = {};
    for (const d of refDocs) {
        const name = (d as any)?.$name;
        const $path = typeof (d as any)?.$path === "string" ? (d as any).$path : "";
        const contents = typeof (d as any)?.$contents === "string" ? (d as any).$contents : "";
        if (!name || !$path.includes("worldbuilding/items/") || !contents) continue;
        if (itemLibrary[name]) continue; // first-wins on name collision
        const parsed = extractItemElementBlocks(contents);
        if (parsed.length > 0) {
            itemLibrary[name] = parsed[0] as Record<string, unknown>;
        }
    }

    const compendium: CompendiumLib = {
        classes: parseSourceDocs(classDocs ?? [], "class"),
        subclasses: parseSourceDocs(subclassDocs ?? [], "subclass"),
        lineages: parseSourceDocs(lineageDocs ?? [], "lineage"),
        heritages: parseSourceDocs(heritageDocs ?? [], "heritage"),
        backgrounds: parseSourceDocs(backgroundDocs ?? [], "background"),
        talents: parseSourceDocs(talentDocs ?? [], "talent"),
        tagIndex,
        folderIndex,
    };

    // [RPG UI DEBUG] — dump index stats once at bundle load so the user
    // can see from the DevTools console which folders/tags actually
    // resolved. Flip DEBUG_INDEX to false once the vault layout is
    // stable; prefix is unique so it's easy to filter for.
    const DEBUG_INDEX = true;
    if (DEBUG_INDEX) {
        const sizeOf = (map: Record<string, string[]>) => {
            const out: Record<string, number> = {};
            for (const [k, v] of Object.entries(map)) out[k] = v.length;
            return out;
        };
        /* eslint-disable no-console */
        console.log("[RPG UI] referenced @folder paths:", [...refPaths]);
        console.log("[RPG UI] parent-walk loaded paths:", [...parentPaths]);
        console.log("[RPG UI] refDocs count:", refDocs.length);
        console.log("[RPG UI] folderIndex keys/counts:", sizeOf(folderIndex));
        console.log("[RPG UI] tagIndex keys/counts:", sizeOf(tagIndex));
        console.log("[RPG UI] spell library size:", Object.keys(spellLibrary).length);
        console.log("[RPG UI] spell library sample:", Object.keys(spellLibrary).slice(0, 20));
        /* eslint-enable no-console */
    }

    // Universal "default actions" available to every character. Each folder
    // supplies entries of a single aspect type (action / reaction / bonus),
    // so we tag them on the way in. The features block reads
    // `lookup.$defaultFeatures` and renders each one as a compact link in
    // its bucket rather than a full card (the entry's full content lives
    // in its own vault page).
    const toDefaultFeature = (type: "action" | "reaction" | "bonus") =>
        (d: any): FeatureEntry => ({
            $name: d?.$name ?? "",
            $contents: d?.$contents ?? "",
            type,
        });
    const defaultFeatures: FeatureEntry[] = [
        ...(actionDocs ?? []).map(toDefaultFeature("action")),
        ...(bonusActionDocs ?? []).map(toDefaultFeature("bonus")),
        ...(reactionDocs ?? []).map(toDefaultFeature("reaction")),
    ];

    // Strip a header pillish object (`{ file: "[[Foo]]", text?: ... }`) down
    // to its target stem so it slots straight into a `CharacterDecl`. Mirrors
    // the helper inside the features block; kept here so blocks consuming
    // `lookup.$features` don't have to know the shape.
    const pillStem = (p: { file?: unknown } | undefined): string | undefined => {
        if (!p?.file) return undefined;
        let raw: unknown = p.file;
        while (Array.isArray(raw)) raw = raw[0];
        if (typeof raw !== "string") return undefined;
        const stem = raw.replace(/^\[\[/, "").replace(/\]\]$/, "").replace(/\.md$/, "").trim();
        return stem || undefined;
    };

    // Same normalization applied to bare wikilink references that are not
    // wrapped in the pillish `{ file: ... }` shape. The class entries store
    // `name`, `subclass`, and `sub` as raw strings (which YAML parses as a
    // nested array when authored unquoted as `[[Foo]]`), so the resolver
    // would receive `[["Cleric"]]` instead of `"Cleric"` and fail every
    // compendium lookup. Unwrap and strip the wikilink delimiters.
    const linkStem = (raw: unknown): string | undefined => {
        let v: unknown = raw;
        while (Array.isArray(v)) v = v[0];
        if (typeof v !== "string") return undefined;
        const stem = v.replace(/^\[\[/, "").replace(/\]\]$/, "").replace(/\.md$/, "").split("|")[0].trim();
        return stem || undefined;
    };

    // Tiny content-keyed cache so multiple consuming blocks rendered in the
    // same tick reuse one resolveFeatures() call. Cleared on every header /
    // choices change because the cache key is their JSON.
    const featuresCache = new Map<string, ResolvedView>();
    const $features = (
        header: any,
        choices?: Record<string, Record<string, string | string[]>>,
        additional?: CharacterDecl["additional"],
    ): ResolvedView => {
        const decl: CharacterDecl = {
            classes: (header?.classes ?? []).map((c: any) => ({
                name: linkStem(c.name) ?? "",
                level: c.level,
                // Accept either `sub:` (terse alias for testing) or
                // `subclass:` (long form). `sub` wins when both are set.
                subclass: linkStem(c.sub) ?? linkStem(c.subclass),
            })),
            lineage: pillStem(header?.lineage),
            heritage: pillStem(header?.heritage),
            background: pillStem(header?.background),
            choices,
            additional,
        };
        const key = JSON.stringify(decl);
        const hit = featuresCache.get(key);
        if (hit) return hit;
        const view = resolveFeatures(decl, compendium);
        // Bound the cache so a long session can't grow it unboundedly.
        if (featuresCache.size > 8) featuresCache.clear();
        featuresCache.set(key, view);
        return view;
    };

    return {
    lookup: { table: { xp }, $compendium: compendium, $defaultFeatures: defaultFeatures, $features, $spells: spellLibrary, $items: itemLibrary },
    blocks: {
        header,
        health,
        stats,
        senses,
        skills,
        attacks,
        proficiencies,
        features,
        spells,
        inventory,
        sheet,
        description: ({ self, blocks, lookup, system }) => null,
    },
    features: defaultFeatures,
    expressions: {
        CharacterLevel: (_, { blocks }) => {
            // Accept `rpg character.header` or a merged `rpg character.sheet`
            // as the source of the classes list — lets authors author a
            // sheet block without losing expression access.
            const header = (blocks.header ?? (blocks as unknown as { sheet?: HeaderProps }).sheet) as HeaderProps | undefined;
            const classes = header?.classes ?? [];
            return classes
                .map(c => c.level)
                .reduce((a, b) => a + b, 0);
        },
        ProficiencyBonus: (_, { expressions }) => {
            const level = expressions.CharacterLevel();
            return Math.floor((level - 1) / 4) + 2;
        },
        ModifierTotal: ([{ attribute, proficiency, bonus }], { blocks, lookup, expressions }) => {
          // Stats YAML accepts either `STR: 14` shorthand or the full
          // `STR: { value, save: {…} }` object — read both shapes here so
          // skills / saves / passives stay in sync regardless of how the
          // user authored the block. Falls back to the merged sheet
          // block when a dedicated stats block isn't present.
          const statsSource = (blocks.stats ?? (blocks as unknown as { sheet?: StatsProps }).sheet) as Record<string, unknown> | undefined;
          const cell = statsSource?.[attribute];
          let attrValue = 10;
          if (typeof cell === "number") attrValue = cell;
          else if (cell && typeof cell === "object" && typeof (cell as { value?: number }).value === "number") {
            attrValue = (cell as { value: number }).value;
          }
          // Fold in Ability Score Improvement picks from the resolved
          // features view so skills / saves / passives reflect the same
          // total score the stats block displays. Values like "+2 Wisdom"
          // come from asi picks recorded via `choose.type: "asi"`.
          const header = (blocks.header ?? (blocks as unknown as { sheet?: HeaderProps }).sheet) as HeaderProps | undefined;
          const featuresBlock = (blocks.features ?? (blocks as unknown as { sheet?: FeaturesBlockData }).sheet) as FeaturesBlockData | undefined;
          const asiTraits: string[] = lookup.$features?.(header, featuresBlock?.choices, featuresBlock?.additional)
            ?.traits?.["Ability Scores"] ?? [];
          const LONG: Record<string, string> = {
            STR: "STRENGTH", DEX: "DEXTERITY", CON: "CONSTITUTION",
            INT: "INTELLIGENCE", WIS: "WISDOM", CHA: "CHARISMA",
          };
          const attrLong = LONG[attribute];
          let asi = 0;
          for (const raw of asiTraits) {
            const m = String(raw).match(/^\s*\+(\d+)\s+([A-Za-z]+)\s*$/);
            if (!m) continue;
            const tag = m[2].toUpperCase();
            if (tag === attribute || tag === attrLong) asi += parseInt(m[1], 10);
          }
          const attrMod = Math.floor((attrValue + asi - 10) / 2);
          const pb = expressions.ProficiencyBonus() * proficiency;
          return attrMod + pb + bonus;
        },
        Passive: ([{ attribute, proficiency, bonus, vantage }], { expressions }) => {
          return 10 + expressions.ModifierTotal({ attribute, proficiency, bonus }) + 5 * vantage;
        }
    },
};
});

export default character;
