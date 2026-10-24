/**
 * Declarative feature import — type definitions.
 *
 * Pure types for compendium-driven character feature resolution.
 * No Obsidian / vault dependencies; safe to import from tests and the resolver.
 */

import type { TableDef } from "../tables/types";

// ─── Source-document blocks ───────────────────────────────────────────────────

/**
 * Mapping of trait group → contribution. The character sheet aggregates
 * traits across all loaded features by key.
 *
 * A value can be a single string (`"+8 +CON mod"`) or a string array
 * (`["[[Light Armor]]", "[[Medium Armor]]"]`) when a feature contributes
 * multiple discrete entries to the same group. YAML wikilinks (`[[X]]`)
 * authored without quotes parse as nested arrays — the resolver normalises
 * those back to `"[[X]]"` strings so the rendered output keeps the link.
 */
export type TraitValue = string | string[];
export type TraitMap = Record<string, TraitValue>;

/**
 * Inline pick spec on a `feature.details` block. Each picked option is added
 * verbatim as a value to the named trait `category`. No separate
 * `feature.choice` blocks needed — handy for simple "pick N from list"
 * features like proficiency choices.
 *
 * `type: "asi"` (Ability Score Improvement) reuses the same picking flow but
 * allows duplicate picks: the user may select the same option more than once
 * up to `number` total, with each pick contributing `quantity` points (1 by
 * default) to the chosen value.
 */
export interface ChooseSpec {
  type: "traits" | "asi" | "talent" | "spellcasting";
  /** Trait bucket picks contribute to. Required for `traits`; optional for
   *  `asi` (defaults to "Ability Scores" for display purposes), for
   *  `talent` (defaults to "Talent"), and for `spellcasting` (must be
   *  `"ability"` — the picked value drives the caster's save DC / attack
   *  modifier / prepared count expression). */
  category?: string;
  number: number;
  /** Points added per pick. `asi` only; defaults to 1. Ignored by `traits`. */
  quantity?: number;
  /**
   * ASI only. When true (default) each option can be picked at most once
   * — the `+` control disables for attributes already chosen. Set to
   * `false` to allow repeat picks (e.g. stacking all three points from a
   * talent into a single attribute).
   */
  unique?: boolean;
  /**
   * Options available to pick from. For `asi` this may be omitted — the
   * resolver falls back to the six core attributes (Strength, Dexterity,
   * Constitution, Intelligence, Wisdom, Charisma) so compendium authors
   * don't have to repeat the list on every ASI spec.
   */
  options?: string[];
}

/**
 * A `feature.level` block: extra contributions applied to the preceding
 * `feature.details` once the character reaches the specified class level.
 * Data-only — renders no visible UI in the compendium doc.
 */
export interface FeatureLevelAddition {
  level: number;
  traits?: TraitMap;
  /** Incremental spellcasting contributions unlocked at this level
   *  (e.g. Cleric's `feature.level` blocks at 4 / 10 add +1 cantrip).
   *  Folded additively onto the parent caster just like declaration
   *  fragments, but gated by the character's class level. */
  spellcasting?: SpellcastingFragment;
}

/**
 * One feature, parsed from a `rpg feature.details` code block.
 *
 * If `pick` is set, the feature is a choice slot — its options come from
 * `feature.choice` blocks that declare `parent: <this name>`.
 *
 * If `choose` is set, the feature offers an inline pick that aggregates
 * picked values into a named trait category.
 *
 * `text` is multiline Obsidian markdown rendered as the body of the feature
 * card; the surrounding compendium prose is folded into this field.
 * `traits` describe the contributions this feature makes to a character
 * sheet's aggregated traits row.
 */
/**
 * A single aspect of a feature. Authored as a sub-object under one of the
 * recognised aspect keys (`action`, `bonus`, `reaction`, `active`, `passive`,
 * `resource`) on `FeatureDetails`. When present, each aspect produces its
 * own entry in the character sheet's type-grouped accordion, with the
 * aspect's `text` shown on the card instead of the parent feature's full
 * compendium prose.
 */
/**
 * What a passive (always on) or an active (switched on and off) feature does
 * to other cards. `on` says which: `attack`, `melee attack`, `ranged attack`,
 * `spell attack`, `spell`, `save`, or a card's own name.
 */
export interface AspectModifier {
  on: string;
  /** Added to the damage: `2`, `+2`, or dice (`1d4`). */
  damage?: number | string;
  /** Added to the attack roll. */
  to_hit?: number | string;
  /** Advantage on the roll: `true`, or which saves (`STR`, `STR, CON`). */
  advantage?: boolean | string;
  disadvantage?: boolean | string;
  /** Said on the card, nothing rewritten (`speed +10 ft.`, `resistance to slashing`). */
  note?: string;
}

export interface FeatureAspect {
  /** Aspect-specific name, overrides the parent feature's name in the bucket. */
  name?: string;
  /** What it does to other cards while it applies (a passive's always; an active's while on). */
  modifies?: AspectModifier | AspectModifier[];
  /** An `active:` that switches on and off, even with nothing to modify. */
  toggle?: boolean;
  /** Aspect card text on the character sheet. Falls back to parent `text`. */
  text?: string;
  /** Name of a resource feature this aspect consumes (by-name reference). */
  resource?: string;
  /** Pool max when the aspect is itself a resource. Scalar or per-level map. */
  max?: number | string | Record<number, number>;
  /** Free-form recovery cadence ("short rest", "1/long rest", …). */
  recovery?: string;
  /** Inline cooldown within a single turn ("once per turn", "once per round"). */
  recharge?: string;
  /** Lonelog template appended to session log when this aspect is used. */
  log?: string;
  /**
   * It can go WITH an attack, as well as on its own (Wind Up, Aim): which
   * attacks (`melee` / `ranged` weapon attacks), the damage it adds and what it
   * adds to the attack roll — a number or `PB`. Taken as this aspect's own
   * action (a martial action's bonus action), hit or miss.
   */
  rider?: { with?: "melee" | "ranged"; damage?: number | string; hit?: number | string };
}

/** One entry of an aspect list: a named aspect, or a `[[link]]` to a note (YAML
 *  may read an unquoted `[[Weapon Option]]` as a nested array). */
export type AspectItem = FeatureAspect | string | unknown[];

// Re-export the roll aspect types so downstream modules can import
// `RollAspect` from the same surface as the other feature types.
export type { RollAspect, DamageSpec, RollSave, RollEffect } from "./roll";

