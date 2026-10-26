/**
 * The kinds of image the vault's notes carry — catalogued from what's there —
 * and, for each, a prompt that makes one in its style from the note's own
 * fields:
 *
 *   item       an item's reference art: one object, painterly, a cut-out on
 *              transparency, cropped close (`item.element|magic|container` image)
 *   spell      a spell's picture: the casting, full-bleed art alone — the card
 *              frame is the plugin's (`spell` image)
 *   portrait   a character's picture, full-bleed art alone, framed by the plugin
 *              (`character.*` portrait, an NPC's `reference_img`)
 *   creature   a creature or vessel on a patch of its ground, a cut-out
 *              (`stat.monster|vehicle` image)
 *   art        a character's full-length picture, full-bleed art alone like their
 *              portrait, framed by the plugin (`character.description` art)
 *   banner     a chapter's wide opening scene (frontmatter `banner`)
 *   map        a top-down battle map (`map` / `log` image)
 *   token      a battle map token: a bust filling the square, drawn in a disc
 *              (frontmatter `token_image`, on a PC's sheet or a foe's statblock)
 *   icon       a hotbar icon, Baldur's Gate 3's (an image in `Icons/`)
 *
 * A cut-out is made on flat magenta and keyed out after — the image models
 * don't paint transparency themselves.
 */

import type { ImageTarget } from "./targets";

export type ImageKindId = "item" | "spell" | "portrait" | "creature" | "art" | "banner" | "map" | "token" | "icon";

export interface ImageKind {
  id: ImageKindId;
  label: string;
  aspect: "1:1" | "3:4" | "4:3" | "9:16" | "16:9";
  /** Transparent where the magenta was, all around it; none: the picture fills its canvas. */
  cutout: "full" | "frame" | false;
  /** The block draws this picture in the card frame (`framed: true` is written beside it). */
  framed?: boolean;
  /** Cropped close to what's painted (item art is). */
  trim: boolean;
  /**
   * A fixed layout (a card, a banner, an icon): the picture comes out exactly
   * this size — or the size of the one it replaces — in these proportions.
   */
  size?: { w: number; h: number };
  /** Otherwise (a cut-out keeps its own proportions): its long side this many pixels, or the replaced picture's. */
  maxSize?: number;
  /** A tile that must fill the square: a margin around it (and its rounded corners) cut off. */
  fill?: boolean;
}

export const IMAGE_KINDS: Record<ImageKindId, ImageKind> = {
  item: { id: "item", label: "Item reference", aspect: "1:1", cutout: "full", trim: true, maxSize: 1024 },
  // A card's picture is the art alone (the vault's cards are 1.705:1): set to that shape, and drawn in
  // the card frame by the block (`framed: true` beside it).
  spell: {
    id: "spell",
    label: "Spell picture (framed)",
    aspect: "16:9",
    cutout: false,
    framed: true,
    trim: false,
    size: { w: 1600, h: 938 },
  },
  portrait: {
    id: "portrait",
    label: "Portrait picture (framed)",
    aspect: "3:4",
    cutout: false,
    framed: true,
    trim: false,
    size: { w: 1200, h: 1600 },
  },
  creature: { id: "creature", label: "Creature", aspect: "4:3", cutout: "full", trim: true, maxSize: 1024 },
  // The description tab's tall picture: the portrait's character and look, full length, art alone —
  // drawn in the character frame by the block (`framed: true` beside it).
  art: {
    id: "art",
    label: "Character art (framed)",
    aspect: "9:16",
    cutout: false,
    framed: true,
    trim: false,
    size: { w: 900, h: 1600 },
  },
  banner: {
    id: "banner",
    label: "Chapter banner",
    aspect: "16:9",
    cutout: false,
    trim: false,
    size: { w: 1600, h: 900 },
  },
  map: { id: "map", label: "Battle map", aspect: "1:1", cutout: false, trim: false, size: { w: 1536, h: 1536 } },
  // Drawn in a disc on the map: the square filled to its edges, the face at its centre.
  token: {
    id: "token",
    label: "Battle map token",
    aspect: "1:1",
    cutout: false,
    trim: false,
    size: { w: 512, h: 512 },
    fill: true,
  },
  icon: {
    id: "icon",
    label: "Hotbar icon",
    aspect: "1:1",
    cutout: false,
    trim: false,
    size: { w: 256, h: 256 },
    fill: true,
  },
};

