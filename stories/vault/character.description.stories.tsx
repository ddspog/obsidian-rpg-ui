/**
 * Stories for the Tales of the Valiant character.description block
 *
 * Exercises each tab (Appearance, Backstory, Allies & Enemies, Organizations,
 * Motivation) and the empty-state variants. The "Full" story uses the
 * Jacqui Ilitul data from the design brief so designers can eyeball the
 * intended density.
 */

import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { RpgBlock } from "../lib/RpgBlock";
import type { RPGSystem } from "../../lib/systems/types";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — runtime import; types are declared via api.d.ts
import { system as systemPromise } from "../../vault/systems/tales-of-the-valiant/config/index";

type DescriptionArgs = Record<string, never>;

const meta: Meta<DescriptionArgs> = {
  title: "Vault / Character / Description",
  loaders: [
    async () => ({
      system: (await systemPromise) as RPGSystem,
    }),
  ],
};
export default meta;

type Story = StoryObj<DescriptionArgs>;

// ─── Fixture YAML ─────────────────────────────────────────────────────────────

const fullYaml = `
appearance:
  body: |
    With a striking face and short, blonde hair — a signature trait of the
    Ilitul family — Jacqui exudes an air of refined nobility. His youthful,
    medium build is complemented by his clean, fair skin and piercing blue
    eyes that hint at his distinguished lineage. His hair, though often
    neatly kept, grows slightly unkempt during his busier times.
  clothes: |
    Jacqui wears common clothes in brown, touched with a shimmering
    dark-blue coming from the [[Lusanda, the Muse]] faith. His attire is
    practical yet stylish, reflecting his noble heritage while remaining
    suitable for his clerical duties.
  side_props:
    - age: 21
      height: "5'7''"
      weight: "200 lb."
    - eyes: Blue
      skin: Caucasian
      hair: "Short, blonde-silver"
  art: "[[jacqui-ilitul.webp]]"

backstory:
  homeland: "[[Borelhearth]]"
  text: |
    Jacqui was born to a couple from the Ilitul family. His mother bore the
    prestigious Ilitul name, while his father belonged to an unknown noble
    lineage. He was born in a secret [[Lusanda, the Muse|Lusanda]] Temple
    dedicated to Twilight, during a time when his family desperately sought
    peaceful endings to their conflicts. From birth, Jacqui was destined to
    become an [[Lusanda, the Muse|Lusanda]] cleric, serving his family by
    bringing prosperity to their city and business. Mysteriously, both his
    parents vanished, an event shrouded in secrecy that erased them from
    the memory of all who knew them. By that time, the family had grown to
    include 11 children.

    The family came under the care of Caleb Ilitul, a cheerful uncle aged
    51, who took them to a sprawling goat farm outside [[Borelhearth]].
    There, Jacqui was raised alongside his siblings. Caleb managed the
    estate with the help of Bjarte, his 23-year-old sibling most invested
    in the business.

    After his father's disappearance, Bjarte learned of the unfulfilled
    promise of Jacqui's clerical future. But the temple where Jacqui was
    born was destroyed. Fearing divine retribution, Bjarte searched for
    other temples, and using his connections sent Jacqui on an immediate
    pilgrimage to the secret [[Treyfell]] temple for
    [[Lusanda, the Muse|Lusanda]].

    Jacqui remains determined to restore the honor of the Ilitul name and
    bring glory to his family.
  highlights:
    - key: "Parents Forgotten"
      value: "His parents disappeared after an unknown event that magically erased their memories from their peers."
    - key: "Active Siblings"
      value: "Various brothers and sisters are active in Waterdeep, taking care of the family business."
    - key: "Birth Promise"
      value: "From birth, Jacqui was promised to become a cleric."
    - footnote: "_A character with good connections to nobility._"

allies:
  - name: "[[Caleb Ilitul]]"
    role: "Guardian"
    portrait: "[[caleb-ilitul.webp]]"
    text: |
      A dear uncle in his early fifties who provided Jacqui with invaluable
      life lessons. Caleb served as the primary tutor for all his siblings,
      imparting extensive knowledge about [[Borelhearth]], noble customs,
      and the workings of the family farm.
  - name: "[[Meriele Tiltathana]]"
    role: "Lover"
    portrait: "[[meriele.webp]]"
    text: |
      A kind-hearted elf ranger who lovingly tends to a small farm near
      Wisdom's Path. Meriele's steadfast nature and connection to the land
      make her a source of inspiration and grounding for Jacqui.
  - name: "Great House of Ilitul"
    role: "Family"
    text: |
      The Ilitul family amassed their wealth as goat herders before
      diversifying into mercenary ventures. Their grand villa in the Sea
      Ward symbolizes their stature.

enemies:
  - name: "Thorp Family"
    role: "Rivals"
    text: |
      A bitter feud erupted between the Ilitul and Thorp families when
      Guster Ilitul was infamously seen strangling Delbert Thorp during
      the second annual Black Bucket Hunt. The incident was witnessed by
      many through a modified arcane eye spell.

organizations:
  - name: "[[Lurker's Hall]]"
    portrait: "[[lurkers-hall.webp]]"
    text: |
      The famous hunter academy on [[Rindelbran]]. They are specialized in
      tracking: treasures, targets, game, weak points, etc. Not just
      rangers are formed there, but rogues, druids, etc. There's connection
      to other factions, where some missions can come to the people
      graduated there. After graduation, a Lurker can become a mercenary,
      soldier, investigator, thief, etc.
    position: "Graduating, on final quest for obtaining his Licensee."

motivation:
  - text: |
      _Adventuring frees me to practice more unorthodox methods of worship._
`;

const onlyMotivationYaml = `
motivation:
  - text: "_Adventuring frees me to practice more unorthodox methods of worship._"
`;

const emptyYaml = "{}";

// ─── Stories ──────────────────────────────────────────────────────────────────

export const Full: Story = {
  name: "Full (Jacqui Ilitul)",
  render: (_args, { loaded }) => (
    <RpgBlock
      system={loaded.system}
      entity="character"
      block="description"
      yaml={fullYaml}
      filePath="stories/jacqui-ilitul.md"
    />
  ),
};

export const Empty: Story = {
  name: "Empty (no data)",
  render: (_args, { loaded }) => (
    <RpgBlock
      system={loaded.system}
      entity="character"
      block="description"
      yaml={emptyYaml}
      filePath="stories/empty-character.md"
    />
  ),
};

export const OnlyMotivation: Story = {
  name: "Only motivation (single centred card)",
  render: (_args, { loaded }) => (
    <RpgBlock
      system={loaded.system}
      entity="character"
      block="description"
      yaml={onlyMotivationYaml}
      filePath="stories/motivation-only.md"
    />
  ),
};