// ─── GM features (rpg feature.gm) ──────────────────────────────────────────────
//
// The GM-side analog of `FeatureDetails`. A `feature.gm` block declares one GM
// feature whose nested aspect sub-objects each map to a lonelog prefix:
//
//   oracle    → ?            roll      → d:           table     → tbl:
//   generator → gen:         event     → !            scene     → => / S##
//
// Aspects emit UNROLLED (`d10=`, bare `->`); the reader fills dice/answers via
// the session-log's inline editing. `interpret` / `likelihood` are metadata used
// to resolve the `->` answer (see ../gm/fate-chart.ts), not written into the line.
// The emitter lives in ../gm/emit.ts.

/** The lonelog-machinery stack a GM card lives under — mirrors the aspect keys. */
/** A drawer stack. The aspect names, plus `meaning` (Meaning Tables) and
 *  `list` (rolls on a lonelog list) for cards that group by use, not aspect. */
export type GMStack = "oracle" | "meaning" | "list" | "combat" | "roll" | "table" | "generator" | "event" | "scene";

/**
 * Worded outcomes keyed by a comparison expression evaluated against the roll
 * (and the chaos factor). Object key order is significant — the first matching
 * key wins. Supported key grammar (see ../gm/fate-chart.ts → resolveInterpret):
 *   - vs CF:     ">CF" ">=CF" "<CF" "<=CF"
 *   - vs number: ">18" ">=7" "<3" "<=15" "=20"
 *   - range:     "4-15"  (inclusive)
 *   - parity:    "even" "odd"  (combine with a comparison via comma: "<=CF, odd")
 */
export type GMInterpret = Record<string, string>;

/** Likelihood band for a Mythic-style fate question — drives Fate Chart odds
 *  against the current chaos factor (see ../gm/fate-chart.ts). */
export type GMLikelihood =
  | "certain"
  | "near-certain"
  | "very-likely"
  | "likely"
  | "50/50"
  | "unlikely"
  | "very-unlikely"
  | "near-impossible"
  | "impossible";

/** `oracle:` aspect → emits a `?` question (plus a `->` answer line when the
 *  oracle bears its own resolution: roll / likelihood / interpret). */
export interface GMOracleAspect {
  /** Yes/no or open question. Supports `{{placeholders}}`. */
  question: string;
  /** Attribution → `?(Name)`. */
  attribution?: string;
  /**
   * Reference an imported resource by the tag NAME declared in a `reads:` file
   * (its `abbr` — e.g. `CF`, declared as a `dial:` in Chaos Factor) → emits
   * `[<tag>:{{<tag>}}]` on the question line, and shares that value with the
   * feature's generator `vs:`. The generalized form of `chaos: true` (which is
   * now just sugar for `tag: CF`). A constant `cf:` still overrides to bake a
   * literal `[<tag>:n]`.
   */
  tag?: string;
  /** Sugar for `tag: CF` — emit `[CF:n]` from the session chaos factor (a
   *  `{{cf}}` slot until session CF state exists). */
  chaos?: boolean;
  /** Constant chaos factor — overrides `chaos`/`tag` and bakes the literal `[CF:n]`. */
  cf?: number;
  /**
   * The amounts the card may MOVE the resource by as it opens the question —
   * `adjust: [+1, -1]` emits `? [CF+1] …` or `? [CF-1] …`, picked when the card
   * is played. Wins over `cf` / `tag`'s set form; the feature's checks then read
   * the moved value (`vs CF`) from the log.
   */
  adjust?: Array<number | string>;
  /**
   * The oracle that answers, by name (`Fate Chart`, `Fate Check`) — emits an
   * `o:` line under the question, resolved from its roll, odds and the log's
   * current chaos factor. Rolls `d100` (Fate Check: `2d10`) unless `roll` says.
   */
  consult?: string;
  /** The odds an `o:` line asks at; `ask` (the default) picks them per question. */
  odds?: GMLikelihood | "ask";
  /** Likelihood band → Fate Chart odds against the chaos factor. */
  likelihood?: GMLikelihood;
  /** Die rolled for the answer (e.g. `d100`). Emitted unrolled. */
  roll?: string;
  /** Contest target. `"CF"` expands to `CF <n>`; otherwise verbatim. */
  vs?: string;
  interpret?: GMInterpret;
}

/** `roll:` aspect → emits `d:` / `d(Name):`. */
export interface GMRollAspect {
  /** Attribution / check name → `d(Name):`. */
  name?: string;
  /** Dice expression, e.g. `d20+5`. Emitted unrolled. */
  die: string;
  /** Contest target, e.g. `DC 15` (or `CF`). */
  vs?: string;
  interpret?: GMInterpret;
}

/** `table:` aspect → emits `tbl:`. */
export interface GMTableAspect {
  /**
   * Table reference(s) — each an `@[[file]].table(id)` call (same file or
   * another) or a bare table name. A single string rolls one table; an array
   * rolls EVERY listed table, emitting one `tbl:` line each (e.g. a Meaning
   * word-pair, or cross-file descriptor facets rolled together). For a
   * choose-one dropdown or a random pick-N over tables, use a `steps` block.
   */
  source: string | string[];
  /** Die override; defaults to the referenced table's own die. */
  die?: string;
}

/**
 * One rolled working line a generator emits — the indented
 * `  <work>: <roll>= vs <vs> ->` under the `gen:` header, resolved via
 * `interpret` (roll → result) and optional `follow` (per-result dropdown). A
 * generator's `steps:` is a list of these, so one `gen:` can roll several lines
 * (e.g. Event Focus + Action + Subject).
 */
export interface GMGenStep {
  /** Label of the indented working line (e.g. `Alterations`). Omit for a bare
   *  `  <roll>= vs <vs> ->` line. */
  work?: string;
  /** Die for the working line, emitted unrolled (`d10=`). */
  roll?: string;
  /** Contest target for the working line. `"CF"` expands to `CF <n>`. */
  vs?: string;
  interpret?: GMInterpret;
  follow?: Record<string, Record<string, string>>;
  /**
   * Roll this step's die against a table (a `@[[file]]#id` / `@[[file]].table(id)`
   * ref): rolling auto-fills the `->` from the matched row. This is a generator
   * step CALLING a table inline (a `gen:` composing table rolls into a concept)
   * — distinct from a standalone `tbl:` consultation. Auto-fill flows through the
   * step's composed `+ ` children too.
   */
  table?: string;
  /**
   * Unconditional CHOICE this working line presents — the GM PICKS rather than
   * rolls. Emits `  <work>: [a/b/c - ]`; picking an option in the live log spawns
   * that option's generated line(s) (mapped from a companion step block whose
   * `choice:` labels match — e.g. Event Meaning's Actions/Descriptions/Elements,
   * each a word-pair). Distinct from `interpret`/`follow` (which are keyed by a
   * roll RESULT); a `choices` step has no die.
   */
  choices?: string[];
  /**
   * With `choices`: ask for the pick when the card is used, as a `{{<ask>:a|b|c}}`
   * choice slot filled in the card's popup, so the line arrives with its option
   * already selected (and that option's generated lines spawned). The pick can
   * still be switched in the Log afterwards.
   */
  ask?: string;
}

