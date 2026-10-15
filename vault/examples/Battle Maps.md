---
cssclasses:
  - note-feature
---
# Battle Maps

A fight in a session log can be **tied to a battle map**. While the fight is on screen, the map follows along and shows the battle *as of the entry you're reading*: where everyone stands, who's acting, how they moved, who they struck, how hurt they are. Under the map, a **timeline** steps through the fight turn by turn, round by round — so a finished battle can be re-read as tactics.

Everything that happens lives in the log, written in lonelog notation. The map itself is a separate, reusable note.

> [!example] Try it
> Scroll the fight at the bottom of this note. With the Log sidebar closed, the map rises faintly behind the prose as the fight begins — hover the chip in the corner to see it clearly. Open the Log and scroll it: the map sticks at the top and closes in on each turn as its entry passes under it. **▶** plays the fight, and the prose and the Log scroll along.

## 1. The map

A map is an `rpg map` block in its own note — this one lives in [[Kobold Ambush]]. It's drawn as text: one character per square, separated by spaces, with a **legend** saying what each character is. Squares are 5 ft.

````markdown
```rpg map
grid: square
title: Kobold Ambush
legend:
  "#": { terrain: cliff, blocks: true }
  "^": { terrain: rocks, cover: half }
  ".": { terrain: grass }
  ",": { terrain: brush, color: "#6b8a4e", cover: half, difficult: true }
tokens:
  Talon: F5
  "[[Kobold, Elite]]": J3
---
# # # # # # # # # # # # #
# ^ ^ . . . . . . ^ ^ ^ #
. , , . . . . . . . , , .
. , . . . ^ . . . . , . .
. . . . . . . . . . . . .
```
````

- **Squares are named like a chessboard** — columns **A, B, C…** left to right, rows **1, 2, 3…** top to bottom: `C4`. The map labels both edges.
- **Legend** entries name a `terrain` (grass, rocks, water, cliff, forest, stone, floor, wall, mud, sand, road, lava, ice have built-in colours) or give their own `color`. They can also carry rules the map marks: `cover` (a dot in the corner), `difficult` (a slash), `blocks` (shaded darker). Nothing is enforced — they're reminders.
- **`tokens:`** are default starting spots, by the name each combatant is written with. A fight can use them or place everyone itself.

A map can be drawn without spaces too (`#..^..#`), one character per square.

### A picture as the board

A map can also be a **picture** — art from a map maker or a virtual tabletop, with its own grid. Say how big its squares are and where its grid starts; the map counts the squares from the picture and labels them the same way. The fight below plays on [[Kowyn Encounter]]:

````markdown
```rpg map
grid: square
title: Kowyn Encounter
image: "[[01s02-encounter-with-kowyn-clean.png]]"
cell: 33          # pixels per square in the picture
offset: -1, -1    # where its first grid line falls (x, y)
tokens:
  Talon: J14
  "[[Kobold, Elite]]": N5
---
```
````

- `size: 25x22` fixes the number of columns × rows; without it, the picture decides.
- Use a picture **without tokens painted on** — the map draws its own, and they move.
- A drawn grid below the `---` is optional: there it only marks rules (cover, difficult ground) on top of the picture — no paint.

## 2. Tying a fight to a map

Name the map on the combat marker:

```
[COMBAT: [[Kobold Ambush]]]
```

### Or keep the map in the log

A map used once doesn't need a note of its own: declare it in the log's header, under `maps:`, with the same keys — and name it plainly on the marker (a `[[link]]` always means a note):

````markdown
```rpg log
state_key: ambush
maps:
  Clearing:
    image: "[[01s02-encounter-with-kowyn-clean.png]]"
    cell: 33
    offset: -1, -1
---
[COMBAT: Clearing]
```
````

A drawn map works too — its grid goes in `cells: |`, since the header ends at the `---`.

A session can hold several fights, each on its own map. The **Start Combat** card (GM → Combat) writes this for you. Its *Battle map* lists the maps this log keeps, the vault's map notes, and **New map from a picture…**: search for a picture, and the card finds its grid (square size and offset — adjust if it's off), names the map, and adds it to the log's `maps:` header as the fight starts. Once a map is chosen, the initiative table gains a *Square* column — pre-filled from the map's default spots — and each square is written into the `[Init:]` line (`Talon d20+[[Initiative]]=14 @J14`).

## 3. Writing the fight

All of it is lonelog tags, so the log reads fine without the plugin.

