import * as React from "react";
import {
  CharacterDecl,
  ChooseSpec,
  EntityBlock,
  EvalContext,
  FeatureAspect,
  FeatureDetails,
  FeatureEntry,
  Markdown,
  PendingChoice,
  PendingChoiceRow,
  ResolvedCaster,
  ResolvedSource,
  ResolvedView,
  resolveFeatures,
} from "rpg-ui-toolkit";
import { CharacterEntity } from "../../entities/character.types";
import type { HeaderProps } from "./header.types";
import type { FeaturesBlockData } from "./features.types";
import type { CasterState, SpellsProps } from "./spells.types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Persist a single boolean (a `<details>` open/closed flag) in
 * `localStorage` so the section's expansion state survives reloads. The
 * key is composed by the caller and should encode the active note path +
 * a stable slot identifier (`bucket:action`, `pending`, `decisions`, …)
 * so two characters don't fight over the same drawer.
 *
 * Storage is intentionally outside the YAML — UI state shouldn't pollute
 * the character file. `localStorage` is per-vault inside Obsidian's
 * Electron renderer; in Storybook it's per-browser.
 */
function usePersistentOpen(
  key: string,
  defaultOpen: boolean,
): [boolean, (next: boolean) => void] {
  const storageKey = `rpg-ui:open:${key}`;
  const [open, setOpen] = React.useState<boolean>(() => {
    try {
      if (typeof localStorage === "undefined") return defaultOpen;
      const stored = localStorage.getItem(storageKey);
      return stored === null ? defaultOpen : stored === "1";
    } catch {
      return defaultOpen;
    }
  });
  const update = React.useCallback(
    (next: boolean) => {
      setOpen(next);
      try {
        localStorage.setItem(storageKey, next ? "1" : "0");
      } catch {
        // ignore (private browsing, quota, etc. — UI still functions)
      }
    },
    [storageKey],
  );
  return [open, update];
}

/** Stable identifier for the currently-open character note, scoping the
 *  persisted UI state per-character. Falls back to a generic key when no
 *  active file is reachable (e.g. early renders). */
function useNoteKey(): string {
  return React.useMemo(() => {
    const app = (globalThis as unknown as { app?: { workspace?: { getActiveFile?: () => { path?: string } | null } } }).app;
    return app?.workspace?.getActiveFile?.()?.path ?? "default";
  }, []);
}

/**
 * Pull "Human" out of a PillDetails.file. Two shapes can arrive depending on
 * how the source YAML was written:
 *   - quoted: `file: "[[Human]]"`   → string `"[[Human]]"`
 *   - bare:   `file: [[Human]]`     → nested flow array `[["Human"]]`
 * Both yield the same stem.
 */
function pillStem(p: { file?: unknown } | undefined): string | undefined {
  if (!p?.file) return undefined;
  let raw: unknown = p.file;
  while (Array.isArray(raw)) raw = raw[0];
  if (typeof raw !== "string") return undefined;
  const stem = raw.replace(/^\[\[/, "").replace(/\]\]$/, "").replace(/\.md$/, "").trim();
  return stem || undefined;
}

/** Same normalization as `pillStem` for bare wikilink references that
 *  aren't wrapped in the pillish `{ file: ... }` shape. Class entries
 *  store `name`, `subclass`, and `sub` as raw strings, which YAML parses
 *  as nested arrays when the author wrote `[[Foo]]` unquoted — without
 *  unwrapping, every compendium lookup misses. */
function linkStem(raw: unknown): string | undefined {
  let v: unknown = raw;
  while (Array.isArray(v)) v = v[0];
  if (typeof v !== "string") return undefined;
  const stem = v.replace(/^\[\[/, "").replace(/\]\]$/, "").replace(/\.md$/, "").split("|")[0].trim();
  return stem || undefined;
}

/** Pretty-print a resource `max` — scalar passes through; per-level map picks
 *  the value whose level is highest while still ≤ the character's level. */
function maxAtLevel(max: FeatureAspect["max"], characterLevel?: number): string {
  if (max == null) return "—";
  if (typeof max === "number") return String(max);
  if (typeof max === "string") return max;
  const entries = Object.entries(max)
    .map(([lv, n]) => [Number(lv), n] as const)
    .sort((a, b) => a[0] - b[0]);
  if (entries.length === 0) return "—";
  if (characterLevel == null) return String(entries[entries.length - 1][1]);
  let chosen = entries[0][1];
  for (const [lv, n] of entries) {
    if (lv <= characterLevel) chosen = n;
    else break;
  }
  return String(chosen);
}

/** Numeric-form of `maxAtLevel` — returns null when no max is declared so
 *  callers can branch cleanly on "limited uses? y/n". A string `max` (e.g.
 *  `"PB"`) is evaluated against `vars`, letting feature authors write
 *  `resource: { max: PB }` and get the character's live proficiency bonus. */
function resolveMaxCount(
  max: FeatureAspect["max"],
  characterLevel?: number,
  vars?: Record<string, string | number>,
): number | null {
  if (max == null) return null;
  if (typeof max === "number") return max;
  if (typeof max === "string") {
    const hit = vars?.[max];
    if (typeof hit === "number") return hit;
    if (typeof hit === "string") {
      const n = Number(hit);
      return Number.isFinite(n) ? n : null;
    }
    const n = Number(max);
    return Number.isFinite(n) ? n : null;
  }
  const entries = Object.entries(max)
    .map(([lv, n]) => [Number(lv), n] as const)
    .sort((a, b) => a[0] - b[0]);
  if (entries.length === 0) return null;
  if (characterLevel == null) return entries[entries.length - 1][1];
  let chosen: number | null = null;
  for (const [lv, n] of entries) {
    if (lv <= characterLevel) chosen = n;
    else break;
  }
  return chosen ?? entries[0][1];
}

/** Interactive "fill-me-up" usage dots next to a feature's name. Clicking a
 *  dot toggles it — click the i-th empty dot to mark uses 0..i as spent;
 *  click an already-filled dot to mark uses i+1..max as available again.
 *  Matches the death-save / exhaustion pattern used elsewhere on the sheet. */
function UsageDots({
  count,
  spent,
  onSpentChange,
}: {
  count: number;
  spent: number;
  onSpentChange?: (next: number) => void;
}) {
  if (count <= 0) return null;
  const clamped = Math.max(0, Math.min(spent, count));
  return (
    <span
      className="rpg-feature-bucket-dots"
      role="group"
      aria-label={`${count - clamped} of ${count} uses remaining`}
    >
      {Array.from({ length: count }, (_, i) => {
        const filled = i < clamped;
        return (
          <button
            key={i}
            type="button"
            className="rpg-feature-bucket-dot"
            aria-pressed={filled}
            aria-label={`Use ${i + 1}${filled ? " (spent)" : ""}`}
            disabled={!onSpentChange}
            onClick={() => onSpentChange?.(filled ? i : i + 1)}
          />
        );
      })}
    </span>
  );
}

