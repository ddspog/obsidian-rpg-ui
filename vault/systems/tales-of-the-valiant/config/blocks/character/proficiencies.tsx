import * as React from "react";
import { EntityBlock, Pill } from "rpg-ui-toolkit";
import { ProficienciesProps } from "./proficiencies.types";
import { CharacterEntity } from "../../entities/character.types";

type Category = { label: string; items: string[]; linkItems?: boolean };

function buildCategories(data: Record<string, string[]>): Category[] {
  const cats: Category[] = [];
  if (data.weapons?.length) cats.push({ label: "Weapons", items: data.weapons, linkItems: true });
  if (data.armor?.length) cats.push({ label: "Armor", items: data.armor, linkItems: true });
  if (data.tools?.length) cats.push({ label: "Tools", items: data.tools, linkItems: true });
  if (data.languages?.length) cats.push({ label: "Languages", items: data.languages });
  return cats;
}

export const proficiencies: EntityBlock<ProficienciesProps, CharacterEntity> = ({ self, blocks }) => {
  const data = (blocks as any).proficiencies ?? self;
  const cats = buildCategories(data);

  return (
    <section aria-label="Character Proficiencies">
      <header className="rpg-tag-heading"><span>Proficiencies</span></header>
      <dl>
        {cats.map(({ label, items, linkItems }) => (
          <div key={label}>
            <dt>{label}</dt>
            {items.map((item, i) => (
              <dd key={i}>
                {linkItems ? <Pill.Link link={item}>{item}</Pill.Link> : item}
              </dd>
            ))}
          </div>
        ))}
      </dl>
    </section>
  );
};

export default proficiencies;
