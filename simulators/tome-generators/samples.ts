/** Lonelog to start the Tome generators simulator from. */
import type { Sample } from "../core/types";

const GM = 'gm: "[[00. GM Screen]]"\n---\n';

export function makeSamples(_vault: Record<string, string>): Sample[] {
  return [
    {
      title: "A blank scene",
      about: "A scene heading and a line of prose. Open the Generator cards at the bottom and build a world.",
      text: `${GM}=> S01 Making the world\n\nThe campaign begins with a blank map.\n`,
    },
    {
      title: "A deity, ready to roll",
      about: "What the Deity Generator writes once a kind is picked. Tap each die to roll it.",
      text: `${GM}=> S01 Making the world\n\n? What is this god of?\ngen: Deity Generator\n  Kind of deity: [Areas of divine power/Symbol/Status and fate/Battle deity/Trickster deity - Battle deity]\n=> The god:\n`,
    },
  ];
}
