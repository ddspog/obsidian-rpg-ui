# Hotbar icon prompts

Icons for the session log's hotbar tiles, in the style of Baldur's Gate 3's ability icons.

## Where they go

Save each image as **`<card name>.webp`** (or `.png`) in any vault folder named **`Icons`** — e.g. `z50. Reference/Icons/Longbow.webp`.
The hotbar matches by card name, ignoring case and the source marks (`ᴷ`, `º`, `ᴰ`…), and draws the image instead of the outlined glyph.
New icons show on the log's next render. Square, **256×256** or larger.

## Shared style (prepend to every prompt)

```
Fantasy RPG ability icon in the style of Baldur's Gate 3. Square 1:1, painterly, single bold central emblem,
dramatic rim lighting, dark textured vignette background tinted {COLOR}, subtle ornate engraved edge,
high-contrast silhouette readable at 48 pixels, no text, no letters, no frame, no border, no UI.
```

`{COLOR}` follows the tile's type, so a bar reads at a glance:

| Type | Colour |
|---|---|
| Attack | crimson-red |
| Action | amber-gold |
| Bonus action | burnt orange |
| Reaction | teal |
| Spell | arcane blue |
| Passive | emerald green |
| Game Master | violet |
| Party | warm gold |
| Other | ashen grey |

## Prompts

Each line: the shared style with its colour, then **Subject:** the line below.

### Attack — crimson-red

- **Dagger** (Fat Kobold, A, Thin Kobold, A) — Subject: a simple steel dagger.
- **Glaive** (Item · Lilith) — Subject: a long glaive with a curved blade on a polearm.
- **Lantern Splash (Recharge 5-6)** (Kobold, Elite) — Subject: a shattering oil lantern splashing fire.
- **Longbow** (Item · Talon Pallton) — Subject: a tall longbow fully drawn with an arrow nocked.
- **Mining Pick** (Kobold, Elite) — Subject: a rusty mining pick.
- **Parts-Filled Sling** (Kobold, Tinkerer) — Subject: a sling loaded with nuts, bolts and gears.
- **Quarterstaff** (Item · Kowyn) — Subject: a carved wooden quarterstaff wrapped with leather.
- **Sling** (Fat Kobold, A, Kobold, Elite, Thin Kobold, A) — Subject: a leather sling whirling a stone.
- **Small but Fierce** (Kobold, Elite) — Subject: a tiny kobold leaping with a mighty swing.
- **Tinkerer's Hammer** (Kobold, Tinkerer) — Subject: a small tinkerer's hammer with gears.
- **Two-Handed** (Item · Jacqui Ilitul) — Subject: a great two-handed hammer held overhead by gauntleted hands.
- **Warhammer** (Item · Jacqui Ilitul) — Subject: a heavy war hammer with a square steel head.

### Action — amber-gold

- **Dash** (Basic action · Fat Kobold, A, Jacqui Ilitul, Kobold, Elite, Kobold, Tinkerer, Kowyn, Lilith, Talon Pallton, Thin Kobold, A) — Subject: a running boot trailing streaks of wind.
- **Disengage** (Basic action · Fat Kobold, A, Jacqui Ilitul, Kobold, Elite, Kobold, Tinkerer, Kowyn, Lilith, Talon Pallton, Thin Kobold, A) — Subject: a figure stepping back out of a circle of blades.
- **Dodge** (Basic action · Fat Kobold, A, Jacqui Ilitul, Kobold, Elite, Kobold, Tinkerer, Kowyn, Lilith, Talon Pallton, Thin Kobold, A) — Subject: a blurred figure sidestepping a passing blade.
- **Druidic** (Class · Kowyn) — Subject: hidden druidic runes carved into bark with a leaf.
- **Field Medic** (Background · Jacqui Ilitul) — Subject: a bandaged arm with a needle and thread and a herb pouch.
- **Hide** (Basic action · Fat Kobold, A, Jacqui Ilitul, Kobold, Elite, Kobold, Tinkerer, Kowyn, Lilith, Talon Pallton, Thin Kobold, A) — Subject: a cloaked figure fading into shadow behind a barrel.
- **Improvise** (Basic action · Fat Kobold, A, Jacqui Ilitul, Kobold, Elite, Kobold, Tinkerer, Kowyn, Lilith, Talon Pallton, Thin Kobold, A) — Subject: a feather quill twirling over scattered objects, a spark of inspiration.
- **Influence** (Basic action · Fat Kobold, A, Jacqui Ilitul, Kobold, Elite, Kobold, Tinkerer, Kowyn, Lilith, Talon Pallton, Thin Kobold, A) — Subject: an open hand with a golden thread leading to a speaking mouth.
- **Makeshift Ally (1/Day)** (Kobold, Tinkerer) — Subject: a clockwork construct cobbled from scrap.
- **Multiattack** (Kobold, Tinkerer) — Subject: three overlapping slashes in quick succession.
- **Noxious Apothecary** (Background · Talon Pallton) — Subject: bubbling alchemical flasks with toxic green fumes.
- **Ready** (Basic action · Fat Kobold, A, Jacqui Ilitul, Kobold, Elite, Kobold, Tinkerer, Kowyn, Lilith, Talon Pallton, Thin Kobold, A) — Subject: a drawn bow held steady with an hourglass beside it.
- **Search** (Basic action · Fat Kobold, A, Jacqui Ilitul, Kobold, Elite, Kobold, Tinkerer, Kowyn, Lilith, Talon Pallton, Thin Kobold, A) — Subject: a magnifying glass over footprints in dust.
- **Study** (Basic action · Fat Kobold, A, Jacqui Ilitul, Kobold, Elite, Kobold, Tinkerer, Kowyn, Lilith, Talon Pallton, Thin Kobold, A) — Subject: an open tome with glowing marginalia and an eye symbol.
- **Use an Object** (Basic action · Fat Kobold, A, Jacqui Ilitul, Kobold, Elite, Kobold, Tinkerer, Kowyn, Lilith, Talon Pallton, Thin Kobold, A) — Subject: a gloved hand turning a brass key in a lock.
- **Vanguard** (Background · Lilith) — Subject: a raised shield and spear braced against a charge.