/** A shape asked for (`3:4`) as width / height. */
export const aspectRatio = (aspect: string): number => {
  const [w, h] = aspect.split(":").map(Number);
  return w && h ? w / h : 1;
};

/**
 * The size a fixed-layout picture comes out: the picture it replaces, when that
 * has the shape asked for; else the shape asked for, as big as the kind (or the
 * replaced picture) goes. The shape chosen always wins — the size follows it.
 */
export function targetSize(
  kind: Pick<ImageKind, "size">,
  aspect: string,
  current?: { w: number; h: number }
): { w: number; h: number } | undefined {
  if (!kind.size) return undefined;
  const ratio = aspectRatio(aspect);
  if (current && Math.abs(current.w / current.h / ratio - 1) < 0.03) return current;
  const long = Math.max(current?.w ?? 0, current?.h ?? 0, kind.size.w, kind.size.h);
  return ratio >= 1 ? { w: long, h: Math.round(long / ratio) } : { w: Math.round(long * ratio), h: long };
}

/** The kind an image is, by where it sits. */
export function kindOf(target: ImageTarget, notePath = ""): ImageKindId {
  if (target.kind === "icon") return "icon";
  if (target.kind === "frontmatter") {
    if (/banner|cover/i.test(target.key)) return "banner";
    if (/^token/i.test(target.key)) return "token";
    if (/portrait/i.test(target.key)) return "portrait";
    // A note's reference image is what the note is: a person's portrait, a creature, else a thing.
    if (/\b(npcs?|characters?|people|persons?)\//i.test(notePath)) return "portrait";
    if (/\b(bestiary|companions?|creatures?|monsters?|beasts?)\//i.test(notePath)) return "creature";
    return "item";
  }
  const meta = target.meta;
  if (/^spell/.test(meta)) return "spell";
  if (/^stat\./.test(meta)) return "creature";
  if (/^character\.description/.test(meta)) return "art";
  if (/^character\./.test(meta)) return "portrait";
  if (/^(map|log)$/.test(meta)) return "map";
  return "item";
}

/** A block of the note: its kind, its head's fields, its body's prose. */
export interface NoteBlock {
  meta: string;
  data: Record<string, unknown>;
  body: string;
}

/** What a prompt is made from: the note, and the block the image belongs to. */
export interface PromptContext {
  /** The note's name (`Hematite`). */
  note: string;
  frontmatter: Record<string, unknown>;
  blocks: NoteBlock[];
  /** The block the image sits in, when it's a block's. */
  block?: NoteBlock;
  /** The note's prose, outside its blocks. */
  prose: string;
  /** What the image is of (a card's name, a block's `name:`). */
  name: string;
  /** A hotbar icon's type — its stone's tint and its glow (`spell`, `bonus`…). */
  tone?: IconTone;
  /** For a character: what their origin notes say (Kobold, Twisted Minion, Adherent), by role. */
  lore?: CharacterLore[];
}

/** One of a character's origins, as its own note describes it. */
export interface CharacterLore {
  role: "Lineage" | "Heritage" | "Background" | "Class";
  /** The note's name as written (marks and all), to find it by. */
  note: string;
  /** What it says — the start of its prose. */
  text: string;
}

/** A hotbar icon's type, as its tile is coloured. */
export type IconTone = "attack" | "action" | "bonus" | "reaction" | "spell" | "passive" | "gm" | "party";

/** A block's icon type: a spell's, a weapon's, a feature's by its `type:`. */
export function toneOf(block: NoteBlock | undefined): IconTone {
  if (!block) return "action";
  if (/^spell/.test(block.meta)) return "spell";
  if (/^item\./.test(block.meta)) return block.data.weapon ? "attack" : "action";
  const type = words(block.data.type).toLowerCase();
  if (/bonus/.test(type)) return "bonus";
  if (/reaction/.test(type)) return "reaction";
  if (/passive/.test(type)) return "passive";
  return "action";
}

/** Each type's stone and glow — after BG3's tiles, where the glyph glows on a muted stone of its family. */
export const ICON_COLOURS: Record<IconTone, [string, string]> = {
  attack: ["oxblood red", "fiery orange"],
  action: ["umber brown", "warm gold"],
  bonus: ["rust brown", "bright amber orange"],
  reaction: ["teal", "pale aqua"],
  spell: ["navy blue", "luminous cyan"],
  passive: ["moss green", "bright spring green"],
  gm: ["violet", "glowing magenta-pink"],
  party: ["leather brown", "pale gold"],
};

// ── Reading a note's fields as words ─────────────────────────────────────────

/** `[[Martial]] [[Ranged]] Weapons` → `Martial Ranged Weapons`; `**x**` → `x`. */
export const words = (v: unknown): string =>
  (Array.isArray(v) ? v.map(words).join(", ") : typeof v === "string" || typeof v === "number" ? String(v) : "")
    .replace(/!\[\[[^\]]*\]\]/g, "")
    .replace(/\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]/g, (_, t: string) => t.split("/").pop()!)
    // Line breaks and tags a note's source leaves in its text (`<br/>`, a broken `<br/<br/`).
    .replace(/<br\s*\/?>?/gi, " ")
    .replace(/<\/?[a-z][^>]*>/gi, "")
    .replace(/[*_`>]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** The first sentences of some prose, up to `max` characters. */
export function firstSentences(text: string, max = 280): string {
  const plain = words(text.replace(/^#+.*$/gm, "").replace(/`@\[\[[^`]*`/g, ""));
  if (plain.length <= max) return plain;
  const cut = plain.slice(0, max);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return (end > 80 ? cut.slice(0, end + 1) : `${cut.trimEnd()}…`).trim();
}

const get = (o: unknown, ...path: string[]): unknown =>
  path.reduce<unknown>((v, k) => (v && typeof v === "object" ? (v as Record<string, unknown>)[k] : undefined), o);

/** A colour for a damage type or school — what the magic looks like. */
function magicColour(damage: string, school: string): string {
  const by: Array<[RegExp, string]> = [
    [/fire/i, "roaring orange-red flame"],
    [/cold|ice|frost/i, "pale blue frost and ice crystals"],
    [/lightning|thunder/i, "crackling white-blue lightning"],
    [/acid/i, "hissing green acid"],
    [/poison/i, "sickly green vapour"],
    [/necrotic|necromancy/i, "draining black-violet shadow"],
    [/radiant|divine/i, "brilliant golden-white radiance"],
    [/force/i, "shimmering violet force"],
    [/psychic|enchantment/i, "swirling pink-violet psychic light"],
    [/abjuration/i, "protective translucent blue wards and runes"],
    [/conjuration/i, "glowing golden summoning circles"],
    [/divination/i, "silver-white light and floating eyes of runes"],
    [/evocation/i, "bright raw elemental energy"],
    [/illusion/i, "shifting iridescent mist"],
    [/transmutation/i, "flowing amber light reshaping matter"],
  ];
  return by.find(([re]) => re.test(damage) || re.test(school))?.[1] ?? "glowing arcane light";
}

// ── A character, from their sheet ──────────────────────────────────────────

const unmarked = (s: string) => s.replace(/\s*[ᴬᴮᴰᴴᴷᴺº]+$/u, "").trim();

/** `{ file: [[Elf]], comment: "for a hall" }` → `Elf, for a hall`; a plain `Elf` too. */
function origin(header: unknown, key: string): { name: string; note: string; comment: string } {
  const file = get(header, key, "file") ?? get(header, key);
  const note = words(file);
  return { name: unmarked(note), note, comment: words(get(header, key, "comment")) };
}

/**
 * What a character's sheet says of how they look and what made them: for a
 * prompt, the start (`who`: a Kobold of the Twisted Minion heritage, a Druid)
 * and the lines of detail — build, eyes, skin, hair, the whole appearance and
 * clothes, what's in hand and worn, each origin as its note describes it, the
 * start of their story.
 */
export function characterFacts(ctx: PromptContext): { who: string; lines: string[] } {
  const header = ctx.blocks.find((b) => /^character\.(header|sheet)$/.test(b.meta))?.data;
  const sheetOrDesc = ctx.blocks.find((b) => b.meta === "character.description")?.data ?? header;
  const appearance = get(sheetOrDesc, "appearance");
  const lineage = origin(header, "lineage").name ? origin(header, "lineage") : origin(header, "ancestry");
  const heritage = origin(header, "heritage");
  const background = origin(header, "background");
  const classes = (
    Array.isArray(get(header, "classes")) ? (get(header, "classes") as Array<Record<string, unknown>>) : []
  )
    .map((c) => ({ name: unmarked(words(c.name ?? c.class)), level: words(c.level) }))
    .filter((c) => c.name);

  // Age, height, weight, eyes, skin, hair — however the sheet lists them.
  const props = (
    Array.isArray(get(appearance, "side_props"))
      ? (get(appearance, "side_props") as Array<Record<string, unknown>>)
      : []
  ).flatMap((o) => Object.entries(o ?? {}).map(([k, v]) => [k, words(v)] as const));
  const prop = (k: string) => props.find(([key]) => key.toLowerCase() === k)?.[1];
  const build = [
    prop("age") && `${prop("age")} years old`,
    prop("height") && `${prop("height")} tall`,
    prop("weight") && `weighs ${prop("weight")}`,
  ].filter(Boolean);
  const features = [
    prop("eyes") && `eyes ${prop("eyes")}`,
    prop("skin") && `skin ${prop("skin")}`,
    prop("hair") && (/^none$/i.test(prop("hair")!) ? "no hair" : `hair ${prop("hair")}`),
  ].filter(Boolean);

  // What they carry in hand and wear: the inventory's slotted items.
  const inv = ctx.blocks.find((b) => b.meta === "character.inventory")?.data ?? header;
  const slotted = (Array.isArray(get(inv, "items")) ? (get(inv, "items") as Array<Record<string, unknown>>) : [])
    .filter((i) => i && typeof i === "object" && typeof i.slot === "string")
    .map((i) => `${unmarked(words(i.name))} (${String(i.slot).replace("_", " ")})`);

  const loreOf = (role: CharacterLore["role"], o: { name: string; note: string; comment: string }) => {
    const text = ctx.lore?.find((l) => l.role === role && l.note.toLowerCase() === o.note.toLowerCase())?.text;
    return `${role} ${o.name}${o.comment ? ` (${o.comment})` : ""}${text ? `: ${firstSentences(text, 260)}` : ""}`;
  };
  const origins = [
    lineage.name && loreOf("Lineage", lineage),
    heritage.name && loreOf("Heritage", heritage),
    background.name && loreOf("Background", background),
  ].filter(Boolean) as string[];

  const story = firstSentences(words(get(sheetOrDesc, "backstory", "text")), 320);
  const highlights = (
    Array.isArray(get(sheetOrDesc, "backstory", "highlights"))
      ? (get(sheetOrDesc, "backstory", "highlights") as Array<Record<string, unknown>>)
      : []
  )
    .map((h) => words(h.value ?? h.key))
    .filter(Boolean)
    .slice(0, 3);

  const who = [
    [build[0], lineage.name]
      .filter(Boolean)
      .join(" ")
      .replace(/^(\d+ years old) /, "$1 "),
    heritage.name && `${heritage.name}${heritage.comment ? ` ${heritage.comment}` : ""} heritage`,
    classes.length ? `a ${classes.map((c) => `${c.name}${c.level ? ` (level ${c.level})` : ""}`).join(" / ")}` : "",
    background.name && `${background.name}${background.comment ? ` ${background.comment}` : ""} background`,
  ]
    .filter(Boolean)
    .join(", ");

  const body = words(get(appearance, "body"));
  const clothes = words(get(appearance, "clothes"));
  const lines: string[] = [];
  if (build.length > 1 || features.length)
    lines.push(`Build and features: ${[...build.slice(1), ...features].join(", ")}.`);
  if (body) lines.push(`Appearance: ${firstSentences(body, 700)}`);
  if (clothes) lines.push(`Clothing: ${firstSentences(clothes, 500)}`);
  if (slotted.length) lines.push(`Carrying and wearing: ${slotted.join(", ")}.`);
  if (origins.length) lines.push(`What made them (for visual cues — show it, don't write it): ${origins.join(" · ")}`);
  if (story) lines.push(`Their story, for mood: ${story}${highlights.length ? ` (${highlights.join("; ")})` : ""}`);
  return { who, lines };
}

// ── The prompts ──────────────────────────────────────────────────────────────

// (Never "no watermark": Gemini blocks a prompt saying it as one asking to remove a watermark.)
const CUTOUT =
  "Isolated on a perfectly flat, solid pure magenta (#FF00FF) background — no gradient, no floor, no cast shadow on the background, " +
  "no other objects, no text, no letters.";

/**
 * A card's picture is the art alone, filling the whole canvas: the frame and the
 * name plaque are drawn around it by the plugin (CardFrame), once, not painted
 * into every picture by the model.
 */
const ART_ONLY =
  "Full-bleed: the painting fills the whole canvas edge to edge, nothing around it — no border, no frame, no vignette frame, " +
  "no plaque, no caption, no text, no letters.";

/** A long thing reads best wide: a bow, a polearm, a sword. */
const LONG =
  /bow|spear|pike|glaive|halberd|lance|staff|quarterstaff|javelin|trident|polearm|sword|rapier|scimitar|greatsword|longsword|rope|whip|maul|axe|warhammer/i;

/** The aspect an image of this kind is best made at, for this note. */
export function aspectFor(kind: ImageKindId, ctx: PromptContext): ImageKind["aspect"] {
  if (kind === "item" && LONG.test(`${ctx.name} ${words(ctx.block?.data.type)}`)) return "16:9";
  if (kind === "banner") return "16:9";
  return IMAGE_KINDS[kind].aspect;
}

/** The prompt for an image of `kind`, filled from the note — the user's words go after it. */
export function promptFor(kind: ImageKindId, ctx: PromptContext, iconStyle: string): string {
  const d = ctx.block?.data ?? {};
  const name = ctx.name;
  const lines: string[] = [];
  switch (kind) {
    case "item": {
      const type = words(d.type ?? ctx.frontmatter.type);
      const weapon = get(d, "weapon") as Record<string, unknown> | undefined;
      const armor = get(d, "armor") as Record<string, unknown> | undefined;
      const rarity = words(d.rarity);
      const magic =
        ctx.block?.meta === "item.magic" ||
        (Array.isArray(d.magic) && d.magic.length > 0) ||
        (!!rarity && !/common|varies/i.test(rarity));
      const what = [
        type &&
          `a ${type
            .toLowerCase()
            .replace(/\s*\(.*\)$/, "")
            .replace(/\b(weapon|item|tool|potion)s\b/, "$1")}`,
        weapon?.damage && `a weapon dealing ${words(weapon.damage)}`,
        armor && "armour",
        rarity && `${rarity.toLowerCase()} rarity`,
      ]
        .filter(Boolean)
        .join(", ");
      lines.push(
        `Painterly semi-realistic fantasy RPG equipment illustration, like an official tabletop rulebook's item art: ` +
          `a single ${name}${what ? ` (${what})` : ""} and nothing else — no stand, no cloth, no container, no props — ` +
          `shown whole in a clean three-quarter view, centred and filling the frame, crisp silhouette, ` +
          `true-to-life materials and fine detail, soft even studio light.`
      );
      const desc = firstSentences(ctx.block?.body || words(d.text) || ctx.prose);
      if (desc) lines.push(`What it is: ${desc}`);
      if (magic) lines.push("It is magical: a subtle inner glow and faint motes of light fitting its nature.");
      lines.push(CUTOUT);
      break;
    }
    case "spell": {
      const school = words(d.school);
      const damage = words(get(d, "roll", "damage", "type") ?? d.damage);
      const summary = words(d.summary);
      // The whole description — what the spell does, how it looks — not just its tooltip line.
      const full = firstSentences(ctx.block?.body ?? "", 1400);
      lines.push(
        `Fantasy illustration for the spell “${name}” (a card\u2019s picture): a dramatic, painterly scene of a robed spellcaster casting it, ` +
          `${school ? `${school.toLowerCase()} magic of ` : ""}${magicColour(damage, school)}, cinematic lighting, rich saturated colour.`
      );
      if (summary) lines.push(`In short: ${summary}`);
      if (full) lines.push(`The full description (let it decide what the scene shows): ${full}`);
      const mats = words(d.components);
      const extra = [
        words(d.casting) && `cast as ${words(d.casting)}`,
        words(d.range) && `range ${words(d.range)}`,
        words(d.duration) && `duration ${words(d.duration)}`,
        mats && `components ${mats}`,
      ]
        .filter(Boolean)
        .join(", ");
      if (extra) lines.push(`(${extra}.)`);
      lines.push(ART_ONLY);
      break;
    }
    case "portrait": {
      const c = characterFacts(ctx);
      lines.push(
        `Fantasy character portrait of ${name}${c.who ? `, ${c.who}` : ""}: waist-up, a confident characterful expression, ` +
          `in a fitting atmospheric setting, painterly realism, warm cinematic light.`
      );
      lines.push(...c.lines);
      if (c.lines.length === 0 && ctx.prose) lines.push(`Who they are: ${firstSentences(ctx.prose)}`);
      lines.push(ART_ONLY);
      break;
    }
    case "creature": {
      const type = words(d.type);
      const habitat = words(d.habitat);
      lines.push(
        `Painterly fantasy creature illustration for a monster manual: ${name}${type ? `, a ${type.toLowerCase()}` : ""}, ` +
          `shown full-body in a dynamic, natural pose, standing on a small irregular patch of its habitat${habitat ? ` (${habitat.toLowerCase()})` : ""}, ` +
          `detailed anatomy and texture, dramatic but clear lighting.`
      );
      const desc = firstSentences(ctx.block?.body || ctx.prose);
      if (desc) lines.push(`What it is: ${desc}`);
      lines.push(CUTOUT.replace("no floor, ", "no floor beyond its patch of ground, "));
      break;
    }
    case "art": {
      const c = characterFacts(ctx);
      lines.push(
        `Full-length fantasy character picture of ${name}${c.who ? `, ${c.who}` : ""}: the same character, costume and painterly look as their portrait, ` +
          `standing in a heroic pose from head to toe, tall vertical composition, in a fitting atmospheric setting, warm cinematic light.`
      );
      lines.push(...c.lines);
      lines.push(ART_ONLY);
      break;
    }
    case "banner": {
      const title = words(ctx.frontmatter.title) || ctx.note.replace(/^\d+[\w.]*\s*/, "");
      const topics = (ctx.prose.match(/^#{1,2}\s+(.+)$/gm) ?? [])
        .slice(0, 6)
        .map((h) => words(h.replace(/^#+\s+/, "")));
      lines.push(
        `Wide cinematic fantasy illustration opening the chapter “${title}” of a tabletop RPG book: one dramatic scene, ` +
          `adventurers in a vivid world, painterly, rich colour and depth, strong focal point, no text, no frame, no border.`
      );
      if (topics.length) lines.push(`The chapter covers: ${topics.join("; ")}.`);
      const intro = firstSentences(ctx.prose, 240);
      if (intro) lines.push(`Its opening: ${intro}`);
      break;
    }
    case "map": {
      lines.push(
        `Top-down tabletop battle map of ${name}: an orthographic view from directly above, painted terrain with clear walkable ground, ` +
          `cover and obstacles, natural detail, even lighting, no grid lines, no text, no tokens, no characters.`
      );
      const desc = firstSentences(ctx.prose);
      if (desc) lines.push(`The place: ${desc}`);
      break;
    }
    case "token": {
      // A party member from their sheet; anyone else (a foe) from their statblock.
      const sheet = ctx.blocks.some((b) => /^character\./.test(b.meta));
      const stat = ctx.blocks.find((b) => /^stat\./.test(b.meta));
      if (sheet) {
        const c = characterFacts(ctx);
        lines.push(`Battle map token art of ${name}${c.who ? `, ${c.who}` : ""}.`);
        lines.push(...c.lines.filter((l) => !/^Their story/.test(l)));
      } else {
        const type = words(stat?.data.type ?? ctx.frontmatter.type);
        const habitat = words(stat?.data.habitat);
        lines.push(
          `Battle map token art of ${name}${type ? `, a ${type.toLowerCase()}` : ""}${habitat ? ` of the ${habitat.toLowerCase()}` : ""}.`
        );
        const desc = firstSentences(stat?.body || ctx.prose);
        if (desc) lines.push(`What it is: ${desc}`);
      }
      lines.push(
        "A close-up portrait of this one character alone: head and shoulders only (nothing below the chest), facing the viewer " +
          "at a slight three-quarter angle, the face large at the very centre of the square. " +
          "It reads clearly at 40 pixels — bold silhouette, strong contrast — against a plain, softly lit, out-of-focus background " +
          "in one colour that suits them. Painterly fantasy art."
      );
      // (The map cuts the disc itself: a painted one — a vignette, a medallion — would show as a second ring.)
      lines.push(
        "The painting fills the whole square edge to edge, background reaching every corner — no vignette, no medallion, " +
          "no border, no frame, no labels, no captions, no text, no letters."
      );
      break;
    }
    case "icon": {
      // The tile's stone and glow, by the card's type (as the hotbar colours it).
      const [tint, glow] = ICON_COLOURS[ctx.tone ?? "action"] ?? ICON_COLOURS.action;
      lines.push(
        iconStyle
          .trim()
          .replace(/\{tint\}/g, tint)
          .replace(/\{glow\}/g, glow)
      );
      // ONE motif for its name; what it does only as background — a list of
      // ideas gets drawn as a stack of symbols, and its words get written.
      lines.push(
        `The symbol: one single iconic motif for “${name}” — the one most recognisable object, creature or gesture, drawn alone.`
      );
      // The full description, so the right motif is chosen — but only as background.
      const desc = firstSentences(ctx.block?.body || words(get(d, "text")) || ctx.prose, 900);
      if (desc)
        lines.push(
          `Background only (pick the single best motif from it; don't depict all of it, and never write any of it): ${desc}`
        );
      lines.push("Absolutely no writing of any kind anywhere in the image.");
      break;
    }
  }
  return lines.join("\n");
}
