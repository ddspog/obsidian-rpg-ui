import * as React from "react";
import {
  EntityBlock,
  Markdown,
  ResolvedCaster,
  expandOptionRefs,
} from "rpg-ui-toolkit";
import type { CharacterEntity } from "../../entities/character.types";
import type { FeaturesBlockData } from "./features.types";
import type { CasterState, SpellsProps } from "./spells.types";
import { slotsForCaster } from "../../entities/character.lookup";

/** Strip a wikilink value down to its bare basename so Map lookups and
 *  dedupe work. YAML's nested-array shape and `[[Foo|alias]]` pipes both
 *  collapse to `Foo`. */
function bareStem(raw: unknown): string {
  let v: unknown = raw;
  while (Array.isArray(v)) v = v[0];
  if (typeof v !== "string") return "";
  return v
    .replace(/^\[\[/, "")
    .replace(/\]\]$/, "")
    .replace(/\.md$/, "")
    .split("|")[0]
    .trim();
}

/** Format an array or scalar into a comma-joined label (magic_source,
 *  components, style, …). Each element goes through `bareStem` so
 *  `[[Divine]]` renders as `Divine`. */
function joinLabels(value: unknown): string {
  if (value == null) return "";
  if (Array.isArray(value)) {
    const parts: string[] = [];
    for (const v of value) {
      const s = bareStem(v);
      if (s) parts.push(s);
      else if (typeof v === "string" && v.trim()) parts.push(v.trim());
    }
    return parts.join(", ");
  }
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
}

/** True when the character has any spell pick stored across any of
 *  their casters — keeps the Decisions-made drawer hidden until there's
 *  something to show. */
function hasAnyPicks(
  casters: ResolvedCaster[],
  castersState: Record<string, CasterState>,
): boolean {
  for (const caster of casters) {
    const state = castersState[caster.source];
    if (!state) continue;
    if ((state.cantrips ?? []).length > 0) return true;
    const maps: Array<Partial<Record<number, string[]>> | undefined> = [
      state.prepared,
      state.known,
      state.rituals,
    ];
    for (const m of maps) {
      if (!m) continue;
      for (const list of Object.values(m)) {
        if ((list ?? []).length > 0) return true;
      }
    }
  }
  return false;
}

/** Evaluate a caster's `prepared_max` expression against the character
 *  vars. Supports simple arithmetic over identifiers like `WIS_MOD`,
 *  `LV`, `PB`. Returns 0 when the expression is malformed or missing. */
function evalPreparedMax(
  expr: string | undefined,
  vars: Record<string, number>,
): number {
  if (!expr || !expr.trim()) return 0;
  let rewritten = expr;
  // Longest identifiers first so `WIS_MOD` doesn't get partially
  // replaced by a rule for `WIS`.
  const keys = Object.keys(vars).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    rewritten = rewritten.replace(new RegExp(`\\b${k}\\b`, "g"), String(vars[k]));
  }
  // Refuse anything that still has non-numeric / non-operator characters
  // so we never hand unresolved identifiers to the evaluator.
  if (!/^[-+*/() \d.]+$/.test(rewritten)) return 0;
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const value = Function(`"use strict"; return (${rewritten})`)();
    return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  } catch {
    return 0;
  }
}

function useNoteKey(): string {
  return React.useMemo(() => {
    const app = (globalThis as unknown as { app?: { workspace?: { getActiveFile?: () => { path?: string } | null } } }).app;
    return app?.workspace?.getActiveFile?.()?.path ?? "default";
  }, []);
}

/** Persistent `<details>` open state per caster+circle; mirrors the
 *  features block's helper so reloads keep the user's drawer layout. */
function usePersistentOpen(storageKey: string, defaultOpen: boolean) {
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
        // ignore
      }
    },
    [storageKey],
  );
  return [open, update] as const;
}

// ─── Ability modifier ─────────────────────────────────────────────────────

/** Read one of STR/DEX/…/CHA from the stats block and compute its modifier. */
function abilityModifier(stats: Record<string, unknown> | undefined, ability: string): number {
  if (!stats) return 0;
  const raw = stats[ability];
  let score = 10;
  if (typeof raw === "number") score = raw;
  else if (raw && typeof raw === "object" && typeof (raw as { value?: number }).value === "number") {
    score = (raw as { value: number }).value;
  }
  return Math.floor((score - 10) / 2);
}

function signed(n: number): string {
  return n >= 0 ? `+${n}` : `\u2212${Math.abs(n)}`;
}

// ─── Spell entry (one card per spell) ────────────────────────────────────

type SpellGroup = "prepared" | "granted" | "ritual" | "known";

const GROUP_LABEL: Record<SpellGroup, string> = {
  prepared: "prepared",
  granted: "granted",
  ritual: "ritual",
  known: "known",
};

interface SpellDoc {
  circle?: string;
  source?: unknown;
  school?: string;
  casting?: string;
  range?: string;
  components?: unknown;
  duration?: string;
  style?: unknown;
  summary?: string;
  text?: string;
}

function SpellEntry({
  spellName,
  group,
  doc,
  enablerSource,
}: {
  spellName: string;
  group: SpellGroup;
  doc: SpellDoc | undefined;
  enablerSource: string;
}) {
  const stem = bareStem(spellName);
  // Three-row layout:
  //   row 1: [name] [casting to cast] [style] · [group]           [enabler]
  //   row 2: [range] · [components] · [duration]
  //   row 3: [full markdown text spans both grid columns]
  const styleLabel = doc ? joinLabels(doc.style) : "";
  const componentsLabel = doc?.components != null ? joinLabels(doc.components) : "";
  const subParts: Array<{ key: string; label: string; value: string }> = [];
  if (doc?.range) subParts.push({ key: "range", label: "Range", value: doc.range });
  if (componentsLabel) subParts.push({ key: "components", label: "Components", value: componentsLabel });
  if (doc?.duration) subParts.push({ key: "duration", label: "Duration", value: doc.duration });
  return (
    <li className="rpg-spell-entry" data-group={group}>
      <span className="rpg-spell-entry-header">
        <a className="internal-link rpg-spell-entry-name" href={stem} data-href={stem}>
          {stem}
        </a>
        {doc?.casting && (
          <>
            <span className="rpg-spell-entry-sep">{" · "}</span>
            <small className="rpg-spell-entry-casting" aria-details="Casting Time">
              {doc.casting} to cast
            </small>
          </>
        )}
        {styleLabel && (
          <>
            <span className="rpg-spell-entry-sep">{" · "}</span>
            <small className="rpg-spell-entry-style" aria-details="Style">
              {styleLabel}
            </small>
          </>
        )}
        <span className="rpg-spell-entry-sep">{" · "}</span>
        <small className="rpg-spell-entry-group" aria-details="Spell Group">
          <em>{GROUP_LABEL[group]}</em>
        </small>
      </span>
      <a
        className="internal-link rpg-spell-entry-enabler"
        href={enablerSource}
        data-href={enablerSource}
        aria-details="Enabling Source"
      >
        {enablerSource}
      </a>
      {subParts.length > 0 && (
        <span className="rpg-spell-entry-subline">
          {subParts.map((p, i) => (
            <React.Fragment key={p.key}>
              {i > 0 && <span className="rpg-spell-entry-sep"> · </span>}
              <small aria-details={p.label}>{p.value}</small>
            </React.Fragment>
          ))}
        </span>
      )}
      {doc?.text && (
        <Markdown
          source={doc.text}
          className="rpg-spell-entry-text"
        />
      )}
    </li>
  );
}

