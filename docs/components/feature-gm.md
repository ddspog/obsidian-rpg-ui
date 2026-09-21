# GM Features

The `rpg feature.gm` block declares a **Game Master feature** — an oracle, roll, table, generator, world-event, or scene move. GM features live in a **GM Screen file** (a source file like a class or lineage doc) and surface as clickable **cards** on the GM side of the session log. Using a card appends the corresponding lonelog machinery to the log.

A GM feature is the GM-side analog of a character feature: nested aspect sub-objects, each mapping to a lonelog prefix.

| Aspect      | Emits  | Lonelog                     |
| ----------- | ------ | --------------------------- |
| `oracle`    | `?`    | a yes/no or open question   |
| `roll`      | `d:`   | a dice check                |
| `table`     | `tbl:` | a roll on a named table     |
| `generator` | `gen:` | a generator + working line  |
| `event`     | `!`    | a world event               |
| `scene`     | `=>`   | a scene-opening consequence |

Dice are emitted **unrolled** (`d10=`) and free-text slots stay as `{{placeholders}}` — you fill them in the log via the session-log's inline editing. The card's **stack** defaults to its first declared aspect (override with `stack:`); multiple aspects chain (in the order above) into one multi-line block.

## Scene Check (oracle + generator + scene)

A Mythic-style scene check: ask whether the expected scene happens, roll against the Chaos Factor, and open the resulting scene.

````yaml
```rpg feature.gm
name: Scene Check
oracle:
  question: "Does {{scene}} occur?"
  chaos: true
generator:
  name: Testing the Expected Scene
  roll: d10
  vs: CF
  work: Alterations
  interpret:
    ">CF":        Expected Scene
    "<=CF, odd":  Altered Scene
    "<=CF, even": Interrupt Scene
scene:
  opens: "S{{n}} {{title}}"
---
Test whether the expected scene plays out as you imagined.
```
````

Emits (with the Chaos Factor as a `{{cf}}` slot until session CF state exists):

```
? [CF:{{cf}}] Does {{scene}} occur?
gen: Testing the Expected Scene
  Alterations: d10= vs CF {{cf}} ->
=> S{{n}} {{title}}
```

## Fate Question (oracle with likelihood)

A yes/no fate question whose odds derive from the Chaos Factor via a Mythic-style Fate Chart.

````yaml
```rpg feature.gm
name: Fate Question
oracle:
  question: "Is the door locked?"
  chaos: true
  likelihood: likely
  roll: d100
```
````

Emits:

```
? [CF:{{cf}}] Is the door locked?
-> (d100=)
```

Once you enter the `d100`, the `likelihood` × Chaos Factor resolves the answer (Yes / No, with exceptional `Yes, and…` / `No, and…` edges).

### Odds declared vs odds asked

`likelihood` on the aspect fixes the odds for every question the feature emits. That
suits a feature that always asks at the same odds, but it cannot express Mythic's
Fate Chart, where **judging the odds is part of asking** — which is why the vault's
Fate Chart feature declares none.

For that, an `o:` line consults the oracle per question — the oracle sibling of
`tbl:` and `gen:`, naming its source the same way they do:

```
? [CF:5] Is the gate still guarded?
o: Fate Chart (likely) d100=22 -> Yes
```

A **bare name**, because that is how a log line names a feature; `@[[…]]` stays in
the YAML that declares one. Both routes end in the same resolver, so a question
resolves identically whether its odds were declared on the feature or judged on the
line.

## Other aspects

````yaml
```rpg feature.gm
name: Stealth Check
roll: { name: Stealth, die: d20+5, vs: "DC 15" }
```

```rpg feature.gm
name: Weather
table: { source: "@[[Tables/Weather]]", die: d6 }
```

```rpg feature.gm
name: Random Event
event:
  focus: "@[[Oracles/Event Focus]]"
  meaning: ["@[[Oracles/Action]]", "@[[Oracles/Subject]]"]
  text: "{{event}}"
```
````

## Configuration

| Property   | Type   | Description                                                                             |
| ---------- | ------ | --------------------------------------------------------------------------------------- |
| `name`     | String | **Required** — feature name; the card label                                             |
| `text`     | String | Card description (markdown). Body after a `---` separator folds in here                 |
| `stack`    | String | Override the card stack (`oracle` / `roll` / `table` / `generator` / `event` / `scene`) |
| `uses`     | Number | Optional limited uses (reuses the consumable mechanics)                                 |
| `recovery` | String | Recovery cadence for `uses` (e.g. `1/session`)                                          |
| `source`   | String | Homebrew attribution badge                                                              |

### `oracle`

| Property      | Type    | Description                                                           |
| ------------- | ------- | --------------------------------------------------------------------- |
| `question`    | String  | **Required** — the question. Supports `{{placeholders}}`              |
| `attribution` | String  | Attribution → `?(Name)`                                               |
| `chaos`       | Boolean | Emit `[CF:n]` from the session chaos factor (a `{{cf}}` slot for now) |
| `cf`          | Number  | Constant chaos factor — bakes a literal `[CF:n]`                      |
| `likelihood`  | String  | Fate Chart band (`certain` … `50/50` … `impossible`)                  |
| `roll`        | String  | Die for the answer (e.g. `d100`). Emitted unrolled                    |
| `vs`          | String  | Contest target. `CF` expands to `CF <n>`                              |
| `interpret`   | Map     | Comparison-expression → worded outcome (see below)                    |

### `roll`

| Property    | Type   | Description                              |
| ----------- | ------ | ---------------------------------------- |
| `die`       | String | **Required** — dice expression (`d20+5`) |
| `name`      | String | Check name → `d(Name):`                  |
| `vs`        | String | Contest target (`DC 15`, `CF`)           |
| `interpret` | Map    | Comparison-expression → worded outcome   |

### `table`

| Property | Type   | Description                                        |
| -------- | ------ | -------------------------------------------------- |
| `source` | String | **Required** — an `@[[…]]` call or bare table name |
| `die`    | String | Die override; defaults to the table's own die      |

### `generator`

| Property    | Type   | Description                                        |
| ----------- | ------ | -------------------------------------------------- |
| `name`      | String | **Required** — generator label → `gen: <name>`     |
| `roll`      | String | Optional roll for the indented working line        |
| `vs`        | String | Contest target for the working line (`CF` expands) |
| `work`      | String | Label of the working line (e.g. `Alterations`)     |
| `interpret` | Map    | Comparison-expression → worded outcome             |

### `event`

| Property  | Type   | Description                                                   |
| --------- | ------ | ------------------------------------------------------------- |
| `text`    | String | World-event text → `! <text>`. Defaults to a `{{event}}` slot |
| `focus`   | String | Event-focus oracle reference → a leading `gen:` line          |
| `meaning` | Array  | Meaning-table references → leading `gen:` lines               |

### `scene`

| Property      | Type   | Description                                 |
| ------------- | ------ | ------------------------------------------- |
| `opens`       | String | Opens a numbered scene → `=> S## <title>`   |
| `consequence` | String | Plain (non-scene) consequence → `=> <text>` |

### Interpret expressions

`interpret` maps a comparison-expression **key** to the worded outcome written after `->`. Keys are evaluated in authored order; the first match wins.

| Key form           | Matches when…                            |
| ------------------ | ---------------------------------------- |
| `>CF` `<=CF`       | roll compared to the chaos factor        |
| `>18` `<=15` `=20` | roll compared to a literal number        |
| `4-15`             | roll within an inclusive range           |
| `even` `odd`       | roll parity                              |
| `<=CF, odd`        | comma-joined clauses — **all** must hold |