### Bonus action — burnt orange

- **Aim** (Class · Lilith) — Subject: an eye aligned with an arrowhead through a sight.
- **Dreadful Guise** (Lineage · Lilith) — Subject: a terrifying otherworldly mask with glowing eyes.
- **Guard** (Class · Lilith) — Subject: a raised shield catching a blow, sparks flying.
- **Help** (Basic action · Fat Kobold, A, Jacqui Ilitul, Kobold, Elite, Kobold, Tinkerer, Kowyn, Lilith, Talon Pallton, Thin Kobold, A) — Subject: one hand reaching down to pull another up.
- **Nature's Gift** (Kowyn) — Subject: a handful of glowing healing herbs tossed through the air.
- **Pack** (Lineage · Kowyn) — Subject: three wolf silhouettes running together.
- **Quick Strike** (Class · Lilith) — Subject: a light dagger striking twice in a blur.
- **Scurry** (Fat Kobold, A, Kobold, Tinkerer, Thin Kobold, A) — Subject: a small kobold scurrying low with dust behind.
- **Two-Weapon Fighting** (Basic action · Fat Kobold, A, Jacqui Ilitul, Kobold, Elite, Kobold, Tinkerer, Kowyn, Lilith, Talon Pallton, Thin Kobold, A) — Subject: two short swords crossed, one in each hand.
- **Weapon Option** (Class · Lilith) — Subject: a blade with three branching technique glyphs.
- **Wind Up** (Class · Lilith) — Subject: a hammer drawn far back, coiled with energy.

### Reaction — teal

- **Falling Wings** (Heritage · Kowyn) — Subject: spectral feathered wings slowing a falling figure.
- **Last Stand** (Lilith) — Subject: a battered warrior rising with a defiant red aura.
- **Opportunity Attack** (Basic action · Fat Kobold, A, Jacqui Ilitul, Kobold, Elite, Kobold, Tinkerer, Kowyn, Lilith, Talon Pallton, Thin Kobold, A) — Subject: a blade lashing out at a passing silhouette.

### Spell — arcane blue

- **Arcane Mark** (Spell · Jacqui Ilitul) — Subject: a glowing personal sigil etched on stone.
- **Blood Print** (Spell · Kowyn) — Subject: a drop of blood forming a unique sigil pattern.
- **Clue** (Spell · Jacqui Ilitul) — Subject: glowing footprints and a fingerprint revealed by light.
- **Create Bonfire** (Spell · Kowyn) — Subject: a magical bonfire erupting from the ground.
- **Cure Wounds** (Spell · Jacqui Ilitul) — Subject: a glowing hand closing a wound with green-gold light.
- **Detect Poison and Disease** (Spell · Kowyn) — Subject: a glowing eye over a vial with green fumes.
- **Douse Light** (Spell · Talon Pallton) — Subject: a candle flame being pinched out, a curl of smoke.
- **Entangle** (Spell · Kowyn) — Subject: thorny vines erupting from the ground and grasping.
- **Guidance** (Spell · Jacqui Ilitul) — Subject: a small star of light guiding a hand toward a die.
- **Icicle Javelin** (Spell · Kowyn) — Subject: a long javelin of jagged ice in flight, frost trailing.
- **Last Strike** (Spell · Jacqui Ilitul) — Subject: a fallen warrior's hand thrusting a blade upward, a dim red glow.
- **Luminous Bolt** (Spell · Jacqui Ilitul) — Subject: a bolt of radiant white-gold light streaking forward.
- **Lunarbolt Waxing** (Spell · Jacqui Ilitul) — Subject: a crescent-moon-shaped bolt of icy silver light.
- **Magnetobolt** (Spell · Kowyn) — Subject: a crackling bolt of force pulled between two magnetic lodestones.
- **Message** (Spell · Jacqui Ilitul) — Subject: a whispering mouth with a faint glowing thread to a distant ear.
- **Sanctuary** (Spell · Jacqui Ilitul) — Subject: a translucent dome of light over a kneeling figure.
- **Shape Water** (Spell · Kowyn) — Subject: a sphere of water twisting into a spiral, half-frozen.
- **Speak with Animals** (Spell · Kowyn) — Subject: a druid's ear beside a fox and a crow, speech wisps between them.
- **Thunderwave** (Spell · Kowyn) — Subject: a ring of thunder bursting outward from an open palm.
- **Toxic Plume** (Spell · Kowyn) — Subject: a billowing green poison cloud with a skull-shaped wisp.