// ─── Slot pips ───────────────────────────────────────────────────────────

function SlotPips({
  max,
  spent,
  onChange,
}: {
  max: number;
  spent: number;
  onChange?: (next: number) => void;
}) {
  if (max === 0) return null;
  const clamped = Math.max(0, Math.min(max, spent));
  const spend = () => onChange?.(Math.min(max, clamped + 1));
  const unspend = () => onChange?.(Math.max(0, clamped - 1));
  return (
    <output
      aria-label={`${max - clamped} of ${max} slots remaining`}
      className="rpg-spell-slots"
    >
      {Array.from({ length: max }, (_, i) => {
        const isSpent = i < clamped;
        return (
          <button
            key={i}
            type="button"
            className="rpg-spell-slot"
            data-spent={isSpent ? "true" : "false"}
            aria-label={isSpent ? "Recover slot" : "Spend slot"}
            onClick={() => (isSpent ? unspend() : spend())}
          >
            {isSpent ? "\u25CF" : "\u25CB"}
          </button>
        );
      })}
    </output>
  );
}

// ─── Circle drawer (bucket equivalent from features) ─────────────────────

interface CircleEntries {
  prepared: string[];
  granted: string[];
  ritual: string[];
  known: string[];
}

function bundleForCircle(
  caster: ResolvedCaster,
  state: CasterState,
  circle: number,
  spells: Record<string, Record<string, unknown>>,
): CircleEntries {
  const out: CircleEntries = { prepared: [], granted: [], ritual: [], known: [] };
  const push = (bucket: keyof CircleEntries, name: string) => {
    const bare = bareStem(name);
    if (bare && !out[bucket].includes(bare)) out[bucket].push(bare);
  };
  if (circle === 0) {
    for (const [lvlStr, raws] of Object.entries(caster.granted.cantrips)) {
      if (Number(lvlStr) > caster.level) continue;
      for (const s of raws) push("granted", s);
    }
    for (const s of state.cantrips ?? []) push("known", s);
    return out;
  }
  // Granted-prepared: approximate circle from the grant caster-level
  // when the spell doc doesn't carry an explicit circle. Prefer the
  // doc's declared `circle` whenever available so Life Domain's 3→1st,
  // 5→2nd, 7→3rd, 9→4th/5th mapping stays honest.
  for (const [lvlStr, raws] of Object.entries(caster.granted.prepared)) {
    if (Number(lvlStr) > caster.level) continue;
    for (const s of raws) {
      const stem = bareStem(s);
      const doc = spells[stem];
      const docCircle = typeof doc?.circle === "string" ? circleNumber(doc.circle as string) : undefined;
      const fallback = Math.ceil(Number(lvlStr) / 2);
      if ((docCircle ?? fallback) === circle) push("granted", s);
    }
  }
  for (const s of state.prepared?.[circle] ?? []) push("prepared", s);
  for (const s of state.known?.[circle] ?? []) push("known", s);
  // Rituals are stored keyed by LEVEL OF ACQUISITION, not circle —
  // each pick is anchored to the class level that unlocked it, since the
  // picker surfaces one row per ritual-granting level. Aggregate across
  // levels here and bucket each spell by the circle recorded on its
  // `rpg spell` doc. Unknown spells (no doc entry) fall back to the
  // caster-level→circle heuristic used for granted rituals above.
  for (const [lvlStr, raws] of Object.entries(state.rituals ?? {})) {
    if (Number(lvlStr) > caster.level) continue;
    for (const s of raws ?? []) {
      const stem = bareStem(s);
      const doc = spells[stem];
      const docCircle = typeof doc?.circle === "string" ? circleNumber(doc.circle as string) : undefined;
      const fallback = Math.ceil(Number(lvlStr) / 2);
      if ((docCircle ?? fallback) === circle) push("ritual", s);
    }
  }
  return out;
}

/** Parse `Cantrip` / `1st-Circle` / `2nd-Circle` / … → 0-9. */
function circleNumber(raw: string): number | undefined {
  const trimmed = raw.trim().toLowerCase();
  if (trimmed === "cantrip" || trimmed === "cantrips" || trimmed === "0") return 0;
  const m = trimmed.match(/^(\d+)/);
  if (m) return parseInt(m[1], 10);
  return undefined;
}