// ─── Bucketing ───────────────────────────────────────────────────────────────

/**
 * Accordion buckets in display order. Each id is both a valid `type:` value
 * and a valid aspect sub-key on `FeatureDetails`.
 */
const BUCKETS: Array<{ id: BucketId; label: string }> = [
  { id: "action", label: "Action" },
  { id: "bonus", label: "Bonus Action" },
  { id: "reaction", label: "Reaction" },
  { id: "active", label: "Active" },
  { id: "passive", label: "Passive" },
  { id: "resource", label: "Resource" },
];
type BucketId = "action" | "bonus" | "reaction" | "active" | "passive" | "resource";
const BUCKET_IDS = new Set<string>(BUCKETS.map((b) => b.id));

interface BucketEntry {
  feature: FeatureDetails;
  aspect: FeatureAspect;
  bucket: BucketId;
  source: string;
  level?: number;
}

/**
 * Classify each resolved feature into zero or more buckets:
 *  - every aspect sub-object on the feature emits its own entry in that bucket
 *  - a feature without any aspect falls back to its `type:` (backwards compat)
 *  - resource shorthand: `max:`/`recovery:` on the parent places the feature
 *    in the Resource bucket when no `resource:` aspect was declared
 *
 * Features that match none of those rules are intentionally skipped — their
 * contributions (trait maps, pick prompts, spellcasting configs) already
 * surface in the Traits bucket, the "Choices to make" section, or dedicated
 * renderers. No generic catch-all bucket.
 */
function bucketize(sources: ResolvedSource[]): {
  byBucket: Record<string, BucketEntry[]>;
  grantedTrivials: Record<string, FeatureEntry[]>;
} {
  const byBucket: Record<string, BucketEntry[]> = {};
  // Features may reference an existing action/reaction/bonus-action page via
  // a wikilink shorthand (e.g. `bonus: [[Help]]` on Comrade). YAML parses
  // `[[Name]]` as a 1×1 nested array; we normalise that back into a link
  // string and surface the referenced entry as a trivial in the matching
  // bucket rather than trying to render it as a feature card here.
  const grantedTrivials: Record<string, FeatureEntry[]> = {};

  // Sources are already in priority order (classes first, then lineage →
  // heritage → background). Within each source, re-sort features so
  // unlevelled base rules come before levelled features, which themselves
  // rank ascending by level. Equal levels preserve compendium doc order
  // (Array.sort is stable).
  const featureLevel = (l: number | number[] | undefined): number => {
    if (l == null) return -1;
    if (Array.isArray(l)) {
      const nums = l.filter((n): n is number => typeof n === "number");
      return nums.length > 0 ? Math.min(...nums) : -1;
    }
    return l;
  };

  for (const src of sources) {
    const orderedFeatures = [...src.features].sort(
      (a, b) => featureLevel(a.level) - featureLevel(b.level),
    );
    for (const feature of orderedFeatures) {
      let placed = false;

      for (const { id } of BUCKETS) {
        const raw = (feature as unknown as Record<string, unknown>)[id];
        if (raw == null) continue;
        if (typeof raw === "object" && !Array.isArray(raw)) {
          (byBucket[id] ??= []).push({
            feature,
            aspect: raw as FeatureAspect,
            bucket: id,
            source: src.source,
            level: src.level,
          });
          placed = true;
        } else {
          // Array-form (or single wikilink shorthand). Each item is either
          // a wikilink (trivial link in the bucket) or an inline
          // FeatureAspect object (full card). Mixed arrays are allowed —
          // a feature can "grant" one existing action and define a new
          // sibling inline on the same key.
          const items = Array.isArray(raw) ? raw : [raw];
          for (const item of items) {
            const links = extractWikilinks(item);
            if (links.length > 0) {
              for (const link of links) {
                const name = link.replace(/^\[\[/, "").replace(/\]\]$/, "").split("|")[0];
                if (!name) continue;
                (grantedTrivials[id] ??= []).push({ $name: name, type: id });
              }
              continue;
            }
            if (item && typeof item === "object" && !Array.isArray(item)) {
              (byBucket[id] ??= []).push({
                feature,
                aspect: item as FeatureAspect,
                bucket: id,
                source: src.source,
                level: src.level,
              });
              placed = true;
            }
          }
        }
      }

      if (!placed && feature.type && BUCKET_IDS.has(feature.type)) {
        const bucket = feature.type as BucketId;
        (byBucket[bucket] ??= []).push({
          feature,
          aspect: {},
          bucket,
          source: src.source,
          level: src.level,
        });
        placed = true;
      }

      if (!placed && feature.max != null) {
        (byBucket.resource ??= []).push({
          feature,
          aspect: { max: feature.max, recovery: feature.recovery },
          bucket: "resource",
          source: src.source,
          level: src.level,
        });
      }
    }
  }

  return { byBucket, grantedTrivials };
}

/**
 * Normalise a YAML-parsed value into a list of `"[[Name]]"` wikilink strings.
 *
 * Authored wikilinks (`[[Name]]` without quotes) parse as nested flow arrays
 * — `[["Name"]]` at the leaf — so we reconstruct the literal wikilink.
 * Accepts plain strings, arrays of either shape, and returns `[]` for any
 * other value so the caller can treat "no links" uniformly.
 */
function extractWikilinks(val: unknown): string[] {
  if (val == null) return [];
  if (typeof val === "string") return [val];
  if (Array.isArray(val)) {
    if (
      val.length === 1 &&
      Array.isArray(val[0]) &&
      val[0].length === 1 &&
      typeof val[0][0] === "string"
    ) {
      return [`[[${val[0][0]}]]`];
    }
    return val.flatMap(extractWikilinks);
  }
  return [];
}

// ─── Spell → bucket classification ───────────────────────────────────────────

/** Strip `[[` / `]]` / `.md` / alias pipe → bare spell stem. */
function spellStem(raw: string): string {
  return raw
    .replace(/^\[\[/, "")
    .replace(/\]\]$/, "")
    .replace(/\.md$/, "")
    .split("|")[0]
    .trim();
}

/**
 * Evaluate a `buy:` expression (literal number, or a string like `"5 + PB"`)
 * against the character's EvalContext vars. Matches the `prepared_max`
 * evaluator in the spells block: identifier substitution + arithmetic,
 * nothing more. Unresolved identifiers collapse to 0 so a typo doesn't
 * silently produce a huge budget.
 */
