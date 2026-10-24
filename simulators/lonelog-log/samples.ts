/** Lonelog to try in the simulator: what the cards under work write into a log. */
import type { Sample } from "../core/types";

const GM = 'gm: "[[00. GM Screen]]"\n---\n';

/** The Name Generator's styles and table refs, read from the vault as it is now. */
function generator(vault: Record<string, string>) {
  const text =
    Object.entries(vault).find(([p]) => p.endsWith("gm-tools/tables/elements-meaning/Name Generator.md"))?.[1] ?? "";
  const styles = [...(text.match(/ {8}choices: \[(.*)\]/)?.[1].matchAll(/"([^"]+)"/g) ?? [])].map((m) => m[1]);
  const ref = (id: string) => text.match(new RegExp(`"(@\\[\\[[^"\\]]+\\]\\]#${id})"`))?.[1] ?? `@[[?]]#${id}`;
  return { text, styles, ref, list: styles.join("/") };
}

export function makeSamples(vault: Record<string, string>): Sample[] {
  const g = generator(vault);
  const kinds = (open: string) =>
    `  + Kind of name: [Masculine name/Feminine name/Terrain name/Settlement name - ${open}]`;
  /** A style's own kinds, as the generator lists them (none when the style rolls directly). */
  const kindsOf = (style: string): string[] => {
    const text = generator(vault).text;
    const block = text.split(/^ {2}- choice: "/m).find((b) => b.startsWith(`${style}"`)) ?? "";
    return [...block.matchAll(/^ {6}- choice: "([^"]+)"/gm)].map((m) => m[1]);
  };
  /** A card with the style picked and the kind left to choose, to see how that style's rows read. */
  const confusing = (style: string, kind: string, about: string): Sample => {
    const options = kindsOf(style);
    const direct = options.length === 0;
    return {
      title: `Name Generator: ${style}${direct ? "" : `, ${kind}`}`,
      about: direct
        ? `Pick another style and then ${style} again to spawn its rows, then tap each die. ${about}`
        : `Pick "${kind}" in Kind of name, then tap each die. ${about}`,
      text: `${GM}=> S01 The Crossroads Inn\n\n? What is the innkeeper called?\ngen: Name Generator\n  Naming Style: [${g.list} - ${style}]\n${
        direct ? "" : `  + Kind of name: [${options.join("/")} - ]\n`
      }=> the innkeeper is named\n`,
    };
  };
  return [
    {
      title: "A blank scene",
      about: "A scene heading and some prose. Use the cards at the bottom to add entries.",
      text: `${GM}=> S01 The Crossroads Inn\n\nThe party reaches the inn at dusk.\n`,
    },
    {
      title: "Name Generator: style picked",
      about:
        "What the card writes once you pick a style. The Kind of name dropdown offers only that style's kinds; pick one to roll.",
      text: `${GM}=> S01 The Crossroads Inn\n\n? What is the innkeeper called?\ngen: Name Generator\n  Naming Style: [${g.list} - Anglish]\n${kinds("")}\n=> the innkeeper is named\n`,
    },
    {
      title: "Name Generator: terrain name, to roll",
      about: "Kind picked. Two tables share one row (`& Ending`), each with its own die: tap a die to roll it.",
      text: `${GM}=> S01 The Crossroads Inn\n\n? What is the hill called?\ngen: Name Generator\n  Naming Style: [${g.list} - Anglish]\n${kinds("Terrain name")}\n  + Name: ${g.ref("anglish-terrain-1")} d100= ->\n  + & Ending (optional): ${g.ref("anglish-terrain-3-endings")} d20= ->\n=> the hill is named\n`,
    },
    {
      title: "Name Generator: settlement name, rolled",
      about:
        "Arabish settlement name with both dice already rolled; the rows read their names from the Nomicon tables.",
      text: `${GM}=> S01 The Crossroads Inn\n\n? What is the caravan stop called?\ngen: Name Generator\n  Naming Style: [${g.list} - Arabish]\n${kinds("Settlement name")}\n  + Name: ${g.ref("arabish-city-and-settlement-names-starting-syllables")} d100=44 ->\n  + & Ending (optional): ${g.ref("arabish-city-and-settlement-names-ending")} d100=27 ->\n=> the caravan stop is named\n`,
    },
    {
      title: "Scene check",
      about: "A scene test with Chaos Factor 5, as the GM Screen's New Scene card writes it.",
      text: `${GM}? Does the "The party start journey on their mission, but a landslide force them to take a longer path." scene occur?\ngen: Testing the Expected Scene\n  Alterations: d10=8 vs CF -> Expected Scene\n=> S01 After the Landslide\n\nThe road gives way under the cart.\n`,
    },
    confusing(
      "East Asiantic",
      "Culture or country name",
      "A Start and an Ending, each rolled on its own: with one value each, the name is made for you."
    ),
    confusing("Anglish", "Masculine name", "Two alternative names in a row: both are shown, use either."),
    confusing(
      "Celtigaulic",
      "Town name",
      "Roll any one Start and any one End: the row lists three Starts and two Ends, six names in all."
    ),
    confusing(
      "Brittonian (Welsh)",
      "Feminine name",
      "Two tables labelled only 1, 2, 3 and so on: which numbers are beginnings and which are endings?"
    ),
    confusing("Brittonian (Welsh)", "Masculine name", "Two tables, each with a/b/c parts that you combine yourself."),
    confusing(
      "Dwarven",
      "Personal name",
      "One Start with a masculine and a feminine ending: the kind of name is already picked, yet both endings print."
    ),
    confusing("Nörslik", "Masculine name", "A base name and two dialect spellings of it."),
    confusing("Trobadoric", "City or town name", "A first part with three dialect endings."),
    confusing("Russlavik", "Masculine name", "Four whole names under the headings 1 to 4: use any one."),
    confusing("Demonic", "", "Style with no kind: three tables (first part, second part, epithet) in one result."),
    confusing("Angelic", "", "Ten columns over three tables: the longest result."),
  ];
}