/** `generator:` aspect → emits `gen:` plus its rolled working line(s). */
export interface GMGeneratorAspect {
  /** Generator label → `gen: <name>`. */
  name: string;
  /**
   * The rolled working line(s) under the `gen:` header. When present, this is
   * the canonical form. The flat `work` / `roll` / `vs` / `interpret` / `follow`
   * fields below are backward-compat SUGAR for a single step (synthesized when
   * `steps` is absent), so existing generators keep working unchanged.
   */
  steps?: GMGenStep[];
  /** Sugar: die for a single implicit working line. Emitted unrolled. */
  roll?: string;
  /** Sugar: contest target for the single working line. `"CF"` → `CF <n>`. */
  vs?: string;
  /** Sugar: label of the single working line (e.g. `Alterations`). */
  work?: string;
  interpret?: GMInterpret;
  /**
   * Follow-up strategies a result offers, keyed by the result text, then by the
   * option label → the lonelog line that picking it generates (empty string =
   * no generated line, just records the pick). When that result comes up the GM
   * picks one from the `[opt/opt - ]` dropdown and the generated line is
   * inserted under the generator. A generated line may itself reference a shared
   * `rpg table.*` (e.g. `tbl: Scene Adjustment d10= ->`) or carry a nested
   * `[a/b - ]` choice.
   */
  follow?: Record<string, Record<string, string>>;
  /**
   * Sub-generators this generator COMPOSES: each entry is a piece (usually a
   * generator `@ref` — local `@id` or `@[[File]]#id`) whose emitted lines are
   * appended inline after this generator's own line. Lets a generator call
   * other generators (e.g. a Random Event = Event Focus + Event Meaning), define
   * once and reuse. Expansion is depth- and cycle-guarded (see ./emit).
   */
  emits?: EmitPiece[];
}

/** `event:` aspect → emits `!` (optionally preceded by `gen:` focus/meaning). */
export interface GMEventAspect {
  /** World-event text → `! <text>`. Supports `{{placeholders}}`. Defaults to a
   *  `{{event}}` slot. */
  text?: string;
  /** Event-focus oracle reference → a leading `gen:` line. */
  focus?: string;
  /** Meaning-table references → leading `gen:` lines. */
  meaning?: string[];
}

/** `scene:` aspect → emits a `=>` consequence (scene-opening or plain). */
export interface GMSceneAspect {
  /** Opens a numbered scene → `=> S## <title>`. Supports `{{placeholders}}`. */
  opens?: string;
  /** Plain (non-scene) consequence → `=> <text>`. */
  consequence?: string;
}

/**
 * `dial:` aspect → declares an importable bounded dial (e.g. the Chaos Factor).
 * DECLARED once in a `gm-tools/dials/` file so logs don't re-state the range
 * each time: a log block carries just a leading `[<abbr>:n]` token (current
 * value), and any feature that `reads:` this declaration falls back to
 * `default` when no token is present. The self-contained `[Dial:Name|cur|min-max]`
 * body tag (see lonelog/tag-extractor) is the inline alternative; `[<abbr>:n]`
 * references this declared dial by its `abbr`. A dial-only feature emits no
 * lonelog line — it renders a dial widget and is a resource, not an action.
 */
export interface GMDialAspect {
  /** Short token used in logs: `[<abbr>:n]` (e.g. `CF`). */
  abbr: string;
  /** Lower bound of the band. */
  min: number;
  /** Upper bound of the band. */
  max: number;
  /** Value used when no `[<abbr>:n]` token is present in the log block. */
  default: number;
}

/**
 * `list:` aspect → declares an importable lonelog LIST (Characters, Threads, …).
 * A list is a named collection the log grows and consults:
 *   - `[<name>+ entry]` appends an entry,
 *   - `[<name>- entry]` removes one,
 *   - `[<name>?]`       consults it (rolls a live entry; falls back to `default`
 *                        when the list has no entries — the testing path).
 * DECLARED once in a `gm-tools/` file (like a `dial:`) and imported via `reads:`
 * so a log block references it by name without re-stating it. A list-only
 * feature emits no lonelog line — it's a resource, not an action.
 */
export interface GMListAspect {
  /** List name used in tokens (`[<name>?]`); falls back to the feature name. */
  name?: string;
  /** Consult fallback returned when the list has no live entries. */
  default: string;
  /** Optional seed entries (used by live entry-rolls; consult→default ignores). */
  entries?: string[];
  /**
   * Rows per SECTION (Mythic's X = 5). The row roll is a d(2×section), so five
   * rows are picked by a d10 read in pairs (1-2 → row 1, 3-4 → row 2, …).
   */
  section?: number;
  /**
   * Maximum entries the sheet holds (Mythic's Y = 25) — `max / section` sections.
   * Rolls landing past the last live entry hit a void cell → the `default`.
   */
  max?: number;
}

/**
 * A declared lonelog RESOURCE — a bounded numeric value with a default,
 * referenced in the log by a token. The reference form decides scope:
 *   - has `abbr` → SESSION resource, referenced `[<abbr>±n]` / `[<abbr>?]`,
 *     tracked across the whole log (e.g. the Chaos Factor dial).
 *   - no `abbr`  → PC resource, referenced `[<Character>/<name>±n]`, tracked
 *     per character (e.g. `[Talon/Mystic Mark-1]`).
 * Shapes differ only in bounds/default (see `normalizeResource`): dial swings
 * within a band; clock/track fill 0→max; counter/charges start full and spend
 * down; timer counts down. A `feature.gm`'s top-level `dial:` aspect is sugar
 * for a single dial resource.
 */