function evalBuyBudget(
  expr: number | string | undefined,
  vars: Record<string, number | string>,
): number | undefined {
  if (expr == null) return undefined;
  if (typeof expr === "number") return Number.isFinite(expr) ? Math.max(0, Math.floor(expr)) : 0;
  if (typeof expr !== "string") return 0;
  let rewritten = expr.trim();
  if (!rewritten) return 0;
  // Longest identifiers first so `WIS_MOD` doesn't get partially clobbered
  // by a narrower `WIS` substitution.
  const keys = Object.keys(vars).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    const v = vars[k];
    if (typeof v !== "number") continue;
    rewritten = rewritten.replace(new RegExp(`\\b${k}\\b`, "g"), String(v));
  }
  if (!/^[-+*/() \d.]+$/.test(rewritten)) return 0;
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const value = Function(`"use strict"; return (${rewritten})`)();
    return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  } catch {
    return 0;
  }
}

/** Map a spell's `casting` field to one of the castable buckets, or undefined
 *  if the casting time is something else (1 minute, 10 minutes, …). Order of
 *  checks matters: "bonus action" contains the word "action", so the more
 *  specific patterns run first. */
function matchCastingBucket(
  casting: string | undefined,
): "action" | "bonus" | "reaction" | undefined {
  if (!casting || typeof casting !== "string") return undefined;
  const c = casting.toLowerCase();
  if (/bonus\s*action/.test(c)) return "bonus";
  if (/reaction/.test(c)) return "reaction";
  if (/\baction\b/.test(c)) return "action";
  return undefined;
}

/** Gather every spell available to the character (auto-granted + user
 *  picks), classify by casting time, and emit a bucket → trivial-entries
 *  map ready to merge into FeaturesAccordion's trivials. Deduped per
 *  bucket+stem across casters so a spell shared by two casters doesn't
 *  appear twice in the same list. */
