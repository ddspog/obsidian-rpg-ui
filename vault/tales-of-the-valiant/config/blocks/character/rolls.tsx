import * as React from "react";
import {
  EntityBlock,
  deriveWeaponRolls,
  resolvePersonalItem,
  signed,
  type RollAspect,
  type RollEffect,
  type RollOverride,
  type RollCost,
  type DamageSpec,
  type FeatureDetails,
  type ItemElementData,
  type ItemMagicData,
  type ItemPersonalData,
  type WeaponOverlay,
  type WielderStats,
} from "rpg-ui-toolkit";
import type { RollsProps, RollEntry } from "./rolls.types";
import type { CharacterEntity } from "../../entities/character.types";
import type { FeaturesBlockData } from "./features.types";
import type { HeaderProps } from "./header.types";
import { slotsForCaster } from "../../entities/character.lookup";

type CasterTier = "full" | "half" | "third" | "none";

interface CasterInfo {
  source: string;
  ability: string;
  tier: CasterTier;
  level: number;
}

interface RollRow {
  id: string;
  kind: "weapon" | "spell" | "feature" | "manual";
  roll: RollAspect;
  sourceNote: string;
  available: boolean;
  /** Populated for `kind === "spell"` so the row component can read
   *  remaining spell slots from `blocks.spells` and filter the upcast
   *  cycle to circles the caster can actually cast at. */
  caster?: CasterInfo;
  /** Populated for `kind === "feature"` — the character's level in
   *  the feature's source (class / heritage / background). Feeds
   *  `cost.max: "class_level"` resolution. */
  sourceLevel?: number;
}

interface EquipState {
  mainHand: string | null;
  offHand: string | null;
}

/**
 * `rpg character.rolls` — derives every roll the character has
 * available from inventory weapons (auto-fanned by Versatile / Thrown /
 * Two-Handed properties), spells with a `roll:` aspect, and features
 * with one. Each row shows Hit *or* DC depending on the roll's form,
 * with effects (save outcomes, conditions, free-text notes) collapsed
 * into a compact icon-and-text cell.
 *
 * Variant mechanisms applied to each row (in order):
 *   - `leveled` → resolved at derivation time against the appropriate
 *     level (class level for features, character level for spells /
 *     cantrips, overridable via `leveled.by`).
 *   - `upcast` / `swapOn` → applied at render time in `RollRowUI`
 *     based on user-selected state (React-local; resets on reload).
 */