interface ResourceBase {
  /** Local id for `@ref` import (used from Phase 2 on); optional now. */
  id?: string;
  /** Display name for the pill (falls back to abbr/name/id). */
  name?: string;
}
export interface DialResource extends ResourceBase {
  abbr: string;
  min: number;
  max: number;
  default: number;
}
/** clock/track → 0..max, starts at 0 (fills up). `abbr` → session, else PC. */
export interface ClockResource extends ResourceBase {
  abbr?: string;
  max: number;
}
/** counter/charges → 0..max, starts FULL (`-n` spends). `abbr` → session, else PC. */
export interface ChargesResource extends ResourceBase {
  abbr?: string;
  max: number;
  recovery?: string;
}
export type ResourceDecl =
  | { dial: DialResource }
  | { clock: ClockResource }
  | { track: ClockResource }
  | { counter: ChargesResource }
  | { charges: ChargesResource }
  | { timer: ChargesResource };

/**
 * One reusable follow-up CHOICE a step block offers. When an entry feature's
 * `interpret` result is a `@[[link]]` to a step block, the UI imports that
 * block's `steps` as a dropdown on the branching `gen:` line; picking one
 * appends a flat `  <choice>: <calc>` line under the `gen:` (one indent level,
 * never a nested block).
 *
 * `calc` is the expression appended after the choice label:
 *   - `""`                            → just records the pick, no line
 *   - `"(note: …)"`                   → a terminal note
 *   - `"d100= ->"`                    → a roll resolved in place
 *   - `"@[[Scene Adjustment]] d10= ->"` → a roll whose `->` result auto-fills
 *     from the linked table's rolled row (editable)
 */
export interface GMStep {
  /** Choice label — shown in the dropdown and used as the appended line's
   *  label. Absent on a pure `use:` splice step. */
  choice?: string;
  /**
   * NORMAL (deterministic) step label — like `choice`, but the step ALWAYS
   * fires rather than being one of a pick-one dropdown. Use for a branch whose
   * follow-up isn't a decision (e.g. Interrupt Scene → always "Generate a Random
   * Event"): its `  <step>: <calc>` line is inserted automatically, no dropdown.
   * A block may mix normal steps (all fire) with `choice` steps (pick one).
   */
  step?: string;
  /** Expression appended as `  <choice|step>: <calc>` under the `gen:` line.
   *  Absent on a `use:` splice step. */
  calc?: string;
  /**
   * COMPOSITION as CHILDREN: a `@[[link]]#id` to a generator / step-set whose
   * steps are emitted as this step's `+ ` children (flat, one level below). Used
   * for a deterministic hand-off — e.g. Interrupt Scene's `Random Event` step
   * `calls:` the Random Event generator, so its Event Focus / Meaning rolls
   * appear as `+ ` children under it (no nested `gen:`).
   */
  calls?: string;
  /**
   * COMPOSITION: import another step-block's steps in place of this one — a
   * `@[[link]]` (optionally `#blockid`) to a `feature.gm` carrying `steps:`.
   * Spliced at LOAD time, so the imported choices appear inline in this block's
   * dropdown; the shared step-set is defined once and reused (e.g. a `Meaning`
   * block reused by Altered Scene, Interrupt Scene, …). A `use:` step carries no
   * `choice`/`calc` of its own.
   */
  use?: string;
  /**
   * Resolve the calc's rolled die against this table (a `@[[…]]` / `[[…]]`
   * link): the matched row fills the `->` result, editable. (Auto-fill.)
   */
  table?: string;
  /** Resolve the calc's rolled die as a fate question with this likelihood
   *  (against the current chaos factor, via the Fate Chart). */
  likelihood?: GMLikelihood;
  /** Resolve the calc's rolled die through a comparison-expression map (same
   *  grammar as an aspect's `interpret`). */
  interpret?: GMInterpret;
  /**
   * WORD-PAIR auto-fill: an ordered list of table refs (`@[[file]]#blockid`).
   * The pick emits ONE indented line per table — each a self-describing
   * single-die roll (`<choice> <n>: <ref> d100= ->`) that auto-fills from its
   * own table, exactly like `table`. Mutually exclusive with
   * `table`/`likelihood`/`interpret`.
   */
  tables?: string[];
  /** WORD-PAIR: randomly choose this many of `tables` at pick time (e.g. 2 of
   *  3 for Elements). Omitted → roll every entry in `tables`. */
  pick?: number;
  /** A second dropdown: picking this step spawns a `<thenLabel>: [a/b/c - ]` row whose options are
   *  these steps (each with its own `choice`), and picking one of them spawns its lines. For a
   *  style that has several kinds of name. */
  then?: GMStep[];
  /** The second dropdown's label. Default `Kind`. */
  thenLabel?: string;
  /** Names for the rows `tables` spawns, in the same order: what each table is for
   *  (`Name`, `Ending`). Omitted → `<choice> <n>`. A name starting `& ` puts that table's
   *  roll on the same row as the one above it (a Start and its Ending, one name). */
  labels?: string[];
}

/**
 * Fill-in values that showcase a GM feature in use. Combined with the feature's
 * emit template they produce a concrete lonelog excerpt, rendered in the feature
 * card as an "Example" (mechanical entry + narrated prose). See ../gm/example.ts.
 *
 * Reserved keys: `rolls` (die expression → rolled value, e.g. `{ d10: 8 }`),
 * `result` (explicit `->` outcome — otherwise computed from the aspect's
 * `interpret`/`likelihood` using the roll), `narration` (alias that fills
 * `{{title}}` when no `title` is given). Every other key fills the matching
 * `{{placeholder}}` in the emitted template (`scene`, `cf`, `n`, `title`, …).
 */
export interface GMExample {
  rolls?: Record<string, number>;
  result?: string;
  narration?: string;
  [placeholder: string]: unknown;
}

/**
 * One GM feature, parsed from a `rpg feature.gm` block. Nested aspect
 * sub-objects chain (in canonical order: oracle, roll, table, generator, event,
 * scene) into one multi-line lonelog block when the card is used. The card's
 * stack defaults to the first declared aspect (override with `stack:`).
 */