function collectSpellTrivials(
  casters: ResolvedCaster[] | undefined,
  castersState: Record<string, CasterState>,
  spellLibrary: Record<string, Record<string, unknown>>,
): Record<string, FeatureEntry[]> {
  const out: Record<string, FeatureEntry[]> = {};
  if (!casters || casters.length === 0) return out;
  const seen = new Set<string>();
  const push = (raw: string) => {
    const stem = spellStem(raw);
    if (!stem) return;
    const doc = spellLibrary[stem] as { casting?: string } | undefined;
    const bucket = matchCastingBucket(doc?.casting);
    if (!bucket) return;
    const key = `${bucket}:${stem}`;
    if (seen.has(key)) return;
    seen.add(key);
    (out[bucket] ??= []).push({ $name: stem, type: bucket });
  };
  for (const caster of casters) {
    const state = castersState[caster.source] ?? {};
    // Auto-granted spells (prepared-caster domain picks, subclass bonus
    // cantrips, ritual unlocks, …) — filter to grants the character has
    // actually reached.
    for (const [lvlStr, list] of Object.entries(caster.granted.cantrips ?? {})) {
      if (Number(lvlStr) > caster.level) continue;
      for (const s of list ?? []) push(s);
    }
    for (const [lvlStr, list] of Object.entries(caster.granted.prepared ?? {})) {
      if (Number(lvlStr) > caster.level) continue;
      for (const s of list ?? []) push(s);
    }
    for (const [lvlStr, list] of Object.entries(caster.granted.rituals ?? {})) {
      if (Number(lvlStr) > caster.level) continue;
      for (const s of list ?? []) push(s);
    }
    // User picks recorded in the spells block's YAML state.
    for (const s of state.cantrips ?? []) push(s);
    for (const m of [state.prepared, state.known, state.rituals] as const) {
      if (!m) continue;
      for (const list of Object.values(m)) {
        for (const s of list ?? []) push(s);
      }
    }
  }
  return out;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function EntryRow({
  entry,
  characterLevel,
  context,
  spent,
  onSpentChange,
}: {
  entry: BucketEntry;
  characterLevel?: number;
  context?: EvalContext;
  spent: number;
  onSpentChange?: (next: number) => void;
}) {
  const { feature, aspect, source } = entry;
  const displayName = prettifyLevelSuffix(aspect.name ?? feature.name);
  const isResource = entry.bucket === "resource";
  // Resource entries render their own aspect text only; the parent feature's
  // long prose belongs to the Action/Passive aspects, not the bare pool.
  const cardText = isResource ? aspect.text : (aspect.text ?? feature.text);
  const maxCount = resolveMaxCount(aspect.max, characterLevel, context?.vars);

  return (
    <li className="rpg-feature-bucket-entry">
      <div className="rpg-feature-bucket-entry-title">
        <strong className="rpg-feature-bucket-entry-name">{displayName}</strong>
        {maxCount != null && (
          <UsageDots count={maxCount} spent={spent} onSpentChange={onSpentChange} />
        )}
        {aspect.recharge && (
          <small aria-details="Recharge">↻ {aspect.recharge}</small>
        )}
        {(isResource || aspect.resource != null) && aspect.recovery && (
          <small aria-details="Resource Recovery">recharge on {aspect.recovery}</small>
        )}
        {!isResource && aspect.resource && (
          <small aria-details="Uses Resource">uses {aspect.resource}</small>
        )}
      </div>
      <div className="rpg-feature-bucket-entry-meta">
        <a
          className="internal-link rpg-feature-bucket-source"
          href={source}
          data-href={source}
          aria-details="Feature Source"
        >
          {source}
        </a>
      </div>
      <figure className="rpg-feature-bucket-entry-image" aria-hidden="true" />
      {cardText && (
        <Markdown
          source={cardText}
          context={context}
          className="rpg-feature-bucket-entry-desc"
        />
      )}
    </li>
  );
}

function Bucket({
  id,
  label,
  entries,
  trivials,
  characterLevel,
  context,
  spentMap,
  onSpentChange,
}: {
  id: string;
  label: string;
  entries: BucketEntry[];
  /** Trivial entries for this bucket — rendered as a compact comma-separated
   *  link list beneath the full-card entries. Each one is a standalone
   *  vault page rather than an inline `rpg feature.details` block. */
  trivials: FeatureEntry[];
  characterLevel?: number;
  context?: EvalContext;
  spentMap: Record<string, number>;
  onSpentChange?: (key: string, next: number) => void;
}) {
  if (entries.length === 0 && trivials.length === 0) return null;
  const total = entries.length + trivials.length;
  const noteKey = useNoteKey();
  const [open, setOpen] = usePersistentOpen(`${noteKey}:bucket:${id}`, false);
  return (
    <details
      className={`rpg-feature-bucket rpg-feature-bucket-${id}`}
      open={open}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary>
        <span className="rpg-feature-bucket-label">{label}</span>
        <span className="rpg-feature-bucket-count">{total}</span>
      </summary>
      {entries.length > 0 && (
        <ul>
          {entries.map((entry, i) => {
            const key = `${entry.source}:${entry.feature.name}:${entry.bucket}`;
            return (
              <EntryRow
                key={i}
                entry={entry}
                characterLevel={characterLevel}
                context={context}
                spent={spentMap[key] ?? 0}
                onSpentChange={onSpentChange ? (next) => onSpentChange(key, next) : undefined}
              />
            );
          })}
        </ul>
      )}
      {trivials.length > 0 && (
        <div className="rpg-feature-bucket-trivials" aria-label="Default actions">
          {/* Render through the Markdown component so each `[[wikilink]]`
              becomes a real Obsidian internal-link anchor with hover-
              preview + click-to-open wired up by MarkdownRenderer. A plain
              `<a class="internal-link">` doesn't get those handlers. */}
          <Markdown source={trivials.map((t) => `[[${t.$name}]]`).join(" · ")} />
        </div>
      )}
    </details>
  );
}

/** Every spell auto-granted by this caster at the given class level,
 *  across all grant buckets (cantrips / prepared / rituals). Keeps the
 *  original wikilink shape so the renderer can resolve stems later. */
function grantsAtLevel(caster: ResolvedCaster | undefined, level: number): string[] {
  if (!caster) return [];
  const buckets = [
    caster.granted.cantrips,
    caster.granted.prepared,
    caster.granted.rituals,
  ];
  const out: string[] = [];
  for (const m of buckets) {
    const raws = (m ?? {})[level];
    if (!raws) continue;
    for (const s of raws) out.push(s);
  }
  return out;
}


function TraitValue({ value }: { value: string }) {
  const prefixed = value.startsWith("+") || value.startsWith("−") ? value : `+${value}`;
  const parts = prefixed.split(/(\[\[[^\]]+\]\])/);
  return (
    <>
      {parts.map((part, i) => {
        const match = part.match(/^\[\[([^|\]]+)(?:\|([^\]]+))?\]\]$/);
        if (match) {
          const href = match[1];
          const label = match[2] ?? match[1];
          return (
            <a
              key={i}
              className="internal-link"
              href={href}
              data-href={href}
            >
              {label}
            </a>
          );
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </>
  );
}

/** Inline trait list: `**TraitA** (+v1, +v2), **TraitB** (+v3)`. */
function TraitsInline({ traits }: { traits: Record<string, string[]> }) {
  const entries = Object.entries(traits);
  if (entries.length === 0) return null;
  return (
    <>
      {entries.map(([name, values], i) => (
        <React.Fragment key={name}>
          {i > 0 && ", "}
          <strong>{name}</strong>
          {" ("}
          {values.map((v, j) => (
            <React.Fragment key={j}>
              {j > 0 && ", "}
              <TraitValue value={v} />
            </React.Fragment>
          ))}
          {")"}
        </React.Fragment>
      ))}
    </>
  );
}

/** Append every entry from `extra` onto the matching key in `base`,
 *  preserving insertion order of `base` then adding any new keys from
 *  `extra` at the end. Used to fold subclass baseTraits / level-row
 *  traits into the class's own map so the player sees one unified row
 *  per class level instead of a separate subclass line. */
function mergeTraitMaps(
  ...maps: Array<Record<string, string[]> | undefined>
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const m of maps) {
    if (!m) continue;
    for (const [k, v] of Object.entries(m)) {
      out[k] = [...(out[k] ?? []), ...v];
    }
  }
  return out;
}

/** Normalise a granted-spell ref into a `[[Stem]]` wikilink so TraitValue
 *  treats it like any other trait value (renders as a real internal
 *  link with hover-preview wired up). Falls back to the raw string if
 *  no stem can be derived. */
function grantToWikilink(raw: string): string {
  const stem = spellStem(raw);
  return stem ? `[[${stem}]]` : raw;
}

/** One source's contribution to the character sheet's traits bucket.
 *
 *  Subclass sources don't render as their own top-level entry — the
 *  resolver emits them right after their parent class in `sources`, and
 *  the TraitsBucket folds them onto the class card. When a `sub:` is
 *  passed in, its traits merge directly into the class's base + level
 *  rows (no indented secondary line), and at the subclass-unlock level
 *  we inject a synthetic `Subclass (+Life Domain)` trait so the player
 *  sees where the pick happened. Granted spells fold in as a
 *  `Granted (+Bless, +Cure Wounds)` synthetic trait on the level they
 *  were unlocked at. */
function TraitsSourceLine({
  src,
  sub,
  casters,
}: {
  src: ResolvedSource;
  sub?: ResolvedSource;
  /** Resolved casters for the whole sheet — used to attribute granted
   *  spells back to the class/subclass that unlocked them, per-level. */
  casters?: ResolvedCaster[];
}) {
  const isClass = src.kind === "class" || src.kind === "subclass";
  const hasBase = Object.keys(src.baseTraits).length > 0;
  const hasLeveled = Object.keys(src.leveledTraits).length > 0;
  const subHasBase = !!sub && Object.keys(sub.baseTraits).length > 0;
  const subHasLeveled = !!sub && Object.keys(sub.leveledTraits).length > 0;

  // A class's caster (if this source declared a Spellcasting feature) feeds
  // the per-level `Granted (+…)` synthetic trait. Subclass grants merge
  // into the same caster via `grantedBy`, so we only need one lookup.
  const caster = casters?.find((c) => c.source === src.source);
  const hasAnyGrants = !!caster && Object.values({
    ...caster.granted.cantrips,
    ...caster.granted.prepared,
    ...caster.granted.rituals,
  }).some((list) => (list?.length ?? 0) > 0);

  if (!hasBase && !hasLeveled && !subHasBase && !subHasLeveled && !hasAnyGrants) return null;

  // For class/subclass sources, break traits into per-level rows so players
  // can see which level unlocked what. Unlevelled rules (hit dice, armor,
  // saves, …) stay on the source's base line — only features with an
  // explicit `level:` flow into the per-level breakdown. Empty levels are
  // skipped. Non-class sources (lineage / heritage / background) keep the
  // single-line summary.
  if (isClass) {
    const classByLevel = src.traitsByLevel ?? {};
    const subByLevel = sub?.traitsByLevel ?? {};
    const levelSet = new Set<number>();
    for (const k of Object.keys(classByLevel)) {
      const n = Number(k);
      if (Number.isFinite(n) && Object.keys(classByLevel[n] ?? {}).length > 0) levelSet.add(n);
    }
    for (const k of Object.keys(subByLevel)) {
      const n = Number(k);
      if (Number.isFinite(n) && Object.keys(subByLevel[n] ?? {}).length > 0) levelSet.add(n);
    }
    // Spell-grant levels contribute rows too, even if the class/subclass
    // otherwise has nothing new at that level (pure domain-spell grants).
    if (caster) {
      for (const m of [caster.granted.cantrips, caster.granted.prepared, caster.granted.rituals]) {
        for (const k of Object.keys(m ?? {})) {
          const n = Number(k);
          if (Number.isFinite(n) && (m[n]?.length ?? 0) > 0) levelSet.add(n);
        }
      }
    }
    const levels = [...levelSet].sort((a, b) => a - b);

    // Subclass "pick" level = the earliest level at which the subclass
    // contributes anything. Falls back to sub.level from the resolver
    // when the subclass has no leveled traits declared (unusual but
    // possible for pure-flavour subclasses).
    const subUnlockLevel: number | undefined = (() => {
      if (!sub) return undefined;
      const l = Object.keys(subByLevel)
        .map(Number)
        .filter((n) => Number.isFinite(n) && Object.keys(subByLevel[n] ?? {}).length > 0)
        .sort((a, b) => a - b);
      return l[0] ?? sub.level;
    })();

    const mergedBase = mergeTraitMaps(src.baseTraits, sub?.baseTraits);
    const hasMergedBase = Object.keys(mergedBase).length > 0;

    return (
      <div className="rpg-feature-traits-source">
        <p>
          <a
            className="internal-link rpg-feature-traits-source-link"
            href={src.source}
            data-href={src.source}
          >
            {src.source}
          </a>
          {src.level != null && (
            <span className="rpg-feature-traits-source-level"> (Lv. {src.level})</span>
          )}
          {hasMergedBase && (
            <>
              {" — "}
              <TraitsInline traits={mergedBase} />
            </>
          )}
        </p>
        {levels.length > 0 && (
          <ul className="rpg-feature-traits-leveled">
            {levels.map((lvl) => {
              const row = mergeTraitMaps(classByLevel[lvl], subByLevel[lvl]);
              if (sub && lvl === subUnlockLevel) {
                row["Subclass"] = [
                  ...(row["Subclass"] ?? []),
                  `[[${sub.source}]]`,
                ];
              }
              const grants = grantsAtLevel(caster, lvl).map(grantToWikilink);
              if (grants.length > 0) {
                row["Granted"] = [...(row["Granted"] ?? []), ...grants];
              }
              if (Object.keys(row).length === 0) return null;
              return (
                <li key={lvl}>
                  <strong className="rpg-feature-traits-level-tag">Lv. {lvl}</strong>{" "}
                  <TraitsInline traits={row} />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="rpg-feature-traits-source">
      <p>
        <a
          className="internal-link rpg-feature-traits-source-link"
          href={src.source}
          data-href={src.source}
        >
          {src.source}
        </a>
        {hasBase && (
          <>
            {" — "}
            <TraitsInline traits={src.baseTraits} />
          </>
        )}
      </p>
      {hasLeveled && !hasBase && (
        <p>
          <TraitsInline traits={src.leveledTraits} />
        </p>
      )}
    </div>
  );
}

function TraitsBucket({
  sources,
  casters,
}: {
  sources: ResolvedSource[];
  casters?: ResolvedCaster[];
}) {
  // Subclass sources aren't standalone traits entries — the resolver emits
  // them right after their parent class (declaration order), and here we
  // fold each one onto the preceding class group so the character sheet
  // reads "Cleric → Life Domain traits interleaved" instead of showing
  // Life Domain as a sibling source on its own row.
  const hasCasterGrants = (sourceName: string): boolean => {
    const caster = casters?.find((c) => c.source === sourceName);
    if (!caster) return false;
    for (const m of [caster.granted.cantrips, caster.granted.prepared, caster.granted.rituals]) {
      for (const list of Object.values(m ?? {})) {
        if ((list?.length ?? 0) > 0) return true;
      }
    }
    return false;
  };
  const groups: Array<{ src: ResolvedSource; sub?: ResolvedSource }> = [];
  for (const s of sources) {
    const hasBase = Object.keys(s.baseTraits).length > 0;
    const hasLeveled = Object.keys(s.leveledTraits).length > 0;
    const hasSpells = hasCasterGrants(s.source);
    if (!hasBase && !hasLeveled && !hasSpells) continue;
    if (s.kind === "subclass") {
      const last = groups[groups.length - 1];
      if (last && last.src.kind === "class" && !last.sub) {
        last.sub = s;
        continue;
      }
    }
    groups.push({ src: s });
  }
  if (groups.length === 0) return null;
  const noteKey = useNoteKey();
  const [open, setOpen] = usePersistentOpen(`${noteKey}:bucket:traits`, false);
  return (
    <details
      className="rpg-feature-bucket rpg-feature-bucket-traits"
      open={open}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary>
        <span className="rpg-feature-bucket-label">Traits</span>
        <span className="rpg-feature-bucket-count">{groups.length}</span>
      </summary>
      <div className="rpg-feature-traits-summary">
        {groups.map(({ src, sub }) => (
          <TraitsSourceLine
            key={`${src.source}:${src.kind}`}
            src={src}
            sub={sub}
            casters={casters}
          />
        ))}
      </div>
    </details>
  );
}

// ─── Decisions log (collapsed review of picks already made) ───────────────────

interface Decision {
  /** Category rendered in the line label — the parent feature's choose
   *  `category` when present, else the feature name. */
  category: string;
  /** Picked values, verbatim (wikilinks supported — rendered as internal-links). */
  values: string[];
  /** Source + choices-map key this decision's picks live under. Clicking
   *  the undo control clears `choices[source][resetKey]`. */
  source: string;
  resetKey: string;
}

/** Roll up duplicate ASI picks into per-attribute totals: `["Wis","Wis","Cha"]`
 *  with quantity 1 becomes `["+2 Wisdom", "+1 Charisma"]`. Attributes appear
 *  in the order they were first picked. */
function aggregateAsiPicks(picks: string[], quantity: number): string[] {
  const totals = new Map<string, number>();
  for (const p of picks) totals.set(p, (totals.get(p) ?? 0) + quantity);
  return [...totals.entries()].map(([attr, total]) => `+${total} ${attr}`);
}

/** Strip the resolver's `@<level>` suffix off an internal pick key and
 *  reformat as `Name (Lv. X)` for human display. Pass-through for keys
 *  without the suffix. */
function prettifyLevelSuffix(name: string): string {
  const m = name.match(/^(.*)@(\d+)$/);
  return m ? `${m[1]} (Lv. ${m[2]})` : name;
}

/** Bucket pending choices by source, preserving the resolver's source order
 *  (classes first in declaration order, then lineage → heritage → background).
 *  Unknown sources (shouldn't normally happen) land at the end. */
function groupPendingsBySource(
  pendings: PendingChoice[],
  sources: ResolvedSource[],
): Array<{ source: string; pendings: PendingChoice[] }> {
  const order = new Map<string, number>();
  sources.forEach((s, i) => order.set(s.source, i));
  const groups = new Map<string, PendingChoice[]>();
  for (const p of pendings) {
    const bucket = groups.get(p.source) ?? [];
    bucket.push(p);
    groups.set(p.source, bucket);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (order.get(a) ?? Infinity) - (order.get(b) ?? Infinity))
    .map(([source, list]) => ({ source, pendings: list }));
}

interface DecisionGroup {
  /** Source this group of decisions came from (class / subclass / lineage /
   *  heritage / background). Used both as the visible header and as the
   *  wikilink target. */
  source: string;
  decisions: Decision[];
}

/**
 * Walk resolved sources + the character's recorded picks and bucket every
 * decision under its originating source, mirroring the layout of the
 * "Choices to make" section so the two sub-sections stay visually
 * symmetric. Decisions inside a source appear in `src.features` iteration
 * order, with any unknown-key picks (sub-choices fired by a picked
 * feature.choice option) appended at the end.
 */
function gatherDecisions(
  sources: ResolvedSource[],
  choices: FeaturesBlockData["choices"],
): DecisionGroup[] {
  if (!choices) return [];
  const groups: DecisionGroup[] = [];

  for (const src of sources) {
    const sourcePicks = choices[src.source];
    if (!sourcePicks) continue;

    const decisions: Decision[] = [];
    const seenFeatureNames = new Set<string>();

    for (const feature of src.features) {
      seenFeatureNames.add(feature.name);
      const raw = sourcePicks[feature.name];
      if (raw == null) continue;
      const values = Array.isArray(raw) ? raw : [raw];
      if (values.length === 0) continue;
      const rawChoose = feature.choose;
      // Accept both a scalar `choose:` and a single-element `choose:` array
      // as a "single spec" so the label can read the category. A true
      // multi-spec array (len > 1) stays undefined — those decisions
      // surface one per composite key below. Features with `buy:` keep
      // the bare feature name as the label since the picks in that bucket
      // are the buy options themselves (cost-spent enhancements), not a
      // specific trait category.
      const hasBuy = feature.buy != null;
      const singleChoose: ChooseSpec | undefined = Array.isArray(rawChoose)
        ? (rawChoose.length === 1 ? rawChoose[0] : undefined)
        : rawChoose;
      const isAsi = !hasBuy && singleChoose?.type === "asi";
      const category = prettifyLevelSuffix(
        hasBuy
          ? feature.name
          : singleChoose?.category ?? (isAsi ? "Ability Scores" : feature.name),
      );
      // ASI picks: aggregate duplicate attribute picks into a single
      // `+{total} {attr}` entry so the log reads as "+2 Wisdom" rather than
      // "+1 Wisdom, +1 Wisdom" when the user stacked picks.
      const decisionValues = isAsi
        ? aggregateAsiPicks(values, singleChoose?.quantity ?? 1)
        : values;
      decisions.push({
        category,
        values: decisionValues,
        source: src.source,
        resetKey: feature.name,
      });
    }

    // Picks stored under a key the source doesn't expose as a feature are
    // sub-choices fired by a picked feature.choice option, or per-spec
    // virtual features emitted by the resolver for multi-spec `choose:`
    // arrays (keyed `Parent:Category`). Strip the `Parent:` prefix so the
    // log shows the category rather than the internal composite key. Also
    // prettify any `@<level>` suffix the resolver attaches to multi-level
    // pick options (Improvement's per-level ASI sub-picks).
    for (const [key, raw] of Object.entries(sourcePicks)) {
      if (seenFeatureNames.has(key)) continue;
      const values = Array.isArray(raw) ? raw : [raw];
      if (values.length === 0) continue;
      const colonIdx = key.indexOf(":");
      const stripped = colonIdx >= 0 ? key.slice(colonIdx + 1) : key;
      const label = prettifyLevelSuffix(stripped);
      decisions.push({ category: label, values, source: src.source, resetKey: key });
    }

    if (decisions.length > 0) {
      groups.push({ source: src.source, decisions });
    }
  }

  return groups;
}

function DecisionsLog({
  sources,
  choices,
  onReset,
}: {
  sources: ResolvedSource[];
  choices: FeaturesBlockData["choices"];
  /** Called when the user clicks a decision's undo button. Clears every
   *  pick stored under `choices[source][resetKey]` so the feature's
   *  PendingChoice reappears for re-picking. */
  onReset?: (source: string, resetKey: string) => void;
}) {
  const groups = React.useMemo(() => gatherDecisions(sources, choices), [sources, choices]);
  if (groups.length === 0) return null;
  const total = groups.reduce((n, g) => n + g.decisions.length, 0);
  const noteKey = useNoteKey();
  const [open, setOpen] = usePersistentOpen(`${noteKey}:decisions`, false);
  return (
    <details
      className="rpg-feature-decisions"
      open={open}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary>
        <span className="rpg-feature-decisions-label">Decisions made</span>
        <span className="rpg-feature-decisions-count">{total}</span>
      </summary>
      <div className="rpg-feature-decisions-groups">
        {groups.map((g) => (
          <p key={g.source} className="rpg-feature-decisions-line">
            <a
              className="internal-link rpg-feature-decisions-source-link"
              href={g.source}
              data-href={g.source}
            >
              {g.source}
            </a>
            {" — "}
            {g.decisions.map((d, j) => (
              <React.Fragment key={j}>
                {j > 0 && ", "}
                <span className="rpg-feature-decisions-entry">
                  <strong>{d.category}</strong>
                  {" ("}
                  {d.values.map((v, k) => (
                    <React.Fragment key={k}>
                      {k > 0 && ", "}
                      <TraitValue value={v} />
                    </React.Fragment>
                  ))}
                  {")"}
                  {onReset && (
                    <button
                      type="button"
                      className="rpg-feature-decisions-undo"
                      aria-label={`Undo ${d.category}`}
                      title="Undo this decision"
                      onClick={() => onReset(d.source, d.resetKey)}
                    >
                      ↺
                    </button>
                  )}
                </span>
              </React.Fragment>
            ))}
          </p>
        ))}
      </div>
    </details>
  );
}

function FeaturesAccordion({
  view,
  trivials,
  characterLevel,
  context,
  spentMap,
  onSpentChange,
}: {
  view: ResolvedView;
  /** Trivial entries grouped by bucket id — each has its own .md page and
   *  renders as a compact comma-separated link list at the bottom of its
   *  bucket, beneath the full feature cards. */
  trivials: Record<string, FeatureEntry[]>;
  characterLevel?: number;
  context?: EvalContext;
  spentMap: Record<string, number>;
  onSpentChange?: (key: string, next: number) => void;
}) {
  const { byBucket, grantedTrivials } = React.useMemo(
    () => bucketize(view.sources),
    [view.sources],
  );
  // Merge entity-level defaults with any granted-trivial references (e.g.
  // Comrade's `bonus: [[Help]]`) so each bucket's trivial list is deduped
  // in one pass before rendering.
  const mergedTrivials = React.useMemo(() => {
    const out: Record<string, FeatureEntry[]> = {};
    for (const [bucket, entries] of Object.entries(trivials)) {
      out[bucket] = [...entries];
    }
    for (const [bucket, entries] of Object.entries(grantedTrivials)) {
      const list = (out[bucket] ??= []);
      const seen = new Set(list.map((e) => e.$name));
      for (const e of entries) {
        if (seen.has(e.$name)) continue;
        seen.add(e.$name);
        list.push(e);
      }
    }
    return out;
  }, [trivials, grantedTrivials]);
  return (
    <section className="rpg-feature-accordion" aria-label="Features by Type">
      {BUCKETS.map(({ id, label }) => (
        <Bucket
          key={id}
          id={id}
          label={label}
          entries={byBucket[id] ?? []}
          trivials={mergedTrivials[id] ?? []}
          characterLevel={characterLevel}
          context={context}
          spentMap={spentMap}
          onSpentChange={onSpentChange}
        />
      ))}
      <TraitsBucket sources={view.sources} casters={view.casters} />
    </section>
  );
}

// ─── Main block ──────────────────────────────────────────────────────────────

export const features: EntityBlock<FeaturesBlockData, CharacterEntity> = ({
  self,
  blocks,
  lookup,
  frontmatter,
}) => {
  const lib = lookup.$compendium;
  const header = (blocks.header ?? {}) as Partial<HeaderProps>;
  // Choices-to-make drawer remembers open/closed across reloads — defaults
  // to open so a fresh sheet shows pending picks immediately. Persisted
  // outside the YAML via localStorage (see usePersistentOpen).
  const noteKey = useNoteKey();
  const [pendingOpen, setPendingOpen] = usePersistentOpen(`${noteKey}:pending`, true);
  // Picking an option rewrites the YAML file in place, which makes Obsidian
  // re-render the entire markdown view from scratch — that resets scroll to
  // the top of the page. Set a session flag right before the YAML write so
  // we can scroll back to the pending-choices section once the new render
  // mounts. Keyed per note so multi-character workflows don't cross-trigger.
  const pendingRef = React.useRef<HTMLElement | null>(null);
  const scrollFlagKey = `rpg-ui:scroll-to-choices:${noteKey}`;
  React.useEffect(() => {
    try {
      if (typeof sessionStorage === "undefined") return;
      if (sessionStorage.getItem(scrollFlagKey) !== "1") return;
      sessionStorage.removeItem(scrollFlagKey);
    } catch {
      return;
    }
    // Wait for layout — the markdown re-render hasn't finished sizing the
    // accordion the first time this effect fires after a YAML write.
    const id = window.setTimeout(() => {
      pendingRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
    }, 50);
    return () => window.clearTimeout(id);
  }, [scrollFlagKey]);
  const markScrollPending = React.useCallback(() => {
    try {
      sessionStorage?.setItem(scrollFlagKey, "1");
    } catch {
      // sessionStorage unavailable (private mode, quota, …) — no-op.
    }
  }, [scrollFlagKey]);

  const decl: CharacterDecl = {
    classes: (header.classes ?? []).map((c) => ({
      name: linkStem(c.name) ?? "",
      level: c.level,
      // `sub:` is the terse alias for `subclass:` (see header block).
      // Either yields a stem the resolver can look up.
      subclass: linkStem((c as { sub?: unknown }).sub) ?? linkStem(c.subclass),
    })),
    lineage: pillStem(header.lineage),
    heritage: pillStem(header.heritage),
    background: pillStem(header.background),
    choices: self.choices,
    additional: self.additional,
  };

  const view = resolveFeatures(decl, lib);
  const primaryClass = (header.classes ?? [])[0];
  const characterLevel = primaryClass?.level;

  /* Build the expression context handed to every feature-card <Markdown>:
   *   - `tables` comes from the resolved view (every loaded source's tables
   *     keyed by bare `<name>` and fully-qualified `<source>:<name>`).
   *   - `vars` carries common identifiers authors use in `{{ … }}`
   *     expressions: class level, ability scores + modifiers, PB. Frontmatter
   *     is the source of truth; sensible defaults keep things rendering when
   *     a character file hasn't filled in every stat yet. */
  const context: EvalContext = React.useMemo(() => {
    const fm = (frontmatter ?? {}) as Record<string, unknown>;
    const num = (key: string, fallback: number) => {
      const v = fm[key];
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? n : fallback;
    };
    const mod = (score: number) => Math.floor((score - 10) / 2);
    const str = num("strength", 10);
    const dex = num("dexterity", 10);
    const con = num("constitution", 10);
    const intel = num("intelligence", 10);
    const wis = num("wisdom", 10);
    const cha = num("charisma", 10);
    const lv = characterLevel ?? num("level", 1);

    return {
      tables: view.tables,
      vars: {
        LV: lv,
        CLASS_LEVEL: lv,
        CLASS: primaryClass?.name ?? "",
        PB: num("proficiency_bonus", 2),
        STR: str, DEX: dex, CON: con, INT: intel, WIS: wis, CHA: cha,
        STR_MOD: mod(str),
        DEX_MOD: mod(dex),
        CON_MOD: mod(con),
        INT_MOD: mod(intel),
        WIS_MOD: mod(wis),
        CHA_MOD: mod(cha),
      },
    };
  }, [view.tables, characterLevel, primaryClass, frontmatter]);

  const setChoices = (self as { setChoices?: (u: (prev: FeaturesBlockData["choices"]) => FeaturesBlockData["choices"]) => void }).setChoices;
  const setSpent = (self as { setSpent?: (u: (prev: FeaturesBlockData["spent"]) => FeaturesBlockData["spent"]) => void }).setSpent;
  const spentMap = self.spent ?? {};
  const handleSpentChange = setSpent
    ? (key: string, next: number) => {
        setSpent((prev) => {
          const out = { ...(prev ?? {}) };
          if (next <= 0) delete out[key];
          else out[key] = next;
          return out;
        });
      }
    : undefined;
  const makeToggle = (source: string, featureName: string) =>
    setChoices
      ? (option: string) => {
          markScrollPending();
          setChoices((prev) => {
            const next: NonNullable<FeaturesBlockData["choices"]> = { ...(prev ?? {}) };
            const sourcePicks = { ...(next[source] ?? {}) };
            const current = sourcePicks[featureName];
            const currentArr = Array.isArray(current)
              ? [...current]
              : current
                ? [current]
                : [];
            const idx = currentArr.indexOf(option);
            if (idx >= 0) currentArr.splice(idx, 1);
            else currentArr.push(option);
            if (currentArr.length === 0) delete sourcePicks[featureName];
            else sourcePicks[featureName] = currentArr;
            next[source] = sourcePicks;
            return next;
          });
        }
      : undefined;
  /** ASI picker: `delta === 1` appends a pick; `delta === -1` removes the
   *  most recent occurrence. Duplicates are meaningful (one per point), so
   *  this is additive by design rather than a toggle. */
  const makePicker = (source: string, featureName: string) =>
    setChoices
      ? (option: string, delta: 1 | -1) => {
          markScrollPending();
          setChoices((prev) => {
            const next: NonNullable<FeaturesBlockData["choices"]> = { ...(prev ?? {}) };
            const sourcePicks = { ...(next[source] ?? {}) };
            const current = sourcePicks[featureName];
            const currentArr = Array.isArray(current)
              ? [...current]
              : current
                ? [current]
                : [];
            if (delta > 0) {
              currentArr.push(option);
            } else {
              const idx = currentArr.lastIndexOf(option);
              if (idx >= 0) currentArr.splice(idx, 1);
            }
            if (currentArr.length === 0) delete sourcePicks[featureName];
            else sourcePicks[featureName] = currentArr;
            next[source] = sourcePicks;
            return next;
          });
        }
      : undefined;
  /** Clears every pick stored under `choices[source][key]`. Used by the
   *  Decisions-log undo control so users can flip any previously-locked-in
   *  decision and re-pick from the pending row that reappears. */
  const makeReset = setChoices
    ? (source: string, key: string) => {
        markScrollPending();
        setChoices((prev) => {
          const next: NonNullable<FeaturesBlockData["choices"]> = { ...(prev ?? {}) };
          const sourcePicks = { ...(next[source] ?? {}) };
          if (!(key in sourcePicks)) return prev ?? {};
          delete sourcePicks[key];
          if (Object.keys(sourcePicks).length === 0) delete next[source];
          else next[source] = sourcePicks;
          return next;
        });
      }
    : undefined;

  /** Universal "default actions" the system declares on the character
   *  entity (Dash, Disengage, Opportunity Attack, …). Each lives as its
   *  own vault page and is shown as a compact link list in its bucket
   *  rather than a full card. Group by the entry's `type`, which maps
   *  directly to a bucket id.
   *
   *  The character's spells also fold in here: every granted/known spell
   *  gets classified by casting time (`1 action` / `1 bonus action` /
   *  `1 reaction`) and listed as a trivial in the matching bucket so
   *  the features sheet surfaces castable options alongside class
   *  actions. Spells with other casting times (1 minute, 10 minutes,
   *  ritual-only) stay exclusive to the Spells block. */
  const spellsBlock = (blocks as Record<string, unknown>).spells as SpellsProps | undefined;
  const spellLibrary = (lookup.$spells ?? {}) as Record<string, Record<string, unknown>>;
  const trivialsByBucket = React.useMemo(() => {
    const out: Record<string, FeatureEntry[]> = {};
    for (const entry of (lookup.$defaultFeatures ?? [])) {
      const bucket = (entry.type ?? "").toLowerCase();
      if (!bucket) continue;
      (out[bucket] ??= []).push(entry);
    }
    const spellTrivials = collectSpellTrivials(
      view.casters,
      spellsBlock?.casters ?? {},
      spellLibrary,
    );
    for (const [bucket, entries] of Object.entries(spellTrivials)) {
      const list = (out[bucket] ??= []);
      const seen = new Set(list.map((e) => e.$name));
      for (const e of entries) {
        if (seen.has(e.$name)) continue;
        seen.add(e.$name);
        list.push(e);
      }
    }
    return out;
  }, [lookup.$defaultFeatures, view.casters, spellsBlock, spellLibrary]);

  return (
    <section aria-label="Character Features" className="rpg-feature-source-groups">
      {view.sources.length === 0 ? (
        <p aria-details="No Sources"><em>No class, lineage, or background declared.</em></p>
      ) : (
        <FeaturesAccordion
          view={view}
          trivials={trivialsByBucket}
          characterLevel={characterLevel}
          context={context}
          spentMap={spentMap}
          onSpentChange={handleSpentChange}
        />
      )}
      {(view.pendingChoices.length > 0 || Object.keys(self.choices ?? {}).length > 0) && (
        <section
          ref={pendingRef}
          aria-label="Pending Choices"
          className="rpg-feature-pending-list"
        >
          {(() => {
            // Buy-mode pendings are always emitted by the resolver (it
            // can't evaluate the budget expression) so the UI filters
            // them out once the player has spent every available point.
            // The pick log still carries the picks in Decisions Made,
            // and undoing a decision re-opens the row automatically.
            const visiblePendings = view.pendingChoices.filter((p) => {
              const isBuyEmission = p.feature.buy != null && p.feature.choose == null;
              if (!isBuyEmission) return true;
              const budget = evalBuyBudget(p.feature.buy, context.vars) ?? 0;
              const spent = p.picked.reduce((sum, name) => {
                const opt = p.options.find((o) => (o.name ?? "") === name);
                return sum + (typeof opt?.cost === "number" ? opt.cost : 0);
              }, 0);
              return budget - spent > 0;
            });
            return visiblePendings.length > 0 ? (
              <details
                className="rpg-feature-pending-details"
                open={pendingOpen}
                onToggle={(e) => setPendingOpen((e.currentTarget as HTMLDetailsElement).open)}
              >
                <summary>
                  <span className="rpg-feature-pending-label">Choices to make</span>
                  <span className="rpg-feature-pending-count">{visiblePendings.length}</span>
                </summary>
                <div className="rpg-feature-pending-groups">
                  {groupPendingsBySource(visiblePendings, view.sources).map(({ source, pendings }) => (
                    <div key={source} className="rpg-feature-pending-group">
                      <h3 className="rpg-feature-pending-group-label">
                        <a className="internal-link" href={source} data-href={source}>
                          {source}
                        </a>
                      </h3>
                      {pendings.map((p) => (
                        <PendingChoiceRow
                          key={`${p.source}:${p.feature.name}`}
                          pending={p}
                          onToggle={makeToggle(p.source, p.feature.name)}
                          onPick={makePicker(p.source, p.feature.name)}
                          buyBudget={evalBuyBudget(p.feature.buy, context.vars)}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </details>
            ) : null;
          })()}
          <DecisionsLog sources={view.sources} choices={self.choices} onReset={makeReset} />
        </section>
      )}
    </section>
  );
};

export default features;