export const rolls: EntityBlock<RollsProps, CharacterEntity> = ({ self, blocks, lookup }) => {
  const stats = resolveWielderStats(blocks);
  const characterLevel = resolveCharacterLevel(blocks);
  const equip = resolveEquipState(blocks, lookup);
  const resolvedCasters = resolveCasters(blocks, lookup);
  const rawRows: Array<Omit<RollRow, "available">> = [
    ...deriveWeaponRows(blocks, lookup, stats, equip),
    ...deriveSpellRows(blocks, lookup, stats, resolvedCasters, characterLevel),
    ...deriveFeatureRows(blocks, lookup, characterLevel),
    ...deriveManualRows(self.rolls),
  ];
  const rows: RollRow[] = rawRows.map((row) => ({
    ...row,
    available: isRollAvailable(row.kind, row.roll, row.sourceNote, equip),
  }));

  return (
    <section aria-details="Character Rolls" className="rpg-rolls">
      {rows.length === 0 ? (
        <>
          <header className="rpg-tag-heading">
            <span>Rolls</span>
          </header>
          <p className="rpg-rolls__empty">
            <em>No rolls available.</em>
          </p>
        </>
      ) : (
        <div className="rpg-rolls__scroll">
          <table className="rpg-rolls__table">
            <thead className="rpg-rolls__head-band">
              <tr>
                <th className="rpg-rolls__head-label">Rolls</th>
                <th>Hit</th>
                <th>DC</th>
                <th>Range</th>
                <th>Damage</th>
                <th>Cost</th>
                <th>Effects</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <RollRowUI key={row.id} row={row} blocks={blocks} stats={stats} characterLevel={characterLevel} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

// ─── Row component ──────────────────────────────────────────────────────────

/** The active note's path, used as a per-file scope for persisted
 *  selections. Falls back to `"default"` when the Obsidian app global
 *  isn't reachable (e.g. Storybook). Mirrors `useNoteKey` in
 *  `spells.tsx`. */
function useNoteKey(): string {
  return React.useMemo(() => {
    const app = (
      globalThis as unknown as { app?: { workspace?: { getActiveFile?: () => { path?: string } | null } } }
    ).app;
    return app?.workspace?.getActiveFile?.()?.path ?? "default";
  }, []);
}

/** Integer-valued persistent state scoped by a localStorage key.
 *  Mirrors the boolean `usePersistentOpen` pattern already used in
 *  `features.tsx` / `spells.tsx`: survives Obsidian reload; resets on
 *  browser-data clear. `undefined` is stored as an empty string so the
 *  "no selection" case round-trips. */
function usePersistentNumber(storageKey: string, defaultValue: number | undefined) {
  const [value, setValue] = React.useState<number | undefined>(() => {
    try {
      if (typeof localStorage === "undefined") return defaultValue;
      const stored = localStorage.getItem(storageKey);
      if (stored === null || stored === "") return defaultValue;
      const parsed = Number(stored);
      return Number.isFinite(parsed) ? parsed : defaultValue;
    } catch {
      return defaultValue;
    }
  });
  const update = React.useCallback(
    (next: number | undefined) => {
      setValue(next);
      try {
        if (next === undefined) localStorage.removeItem(storageKey);
        else localStorage.setItem(storageKey, String(next));
      } catch {
        // ignore storage errors (private mode, quota, etc.)
      }
    },
    [storageKey]
  );
  return [value, update] as const;
}

/** Filter the declared upcast circles down to those the caster has
 *  remaining spell slots for. Cantrips (circle 0) never consume a
 *  slot and are always considered available; casters with no `tier`
 *  (non-casters authoring a manual spell) pass through unchanged.
 *
 *  Returns the filtered list plus a flag indicating whether the
 *  character is currently able to cast at ANY of the declared
 *  circles — used by `RollRowUI` to grey out the whole row when the
 *  spell is effectively unusable. */
function filterCastableCircles(
  declaredCircles: number[],
  caster: CasterInfo | undefined,
  blocks: unknown
): { castable: number[]; anyAvailable: boolean } {
  if (!caster || caster.tier === "none") {
    return { castable: declaredCircles, anyAvailable: true };
  }
  const spells = (blocks as { spells?: { casters?: Record<string, { spent?: Record<string, number> }> } })?.spells;
  const state = spells?.casters?.[caster.source];
  const maxByCircle = slotsForCaster(caster.tier, caster.level);
  const castable = declaredCircles.filter((c) => {
    if (c === 0) return true; // cantrip
    const max = maxByCircle[c - 1] ?? 0;
    const spent = Number(state?.spent?.[c] ?? state?.spent?.[String(c)] ?? 0) || 0;
    return max - spent > 0;
  });
  // "Any available" for the row-availability flag: a cantrip line
  // (declaredCircles === [0]) is always available; a leveled spell is
  // available whenever at least one declared circle still has a slot.
  const anyAvailable = declaredCircles.length === 0 || castable.length > 0;
  return { castable, anyAvailable };
}

function RollRowUI({
  row,
  blocks,
  stats,
  characterLevel,
}: {
  row: RollRow;
  blocks: unknown;
  stats: WielderStats;
  characterLevel: number;
}) {
  const noteKey = useNoteKey();
  const baseRoll = row.roll;

  // Declared circles = base circle plus every key on `upcast`. The
  // base is always included so the user can cycle back to "cast as
  // written" even after bumping to a higher circle. Non-spell rolls
  // have no upcast and leave this empty.
  const declaredCircles = baseRoll.upcast
    ? [baseRoll.circle, ...Object.keys(baseRoll.upcast).map(Number)]
        .filter((n): n is number => typeof n === "number" && Number.isFinite(n))
        .sort((a, b) => a - b)
    : [];

  // Filter to circles the caster has slots for. Cantrips always pass.
  const { castable, anyAvailable } = filterCastableCircles(declaredCircles, row.caster, blocks);

  // Interactive upcast + swap state, persisted per-note per-row via
  // localStorage. Scoped by `noteKey` so multiple character files
  // don't clobber each other.
  const [upcastCircleRaw, setUpcastCircle] = usePersistentNumber(
    `${noteKey}:rolls:${row.id}:upcast`,
    baseRoll.circle
  );
  // If the persisted circle is no longer castable (player just spent
  // its slot), fall back to the highest castable circle so the row
  // reflects something the caster can actually do. Base circle wins
  // ties — minimal surprise.
  const upcastCircle = React.useMemo(() => {
    if (castable.length === 0) return upcastCircleRaw;
    if (upcastCircleRaw != null && castable.includes(upcastCircleRaw)) return upcastCircleRaw;
    return castable.includes(baseRoll.circle ?? -1) ? baseRoll.circle : castable[0];
  }, [upcastCircleRaw, castable, baseRoll.circle]);

  const swapOptions = baseRoll.swapOn?.options ?? [];
  const swapInitialIdx = React.useMemo(() => {
    if (!baseRoll.swapOn) return 0;
    const baseValue = baseRoll.swapOn.field === "range" ? baseRoll.range : baseRoll.name;
    const match = swapOptions.findIndex((o) => o.value === baseValue);
    return match >= 0 ? match : 0;
  }, [baseRoll, swapOptions]);
  const [swapIndexRaw, setSwapIndex] = usePersistentNumber(
    `${noteKey}:rolls:${row.id}:swap`,
    swapInitialIdx
  );
  const swapIndex = swapIndexRaw ?? swapInitialIdx;

  // Cost amount — variable-cost features (Last Stand, Nature's Gift)
  // declare a `max` and the player cycles 1..max. Fixed-cost rolls
  // (Mystic Mark, Channel Divinity) have `max` omitted and the cell
  // is a non-interactive label.
  const [costAmountRaw, setCostAmount] = usePersistentNumber(
    `${noteKey}:rolls:${row.id}:cost`,
    baseRoll.cost?.amount
  );
  const costAmount = costAmountRaw;

  // Compose the effective roll by applying the selected upcast + swap
  // overrides. `leveled` has already been merged at derivation time.
  let roll = baseRoll;
  if (baseRoll.upcast && upcastCircle != null && upcastCircle !== baseRoll.circle) {
    roll = applyRollOverride(roll, baseRoll.upcast[upcastCircle]);
  }
  if (baseRoll.swapOn && swapOptions[swapIndex]) {
    const opt = swapOptions[swapIndex];
    roll = applyRollOverride(roll, opt);
    // The swap target cell always reflects the option's `value`,
    // regardless of whether the author restated it in the option body.
    if (baseRoll.swapOn.field === "range") roll = { ...roll, range: opt.value };
    else roll = { ...roll, name: opt.value };
  }

  const name = roll.name || row.sourceNote;
  // DC renders whenever the roll declares a save — regardless of form.
  // A spell-roll (form: spell) with a rider save shows BOTH a Hit and
  // a DC; the user can read the rules: damage on hit, save dictates the
  // additional condition. A pure save-form roll only shows DC. Rider
  // rolls piggy-back on a host weapon hit and have neither — likewise
  // healing / temp-HP rolls are beneficial dice with no attack roll
  // or target save. This keeps the Effects column free for
  // outcome/condition glyphs.
  const dcText = roll.save ? `${roll.save.ability} ${roll.save.dc ?? "—"}` : "";
  const formHasHit = roll.form === "melee" || roll.form === "ranged" || roll.form === "spell";
  const hitText = formHasHit ? (roll.to_hit ?? "") : "";

  // Row-availability: weapons use the equip gate; spells AND/OR the
  // caster-slot gate. If a spell has no castable circles (e.g. Cleric
  // spent every 1st-circle slot), mark the row unavailable so it
  // greys out, matching the weapon-equip treatment. Cantrips (circle
  // 0) pass through since they never consume a slot.
  const slotGated = row.kind === "spell" && declaredCircles.length > 0 && !anyAvailable;
  const available = row.available && !slotGated;
  const unavailReason = !row.available
    ? `Unavailable: needs ${roll.requires ?? "equip"}`
    : slotGated
      ? "Unavailable: out of spell slots"
      : undefined;

  const cycleUpcast = () => {
    if (castable.length <= 1) return;
    const active = upcastCircle ?? castable[0];
    const idx = castable.indexOf(active);
    const next = castable[(idx + 1) % castable.length];
    setUpcastCircle(next);
  };
  const cycleSwap = () => {
    if (swapOptions.length <= 1) return;
    setSwapIndex((swapIndex + 1) % swapOptions.length);
  };
  // Resolve the cost's `max` formula once per render against the
  // character's context. A feature row carries `sourceLevel` (its
  // source class level); spells / weapons / manual rows fall back to
  // character level when "class_level" is requested.
  const resolvedCostMax = resolveCostMax(baseRoll.cost?.max, {
    pb: stats.pb,
    characterLevel,
    sourceLevel: row.sourceLevel,
  });
  const cycleCost = () => {
    const cost = baseRoll.cost;
    if (!cost || resolvedCostMax == null || resolvedCostMax <= 1) return;
    // Cycle 1..max, wrapping back to 1. The minimum is always 1 —
    // spending 0 of a resource isn't a meaningful "cost".
    const current = costAmount ?? cost.amount;
    const next = current >= resolvedCostMax ? 1 : current + 1;
    setCostAmount(next);
  };

  return (
    <tr
      data-form={roll.form}
      data-available={available ? "true" : "false"}
      aria-description={unavailReason}
    >
      <td className="rpg-rolls__name">
        <FormCell
          roll={baseRoll}
          effectiveCircle={upcastCircle}
          onCycle={cycleUpcast}
          canCycle={castable.length > 1}
        />
        <SwapOrText
          field="name"
          value={name}
          swapOn={baseRoll.swapOn}
          onCycle={cycleSwap}
          fallback={
            <a className="internal-link" href={row.sourceNote} data-href={row.sourceNote}>
              {name}
            </a>
          }
        />
      </td>
      <td className="rpg-rolls__hit">{hitText}</td>
      <td className="rpg-rolls__dc">{dcText}</td>
      <td className="rpg-rolls__range">
        <SwapOrText
          field="range"
          value={roll.range ?? ""}
          swapOn={baseRoll.swapOn}
          onCycle={cycleSwap}
        />
      </td>
      <td className="rpg-rolls__damage">
        <DamageCell damage={roll.damage} />
      </td>
      <td className="rpg-rolls__cost">
        <CostCell
          cost={roll.cost}
          amount={costAmount ?? roll.cost?.amount ?? 1}
          resolvedMax={resolvedCostMax}
          onCycle={cycleCost}
        />
      </td>
      <td className="rpg-rolls__effects">
        <EffectsCell roll={roll} />
      </td>
    </tr>
  );
}

function DamageCell({ damage }: { damage: RollAspect["damage"] }) {
  if (!damage) return null;
  const list: DamageSpec[] = Array.isArray(damage) ? damage : [damage];
  return (
    <>
      {list.map((d, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="rpg-rolls__damage-sep"> + </span>}
          <span className="rpg-rolls__damage-roll">{compactDie(d.roll, d.bonus)}</span>
          <span className="rpg-rolls__damage-type"> {d.type}</span>
        </React.Fragment>
      ))}
    </>
  );
}

/** Render the damage as a polynomial-style expression: `1d6+2`, `2d8`,
 *  `1d8/1d10+1` for versatile. The bonus stays adjacent to the dice
 *  with no extra spaces so the cell stays narrow on a single row. */
function compactDie(roll: string, bonus?: string): string {
  if (!bonus || bonus === "+0") return roll;
  return `${roll}${bonus.startsWith("-") ? bonus : `+${bonus.replace(/^\+/, "")}`}`;
}

/** Save-outcome icon (½ / ∅ / ↺) + each explicit `roll.effects` entry
 *  becomes a pill. Every pill carries an instant CSS tooltip labelling
 *  the glyph. `roll.notes` renders verbatim as trailing italic text,
 *  revealed on row-hover, for prose that doesn't fit a pill. */
function EffectsCell({ roll }: { roll: RollAspect }) {
  const pills: Array<{ glyph: string; label: string; cls?: string; key: string }> = [];

  const onSuccess = roll.save?.on_success?.toLowerCase() ?? "";
  if (onSuccess.includes("half")) {
    pills.push({
      glyph: "½",
      label: "Half damage on successful save",
      cls: "rpg-rolls__icon--save-half",
      key: "save-half",
    });
  } else if (onSuccess.includes("no")) {
    pills.push({
      glyph: "∅",
      label: "No damage on successful save",
      cls: "rpg-rolls__icon--save-none",
      key: "save-none",
    });
  } else if (roll.save) {
    pills.push({
      glyph: "↺",
      label: `On save: ${roll.save.on_success ?? "negates effect"}`,
      cls: "rpg-rolls__icon--save-other",
      key: "save-other",
    });
  }

  for (const [idx, eff] of (roll.effects ?? []).entries()) {
    const resolved = resolveEffect(eff);
    if (!resolved) continue;
    pills.push({
      glyph: resolved.glyph,
      label: resolved.label,
      cls: "rpg-rolls__icon--condition",
      key: `eff-${idx}`,
    });
  }

  return (
    <>
      {pills.map((p) => (
        <span
          key={p.key}
          className={`rpg-rolls__icon ${p.cls ?? ""}`}
          data-tip={p.label}
          aria-label={p.label}
        >
          {p.glyph}
        </span>
      ))}
      {roll.notes && <small className="rpg-rolls__notes-text">{roll.notes}</small>}
    </>
  );
}

/** Predefined effect vocabulary. Authors write `effects: [prone]` and
 *  the block renders the mapped glyph + tooltip. Keys are lowercase
 *  condition names; lookup is case-insensitive. Add entries here as
 *  the rolls surface new effects — this is intentionally local to
 *  the block because the glyph/tooltip choices are a UI decision for
 *  the rolls table, not a global fact about the condition. */
const EFFECT_VOCABULARY: Record<string, { glyph: string; label: string }> = {
  blinded: { glyph: "👁", label: "Blinded" },
  prone: { glyph: "⤵", label: "Knocked prone" },
  poisoned: { glyph: "☠", label: "Poisoned" },
  charmed: { glyph: "♥", label: "Charmed" },
  restrained: { glyph: "🪢", label: "Restrained" },
  grappled: { glyph: "✊", label: "Grappled" },
  frightened: { glyph: "😱", label: "Frightened" },
  stunned: { glyph: "💫", label: "Stunned" },
  deafened: { glyph: "👂", label: "Deafened" },
  unconscious: { glyph: "💤", label: "Unconscious" },
  push: { glyph: "→", label: "Pushes the target" },
  pin: { glyph: "📌", label: "Pinned" },
};

function resolveEffect(eff: RollEffect): { glyph: string; label: string } | null {
  if (typeof eff === "string") {
    const hit = EFFECT_VOCABULARY[eff.toLowerCase()];
    if (hit) return hit;
    // Unknown key — render the raw string as both glyph and tooltip so
    // the author at least sees what they wrote instead of a silent drop.
    return { glyph: eff, label: eff };
  }
  if (eff && typeof eff === "object" && typeof eff.icon === "string") {
    return { glyph: eff.icon, label: eff.label ?? eff.icon };
  }
  return null;
}

/** Cost column — renders `{amount}× {glyph}` with a tooltip naming
 *  the resource. When the resolved `max > 1`, the whole cell is a
 *  click-to-cycle button that steps the amount 1..max and wraps.
 *  Empty rolls with no declared cost produce an empty cell so the
 *  column collapses to its narrow content width. */
function CostCell({
  cost,
  amount,
  resolvedMax,
  onCycle,
}: {
  cost: RollCost | undefined;
  amount: number;
  resolvedMax: number | undefined;
  onCycle: () => void;
}) {
  if (!cost) return null;
  const resolved = resolveCost(cost);
  const label = `${amount}× ${resolved.label}`;
  const canCycle = resolvedMax != null && resolvedMax > 1;
  const content = (
    <>
      <span className="rpg-rolls__cost-amount">{amount}</span>
      <span className="rpg-rolls__cost-icon" aria-hidden="true">
        {resolved.glyph}
      </span>
    </>
  );
  if (canCycle) {
    return (
      <button
        type="button"
        className="rpg-rolls__cost-btn"
        onClick={onCycle}
        aria-label={`${label}. Click to cycle.`}
        data-tip={`${label} — click to cycle`}
      >
        {content}
      </button>
    );
  }
  return (
    <span className="rpg-rolls__cost-label" aria-label={label} data-tip={label}>
      {content}
    </span>
  );
}

/** Cost vocabulary — same shape as `EFFECT_VOCABULARY`, maps a
 *  `RollCost.type` key to a visible glyph + a tooltip label. Keep
 *  resource-specific (a feature that taps a class pool uses the pool
 *  name, not a generic "uses" token) so the icon is self-explanatory
 *  at a glance. Unknown keys fall through to rendering the key
 *  itself, matching the effects-cell fallback. */
const COST_VOCABULARY: Record<string, { glyph: string; label: string }> = {
  "hit-dice": { glyph: "🎲", label: "Hit dice" },
  "channel-divinity": { glyph: "✝", label: "Channel Divinity" },
  "wild-shape": { glyph: "🐾", label: "Wild Shape" },
  "mystic-mark": { glyph: "🎯", label: "Mystic Mark" },
  "pb-pool": { glyph: "❂", label: "PB-pool use" },
  rage: { glyph: "🔥", label: "Rage" },
  ki: { glyph: "☯", label: "Ki point" },
  "sorcery-point": { glyph: "⟡", label: "Sorcery point" },
  "superiority-die": { glyph: "◈", label: "Superiority die" },
  "bardic-inspiration": { glyph: "🎵", label: "Bardic Inspiration" },
};

function resolveCost(cost: RollCost): { glyph: string; label: string } {
  const hit = COST_VOCABULARY[cost.type.toLowerCase()];
  if (hit) return hit;
  return { glyph: cost.type, label: cost.type };
}

/** Circled-numeral glyphs for spell-form rolls. The form icon for
 *  `form: spell` with a declared `circle` renders as a circled numeral
 *  reflecting the currently-selected circle (base or upcast). Falls
 *  back to `✨` when the spell doesn't declare a circle. */
const CIRCLED_NUMERALS: Record<number, string> = {
  0: "⓪",
  1: "①",
  2: "②",
  3: "③",
  4: "④",
  5: "⑤",
  6: "⑥",
  7: "⑦",
  8: "⑧",
  9: "⑨",
};

/** Form-icon cell. Rolls that declare a `circle` (i.e. are spells,
 *  regardless of their inner form: spell-attack, save, or rider) show
 *  the circled numeral reflecting `effectiveCircle`; when the spell
 *  declares `upcast` AND the caster still has slots at more than one
 *  circle, the icon becomes a button that cycles. When there's
 *  nothing to cycle through (no `upcast:` declared, or every
 *  declared circle collapses to a single castable option), the icon
 *  renders as a plain `<span>` — visually identical to a cantrip
 *  icon so the user isn't misled by a disabled-looking button. Non-
 *  spell rolls fall through to the static form glyph. */
function FormCell({
  roll,
  effectiveCircle,
  onCycle,
  canCycle,
}: {
  roll: RollAspect;
  effectiveCircle: number | undefined;
  onCycle: () => void;
  canCycle: boolean;
}) {
  if (roll.circle != null) {
    const circle = effectiveCircle ?? roll.circle;
    const glyph = CIRCLED_NUMERALS[circle] ?? "✨";
    if (roll.upcast && canCycle) {
      return (
        <button
          type="button"
          className="rpg-rolls__form-icon rpg-rolls__form-icon--upcast"
          onClick={onCycle}
          aria-label={`Cast at circle ${circle}. Click to cycle.`}
          data-tip={`Circle ${circle} — click to cycle`}
        >
          {glyph}
        </button>
      );
    }
    return (
      <span className="rpg-rolls__form-icon" aria-label={`Circle ${circle}`}>
        {glyph}
      </span>
    );
  }
  return (
    <span className="rpg-rolls__form-icon" aria-label={`Form: ${roll.form}`}>
      <FormIcon form={roll.form} />
    </span>
  );
}

/** Cell-value wrapper that turns into a click-to-cycle button when
 *  the roll's `swapOn` targets this cell's field. Otherwise it renders
 *  either `fallback` (when supplied) or the plain `value`. */
function SwapOrText({
  field,
  value,
  swapOn,
  onCycle,
  fallback,
}: {
  field: "range" | "name";
  value: string;
  swapOn: RollAspect["swapOn"];
  onCycle: () => void;
  fallback?: React.ReactNode;
}) {
  if (swapOn?.field === field && swapOn.options.length > 1) {
    return (
      <button
        type="button"
        className="rpg-rolls__swap-btn"
        onClick={onCycle}
        aria-label={`${value}. Click to cycle.`}
        data-tip={`${value} — click to cycle`}
      >
        {value}
      </button>
    );
  }
  return <>{fallback ?? value}</>;
}

function FormIcon({ form }: { form: RollAspect["form"] }) {
  const map: Record<RollAspect["form"], string> = {
    melee: "⚔",
    ranged: "🏹",
    spell: "✨",
    save: "🛡",
    rider: "⊕",
    healing: "✚",
    temp: "💙",
  };
  return <span aria-hidden="true">{map[form] ?? "?"}</span>;
}

// ─── Derivation passes ──────────────────────────────────────────────────────

/** Total character level summed across every class the character has
 *  taken. Drives cantrip scaling and any `leveled.by: "character"`
 *  override. Returns 0 when the header doesn't declare any classes. */
function resolveCharacterLevel(blocks: unknown): number {
  const header = (blocks as { header?: Partial<HeaderProps> })?.header;
  if (!Array.isArray(header?.classes)) return 0;
  return header!.classes.reduce(
    (acc: number, c) =>
      acc + (typeof (c as { level?: number }).level === "number" ? (c as { level: number }).level : 0),
    0
  );
}

/** Shallow-merge a `RollOverride` onto a base `RollAspect`. Each
 *  listed field replaces wholesale — arrays (damage, effects) and
 *  objects (save) are not deep-merged, because partial damage/save
 *  overrides would be ambiguous (which spec? which field?). Authors
 *  restate the full sub-structure when they need to change it. */
function applyRollOverride(base: RollAspect, override: RollOverride | undefined): RollAspect {
  if (!override) return base;
  const next: RollAspect = { ...base };
  if (override.name !== undefined) next.name = override.name;
  if (override.damage !== undefined) next.damage = override.damage;
  if (override.to_hit !== undefined) next.to_hit = override.to_hit;
  if (override.range !== undefined) next.range = override.range;
  if (override.save !== undefined) next.save = override.save;
  if (override.effects !== undefined) next.effects = override.effects;
  if (override.notes !== undefined) next.notes = override.notes;
  return next;
}

/** Pick the leveled override whose threshold key is the highest that
 *  is still ≤ `level`. Returns the merged roll, or the base unchanged
 *  when the roll doesn't declare `leveled`, no level is available, or
 *  no threshold is met (i.e. character is below the first threshold —
 *  the base roll itself is the pre-threshold default). */
function resolveLeveled(base: RollAspect, kind: RollRow["kind"], sourceLevel: number | undefined, characterLevel: number): RollAspect {
  const leveled = base.leveled;
  if (!leveled) return base;
  // Default dimension: class level for features (use source level),
  // character level for spells / cantrips. Weapons and manual rows
  // don't typically declare `leveled` but fall back to character level.
  const by = leveled.by ?? (kind === "feature" ? "class" : "character");
  const level = by === "class" ? sourceLevel : characterLevel;
  if (level == null) return base;
  const thresholds = Object.keys(leveled.at)
    .map((k) => Number(k))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
  let picked: number | undefined;
  for (const t of thresholds) {
    if (t <= level) picked = t;
    else break;
  }
  if (picked == null) return base;
  return applyRollOverride(base, leveled.at[picked]);
}

/** Resolve a `cost.max` declaration (either a literal number or a
 *  small formula string) against the character's context. Unknown or
 *  unparseable strings return `undefined`, letting the cell fall
 *  back to its non-interactive label state. */
function resolveCostMax(
  max: number | string | undefined,
  ctx: { pb: number; characterLevel: number; sourceLevel: number | undefined }
): number | undefined {
  if (max == null) return undefined;
  if (typeof max === "number") return max;
  const raw = max.trim();
  if (!raw) return undefined;
  switch (raw) {
    case "PB":
      return ctx.pb;
    case "level":
      return ctx.characterLevel;
    case "class_level":
      return ctx.sourceLevel ?? ctx.characterLevel;
    default: {
      // Plain numeric literal in a string ("6", "10") is still valid.
      const n = Number(raw);
      return Number.isFinite(n) ? n : undefined;
    }
  }
}

function resolveWielderStats(blocks: unknown): WielderStats {
  const stats = (blocks as { stats?: Record<string, unknown> })?.stats ?? {};
  const pick = (key: string): number => {
    const cell = stats[key];
    if (typeof cell === "number") return cell;
    if (cell && typeof cell === "object" && typeof (cell as { value?: number }).value === "number") {
      return (cell as { value: number }).value;
    }
    return 10;
  };
  const mod = (score: number): number => Math.floor((score - 10) / 2);
  // PB derived from summed class levels — stays in lockstep with
  // `expressions.ProficiencyBonus()` without needing the expressions hookup.
  const header = (blocks as { header?: Partial<HeaderProps> })?.header;
  const classLevels = Array.isArray(header?.classes)
    ? header!.classes.reduce(
        (acc: number, c) =>
          acc + (typeof (c as { level?: number }).level === "number" ? (c as { level: number }).level : 0),
        0
      )
    : 0;
  const pb = Math.floor(Math.max(0, classLevels - 1) / 4) + 2;
  return {
    str: mod(pick("STR")),
    dex: mod(pick("DEX")),
    con: mod(pick("CON")),
    int: mod(pick("INT")),
    wis: mod(pick("WIS")),
    cha: mod(pick("CHA")),
    pb,
  };
}

function deriveWeaponRows(
  blocks: unknown,
  lookup: CharacterEntity["lookup"] | undefined,
  stats: WielderStats,
  equip: EquipState
): Array<Omit<RollRow, "available">> {
  const inv = (blocks as { inventory?: { items?: unknown[] } })?.inventory;
  const rawItems = Array.isArray(inv?.items) ? inv.items : [];
  const items = rawItems.flatMap(flattenItemEntries);
  const library = (lookup?.$items ?? {}) as Record<string, ItemElementData>;
  const magicLib = (lookup?.$magic ?? {}) as Record<string, ItemMagicData>;
  const personalLib = (lookup?.$personal ?? {}) as Record<string, ItemPersonalData>;
  const rows: Array<Omit<RollRow, "available">> = [];
  const handItems = new Set<string>();
  if (equip.mainHand) handItems.add(equip.mainHand);
  if (equip.offHand) handItems.add(equip.offHand);

  // Sum quantities per item name — a dual-wielder with two stacked
  // Shortswords (`qty: 2`) picks up a bonus-action off-hand strike, per
  // 5e two-weapon-fighting rules.
  const qtyByName = new Map<string, number>();
  for (const entry of items) {
    const name = stripWikilink(entry.name);
    if (!name) continue;
    const prev = qtyByName.get(name) ?? 0;
    qtyByName.set(name, prev + (typeof entry.qty === "number" ? entry.qty : 1));
  }
  const emitted = new Set<string>();

  for (const entry of items) {
    const target = stripWikilink(entry.name);
    if (!target) continue;
    if (!handItems.has(target)) continue;
    if (emitted.has(target)) continue;
    emitted.add(target);
    // Personal item? Resolve to its effective element (base merged
    // with magic bonus / rarity / etc.) plus an optional overlay
    // carrying extra-damage dice the magic templates add (Flame
    // Tongue's +1d6 fire, etc.). Flat roll / damage bonuses already
    // live on `effectiveElement.weapon.bonus`, so we don't pass them
    // through the overlay channel — that would double-count inside
    // `deriveWeaponRoll`.
    const personal = personalLib[target];
    let element: ItemElementData;
    let overlay: WeaponOverlay | undefined;
    if (personal) {
      const resolution = resolvePersonalItem(personal, { elements: library, magic: magicLib }, target);
      if (!resolution) continue;
      element = resolution.effectiveElement;
      overlay = resolution.weaponOverlay;
    } else {
      const itemData = library[target];
      if (!itemData) continue;
      element = itemData;
    }
    const derived = deriveWeaponRolls(element, stats, overlay, target);
    if (derived.length === 0) continue;
    derived.forEach((roll, i) => {
      rows.push({
        id: derived.length > 1 ? `weapon:${target}:${i}` : `weapon:${target}`,
        kind: "weapon",
        roll,
        sourceNote: target,
      });
    });

    // Two-weapon fighting bonus action: when the main-hand weapon is
    // Light and the character carries at least two of them (one per
    // hand), fan out a companion off-hand strike that drops the
    // ability mod from damage.
    const qty = qtyByName.get(target) ?? 0;
    if (target === equip.mainHand && qty >= 2 && hasWeaponProperty(element, "light")) {
      const offHand = deriveWeaponRolls(element, stats, { ...overlay, offHand: true }, `${target} (Off-hand)`);
      // Only the primary-mode off-hand strike — versatile / thrown
      // fan-outs on the off-hand would misrepresent the bonus-action
      // economy (it's one extra roll, not a fresh set of modes).
      const primary = offHand[0];
      if (primary) {
        rows.push({
          id: `weapon:${target}:offhand`,
          kind: "weapon",
          roll: primary,
          sourceNote: target,
        });
      }
    }
  }
  return rows;
}

function flattenItemEntries(raw: unknown): Array<{ name: string; qty?: number; equipped?: boolean; slot?: string }> {
  if (typeof raw === "string") return [{ name: raw }];
  if (!raw || typeof raw !== "object") return [];
  const o = raw as {
    name?: string;
    qty?: number;
    quantity?: number;
    equipped?: boolean;
    slot?: string;
    contents?: unknown[];
  };
  const out: Array<{ name: string; qty?: number; equipped?: boolean; slot?: string }> = [];
  if (typeof o.name === "string") {
    const qty = typeof o.qty === "number" ? o.qty : typeof o.quantity === "number" ? o.quantity : undefined;
    out.push({ name: o.name, qty, equipped: o.equipped, slot: o.slot });
  }
  if (Array.isArray(o.contents)) {
    for (const c of o.contents) out.push(...flattenItemEntries(c));
  }
  return out;
}

function stripWikilink(raw: string): string {
  const m = raw.match(/^\[\[(.+?)\]\]$/);
  if (!m) return raw.trim();
  return m[1].split("|")[0].split("/").pop()!.trim();
}

function resolveCasters(
  blocks: unknown,
  lookup: CharacterEntity["lookup"] | undefined
): Map<string, CasterInfo> {
  const out = new Map<string, CasterInfo>();
  const header = (blocks as { header?: unknown })?.header;
  const features = (blocks as { features?: FeaturesBlockData })?.features;
  if (!header || !lookup?.$features) return out;
  try {
    const view = lookup.$features(header, features?.choices, features?.additional);
    for (const caster of view.casters ?? []) {
      const c = caster as { source: string; ability: string; tier?: CasterTier; level?: number };
      out.set(c.source, {
        source: c.source,
        ability: c.ability,
        tier: c.tier ?? "none",
        level: typeof c.level === "number" ? c.level : 0,
      });
    }
  } catch {
    // partial state — empty map is safe.
  }
  return out;
}

function deriveSpellRows(
  blocks: unknown,
  lookup: CharacterEntity["lookup"] | undefined,
  stats: WielderStats,
  casters: Map<string, CasterInfo>,
  characterLevel: number
): Array<Omit<RollRow, "available">> {
  const spellsBlock = (blocks as { spells?: { casters?: Record<string, unknown> } })?.spells;
  const castersState = (spellsBlock?.casters ?? {}) as Record<
    string,
    {
      cantrips?: string[];
      prepared?: Record<string, string[]>;
      known?: Record<string, string[]>;
    }
  >;
  const library = lookup?.$spells ?? {};
  const seen = new Set<string>();
  const rows: Array<Omit<RollRow, "available">> = [];
  for (const [source, state] of Object.entries(castersState)) {
    const resolved = casters.get(source);
    if (!resolved) continue;
    const abilityMod = abilityModFromStats(stats, resolved.ability);
    const toHit = `${signed(stats.pb + abilityMod)} (${resolved.ability})`;
    const dc = `${8 + stats.pb + abilityMod}`;
    const pool = [...(state.cantrips ?? []), ...flattenSpellLevels(state.prepared), ...flattenSpellLevels(state.known)];
    for (const raw of pool) {
      const name = stripWikilink(raw);
      if (!name || seen.has(name)) continue;
      seen.add(name);
      const body = library[name] as { roll?: RollAspect } | undefined;
      const roll = body?.roll;
      if (!roll) continue;
      const filled: RollAspect = {
        ...roll,
        name: roll.name ?? name,
        to_hit: roll.form === "spell" ? (roll.to_hit ?? toHit) : roll.to_hit,
        save: roll.save ? { ...roll.save, dc: roll.save.dc ?? dc } : roll.save,
      };
      // Apply `leveled` scaling (cantrips tick with character level).
      // `upcast` / `swapOn` stay deferred — they're interactive and
      // resolved in `RollRowUI` based on user selection.
      const leveled = resolveLeveled(filled, "spell", undefined, characterLevel);
      rows.push({
        id: `spell:${source}:${name}`,
        kind: "spell",
        roll: leveled,
        sourceNote: name,
        caster: resolved,
      });
    }
  }
  return rows;
}

function abilityModFromStats(stats: WielderStats, ability: string): number {
  const key = ability.trim().toUpperCase();
  switch (key) {
    case "STR":
      return stats.str;
    case "DEX":
      return stats.dex;
    case "CON":
      return stats.con;
    case "INT":
      return stats.int;
    case "WIS":
      return stats.wis;
    case "CHA":
      return stats.cha;
    default:
      return 0;
  }
}

function flattenSpellLevels(map: Record<string, string[]> | undefined): string[] {
  if (!map) return [];
  return Object.values(map).flatMap((v) => (Array.isArray(v) ? v : []));
}

function deriveFeatureRows(
  blocks: unknown,
  lookup: CharacterEntity["lookup"] | undefined,
  characterLevel: number
): Array<Omit<RollRow, "available">> {
  const header = (blocks as { header?: unknown })?.header;
  const features = (blocks as { features?: FeaturesBlockData })?.features;
  if (!header || !lookup?.$features) return [];
  const view = lookup.$features(header, features?.choices, features?.additional);
  const rows: Array<Omit<RollRow, "available">> = [];
  for (const src of view.sources ?? []) {
    for (const f of src.features as FeatureDetails[]) {
      if (!f.roll) continue;
      const rowName = f.roll.name ?? f.name;
      const named: RollAspect = { ...f.roll, name: rowName };
      // Features default to class-level scaling — `src.level` is the
      // character's level in this source (class / heritage /
      // background). Authors can override with `leveled.by: character`.
      const leveled = resolveLeveled(named, "feature", src.level, characterLevel);
      rows.push({
        id: `feature:${src.source}:${f.name}:${rowName}`,
        kind: "feature",
        roll: leveled,
        sourceNote: src.source,
        sourceLevel: src.level,
      });
    }
  }
  return rows;
}

function deriveManualRows(manual: RollEntry[] | undefined): Array<Omit<RollRow, "available">> {
  if (!Array.isArray(manual)) return [];
  const rows: Array<Omit<RollRow, "available">> = [];
  manual.forEach((atk, i) => {
    const name = atk.name || atk.label || `Roll ${i + 1}`;
    const aspect: RollAspect = {
      name,
      form: "melee",
      to_hit:
        typeof atk.to_hit === "number" ? signed(atk.to_hit) : typeof atk.to_hit === "string" ? atk.to_hit : undefined,
      range: atk.range,
      damage: atk.damage ? { roll: atk.damage.roll, type: atk.damage.type, bonus: atk.damage.bonus } : undefined,
      notes: atk.notes,
    };
    rows.push({
      id: `manual:${i}`,
      kind: "manual",
      roll: aspect,
      sourceNote: name,
    });
  });
  return rows;
}

// ─── Equip-state + availability ─────────────────────────────────────────────

function resolveEquipState(blocks: unknown, lookup: CharacterEntity["lookup"] | undefined): EquipState {
  const state: EquipState = { mainHand: null, offHand: null };
  const inv = (blocks as { inventory?: { items?: unknown[] } })?.inventory;
  const rawItems = Array.isArray(inv?.items) ? inv.items : [];
  const items = rawItems.flatMap(flattenItemEntries);
  const library = lookup?.$items ?? {};

  for (const entry of items) {
    if (!entry.equipped && !entry.slot) continue;
    const target = stripWikilink(entry.name);
    if (!target) continue;
    const itemData = library[target] as ItemElementData | undefined;
    const isTwoHanded = itemData?.weapon ? hasProperty(itemData.weapon.properties, "two-handed") : false;

    if (entry.slot === "main_hand") {
      state.mainHand = target;
      if (isTwoHanded) state.offHand = target;
    } else if (entry.slot === "off_hand" || entry.slot === "shield") {
      state.offHand = target;
    } else if (entry.equipped && itemData?.weapon) {
      if (!state.mainHand) state.mainHand = target;
      if (isTwoHanded && !state.offHand) state.offHand = target;
    }
  }

  return state;
}

function hasProperty(properties: string[] | undefined, name: string): boolean {
  if (!properties) return false;
  const target = name.toLowerCase();
  return properties.some((p) => {
    const bare = p.replace(/^\[\[/, "").replace(/\]\]$/, "").split("|")[0].toLowerCase();
    return bare === target;
  });
}

/** Check whether the weapon block of an item element declares a named
 *  property. Used for two-weapon-fighting detection ("Light"). */
function hasWeaponProperty(element: ItemElementData, name: string): boolean {
  return hasProperty(element.weapon?.properties, name);
}

function isRollAvailable(
  kind: RollRow["kind"],
  roll: RollAspect,
  sourceNote: string,
  equip: EquipState
): boolean {
  const requires = roll.requires ?? (roll.form === "melee" || roll.form === "ranged" ? "one_hand" : "none");

  if (kind === "weapon") {
    const inMain = equip.mainHand === sourceNote;
    const inOff = equip.offHand === sourceNote;
    if (!inMain && !inOff) return false;
    if (requires === "two_hands") {
      return inMain && (equip.offHand === null || equip.offHand === sourceNote);
    }
    return true;
  }

  switch (requires) {
    case "none":
      return true;
    case "one_hand":
      return equip.mainHand !== null || equip.offHand !== null;
    case "two_hands":
      return equip.mainHand !== null && (equip.offHand === null || equip.offHand === equip.mainHand);
    case "free_hand":
      return equip.mainHand === null || equip.offHand === null;
    default:
      return true;
  }
}

export default rolls;