export interface GMFeature {
  name: string;
  /** Card description (markdown) AND the GM card-stack tooltip. */
  text?: string;
  /** Utility within its stack when the feature is itself a card (1 = top). */
  rank?: number;
  /** One sentence on what the card does — shown when it is played, to confirm. */
  summary?: string;
  /** A Lucide icon name drawn large on the card (when the feature is itself one). */
  icon?: string;
  /**
   * Addressable id for `@[[file]].bare(id)` import (matched like a
   * `rule.content` block's `id`, falling back to `name`).
   */
  id?: string;
  /**
   * Heading level (1–6) for the card's name; `"none"` suppresses the name
   * heading. Default 3. Mirrors `FeatureDetails.heading` + `view: "No Title"`.
   * A chained `.hN()` on a `.bare(id)` import overrides this.
   */
  heading?: number | "none";
  /**
   * Worked-example body, authored as `rpg log` content (prose narration +
   * lonelog mechanics) after the fence's `---` separator. Rendered read-only
   * as prose with a toggle revealing the detailed mechanical log. The
   * read-only successor to the `example:` fill-in template.
   */
  body?: string;
  /** Override the card's stack (defaults to the first declared aspect). */
  stack?: GMStack;
  /** Optional limited uses (reuses the consumable mechanics). */
  uses?: number;
  /** Free-form recovery cadence for `uses`. */
  recovery?: string;
  /** Homebrew attribution badge. */
  source?: string;
  /** Fill-in values that showcase the feature in use (rendered as an Example). */
  example?: GMExample;
  oracle?: GMOracleAspect;
  roll?: GMRollAspect;
  table?: GMTableAspect;
  generator?: GMGeneratorAspect;
  event?: GMEventAspect;
  scene?: GMSceneAspect;
  /**
   * Dial declaration (Chaos Factor, Tension, …). A dial-only feature.gm renders
   * a dial widget and is referenced by other features' `reads:`. Emits no
   * lonelog line on its own.
   */
  dial?: GMDialAspect;
  /**
   * List declaration (Characters, Threads, …). A list-only feature.gm renders a
   * list widget and is referenced by other features' `reads:` and by generator
   * ramifications (an Event Focus "NPC" result consults `[Characters?]`). Emits
   * no lonelog line on its own.
   */
  list?: GMListAspect;
  /**
   * Resource links this feature reads, e.g. `["@[[Chaos Factor]]"]`. Each link
   * resolves to a `dial:` declaration so the feature knows how to read the
   * current value (a `[<abbr>:n]` token) and what `default` to fall back to.
   * (Distinct from the numeric `uses:` limited-use count.)
   */
  reads?: string[];
  /**
   * Declared resources (dial / clock / track / counter / charges / timer) — see
   * `ResourceDecl`. Session resources (with `abbr`) are referenced `[<abbr>±n]`;
   * PC resources (no `abbr`) as `[<Character>/<name>±n]`. The top-level `dial:`
   * aspect is sugar for a single dial resource.
   */
  resources?: ResourceDecl[];
  /**
   * Step block: reusable follow-up choices imported into a parent `gen:` line
   * across files. A feature carrying `steps:` (and typically no other aspect)
   * is a STEP block, referenced by an entry feature's `interpret` result via a
   * `@[[file]]` / `@[[file]]#blockid` branch link. Not emitted standalone.
   */
  steps?: GMStep[];
  /**
   * Multiple CARDS declared on one feature.gm block. Each card composes an
   * ordered list of pieces (`emits`) and, on click in the session log, inserts
   * that composed lonelog block. When `cards:` is present the feature is a
   * container — its own top-level aspects are NOT emitted as a card. (A feature
   * without `cards:` is itself a single card from its aspects, as before.)
   */
  cards?: GMCardDef[];
  /**
   * Named generator pieces this feature declares, referenceable from a card's
   * `emits` by a local `@ref` (`"@scene-check"`) or cross-file
   * (`"@[[File]]#id"`). Each is a generator aspect plus an `id`.
   */
  generators?: NamedGenerator[];
}

/** A generator aspect with a local `id`, referenceable from a card's `emits`. */
export type NamedGenerator = GMGeneratorAspect & { id: string };

/**
 * One piece a card emits. Either an inline aspect (a single-key wrapper) or an
 * `@ref` string: `"@localId"` (a `generators:` entry on the same feature) or
 * `"@[[File]]#id"` (a generator declared in another file, resolved at load).
 */
export type EmitPiece =
  | { oracle: GMOracleAspect }
  | { roll: GMRollAspect }
  | { table: GMTableAspect }
  | { generator: GMGeneratorAspect }
  | { event: GMEventAspect }
  | { scene: GMSceneAspect }
  | string;

/**
 * A clickable card declared under a feature's `cards:`. `emits` are the pieces
 * it appends to the log, in order. Lands in the stack of `stack:` (else the
 * first emit piece's aspect).
 */
export interface GMCardDef {
  name: string;
  id?: string;
  stack?: GMStack;
  /** Card description / tooltip. */
  text?: string;
  /** How useful the card is within its stack — 1 is the most useful and sits
   *  on top of the deck; unranked cards follow in the order declared. */
  rank?: number;
  /** One sentence on what the card does — shown when it is played, to confirm. */
  summary?: string;
  /** A Lucide icon name (`help-circle`, `clapperboard`) drawn large on the card. */
  icon?: string;
  /** A card whose lines come from the fight rather than a template:
   *  `start-combat` sets up a fight (foes, party, initiative) in its own popup;
   *  `next-turn` starts the next pass through the initiative order (`T2`);
   *  `next-round` marks whose round it is in it (`R(Talon)`), the next in
   *  initiative by default. */
  kind?: "start-combat" | "next-round" | "next-turn" | "end-combat";
  /** Limited uses (reuses the consumable mechanics). */
  uses?: number;
  recovery?: string;
  emits: EmitPiece[];
}