| You write | It means |
| --- | --- |
| `[Init: Talon 14 @F5; Lilith 9 @G6; [[Kobold, Elite]] 12 @J3]` | Where everyone starts: `@square` after each initiative entry, in the order rolled |
| `[Init: …; Fat [[Kobold, A]] 9 @F7 🐸]` | That token's emoji for this fight — over the `token:` its page sets |
| `[Pos: Lilith G7; Talon F5]` | Place (or re-place) combatants later in the fight |
| `@(Talon) [Mv: E3] Shortsword → Kobold, Elite` | The actor moves **before** the action — a straight line to `E3`, then the strike |
| `@(Talon) Shortsword → Kobold, Elite [Mv: J14]` | The actor moves **after** it — the strike, then back to `J14` |
| `@(Kobold, Elite) [Mv: I4>H5] Closes in` | The actor's route, square by square |
| `=> She is shoved back. [Mv: Lilith G7]` | Someone other than the actor moves (as the outcome) |
| `@(Talon) Shortsword → Kobold, Elite` | An attack — drawn as a line to the target (attack cards write this) |
| `[F:[[Kobold, Elite]]\|HP-8]` | A foe takes damage — its HP ring shrinks |
| `[PC:Lilith\|+prone]` / `[PC:Lilith\|-prone]` | A condition given / lifted — a badge on the token |
| `[F:Thin [[Kobold, A]]\|fled]` | Out of the fight (also `dead`, `defeated`, `unconscious`, `surrendered`) — the token fades |
| `T1`, `T2` | Turns — a pass through the initiative order; the timeline groups the rounds under them (Lonelog's `R1` reads the same) |
| `R(Talon)` | Whose round it is in the turn — the map rings them before they act |

A move written on the action line stays out of the prose; in the Log sidebar it shows as a **Move → E3** pill when it comes before the action, **Then → J14** when after. On the map, a move before is a blue dashed path that ends where the strike starts; a move after is a green dotted one leaving from there.

You rarely type moves by hand: **during a fight**, every party member's and foe's card asks for an optional **Move before** and **Move after** as it plays — it says where they stand now (`Now at J14`), takes a square or a route (`K12>L10`), and writes it on the action line, ahead of the action or after it. Outside a fight there's nothing to move, so the cards don't ask.

The GM's **Combat** stack keeps the fight moving. A **turn** is one pass through the initiative order, and each creature's slot in it is their **round**: **Next Turn** starts the next pass (`T2`), and **Next Round** writes whose round it is (`R(Talon)`) — the next in initiative already picked, skipping foes who are down. Neither asks for anything else or writes an outcome; both appear only while a fight is open.

Tokens show an **emoji** when the creature's page sets one — `token: "🏹"` in the frontmatter of a character page or a statblock — large, with their initials small below; without one, just the initials. An emoji after an initiative entry (`Fat [[Kobold, A]] 9 @F7 🐸`) overrides it for that fight, to tell apart creatures sharing a statblock.

## 4. The map pane and the timeline

- **Log sidebar closed** — the map sits **behind the prose**, faded so the text stays readable, and only while you're reading the fight (it fades out before and after). A small chip in the top corner names the turn and the actor and holds the replay buttons; **hover the chip** and the map comes up full.
- **Log sidebar open** — the fight's entries are grouped under their map, which appears **where the fight starts** and then **sticks to the top of the Log** while you scroll through them, letting go where the fight ends. The entry just under the map is the turn shown, and the map **zooms in on it**: the creature acting, its path, its target — as close as the action allows, with the squares' letters and numbers along the edges.
- It shows the frame for the entry you're reading. The acting creature has a **gold ring**; its move is a **dashed blue path**, its attack a **red line**. Foes show an **HP ring**; a yellow dot on any token — PC or foe — means a **condition** (hover a token for its name, square, HP and conditions).
- The **timeline**: `⏮ ‹ ▶ › ⏭` — first, previous, play, next, last; under it, each turn lists a dot per entry — click one to jump there. The prose scrolls with it.
- An entry with nothing narrated (no `=>` line) has no prose to scroll to — reach it from the timeline.
- **Setting up from the map.** The timeline opens on **Setup** — everyone where the fight starts (⏮ goes back to it). There, with the Log open, click a token to change it: **Move start** (then click a square) writes its `@square` in the `[Init:]` line, **Roll initiative** rolls d20 + its Initiative and writes the roll in, and **Emoji** sets its emoji for this fight. While anyone still lacks a roll, a **Roll initiative for N** button rolls them all. Once the turns start, the map is read-only — what happened is the log's.

## 5. The fight

The opening of the kobold ambush on Wisdom's Path, played on the picture map [[Kowyn Encounter]] — three rounds.

```rpg log
state_key: battle-map-example
---
? Combat begins with no one surprised. [F:[[Kobold, Tinkerer]]|HP 25] [F:[[Kobold, Elite]]|HP 26] [F:Fat [[Kobold, A]]|HP 9] [F:Thin [[Kobold, A]]|HP 9]
=> Movement rustled through the brush, and suddenly, we were surrounded. Faces twisted with hate. Crude weapons. Ragged armor.
[Init: [[Kobold, Tinkerer]] 22 @H5; [[Kobold, Elite]] 20 @N5; Thin [[Kobold, A]] 18 @R8; Talon 14 @J14; Fat [[Kobold, A]] 9 @F7; Kowyn 8 @L11; Jacqui 7 @M15; Lilith 2 @O14]
[COMBAT: [[Kowyn Encounter]]]
T1
@(Kobold, Tinkerer) [Mv: H7] Parts-Filled Sling → Kowyn
d: Attack | d20+4=17
d: Damage | 1d4+2=5
=> A clatter of bolts and gears from the brush caught Kowyn in the shoulder.
@(Kobold, Elite) [Mv: N8>M10] Mining Pick → Kowyn
d: Attack | d20+5=9
=> The elite bounded down from the rocks and swung — the pick bit the turf beside Kowyn.
@(Thin Kobold, A) [Mv: R11>P13] Dagger → Lilith
d: Attack | d20+4=16
d: Piercing damage | 1d4+2=4
=> The thin one darted in low and opened a cut along Lilith's arm.
@(Talon) [Mv: K12>K11>L10] Shortsword → Kobold, Elite
d: Attack | d20+6=19
d: Piercing damage | 1d6+4=8
=> I stepped into the elite's reach and found the gap in its leather. [F:[[Kobold, Elite]]|HP-8]
@(Fat Kobold, A) [Mv: F9] Sling → Jacqui
d: Attack | d20+4=6
=> The fat one's stone sailed wide of Jacqui.
@(Kowyn) Dodge
=> Kowyn tucked himself behind my legs, clutching his shoulder.
@(Jacqui) [Mv: L13>I11>G10] Longsword → Fat Kobold, A
d: Attack | d20+5=18
d: Slashing damage | 1d8+3=9
=> Jacqui closed the distance in three strides and cut it down. [F:Fat [[Kobold, A]]|HP-9]
@(Lilith) Rapier → Thin Kobold, A
d: Attack | d20+5=15
d: Piercing damage | 1d8+3=6
=> Lilith answered the cut with one of her own. [F:Thin [[Kobold, A]]|HP-6]
T2
@(Kobold, Tinkerer) [Mv: G4] Scurry
=> The tinkerer scrambled back up into the rocks, rattling with spare parts.
@(Kobold, Elite) Lantern Splash → Lilith
d: DEX save | d20+3=8 vs DC 13 -> Failure
d: Fire damage | 4d6=11
=> Burning oil splashed across Lilith; she threw herself down to smother it. [PC:Lilith|+prone]
@(Thin Kobold, A) [Mv: R12>T15] Flees
=> Bleeding, the thin one broke and ran for the brush. [F:Thin [[Kobold, A]]|fled]
@(Talon) Shortsword → Kobold, Elite
d: Attack | d20+6=21
d: Piercing damage | 1d6+4=9
=> I drove it back a step with a second cut. [F:[[Kobold, Elite]]|HP-9]
@(Kowyn) Help, pointing Jacqui to the rocks
=> Kowyn shouted where the tinkerer had gone.
@(Jacqui) [Mv: G8>G6] Dash toward the rocks
=> Jacqui ran for the rocks after the tinkerer.
@(Lilith) [Mv: N12>N11] Rapier → Kobold, Elite
d: Attack | d20+5=17
d: Piercing damage | 1d8+3=10
=> Lilith rose from the smoke and ran it through. [PC:Lilith|-prone] [F:[[Kobold, Elite]]|HP-10]
T3
@(Kobold, Tinkerer) Throws down its hammer
=> Cornered, the tinkerer threw down its hammer and begged for its life. [F:[[Kobold, Tinkerer]]|surrendered]
[/COMBAT]
```