function CircleDrawer({
  caster,
  circle,
  slotsMax,
  spent,
  onSpentChange,
  entries,
  spells,
  noteKey,
}: {
  caster: ResolvedCaster;
  circle: number;
  slotsMax: number;
  spent: number;
  onSpentChange?: (next: number) => void;
  entries: CircleEntries;
  spells: Record<string, Record<string, unknown>>;
  noteKey: string;
}) {
  const [open, setOpen] = usePersistentOpen(
    `${noteKey}:spells:${caster.source}:${circle}`,
    circle === 0,
  );
  const label = circle === 0 ? "Cantrips" : `${ordinal(circle)} Circle`;
  const total =
    entries.prepared.length
    + entries.granted.length
    + entries.ritual.length
    + entries.known.length;
  const ordered: Array<{ group: SpellGroup; name: string }> = [
    ...entries.prepared.map((n) => ({ group: "prepared" as const, name: n })),
    ...entries.granted.map((n) => ({ group: "granted" as const, name: n })),
    ...entries.ritual.map((n) => ({ group: "ritual" as const, name: n })),
    ...entries.known.map((n) => ({ group: "known" as const, name: n })),
  ];
  return (
    <details
      className="rpg-spell-circle"
      data-circle={circle}
      open={open}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary>
        <span className="rpg-spell-circle-label">{label}</span>
        {circle !== 0 && slotsMax > 0 && (
          <SlotPips max={slotsMax} spent={spent} onChange={onSpentChange} />
        )}
        <span className="rpg-spell-circle-count">{total}</span>
      </summary>
      {total === 0 ? (
        <p aria-details="Empty Circle"><em>—</em></p>
      ) : (
        <ul aria-label={`${label} Spells`} className="rpg-spell-entries">
          {ordered.map(({ group, name }) => {
            const stem = bareStem(name);
            // Granted entries attribute back to the feature/subclass
            // that gave them (`Life Domain Spells`, `Ritualist`, …) via
            // the caster's `grantedBy` map. User picks fall back to
            // the caster's own source (the class or talent that owns
            // the slot budget).
            const enabler = caster.grantedBy[stem] ?? caster.source;
            return (
              <SpellEntry
                key={`${group}:${name}`}
                spellName={name}
                group={group}
                doc={spells[stem] as SpellDoc | undefined}
                enablerSource={enabler}
              />
            );
          })}
        </ul>
      )}
    </details>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ─── Caster section (one per source; multiclass stacks) ──────────────────

function CasterSection({
  caster,
  state,
  spells,
  onSpentChange,
  noteKey,
  abilityMod,
  proficiencyBonus,
}: {
  caster: ResolvedCaster;
  state: CasterState;
  spells: Record<string, Record<string, unknown>>;
  onSpentChange?: (circle: number, next: number) => void;
  noteKey: string;
  abilityMod: number;
  proficiencyBonus: number;
}) {
  const slots = slotsForCaster(caster.tier, caster.level);
  const highest = slots.reduce((max, n, i) => (n > 0 ? i + 1 : max), 0);
  // Spell save DC = 8 + proficiency bonus + spellcasting ability modifier.
  const saveDc = 8 + proficiencyBonus + abilityMod;
  return (
    <article aria-label={`Spellcasting · ${caster.source}`} className="rpg-caster">
      <header className="rpg-caster-header">
        <span>
          Spellcasting · {caster.source}
          <small className="rpg-caster-meta">
            {caster.ability
              ? <>{" "}· {caster.ability} {signed(abilityMod)}{" "}· DC {saveDc}</>
              : <>{" "}· <em>pick ability</em></>}
            {" "}· {caster.type === "prepared" ? "prepared" : "known"}
            {caster.tier !== "none" && <>{" "}· {caster.tier}-caster</>}
          </small>
        </span>
      </header>
      <div className="rpg-caster-body">
        {(() => {
          const cantripEntries = bundleForCircle(caster, state, 0, spells);
          // Always render the Cantrips drawer when the caster has any
          // cantrip budget — even empty, so the user sees the slot
          // count and can pick into it via the pending drawer.
          if (caster.cantrips === 0
            && cantripEntries.prepared.length === 0
            && cantripEntries.granted.length === 0
            && cantripEntries.ritual.length === 0
            && cantripEntries.known.length === 0) {
            return null;
          }
          return (
            <CircleDrawer
              caster={caster}
              circle={0}
              slotsMax={0}
              spent={0}
              entries={cantripEntries}
              spells={spells}
              noteKey={noteKey}
            />
          );
        })()}
        {Array.from({ length: highest }, (_, i) => {
          const circle = i + 1;
          const max = slots[i] ?? 0;
          const spent = state.spent?.[circle] ?? 0;
          const entries = bundleForCircle(caster, state, circle, spells);
          // Every unlocked circle renders, even when empty — hiding
          // them makes the slot budget invisible and blocks the user
          // from preparing into circles they haven't touched yet.
          return (
            <CircleDrawer
              key={circle}
              caster={caster}
              circle={circle}
              slotsMax={max}
              spent={spent}
              onSpentChange={(n) => onSpentChange?.(circle, n)}
              entries={bundleForCircle(caster, state, circle, spells)}
              spells={spells}
              noteKey={noteKey}
            />
          );
        })}
      </div>
    </article>
  );
}

// ─── Pending choice drawer (cantrip + prepared + ritual picker) ─────────

interface PendingCircleBucket {
  circle: number;
  options: string[];
  picked: string[];
  /** Style-flavor exceptions for this circle — spells outside the pool
   *  but matching the caster's `style` list. Rendered dashed-border. */
  flavorOptions?: string[];
}

interface SpellPending {
  source: string;
  category: "cantrips" | "prepared" | "rituals";
  /** Short UI label ("Known Cantrips", "Prepared Spells", "Lv. 3 Rituals"). */
  label: string;
  remaining: number;
  /** Flat list of picks for this category (across all circles when the
   *  category spans multiple, e.g. prepared). */
  picked: string[];
  /** Simple flat option list — used for cantrips. */
  options?: string[];
  /** Flat flavor exceptions for flat pickers. */
  flavorOptions?: string[];
  /** Circle-grouped option list — used for prepared + rituals. Renders
   *  one sub-section per circle under a single "pick N more" label. */
  circles?: PendingCircleBucket[];
  /** For per-level ritual rows, the class level that granted this
   *  ritual budget. Routed to `state.rituals[level]` on pick. */
  level?: number;
}

/** Return the set of spells from the library whose `style` attribute
 *  intersects the caster's declared style list BUT that aren't in the
 *  `inPool` set. These become flavor-exception options on the picker
 *  so the player can venture outside the official spell list for their
 *  declared magic flavor. Output uses wikilink syntax to stay
 *  compatible with the rest of the options pipeline. */
function collectFlavorOptions(
  caster: ResolvedCaster,
  inPool: Set<string>,
  spellLibrary: Record<string, Record<string, unknown>>,
): string[] {
  if (!caster.style || caster.style.length === 0) {
    return [];
  }
  // Normalise any style token — scalar, wikilink, nested array — down
  // to a lowercase bare stem so the compare is reliable regardless of
  // how the author wrote it in YAML. `"[[Dream]]"` and `"Dream"` and
  // `[["Dream"]]` all collapse to `"dream"`.
  const normaliseOne = (v: unknown): string => {
    let cur: unknown = v;
    while (Array.isArray(cur)) cur = cur[0];
    if (typeof cur !== "string") return "";
    return cur.replace(/^\[\[/, "").replace(/\]\]$/, "").split("|")[0].trim().toLowerCase();
  };
  const collectStrings = (v: unknown, out: string[]) => {
    if (v == null) return;
    if (Array.isArray(v)) {
      // YAML `[[X]]` parses as a 1×1 nested flow array — treat it as
      // a single wikilink, not two nested list levels.
      if (v.length === 1 && Array.isArray(v[0]) && v[0].length === 1 && typeof v[0][0] === "string") {
        const n = normaliseOne(v[0][0]);
        if (n) out.push(n);
        return;
      }
      for (const x of v) collectStrings(x, out);
      return;
    }
    if (typeof v === "string") {
      for (const part of v.split(",")) {
        const n = normaliseOne(part);
        if (n) out.push(n);
      }
    }
  };
  const styleSet = new Set<string>();
  for (const s of caster.style) {
    const list: string[] = [];
    collectStrings(s, list);
    for (const n of list) styleSet.add(n);
  }
  if (styleSet.size === 0) return [];
  const out: string[] = [];
  for (const [stem, doc] of Object.entries(spellLibrary)) {
    if (inPool.has(stem)) continue;
    const list: string[] = [];
    collectStrings((doc as { style?: unknown }).style, list);
    if (list.some((s) => styleSet.has(s))) {
      out.push(`[[${stem}]]`);
    }
  }
  return out;
}

function collectPending(
  casters: ResolvedCaster[],
  castersState: Record<string, CasterState>,
  tagIndex: Record<string, string[]> | undefined,
  folderIndex: Record<string, string[]> | undefined,
  preparedBudgets: Record<string, number>,
  spellLibrary: Record<string, Record<string, unknown>>,
  /** Character-level extra styles (from the spells-block YAML's
   *  `style:`) — merged additively into every caster's own declared
   *  style list so flavor picks apply even when the class config
   *  didn't declare the style itself. */
  extraStyles?: unknown[],
): SpellPending[] {
  const out: SpellPending[] = [];
  for (const caster of casters) {
    const state = castersState[caster.source] ?? {};
    // Merge character-level extraStyles into this caster's own
    // declared style list. The block-side `style:` is a common way
    // for the SHEET author to attune a character to additional
    // flavors without having to edit the class's shared config.
    const mergedStyles: string[] = [];
    const pushStyle = (v: unknown) => {
      let cur: unknown = v;
      while (Array.isArray(cur)) cur = cur[0];
      if (typeof cur !== "string") return;
      const n = cur.replace(/^\[\[/, "").replace(/\]\]$/, "").split("|")[0].trim();
      if (n && !mergedStyles.includes(n)) mergedStyles.push(n);
    };
    for (const s of caster.style ?? []) pushStyle(s);
    for (const s of extraStyles ?? []) pushStyle(s);
    const effectiveCaster: ResolvedCaster = { ...caster, style: mergedStyles };
    // ── Cantrips (known) ───────────────────────────────────────────
    const cantripPicks = (state.cantrips ?? []).map(bareStem).filter(Boolean);
    const cantripDeficit = Math.max(0, caster.cantrips - cantripPicks.length);
    const mainPool = caster.pool ? expandOptionRefs([caster.pool], tagIndex, folderIndex) : [];
    const cantripSource = caster.cantrip_pool ?? caster.pool;
    const cantripRaw = cantripSource ? expandOptionRefs([cantripSource], tagIndex, folderIndex) : [];
    const cantripPool =
      caster.cantrip_pool && caster.pool && mainPool.length > 0
        ? cantripRaw.filter((c) => mainPool.includes(c))
        : cantripRaw;
    if (cantripDeficit > 0) {
      const inPool = new Set(cantripPool.map(bareStem));
      // Flavor exceptions for cantrips: library spells outside the
      // cantrip pool whose style matches AND whose circle is "Cantrip".
      const flavor = collectFlavorOptions(effectiveCaster, inPool, spellLibrary)
        .filter((ref) => {
          const stem = bareStem(ref);
          const doc = spellLibrary[stem] as { circle?: unknown } | undefined;
          const c = typeof doc?.circle === "string" ? circleNumber(doc.circle as string) : undefined;
          return c === 0;
        });
      out.push({
        source: caster.source,
        category: "cantrips",
        label: "Known Cantrips",
        remaining: cantripDeficit,
        picked: cantripPicks,
        options: cantripPool,
        flavorOptions: flavor.length > 0 ? flavor : undefined,
      });
    }
    // ── Prepared (prepared casters only — one composite row grouping
    //    options by circle) ─────────────────────────────────────────
    //
    // Prepared casters share a single `prepared_max` budget across
    // every circle. Surfacing one row per circle meant the "pick N
    // more" label repeated on every row; collapsing to a single row
    // with per-circle sub-sections keeps the budget legible.
    if (caster.type === "prepared" && mainPool.length > 0) {
      const budget = preparedBudgets[caster.source] ?? 0;
      const preparedPicksByCircle: Record<number, string[]> = {};
      const allPicks: string[] = [];
      for (const [cStr, list] of Object.entries(state.prepared ?? {})) {
        const c = Number(cStr);
        if (!Number.isFinite(c)) continue;
        const bucket = (preparedPicksByCircle[c] ??= []);
        for (const s of list ?? []) {
          const stem = bareStem(s);
          if (stem) {
            bucket.push(stem);
            allPicks.push(stem);
          }
        }
      }
      const deficit = Math.max(0, budget - allPicks.length);
      if (deficit > 0) {
        const slots = slotsForCaster(caster.tier, caster.level);
        const maxCircle = slots.reduce((m, n, i) => (n > 0 ? i + 1 : m), 0);
        const poolByCircle: Record<number, string[]> = {};
        const inPool = new Set<string>();
        for (const ref of mainPool) {
          const stem = bareStem(ref);
          inPool.add(stem);
          const doc = spellLibrary[stem] as { circle?: unknown } | undefined;
          const rawCircle = typeof doc?.circle === "string" ? doc.circle : "";
          const c = rawCircle ? circleNumber(rawCircle) : undefined;
          if (c == null || c === 0 || c > maxCircle) continue;
          (poolByCircle[c] ??= []).push(ref);
        }
        // Flavor exceptions bucketed by circle.
        const flavorByCircle: Record<number, string[]> = {};
        for (const ref of collectFlavorOptions(effectiveCaster, inPool, spellLibrary)) {
          const stem = bareStem(ref);
          const doc = spellLibrary[stem] as { circle?: unknown } | undefined;
          const rawCircle = typeof doc?.circle === "string" ? doc.circle : "";
          const c = rawCircle ? circleNumber(rawCircle) : undefined;
          if (c == null || c === 0 || c > maxCircle) continue;
          (flavorByCircle[c] ??= []).push(ref);
        }
        const circles: PendingCircleBucket[] = [];
        for (let c = 1; c <= maxCircle; c++) {
          const options = poolByCircle[c] ?? [];
          const flavor = flavorByCircle[c] ?? [];
          if (options.length === 0 && flavor.length === 0) continue;
          circles.push({
            circle: c,
            options,
            picked: preparedPicksByCircle[c] ?? [],
            flavorOptions: flavor.length > 0 ? flavor : undefined,
          });
        }
        if (circles.length > 0) {
          out.push({
            source: caster.source,
            category: "prepared",
            label: "Prepared Spells",
            remaining: deficit,
            picked: allPicks,
            circles,
          });
        }
      }
    }
    // ── Rituals (one row per acquisition level) ────────────────────
    //
    // Each `rituals: N` increment in the class's spellcasting config
    // gets its own pending row — "pick N more for Lv. 3 Rituals" — so
    // the player can see and tick off each ritual separately. Picks
    // land in `state.rituals[level]` keyed by the level that granted
    // the budget. Each row's options are filtered to circles the
    // caster had unlocked AT THAT LEVEL (not current level) since the
    // rule "only from a circle for which you have spell slots" is
    // pinned to the pick moment.
    //
    // Ritual spells are identified by the spell doc's `circle` string
    // containing "ritual" (case-insensitive) — Tales of the Valiant
    // stores them at `circle: "1st-Circle Ritual"` inside folders like
    // `worldbuilding/spells/1st-circle-ritual`. The ritual pool falls
    // back to the caster's main `pool` when no dedicated ritual_pool
    // is declared; in either case we filter down to ritual-flagged
    // spells before bucketing by circle.
    if ((caster.rituals > 0 || caster.rituals_per_circle > 0) && (caster.ritual_pool || caster.pool)) {
      const poolRef = caster.ritual_pool ?? caster.pool!;
      const rawRitualPool = expandOptionRefs([poolRef], tagIndex, folderIndex);
      const ritualPool = rawRitualPool.filter((ref) => {
        const stem = bareStem(ref);
        const doc = spellLibrary[stem] as { circle?: unknown } | undefined;
        const raw = typeof doc?.circle === "string" ? doc.circle : "";
        return /ritual/i.test(raw);
      });
      const inRitualPool = new Set(ritualPool.map(bareStem));
      const flavorRitualRefs = collectFlavorOptions(effectiveCaster, inRitualPool, spellLibrary)
        .filter((ref) => {
          const stem = bareStem(ref);
          const doc = spellLibrary[stem] as { circle?: unknown } | undefined;
          const raw = typeof doc?.circle === "string" ? doc.circle : "";
          return /ritual/i.test(raw);
        });
      // Fold `rituals_per_circle` (Ritualist talent, heritage grants, …)
      // into the per-level ritual budget. Each circle's first-unlock level
      // gets +N rituals — mirrors the rule "when a new circle unlocks,
      // add one ritual to your book". For circles that unlocked BEFORE the
      // talent was taken, we attribute their rituals to the unlock level
      // even though the player picks them now; since the row gates by
      // `level <= caster.level`, they stay pickable.
      const effectiveByLevel: Record<number, number> = { ...(caster.ritualsByLevel ?? {}) };
      if (caster.rituals_per_circle > 0) {
        const slotsAtCurrent = slotsForCaster(caster.tier, caster.level);
        const maxCircleNow = slotsAtCurrent.reduce((m, n, i) => (n > 0 ? i + 1 : m), 0);
        // First-unlock level per circle: smallest class level whose slot
        // table has a non-zero entry for that circle.
        for (let circle = 1; circle <= maxCircleNow; circle++) {
          let unlockLevel: number | undefined;
          for (let lv = 1; lv <= caster.level; lv++) {
            const slots = slotsForCaster(caster.tier, lv);
            if ((slots[circle - 1] ?? 0) > 0) { unlockLevel = lv; break; }
          }
          if (unlockLevel == null) continue;
          effectiveByLevel[unlockLevel] = (effectiveByLevel[unlockLevel] ?? 0) + caster.rituals_per_circle;
        }
      }
      const grantLevels = Object.keys(effectiveByLevel)
        .map(Number)
        .filter((n) => Number.isFinite(n) && n > 0 && n <= caster.level && (effectiveByLevel[n] ?? 0) > 0)
        .sort((a, b) => a - b);
      for (const grantLevel of grantLevels) {
        const budget = effectiveByLevel[grantLevel] ?? 0;
        const picks = state.rituals?.[grantLevel] ?? [];
        const deficit = Math.max(0, budget - picks.length);
        if (deficit === 0) continue;
        // Max circle the caster could cast AT grantLevel — `slotsForCaster`
        // is indexed by class level → per-circle slot counts.
        const slots = slotsForCaster(caster.tier, grantLevel);
        const maxCircleAtGrant = slots.reduce((m, n, i) => (n > 0 ? i + 1 : m), 0);
        const bucketByCircle = (refs: string[]): Record<number, string[]> => {
          const grouped: Record<number, string[]> = {};
          for (const ref of refs) {
            const stem = bareStem(ref);
            const doc = spellLibrary[stem] as { circle?: unknown } | undefined;
            const rawCircle = typeof doc?.circle === "string" ? doc.circle : "";
            const c = rawCircle ? circleNumber(rawCircle) : undefined;
            if (c == null || c === 0 || c > maxCircleAtGrant) continue;
            (grouped[c] ??= []).push(ref);
          }
          return grouped;
        };
        const poolByCircle = bucketByCircle(ritualPool);
        const flavorByCircle = bucketByCircle(flavorRitualRefs);
        const circles: PendingCircleBucket[] = [];
        for (let c = 1; c <= maxCircleAtGrant; c++) {
          const options = poolByCircle[c] ?? [];
          const flavor = flavorByCircle[c] ?? [];
          if (options.length === 0 && flavor.length === 0) continue;
          circles.push({
            circle: c,
            options,
            picked: picks.map(bareStem),
            flavorOptions: flavor.length > 0 ? flavor : undefined,
          });
        }
        out.push({
          source: caster.source,
          category: "rituals",
          label: `Lv. ${grantLevel} Rituals`,
          remaining: deficit,
          picked: picks.map(bareStem),
          level: grantLevel,
          circles: circles.length > 0 ? circles : undefined,
        });
      }
    }
  }
  return out;
}

function SpellPendingRow({
  pending,
  onToggle,
}: {
  pending: SpellPending;
  /** For flat `options` rows: called with the picked option. For
   *  `circles`-grouped rows: called with the option + its circle so
   *  picks route to the right per-circle bucket. */
  onToggle?: (option: string, circle?: number) => void;
}) {
  const groups = pending.circles;
  const hasCircles = Array.isArray(groups) && groups.length > 0;
  const totalOptions = hasCircles
    ? groups!.reduce(
        (n, g) => n + g.options.length + (g.flavorOptions?.length ?? 0),
        0,
      )
    : (pending.options?.length ?? 0) + (pending.flavorOptions?.length ?? 0);
  // Reusable button renderer — `flavor` flips the styling + exception
  // treatment (dashed border, transparent bg) via a data attribute the
  // CSS targets. Picked-state still flips the accent fill so the user
  // can see what they've committed to.
  const renderOption = (opt: string, i: number, picked: string[], flavor: boolean, circle?: number) => {
    const optLabel = bareStem(opt) || opt;
    const alreadyPicked = picked.includes(optLabel);
    const slotsFull = pending.remaining === 0;
    return (
      <li key={`${flavor ? "f" : "p"}:${i}:${opt}`}>
        <button
          type="button"
          data-flavor={flavor ? "true" : undefined}
          aria-pressed={alreadyPicked}
          disabled={!onToggle || (slotsFull && !alreadyPicked)}
          onClick={() => onToggle?.(opt, circle)}
        >
          {optLabel}
        </button>
      </li>
    );
  };
  return (
    <aside
      className="rpg-feature-pending"
      aria-label={`Pending ${pending.label} for ${pending.source}`}
    >
      <p>
        pick {pending.remaining} more for <em>{pending.label}</em>
      </p>
      {totalOptions === 0 ? (
        <p className="rpg-spell-pending-empty">
          <em>No options available — set a `pool:` on this caster or populate the referenced compendium.</em>
        </p>
      ) : hasCircles ? (
        // Circle-grouped: one sub-section per circle under the single
        // "pick N more" label so the remaining budget shows once.
        <div className="rpg-spell-pending-circles">
          {groups!.map((g) => (
            <div key={g.circle} className="rpg-spell-pending-circle">
              <h4 className="rpg-spell-pending-circle-label">{ordinal(g.circle)} Circle</h4>
              <menu aria-label={`${ordinal(g.circle)} Circle Options`}>
                {g.options.map((opt, i) => renderOption(opt, i, g.picked, false, g.circle))}
                {(g.flavorOptions ?? []).map((opt, i) =>
                  renderOption(opt, i, g.picked, true, g.circle),
                )}
              </menu>
            </div>
          ))}
        </div>
      ) : (
        <menu aria-label="Choice Options">
          {(pending.options ?? []).map((opt, i) => renderOption(opt, i, pending.picked, false))}
          {(pending.flavorOptions ?? []).map((opt, i) =>
            renderOption(opt, i, pending.picked, true),
          )}
        </menu>
      )}
    </aside>
  );
}

function groupPendingBySource(pending: SpellPending[]) {
  const order = new Map<string, number>();
  pending.forEach((p, i) => {
    if (!order.has(p.source)) order.set(p.source, i);
  });
  const groups = new Map<string, SpellPending[]>();
  for (const p of pending) {
    const bucket = groups.get(p.source) ?? [];
    bucket.push(p);
    groups.set(p.source, bucket);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (order.get(a) ?? 0) - (order.get(b) ?? 0))
    .map(([source, rows]) => ({ source, rows }));
}

// ─── Decisions log (per-spell undo buttons) ──────────────────────────────

type CircleCategory = "prepared" | "known" | "rituals";

interface SpellDecisionEntry {
  spell: string;
  onUndo?: () => void;
}

interface CircleBucket {
  circle: number;
  entries: SpellDecisionEntry[];
}

interface SpellDecisionCategory {
  /** Display label. One per category (Cantrips / Known / Prepared /
   *  Rituals) — circle subdivisions go inside `circles`. */
  label: "Cantrips" | "Known" | "Prepared" | "Rituals";
  /** How each `circles[n].circle` key should be rendered — ritual picks
   *  are stored keyed by the class level that granted them (not circle),
   *  so they show as `Lv. 3:` while prepared / known use `1st Circle:`. */
  dimension?: "circle" | "level";
  /** Flat entry list for Cantrips (no circle concept). */
  flat?: SpellDecisionEntry[];
  /** Circle-grouped entries for the other categories — rendered inline
   *  as "1st Circle: a, b; 2nd Circle: c" on the same row. */
  circles?: CircleBucket[];
}

interface SpellDecisionGroup {
  source: string;
  categories: SpellDecisionCategory[];
}

/** Walk every caster's state and collapse picks into one category per
 *  caster — Cantrips as a flat entry list, Prepared / Known / Rituals
 *  as circle-subgrouped buckets. The UI renders each category on its
 *  own row under the source name, mirroring the user-requested format
 *
 *    Cleric
 *      **Cantrips** — Guidance ↺, Sacred Flame ↺
 *      **Prepared** — 1st Circle: Bless ↺, Cure Wounds ↺; 2nd: … */
function gatherSpellDecisions(
  casters: ResolvedCaster[],
  castersState: Record<string, CasterState>,
  onUndoCantrip: ((source: string, option: string) => void) | undefined,
  onUndoCircleEntry:
    | ((source: string, category: CircleCategory, circle: number, option: string) => void)
    | undefined,
): SpellDecisionGroup[] {
  const labelMap: Record<CircleCategory, SpellDecisionCategory["label"]> = {
    prepared: "Prepared",
    known: "Known",
    rituals: "Rituals",
  };
  const groups: SpellDecisionGroup[] = [];
  for (const caster of casters) {
    const state = castersState[caster.source] ?? {};
    const categories: SpellDecisionCategory[] = [];

    const cantrips = state.cantrips ?? [];
    if (cantrips.length > 0) {
      categories.push({
        label: "Cantrips",
        flat: cantrips.map((s) => ({
          spell: s,
          onUndo: onUndoCantrip ? () => onUndoCantrip(caster.source, s) : undefined,
        })),
      });
    }

    const circleCategories: CircleCategory[] = ["known", "prepared", "rituals"];
    for (const cat of circleCategories) {
      const map = (state[cat] ?? {}) as Record<number, string[]>;
      const circleNums = Object.keys(map)
        .map((k) => Number(k))
        .filter((n) => Number.isFinite(n))
        .sort((a, b) => a - b);
      const circles: CircleBucket[] = [];
      for (const circle of circleNums) {
        const picks = map[circle] ?? [];
        if (picks.length === 0) continue;
        circles.push({
          circle,
          entries: picks.map((s) => ({
            spell: s,
            onUndo: onUndoCircleEntry
              ? () => onUndoCircleEntry(caster.source, cat, circle, s)
              : undefined,
          })),
        });
      }
      if (circles.length > 0) {
        categories.push({
          label: labelMap[cat],
          dimension: cat === "rituals" ? "level" : "circle",
          circles,
        });
      }
    }

    if (categories.length > 0) groups.push({ source: caster.source, categories });
  }
  return groups;
}

function SpellsDecisionsLog({
  casters,
  castersState,
  noteKey,
  onUndoCantrip,
  onUndoCircleEntry,
}: {
  casters: ResolvedCaster[];
  castersState: Record<string, CasterState>;
  noteKey: string;
  onUndoCantrip?: (source: string, option: string) => void;
  onUndoCircleEntry?: (
    source: string,
    category: CircleCategory,
    circle: number,
    option: string,
  ) => void;
}) {
  const groups = React.useMemo(
    () => gatherSpellDecisions(casters, castersState, onUndoCantrip, onUndoCircleEntry),
    [casters, castersState, onUndoCantrip, onUndoCircleEntry],
  );
  if (groups.length === 0) return null;
  const total = groups.reduce((n, g) => {
    for (const cat of g.categories) {
      if (cat.flat) n += cat.flat.length;
      if (cat.circles) for (const c of cat.circles) n += c.entries.length;
    }
    return n;
  }, 0);
  const [open, setOpen] = usePersistentOpen(`${noteKey}:spells:decisions`, false);
  // One nowrap span per spell — keeps `SpellName ↺` glued together so
  // wrapping happens between spells rather than mid-entry, matching the
  // features-block decisions treatment. */
  const renderEntry = (e: SpellDecisionEntry, key: number, leadingComma: boolean) => {
    const stem = bareStem(e.spell);
    return (
      <React.Fragment key={key}>
        {leadingComma && ", "}
        <span className="rpg-feature-decisions-entry">
          <a className="internal-link" href={stem} data-href={stem}>
            {stem}
          </a>
          {e.onUndo && (
            <button
              type="button"
              className="rpg-feature-decisions-undo"
              aria-label={`Undo ${stem}`}
              title="Undo this decision"
              onClick={e.onUndo}
            >
              {"\u21BA"}
            </button>
          )}
        </span>
      </React.Fragment>
    );
  };
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
          <div key={g.source} className="rpg-feature-decisions-group">
            <p className="rpg-feature-decisions-source-line">
              <a
                className="internal-link rpg-feature-decisions-source-link"
                href={g.source}
                data-href={g.source}
              >
                {g.source}
              </a>
            </p>
            {g.categories.map((cat) => (
              <p key={cat.label} className="rpg-feature-decisions-category-line">
                <strong>{cat.label}</strong>
                {" — "}
                {cat.flat?.map((e, j) => renderEntry(e, j, j > 0))}
                {cat.circles?.map((circ, i) => (
                  <React.Fragment key={circ.circle}>
                    {i > 0 && "; "}
                    <em className="rpg-feature-decisions-circle-tag">
                      {cat.dimension === "level"
                        ? `Lv. ${circ.circle}:`
                        : `${ordinal(circ.circle)} Circle:`}
                    </em>{" "}
                    {circ.entries.map((e, j) => renderEntry(e, j, j > 0))}
                  </React.Fragment>
                ))}
              </p>
            ))}
          </div>
        ))}
      </div>
    </details>
  );
}