export interface FeatureDetails {
  name: string;
  /**
   * Explicit subtitle line (e.g. `"2nd, 6th, 13th, and 18th-Level Cleric Feature"`).
   * When set, it replaces the auto-composed `Lv. N · type · uses · Pick N` row
   * so compendium docs can match book phrasing verbatim.
   */
  subtitle?: string;
  /** Multiline Obsidian-flavored markdown rendered as the feature body. */
  text?: string;
  /** Group → contribution. Aggregated across features in the character sheet. */
  traits?: TraitMap;
  /**
   * Inline pick spec that contributes picked values to `traits[category]`.
   *
   * May be a single spec or an array of specs — an array lets one block
   * declare multiple independent picks (e.g. the Adherent background
   * granting a Skill P. pick and a Tools pick in the same feature). Each
   * spec in an array is tracked by its own pick key so the picks don't
   * overwrite each other.
   */
  choose?: ChooseSpec | ChooseSpec[];
  /**
   * Per-level augmentations from sibling `rpg feature.level` blocks. Each
   * entry's traits are applied to the running aggregate when the character's
   * class level is at or above the entry's `level`.
   */
  levels?: FeatureLevelAddition[];
  type?: string;
  level?: number;
  uses?: number;
  link?: string;
  /**
   * Rendering hint for the `rpg feature.details` block in an Obsidian
   * reading-mode view. Currently recognised: `"No Title"` (also
   * `"no-title"` / `"notitle"` — case and separator insensitive) hides
   * the `<h3>` card title, useful when the host note's `# Heading`
   * already serves as the feature name. Ignored elsewhere.
   */
  view?: string;
  /**
   * Heading level (1–6) for the feature name in reading-mode cards.
   * Defaults to 3 (`<h3>`). Set to match the surrounding document
   * structure — e.g. `heading: 4` under an `### h3` section.
   */
  heading?: number;
  /**
   * Freetext source attribution. When present, the feature is flagged as
   * homebrew and the string is shown in a tooltip badge (e.g.
   * `source: From "Wintercoat's Guide" by Two Dicey Bards`).
   */
  source?: string;
  pick?: number;
  /**
   * Budget-based picking. Mutually exclusive with `pick` — when `buy` is
   * set, the feature's `feature.choice` options carry `cost:` values and
   * the user may select any combination whose total cost ≤ the numeric
   * value of `buy`. Accepts a literal (`buy: 5`) or an expression string
   * (`buy: "5 + PB"`) evaluated against the character's EvalContext at
   * render time so homebrew can parameterise budgets by proficiency /
   * level / ability modifier. Unlike `pick`, the pending choice stays
   * visible so the player can keep spending remaining points.
   */
  buy?: number | string;
  /**
   * When `type === "resource"`: max charges. Scalar or per-level map
   * (`{ 2: 1, 6: 2 }` → 1 charge at Lv 2, 2 at Lv 6, …).
   */
  max?: number | string | Record<number, number>;
  /** When `type === "resource"`: free-form recovery cadence ("short rest", "1/day"). */
  recovery?: string;
  /** Optional reference to another feature (a resource) by name — purely declarative. */
  uses_resource?: string;
  /**
   * Unified resource declarations (the shared lonelog vocabulary, same shape as
   * `feature.gm`'s `resources:`). A PC feature can declare `charges` / `clock` /
   * etc. here so lonelog PC ops (`[Talon/Mystic Mark-1]`) resolve against its
   * bounds/default and feed the delta tracker. Coexists with the legacy
   * `type: resource` + `max`/`recovery` scalar form. Collected via
   * `collectResourceDecls` (see lonelog/dial-ops.ts); wiring the character-sheet
   * feature-resolution path into the session-log registry is still pending.
   */
  resources?: ResourceDecl[];
  /**
   * Aspect sub-objects. Each key, when present, places the feature in that
   * type's bucket on the character-sheet accordion with the aspect's own
   * `text` on the card. A feature can carry multiple aspects (e.g. an
   * `active:` and a `passive:` version of the same ability).
   */
  // …or a list of them — named aspects and `[[links]]` mixed (Martial Action's
  // `bonus: [ [[Weapon Option]], {name: Aim}, {name: Wind Up}, … ]`).
  action?: FeatureAspect | AspectItem[];
  bonus?: FeatureAspect | AspectItem[];
  reaction?: FeatureAspect | AspectItem[];
  active?: FeatureAspect | AspectItem[];
  passive?: FeatureAspect | AspectItem[];
  resource?: FeatureAspect | AspectItem[];
  /**
   * Roll aspect — describes any dice-roll this feature grants (attack,
   * save, rider, healing, or temp-HP). Surfaced by `rpg character.rolls`
   * as a row in the rolls table; NOT routed into the features accordion's
   * aspect buckets (Action / Bonus / …) because rolls have their own
   * renderer and picker.
   */
  roll?: import("./roll").RollAspect;
  /**
   * Spellcasting configuration. Set on a feature to declare a caster
   * (on the Spellcasting feature itself) or to augment one (feature.level
   * blocks adding slots, subclass grants, talents). The shape is the same
   * in all three roles — the resolver aggregates them across a source.
   */
  spellcasting?: SpellcastingFragment;
  /**
   * Override an aspect on a previously-loaded feature. The first present
   * aspect key (`action`, `bonus`, `reaction`, `active`, `passive`,
   * `resource`) names the bucket and its value identifies the aspect by
   * name (e.g. `action: "Preserve Life"` targets the action aspect named
   * "Preserve Life"). All other fields under `update:` are the patch:
   * `text`, `name`, `recharge`, `recovery`, `max`, `resource` get
   * shallow-merged onto the matched aspect, replacing any prior values.
   *
   * Used by progression features that rewrite an earlier ability — e.g.
   * Cleric's Greater Preservation (Lv 11) updates Preserve Life's range
   * from 30 ft. to 60 ft. and adds a condition-cure clause.
   */
  update?: FeatureUpdate;
}

export interface FeatureUpdate {
  /** Aspect-bucket selectors. Set the one whose value names the aspect to
   *  patch (typically just one is set). */
  action?: string;
  bonus?: string;
  reaction?: string;
  active?: string;
  passive?: string;
  resource?: string;
  /** Patch fields applied on top of the matched aspect. */
  name?: string;
  text?: string;
  recharge?: string;
  recovery?: string;
  max?: number | string | Record<number, number>;
}

/**
 * Spellcasting fragment. Three roles share one shape:
 *
 *   1. **Declaration** — set on the feature that establishes a caster
 *      (Cleric's Spellcasting, Druid's Spellcasting, Ranger's
 *      Spellcasting, …). `ability` + `type` + `tier` must be present.
 *   2. **Increment** — set on `feature.level` blocks under the same
 *      parent. Numeric fields are applied additively on top of the
 *      declaration's totals.
 *   3. **Augmentation** — set on subclass / heroic-boon / talent
 *      features that add slots or grants to the primary caster in the
 *      same source (Sage: +2 cantrips +2 rituals; Life Domain Spells:
 *      granted.prepared at caster levels 3/5/7/9).
 *
 * The resolver walks every feature in a source with a `spellcasting:`
 * fragment, folds them together, and emits one `ResolvedCaster` per
 * source that produced a declaration.
 */