### Passive — emerald green

- **Arcane Tricks** (Heritage · Talon Pallton) — Subject: a hand conjuring a small floating spark of magic.
- **Augmented** (Heritage · Kowyn) — Subject: a forearm with arcane implants and glowing seams.
- **Comrade** (Lineage · Jacqui Ilitul) — Subject: two shields overlapping, protecting each other.
- **Explorer** (Class · Talon Pallton) — Subject: a compass rose over mountains and a forest.
- **Guardian Bubble** (Heritage · Kowyn) — Subject: a shimmering bubble of air around a head.
- **Heightened Senses** (Lineage · Talon Pallton) — Subject: a pointed elven ear and an eye with radiating lines.
- **Heraldic Studies** (Heritage · Jacqui Ilitul) — Subject: a heraldic crest on a scroll with a magnifying glass.
- **Magic Ancestry** (Lineage · Talon Pallton) — Subject: a silver leaf with a protective rune.
- **Might** (Class · Jacqui Ilitul) — Subject: a clenched fist striking with a shockwave.
- **Observant Insight** (Heritage · Talon Pallton) — Subject: an eye reading the subtle expression of a face.
- **Otherworldly Form** (Lineage · Lilith) — Subject: an ethereal silhouette needing no breath, stars within.
- **Ritualist** (Background · Kowyn) — Subject: a ritual book open on a circle of candles.
- **Street Smarts** (Heritage · Lilith) — Subject: a city alley with a coin purse and a knowing eye.
- **Tinker's Fascination** (Lineage · Kowyn) — Subject: a tiny gear mechanism with tools around it.
- **Trance** (Lineage · Talon Pallton) — Subject: a meditating elf with closed eyes and a soft aura.
- **Worldly Wisdom** (Heritage · Lilith) — Subject: an old map with a magnifying glass over a strange relic.

### Other — ashen grey

- **Blinded** (Kobold, Elite) — Subject: eyes covered by a burst of blinding light.
- **Pinned** (Kobold, Tinkerer) — Subject: a creature's foot pinned to the ground by an icicle.
- **Prone** (Kobold, Elite) — Subject: a figure knocked flat on the ground.

### Game Master — violet

- **Discover Meaning** (Game Master) — Subject: two runic word-tiles drawn from a cloth bag, sparks between them.
- **End Scene** (Game Master) — Subject: a theatre curtain falling closed, a candle snuffed beside it.
- **Fate Question** (Game Master) — Subject: a glowing crystal orb with a faint question-mark of mist inside, two d10 dice beside it.
- **First Scene** (Game Master) — Subject: a quill writing the first line in an empty journal, dawn light.
- **NPC Behavior** (Game Master) — Subject: a hooded figure's silhouette with three branching arrows above its head.
- **New Scene** (Game Master) — Subject: a theatre curtain parting onto a misty road.
- **Roll an Elements Table** (Game Master) — Subject: an open grimoire page with elemental sigils, a die resting on it.
- **Roll on Characters** (Game Master) — Subject: a fan of small portrait cameos, one lifted out.
- **Roll on Threads** (Game Master) — Subject: a spool of red thread unwinding into a knotted path.
- **Start Combat** (Game Master) — Subject: two crossed swords clashing with a burst of sparks.
- **Trigger a Random Event** (Game Master) — Subject: a lightning bolt striking a cracked hourglass.

### Party — warm gold

- **End of Session** (Party) — Subject: a closed leather journal tied with a ribbon, a quill laid on top.
- **Group Check** (Party) — Subject: four hands clasped together in a circle.
- **Long Rest** (Party) — Subject: a crescent moon over a tent and a dying campfire.
- **Loot** (Party) — Subject: an open treasure sack spilling coins, a gem and a dagger.
- **Luck** (Party) — Subject: a four-leaf clover glinting with gold light.
- **Shop** (Party) — Subject: a merchant's scale balancing coins against a potion.
- **Short Rest** (Party) — Subject: a small campfire with a bedroll and a waterskin.
- **Travel** (Party) — Subject: a brass compass over a winding mountain road.
- **Weather** (Party) — Subject: a sun half-hidden by a swirling cloud with falling rain.

## Example (full prompt)

```
Fantasy RPG ability icon in the style of Baldur's Gate 3. Square 1:1, painterly, single bold central emblem,
dramatic rim lighting, dark textured vignette background tinted crimson-red, subtle ornate engraved edge,
high-contrast silhouette readable at 48 pixels, no text, no letters, no frame, no border, no UI.
Subject: a tall longbow fully drawn with an arrow nocked.
```