// ─── Block export ────────────────────────────────────────────────────────

export const spells: EntityBlock<SpellsProps, CharacterEntity> = ({
  self,
  blocks,
  lookup,
  expressions,
}) => {
  const header = (blocks as any).header;
  const features = (blocks as any).features as FeaturesBlockData | undefined;
  const view = lookup.$features?.(header, features?.choices, features?.additional);
  const noteKey = useNoteKey();
  const [pendingOpen, setPendingOpen] = usePersistentOpen(`${noteKey}:spells:pending`, true);
  if (!view || view.casters.length === 0) {
    return (
      <section aria-details="Character Spells">
        <p aria-details="No Casters"><em>No spellcasting class declared.</em></p>
      </section>
    );
  }
  const castersState = self.casters ?? {};
  const stats = (blocks as any).stats as Record<string, unknown> | undefined;
  const spellLibrary = lookup.$spells ?? {};

  const setCasters = (self as {
    setCasters?: (u: (prev: SpellsProps["casters"]) => SpellsProps["casters"]) => void;
  }).setCasters;

  const updateSpent = setCasters
    ? (source: string, circle: number, next: number) => {
        setCasters((prev) => {
          const nextMap = { ...(prev ?? {}) };
          const casterPrev = { ...(nextMap[source] ?? {}) };
          const spentPrev = { ...(casterPrev.spent ?? {}) };
          if (next <= 0) delete spentPrev[circle];
          else spentPrev[circle] = next;
          casterPrev.spent = Object.keys(spentPrev).length > 0 ? spentPrev : undefined;
          nextMap[source] = casterPrev;
          return nextMap;
        });
      }
    : undefined;

  const toggleCantrip = setCasters
    ? (source: string, option: string) => {
        setCasters((prev) => {
          const nextMap = { ...(prev ?? {}) };
          const casterPrev = { ...(nextMap[source] ?? {}) };
          const list = [...(casterPrev.cantrips ?? [])];
          const bare = bareStem(option);
          const idx = list.findIndex((s) => bareStem(s) === bare);
          if (idx >= 0) list.splice(idx, 1);
          else list.push(option);
          if (list.length === 0) delete casterPrev.cantrips;
          else casterPrev.cantrips = list;
          nextMap[source] = casterPrev;
          return nextMap;
        });
      }
    : undefined;

  // Generic remover for one spell from a per-circle list on a caster.
  // The Decisions-made drawer wires each picked spell's undo button
  // through this so users can take back any individual spell without
  // dropping the rest of the category.
  const removeFromCircleList = setCasters
    ? (source: string, category: "prepared" | "known" | "rituals", circle: number, option: string) => {
        setCasters((prev) => {
          const nextMap = { ...(prev ?? {}) };
          const casterPrev = { ...(nextMap[source] ?? {}) };
          const bucketMap = { ...(casterPrev[category] ?? {}) } as Record<number, string[]>;
          const list = [...(bucketMap[circle] ?? [])];
          const bare = bareStem(option);
          const idx = list.findIndex((s) => bareStem(s) === bare);
          if (idx < 0) return prev ?? {};
          list.splice(idx, 1);
          if (list.length === 0) delete bucketMap[circle];
          else bucketMap[circle] = list;
          if (Object.keys(bucketMap).length === 0) delete casterPrev[category];
          else casterPrev[category] = bucketMap as CasterState[typeof category];
          nextMap[source] = casterPrev;
          return nextMap;
        });
      }
    : undefined;

  // Toggle a prepared spell pick at a known circle. The picker supplies
  // the circle directly (each pending row is circle-scoped), so no
  // compendium lookup is needed — the pick lands in
  // `state.prepared[circle]` unconditionally.
  const togglePrepared = setCasters
    ? (source: string, option: string, circle: number) => {
        if (!Number.isFinite(circle) || circle <= 0) return;
        const stem = bareStem(option);
        if (!stem) return;
        setCasters((prev) => {
          const nextMap = { ...(prev ?? {}) };
          const casterPrev = { ...(nextMap[source] ?? {}) };
          const bucketMap = { ...(casterPrev.prepared ?? {}) } as Record<number, string[]>;
          const list = [...(bucketMap[circle] ?? [])];
          const idx = list.findIndex((s) => bareStem(s) === stem);
          if (idx >= 0) list.splice(idx, 1);
          else list.push(option);
          if (list.length === 0) delete bucketMap[circle];
          else bucketMap[circle] = list;
          if (Object.keys(bucketMap).length === 0) delete casterPrev.prepared;
          else casterPrev.prepared = bucketMap;
          nextMap[source] = casterPrev;
          return nextMap;
        });
      }
    : undefined;

  // Toggle a ritual pick at a known acquisition level. Keyed by LEVEL
  // (not circle) so each pick is pinned to the class level that
  // granted it — matches the picker's per-level rows. Circles are
  // derived at render time via the spell library's `circle` attribute.
  const toggleRitual = setCasters
    ? (source: string, option: string, level: number) => {
        if (!Number.isFinite(level) || level <= 0) return;
        const stem = bareStem(option);
        if (!stem) return;
        setCasters((prev) => {
          const nextMap = { ...(prev ?? {}) };
          const casterPrev = { ...(nextMap[source] ?? {}) };
          const bucketMap = { ...(casterPrev.rituals ?? {}) } as Record<number, string[]>;
          const list = [...(bucketMap[level] ?? [])];
          const idx = list.findIndex((s) => bareStem(s) === stem);
          if (idx >= 0) list.splice(idx, 1);
          else list.push(option);
          if (list.length === 0) delete bucketMap[level];
          else bucketMap[level] = list;
          if (Object.keys(bucketMap).length === 0) delete casterPrev.rituals;
          else casterPrev.rituals = bucketMap;
          nextMap[source] = casterPrev;
          return nextMap;
        });
      }
    : undefined;

  const compendium = lookup.$compendium;
  // Pre-compute each prepared caster's `prepared_max` against the
  // character's stats so the picker row knows how many picks are left.
  const preparedBudgets: Record<string, number> = {};
  for (const caster of view.casters) {
    if (caster.type !== "prepared" || !caster.prepared_max) continue;
    const mod = abilityModifier(stats, caster.ability);
    const pb = expressions.ProficiencyBonus();
    const vars: Record<string, number> = {
      LV: caster.level,
      CLASS_LEVEL: caster.level,
      PB: pb,
      [`${caster.ability}_MOD`]: mod,
      STR_MOD: abilityModifier(stats, "STR"),
      DEX_MOD: abilityModifier(stats, "DEX"),
      CON_MOD: abilityModifier(stats, "CON"),
      INT_MOD: abilityModifier(stats, "INT"),
      WIS_MOD: abilityModifier(stats, "WIS"),
      CHA_MOD: abilityModifier(stats, "CHA"),
    };
    preparedBudgets[caster.source] = evalPreparedMax(caster.prepared_max, vars);
  }
  const pending = collectPending(
    view.casters,
    castersState,
    compendium?.tagIndex,
    compendium?.folderIndex,
    preparedBudgets,
    spellLibrary,
    // Character-level `style:` merges into every caster's own
    // declared style list — lets the sheet author attune a single
    // character without editing the class's shared config.
    Array.isArray(self.style) ? self.style : self.style != null ? [self.style] : [],
  );

  return (
    <section aria-details="Character Spells">
      {view.casters.map((caster) => {
        const state = castersState[caster.source] ?? {};
        const mod = abilityModifier(stats, caster.ability);
        const pb = expressions.ProficiencyBonus();
        return (
          <CasterSection
            key={caster.source}
            caster={caster}
            state={state}
            spells={spellLibrary}
            noteKey={noteKey}
            abilityMod={mod}
            proficiencyBonus={pb}
            onSpentChange={
              updateSpent
                ? (circle, next) => updateSpent(caster.source, circle, next)
                : undefined
            }
          />
        );
      })}
      {(pending.length > 0 || hasAnyPicks(view.casters, castersState)) && (
        <section aria-label="Spell Pending Choices" className="rpg-feature-pending-list">
          {pending.length > 0 && (
            <details
              className="rpg-feature-pending-details"
              open={pendingOpen}
              onToggle={(e) => setPendingOpen((e.currentTarget as HTMLDetailsElement).open)}
            >
              <summary>
                <span className="rpg-feature-pending-label">Choices to make</span>
                <span className="rpg-feature-pending-count">{pending.length}</span>
              </summary>
              <div className="rpg-feature-pending-groups">
                {groupPendingBySource(pending).map(({ source, rows }) => (
                  <div key={source} className="rpg-feature-pending-group">
                    <h3 className="rpg-feature-pending-group-label">
                      <a className="internal-link" href={source} data-href={source}>
                        {source}
                      </a>
                    </h3>
                    {rows.map((p, i) => (
                      <SpellPendingRow
                        key={`${p.category}:${p.level ?? "x"}:${i}`}
                        pending={p}
                        onToggle={
                          p.category === "cantrips" && toggleCantrip
                            ? (opt) => toggleCantrip(p.source, opt)
                            : p.category === "prepared" && togglePrepared
                              ? (opt, circle) => {
                                  if (typeof circle !== "number") return;
                                  togglePrepared(p.source, opt, circle);
                                }
                              : p.category === "rituals" && toggleRitual && typeof p.level === "number"
                                ? (opt) => toggleRitual(p.source, opt, p.level!)
                                : undefined
                        }
                      />
                    ))}
                  </div>
                ))}
              </div>
            </details>
          )}
          <SpellsDecisionsLog
            casters={view.casters}
            castersState={castersState}
            noteKey={noteKey}
            onUndoCantrip={toggleCantrip}
            onUndoCircleEntry={removeFromCircleList}
          />
        </section>
      )}
    </section>
  );
};

export default spells;