export interface SpellcastingFragment {
  // ── Declaration fields ──────────────────────────────────────────────
  /** Ability score used for save DC, attack rolls, and `prepared_max`. */
  ability?: string;
  /** `prepared` means the caster prepares a subset of the full list each
   *  day (Cleric / Druid). `known` means a fixed known pool (Ranger). */
  type?: "prepared" | "known";
  /** Slot-progression tier. `full` gets the full 9-circle table, `half`
   *  the half-caster 5-circle table, `third` the third-caster 4-circle
   *  (Eldritch Knight / Arcane Trickster style). `none` means the source
   *  grants cantrips / rituals without any leveled spell slot progression
   *  (Acolyte heritage, High-Elf-style cantrip grants, …). */
  tier?: "full" | "half" | "third" | "none";
  /** Spell-list source — tag (`#Divine`) or folder (`@compendium/spells/cleric`). */
  pool?: string;
  /** Optional separate pool for cantrip picks when the caster's class
   *  tags cantrips in a different location than its main spell list
   *  (Tales of the Valiant stores cantrips in `worldbuilding/cantrips`
   *  rather than under the Divine / Primordial / Arcane lists). When
   *  unset, the block falls back to `pool`. */
  cantrip_pool?: string;
  /** Pool for ritual picks — typically a folder ref pointing to a
   *  dedicated rituals directory. The character's ritual picker pulls
   *  options from this pool, constrained per-level to circles the
   *  caster has unlocked at that acquisition level. */
  ritual_pool?: string;
  /** Styles of magic the caster is attuned to (Dream, Portal, …).
   *  Picker rows add "flavor exception" options — spells whose own
   *  `style` entry matches any of these, even if the spell itself
   *  falls outside the declared `pool`. Rendered with a distinct
   *  dashed-border button treatment so the player sees at a glance
   *  which picks are stylistic rather than list-regular. */
  style?: string[];
  /** Expression evaluated via substituteExpressions to compute the
   *  per-day prepared budget (e.g. `"WIS_MOD + LV"`). Prepared casters only. */
  prepared_max?: string;

  // ── Counters (additive across every fragment in the source) ─────────
  /** Number of cantrip slots. +1 per level-step is the common pattern. */
  cantrips?: number;
  /** Number of ritual slots (plural to match the plural grant shape). */
  rituals?: number;
  /** Known-spell slots (known-type casters only). */
  known?: number;
  /** Ritual slots that scale with the caster's available spell circles
   *  (Ritualist talent). `1` → one ritual per unlocked circle. */
  rituals_per_circle?: number;

  // ── Grants (always-prepared / always-known lists from features) ─────
  granted?: {
    /** Always-prepared spells keyed by the caster level that unlocks them. */
    prepared?: Record<number, unknown[]>;
    /** Always-known cantrips keyed by caster level. */
    cantrips?: Record<number, unknown[]>;
    /** Always-known rituals keyed by caster level. */
    rituals?: Record<number, unknown[]>;
  };
}

/**
 * The resolver's aggregated view of a single caster.
 *
 * One `ResolvedCaster` is emitted per source that contributed a
 * Spellcasting declaration (so multiclass produces multiple — each with
 * its own slot progression, pool, and grants). Augmentations and level
 * increments from the same source are pre-folded.
 */
export interface ResolvedCaster {
  /** Source that declared the caster (class / subclass doc name). */
  source: string;
  /** Character's level in that source — drives slot row lookup. */
  level: number;
  /** Ability score used for save DC / attack rolls / prepared count.
   *  Empty string means the source declared a caster via a spellcasting
   *  `choose: category: ability` pick that the user hasn't made yet. */
  ability: string;
  /** Prepared vs known, drives the picker UX. */
  type: "prepared" | "known";
  /** Slot progression. `none` = cantrips / rituals only, no leveled table. */
  tier: "full" | "half" | "third" | "none";
  /** Spell-list source (tag or folder) used to expand pickable options. */
  pool?: string;
  /** Resolved cantrip pool (falls back to `pool` when the caster didn't
   *  declare a separate cantrip list). */
  cantrip_pool?: string;
  /** Resolved ritual pool — where the ritual picker sources options. */
  ritual_pool?: string;
  /** Magic styles the caster is attuned to. Picker rows surface
   *  flavor-exception options for spells that share any of these
   *  styles even when outside the `pool`. */
  style: string[];
  /** Raw expression string for `prepared_max` — evaluated at render-time
   *  against the EvalContext so it can see the character's ability
   *  modifiers and level. */
  prepared_max?: string;
  /** Folded cantrip slot count across the source's fragments. */
  cantrips: number;
  /** Folded ritual slot count. */
  rituals: number;
  /** Per-character-level increments contributing to the ritual count.
   *  Keyed by the class level at which each delta is granted (e.g.
   *  Cleric → `{ 1: 1, 3: 1, 5: 1, 7: 1, 9: 1, 11: 1, 13: 1, 15: 1, 17: 1 }`).
   *  The picker uses this to break the ritual choices into per-level
   *  pending rows so each pick is anchored to the level it came from. */
  ritualsByLevel: Record<number, number>;
  /** Folded known-spell slot count (known-type). */
  known: number;
  /** Ritual slots that scale per available spell circle (Ritualist). */
  rituals_per_circle: number;
  /** Always-prepared spells keyed by caster level (merged from every
   *  granting feature in the source). */
  granted: {
    prepared: Record<number, string[]>;
    cantrips: Record<number, string[]>;
    rituals: Record<number, string[]>;
  };
  /**
   * Provenance map for entries in `granted.*` — the source (class,
   * subclass, talent feature name) that granted each spell. Keyed by
   * the spell's bare stem (`Bless`, `Cure Wounds`, …). User picks
   * don't appear here; their enabling source is always `caster.source`.
   */
  grantedBy: Record<string, string>;
}

/**
 * One option for a choice slot, parsed from a `rpg feature.choice` code block.
 * Carries a full feature object — picking it can grant traits and/or
 * additional sub-features.
 */
export interface FeatureChoiceOption {
  parent: string;
  name?: string;
  text?: string;
  traits?: TraitMap;
  type?: string;
  link?: string;
  /**
   * Cost paid from the parent feature's `buy` budget. Only consulted when
   * the parent `feature.details` declares `buy:` — in a plain `pick:`
   * feature the option is always free to select within the slot count.
   */
  cost?: number;
  features?: FeatureDetails[];
  /** Optional reference to a `feature.resource` by name. */
  uses_resource?: string;
  /** Unified resource declarations granted by picking this option (shared
   *  lonelog vocabulary; see {@link FeatureDetails.resources}). */
  resources?: ResourceDecl[];
  /**
   * Inline pick spec that fires as a sub-choice once the parent option is
   * picked. Values picked against this choose contribute to the named trait
   * category on the character sheet (same semantics as `FeatureDetails.choose`).
   */
  choose?: ChooseSpec;
}

