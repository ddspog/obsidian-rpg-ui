/** Lonelog to try in the simulator: what the cards under work write into a log. */
export interface Sample {
  title: string;
  about: string;
  block: string;
}

const GM = 'gm: "[[00. GM Screen]]"\n---\n';

/** The Name Generator's styles and table refs, read from the vault as it is now. */
function generator(vault: Record<string, string>) {
  const text =
    Object.entries(vault).find(([p]) => p.endsWith("gm-tools/tables/elements-meaning/Name Generator.md"))?.[1] ?? "";
  const styles = [...(text.match(/ {8}choices: \[(.*)\]/)?.[1].matchAll(/"([^"]+)"/g) ?? [])].map((m) => m[1]);
  const ref = (id: string) => text.match(new RegExp(`"(@\\[\\[[^"\\]]+\\]\\]#${id})"`))?.[1] ?? `@[[?]]#${id}`;
  return { styles, ref, list: styles.join("/") };
}

export function makeSamples(vault: Record<string, string>): Sample[] {
  const g = generator(vault);
  const kinds = (open: string) =>
    `  + Kind of name: [Masculine name/Feminine name/Terrain name/Settlement name - ${open}]`;
  return [
    {
      title: "A blank scene",
      about: "A scene heading and some prose. Use the cards at the bottom to add entries.",
      block: `${GM}=> S01 The Crossroads Inn\n\nThe party reaches the inn at dusk.\n`,
    },
    {
      title: "Name Generator: style picked",
      about:
        "What the card writes once you pick a style. The Kind of name dropdown offers only that style's kinds; pick one to roll.",
      block: `${GM}=> S01 The Crossroads Inn\n\n? What is the innkeeper called?\ngen: Name Generator\n  Naming Style: [${g.list} - Anglish]\n${kinds("")}\n=> the innkeeper is named\n`,
    },
    {
      title: "Name Generator: terrain name, to roll",
      about: "Kind picked. Two tables share one row (`& Ending`), each with its own die: tap a die to roll it.",
      block: `${GM}=> S01 The Crossroads Inn\n\n? What is the hill called?\ngen: Name Generator\n  Naming Style: [${g.list} - Anglish]\n${kinds("Terrain name")}\n  + Name: ${g.ref("anglish-terrain-1")} d100= ->\n  + & Ending (optional): ${g.ref("anglish-terrain-3-endings")} d20= ->\n=> the hill is named\n`,
    },
    {
      title: "Name Generator: settlement name, rolled",
      about:
        "Arabish settlement name with both dice already rolled; the rows read their names from the Nomicon tables.",
      block: `${GM}=> S01 The Crossroads Inn\n\n? What is the caravan stop called?\ngen: Name Generator\n  Naming Style: [${g.list} - Arabish]\n${kinds("Settlement name")}\n  + Name: ${g.ref("arabish-city-and-settlement-names-starting-syllables")} d100=44 ->\n  + & Ending (optional): ${g.ref("arabish-city-and-settlement-names-ending")} d100=27 ->\n=> the caravan stop is named\n`,
    },
    {
      title: "Scene check",
      about: "A scene test with Chaos Factor 5, as the GM Screen's New Scene card writes it.",
      block: `${GM}? Does the "The party start journey on their mission, but a landslide force them to take a longer path." scene occur?\ngen: Testing the Expected Scene\n  Alterations: d10=8 vs CF -> Expected Scene\n=> S01 After the Landslide\n\nThe road gives way under the cart.\n`,
    },
  ];
}
