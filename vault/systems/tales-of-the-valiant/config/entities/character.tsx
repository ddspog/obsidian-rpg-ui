import {
  CreateEntity,
  CharacterDecl,
  FeatureEntry,
  parseSourceDocs,
  CompendiumLib,
  buildCompendiumIndex,
  resolveFeatures,
  ResolvedView,
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
        toolDocs,
        martialDocs,
        simpleDocs,
        cantripDocs,
    ] = await Promise.all([
        wiki.folder("compendium/classes") as Promise<any[]>,
        wiki.folder("compendium/subclasses") as Promise<any[]>,
        wiki.folder("compendium/lineages") as Promise<any[]>,
        wiki.folder("compendium/heritages") as Promise<any[]>,
        wiki.folder("compendium/backgrounds") as Promise<any[]>,
        wiki.folder("compendium/skills") as Promise<any[]>,
        wiki.folder("compendium/languages") as Promise<any[]>,
        wiki.folder("compendium/actions") as Promise<any[]>,
        wiki.folder("compendium/reactions") as Promise<any[]>,
        wiki.folder("compendium/bonus-actions") as Promise<any[]>,
        wiki.folder("compendium/talents") as Promise<any[]>,
        wiki.folder("worldbuilding/tools") as Promise<any[]>,
        wiki.folder("worldbuilding/martial") as Promise<any[]>,
        wiki.folder("worldbuilding/simple") as Promise<any[]>,
        wiki.folder("worldbuilding/cantrips") as Promise<any[]>,
    ]);

    // Build `@folder/path` and `#Tag` indexes off every worldbuilding doc so
    // compendium authors can write `@worldbuilding/tools` or `#martial` inside
    // `choose.options` arrays and have them expand to concrete wikilinks.
    // Each doc is registered under every progressively-shorter folder suffix
    // of its path so authors can abbreviate (e.g. `@worldbuilding/tools`
    // resolves whether Obsidian surfaces the file at
    // `systems/<system>/worldbuilding/tools/Foo.md` or `worldbuilding/tools/Foo.md`).
    const indexDocs: { $name: string; folder: string; tags: string[] }[] = [];
    for (const d of [
        ...(skillDocs ?? []),
        ...(languageDocs ?? []),
        ...(talentDocs ?? []),
        ...(toolDocs ?? []),
        ...(martialDocs ?? []),
        ...(simpleDocs ?? []),
        ...(cantripDocs ?? []),
    ]) {
        const $path: string = (d as any)?.$path ?? "";
        const tags: string[] = Array.isArray((d as any)?.$tags)
            ? (d as any).$tags.map((t: string) => t.replace(/^#/, ""))
            : [];
        // Walk up every parent directory and register the file under every
        // progressively-shorter suffix of that directory. For a talent at
        // `compendium/talents/magic/Mental Fortitude.md`, this produces
        // keys: `compendium/talents/magic`, `talents/magic`, `magic`,
        // `compendium/talents`, `talents`, `compendium`.
        let parentDir = $path.includes("/") ? $path.slice(0, $path.lastIndexOf("/")) : "";
        while (parentDir) {
            let suffix = parentDir;
            while (suffix) {
                indexDocs.push({ $name: (d as any)?.$name ?? "", folder: suffix, tags });
                const slash = suffix.indexOf("/");
                if (slash < 0) break;
                suffix = suffix.slice(slash + 1);
            }
            const lastSlash = parentDir.lastIndexOf("/");
            if (lastSlash < 0) break;
            parentDir = parentDir.slice(0, lastSlash);
        }
    }
    const { tagIndex, folderIndex } = buildCompendiumIndex(indexDocs);

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
    lookup: { table: { xp }, $compendium: compendium, $defaultFeatures: defaultFeatures, $features },
    blocks: {
        header,
        health,
        stats,
        senses,
        skills,
        attacks,
        proficiencies,
        features,
        spells: ({ self, blocks, lookup, system }) => null,
        inventory: ({ self, blocks, lookup, system }) => null,
        description: ({ self, blocks, lookup, system }) => null,
    },
    features: defaultFeatures,
    expressions: {
        CharacterLevel: (_, { blocks }) => {
            const { header } = blocks;
            return header.classes
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
          // user authored the block.
          const cell = (blocks.stats as Record<string, unknown> | undefined)?.[attribute];
          let attrValue = 10;
          if (typeof cell === "number") attrValue = cell;
          else if (cell && typeof cell === "object" && typeof (cell as { value?: number }).value === "number") {
            attrValue = (cell as { value: number }).value;
          }
          // Fold in Ability Score Improvement picks from the resolved
          // features view so skills / saves / passives reflect the same
          // total score the stats block displays. Values like "+2 Wisdom"
          // come from asi picks recorded via `choose.type: "asi"`.
          const asiTraits: string[] = lookup.$features?.(blocks.header, blocks.features?.choices, blocks.features?.additional)
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