/** Non-feature progression marker (e.g. "subclass becomes pickable at level 3"). */
export interface UnlockBlock {
  kind: "subclass";
  level: number;
}

export type SourceDocKind = "class" | "subclass" | "lineage" | "heritage" | "background" | "talent" | "item";

/** All blocks parsed from one compendium document. */
export interface SourceDoc {
  name: string;
  kind: SourceDocKind;
  meta: Record<string, unknown>;
  details: FeatureDetails[];
  options: FeatureChoiceOption[];
  unlocks: UnlockBlock[];
  tables: TableDef[];
  /** GM features parsed from `rpg feature.gm` blocks (a GM Screen file). Empty
   *  for ordinary class/lineage/etc. docs. */
  gmFeatures?: GMFeature[];
  parent_class?: string;
}

// ─── Inputs to the resolver ───────────────────────────────────────────────────

/**
 * Input to the resolver. The features block reads class/lineage/heritage/background
 * from `blocks.header` (HeaderProps) and combines with its own `choices` map.
 *
 * `classes` is an array because the header supports multiclass natively.
 */
export interface CharacterDecl {
  classes: Array<{ name: string; level: number; subclass?: string }>;
  lineage?: string;
  heritage?: string;
  background?: string;
  /** picks[sourceName][featureName] = string | string[] (option name(s)) */
  choices?: Record<string, Record<string, string | string[]>>;
  /**
   * Homebrew / one-off additions layered on top of the standard compendium
   * sources. Each list is references to existing feature.details-bearing
   * vault pages. The resolver loads each referenced doc and spreads its
   * feature.details into the specified source (defaulting to a synthetic
   * Homebrew source when `source` is omitted).
   */
  additional?: {
    talents?: ExtraRef[];
    features?: ExtraRef[];
    boons?: ExtraRef[];
    curses?: ExtraRef[];
  };
}

/** Reference to an extra compendium page. Bare wikilink string is
 *  shorthand; object form carries optional `source` (attributes the
 *  content into a specific ResolvedSource by name) and `level`. */
export type ExtraRef = string | { ref: string; source?: string; level?: number };

export interface CompendiumLib {
  classes: Record<string, SourceDoc>;
  subclasses: Record<string, SourceDoc>;
  lineages: Record<string, SourceDoc>;
  heritages: Record<string, SourceDoc>;
  backgrounds: Record<string, SourceDoc>;
  /**
   * Parsed talent docs keyed by their file basename. Talents aren't
   * top-level sources — they're looked up when a `choose.type: "talent"`
   * pick is resolved, and the talent's feature.details blocks are spread
   * into the picking source's features attributed to the picking detail's
   * level (e.g. Cleric's Talented Growth at Lv. 4).
   */
  talents?: Record<string, SourceDoc>;
  /**
   * Flat lookup: tag name → list of `"[[Item]]"` wikilinks, built at load
   * time from every compendium item's frontmatter `tags:`. Used to expand
   * `"[[Tag]]"` references inside inline `choose.options` arrays — when a
   * wikilink's bare target matches a key here, it expands to the tagged
   * set; otherwise it passes through as a literal.
   */
  tagIndex?: Record<string, string[]>;
  /**
   * Flat lookup: folder path → list of `"[[Item]]"` wikilinks for each item
   * in that folder's direct children. Used to expand `"@folder/path"`
   * references inside inline `choose.options` arrays.
   */
  folderIndex?: Record<string, string[]>;
}

// ─── Outputs of the resolver ──────────────────────────────────────────────────

/** A choice slot ready for the UI: the parent feature plus the matching options. */
export interface PendingChoice {
  source: string;
  feature: FeatureDetails;
  options: FeatureChoiceOption[];
  picked: string[];
  remaining: number;
}

export interface ResolvedSource {
  source: string;
  kind: SourceDocKind;
  level?: number;
  /** Features that apply at the character's level (already filtered). */
  features: FeatureDetails[];
  pendingChoices: PendingChoice[];
  /**
   * Traits contributed by features that don't carry an explicit `level:`
   * (the base rules of a class / lineage / heritage / background / talent).
   * Same shape as `ResolvedView.traits` but scoped to this one source.
   */
  baseTraits: Record<string, string[]>;
  /**
   * Traits contributed by features that DO carry a `level:` annotation,
   * plus all `feature.level` augmentations. For classes these render as a
   * bulleted sub-list beneath the base-rules line on the character sheet.
   */
  leveledTraits: Record<string, string[]>;
  /**
   * Per-level breakdown of every trait contribution this source made at the
   * character's current level. Keys are level numbers (unlevelled features
   * are bucketed at level 1, since that's when the class is taken). Used by
   * the character sheet to render the Cleric/class traits row as one line
   * per class level (skipping empty ones) rather than one long rules line.
   */
  traitsByLevel: Record<number, Record<string, string[]>>;
  /**
   * Set when a detail on this source declared `choose: { type:
   * "spellcasting", category: "ability" }`. The field records the user's
   * pick (CHA / INT / WIS / …) or the empty string when the pick is
   * still pending. Its presence tells `resolveCasters` this source wants
   * its own standalone caster even without an explicit `ability/type/tier`
   * declaration on any `spellcasting:` fragment.
   */
  spellcastingAbilityPick?: string;
}

/**
 * The resolver's top-level output.
 *
 * `traits` aggregates every contributing feature's `traits` map into a single
 * key → values list, ready for the character sheet to render one line per
 * group (`Hit Dice: +8 +CON mod  +1d10`).
 */
export interface ResolvedView {
  sources: ResolvedSource[];
  traits: Record<string, string[]>;
  /** Flat list of every pending choice across sources. */
  pendingChoices: PendingChoice[];
  /**
   * Every table from every loaded source, keyed both by `<source>:<name>`
   * (fully qualified) and by bare `<name>` (latest-wins when multiple sources
   * declare the same name). Ready to hand to the expression evaluator.
   */
  tables: Record<string, TableDef>;
  /**
   * One entry per source that declared a `spellcasting:` fragment at
   * feature-declaration level. Multiclass produces multiple entries
   * (each carries its own slot progression, pool, and grants).
   */
  casters: ResolvedCaster[];
}
